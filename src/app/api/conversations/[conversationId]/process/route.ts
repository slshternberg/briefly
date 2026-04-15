import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStorageProvider } from "@/services/storage";
import { analyzeConversationAudio } from "@/services/gemini";
import { getActiveStyleProfile } from "@/services/style";
import { sendAnalysisCompleteNotification } from "@/services/gmail";

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

    // 2. Read request body
    let outputLanguage = "Hebrew";
    let conversationInstructions: string | undefined;
    let sendNotification = false;
    try {
      const body = await req.json();
      if (body.outputLanguage && typeof body.outputLanguage === "string") {
        outputLanguage = body.outputLanguage;
      }
      if (body.conversationInstructions && typeof body.conversationInstructions === "string") {
        conversationInstructions = body.conversationInstructions.slice(0, 3000);
      }
      if (body.sendNotification === true) {
        sendNotification = true;
      }
    } catch {
      // No body or invalid JSON — use defaults
    }

    // 3. Load workspace (for custom instructions + custom prompt)
    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { customInstructions: true, defaultLanguage: true },
    });

    // Use workspace default language if none provided in request
    if (!outputLanguage || outputLanguage === "Hebrew") {
      outputLanguage = workspace?.defaultLanguage || "Hebrew";
    }

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

    // 4. Get the audio asset
    const asset = await db.conversationAsset.findFirst({
      where: {
        conversationId,
        workspaceId,
        uploadStatus: "COMPLETED",
      },
      orderBy: { createdAt: "desc" },
    });

    if (!asset) {
      return NextResponse.json(
        { error: "No audio file found for this conversation" },
        { status: 400 }
      );
    }

    // 5. Set status to PROCESSING
    await db.conversation.update({
      where: { id: conversationId },
      data: { status: "PROCESSING" },
    });

    // 6. Get file path from storage
    const storage = getStorageProvider();
    const filePath = storage.getFilePath(asset.storagePath);

    // 7. Build per-conversation instructions (injected into general analysis prompt)
    const instructionParts: string[] = [];
    if (conversationInstructions) {
      instructionParts.push(`[Conversation-specific instructions]\n${conversationInstructions}`);
    }
    const userInstructions = instructionParts.length > 0
      ? instructionParts.join("\n\n")
      : undefined;

    // 8. Load style profile + raw email examples for few-shot prompting
    const styleProfile = await getActiveStyleProfile(workspaceId);

    // Load the 3 most recent completed style examples.
    // Their actual email text is sent to Gemini as few-shot style examples —
    // this is far more accurate than relying on the abstract style profile alone.
    const rawStyleExamples = workspace?.customInstructions
      ? await db.styleExample.findMany({
          where: { workspaceId, status: "COMPLETED" },
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

    // 9. Call Gemini — general analysis + custom summary (if custom prompt exists)
    //    customPrompt = workspace.customInstructions (from Settings)
    //    userInstructions = per-conversation instructions (from Analyze button)
    //    styleProfile = abstract style patterns (from profile generation)
    //    styleExamples = actual sent emails for few-shot style matching (primary signal)
    let result;
    try {
      result = await analyzeConversationAudio({
        filePath,
        mimeType: asset.mimeType,
        outputLanguage,
        userInstructions,
        customPrompt: workspace?.customInstructions || undefined,
        styleProfile,
        styleExamples: styleExamples.length > 0 ? styleExamples : undefined,
      });
    } catch (geminiError) {
      await db.conversation.update({
        where: { id: conversationId },
        data: { status: "FAILED" },
      });

      console.error("Gemini processing error:", geminiError);

      const raw = geminiError instanceof Error ? geminiError.message : String(geminiError);

      let errorCode = "processing_failed";
      if (raw.includes("503") || raw.includes("UNAVAILABLE") || raw.includes("high demand") || raw.includes("overloaded")) {
        errorCode = "overloaded";
      } else if (raw.includes("429") || raw.includes("RESOURCE_EXHAUSTED") || raw.includes("quota") || raw.includes("rate")) {
        errorCode = "quota_exceeded";
      } else if (raw.includes("401") || raw.includes("403") || raw.includes("API_KEY") || raw.includes("permission")) {
        errorCode = "auth_error";
      }

      return NextResponse.json({ error: errorCode }, { status: 502 });
    }

    // 9. Store results — general analysis + custom summary together
    const structuredData = {
      ...result.analysis,
      customSummary: result.customSummary,
    };

    await db.$transaction([
      db.conversationSummary.upsert({
        where: { conversationId },
        create: {
          workspaceId,
          conversationId,
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
        where: { id: conversationId },
        data: { status: "COMPLETED", language: outputLanguage },
      }),
    ]);

    // Send notification email (only if user opted in — fire-and-forget)
    if (sendNotification) {
      const baseUrl = process.env.AUTH_URL || "http://localhost:3000";
      sendAnalysisCompleteNotification({
        userId: session.user.id,
        conversationId,
        conversationTitle: conversation.title,
        baseUrl,
      });
    }

    return NextResponse.json({
      status: "COMPLETED",
      summary: result.analysis,
      customSummary: result.customSummary,
    });
  } catch (error) {
    try {
      await db.conversation.update({
        where: { id: conversationId },
        data: { status: "FAILED" },
      });
    } catch {
      // Ignore
    }

    console.error("Process conversation error:", error);
    return NextResponse.json(
      { error: "Processing failed unexpectedly" },
      { status: 500 }
    );
  }
}
