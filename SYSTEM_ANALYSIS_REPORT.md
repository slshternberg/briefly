# System Analysis Report

Checked on 2026-04-21

## Summary

Briefly is already a real working MVP, not just a scaffold. A user can register, get a default workspace, upload or record a conversation, run AI analysis, view structured output, ask follow-up chat questions, connect Gmail, invite teammates, and start a Stripe checkout flow.

The main gap is not "missing product shape" but "operational maturity". The system is held together by many direct route-handler flows, background work runs in-process without a queue, quota tracking is incomplete in important places, external tokens are stored in plaintext, and automated test coverage is still extremely low.

Current baseline from local checks:

- `npm test` passes
- `npm run lint` passes
- `npm run build` passes
- Coverage is only `0.81%`
- The repo currently has `30` API route files, `15` `page.tsx` pages, `23` component files, and only `2` test files

---

## 1. General Architecture

### Tech stack

- Frontend: `Next.js 16` App Router, `React 19`, Tailwind CSS 4, client/server components
- Auth: `next-auth@5 beta` with Credentials provider and JWT session strategy
- Backend: Next.js route handlers under `src/app/api`
- Database: PostgreSQL via `Prisma`
- AI: Google Gemini via `@google/genai`
- Email: SMTP via `nodemailer`, Gmail API via `googleapis`
- Billing: Stripe
- Storage: local filesystem or S3-compatible storage
- Testing: `Vitest`

Key files:

- `package.json`
- `prisma/schema.prisma`
- `src/lib/auth.ts`
- `src/lib/db.ts`
- `src/services/gemini/index.ts`

### Project structure

Main folders:

- `src/app`: App Router pages, layouts, API routes
- `src/components`: UI pieces for conversations, settings, layout
- `src/lib`: auth, db, env, billing, language, crypto, helpers
- `src/services`: conversation, storage, AI prompts, Gemini, Gmail, style-learning, email
- `prisma`: schema, migrations, seed
- `src/__tests__`: current test files
- `uploads`: local file storage when `STORAGE_TYPE=local`

### Data flow

The app generally follows this flow:

1. A page or client component calls a Next.js API route.
2. The route checks auth and workspace context.
3. The route either calls a service module or talks to Prisma directly.
4. The route may also call an external provider like Gemini, Gmail, Stripe, or storage.
5. Results are stored in Prisma and rendered back through server pages.

The architecture is pragmatic, but not heavily layered. Many business rules still live directly inside route handlers instead of a deeper service/repository boundary.

### Authentication

Auth is implemented in `src/lib/auth.ts` with:

- Credentials login only
- Password verification via `bcryptjs`
- JWT session strategy
- Custom session fields:
  - `user.id`
  - `user.emailVerified`
  - `user.activeWorkspaceId`
  - `user.activeWorkspaceRole`

Important behavior:

- Login picks the first active workspace membership, ordered by oldest membership, not the last workspace the user used.
- `requireAuth` in `src/lib/auth-guard.ts` re-checks workspace membership in the DB and does not trust the JWT alone.
- `proxy.ts` applies auth middleware and security headers to selected routes.
- Unverified users are redirected away from protected dashboard routes to `/verify-email`.

### Workspaces

Workspaces are the tenant boundary.

How they work today:

- Registration creates:
  - a `User`
  - a default `Workspace`
  - a `WorkspaceMember` with role `OWNER`
- Every important tenant-scoped table contains `workspaceId`
- Workspace switching is client-side via `next-auth` session `update(...)`
- Roles are `OWNER`, `ADMIN`, `MEMBER`

What is implemented:

- Listing/switching workspaces
- Inviting members
- Joining via tokenized invitation
- Removing members
- Workspace-level settings for language and custom instructions

What is not fully implemented:

- Create additional workspaces
- Transfer ownership
- Promote/demote members from UI
- Persist "last active workspace" across new logins

---

## 2. Conversation Pipeline

This is the most important implemented flow in the system.

### High-level flow

