/**
 * Regression: concurrent DELETE requests on the same conversation used to
 * each run findFirst → deleteFile → update → decrement, leading to double
 * storage decrement (breaking billing) and double deleteFile (log noise).
 *
 * Fix uses updateMany with a deletedAt: null guard as the race winner lock.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockDeleteFile, mockDecrement, mockLogAudit } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockDeleteFile: vi.fn(),
  mockDecrement: vi.fn(),
  mockLogAudit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

vi.mock("@/services/storage", () => ({
  getStorageProvider: () => ({
    deleteFile: mockDeleteFile,
  }),
}));

vi.mock("@/lib/billing", () => ({
  decrementStorageUsage: mockDecrement,
}));

vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));

vi.mock("@/lib/db", () => ({
  db: {
    conversation: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import { DELETE } from "@/app/api/conversations/[conversationId]/route";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDb = db as any;

const CONV = {
  id: "conv-1",
  assets: [
    { storagePath: "ws-1/conv-1/a.mp3", sizeBytes: BigInt(1000) },
    { storagePath: "ws-1/conv-1/b.mp3", sizeBytes: BigInt(2000) },
  ],
};

function makeReq() {
  return new Request("http://local/api/conversations/conv-1", { method: "DELETE" });
}
const makeParams = () => ({ params: Promise.resolve({ conversationId: "conv-1" }) });

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({
    user: { id: "user-1", activeWorkspaceId: "ws-1" },
  });
  mockDb.conversation.findFirst.mockResolvedValue(CONV);
  mockDeleteFile.mockResolvedValue(undefined);
  mockDecrement.mockResolvedValue(undefined);
});

describe("DELETE /api/conversations/[id] — concurrent-delete safety", () => {
  it("winner (updateMany count=1): deletes files and decrements once", async () => {
    mockDb.conversation.updateMany.mockResolvedValue({ count: 1 });

    const res = await DELETE(makeReq(), makeParams());

    expect(res.status).toBe(200);
    expect(mockDb.conversation.updateMany).toHaveBeenCalledTimes(1);
    expect(mockDeleteFile).toHaveBeenCalledTimes(2); // both assets
    expect(mockDecrement).toHaveBeenCalledTimes(1);
    expect(mockDecrement).toHaveBeenCalledWith("ws-1", 3000);
  });

  it("loser (updateMany count=0): no file deletion, no decrement", async () => {
    mockDb.conversation.updateMany.mockResolvedValue({ count: 0 });

    const res = await DELETE(makeReq(), makeParams());

    expect(res.status).toBe(200);
    expect(mockDeleteFile).not.toHaveBeenCalled();
    expect(mockDecrement).not.toHaveBeenCalled();
    expect(mockLogAudit).not.toHaveBeenCalled();
  });

  it("simulated race: two concurrent calls — decrement fires exactly once", async () => {
    // First updateMany wins; second returns count=0 (row already had deletedAt set)
    mockDb.conversation.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    await Promise.all([
      DELETE(makeReq(), makeParams()),
      DELETE(makeReq(), makeParams()),
    ]);

    expect(mockDecrement).toHaveBeenCalledTimes(1);
    expect(mockDecrement).toHaveBeenCalledWith("ws-1", 3000);
  });
});
