import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { checkMembersLimit } from "@/lib/billing";
import { sendEmail, buildInvitationEmail } from "@/services/email";
import { env } from "@/lib/env";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  role: z.enum(["MEMBER", "ADMIN"]).default("MEMBER"),
});

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "passwordReset"); // 3/hr per IP
  if (limited) return limited;

  const session = await auth();
  if (!session?.user?.id || !session.user.activeWorkspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.activeWorkspaceRole;
  if (role !== "OWNER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Only owners and admins can invite members" }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { email, role: inviteRole } = parsed.data;
  const workspaceId = session.user.activeWorkspaceId;

  // Check if already a member
  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) {
    const isMember = await db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: existingUser.id } },
    });
    if (isMember) {
      return NextResponse.json({ error: "משתמש זה כבר חבר בסביבת העבודה" }, { status: 409 });
    }
  }

  // Check plan member limit via billing
  const membersLimitError = await checkMembersLimit(workspaceId);
  if (membersLimitError) {
    return NextResponse.json({ error: membersLimitError }, { status: 402 });
  }

  const raw = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

  await db.workspaceInvitation.create({
    data: { workspaceId, email, role: inviteRole, tokenHash, expiresAt, invitedById: session.user.id },
  });

  const workspace = await db.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } });
  const inviter = await db.user.findUnique({ where: { id: session.user.id }, select: { name: true } });

  const link = `${env.AUTH_URL}/join?token=${raw}`;

  await sendEmail({
    to: email,
    subject: `הוזמנת להצטרף ל-${workspace?.name ?? "Briefly"}`,
    html: buildInvitationEmail(workspace?.name ?? "Briefly", inviter?.name ?? "מנהל", link),
  });

  return NextResponse.json({ ok: true });
}