1. User creates a conversation
2. User uploads or records audio
3. Audio file is stored
4. Asset row is created
5. Conversation becomes `UPLOADED`
6. User clicks Analyze
7. Conversation becomes `PROCESSING`
8. Background task sends audio to Gemini
9. Structured analysis is stored in `conversation_summaries`
10. Conversation becomes `COMPLETED`

Main files:

- `src/app/api/conversations/route.ts`
- `src/app/api/conversations/[conversationId]/upload/route.ts`
- `src/app/api/conversations/[conversationId]/process/route.ts`
- `src/services/conversation/index.ts`
- `src/services/gemini/index.ts`

### Step-by-step: create conversation

`POST /api/conversations`

- Validates auth
- Verifies workspace membership
- Validates `{ title }` via `createConversationSchema`
- Creates a `Conversation` with:
  - `workspaceId`
  - `createdById`
  - `title`
  - `status: "DRAFT"`

### Step-by-step: upload file

`POST /api/conversations/[conversationId]/upload`

What happens:

- Auth check
- User rate-limit check via `rateLimitUser(..., "upload")`
- Confirms the conversation belongs to the active workspace
- Reads `multipart/form-data`
- Accepts uploaded file and `sourceType`
- Normalizes MIME type
- Validates allowed type and size
- Checks storage quota
- Converts the file into a `Buffer`
- Calls `uploadAudioAsset(...)`

Inside `uploadAudioAsset(...)`:

- `getStorageProvider()` chooses:
  - `LocalStorageProvider` when `STORAGE_TYPE !== "s3"`
  - `S3StorageProvider` when `STORAGE_TYPE === "s3"`
- File is saved to storage
- A `ConversationAsset` row is created
- Conversation status is updated to `UPLOADED`

### Where the file is stored

Local mode:

- Physical path: `uploads/<workspaceId>/<conversationId>/<timestamp>-<safeName>`
- DB stores only relative `storagePath`

S3 mode:

- Object key: `<workspaceId>/<conversationId>/<timestamp>-<safeName>`
- DB stores that key as `storagePath`

### File types actually supported

Backend supports:

- `audio/mpeg`, `audio/mp3`
- `audio/wav`, `audio/x-wav`
- `audio/mp4`, `audio/x-m4a`
- `audio/webm`, `audio/ogg`
- `video/webm`, `video/mp4`

Important mismatch:

- UI upload components only accept `.mp3,.wav,.m4a,.webm,.ogg`
- Backend also supports `video/mp4`, but the UI does not expose `.mp4` upload

### How recording works

The new-conversation page supports:

- microphone recording
- mixed meeting/system audio + microphone recording
- normal file upload

Important detail:

- The low-level hook supports `mic`, `screen`, and `both`
- The UI exposes only `mic` and `both`
- Large uploaded files can be client-side compressed to MP3 before upload

Relevant files:

- `src/hooks/use-recorder.ts`
- `src/components/conversations/audio-recorder.tsx`
- `src/lib/mp3-encoder.ts`

### Step-by-step: processing

`POST /api/conversations/[conversationId]/process`

The route:

- Checks auth
- Rate-limits processing
- Checks conversation quota
- Reads request options:
  - `outputLanguage`
  - `conversationInstructions`
  - `sendNotification`
- Loads workspace custom instructions and default language
- Verifies conversation exists and belongs to workspace
- Allows processing only from `UPLOADED`, `FAILED`, or `COMPLETED`
- Fetches the latest completed asset
- Checks audio-minute quota
- Updates conversation status to `PROCESSING`
- Launches `runAnalysisBackground(...)`
- Immediately returns `{ status: "PROCESSING" }`

### Status lifecycle

Implemented statuses:

- `DRAFT`: conversation exists but no uploaded asset yet
- `UPLOADED`: asset uploaded and ready for AI
- `PROCESSING`: AI analysis currently running
- `COMPLETED`: summary saved successfully
- `FAILED`: analysis failed

Where state changes happen:

- `DRAFT` -> `UPLOADED`: upload route
- `UPLOADED` -> `PROCESSING`: process route
- `PROCESSING` -> `COMPLETED`: successful background analysis
- `PROCESSING` -> `FAILED`: any processing failure

There is also a status polling route:

