import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStorageProvider } from "@/services/storage";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.activeWorkspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId } = await params;
    const workspaceId = session.user.activeWorkspaceId;

    const asset = await db.conversationAsset.findFirst({
      where: {
        conversationId,
        workspaceId,
        uploadStatus: "COMPLETED",
        conversation: { deletedAt: null },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!asset) {
      return NextResponse.json({ error: "Audio not found" }, { status: 404 });
    }

    const storage = getStorageProvider();
    const buffer = await storage.getFileBuffer(asset.storagePath);
    const totalSize = buffer.length;
    const shouldDownload = new URL(req.url).searchParams.get("download") === "1";
    const encodedName = encodeURIComponent(asset.originalName || "recording")
      .replace(/['()]/g, escape)
      .replace(/\*/g, "%2A");
    const disposition = `attachment; filename="recording"; filename*=UTF-8''${encodedName}`;

    const rangeHeader = req.headers.get("range");

    if (rangeHeader && !shouldDownload) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? Math.min(parseInt(match[2], 10), totalSize - 1) : totalSize - 1;
        const chunkSize = end - start + 1;

        return new Response(new Uint8Array(buffer.subarray(start, end + 1)), {
          status: 206,
          headers: {
            "Content-Type": asset.mimeType,
            "Content-Range": `bytes ${start}-${end}/${totalSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": chunkSize.toString(),
            "Cache-Control": "private, max-age=3600",
          },
        });
      }
    }

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": shouldDownload ? "application/octet-stream" : asset.mimeType,
        "Content-Length": totalSize.toString(),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
        ...(shouldDownload ? { "Content-Disposition": disposition } : {}),
      },
    });
  } catch (error) {
    console.error("Audio serve error:", error);
    return NextResponse.json({ error: "Failed to load audio" }, { status: 500 });
  }
}
