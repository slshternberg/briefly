import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildLanguageCookieHeader } from "@/lib/language";
import {
  updateLanguageSchema,
  SUPPORTED_WORKSPACE_LANGUAGES,
} from "@/lib/validations/workspace";

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
    const parsed = updateLanguageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Unsupported language",
          supported: SUPPORTED_WORKSPACE_LANGUAGES,
        },
        { status: 400 }
      );
    }
    const { language } = parsed.data;

    // Only OWNER or ADMIN can change workspace settings
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
      data: { defaultLanguage: language },
      select: { id: true, defaultLanguage: true },
    });

    const response = NextResponse.json(workspace);
    response.headers.set("Set-Cookie", buildLanguageCookieHeader(language));
    return response;
  } catch (error) {
    console.error("Update language error:", error);
    return NextResponse.json(
      { error: "Failed to update language" },
      { status: 500 }
    );
  }
}
