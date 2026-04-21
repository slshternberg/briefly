import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimitUser } from "@/lib/rate-limit";
import {
  checkConversationLimit,
  checkAudioMinutesLimit,
} from "@/lib/billing";
import { runAnalysisJob } from "@/services/analysis/worker";
import { extractDurationSeconds } from "@/lib/duration";
import { getStorageProvider } from "@/services/storage";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;

  try {
    // 1. Auth check
    const session = await auth();
    if (!session?.user?.id || !session.user.activeWorkspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = session.user.activeWorkspaceId;

    // Rate limit: max 20 process calls per hour per user
    const limited = await rateLimitUser(session.user.id, "process");
    if (limited) return limited;

    // Billing: check monthly conversation limit
    const limitError = await checkConversationLimit(workspaceId);
    if (limitError) {
      return NextResponse.json({ error: limitError }, { status: 402 });
    }

    // 2. Read request body
    let outputLanguage = "Hebrew";
    let conversationInstructions: string | undefined;
    let sendNotification = false;
    try {
      const body = await req.json();
      if (body.outputLanguage && typeof body.outputLanguage === "string") {
        outputLanguage = body.outputLanguage;
      }
      if (
        body.conversationInstructions &&
        typeof body.conversationInstructions === "string"
      ) {
        conversationInstructions = body.conversationInstructions.slice(0, 3000);
      }
      if (body.sendNotification === true) {
        sendNotification = true;
      }
    } catch {
      // No body or invalid JSON — use defaults
    }

    // 3. Load workspace (for custom instructions + default language)
    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { customInstructions: true, defaultLanguage: true },
    });

    if (!outputLanguage || outputLanguage === "Hebrew") {
      outputLanguage = workspace?.defaultLanguage || "Hebrew";
    }

    // 4. Validate conversation
    const conversation = await db.conversation.findFirst({
      where: { id: conversationId, workspaceId, deletedAt: null },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    const allowedStatuses = ["UPLOADED", "FAILED", "COMPLETED"];
    if (!allowedStatuses.includes(conversation.status)) {
      return NextResponse.json(
        {
          error: `Cannot process conversation in "${conversation.status}" status.`,
        },
        { status: 400 }
      );
    }

    // 5. Get the audio asset
    const asset = await db.conversationAsset.findFirst({
      where: { conversationId, workspaceId, uploadStatus: "COMPLETED" },
      orderBy: { createdAt: "desc" },
    });

    if (!asset) {
      return NextResponse.json(
        { error: "No audio file found for this conversation" },
        { status: 400 }
      );
    }

    // Fallback: if duration wasn't captured at upload time, attempt extraction now.
    // Failure → 422 so the user knows to re-upload rather than getting silent billing at 0s.
    let assetDurationSeconds = asset.durationSeconds;
    if (assetDurationSeconds == null) {
      const storage = getStorageProvider();
      const isLocal = process.env.STORAGE_TYPE !== "s3";
      const retry = await extractDurationSeconds(
        isLocal
          ? { filePath: storage.getFilePath(asset.storagePath) }
          : { buffer: await storage.getFileBuffer(asset.storagePath), mimeType: asset.mimeType }
      );
      if (retry == null) {
        return NextResponse.json(
          { error: "Audio duration could not be determined. Please re-upload the file." },
          { status: 422 }
        );
      }
      await db.conversationAsset.update({
        where: { id: asset.id },
        data: { durationSeconds: retry },
      });
      assetDurationSeconds = retry;
    }

    // Billing: check audio minutes limit
    const audioLimitError = await checkAudioMinutesLimit(
      workspaceId,
      assetDurationSeconds
    );
    if (audioLimitError) {
      return NextResponse.json({ error: audioLimitError }, { status: 402 });
    }

    // 6. Mark as PROCESSING — visible to the client immediately
    await db.conversation.update({
      where: { id: conversationId },
      data: { status: "PROCESSING" },
    });

    // 7. Run the analysis in the background.
    //    The HTTP response returns immediately; the job continues in the same
    //    Node.js process (PM2 keeps it alive).
    //    If the server restarts mid-job, instrumentation.ts will auto-fail the
    //    conversation on the next startup so users can retry.
    void runAnalysisJob({
      conversationId,
      workspaceId,
      userId: session.user.id,
      assetId: asset.id,
      assetStoragePath: asset.storagePath,
      assetMimeType: asset.mimeType,
      assetDurationSeconds,
      outputLanguage,
      conversationInstructions,
      customInstructions: workspace?.customInstructions || undefined,
      conversationTitle: conversation.title,
      sendNotification,
    });

    return NextResponse.json({ status: "PROCESSING" });
  } catch (error) {
    try {
      await db.conversation.update({
        where: { id: conversationId },
        data: { status: "FAILED" },
      });
    } catch {
      // Ignore — conversation may not exist
    }

    console.error("Process conversation error:", error);
    return NextResponse.json(
      { error: "Processing failed unexpectedly" },
      { status: 500 }
    );
  }
}
