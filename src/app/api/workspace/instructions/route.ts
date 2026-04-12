import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const MAX_LENGTH = 5000;

export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.activeWorkspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const instructions = body.instructions ?? "";

    if (typeof instructions !== "string") {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    if (instructions.length > MAX_LENGTH) {
      return NextResponse.json(
        { error: `Instructions too long (max ${MAX_LENGTH} characters)` },
        { status: 400 }
      );
    }

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
