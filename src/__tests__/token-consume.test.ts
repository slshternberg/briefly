/**
 * SR-6 regression: password reset, email verify, and workspace join used
 * read-then-mark-used token flows. Two concurrent requests could both
 * read the same unused token and each fire the side effect (password
 * change / email verify / membership create). Now each flow uses
 * `updateMany({ tokenHash, usedAt: null, expiresAt > now })` as a
 * single-use lock; only one caller matches count=1 and continues.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockPasswordUpdateMany,
  mockPasswordFindUnique,
  mockUserUpdate,
  mockVerifyUpdateMany,
  mockVerifyFindUnique,
  mockInviteUpdateMany,
  mockInviteFindUnique,
  mockJoinUserFindUnique,
  mockMemberFindUnique,
  mockMemberCreate,
  mockAuth,
  mockLogAudit,
} = vi.hoisted(() => ({
  mockPasswordUpdateMany: vi.fn(),
  mockPasswordFindUnique: vi.fn(),
  mockUserUpdate: vi.fn(),
  mockVerifyUpdateMany: vi.fn(),
  mockVerifyFindUnique: vi.fn(),
  mockInviteUpdateMany: vi.fn(),
  mockInviteFindUnique: vi.fn(),
  mockJoinUserFindUnique: vi.fn(),
  mockMemberFindUnique: vi.fn(),
  mockMemberCreate: vi.fn(),
  mockAuth: vi.fn(),
  mockLogAudit: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    passwordResetToken: {
      updateMany: mockPasswordUpdateMany,
      findUnique: mockPasswordFindUnique,
    },
    emailVerificationToken: {
      updateMany: mockVerifyUpdateMany,
      findUnique: mockVerifyFindUnique,
    },
    workspaceInvitation: {
      findUnique: mockInviteFindUnique,
      updateMany: mockInviteUpdateMany,
    },
    workspaceMember: {
      findUnique: mockMemberFindUnique,
      create: mockMemberCreate,
    },
    user: {
      update: mockUserUpdate,
      findUnique: mockJoinUserFindUnique,
    },
  },
}));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/env", () => ({
  env: { AUTH_URL: "https://briefly.example.com" },
}));

beforeEach(() => {
  vi.clearAllMocks();
  // sensible defaults per-suite reset inside each describe as needed.
});

// ---------------------------------------------------------------------------
// password-reset-confirm
// ---------------------------------------------------------------------------
import { POST as passwordResetConfirm } from "@/app/api/auth/password-reset-confirm/route";

function passwordReq() {
  return new Request("http://local/", {
    method: "POST",
    body: JSON.stringify({ token: "raw-token", password: "new-strong-pass" }),
    headers: { "Content-Type": "application/json" },
  });
}

describe("SR-6 password-reset-confirm", () => {
  beforeEach(() => {
    mockUserUpdate.mockResolvedValue({ memberships: [] });
    mockPasswordFindUnique.mockResolvedValue({ id: "tok-1", userId: "user-1" });
  });

  it("winner consumes the token atomically and updates the password", async () => {
    mockPasswordUpdateMany.mockResolvedValue({ count: 1 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await passwordResetConfirm(passwordReq() as any);
    expect(res.status).toBe(200);

    expect(mockPasswordUpdateMany).toHaveBeenCalledTimes(1);
    const where = mockPasswordUpdateMany.mock.calls[0][0].where;
    expect(where.usedAt).toBeNull();
    expect(where.expiresAt).toEqual({ gt: expect.any(Date) });
    expect(mockUserUpdate).toHaveBeenCalledTimes(1);
  });

  it("loser (count=0 — already used / expired) gets 400 and NO password update", async () => {
    mockPasswordUpdateMany.mockResolvedValue({ count: 0 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await passwordResetConfirm(passwordReq() as any);
    expect(res.status).toBe(400);
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// verify-email
// ---------------------------------------------------------------------------
import { GET as verifyEmail } from "@/app/api/auth/verify-email/route";

describe("SR-6 verify-email", () => {
  beforeEach(() => {
    mockVerifyFindUnique.mockResolvedValue({ userId: "user-1" });
    mockUserUpdate.mockResolvedValue({});
  });

  it("winner consumes + verifies; redirects to /verified", async () => {
    mockVerifyUpdateMany.mockResolvedValue({ count: 1 });

    const url = new URL("http://local/api/auth/verify-email?token=raw");
    const req = Object.assign(new Request(url), { nextUrl: url });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await verifyEmail(req as any);
    expect(res.status).toBe(307); // redirect
    expect(res.headers.get("location")).toMatch(/\/verified$/);
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { emailVerified: true },
    });
  });

  it("loser (count=0) redirects to /login?verifyError=true and never verifies", async () => {
    mockVerifyUpdateMany.mockResolvedValue({ count: 0 });

    const url = new URL("http://local/api/auth/verify-email?token=raw");
    const req = Object.assign(new Request(url), { nextUrl: url });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await verifyEmail(req as any);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/verifyError=true/);
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// workspaces/join
// ---------------------------------------------------------------------------
import { POST as joinWorkspace } from "@/app/api/workspaces/join/route";

describe("SR-6 workspaces/join", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockInviteFindUnique.mockResolvedValue({
      id: "inv-1",
      tokenHash: "hash",
      email: "user@example.com",
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      workspaceId: "ws-1",
      role: "MEMBER",
    });
    mockJoinUserFindUnique.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
    });
    mockMemberFindUnique.mockResolvedValue(null);
    mockMemberCreate.mockResolvedValue({});
  });

  function req() {
    return new Request("http://local/", {
      method: "POST",
      body: JSON.stringify({ token: "raw" }),
      headers: { "Content-Type": "application/json" },
    });
  }

  it("winner consumes invite + creates membership", async () => {
    mockInviteUpdateMany.mockResolvedValue({ count: 1 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await joinWorkspace(req() as any);
    expect(res.status).toBe(200);
    expect(mockMemberCreate).toHaveBeenCalledTimes(1);
  });

  it("loser (count=0 — token already consumed) gets 400 and no membership", async () => {
    mockInviteUpdateMany.mockResolvedValue({ count: 0 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await joinWorkspace(req() as any);
    expect(res.status).toBe(400);
    expect(mockMemberCreate).not.toHaveBeenCalled();
  });

  it("swallows P2002 unique-collision when a racing request already created the membership", async () => {
    mockInviteUpdateMany.mockResolvedValue({ count: 1 });
    const err = Object.assign(new Error("unique constraint"), { code: "P2002" });
    mockMemberCreate.mockRejectedValue(err);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await joinWorkspace(req() as any);
    expect(res.status).toBe(200);
  });
});
