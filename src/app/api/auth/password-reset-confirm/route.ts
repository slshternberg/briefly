import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { z } from "zod";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "הסיסמה חייבת להכיל לפחות 8 תווים"),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { token, password } = parsed.data;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const record = await db.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return NextResponse.json({ error: "הקישור פג תוקף או לא תקין" }, { status: 400 });
  }

  const passwordHash = await hash(password, 12);
  const now = new Date();

  const [updatedUser] = await db.$transaction([
    db.user.update({
      where: { id: record.userId },
      data: { passwordHash, passwordChangedAt: now },
      include: { memberships: { where: { role: "OWNER" }, take: 1, select: { workspaceId: true } } },
    }),
    db.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: now },
    }),
  ]);

  const workspaceId = updatedUser.memberships[0]?.workspaceId;
  if (workspaceId) {
    logAudit({
      workspaceId,
      userId: record.userId,
      action: "user.password_reset",
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    });
  }

  return NextResponse.json({ ok: true });
}
