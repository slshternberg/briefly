/**
 * A.1 regression: cross-workspace access to a conversation via the send-email
 * route must return 404 (not leak audio or send the email). Also verifies that
 * the asset lookup is filtered by workspaceId as defense-in-depth — a mismatched
 * asset row must not reach the attachment path even if conversation lookup
 * somehow succeeded.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRequireAuth, mockConvFindFirst, mockAssetFindFirst } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockConvFindFirst: vi.fn(),
  mockAssetFindFirst: vi.fn(),
}));

vi.mock("@/lib/auth-guard", () => ({ requireAuth: mockRequireAuth }));

vi.mock("@/lib/db", () => ({
  db: {
    conversation: { findFirst: mockConvFindFirst },
    conversationAsset: { findFirst: mockAssetFindFirst },
  },
}));

vi.mock("@/services/google/tokens", () => ({
  getDecryptedGoogleTokens: vi.fn().mockResolvedValue({
    access: "tok",
    refresh: "ref",
    email: "sender@example.com",
  }),
  refreshEncryptedAccessToken: vi.fn(),
}));

vi.mock("@/services/storage", () => ({
  getStorageProvider: () => ({
    getFileBuffer: vi.fn().mockResolvedValue(Buffer.from("audio")),
  }),
}));

vi.mock("@/lib/env", () => ({
  env: { AUTH_URL: "http://local" },
}));

// googleapis.gmail().users.messages.send MUST NOT be called when auth/workspace fails.
const mockGmailSend = vi.fn().mockResolvedValue({ data: {} });
vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: class {
        on = vi.fn();
        setCredentials = vi.fn();
      },
    },
    gmail: () => ({ users: { messages: { send: mockGmailSend } } }),
  },
}));

import { POST } from "@/app/api/conversations/[conversationId]/send-email/route";

const WORKSPACE_A = { id: "ws-a", name: "A", slug: "a", defaultLanguage: "Hebrew", deletedAt: null, _count: { conversations: 0, members: 1 } };

function makeReq(body: object) {
  return new Request("http://local/api/conversations/conv-b/send-email", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}
const makeParams = () => ({ params: Promise.resolve({ conversationId: "conv-b" }) });

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({
    session: { user: { id: "user-a", email: "a@example.com" } },
    workspace: WORKSPACE_A,
    role: "OWNER",
  });
});

describe("send-email workspace isolation", () => {
  it("returns 404 when conversation belongs to a different workspace (findFirst returns null)", async () => {
    // Simulates: conv-b exists in workspace B, so findFirst with workspaceId=ws-a returns null.
    mockConvFindFirst.mockResolvedValue(null);

    const res = await POST(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeReq({ to: "r@example.com", subject: "x", body: "y" }) as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeParams() as any
    );

    expect(res.status).toBe(404);
    expect(mockAssetFindFirst).not.toHaveBeenCalled();
    expect(mockGmailSend).not.toHaveBeenCalled();
  });

  it("asset lookup includes workspaceId — cross-tenant asset rows are filtered out", async () => {
    // Conversation belongs to workspace A (guard passes).
    mockConvFindFirst.mockResolvedValue({ id: "conv-b", workspaceId: "ws-a" });
    // Asset filter must include workspaceId — we capture the call to verify.
    mockAssetFindFirst.mockResolvedValue(null);

    await POST(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeReq({ to: "r@example.com", subject: "x", body: "y" }) as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeParams() as any
    );

    expect(mockAssetFindFirst).toHaveBeenCalledTimes(1);
    const call = mockAssetFindFirst.mock.calls[0][0];
    expect(call.where).toMatchObject({
      conversationId: "conv-b",
      workspaceId: "ws-a",
    });
  });
});