- `GET /api/conversations/[conversationId]/status`
- If a conversation stays in `PROCESSING` for more than 30 minutes, the route marks it `FAILED`

Important limitation:

- This "stuck job recovery" only happens if someone polls the status endpoint
- There is no real queue worker or watchdog

### Which service analyzes the audio

AI analysis is done in `src/services/gemini/index.ts`, mainly via:

- `analyzeConversationAudio(...)`

Flow inside that service:

1. Upload audio to Gemini Files API
2. Poll until the file is ready
3. Send the structured-analysis prompt
4. Parse the JSON response
5. Optionally send a second prompt for a custom summary
6. Best-effort cleanup of the uploaded Gemini file

### What is saved in the database

`Conversation`:

- identity, title, status, workspace, creator

`ConversationAsset`:

- original filename
- MIME type
- size in bytes
- storage path
- source type (`RECORDED` / `UPLOADED`)
- upload status

`ConversationSummary`:

- `rawText`
- `structuredData`
- `modelUsed`
- `promptTokens`
- `outputTokens`

### Where the summary is stored

Summary lives in the `conversation_summaries` table.

Key fields:

- `workspaceId`
- `conversationId`
- `rawText`
- `structuredData`
- `modelUsed`
- `promptTokens`
- `outputTokens`
- `createdAt`
- `updatedAt`

### What fields exist inside the structured summary

Defined in `src/services/gemini/schema.ts`:

- `contentType`
- `internalSummary`
- `clientFriendlySummary`
- `keyTopics`
- `decisions`
- `actionItems`
- `customerObjections`
- `followUpPromises`
- `openQuestions`
- `sensitiveInternalNotes`
- `suggestedEmailSubject`
- `suggestedEmailBody`

Runtime detail:

- The process route also injects `customSummary` into `structuredData`
- That field is not part of the formal Gemini schema type

Important missing piece:

- There is no transcript stored
- `rawText` stores the raw structured-response JSON text, not a verbatim transcription

---

## 3. AI Usage

### Which model is used

Primary model:

- `gemini-2.5-flash` by default for analysis and chat

Fallback model for analysis:

- `gemini-2.5-flash-lite`

Configured in:

- `src/services/gemini/index.ts`

### How prompts are built

Analysis prompt:

- Built in `src/services/ai/prompts/analysis.ts`
- Enforces anti-hallucination rules
- Forces output language
- Distinguishes insufficient-content vs real meeting analysis
- Optionally injects:
  - style profile
  - user instructions

Chat prompt:

- Built in `src/services/ai/prompts/chat.ts`
- Uses only stored structured summary data
- Explicitly tells the model it does not have access to the original audio

### Structured output

Yes.

Analysis uses Gemini structured JSON output with an explicit schema:

- `responseMimeType: "application/json"`
- `responseSchema: conversationAnalysisSchema`

This is one of the strongest parts of the system today because it reduces parsing ambiguity.

### Custom user prompt support

Yes, in two layers:

1. Conversation-level instructions sent from the Analyze button
2. Workspace-level custom instructions stored in workspace settings

The second one is used for generating a custom summary, not only the generic structured summary.

### Style-learning support

Yes, partially.

The system supports:

- uploading style examples: audio + sent follow-up email
- processing examples with Gemini
- generating an aggregate style profile
- reusing that profile during analysis/custom summary generation

This is more advanced than a normal MVP, but still operationally fragile.

### Chat on existing conversations

Yes.

`POST /api/conversations/[conversationId]/chat`:

- requires an already analyzed conversation
- loads the structured summary
- builds a chat prompt from summary data and message history
- stores both user and assistant messages
- creates a chat thread if one does not exist

Limitations:

- No UI for multiple threads
- No persisted "last active thread" UX
- Thread `updatedAt` is not refreshed when messages are added, so thread ordering is weak

---

## 4. Database

Database schema is in `prisma/schema.prisma`.

### Main tables

Identity and tenancy:

- `users`
- `email_verification_tokens`
- `password_reset_tokens`
- `workspaces`
- `workspace_invitations`
- `workspace_members`

Billing and usage:

- `plans`
- `subscriptions`
- `usage_records`

