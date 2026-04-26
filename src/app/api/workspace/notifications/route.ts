import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  notifyOnAnalysisDone: z.boolean(),
});

/** PUT — toggle workspace-level "email me when analysis finishes". */
export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.activeWorkspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = session.user.activeWorkspaceId;

    let body: unknown;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    // Any member of the workspace can toggle their own notification preference
    // (it's effectively per-user — we'll move to a per-user flag later, but
    // for now the workspace toggle is good enough since the email goes to the
    // session user who triggers analysis).
    const membership = await db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
      select: { role: true },
    });
    if (!membership) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 });
    }

    const updated = await db.workspace.update({
      where: { id: workspaceId },
      data: { notifyOnAnalysisDone: parsed.data.notifyOnAnalysisDone },
      select: { notifyOnAnalysisDone: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update notifications error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
