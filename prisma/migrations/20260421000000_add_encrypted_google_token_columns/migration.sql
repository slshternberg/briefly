-- Add AES-256-GCM encrypted columns for Google OAuth tokens.
-- The plaintext columns (googleAccessToken, googleRefreshToken) are kept intact
-- during the migration window for dual-write + rollback safety.
-- They will be dropped by migration 20260421000001_drop_plaintext_google_tokens
-- ONLY after the backfill script has been executed in production.

ALTER TABLE "users" ADD COLUMN "googleAccessTokenEncrypted" TEXT;
ALTER TABLE "users" ADD COLUMN "googleRefreshTokenEncrypted" TEXT;
