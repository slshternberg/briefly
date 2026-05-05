import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

// All redirects below use env.AUTH_URL as the base. Using req.nextUrl behind
// `next start` + nginx leaks the upstream bind address (localhost:3000) into
// the Location header — Next.js does not honour X-Forwarded-Host when
// constructing nextUrl, so the only reliable origin in production is the
// AUTH_URL we already validated at boot.
const VERIFY_ERROR_URL = `${env.AUTH_URL}/login?verifyError=true`;
const VERIFIED_URL = `${env.AUTH_URL}/verified`;

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(VERIFY_ERROR_URL);
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const now = new Date();

  // SR-6: atomic consume. updateMany matches on unique tokenHash only when
  // unused + unexpired; count=1 is the winner, count=0 means already used
  // / expired / missing. The subsequent read is safe because the row is
  // now irreversibly marked used — no second consumer can race in.
  const claimed = await db.emailVerificationToken.updateMany({
    where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (claimed.count === 0) {
    return NextResponse.redirect(VERIFY_ERROR_URL);
  }
  const record = await db.emailVerificationToken.findUnique({
    where: { tokenHash },
    select: { userId: true },
  });
  if (!record) {
    return NextResponse.redirect(VERIFY_ERROR_URL);
  }

  await db.user.update({
    where: { id: record.userId },
    data: { emailVerified: true },
  });

  return NextResponse.redirect(VERIFIED_URL);
}
