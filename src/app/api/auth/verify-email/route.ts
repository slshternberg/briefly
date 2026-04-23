import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login?verifyError=true", req.nextUrl));
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
    return NextResponse.redirect(new URL("/login?verifyError=true", req.nextUrl));
  }
  const record = await db.emailVerificationToken.findUnique({
    where: { tokenHash },
    select: { userId: true },
  });
  if (!record) {
    return NextResponse.redirect(new URL("/login?verifyError=true", req.nextUrl));
  }

  await db.user.update({
    where: { id: record.userId },
    data: { emailVerified: true },
  });

  return NextResponse.redirect(new URL("/verified", req.nextUrl));
}
