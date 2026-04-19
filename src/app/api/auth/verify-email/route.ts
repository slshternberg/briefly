import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login?verifyError=true", req.nextUrl));
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const record = await db.emailVerificationToken.findUnique({ where: { tokenHash } });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return NextResponse.redirect(new URL("/login?verifyError=true", req.nextUrl));
  }

  await db.$transaction([
    db.user.update({
      where: { id: record.userId },
      data: { emailVerified: true },
    }),
    db.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return NextResponse.redirect(new URL("/login?verified=true", req.nextUrl));
}
