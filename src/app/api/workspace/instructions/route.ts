import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateInstructionsSchema } from "@/lib/validations/workspace";

export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.activeWorkspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const parsed = updateInstructionsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }
    const instructions = parsed.data.instructions;

    const membership = await db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: session.user.activeWorkspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!membership || membership.role === "MEMBER") {
      return NextResponse.json(
        { error: "Only workspace owners and admins can change settings" },
        { status: 403 }
      );
    }

    const workspace = await db.workspace.update({
      where: { id: session.user.activeWorkspaceId },
      data: { customInstructions: instructions || null },
      select: { id: true, customInstructions: true },
    });

    return NextResponse.json(workspace);
  } catch (error) {
    console.error("Update instructions error:", error);
    return NextResponse.json(
      { error: "Failed to update instructions" },
      { status: 500 }
    );
  }
}
