/**
 * SR-4 regression: two concurrent POSTs to
 * /api/conversations/[id]/process used to each pass the status check
 * (both saw UPLOADED), each flip the row to PROCESSING, and each fire a
 * separate runAnalysisJob — double-billing, duplicate notifications,
 * and summary overwrites.
 *
 * Fix: atomic updateMany gated on status IN {UPLOADED, FAILED, COMPLETED}.
 * The loser sees count === 0 and returns 409 without kicking off a job.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockAuth,
  mockConvFindFirst,
  mockConvUpdateMany,
  mockWorkspaceFindUnique,
  mockAssetFindFirst,
  mockRateLimit,
  mockRunAnalysisJob,
  mockCheckConv,
  mockCheckAudio,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockConvFindFirst: vi.fn(),
  mockConvUpdateMany: vi.fn(),
  mockWorkspaceFindUnique: vi.fn(),
  mockAssetFindFirst: vi.fn(),
  mockRateLimit: vi.fn().mockResolvedValue(null),
  mockRunAnalysisJob: vi.fn().mockResolvedValue(undefined),
  mockCheckConv: vi.fn().mockResolvedValue(null),
  mockCheckAudio: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/db", () => ({
  db: {
    conversation: {
      findFirst: mockConvFindFirst,
      updateMany: mockConvUpdateMany,
    },
    workspace: { findUnique: mockWorkspaceFindUnique },
    conversationAsset: { findFirst: mockAssetFindFirst },
  },
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimitUser: mockRateLimit }));
vi.mock("@/services/analysis/worker", () => ({ runAnalysisJob: mockRunAnalysisJob }));
vi.mock("@/lib/billing", () => ({
  checkConversationLimit: mockCheckConv,
  checkAudioMinutesLimit: mockCheckAudio,
}));
vi.mock("@/services/storage", () => ({
  getStorageProvider: () => ({
    getFilePath: vi.fn().mockReturnValue("/local/a.mp3"),
    getFileBuffer: vi.fn().mockResolvedValue(Buffer.from("")),
  }),
}));
vi.mock("@/lib/duration", () => ({
  extractDurationSeconds: vi.fn().mockResolvedValue(60),
}));

import { POST } from "@/app/api/conversations/[conversationId]/process/route";

const req = () =>
  new Request("http://local/process", {
    method: "POST",
    body: JSON.stringify({}),
    headers: { "Content-Type": "application/json" },
  });
const makeParams = () => ({ params: Promise.resolve({ conversationId: "conv-1" }) });

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({
    user: { id: "user-1", activeWorkspaceId: "ws-1" },
  });
  mockConvFindFirst.mockResolvedValue({
    id: "conv-1",
    status: "UPLOADED",
    title: "meeting",
    workspaceId: "ws-1",
    deletedAt: null,
  });
  mockWorkspaceFindUnique.mockResolvedValue({
    customInstructions: null,
    defaultLanguage: "Hebrew",
  });
  mockAssetFindFirst.mockResolvedValue({
    id: "asset-1",
    storagePath: "ws-1/conv-1/a.mp3",
    mimeType: "audio/mpeg",
    durationSeconds: 60,
  });
  mockConvUpdateMany.mockResolvedValue({ count: 1 });
});

describe("SR-4: concurrent process() calls", () => {
  it("winner: status flips via updateMany and runAnalysisJob fires once", async () => {
    const res = await POST(req(), makeParams());
    expect(res.status).toBe(200);

    expect(mockConvUpdateMany).toHaveBeenCalledTimes(1);
    const where = mockConvUpdateMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      id: "conv-1",
      workspaceId: "ws-1",
      deletedAt: null,
    });
    expect(where.status).toEqual({
      in: ["UPLOADED", "FAILED", "COMPLETED"],
    });
    expect(mockRunAnalysisJob).toHaveBeenCalledTimes(1);
  });

  it("loser: updateMany count=0 → 409 and runAnalysisJob NEVER fires", async () => {
    mockConvUpdateMany.mockResolvedValue({ count: 0 });

    const res = await POST(req(), makeParams());
    expect(res.status).toBe(409);
    expect(mockRunAnalysisJob).not.toHaveBeenCalled();
  });

  it("simulated race: two concurrent POSTs — runAnalysisJob fires exactly once", async () => {
    mockConvUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const [first, second] = await Promise.all([
      POST(req(), makeParams()),
      POST(req(), makeParams()),
    ]);

    // Order is deterministic only relative to updateMany call order, but we
    // care about the aggregate: exactly one winner, exactly one job kicked off.
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);
    expect(mockRunAnalysisJob).toHaveBeenCalledTimes(1);
  });
});
