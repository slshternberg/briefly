import { requireAuth } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { getStorageProvider } from "@/services/storage";
import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import {
  getDecryptedGoogleTokens,
  refreshEncryptedAccessToken,
} from "@/services/google/tokens";
import { env } from "@/lib/env";

function encodeSubject(subject: string) {
  return `=?UTF-8?B?${Buffer.from(subject, "utf-8").toString("base64")}?=`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { session, workspace } = await requireAuth();
  const { conversationId } = await params;
  const { to, subject, body } = await req.json();

  // Validate email address
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!to || !emailRegex.test(to)) {
    return NextResponse.json({ error: "Invalid recipient email" }, { status: 400 });
  }

  // Verify conversation belongs to this workspace (IDOR protection)
  const conversation = await db.conversation.findFirst({
    where: { id: conversationId, workspaceId: workspace.id, deletedAt: null },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  // Read 2 of 2: get decrypted tokens (prefers encrypted columns, falls back to plaintext)
  const tokens = await getDecryptedGoogleTokens(session.user.id);
  if (!tokens?.access) {
    return NextResponse.json(
      { error: "Google account not connected" },
      { status: 400 }
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${env.AUTH_URL}/api/auth/google/callback`
  );

  oauth2Client.setCredentials({
    access_token: tokens.access,
    refresh_token: tokens.refresh ?? undefined,
  });

  // Write 3 of 3: token refresh — dual-write (encrypted + plaintext)
  oauth2Client.on("tokens", async (newTokens) => {
    if (newTokens.access_token) {
      await refreshEncryptedAccessToken(
        session.user.id,
        newTokens.access_token
      ).catch((err) =>
        console.error("Failed to persist refreshed OAuth token:", err)
      );
    }
  });

  // Load audio asset (optional attachment). Filter by workspaceId as defense in depth:
  // the conversation is already workspace-scoped above, but a mismatched asset row
  // (e.g. from a bad migration) must not leak across tenants.
  const asset = await db.conversationAsset.findFirst({
    where: { conversationId, workspaceId: workspace.id },
    select: { storagePath: true, originalName: true, mimeType: true },
  });

  // Convert markdown-like text to HTML with RTL support
  const bodyHtml = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<body style="direction:rtl;text-align:right;font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#222;max-width:700px;margin:0 auto;padding:16px;">
${body
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
  .replace(/\*(.*?)\*/g, "<em>$1</em>")
  .replace(/\n/g, "<br>")}
</body>
</html>`;

  const boundary = `boundary_${Date.now()}`;
  const bodyBase64 = Buffer.from(bodyHtml, "utf-8").toString("base64");

  let rawParts = [
    `MIME-Version: 1.0`,
    `From: ${tokens.email ?? session.user.email}`,
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    bodyBase64,
  ];

  if (asset) {
    try {
      const fileBuffer = await getStorageProvider().getFileBuffer(asset.storagePath);
      const fileBase64 = fileBuffer.toString("base64");
      const safeName = encodeSubject(asset.originalName);

      rawParts = rawParts.concat([
        ``,
        `--${boundary}`,
        `Content-Type: ${asset.mimeType}`,
        `Content-Transfer-Encoding: base64`,
        `Content-Disposition: attachment; filename="${safeName}"`,
        ``,
        fileBase64,
      ]);
    } catch {
      // File not found — send without attachment
    }
  }

  rawParts.push(``, `--${boundary}--`);

  const raw = Buffer.from(rawParts.join("\r\n"), "utf-8").toString("base64url");

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });

  return NextResponse.json({ ok: true });
}
