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
