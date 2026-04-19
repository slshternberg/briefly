import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimitUser } from "@/lib/rate-limit";
import { chatWithConversation } from "@/services/gemini";
import { buildConversationChatPrompt } from "@/services/ai/prompts";
import type { ConversationAnalysis } from "@/services/gemini/schema";

const MAX_HISTORY_MESSAGES = 20;
const MAX_QUESTION_LENGTH = 2000;

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

    // 2. Parse body
    let question: string;
    let outputLanguage = "en";
    let threadId: string | undefined;
    try {
      const body = await req.json();
      question = body.question;
      if (body.outputLanguage) outputLanguage = body.outputLanguage;
      if (body.threadId) threadId = body.threadId;
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    if (!question || typeof question !== "string" || question.trim().length === 0) {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 }
      );
    }

    if (question.length > MAX_QUESTION_LENGTH) {
      return NextResponse.json(
        { error: `Question too long (max ${MAX_QUESTION_LENGTH} characters)` },
        { status: 400 }
      );
    }

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
