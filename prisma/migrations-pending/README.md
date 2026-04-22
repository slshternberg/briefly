# Migrations pending release

Files here are NOT auto-applied by `prisma migrate deploy`.
They are valid migrations waiting for operator action in production.

Current contents:

- `20260421000001_drop_plaintext_google_tokens/` — drops plaintext OAuth
  token columns. Move back to `prisma/migrations/` ONLY after the backfill
  in `src/scripts/backfill/encrypt-google-tokens.ts` has completed in
  production and 24h of monitoring shows no OAuth errors. See
  `docs/deploy/level-0-full-sequence.md` Stage 4.
