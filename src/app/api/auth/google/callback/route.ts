import { requireAuth } from "@/lib/auth-guard";
import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { setEncryptedGoogleTokens } from "@/services/google/tokens";

export async function GET(req: NextRequest) {
  const { session } = await requireAuth();
  const code = req.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(
      `${process.env.AUTH_URL}/dashboard/settings?google=error`
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.AUTH_URL}/api/auth/google/callback`
  );

  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
  const { data } = await oauth2.userinfo.get();

  // Write 1 of 3: initial connect — dual-write (encrypted + plaintext)
  await setEncryptedGoogleTokens(session.user.id, {
    access: tokens.access_token!,
    refresh: tokens.refresh_token ?? null,
    email: data.email ?? null,
  });

  return NextResponse.redirect(
    `${process.env.AUTH_URL}/dashboard/settings?google=connected`
  );
}