Conversation domain:

- `conversations`
- `conversation_assets`
- `conversation_summaries`
- `chat_threads`
- `chat_messages`

Style learning:

- `style_examples`
- `style_profiles`

Other:

- `audit_logs`
- `api_keys`

### Core relationships

- A `User` can belong to many `Workspaces` through `WorkspaceMember`
- A `Workspace` owns:
  - invitations
  - subscriptions
  - usage records
  - conversations
  - assets
  - summaries
  - chat threads/messages
  - audit logs
  - style examples
  - style profiles
  - API keys
- A `Conversation` belongs to one workspace and one creator
- A `Conversation` can have many assets and one summary
- A `Conversation` can have many chat threads
- A `ChatThread` has many `ChatMessage`s

### Important tables and fields

#### users

Important fields:

- `id`
- `email`
- `name`
- `passwordHash`
- `emailVerified`
- `googleAccessToken`
- `googleRefreshToken`
- `googleEmail`

Note:

- Google tokens are currently stored directly in plaintext columns

#### workspaces

Important fields:

- `id`
- `name`
- `slug`
- `stripeCustomerId`
- `defaultLanguage`
- `customInstructions`
- `analysisInstructions`
- `emailInstructions`
- `activeStyleProfileId`
- `deletedAt`

Reality check:

- `analysisInstructions` and `emailInstructions` exist in the schema but are not used by the code

#### workspace_members

Important fields:

- `workspaceId`
- `userId`
- `role`

Role behavior in code:

- `OWNER`: can manage billing and members
- `ADMIN`: can manage settings and members
- `MEMBER`: limited access

#### conversations

Important fields:

- `id`
- `workspaceId`
- `createdById`
- `title`
- `status`
- `language`
- `durationSec`
- `deletedAt`

Important note:

- `durationSec` exists but is not being populated anywhere

#### conversation_assets

Important fields:

- `workspaceId`
- `conversationId`
- `sourceType`
- `originalName`
- `mimeType`
- `sizeBytes`
- `durationSeconds`
- `storagePath`
- `uploadStatus`

Important note:

- `durationSeconds` also exists but is not being populated anywhere

#### conversation_summaries

Important fields:

- `workspaceId`
- `conversationId`
- `rawText`
- `structuredData`
- `modelUsed`
- `promptTokens`
- `outputTokens`

#### subscriptions

Important fields:

- `workspaceId`
- `planId`
- `status`
- `stripeSubscriptionId`
- `currentPeriodStart`
- `currentPeriodEnd`
- `cancelAtPeriodEnd`

#### usage_records

Important fields:

- `workspaceId`
- `periodStart`
- `periodEnd`
- `conversationCount`
- `audioSecondsUsed`
- `aiQueryCount`
- `storageBytesUsed`

---

## 5. UI / UX

### Existing screens

Public/auth:

- Landing page
- Login
- Register
- Forgot password
- Reset password
- Verify email
- Verified page
- Join workspace

Dashboard:

- Conversations dashboard
- New conversation page
- Conversation detail page
- Settings page

Legal/help:

- Help
- Privacy
- Terms

### Main user flows

#### First-time user

1. Register
2. User is auto-signed in
3. Middleware sends unverified user to `/verify-email`
4. After verification, user can access dashboard

#### Conversation flow

1. Open dashboard
2. Click "new conversation"
3. Choose:
  - record
  - upload
4. Enter title
5. Upload succeeds
6. Redirect to conversation detail page
7. Click Analyze
8. Wait for polling to finish
9. View structured output and optional custom summary
10. Chat on top of the analysis

#### Workspace/settings flow

From settings the user can:

- change workspace language
- save custom instructions
- upload style examples
- generate style profile
- invite members
- see billing usage
- connect Gmail
- delete account

### What the user sees after upload

On successful upload:

- User is redirected to the conversation detail page
- The page shows:
  - title
  - status badge
  - audio player
  - analyze/reanalyze button

If the conversation is still a `DRAFT`, the detail page shows a dedicated draft-upload component.

### Editing / search / filtering

Implemented:

