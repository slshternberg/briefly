import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { joinInvitationSchema } from "@/lib/validations/workspace";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = joinInvitationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid request" },
      { status: 400 }
    );
  }
  const { token } = parsed.data;

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const invitation = await db.workspaceInvitation.findUnique({ where: { tokenHash } });

  if (!invitation || invitation.usedAt || invitation.expiresAt < new Date()) {
    return NextResponse.json({ error: "ההזמנה פגה תוקף או אינה תקינה" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    return NextResponse.json({ error: "ההזמנה שייכת לכתובת מייל אחרת" }, { status: 403 });
  }

  // Check not already a member
  const existing = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId: user.id } },
  });
  if (existing) {
    return NextResponse.json({ error: "כבר חבר בסביבת העבודה" }, { status: 409 });
  }

  const now = new Date();

  // SR-6: atomic consume of the invitation. Only the caller whose
  // updateMany matches usedAt=null + unexpired wins; a concurrent second
  // click or a replay attempt sees count=0 and 400s. Membership is created
  // AFTER the consume so a failed consume never leaves a dangling row; the
  // compound unique on (workspaceId, userId) is a second-line defense.
  const consumed = await db.workspaceInvitation.updateMany({
    where: { id: invitation.id, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (consumed.count === 0) {
    return NextResponse.json({ error: "ההזמנה פגה תוקף או אינה תקינה" }, { status: 400 });
  }

  try {
    await db.workspaceMember.create({
      data: {
        workspaceId: invitation.workspaceId,
        userId: user.id,
        role: invitation.role as "MEMBER" | "ADMIN",
      },
    });
  } catch (err) {
    // Unique-constraint collision: another request (possibly one that raced
    // through BEFORE we consumed) already created the membership. That's the
    // "already a member" case — treat as a no-op success since the user IS
    // effectively in the workspace.
    const code = (err as { code?: string }).code;
    if (code !== "P2002") throw err;
  }

  return NextResponse.json({ workspaceId: invitation.workspaceId, role: invitation.role });
}
