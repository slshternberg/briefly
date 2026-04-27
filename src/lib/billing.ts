import { db } from "@/lib/db";

// Free-tier fallback: used when no active subscription exists.
//
// Soft-launch posture: limits are intentionally set very high so the
// pre-billing audience never hits a quota wall while we're still
// validating the product. The Stripe / Subscription / UsageRecord
// infrastructure stays fully wired (routes, webhook, settings UI) — when
// real billing is ready, lower these numbers to the real free tier and
// no other code change is required.
const FREE_LIMITS = {
  maxConversationsPerMonth: 100000,
  maxAudioMinutesPerMonth: 1000000,
  maxAiQueriesPerMonth: 100000,
  maxStorageMb: 100000,
  maxMembersPerWorkspace: 100,
};

function periodStart(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function periodEnd(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

async function getLimits(workspaceId: string) {
  const sub = await db.subscription.findFirst({
    where: {
      workspaceId,
      status: { in: ["ACTIVE", "TRIALING"] },
    },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });
  return sub?.plan ?? FREE_LIMITS;
}

async function getUsage(workspaceId: string) {
  const start = periodStart();
  return db.usageRecord.findFirst({
    where: { workspaceId, periodStart: start },
  });
}

export async function getPlanLimits(workspaceId: string) {
  return getLimits(workspaceId);
}

export async function checkConversationLimit(workspaceId: string): Promise<string | null> {
  const [limits, usage] = await Promise.all([getLimits(workspaceId), getUsage(workspaceId)]);
  const count = usage?.conversationCount ?? 0;
  if (count >= limits.maxConversationsPerMonth) {
    return `הגעת למגבלת השיחות החודשית (${limits.maxConversationsPerMonth}). שדרגי את התוכנית.`;
  }
  return null;
}

export async function checkAudioMinutesLimit(workspaceId: string, newAudioSeconds: number): Promise<string | null> {
  const [limits, usage] = await Promise.all([getLimits(workspaceId), getUsage(workspaceId)]);
  const usedSeconds = usage?.audioSecondsUsed ?? 0;
  const limitSeconds = limits.maxAudioMinutesPerMonth * 60;
  if (usedSeconds + newAudioSeconds > limitSeconds) {
    const usedMinutes = Math.round(usedSeconds / 60);
    const limitMinutes = limits.maxAudioMinutesPerMonth;
    return `הגעת למגבלת דקות האודיו החודשית (${usedMinutes}/${limitMinutes} דקות). שדרגי את התוכנית.`;
  }
  return null;
}

export async function checkAiQueryLimit(workspaceId: string): Promise<string | null> {
  const [limits, usage] = await Promise.all([getLimits(workspaceId), getUsage(workspaceId)]);
  const count = usage?.aiQueryCount ?? 0;
  if (count >= limits.maxAiQueriesPerMonth) {
    return `הגעת למגבלת שאילתות ה-AI החודשית (${limits.maxAiQueriesPerMonth}). שדרגי את התוכנית.`;
  }
  return null;
}

export async function checkStorageLimit(workspaceId: string, newFileSizeBytes: number): Promise<string | null> {
  const [limits, usage] = await Promise.all([getLimits(workspaceId), getUsage(workspaceId)]);
  const usedBytes = Number(usage?.storageBytesUsed ?? 0);
  const limitBytes = limits.maxStorageMb * 1024 * 1024;
  if (usedBytes + newFileSizeBytes > limitBytes) {
    const usedMb = Math.round(usedBytes / (1024 * 1024));
    return `הגעת למגבלת האחסון החודשית (${usedMb}/${limits.maxStorageMb} MB). שדרגי את התוכנית.`;
  }
  return null;
}

export async function checkMembersLimit(workspaceId: string): Promise<string | null> {
  const [limits, memberCount] = await Promise.all([
    getLimits(workspaceId),
    db.workspaceMember.count({ where: { workspaceId } }),
  ]);
  if (memberCount >= limits.maxMembersPerWorkspace) {
    return `הגעת למגבלת החברים בסביבת העבודה (${limits.maxMembersPerWorkspace}). שדרגי את התוכנית.`;
  }
  return null;
}

export async function incrementConversationUsage(workspaceId: string, audioSeconds: number) {
  const start = periodStart();
  const end = periodEnd();
  await db.usageRecord.upsert({
    where: { workspaceId_periodStart: { workspaceId, periodStart: start } },
    create: {
      workspaceId,
      periodStart: start,
      periodEnd: end,
      conversationCount: 1,
      audioSecondsUsed: audioSeconds,
    },
    update: {
      conversationCount: { increment: 1 },
      audioSecondsUsed: { increment: audioSeconds },
    },
  });
}

export async function decrementStorageUsage(workspaceId: string, fileSizeBytes: number) {
  if (fileSizeBytes <= 0) return;
  const start = periodStart();
  // GREATEST(0, ...) prevents storageBytesUsed from going negative on double-deletes.
  await db.$executeRaw`
    UPDATE "usage_records"
    SET "storageBytesUsed" = GREATEST(0, "storageBytesUsed" - ${fileSizeBytes}::bigint)
    WHERE "workspaceId" = ${workspaceId}::uuid
      AND "periodStart" = ${start}
  `;
}

/**
 * Standalone storage increment — runs its own upsert and awaits.
 *
 * Prefer `storageIncrementQuery()` when you need the operation inside a
 * `db.$transaction([...])` (e.g., atomic upload flow) — the function below
 * cannot join a transaction because it's already awaited.
 */
export async function incrementStorageUsage(workspaceId: string, fileSizeBytes: number) {
  await storageIncrementQuery(workspaceId, fileSizeBytes);
}

/**
 * Returns an unawaited Prisma upsert for `usage_records.storageBytesUsed`.
 * Designed to be passed into `db.$transaction([...])` so a file upload's
 * storage counter update is atomic with the asset/conversation writes.
 */
export function storageIncrementQuery(workspaceId: string, fileSizeBytes: number) {
  const start = periodStart();
  const end = periodEnd();
  return db.usageRecord.upsert({
    where: { workspaceId_periodStart: { workspaceId, periodStart: start } },
    create: {
      workspaceId,
      periodStart: start,
      periodEnd: end,
      storageBytesUsed: fileSizeBytes,
    },
    update: {
      storageBytesUsed: { increment: fileSizeBytes },
    },
  });
}

export async function incrementAiQueryUsage(workspaceId: string) {
  const start = periodStart();
  const end = periodEnd();
  await db.usageRecord.upsert({
    where: { workspaceId_periodStart: { workspaceId, periodStart: start } },
    create: {
      workspaceId,
      periodStart: start,
      periodEnd: end,
      aiQueryCount: 1,
    },
    update: {
      aiQueryCount: { increment: 1 },
    },
  });
}
