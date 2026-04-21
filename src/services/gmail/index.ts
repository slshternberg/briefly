import { google } from "googleapis";
import {
  getDecryptedGoogleTokens,
  refreshEncryptedAccessToken,
} from "@/services/google/tokens";

function encodeSubject(subject: string) {
  return `=?UTF-8?B?${Buffer.from(subject, "utf-8").toString("base64")}?=`;
}

/**
 * Sends a notification email to the user via their connected Gmail account.
 * Silently skips if Gmail is not connected.
 */
export async function sendAnalysisCompleteNotification({
  userId,
  conversationId,
  conversationTitle,
  baseUrl,
}: {
  userId: string;
  conversationId: string;
  conversationTitle: string;
  baseUrl: string;
}) {
  try {
    // Read 1 of 2: get decrypted tokens (prefers encrypted columns, falls back to plaintext)
    const tokens = await getDecryptedGoogleTokens(userId);
    if (!tokens?.access || !tokens.email) return;

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${baseUrl}/api/auth/google/callback`
    );

    oauth2Client.setCredentials({
      access_token: tokens.access,
      refresh_token: tokens.refresh ?? undefined,
    });

    // Write 2 of 3: token refresh — dual-write (encrypted + plaintext)
    oauth2Client.on("tokens", async (newTokens) => {
      if (newTokens.access_token) {
        await refreshEncryptedAccessToken(userId, newTokens.access_token).catch(
          (err) => console.error("Failed to persist refreshed OAuth token:", err)
        );
      }
    });

    const link = `${baseUrl}/dashboard/conversations/${conversationId}`;

    const bodyHtml = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<body style="direction:rtl;text-align:right;font-family:Arial,sans-serif;font-size:14px;line-height:1.8;color:#222;max-width:600px;margin:0 auto;padding:24px;">
  <h2 style="margin-top:0;color:#111;">הניתוח הושלם</h2>
  <p>השיחה <strong>${conversationTitle}</strong> נותחה בהצלחה.</p>
  <p>
    <a href="${link}" style="display:inline-block;background:#f97316;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">
      צפה בניתוח
    </a>
  </p>
  <p style="margin-top:24px;font-size:12px;color:#888;">הודעה זו נשלחה אוטומטית מ-Briefly</p>
</body>
</html>`;

    const subject = encodeSubject(`Briefly — ניתוח הושלם: ${conversationTitle}`);
    const bodyBase64 = Buffer.from(bodyHtml, "utf-8").toString("base64");

    const rawMessage = [
      `MIME-Version: 1.0`,
      `From: ${tokens.email}`,
      `To: ${tokens.email}`,
      `Subject: ${subject}`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      ``,
      bodyBase64,
    ].join("\r\n");

    const raw = Buffer.from(rawMessage, "utf-8").toString("base64url");
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
  } catch (err) {
    // Notification failure should never fail the analysis
    console.error("Failed to send analysis notification email:", err);
  }
}

// ============================================================================
// Cost calculation
// ============================================================================

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gemini-2.5-flash": { input: 0.15, output: 0.6 },
  "gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
  "gemini-2.5-pro": { input: 1.25, output: 10.0 },
  "gemini-2.0-flash-001": { input: 0.1, output: 0.4 },
};

/**
 * Returns estimated cost in USD, or null if unknown model.
 */
export function calculateGeminiCost(
  model: string,
  promptTokens: number | null,
  outputTokens: number | null
): number | null {
  if (!promptTokens || !outputTokens) return null;

  const pricing =
    MODEL_PRICING[model] ??
    Object.entries(MODEL_PRICING).find(([key]) => model.startsWith(key))?.[1];

  if (!pricing) return null;

  return (
    (promptTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output
  );
}
