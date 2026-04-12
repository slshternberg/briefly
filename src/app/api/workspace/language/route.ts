import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildLanguageCookieHeader } from "@/lib/language";

const SUPPORTED_LANGUAGES = ["Hebrew", "English", "Yiddish"];

export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.activeWorkspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { language } = body;

    if (!language || !SUPPORTED_LANGUAGES.includes(language)) {
      return NextResponse.json(
        { error: "Unsupported language", supported: SUPPORTED_LANGUAGES },
        { status: 400 }
      );
    }

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
