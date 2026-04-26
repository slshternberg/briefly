/**
 * Analysis worker — runs Gemini analysis as a background task.
 *
 * Extracted from process/route.ts so it can be called both:
 *  - Directly via `void runAnalysisJob(params)` (current single-server mode)
 *  - In future: as a job queue handler (BullMQ, pg-boss, etc.)
 *
 * Memory fix: for local storage we pass a file path to Gemini instead of
 * loading the entire file into a Buffer. For an 80 MB file this eliminates
 * an ~160 MB RAM spike (Buffer + Blob) per analysis.
 */

import { db } from "@/lib/db";
import { getStorageProvider } from "@/services/storage";
import { analyzeConversationAudio } from "@/services/gemini";
import { getActiveStyleProfile } from "@/services/style";
import { logAudit } from "@/lib/audit";
import { incrementConversationUsage } from "@/lib/billing";
import { sendAnalysisCompleteNotification } from "@/services/gmail";
import { env } from "@/lib/env";

export interface AnalysisJobParams {
  conversationId: string;
  workspaceId: string;
  userId: string;
  assetId: string;
  assetStoragePath: string;
  assetMimeType: string;
  assetDurationSeconds: number;
  outputLanguage: string;
  conversationInstructions?: string;
  customInstructions?: string;
  conversationTitle: string;
}

export async function runAnalysisJob(p: AnalysisJobParams): Promise<void> {
  try {
    const storage = getStorageProvider();

    // Memory-efficient: pass a file path for local storage instead of reading
    // the entire file into a Buffer. The Gemini SDK streams the file itself.
    // For S3 we still need the buffer (no local path available).
    const isLocal = process.env.STORAGE_TYPE !== "s3";
    const fileParam: { filePath: string } | { fileBuffer: Buffer } = isLocal
      ? { filePath: storage.getFilePath(p.assetStoragePath) }
      : { fileBuffer: await storage.getFileBuffer(p.assetStoragePath) };

    const userInstructions = p.conversationInstructions
      ? `[Conversation-specific instructions]\n${p.conversationInstructions}`
      : undefined;

    const styleProfile = await getActiveStyleProfile(p.workspaceId);
    const rawStyleExamples = p.customInstructions
      ? await db.styleExample.findMany({
          where: { workspaceId: p.workspaceId, status: "COMPLETED" },
          select: { title: true, sentEmailSubject: true, sentEmailBody: true },
          orderBy: { createdAt: "desc" },
          take: 3,
        })
      : [];
    const styleExamples = rawStyleExamples.map((ex) => ({
      title: ex.title,
      emailSubject: ex.sentEmailSubject,
      emailBody: ex.sentEmailBody,
    }));

    let result;
    try {
      result = await analyzeConversationAudio({
        ...fileParam,
        mimeType: p.assetMimeType,
        outputLanguage: p.outputLanguage,
        userInstructions,
        customPrompt: p.customInstructions,
        styleProfile,
        styleExamples: styleExamples.length > 0 ? styleExamples : undefined,
      });
    } catch (geminiError) {
      await db.conversation.update({
        where: { id: p.conversationId },
        data: { status: "FAILED" },
      });
      console.error("[analysis-worker] Gemini error:", geminiError);
      return;
    }

    const structuredData = { ...result.analysis, customSummary: result.customSummary };

    await db.$transaction([
      db.conversationSummary.upsert({
        where: { conversationId: p.conversationId },
        create: {
          workspaceId: p.workspaceId,
          conversationId: p.conversationId,
          rawText: result.rawResponse,
          structuredData: JSON.parse(JSON.stringify(structuredData)),
          modelUsed: result.modelUsed,
          promptTokens: result.promptTokens,
          outputTokens: result.outputTokens,
        },
        update: {
          rawText: result.rawResponse,
          structuredData: JSON.parse(JSON.stringify(structuredData)),
          modelUsed: result.modelUsed,
          promptTokens: result.promptTokens,
          outputTokens: result.outputTokens,
        },
      }),
      db.conversation.update({
        where: { id: p.conversationId },
        data: { status: "COMPLETED", language: p.outputLanguage },
      }),
    ]);

    logAudit({
      workspaceId: p.workspaceId,
      userId: p.userId,
      action: "conversation.process",
      targetType: "conversation",
      targetId: p.conversationId,
      metadata: { modelUsed: result.modelUsed, outputLanguage: p.outputLanguage },
    });

    incrementConversationUsage(p.workspaceId, p.assetDurationSeconds).catch(
      (err) => console.error("[analysis-worker] Usage increment failed:", err)
    );

    // Notification preference is now workspace-level (set in settings).
    // Read it server-side, never trust the client to opt in/out per call.
    const ws = await db.workspace.findUnique({
      where: { id: p.workspaceId },
      select: { notifyOnAnalysisDone: true },
    });
    if (ws?.notifyOnAnalysisDone) {
      const baseUrl = env.AUTH_URL;
      sendAnalysisCompleteNotification({
        userId: p.userId,
        conversationId: p.conversationId,
        conversationTitle: p.conversationTitle,
        baseUrl,
      }).catch((err) =>
        console.error("[analysis-worker] Notification send failed:", err)
      );
    }
  } catch (err) {
    console.error("[analysis-worker] Fatal error:", err);
    await db.conversation
      .update({ where: { id: p.conversationId }, data: { status: "FAILED" } })
      .catch(() => {});
  }
}
