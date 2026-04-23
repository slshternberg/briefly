/**
 * Pure helper around the NextAuth `jwt` callback.
 *
 * Lives outside `src/lib/auth.ts` so tests can import it without dragging
 * in NextAuth itself (which needs `next/server` at boot and isn't loadable
 * under vitest's Node environment).
 *
 * Covers:
 *  - SR-1: a workspace switch via `useSession().update(...)` only takes
 *    effect if a real, active `WorkspaceMember` row exists for
 *    (userId, requestedWorkspaceId). The role is always read from the DB
 *    row, never from the client payload.
 *  - SR-5: a token whose `iat` precedes the user's `passwordChangedAt` is
 *    returned as `{}`, which NextAuth treats as a cleared session.
 */

import { db } from "@/lib/db";

export type JwtInput = {
  token: Record<string, unknown>;
  user: Record<string, unknown> | null;
  trigger: "signIn" | "signUp" | "update" | undefined;
  session: Record<string, unknown> | undefined;
};

export async function resolveJwt(
  input: JwtInput
): Promise<Record<string, unknown>> {
  const { token, user, trigger, session } = input;

  if (user) {
    token.id = user.id as string;
    token.emailVerified = user.emailVerified as boolean;
    token.activeWorkspaceId = user.activeWorkspaceId as string;
    token.activeWorkspaceRole = user.activeWorkspaceRole as string;
    const userRow = await db.user.findUnique({
      where: { id: user.id as string },
      select: { passwordChangedAt: true },
    });
    token.passwordChangedAt = userRow?.passwordChangedAt?.getTime() ?? null;
  }

  if (trigger === "update" && session?.activeWorkspaceId && token.id) {
    const requestedWorkspaceId = session.activeWorkspaceId as string;
    const membership = await db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: requestedWorkspaceId,
          userId: token.id as string,
        },
      },
      include: { workspace: { select: { deletedAt: true } } },
    });
    if (membership && membership.workspace.deletedAt === null) {
      token.activeWorkspaceId = requestedWorkspaceId;
      token.activeWorkspaceRole = membership.role;
    }
  }

  if (token.id && typeof token.iat === "number") {
    const current = await db.user.findUnique({
      where: { id: token.id as string },
      select: { passwordChangedAt: true },
    });
    const passwordChangedAtSec = current?.passwordChangedAt
      ? Math.floor(current.passwordChangedAt.getTime() / 1000)
      : null;
    if (
      passwordChangedAtSec !== null &&
      passwordChangedAtSec > (token.iat as number)
    ) {
      return {};
    }
  }

  return token;
}
