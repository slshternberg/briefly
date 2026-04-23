import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  generateStyleProfile,
  getActiveStyleProfile,
  getActiveStyleProfileStamp,
} from "@/services/style";
import { rateLimitUser } from "@/lib/rate-limit";

/** GET — get the active style profile for workspace */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.activeWorkspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = session.user.activeWorkspaceId;

    const [profile, profileStamp, exampleCount] = await Promise.all([
      getActiveStyleProfile(workspaceId),
      getActiveStyleProfileStamp(workspaceId),
      db.styleExample.count({
        where: { workspaceId, status: "COMPLETED" },
      }),
    ]);

    return NextResponse.json({ profile, profileStamp, exampleCount });
  } catch (error) {
    console.error("Get style profile error:", error);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}

/** POST — kick off background generation of a new style profile.
 *  Client polls GET and watches `profileStamp` for a change. */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.activeWorkspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = session.user.activeWorkspaceId;

    const limited = await rateLimitUser(session.user.id, "styleProfile", {
      workspaceId,
      userId: session.user.id,
      action: "ratelimit.style_profile",
    });
    if (limited) return limited;

    // Check role
    const membership = await db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
    });
    if (!membership || membership.role === "MEMBER") {
      return NextResponse.json({ error: "Only owners/admins can generate profiles" }, { status: 403 });
    }

    // Fail fast if there's nothing to work with — keeps the UI honest.
    const completedCount = await db.styleExample.count({
      where: { workspaceId, status: "COMPLETED" },
    });
    if (completedCount === 0) {
      return NextResponse.json(
        { error: "No completed style examples found. Process at least one example first." },
        { status: 400 }
      );
    }

    // Fire-and-forget: the worker activates a new StyleProfile row on success.
    generateStyleProfile(workspaceId).catch((err) => {
      console.error("Generate style profile error:", err);
    });

    return NextResponse.json({ status: "GENERATING" });
  } catch (error) {
    console.error("Generate style profile error:", error);
    const message = error instanceof Error ? error.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
