import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail, buildVerificationEmail } from "@/services/email";
import { z } from "zod";

const schema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "passwordReset");
  if (limited) return limited;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: true });

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || user.emailVerified) return NextResponse.json({ ok: true });

  const raw = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await db.emailVerificationToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  const link = `${baseUrl}/api/auth/verify-email?token=${raw}`;

  await sendEmail({
    to: user.email,
    subject: "Briefly — אמתי את כתובת המייל שלך",
    html: buildVerificationEmail(link),
  });

  return NextResponse.json({ ok: true });
}
