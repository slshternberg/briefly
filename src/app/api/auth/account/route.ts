import { NextResponse } from "next/server";
import { auth, signOut } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Find workspaces where user is OWNER
  const ownedMemberships = await db.workspaceMember.findMany({
    where: { userId, role: "OWNER" },
    include: {
      workspace: {
        include: { members: { select: { id: true } } },
      },
    },
  });

  // Block deletion if user is owner of a shared workspace
  for (const m of ownedMemberships) {
    if (m.workspace.members.length > 1) {
      return NextResponse.json(
        { error: "יש להעביר בעלות על הסביבה לפני מחיקת החשבון" },
        { status: 409 }
      );
    }
  }

  const ownedWorkspaceIds = ownedMemberships.map((m) => m.workspaceId);

  await db.$transaction(async (tx) => {
    if (ownedWorkspaceIds.length > 0) {
      // Delete restricted relations before workspace deletion
      await tx.subscription.deleteMany({ where: { workspaceId: { in: ownedWorkspaceIds } } });
      await tx.auditLog.deleteMany({ where: { workspaceId: { in: ownedWorkspaceIds } } });
      // Delete workspaces — cascades conversations, assets, summaries, threads, messages, api_keys, style_examples, style_profiles, usage_records, members
      await tx.workspace.deleteMany({ where: { id: { in: ownedWorkspaceIds } } });
    }

    // Remove any remaining memberships in other workspaces
    await tx.workspaceMember.deleteMany({ where: { userId } });

    // Remove auth tokens (cascade would handle these, but explicit is safer)
    await tx.emailVerificationToken.deleteMany({ where: { userId } });
    await tx.passwordResetToken.deleteMany({ where: { userId } });

    // Delete user — ChatMessage.userId and AuditLog.userId are nullable (SetNull)
    await tx.user.delete({ where: { id: userId } });
  });

  // Sign the user out
  await signOut({ redirect: false });

  return NextResponse.json({ ok: true });
}
