import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const token = (body as { token?: string }).token;
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

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

  await db.$transaction([
    db.workspaceMember.create({
      data: { workspaceId: invitation.workspaceId, userId: user.id, role: invitation.role as "MEMBER" | "ADMIN" },
    }),
    db.workspaceInvitation.update({
      where: { id: invitation.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ workspaceId: invitation.workspaceId });
}
