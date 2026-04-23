# Test Tasks

## Current Baseline

Checked on 2026-04-21:

- `npm test` passes: 27 tests in 2 files
- `npm run lint` passes
- `npm run build` passes
- `npm run test:coverage` reports very low overall coverage: `0.81%` statements

Current automated coverage is mostly limited to:

- `src/lib/billing.ts`
- `src/lib/validations/auth.ts`

High-risk areas with no meaningful test coverage yet:

- Auth routes and session guards
- Workspace membership and invitations
- Conversation CRUD, upload, processing, status, chat, email sending
- Stripe billing flows
- Gemini, Gmail, storage, and env handling

## Recommended Test Layers

1. `Unit`: pure helpers, validation, branching logic, env parsing, storage helpers.
2. `Route integration`: call route handlers directly with mocked `auth`, `db`, `Stripe`, `Google`, `Gemini`, and storage providers.
3. `Smoke / E2E`: a short happy-path flow to prove the app works end to end.

## P0 - First Tasks

- [ ] Add tests for [`src/app/api/auth/register/route.ts`] covering invalid JSON, schema error, duplicate email, successful user/workspace/member creation, and verification email trigger.
- [ ] Add tests for [`src/app/api/auth/verify-email/route.ts`] covering missing token, expired token, reused token, and successful verification + token consumption.
- [ ] Add tests for [`src/app/api/auth/password-reset-request/route.ts`] covering unknown email response shape, valid token creation, and email send call.
- [ ] Add tests for [`src/app/api/auth/password-reset-confirm/route.ts`] covering invalid token, expired token, used token, password update, and audit log trigger.
- [ ] Add tests for [`src/lib/auth-guard.ts`] covering unauthenticated redirect, missing workspace redirect, deleted workspace redirect, and valid membership success.
- [ ] Add tests for [`src/app/api/conversations/route.ts`] covering unauthorized access, bad payload, successful create, and list restricted to active workspace.
- [ ] Add tests for [`src/app/api/conversations/[conversationId]/upload/route.ts`] covering missing file, bad mime type, oversized file, storage quota failure, workspace ownership check, and successful asset upload.
- [ ] Add tests for [`src/app/api/conversations/[conversationId]/process/route.ts`] covering unauthorized access, invalid status, missing asset, conversation limit failure, audio limit failure, processing status update, and background job kickoff.
- [ ] Add tests for [`src/app/api/conversations/[conversationId]/chat/route.ts`] covering missing question, long question, missing summary, invalid thread, new thread creation, existing thread reuse, Gemini failure, and saved chat messages.
- [ ] Add tests for [`src/app/api/conversations/[conversationId]/status/route.ts`] covering not found, pass-through status, and auto-fail after 30 minutes stuck in `PROCESSING`.
- [ ] Add tests for [`src/app/api/conversations/[conversationId]/route.ts`] covering rename validation, soft delete, and storage cleanup for attached assets.

## P1 - Workspace And Billing

- [ ] Add tests for [`src/app/api/workspaces/invite/route.ts`] covering role permissions, existing member rejection, member limit rejection, invitation creation, and invitation email send.
- [ ] Add tests for [`src/app/api/workspaces/join/route.ts`] covering missing token, expired invitation, wrong email, duplicate membership, and successful membership + invitation consumption.
- [ ] Add tests for [`src/app/api/workspaces/members/[memberId]/route.ts`] covering member-not-found, owner protection, self-removal protection, permission failure, and successful removal.
- [ ] Add tests for [`src/app/api/workspace/language/route.ts`] covering unsupported language, member permission rejection, successful update, and `Set-Cookie` language header.
- [ ] Add tests for [`src/app/api/workspace/instructions/route.ts`] covering invalid type, max length, member permission rejection, clearing instructions, and successful save.
- [ ] Add tests for [`src/app/api/billing/checkout/route.ts`] covering unauthorized access, non-admin rejection, inactive/missing plan, customer creation path, reuse of existing customer, and checkout session creation.
- [ ] Add tests for [`src/app/api/billing/portal/route.ts`] covering unauthorized access, non-admin rejection, missing Stripe customer, and portal session creation.
- [ ] Add tests for [`src/app/api/billing/webhook/route.ts`] covering missing signature, invalid signature, checkout completion upsert, subscription update, subscription delete, and Stripe status mapping.

## P1 - External Services And Helpers

- [ ] Extend tests for [`src/lib/billing.ts`] to cover `checkStorageLimit`, `getPlanLimits`, and all increment helpers.
- [ ] Add tests for [`src/lib/rate-limit.ts`] covering IP extraction, limiter selection, `429` responses, and retry headers.
- [ ] Add tests for [`src/services/conversation/index.ts`] covering mime normalization helpers, file size validation, conversation queries scoped by workspace, and upload transaction behavior.
- [ ] Add tests for [`src/services/storage/local-storage.ts`] covering filename sanitization, relative storage path generation, delete on missing file, and path traversal rejection in `getFileBuffer`.
- [ ] Add tests for [`src/services/gmail/index.ts`] covering notification skip when Gmail not connected, token refresh persistence hook, subject encoding, and Gemini cost calculation.
- [ ] Add tests for [`src/services/gemini/index.ts`] covering missing API key, retriable fallback to backup model, parse failure, array defaulting, custom summary optional behavior, and chat token extraction.
- [ ] Add tests for [`src/lib/env.ts`] covering valid env parsing, build-phase non-throw behavior, and runtime throw on invalid env.

## P2 - Style Learning And Email Flows

- [ ] Add tests for [`src/app/api/workspace/style-examples/route.ts`] covering list, permission rejection, required fields, invalid audio type, file size limit, and successful upload.
- [ ] Add tests for [`src/app/api/workspace/style-examples/[exampleId]/route.ts`] covering process success, process failure classification, delete not-found, and successful delete.
- [ ] Add tests for [`src/app/api/workspace/style-profile/route.ts`] covering unauthorized access, example count, member rejection, no completed examples, and profile generation success.
- [ ] Add tests for [`src/services/style/index.ts`] covering process success, process failure -> `FAILED`, merged profile generation, profile deactivation, version increment, and active profile lookup.
- [ ] Add tests for [`src/app/api/conversations/[conversationId]/send-email/route.ts`] covering invalid recipient, missing Google connection, conversation ownership, attachment missing fallback, and successful Gmail send.
- [ ] Add tests for [`src/services/email/index.ts`] covering dev-mode console fallback and generated HTML templates containing the expected action link.

## P2 - UI Smoke Coverage

- [ ] Add one browser smoke test for register -> verify email page -> login -> dashboard load.
- [ ] Add one browser smoke test for create conversation -> upload file -> process -> status polling -> result page render.
- [ ] Add one browser smoke test for workspace settings: change language, save instructions, invite member modal open, and billing section render.
- [ ] Add one browser smoke test for chat flow on an already processed conversation.

## Suggested Order

1. Finish all `P0` route tests.
2. Cover workspace and billing routes.
3. Cover external service helpers.
4. Add 3-4 smoke tests only after the route layer is stable.

## Exit Criteria

- `npm test`, `npm run lint`, and `npm run build` stay green.
- Core API routes have automated coverage for success path and at least one failure path each.
- External integrations are mocked in tests; no live Stripe, Google, Gmail, or Gemini calls.
- At least one full happy-path smoke test proves the main user journey works.
