import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createConversationSchema } from "@/lib/validations/conversation";
import { createConversation, listConversations } from "@/services/conversation";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.activeWorkspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify membership
    const membership = await db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: session.user.activeWorkspaceId,
          userId: session.user.id,
        },
      },
    });
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const parsed = createConversationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const conversation = await createConversation({
      workspaceId: session.user.activeWorkspaceId,
      createdById: session.user.id,
      title: parsed.data.title,
    });

    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    console.error("Create conversation error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.activeWorkspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const conversations = await listConversations({
      workspaceId: session.user.activeWorkspaceId,
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("List conversations error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
