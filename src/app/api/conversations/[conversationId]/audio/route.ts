import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStorageProvider } from "@/services/storage";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.activeWorkspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId } = await params;
    const workspaceId = session.user.activeWorkspaceId;

    // Get the latest asset for this conversation, scoped to workspace
    const asset = await db.conversationAsset.findFirst({
      where: {
        conversationId,
        workspaceId,
        uploadStatus: "COMPLETED",
      },
      orderBy: { createdAt: "desc" },
    });

    if (!asset) {
      return NextResponse.json(
        { error: "Audio not found" },
        { status: 404 }
      );
    }

    const storage = getStorageProvider();
    const buffer = await storage.getFileBuffer(asset.storagePath);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": asset.mimeType,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Audio serve error:", error);
    return NextResponse.json(
      { error: "Failed to load audio" },
      { status: 500 }
    );
  }
}
