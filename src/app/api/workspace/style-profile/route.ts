import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateStyleProfile, getActiveStyleProfile } from "@/services/style";

/** GET — get the active style profile for workspace */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.activeWorkspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getActiveStyleProfile(session.user.activeWorkspaceId);

    // Also get example count
    const exampleCount = await db.styleExample.count({
      where: { workspaceId: session.user.activeWorkspaceId, status: "COMPLETED" },
    });

    return NextResponse.json({ profile, exampleCount });
  } catch (error) {
    console.error("Get style profile error:", error);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}

/** POST — generate a new style profile from completed examples */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.activeWorkspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = session.user.activeWorkspaceId;

    // Check role
    const membership = await db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
    });
    if (!membership || membership.role === "MEMBER") {
      return NextResponse.json({ error: "Only owners/admins can generate profiles" }, { status: 403 });
    }

    const profile = await generateStyleProfile(workspaceId);

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Generate style profile error:", error);
    const message = error instanceof Error ? error.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
