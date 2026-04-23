import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const { memberId } = await params;

  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.activeWorkspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = session.user.activeWorkspaceId;
    const actorRole = session.user.activeWorkspaceRole;

    if (actorRole !== "OWNER" && actorRole !== "ADMIN") {
      return NextResponse.json({ error: "Only owners and admins can remove members" }, { status: 403 });
    }

    const target = await db.workspaceMember.findFirst({
      where: { id: memberId, workspaceId },
    });

    if (!target) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // OWNER cannot be removed
    if (target.role === "OWNER") {
      return NextResponse.json({ error: "The workspace owner cannot be removed" }, { status: 403 });
    }

    // Prevent self-removal
    if (target.userId === session.user.id) {
      return NextResponse.json({ error: "You cannot remove yourself" }, { status: 403 });
    }

    await db.workspaceMember.delete({ where: { id: memberId } });

    logAudit({
      workspaceId,
      userId: session.user.id,
      action: "workspace.member_removed",
      targetType: "workspace",
      targetId: workspaceId,
      metadata: { removedUserId: target.userId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Remove member error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
