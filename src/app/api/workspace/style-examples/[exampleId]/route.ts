import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { processStyleExample } from "@/services/style";
import { getStorageProvider } from "@/services/storage";
import { decrementStorageUsage } from "@/lib/billing";

/** POST — process a style example (analyze the pair with Gemini) */
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

    const result = await processStyleExample(exampleId, workspaceId);

    return NextResponse.json({ status: "COMPLETED", extractedProfile: result });
  } catch (error) {
    console.error("Process style example error:", error);
    const raw = error instanceof Error ? error.message : String(error);

    let errorCode = "processing_failed";
    if (raw.includes("503") || raw.includes("UNAVAILABLE") || raw.includes("high demand")) {
      errorCode = "overloaded";
    } else if (raw.includes("429") || raw.includes("RESOURCE_EXHAUSTED") || raw.includes("quota")) {
      errorCode = "quota_exceeded";
    }

    return NextResponse.json({ error: errorCode }, { status: 500 });
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
