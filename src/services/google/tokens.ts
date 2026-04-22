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
import type { Prisma } from "@prisma/client";

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

  // Per-field fallback: prefer encrypted when present, otherwise plaintext.
  // A token refresh during the migration window updates only access, leaving
  // refresh in plaintext — the old "all or nothing" branch returned null for
  // refresh in that case, and the backfill skipped the user entirely.
  const access = user.googleAccessTokenEncrypted
    ? decrypt(user.googleAccessTokenEncrypted)
    : user.googleAccessToken;

  const refresh = user.googleRefreshTokenEncrypted
    ? decrypt(user.googleRefreshTokenEncrypted)
    : user.googleRefreshToken ?? null;

  if (!access) return null; // Gmail not connected

  return { access, refresh, email: user.googleEmail ?? null };
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

/**
 * Pure helper for the backfill script: given a user's current token columns,
 * returns the `data` object for `db.user.update`, or null if nothing needs to
 * be written. Writes only columns that are still plaintext-only — never
 * re-encrypts an already-encrypted column (which would overwrite a
 * freshly-refreshed access token with the stale plaintext copy).
 */
export function buildBackfillUpdate(user: {
  googleAccessToken: string | null;
  googleAccessTokenEncrypted: string | null;
  googleRefreshToken: string | null;
  googleRefreshTokenEncrypted: string | null;
}): Prisma.UserUpdateInput | null {
  const data: Prisma.UserUpdateInput = {};
  if (user.googleAccessToken && !user.googleAccessTokenEncrypted) {
    data.googleAccessTokenEncrypted = encrypt(user.googleAccessToken);
  }
  if (user.googleRefreshToken && !user.googleRefreshTokenEncrypted) {
    data.googleRefreshTokenEncrypted = encrypt(user.googleRefreshToken);
  }
  return Object.keys(data).length === 0 ? null : data;
}
