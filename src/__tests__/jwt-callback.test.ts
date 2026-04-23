/**
 * SR-1 + SR-5 regressions:
 *
 * 1. Previously, the jwt callback accepted any activeWorkspaceId / Role the
 *    client sent via `useSession().update(...)` — a cross-tenant hijack.
 *    Now the update is cross-checked against workspaceMember before the
 *    token is rewritten, and the role is always sourced from the DB row.
 *
 * 2. Previously, a JWT issued before a password reset remained valid until
 *    its natural expiry (weeks). Now a token whose `iat` precedes the
 *    user's `passwordChangedAt` is returned as `{}` which NextAuth treats
 *    as a cleared session.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUserFindUnique, mockMemberFindUnique } = vi.hoisted(() => ({
  mockUserFindUnique: vi.fn(),
  mockMemberFindUnique: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: mockUserFindUnique },
    workspaceMember: { findUnique: mockMemberFindUnique },
  },
}));

import { resolveJwt } from "@/lib/jwt-resolver";

const USER_ID = "user-1";
const WS_REAL = "ws-real";
const WS_ATTACKER_TARGET = "ws-other-tenant";

beforeEach(() => {
  vi.clearAllMocks();
  // Default: user exists, no password-reset stamp.
  mockUserFindUnique.mockResolvedValue({ passwordChangedAt: null });
});

function baseToken(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: USER_ID,
    activeWorkspaceId: WS_REAL,
    activeWorkspaceRole: "MEMBER",
    iat: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

describe("SR-1: workspace switch via update() is DB-validated", () => {
  it("applies the switch when a real active membership exists", async () => {
    mockMemberFindUnique.mockResolvedValue({
      role: "ADMIN",
      workspace: { deletedAt: null },
    });

    const next = await resolveJwt({
      token: baseToken(),
      user: null,
      trigger: "update",
      session: { activeWorkspaceId: "ws-new", activeWorkspaceRole: "OWNER" },
    });

    expect(next.activeWorkspaceId).toBe("ws-new");
    // DB wins — client sent OWNER but membership row said ADMIN.
    expect(next.activeWorkspaceRole).toBe("ADMIN");
  });

  it("rejects a switch to a workspace the user is NOT a member of", async () => {
    mockMemberFindUnique.mockResolvedValue(null); // no matching row

    const before = baseToken();
    const next = await resolveJwt({
      token: { ...before },
      user: null,
      trigger: "update",
      session: {
        activeWorkspaceId: WS_ATTACKER_TARGET,
        activeWorkspaceRole: "OWNER",
      },
    });

    // Unchanged — attacker cannot switch into another tenant.
    expect(next.activeWorkspaceId).toBe(WS_REAL);
    expect(next.activeWorkspaceRole).toBe("MEMBER");
  });

  it("rejects a switch into a soft-deleted workspace", async () => {
    mockMemberFindUnique.mockResolvedValue({
      role: "OWNER",
      workspace: { deletedAt: new Date() },
    });

    const next = await resolveJwt({
      token: baseToken(),
      user: null,
      trigger: "update",
      session: { activeWorkspaceId: "ws-deleted" },
    });

    expect(next.activeWorkspaceId).toBe(WS_REAL);
    expect(next.activeWorkspaceRole).toBe("MEMBER");
  });
});

describe("SR-5: JWT invalidated after password reset", () => {
  it("clears the token when iat < passwordChangedAt", async () => {
    const iatSec = 1_000_000;
    const pwChangedMs = (iatSec + 60) * 1000; // changed one minute after token issue
    mockUserFindUnique.mockResolvedValue({
      passwordChangedAt: new Date(pwChangedMs),
    });

    const next = await resolveJwt({
      token: baseToken({ iat: iatSec }),
      user: null,
      trigger: undefined,
      session: undefined,
    });

    expect(next).toEqual({});
  });

  it("keeps the token when iat >= passwordChangedAt", async () => {
    const pwChangedMs = 1_000_000 * 1000;
    const iatSec = 1_000_100; // issued after reset
    mockUserFindUnique.mockResolvedValue({
      passwordChangedAt: new Date(pwChangedMs),
    });

    const next = await resolveJwt({
      token: baseToken({ iat: iatSec }),
      user: null,
      trigger: undefined,
      session: undefined,
    });

    expect(next.id).toBe(USER_ID);
    expect(next.activeWorkspaceId).toBe(WS_REAL);
  });

  it("keeps the token when the user has never reset their password", async () => {
    mockUserFindUnique.mockResolvedValue({ passwordChangedAt: null });

    const next = await resolveJwt({
      token: baseToken(),
      user: null,
      trigger: undefined,
      session: undefined,
    });

    expect(next.id).toBe(USER_ID);
  });
});
