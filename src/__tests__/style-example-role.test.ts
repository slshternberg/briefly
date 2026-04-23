/**
 * SR-2 regression: the item-level style-example routes (POST analyze,
 * DELETE remove) used to allow any workspace MEMBER to perform the action.
 * Policy matches the list-level POST: OWNER/ADMIN only.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockMemberFindUnique, mockStyleUpdateMany, mockProcess } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockMemberFindUnique: vi.fn(),
  mockStyleUpdateMany: vi.fn(),
  mockProcess: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/db", () => ({
  db: {
    workspaceMember: { findUnique: mockMemberFindUnique },
    styleExample: {
      updateMany: mockStyleUpdateMany,
      findFirst: vi.fn().mockResolvedValue({
        id: "ex-1",
        audioStoragePath: "ws-1/style-examples/a.mp3",
        audioSizeBytes: BigInt(100),
      }),
      delete: vi.fn().mockResolvedValue({}),
    },
  },
}));
vi.mock("@/services/style", () => ({ processStyleExample: mockProcess }));
vi.mock("@/services/storage", () => ({
  getStorageProvider: () => ({ deleteFile: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock("@/lib/billing", () => ({
  decrementStorageUsage: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimitUser: vi.fn().mockResolvedValue(null) }));

import { POST, DELETE } from "@/app/api/workspace/style-examples/[exampleId]/route";

const makeParams = () => ({ params: Promise.resolve({ exampleId: "ex-1" }) });
const req = () => new Request("http://local/api/workspace/style-examples/ex-1");

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({
    user: { id: "user-1", activeWorkspaceId: "ws-1" },
  });
  mockStyleUpdateMany.mockResolvedValue({ count: 1 });
  mockProcess.mockResolvedValue({});
});

describe("POST /api/workspace/style-examples/[exampleId]", () => {
  it("rejects MEMBER with 403", async () => {
    mockMemberFindUnique.mockResolvedValue({ role: "MEMBER" });
    const res = await POST(req(), makeParams());
    expect(res.status).toBe(403);
    expect(mockStyleUpdateMany).not.toHaveBeenCalled();
    expect(mockProcess).not.toHaveBeenCalled();
  });

  it("rejects non-member with 403", async () => {
    mockMemberFindUnique.mockResolvedValue(null);
    const res = await POST(req(), makeParams());
    expect(res.status).toBe(403);
  });

  it("allows ADMIN", async () => {
    mockMemberFindUnique.mockResolvedValue({ role: "ADMIN" });
    const res = await POST(req(), makeParams());
    expect(res.status).toBe(200);
    expect(mockStyleUpdateMany).toHaveBeenCalled();
  });

  it("allows OWNER", async () => {
    mockMemberFindUnique.mockResolvedValue({ role: "OWNER" });
    const res = await POST(req(), makeParams());
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/workspace/style-examples/[exampleId]", () => {
  it("rejects MEMBER with 403", async () => {
    mockMemberFindUnique.mockResolvedValue({ role: "MEMBER" });
    const res = await DELETE(
      new Request("http://local/x", { method: "DELETE" }),
      makeParams()
    );
    expect(res.status).toBe(403);
  });

  it("allows OWNER", async () => {
    mockMemberFindUnique.mockResolvedValue({ role: "OWNER" });
    const res = await DELETE(
      new Request("http://local/x", { method: "DELETE" }),
      makeParams()
    );
    expect(res.status).toBe(200);
  });
});
