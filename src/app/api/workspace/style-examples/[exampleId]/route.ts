import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { processStyleExample } from "@/services/style";
import { getStorageProvider } from "@/services/storage";
import { decrementStorageUsage } from "@/lib/billing";
import { rateLimitUser } from "@/lib/rate-limit";

/** POST — kick off style-example analysis (runs in background).
 *  Client polls GET /api/workspace/style-examples until the row leaves PROCESSING. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ exampleId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.activeWorkspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { exampleId } = await params;
    const workspaceId = session.user.activeWorkspaceId;

    const limited = await rateLimitUser(session.user.id, "styleProcess", {
      workspaceId,
      userId: session.user.id,
      action: "ratelimit.style_process",
    });
    if (limited) return limited;

    // Role check (SR-2): item-level process must match the list-POST policy —
    // only OWNER/ADMIN may kick off a Gemini analysis. Read from DB, never
    // from the JWT (see SR-1 in docs/security/route-audit.md).
    const membership = await db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
      select: { role: true },
    });
    if (!membership || membership.role === "MEMBER") {
      return NextResponse.json(
        { error: "Only owners/admins can manage style examples" },
        { status: 403 }
      );
    }

    // Atomically flip to PROCESSING + verify ownership in one query.
    const updated = await db.styleExample.updateMany({
      where: { id: exampleId, workspaceId },
      data: { status: "PROCESSING" },
    });
    if (updated.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Fire-and-forget: service handles COMPLETED/FAILED transitions internally.
    processStyleExample(exampleId, workspaceId).catch((err) => {
      console.error("Process style example error:", err);
    });

    return NextResponse.json({ status: "PROCESSING" });
  } catch (error) {
    console.error("Process style example error:", error);
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}

/** DELETE — remove a style example */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ exampleId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.activeWorkspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { exampleId } = await params;
    const workspaceId = session.user.activeWorkspaceId;

    // Role check (SR-2): only OWNER/ADMIN may delete style examples.
    const membership = await db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
      select: { role: true },
    });
    if (!membership || membership.role === "MEMBER") {
      return NextResponse.json(
        { error: "Only owners/admins can manage style examples" },
        { status: 403 }
      );
    }

    const example = await db.styleExample.findFirst({
      where: { id: exampleId, workspaceId },
      select: { id: true, audioStoragePath: true, audioSizeBytes: true },
    });
    if (!example) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Delete audio file from storage before removing the DB record
    const storage = getStorageProvider();
    await storage.deleteFile(example.audioStoragePath);

    await db.styleExample.delete({ where: { id: exampleId } });

    // Decrement storage quota — fire-and-forget
    decrementStorageUsage(workspaceId, Number(example.audioSizeBytes)).catch(
      (err) => console.error("Storage decrement failed:", err)
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete style example error:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
