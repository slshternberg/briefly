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
import { sendEmailSchema } from "@/lib/validations/conversation";
import { rateLimitUser } from "@/lib/rate-limit";
import { spawn } from "child_process";

// Gmail's hard limit on a sent message is 25 MB. Base64 inflates the payload by
// ~33%, so the raw attachment must be ≤ ~18 MB to leave headroom for the
// encoded body + MIME headers. Use a slightly tighter cap to stay safe.
const MAX_ATTACHMENT_RAW_BYTES = 18 * 1024 * 1024;

// Floor / ceiling for the dynamic bitrate when compressing for email.
// 16 kbps mono is already near "telephone quality" — anything lower starts
// dropping syllables. 64 kbps is plenty for short clips.
const MIN_BITRATE_KBPS = 16;
const MAX_BITRATE_KBPS = 64;
const BIZFLY_URL = "https://bizfly.co.il/";
const BIZFLY_LOGO_URL = "https://briefly.bizfly.co.il/images/logo%20bizfly.png";

function encodeSubject(subject: string) {
  return `=?UTF-8?B?${Buffer.from(subject, "utf-8").toString("base64")}?=`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Re-encode the audio to mono MP3 at a bitrate calculated to fit
 * MAX_ATTACHMENT_RAW_BYTES. Used only when the original file would put the
 * outgoing Gmail message over 25 MB. ffmpeg must be installed on the host
 * (`apt install ffmpeg` — see docs/deploy/MASTER-DEPLOY.md).
 *
 * Returns null if compression failed for any reason; the caller falls back
 * to sending without an attachment.
 */
async function compressForEmail(
  inputBuffer: Buffer,
  durationSeconds: number
): Promise<Buffer | null> {
  if (durationSeconds <= 0) return null;

  // bitrate that fills exactly MAX bytes for the given duration:
  //   bits = MAX * 8;  bps = bits / seconds;  kbps = bps / 1000
  // Subtract a small headroom so the produced file lands a touch under MAX.
  const headroom = 0.9;
  const targetKbps = Math.floor(
    ((MAX_ATTACHMENT_RAW_BYTES * 8 * headroom) / durationSeconds) / 1000
  );
  const cappedKbps = Math.max(
    MIN_BITRATE_KBPS,
    Math.min(MAX_BITRATE_KBPS, targetKbps)
  );

  return new Promise<Buffer | null>((resolve) => {
    const args = [
      "-hide_banner",
      "-loglevel", "error",
      "-i", "pipe:0",
      "-vn",                              // drop any video track
      "-ac", "1",                         // mono
      "-ar", "22050",                     // 22 kHz is fine for speech
      "-b:a", `${cappedKbps}k`,           // calculated bitrate
      "-f", "mp3",
      "pipe:1",
    ];

    const ff = spawn("ffmpeg", args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    const chunks: Buffer[] = [];
    let stderr = "";

    ff.stdout.on("data", (c) => chunks.push(c as Buffer));
    ff.stderr.on("data", (c) => { stderr += String(c); });

    ff.on("error", (err) => {
      console.error("ffmpeg spawn failed:", err);
      resolve(null);
    });

    ff.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks));
      } else {
        console.error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`);
        resolve(null);
      }
    });

    // Pipe the source bytes in; if the encoder dies before we finish writing
    // we'll just hit EPIPE here and the close handler resolves null.
    ff.stdin.on("error", () => {});
    ff.stdin.write(inputBuffer);
    ff.stdin.end();
  });
}

function getGoogleApiStatus(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  const maybeStatus = (err as { code?: unknown; status?: unknown }).code ?? (err as { status?: unknown }).status;
  return typeof maybeStatus === "number" ? maybeStatus : undefined;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { session, workspace } = await requireAuth();
  const { conversationId } = await params;

  const limited = await rateLimitUser(session.user.id, "sendEmail", {
    workspaceId: workspace.id,
    userId: session.user.id,
    action: "ratelimit.send_email",
  });
  if (limited) return limited;

  let rawBody: unknown;
  try { rawBody = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = sendEmailSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid request" },
      { status: 400 }
    );
  }
  const { to, subject, body } = parsed.data;

  // Verify conversation belongs to this workspace (IDOR protection)
  const conversation = await db.conversation.findFirst({
    where: { id: conversationId, workspaceId: workspace.id, deletedAt: null },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  // Read 2 of 2: get decrypted tokens (prefers encrypted columns, falls back to plaintext)
  let tokens: Awaited<ReturnType<typeof getDecryptedGoogleTokens>>;
  try {
    tokens = await getDecryptedGoogleTokens(session.user.id);
  } catch (err) {
    console.error("Failed to read Gmail OAuth tokens:", err);
    return NextResponse.json(
      { error: "Gmail connection is invalid. Please reconnect Gmail in settings." },
      { status: 400 }
    );
  }
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
    select: {
      storagePath: true,
      originalName: true,
      mimeType: true,
      durationSeconds: true,
    },
  });

  // Convert markdown-like text to HTML with RTL support
  const escapedBody = escapeHtml(body)
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br>");

  const bodyHtml = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<body style="direction:rtl;text-align:right;font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#222;max-width:700px;margin:0 auto;padding:16px;">
${escapedBody}
<div style="margin-top:28px;padding-top:16px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;line-height:1.5;">
  <span style="vertical-align:middle;">המערכת נבנתה על ידי </span>
  <a href="${BIZFLY_URL}" style="display:inline-block;vertical-align:middle;text-decoration:none;" target="_blank" rel="noopener noreferrer">
    <img src="${BIZFLY_LOGO_URL}" alt="BIZFLY" width="72" style="display:inline-block;vertical-align:middle;border:0;max-width:72px;height:auto;margin-inline-start:6px;" />
  </a>
</div>
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
      let attachBuffer = await getStorageProvider().getFileBuffer(asset.storagePath);
      let attachMime = asset.mimeType;
      let attachName = asset.originalName;

      // If the raw file alone would push the message past Gmail's 25 MB cap
      // (after base64 inflation), re-encode to a low-bitrate mono MP3 sized
      // to fit. Keeps the user's high-quality original in storage / for
      // Gemini analysis untouched — only the email copy is compressed.
      if (
        attachBuffer.length > MAX_ATTACHMENT_RAW_BYTES &&
        asset.durationSeconds &&
        asset.durationSeconds > 0
      ) {
        const compressed = await compressForEmail(
          attachBuffer,
          asset.durationSeconds
        );
        if (compressed && compressed.length < MAX_ATTACHMENT_RAW_BYTES) {
          attachBuffer = compressed;
          attachMime = "audio/mpeg";
          attachName = asset.originalName.replace(/\.[^.]+$/, "") + ".mp3";
        }
        // If compression failed or still too large, fall through to the
        // size check below — we'll skip the attachment rather than ship a
        // payload Gmail will reject.
      }

      if (attachBuffer.length <= MAX_ATTACHMENT_RAW_BYTES) {
        const fileBase64 = attachBuffer.toString("base64");
        const safeName = encodeSubject(attachName);

        rawParts = rawParts.concat([
          ``,
          `--${boundary}`,
          `Content-Type: ${attachMime}`,
          `Content-Transfer-Encoding: base64`,
          `Content-Disposition: attachment; filename="${safeName}"`,
          ``,
          fileBase64,
        ]);
      }
      // If still too big after compression — silently skip the attachment.
      // The text body still ships; the user gets the summary either way.
    } catch {
      // File not found / storage error — send without attachment.
    }
  }

  rawParts.push(``, `--${boundary}--`);

  const raw = Buffer.from(rawParts.join("\r\n"), "utf-8").toString("base64url");

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  try {
    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });
  } catch (err) {
    const status = getGoogleApiStatus(err);
    console.error("Failed to send Gmail message:", err);

    if (status === 401 || status === 403) {
      return NextResponse.json(
        { error: "Gmail authorization expired. Please reconnect Gmail in settings." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to send email via Gmail. Please try again later." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
