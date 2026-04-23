/**
 * A.3 regression: every user-level rate limiter returns 429 with Retry-After
 * when exhausted, and when an audit context is provided the 429 is recorded
 * as an audit event.
 *
 * Tests the rate-limit module directly because the limiter state is shared
 * across requests; exercising it end-to-end through a route would require a
 * custom reset hook we don't want to expose.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockLogAudit } = vi.hoisted(() => ({
  mockLogAudit: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));

import { rateLimitUser } from "@/lib/rate-limit";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("rateLimitUser", () => {
  it("allows under the limit (returns null)", async () => {
    const res = await rateLimitUser("user-chat-1", "chat");
    expect(res).toBeNull();
  });

  it("returns 429 + Retry-After once exhausted, and logs audit when ctx is provided", async () => {
    const userId = "user-audit-under-test";

    // styleProfile limiter is the smallest (6/hr) — exhaust it.
    for (let i = 0; i < 6; i++) {
      const ok = await rateLimitUser(userId, "styleProfile", {
        workspaceId: "ws-1",
        userId,
        action: "ratelimit.style_profile",
      });
      expect(ok).toBeNull();
    }

    const blocked = await rateLimitUser(userId, "styleProfile", {
      workspaceId: "ws-1",
      userId,
      action: "ratelimit.style_profile",
    });

    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
    expect(blocked!.headers.get("Retry-After")).toBe("3600");
    const json = await blocked!.json();
    expect(json).toEqual({ error: "TOO_MANY_REQUESTS" });

    // Audit was logged — once, on the 7th (blocked) call.
    expect(mockLogAudit).toHaveBeenCalledTimes(1);
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        userId,
        action: "ratelimit.style_profile",
        metadata: { limiter: "styleProfile" },
      })
    );
  });

  it("does not log audit if no audit context was passed", async () => {
    const userId = "user-no-audit";
    // Exhaust chat (60/hr) — can't; use styleProfile for speed but different user.
    for (let i = 0; i < 6; i++) {
      await rateLimitUser(userId, "styleProfile");
    }
    const blocked = await rateLimitUser(userId, "styleProfile");
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
    expect(mockLogAudit).not.toHaveBeenCalled();
  });

  it("separate user ids have separate counters", async () => {
    for (let i = 0; i < 6; i++) {
      await rateLimitUser("isolation-user-a", "styleProfile");
    }
    const blockedA = await rateLimitUser("isolation-user-a", "styleProfile");
    expect(blockedA).not.toBeNull();

    const okB = await rateLimitUser("isolation-user-b", "styleProfile");
    expect(okB).toBeNull();
  });
});
