/**
 * Google OAuth token storage — encrypted at rest.
 *
 * Strategy during migration window (dual-write):
 *   Writes go to BOTH the new encrypted columns AND the old plaintext columns,
 *   so a rollback to the previous deploy keeps working.
 *   Reads prefer the encrypted columns; fall back to plaintext for users not
 *   yet backfilled.
 *
 * After backfill + second migration (drop_plaintext_google_tokens):
 *   Only the encrypted columns exist. This file continues to work unchanged.
 */

import { db } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";

export interface GoogleTokenSet {
  /** Decrypted access token. */
  access: string;
  /** Decrypted refresh token, or null if not stored. */
  refresh: string | null;
  /** The Gmail address associated with this OAuth connection. */
  email: string | null;
}

/**
 * Read Google OAuth tokens for a user.
 * Prefers encrypted columns; falls back to plaintext (pre-backfill users).
 * Returns null when Gmail is not connected at all.
 */
export async function getDecryptedGoogleTokens(
  userId: string
): Promise<GoogleTokenSet | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      googleAccessTokenEncrypted: true,
      googleRefreshTokenEncrypted: true,
      googleAccessToken: true,
      googleRefreshToken: true,
      googleEmail: true,
    },
  });

  if (!user) return null;

  const hasEncrypted = !!user.googleAccessTokenEncrypted;
  const hasPlaintext = !!user.googleAccessToken;

  if (!hasEncrypted && !hasPlaintext) return null; // Gmail not connected

  if (hasEncrypted) {
    return {
      access: decrypt(user.googleAccessTokenEncrypted!),
      refresh: user.googleRefreshTokenEncrypted
        ? decrypt(user.googleRefreshTokenEncrypted)
        : null,
      email: user.googleEmail ?? null,
    };
  }

  // Fallback: plaintext columns (users not yet backfilled)
  return {
    access: user.googleAccessToken!,
    refresh: user.googleRefreshToken ?? null,
    email: user.googleEmail ?? null,
  };
}

/**
 * Store Google OAuth tokens on initial connect.
 * Dual-writes: encrypted new columns + plaintext old columns (rollback safety).
 */
export async function setEncryptedGoogleTokens(
  userId: string,
  tokens: { access: string; refresh?: string | null; email?: string | null }
): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: {
      // New encrypted columns
      googleAccessTokenEncrypted: encrypt(tokens.access),
      ...(tokens.refresh != null
        ? { googleRefreshTokenEncrypted: encrypt(tokens.refresh) }
        : {}),
      // Old plaintext columns — kept for rollback safety during transition
      googleAccessToken: tokens.access,
      ...(tokens.refresh != null ? { googleRefreshToken: tokens.refresh } : {}),
      ...(tokens.email != null ? { googleEmail: tokens.email } : {}),
    },
  });
}

/**
 * Persist a refreshed access token (called on OAuth token-refresh events).
 * Dual-writes both columns. Refresh token does not change on access-token refresh.
 */
export async function refreshEncryptedAccessToken(
  userId: string,
  newAccessToken: string
): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: {
      googleAccessTokenEncrypted: encrypt(newAccessToken),
      googleAccessToken: newAccessToken, // dual-write for rollback safety
    },
  });
}
