import { db } from "@/lib/db";

// Free tier limits applied when no active subscription exists
const FREE_LIMITS = {
  maxConversationsPerMonth: 10,
  maxAudioMinutesPerMonth: 120,
  maxAiQueriesPerMonth: 50,
  maxStorageMb: 500,
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

export async function checkConversationLimit(workspaceId: string): Promise<string | null> {
  const [limits, usage] = await Promise.all([getLimits(workspaceId), getUsage(workspaceId)]);
  const count = usage?.conversationCount ?? 0;
  if (count >= limits.maxConversationsPerMonth) {
    return `הגעת למגבלת השיחות החודשית (${limits.maxConversationsPerMonth}). שדרגי את התוכנית.`;
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
