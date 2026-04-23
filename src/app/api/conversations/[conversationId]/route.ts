import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStorageProvider } from "@/services/storage";
import { logAudit } from "@/lib/audit";
import { decrementStorageUsage } from "@/lib/billing";
import { renameConversationSchema } from "@/lib/validations/conversation";

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

    let body: unknown;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const parsed = renameConversationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid title" },
        { status: 400 }
      );
    }
    const { title } = parsed.data;

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

    // Atomic soft-delete: `updateMany` with the `deletedAt: null` guard means
    // only one caller wins a concurrent DELETE race. Losers get count === 0
    // and short-circuit without double-deleting files or double-decrementing
    // the storage counter.
    const result = await db.conversation.updateMany({
      where: { id: conversationId, workspaceId, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    if (result.count === 0) {
      return NextResponse.json({ success: true });
    }

    // Winner path — delete files and decrement storage once.
    const storage = getStorageProvider();
    for (const asset of conversation.assets) {
      await storage.deleteFile(asset.storagePath);
    }

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
