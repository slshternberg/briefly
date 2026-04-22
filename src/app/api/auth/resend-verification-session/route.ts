import { NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail, buildVerificationEmail } from "@/services/email";
import { env } from "@/lib/env";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "passwordReset");
  if (limited) return limited;

  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.emailVerified) {
    return NextResponse.json({ ok: true });
  }

  const raw = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.emailVerificationToken.create({
    data: { userId: session.user.id, tokenHash, expiresAt },
  });

  const link = `${env.AUTH_URL}/api/auth/verify-email?token=${raw}`;

  await sendEmail({
    to: session.user.email,
    subject: "Briefly — אמתי את כתובת המייל שלך",
    html: buildVerificationEmail(link),
  });

  return NextResponse.json({ ok: true });
}