- Title editing on conversation detail
- Delete conversation
- Copy sections
- Export analysis to PDF
- Search conversations by title
- Filter conversations by status

Not implemented:

- Backend search
- Pagination
- Sort controls
- Transcript search
- Full-text search over summaries

### UI gaps worth noting

- If conversation creation succeeds but upload fails on the new-conversation page, the user stays on the page without being redirected to the created draft conversation. This can leave orphaned drafts.
- There is no visible list/history of invitations.
- There is no dedicated billing history screen.
- There is no conversation transcript view because no transcript is stored.

---

## 6. Problems, Risks, and Missing Pieces

This is the most important planning section.

### Technical problems

#### 1. Audio duration tracking is effectively broken

The schema has:

- `Conversation.durationSec`
- `ConversationAsset.durationSeconds`

But the code never computes or stores them.

Impact:

- Audio quota checks use `asset.durationSeconds ?? 0`
- Monthly audio usage is probably undercounted as `0`
- Conversation list duration display is mostly empty

This is a major logic gap.

#### 2. Background analysis is not production-safe

`process/route.ts` starts analysis after returning the HTTP response and explicitly assumes a self-hosted Node server.

Impact:

- No job queue
- No retry worker
- Not reliable on serverless runtimes
- Status recovery depends on polling

This is the biggest production-readiness gap in the whole app.

#### 3. Upload, audio serving, and AI processing are memory-heavy

Current implementation repeatedly loads full files into memory:

- upload route reads full file into `Buffer`
- audio route reads full file into memory before serving ranges
- analysis route reads full stored file into memory before sending to Gemini

Impact:

- Large files are risky
- 500MB uploads are unrealistic for comfortable memory usage
- Range serving is not true streaming

#### 4. Storage quota is increment-only

`incrementStorageUsage(...)` runs on upload, but storage usage is never decremented on deletion.

Also:

- deleting style examples does not delete the stored audio file

Impact:

- Users can hit storage limits and never recover space logically
- Orphan files accumulate

#### 5. Style-example processing breaks on S3

`processStyleExample(...)` calls `storage.getFilePath(...)`, but `S3StorageProvider.getFilePath()` throws by design.

Impact:

- Style learning works only in local storage mode
- S3 environments will break that feature

#### 6. OAuth tokens are stored in plaintext

There is an encryption utility in `src/lib/crypto.ts`, and `ENCRYPTION_KEY` is required in env, but Google OAuth tokens are stored and read directly from DB columns without encryption.

Impact:

- Security gap
- Sensitive token storage is weaker than intended

#### 7. Environment configuration is inconsistent

Examples:

- `AUTH_URL` is optional in env schema, but some Google routes assume it directly
- `.env.example` includes `SMTP_HOST` and `SMTP_PORT`, but email code hardcodes Gmail SMTP values
- Build emits repeated env warnings

Impact:

- Deployment configuration is harder than it should be
- There is drift between documented and real config

#### 8. Soft-delete is inconsistent

Conversation delete:

- deletes files from storage
- sets `conversation.deletedAt`

But:

- asset rows remain
- audio serving route fetches asset by `conversationId` and `workspaceId` without checking `conversation.deletedAt`

Impact:

- A deleted conversation's audio may still be fetchable if someone knows the URL and still has workspace access

#### 9. Account deletion behavior conflicts with the architecture notes

`src/app/api/auth/account/route.ts` deletes:

- subscriptions
- audit logs
- owned workspaces

But the architecture notes explicitly describe subscription/audit retention as important.

Impact:

- Compliance and historical billing expectations are not aligned with implementation

### Missing or partial features

#### Multi-workspace management is partial

Implemented:

- switch active workspace
- invite/join

Missing:

- create new workspace
- rename workspace
- transfer ownership
- role management UI

#### Billing is partial

Implemented:

- checkout session creation
- billing portal session creation
- webhook handlers
- usage display

Missing/weak:

- strong DB-level active-subscription guard
- robust plan lifecycle management
- storage usage display
- downgrade/upgrade UX depth

#### Search is shallow

Implemented:

- client-side search by title
- status filter

Missing:

- server-side search
- transcript search
- summary search
- pagination

