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

  const now = new Date();

  // SR-6: atomic consume. The `updateMany` matches at most one row (tokenHash
  // is unique) and only when it's unused + unexpired. Two concurrent
  // consumers see count 1 + count 0 — the loser 400s without side effects.
  const claimed = await db.passwordResetToken.updateMany({
    where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (claimed.count === 0) {
    return NextResponse.json({ error: "הקישור פג תוקף או לא תקין" }, { status: 400 });
  }
  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true },
  });
  if (!record) {
    // Should be unreachable (we just matched on the unique tokenHash) but
    // keep a graceful path for a concurrent DB migration / row-delete race.
    return NextResponse.json({ error: "הקישור פג תוקף או לא תקין" }, { status: 400 });
  }

  const passwordHash = await hash(password, 12);

  const updatedUser = await db.user.update({
    where: { id: record.userId },
    data: { passwordHash, passwordChangedAt: now },
    include: { memberships: { where: { role: "OWNER" }, take: 1, select: { workspaceId: true } } },
  });

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
