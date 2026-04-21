# Observed — non-blocking issues to revisit

Items here are not critical enough to fix now but should be addressed before they
become production incidents. Each entry has a severity, a description, and a
suggested fix.

---

## gmail token refresh: concurrent OAuth refresh writes could race

**Severity:** low  
**Area:** `src/services/gmail/index.ts`, `src/app/api/conversations/[conversationId]/send-email/route.ts`

Both routes attach an `oauth2Client.on("tokens", ...)` listener that calls
`refreshEncryptedAccessToken`. If the same user triggers multiple simultaneous
Gmail operations (e.g. batch email sends), the OAuth library could fire the
`tokens` event on each client instance in rapid succession, causing multiple
concurrent `UPDATE users SET googleAccessTokenEncrypted = ...` writes.

The writes are last-write-wins so data integrity is not at risk, but they create
unnecessary DB load and could theoretically persist a stale token if a network
retry delivers the older refresh before the newer one.

**Suggested fix when observed in practice:**
- Add a short-circuit check: compare the new token's expiry against the stored
  one before writing (requires storing `googleAccessTokenExpiresAt`).
- Or use an advisory lock / Redis-based mutex around the refresh write.
- Alternatively, centralize OAuth client construction so a single instance is
  reused per user per request lifecycle, preventing duplicate listeners.

---

## npm audit: 14 vulnerabilities after music-metadata@7 install

**Severity:** unknown (pre-existing vs introduced — unverified)  
**Area:** `package.json`, `music-metadata@7` transitive deps

`npm install music-metadata@7` reported 14 vulnerabilities (8 moderate, 5 high, 1 critical).
Not confirmed whether these were pre-existing in the repo or introduced by the new package.

**Suggested action:**
- Run `npm audit` before and after removing `music-metadata` to isolate blame.
- If introduced by `music-metadata@7`'s transitive deps → evaluate `music-metadata@8` (ESM,
  add to `serverExternalPackages`) or an alternative like `get-audio-duration`.
- If pre-existing → open a separate security audit task unrelated to this change.

---

## Conversation.durationSec is dead — consider dropping

**Severity:** low  
**Area:** `prisma/schema.prisma`, `conversations` table

`Conversation.durationSec` (`Int?`) has zero reads and zero writes in any TypeScript
file. All billing and display uses `ConversationAsset.durationSeconds` instead.

Confirmed during item 0.2 work (grep -rn "durationSec" src/).

**Suggested fix:** drop in a future schema cleanup migration:
```sql
ALTER TABLE "conversations" DROP COLUMN "durationSec";
```
No backfill needed — the column is always NULL in production.
