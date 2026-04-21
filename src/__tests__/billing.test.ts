import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module before importing billing
vi.mock("@/lib/db", () => ({
  db: {
    $executeRaw: vi.fn().mockResolvedValue(1),
    subscription: {
      findFirst: vi.fn(),
    },
    usageRecord: {
      findFirst: vi.fn(),
      upsert: vi.fn().mockResolvedValue({}),
    },
    workspaceMember: {
      count: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import {
  checkConversationLimit,
  checkAudioMinutesLimit,
  checkAiQueryLimit,
  checkMembersLimit,
  decrementStorageUsage,
  incrementStorageUsage,
} from "@/lib/billing";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDb = db as any;

const PRO = {
  maxConversationsPerMonth: 200,
  maxAudioMinutesPerMonth: 3000,
  maxAiQueriesPerMonth: 1000,
  maxStorageMb: 10000,
  maxMembersPerWorkspace: 20,
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no subscription (free tier), no usage
  mockDb.subscription.findFirst.mockResolvedValue(null);
  mockDb.usageRecord.findFirst.mockResolvedValue(null);
  mockDb.workspaceMember.count.mockResolvedValue(0);
});

describe("checkConversationLimit", () => {
  it("returns null when under free limit", async () => {
    mockDb.usageRecord.findFirst.mockResolvedValue({ conversationCount: 5 });
    expect(await checkConversationLimit("ws1")).toBeNull();
  });

  it("returns error when at free limit", async () => {
    mockDb.usageRecord.findFirst.mockResolvedValue({ conversationCount: 10 });
    const result = await checkConversationLimit("ws1");
    expect(result).toContain("10");
  });

  it("returns null when under pro limit", async () => {
    mockDb.subscription.findFirst.mockResolvedValue({ plan: PRO });
    mockDb.usageRecord.findFirst.mockResolvedValue({ conversationCount: 199 });
    expect(await checkConversationLimit("ws1")).toBeNull();
  });

  it("returns error when at pro limit", async () => {
    mockDb.subscription.findFirst.mockResolvedValue({ plan: PRO });
    mockDb.usageRecord.findFirst.mockResolvedValue({ conversationCount: 200 });
    const result = await checkConversationLimit("ws1");
    expect(result).toContain("200");
  });

  it("returns null when no usage record (fresh workspace)", async () => {
    expect(await checkConversationLimit("ws1")).toBeNull();
  });
});

describe("checkAudioMinutesLimit", () => {
  it("returns null when new upload fits within limit", async () => {
    // 60 min used, adding 30 min → 90 min total, free limit is 120 min
    mockDb.usageRecord.findFirst.mockResolvedValue({ audioSecondsUsed: 60 * 60 });
    expect(await checkAudioMinutesLimit("ws1", 30 * 60)).toBeNull();
  });

  it("returns error when new upload exceeds limit", async () => {
    // 100 min used, adding 30 min → 130 min > 120 min free limit
    mockDb.usageRecord.findFirst.mockResolvedValue({ audioSecondsUsed: 100 * 60 });
    const result = await checkAudioMinutesLimit("ws1", 30 * 60);
    expect(result).not.toBeNull();
    expect(result).toContain("120");
  });

  it("returns null exactly at limit boundary (not over)", async () => {
    // 60 min used, adding 60 min → exactly 120 min (not over)
    mockDb.usageRecord.findFirst.mockResolvedValue({ audioSecondsUsed: 60 * 60 });
    expect(await checkAudioMinutesLimit("ws1", 60 * 60)).toBeNull();
  });

  it("returns error one second over limit", async () => {
    // 120 min used exactly, adding 1 second → over
    mockDb.usageRecord.findFirst.mockResolvedValue({ audioSecondsUsed: 120 * 60 });
    const result = await checkAudioMinutesLimit("ws1", 1);
    expect(result).not.toBeNull();
  });

  it("handles no prior usage", async () => {
    // No usage record, adding 10 min → fine
    expect(await checkAudioMinutesLimit("ws1", 10 * 60)).toBeNull();
  });

  it("respects pro plan limit", async () => {
    mockDb.subscription.findFirst.mockResolvedValue({ plan: PRO });
    // 2999 min used, adding 1 min → 3000 (not over)
    mockDb.usageRecord.findFirst.mockResolvedValue({ audioSecondsUsed: 2999 * 60 });
    expect(await checkAudioMinutesLimit("ws1", 60)).toBeNull();
  });
});

describe("checkAiQueryLimit", () => {
  it("returns null when under limit", async () => {
    mockDb.usageRecord.findFirst.mockResolvedValue({ aiQueryCount: 49 });
    expect(await checkAiQueryLimit("ws1")).toBeNull();
  });

  it("returns error when at limit", async () => {
    mockDb.usageRecord.findFirst.mockResolvedValue({ aiQueryCount: 50 });
    const result = await checkAiQueryLimit("ws1");
    expect(result).toContain("50");
  });

  it("returns null with no usage", async () => {
    expect(await checkAiQueryLimit("ws1")).toBeNull();
  });
});

describe("checkMembersLimit", () => {
  it("returns null when under free limit", async () => {
    mockDb.workspaceMember.count.mockResolvedValue(2);
    expect(await checkMembersLimit("ws1")).toBeNull();
  });

  it("returns error when at free limit", async () => {
    mockDb.workspaceMember.count.mockResolvedValue(3);
    const result = await checkMembersLimit("ws1");
    expect(result).toContain("3");
  });

  it("respects pro plan member limit", async () => {
    mockDb.subscription.findFirst.mockResolvedValue({ plan: PRO });
    mockDb.workspaceMember.count.mockResolvedValue(19);
    expect(await checkMembersLimit("ws1")).toBeNull();
  });

  it("returns error when over pro member limit", async () => {
    mockDb.subscription.findFirst.mockResolvedValue({ plan: PRO });
    mockDb.workspaceMember.count.mockResolvedValue(20);
    const result = await checkMembersLimit("ws1");
    expect(result).toContain("20");
  });
});

// ── decrementStorageUsage ─────────────────────────────────────────────────────

describe("decrementStorageUsage", () => {
  it("calls $executeRaw with GREATEST to prevent negative storage", async () => {
    await decrementStorageUsage("ws1", 1024);
    expect(mockDb.$executeRaw).toHaveBeenCalledTimes(1);
    // Verify the raw SQL template includes GREATEST (safety check)
    const [template] = mockDb.$executeRaw.mock.calls[0];
    const sql = template.join("?");
    expect(sql).toContain("GREATEST");
    expect(sql).toContain("storageBytesUsed");
  });

  it("does not call $executeRaw when fileSizeBytes is 0 (no-op guard)", async () => {
    await decrementStorageUsage("ws1", 0);
    expect(mockDb.$executeRaw).not.toHaveBeenCalled();
  });

  it("does not throw when $executeRaw resolves with 0 rows affected (record not found)", async () => {
    mockDb.$executeRaw.mockResolvedValue(0);
    await expect(decrementStorageUsage("ws1", 500)).resolves.toBeUndefined();
  });
});

// ── incrementStorageUsage ─────────────────────────────────────────────────────

describe("incrementStorageUsage", () => {
  it("calls usageRecord.upsert with correct bytes in create and increment in update", async () => {
    await incrementStorageUsage("ws1", 2048);
    expect(mockDb.usageRecord.upsert).toHaveBeenCalledTimes(1);
    const { create, update } = mockDb.usageRecord.upsert.mock.calls[0][0];
    expect(create.storageBytesUsed).toBe(2048);
    expect(update.storageBytesUsed).toEqual({ increment: 2048 });
  });
});
