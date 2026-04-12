import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  isAllowedMimeType,
  isAllowedFileSize,
  uploadAudioAsset,
} from "@/services/conversation";
import { AssetSourceType } from "@prisma/client";

export async function POST(
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

    // Verify conversation belongs to this workspace
    const conversation = await db.conversation.findFirst({
      where: { id: conversationId, workspaceId, deletedAt: null },
    });
    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const sourceType = (formData.get("sourceType") as string) || "UPLOADED";

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Normalize MIME: strip codec params, fallback to extension-based detection
    let mimeType = file.type.split(";")[0].trim().toLowerCase();
    if (!mimeType || mimeType === "application/octet-stream") {
      const ext = file.name.split(".").pop()?.toLowerCase();
      const extMap: Record<string, string> = {
        mp3: "audio/mpeg",
        wav: "audio/wav",
        m4a: "audio/mp4",
        webm: "audio/webm",
        ogg: "audio/ogg",
      };
      mimeType = (ext && extMap[ext]) || "";
    }

    if (!isAllowedMimeType(mimeType)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: mp3, wav, m4a, webm, ogg" },
        { status: 400 }
      );
    }

    if (!isAllowedFileSize(file.size)) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 100MB" },
        { status: 400 }
      );
    }

    // Validate sourceType
    const validSourceType: AssetSourceType =
      sourceType === "RECORDED" ? "RECORDED" : "UPLOADED";

    const buffer = Buffer.from(await file.arrayBuffer());

    const asset = await uploadAudioAsset({
      workspaceId,
      conversationId,
      sourceType: validSourceType,
      originalName: file.name,
      mimeType,
      buffer,
    });

    return NextResponse.json(
      {
        asset: {
          id: asset.id,
          originalName: asset.originalName,
          mimeType: asset.mimeType,
          sizeBytes: asset.sizeBytes.toString(),
          uploadStatus: asset.uploadStatus,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
