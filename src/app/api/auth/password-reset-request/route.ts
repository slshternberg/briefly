import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail, buildPasswordResetEmail } from "@/services/email";
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
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const { email } = parsed.data;

  // Always return 200 to avoid leaking email existence
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ ok: true });

  const raw = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") || undefined;

  await db.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt, ipAddress: ip },
  });

  const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  const link = `${baseUrl}/reset-password?token=${raw}`;

  await sendEmail({
    to: email,
    subject: "Briefly — איפוס סיסמה",
    html: buildPasswordResetEmail(link),
  });

  return NextResponse.json({ ok: true });
}
