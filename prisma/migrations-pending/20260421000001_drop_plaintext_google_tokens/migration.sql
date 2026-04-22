-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- DO NOT RUN THIS MIGRATION until BOTH of the following are confirmed:
--   1. Migration 20260421000000_add_encrypted_google_token_columns is applied.
--   2. Backfill script src/scripts/backfill/encrypt-google-tokens.ts has been
--      executed successfully in production AND verified (zero NULL encrypted cols
--      for users who have a plaintext token).
--
-- See docs/deploy/0.1-oauth-token-encryption.md for the exact deployment sequence.
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

ALTER TABLE "users" DROP COLUMN "googleAccessToken";
ALTER TABLE "users" DROP COLUMN "googleRefreshToken";
