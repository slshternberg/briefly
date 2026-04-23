import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || !session.user.activeWorkspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { conversationId } = await params;
  const workspaceId = session.user.activeWorkspaceId;

  const conversation = await db.conversation.findFirst({
    where: { id: conversationId, workspaceId, deletedAt: null },
    select: { status: true, updatedAt: true },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Auto-fail conversations stuck in PROCESSING for more than 30 minutes
  if (conversation.status === "PROCESSING") {
    const ageMs = Date.now() - conversation.updatedAt.getTime();
    if (ageMs > 30 * 60 * 1000) {
      await db.conversation.update({
        where: { id: conversationId },
        data: { status: "FAILED" },
      });
      return NextResponse.json({ status: "FAILED" });
    }
  }

  return NextResponse.json({ status: conversation.status });
}
