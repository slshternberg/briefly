import { requireAuth } from "@/lib/auth-guard";
import { google } from "googleapis";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export async function GET() {
  await requireAuth();

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${env.AUTH_URL}/api/auth/google/callback`
  );

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/gmail.send", "email"],
  });

  return NextResponse.redirect(url);
}
