/**
 * Centralized factory for rate limiter instances.
 *
 * All limiters in the app should be created through `createLimiter` so the
 * storage backend is chosen in exactly one place. Today that backend is
 * `RateLimiterMemory` — per-process counters held in Node's heap.
 *
 * ## Production limitation
 *
 * `RateLimiterMemory` is NOT shared across processes or machines. Concrete
 * consequences for current deployment (single PM2 process, up to ~50
 * concurrent users):
 *   - Rate limits are effectively enforced per process. With one process,
 *     that matches per-instance limits exactly — no drift.
 *   - If the process restarts (crash, deploy), counters reset. An attacker
 *     who was almost rate-limited could regain full budget after a restart.
 *     For our limits (5-60/hr) this is a minor leak; for login (10/15min)
 *     a malicious actor could get at most ~40 tries per hour with forced
 *     restarts, which we don't expose an interface for.
 *   - Scaling to >1 instance (pm2 cluster, horizontal pods) breaks
 *     correctness: each instance has its own counters, so effective limits
 *     multiply. DO NOT scale past single-process without swapping the
 *     backend.
 *
 * ## Upgrade path
 *
 * When Redis or Upstash is available:
 *   1. `npm install ioredis` (or `@upstash/redis`).
 *   2. Add `REDIS_URL` to `src/lib/env.ts` schema (optional for now).
 *   3. Replace this factory's body with:
 *
 *        import { RateLimiterRedis } from "rate-limiter-flexible";
 *        import Redis from "ioredis";
 *        const client = new Redis(env.REDIS_URL);
 *        return new RateLimiterRedis({ storeClient: client, ...opts, keyPrefix });
 *
 *   4. Call sites (`rateLimit`, `rateLimitUser`) need no changes — they
 *      already depend only on the `.consume(key)` API, which is shared
 *      between the memory and Redis implementations of rate-limiter-flexible.
 *
 * Tracked in `docs/deploy/rate-limiting.md`.
 */

import { RateLimiterMemory } from "rate-limiter-flexible";

export interface LimiterOptions {
  /** Maximum operations permitted within `durationSec`. */
  points: number;
  /** Window length in seconds. */
  durationSec: number;
  /** Human-readable name used in deploy docs and logs. */
  label: string;
}

/**
 * Subset of the rate-limiter-flexible API the rest of the app relies on.
 * Kept narrow so we can swap in a Redis-backed (or test-only) implementation
 * without depending on every knob the library exposes.
 */
export interface AppRateLimiter {
  consume(key: string, points?: number): Promise<unknown>;
}

let backendWarningEmitted = false;

export function createLimiter(opts: LimiterOptions): AppRateLimiter {
  if (
    process.env.NODE_ENV === "production" &&
    !backendWarningEmitted &&
    (process.env.PM2_INSTANCES ?? "1") !== "1"
  ) {
    console.warn(
      "[rate-limit] WARNING: PM2_INSTANCES > 1 but limiter backend is " +
        "RateLimiterMemory (per-process). Effective limits multiply across " +
        "instances. Swap to Redis before scaling out. See " +
        "docs/deploy/rate-limiting.md."
    );
    backendWarningEmitted = true;
  }
  return new RateLimiterMemory({
    points: opts.points,
    duration: opts.durationSec,
  });
}
