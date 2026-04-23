import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimitUser } from "@/lib/rate-limit";
import { checkAiQueryLimit, incrementAiQueryUsage } from "@/lib/billing";
import { logAudit } from "@/lib/audit";
import { chatWithConversation } from "@/services/gemini";
import { buildConversationChatPrompt } from "@/services/ai/prompts";
import type { ConversationAnalysis } from "@/services/gemini/schema";
import { chatRequestSchema } from "@/lib/validations/conversation";

const MAX_HISTORY_MESSAGES = 20;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;

  try {
    // 1. Auth
    const session = await auth();
    if (!session?.user?.id || !session.user.activeWorkspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = session.user.activeWorkspaceId;
    const userId = session.user.id;

    // Rate limit: max 60 chat calls per hour per user
    const limited = await rateLimitUser(userId, "chat");
    if (limited) return limited;

    // Billing: check monthly AI query limit
    const limitError = await checkAiQueryLimit(workspaceId);
    if (limitError) {
      return NextResponse.json({ error: limitError }, { status: 402 });
    }

    // 2. Parse body
    let rawBody: unknown;
    try { rawBody = await req.json(); } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const parsed = chatRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid request" },
        { status: 400 }
      );
    }
    const question = parsed.data.question;
    const outputLanguage = parsed.data.outputLanguage ?? "en";
    const threadId = parsed.data.threadId;

    // 3. Verify conversation + summary exist and belong to workspace
    const conversation = await db.conversation.findFirst({
      where: { id: conversationId, workspaceId, deletedAt: null },
      include: { summary: true },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    if (!conversation.summary?.structuredData) {
      return NextResponse.json(
        { error: "Conversation has no analysis yet. Process it first." },
        { status: 400 }
      );
    }

    const summaryData = conversation.summary.structuredData as unknown as ConversationAnalysis;

    // 4. Get or create thread
    let thread;
    if (threadId) {
      thread = await db.chatThread.findFirst({
        where: { id: threadId, conversationId, workspaceId },
      });
      if (!thread) {
        return NextResponse.json(
          { error: "Chat thread not found" },
          { status: 404 }
        );
      }
    } else {
      thread = await db.chatThread.create({
        data: {
          workspaceId,
          conversationId,
          title: question.slice(0, 100),
        },
      });
    }

    // 5. Load recent chat history (desc + reverse = last N in chronological order)
    const previousMessages = await db.chatMessage.findMany({
      where: { threadId: thread.id, workspaceId },
      orderBy: { createdAt: "desc" },
      take: MAX_HISTORY_MESSAGES,
      select: { role: true, content: true },
    });
    previousMessages.reverse();

    const chatHistory = previousMessages.map((m) => ({
      role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    }));

    // 6. Build prompt (no audio — summary only)
    const { systemInstruction, contents } = buildConversationChatPrompt({
      outputLanguage,
      summaryData,
      chatHistory,
      userQuestion: question.trim(),
    });

    // 7. Call Gemini
    let result;
    try {
      result = await chatWithConversation({ systemInstruction, contents });
    } catch (geminiError) {
      console.error("Gemini chat error:", geminiError);
      return NextResponse.json(
        { error: "AI chat failed. Please try again." },
        { status: 502 }
      );
    }

    // 8. Store both messages in transaction
    const [userMessage, assistantMessage] = await db.$transaction([
      db.chatMessage.create({
        data: {
          workspaceId,
          threadId: thread.id,
          role: "USER",
          content: question.trim(),
          userId,
        },
      }),
      db.chatMessage.create({
        data: {
          workspaceId,
          threadId: thread.id,
          role: "ASSISTANT",
          content: result.response,
          modelUsed: result.modelUsed,
          promptTokens: result.promptTokens,
          outputTokens: result.outputTokens,
        },
      }),
    ]);

    // Increment AI query usage (fire-and-forget)
    incrementAiQueryUsage(workspaceId).catch(
      (err) => console.error("AI usage increment failed:", err)
    );

    logAudit({
      workspaceId,
      userId,
      action: "conversation.chat",
      targetType: "conversation",
      targetId: conversationId,
      metadata: { threadId: thread.id, modelUsed: result.modelUsed },
    });

    return NextResponse.json({
      threadId: thread.id,
      userMessage: {
        id: userMessage.id,
        role: userMessage.role,
        content: userMessage.content,
        createdAt: userMessage.createdAt,
      },
      assistantMessage: {
        id: assistantMessage.id,
        role: assistantMessage.role,
        content: assistantMessage.content,
        createdAt: assistantMessage.createdAt,
      },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: "Chat failed unexpectedly" },
      { status: 500 }
    );
  }
}
