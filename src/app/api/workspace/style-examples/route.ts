import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStorageProvider } from "@/services/storage";
import { rateLimitUser } from "@/lib/rate-limit";
import { checkStorageLimit, storageIncrementQuery } from "@/lib/billing";
import { logOrphanFile } from "@/lib/orphan-files";

const ALLOWED_MIME_BASES = ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/x-m4a", "audio/webm", "audio/ogg"];
const MAX_FILE_SIZE = 100 * 1024 * 1024;

/** GET — list all style examples for workspace */
export async function GET() {
  const session = await auth();
  if (!session?.user?.activeWorkspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const examples = await db.styleExample.findMany({
    where: { workspaceId: session.user.activeWorkspaceId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      sentEmailSubject: true,
      status: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ examples });
}

/** POST — upload a new style example (audio + sent email) */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.activeWorkspaceId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = session.user.activeWorkspaceId;

    const limited = await rateLimitUser(session.user.id, "styleUpload", {
      workspaceId,
      userId: session.user.id,
      action: "ratelimit.style_upload",
    });
    if (limited) return limited;

    // Check role
    const membership = await db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
    });
    if (!membership || membership.role === "MEMBER") {
      return NextResponse.json({ error: "Only owners/admins can manage style examples" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string | null;
    const sentEmailSubject = formData.get("sentEmailSubject") as string | null;
    const sentEmailBody = formData.get("sentEmailBody") as string | null;
    const notes = formData.get("notes") as string | null;

    if (!file || !title?.trim() || !sentEmailSubject?.trim() || !sentEmailBody?.trim()) {
      return NextResponse.json(
        { error: "Missing required fields: file, title, sentEmailSubject, sentEmailBody" },
        { status: 400 }
      );
    }

    // Validate file
    const mimeType = file.type.split(";")[0].trim().toLowerCase();
    if (!ALLOWED_MIME_BASES.includes(mimeType)) {
      return NextResponse.json(
        { error: "Invalid audio file type" },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large (max 100MB)" },
        { status: 400 }
      );
    }

    // SR-3: refuse if this upload would push the workspace over its storage quota.
    // Do this BEFORE saveFile so we never write bytes we're going to bill for but
    // then have to delete.
    const storageError = await checkStorageLimit(workspaceId, file.size);
    if (storageError) {
      return NextResponse.json({ error: storageError }, { status: 402 });
    }

    // Save audio file
    const storage = getStorageProvider();
    const buffer = Buffer.from(await file.arrayBuffer());
    const { storagePath, sizeBytes } = await storage.saveFile(buffer, {
      workspaceId,
      conversationId: "style-examples",
      originalName: file.name,
      mimeType,
    });

    if (!Number.isSafeInteger(sizeBytes)) {
      // Compensate and fail loud — never silently miscount.
      await storage.deleteFile(storagePath).catch(() => {});
      return NextResponse.json(
        { error: "Storage returned an invalid file size" },
        { status: 500 }
      );
    }

    // SR-3: atomic DB write + storage usage increment. On tx failure,
    // compensate by deleting the already-saved file (mirrors
    // uploadAudioAsset in services/conversation/index.ts). If the delete
    // also fails the file is logged for operator reconciliation.
    try {
      const [example] = await db.$transaction([
        db.styleExample.create({
          data: {
            workspaceId,
            title: title.trim(),
            audioStoragePath: storagePath,
            audioMimeType: mimeType,
            audioSizeBytes: BigInt(sizeBytes),
            sentEmailSubject: sentEmailSubject.trim(),
            sentEmailBody: sentEmailBody.trim(),
            notes: notes?.trim() || null,
            createdById: session.user.id,
          },
        }),
        storageIncrementQuery(workspaceId, sizeBytes),
      ]);

      return NextResponse.json({
        example: {
          id: example.id,
          title: example.title,
          status: example.status,
        },
      }, { status: 201 });
    } catch (dbErr) {
      try {
        await storage.deleteFile(storagePath);
      } catch (delErr) {
        await logOrphanFile({
          storagePath,
          workspaceId,
          reason: "style-example-db-tx-failed",
          error: delErr,
        });
      }
      throw dbErr;
    }
  } catch (error) {
    console.error("Create style example error:", error);
    return NextResponse.json({ error: "Failed to create style example" }, { status: 500 });
  }
}
