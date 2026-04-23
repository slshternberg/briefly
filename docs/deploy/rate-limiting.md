# Rate limiting — deploy notes

## Current backend

All rate limiters in the app are created via `createLimiter` in
[`src/lib/rate-limiter-store.ts`](../../src/lib/rate-limiter-store.ts).
Today that factory returns a `RateLimiterMemory` — per-process counters
held in Node's heap.

Active limits (points / window):

| Limiter | Points | Window | Keyed by |
|---|---|---|---|
| `auth/register` | 5 | 1 hr | IP |
| `auth/login` | 10 | 15 min | email (inside NextAuth authorize) |
| `auth/password-reset` | 3 | 1 hr | IP |
| `conversation/process` | 20 | 1 hr | userId |
| `conversation/chat` | 60 | 1 hr | userId |
| `conversation/upload` | 30 | 1 hr | userId |
| `conversation/send-email` | 20 | 1 hr | userId |
| `style/upload` | 10 | 1 hr | userId |
| `style/process` | 15 | 1 hr | userId |
| `style/profile` | 6 | 1 hr | userId |

Authenticated limiters (anything keyed by `userId`) also write a
`ratelimit.<type>` audit log entry when they trip, so abuse patterns
show up in `docs/security/route-audit.md` queries.

## Known limitation

`RateLimiterMemory` is NOT shared across Node processes or machines.
Operational consequences at the current deploy (single PM2 process,
~50 concurrent users):

- Counters reset on process restart. An attacker who forced a restart
  would regain full budget. We don't expose an interface to force a
  restart, so this is a minor leak.
- Scaling to >1 process (pm2 cluster, k8s replicas) breaks correctness:
  each instance has its own counter, so effective limits multiply by
  the replica count. **Do not scale out without swapping the backend.**

If the operator sets `PM2_INSTANCES > 1` in production, the factory
emits a one-time `console.warn` at module init pointing at this file.

## Upgrade path (Redis / Upstash)

```
npm install ioredis
# or: npm install @upstash/redis
```

Then edit [`src/lib/rate-limiter-store.ts`](../../src/lib/rate-limiter-store.ts):

```ts
import { RateLimiterRedis } from "rate-limiter-flexible";
import Redis from "ioredis";
import { env } from "@/lib/env";

const client = new Redis(env.REDIS_URL);

export function createLimiter(opts: LimiterOptions): AppRateLimiter {
  return new RateLimiterRedis({
    storeClient: client,
    points: opts.points,
    duration: opts.durationSec,
    keyPrefix: `rl:${opts.label}:`,
  });
}
```

Add `REDIS_URL: z.string().url()` to the env schema in
[`src/lib/env.ts`](../../src/lib/env.ts).

No call site changes: both `rateLimit` and `rateLimitUser` depend only
on `.consume(key)`, which is identical between `RateLimiterMemory` and
`RateLimiterRedis`.

**Rollout:** deploy the code change first with `REDIS_URL` pointed at a
fresh instance (empty counters = no attacker survives the cutover), run
a smoke login + process to confirm limiter behaviour, then scale
instances.