#### Chat is useful but simple

Implemented:

- one-thread-per-conversation flow works
- stored history works

Missing:

- thread management
- better recent-thread ordering
- richer context controls

#### Style-learning is promising but incomplete

Implemented:

- upload examples
- process examples
- merge profile
- use profile/examples in prompts

Missing:

- file cleanup on delete
- better operational stability
- S3 compatibility
- better UX around reprocessing and profile versions

### Things not ready for production

- In-process background jobs instead of a queue
- In-memory rate limiting
- Plaintext OAuth tokens
- Very low test coverage
- No observability/metrics layer
- No durable retry model for AI jobs
- Large file handling without streaming
- Feature drift between schema/env/docs and implementation

---

## 7. What Is Ready vs Partial vs Missing

### Ready

- Credentials auth with email verification and password reset
- Default workspace creation on registration
- Workspace membership model
- Conversation create/upload/detail flow
- Gemini structured analysis
- Conversation status lifecycle
- AI chat on analyzed conversations
- Gmail connection and send-email flow
- Stripe checkout/portal/webhook scaffolding
- Style example ingestion and profile generation baseline
- Basic dashboard/settings UX

### Partial

- Workspace switching
- Billing enforcement
- Storage enforcement
- Style learning
- Localization
- Error handling consistency
- Account deletion logic
- Test suite
- Production deployment readiness

### Missing

- Real background job queue
- Transcript storage/search
- Full workspace admin UX
- Ownership transfer
- Advanced analytics/observability
- Robust file lifecycle cleanup
- Google disconnect flow
- Multi-thread chat UX
- Strong end-to-end test coverage

---

## 8. Recommended Next-Step Insights

### Best places to add new features

If you want to keep momentum with minimal breakage, the safest extension points are:

- `src/services/conversation/index.ts` for conversation-domain logic
- `src/services/gemini/index.ts` for AI orchestration
- `src/services/style/index.ts` for style-learning features
- `src/app/api/...` routes for feature exposure

### What should be refactored before major expansion

#### 1. Introduce a real processing job system

Before adding more AI-heavy features, move conversation processing into:

- BullMQ
- Inngest
- or a dedicated worker process

Without this, future AI features will make the system more fragile, not stronger.

#### 2. Centralize route business logic

A lot of rules live directly in route handlers. Before adding major features, it would help to move more logic into service functions so auth, billing, workspace checks, and state transitions are easier to test.

#### 3. Fix quota/accounting correctness

Before building more billing-sensitive features:

- populate audio durations
- decrement storage usage when files are removed
- decide whether deleted content should free quota immediately or only per billing cycle

#### 4. Unify environment and secrets handling

Clean up:

- `AUTH_URL`
- SMTP config usage
- token encryption
- provider-specific assumptions

#### 5. Tighten file lifecycle rules

Decide the authoritative behavior for:

- soft-deleted conversations
- asset row cleanup
- style example file cleanup
- long-term storage reclaim

### What is likely to break later if not fixed now

- Any scale-up in uploads or AI usage because of in-memory file handling
- Any move to serverless or multiple instances because of in-process background tasks and memory rate limits
- Any compliance/security review because of plaintext OAuth tokens and audit deletion
- Any pricing/usage rollout because audio/storage accounting is incomplete
- Any S3 production rollout for style-learning because that flow currently assumes local file paths

---

## 9. Concrete Recommended Order For The Next Phase

1. Fix correctness bugs:
   - audio duration tracking
   - storage decrement/file cleanup
   - deleted conversation asset access
2. Move processing to a real queue
3. Encrypt OAuth tokens and clean up env handling
4. Add route-level automated tests for auth, conversations, billing, and workspaces
5. Only then add bigger product features like transcript search, richer workspace admin, or advanced AI actions

---

## 10. Bottom Line

The system already proves the product idea.

The next development phase should not start with adding lots of new surface area. The highest-leverage move is to harden the existing core:

- make conversation processing durable
- make quota/accounting accurate
- make storage/token handling production-safe
- raise test coverage dramatically

After that, the app will be in a much stronger position to absorb new features without turning brittle.
