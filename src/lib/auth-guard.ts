import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { cache } from "react";

/**
 * Use in server components / route handlers to require authentication.
 * Verifies session AND workspace membership ownership.
 * Redirects to /login if not authenticated or membership is invalid.
 *
 * Wrapped in React.cache() so multiple calls in the same request
 * (e.g., layout + page) only hit the database once.
 */
export const requireAuth = cache(async () => {
  const session = await auth();
  if (!session?.user?.id || !session.user.activeWorkspaceId) {
    redirect("/login");
  }

  // Verify user is actually a member of this workspace (don't trust JWT alone)
  const membership = await db.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: session.user.activeWorkspaceId,
        userId: session.user.id,
      },
    },
    select: {
      role: true,
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          defaultLanguage: true,
          deletedAt: true,
          _count: { select: { conversations: true, members: true } },
        },
      },
    },
  });

  if (!membership || membership.workspace.deletedAt !== null) {
    redirect("/login");
  }

  return {
    session,
    workspace: membership.workspace,
    role: membership.role,
  };
});
