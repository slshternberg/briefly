import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStorageProvider } from "@/services/storage";
import { logAudit } from "@/lib/audit";
import { decrementStorageUsage } from "@/lib/billing";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;

  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.activeWorkspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = session.user.activeWorkspaceId;

    const conversation = await db.conversation.findFirst({
      where: { id: conversationId, workspaceId, deletedAt: null },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const title = body.title?.trim();

    if (!title || typeof title !== "string" || title.length > 200) {
      return NextResponse.json({ error: "Invalid title" }, { status: 400 });
    }

    await db.conversation.update({
      where: { id: conversationId },
      data: { title },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Patch conversation error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;

  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.activeWorkspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = session.user.activeWorkspaceId;

    const conversation = await db.conversation.findFirst({
      where: { id: conversationId, workspaceId, deletedAt: null },
      include: { assets: { select: { storagePath: true, sizeBytes: true } } },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Delete audio files from storage
    const storage = getStorageProvider();
    for (const asset of conversation.assets) {
      await storage.deleteFile(asset.storagePath);
    }

    // Soft delete the conversation
    await db.conversation.update({
      where: { id: conversationId },
      data: { deletedAt: new Date() },
    });

    // Decrement storage quota — fire-and-forget, never blocks the response
    const totalBytes = conversation.assets.reduce(
      (sum, a) => sum + Number(a.sizeBytes), 0
    );
    if (totalBytes > 0) {
      decrementStorageUsage(workspaceId, totalBytes).catch(
        (err) => console.error("Storage decrement failed:", err)
      );
    }

    logAudit({
      workspaceId,
      userId: session.user.id,
      action: "conversation.delete",
      targetType: "conversation",
      targetId: conversationId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete conversation error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
