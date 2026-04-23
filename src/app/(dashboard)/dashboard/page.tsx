import { requireAuth } from "@/lib/auth-guard";
import { listConversations } from "@/services/conversation";
import Link from "next/link";
import { ConversationList } from "@/components/conversations/conversation-list";
import { getLabels } from "@/lib/ui-labels";
import { db } from "@/lib/db";

export default async function DashboardPage() {
  const { workspace } = await requireAuth();

  const lang = workspace.defaultLanguage || "English";
  const labels = getLabels(lang);

  const periodStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [conversations, usage, subscription] = await Promise.all([
    listConversations({ workspaceId: workspace.id }),
    db.usageRecord.findFirst({
      where: { workspaceId: workspace.id, periodStart },
    }),
    db.subscription.findFirst({
      where: { workspaceId: workspace.id, status: { in: ["ACTIVE", "TRIALING"] } },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const planName = subscription?.plan.name ?? labels.freePlan;
  const convLimit = subscription?.plan.maxConversationsPerMonth ?? 10;
  const audioMinLimit = subscription?.plan.maxAudioMinutesPerMonth ?? 120;
  const aiLimit = subscription?.plan.maxAiQueriesPerMonth ?? 50;

  const serialized = conversations.map((c) => ({
    id: c.id,
    title: c.title,
    status: c.status,
    createdAt: c.createdAt.toISOString(),
    createdByName: c.createdBy.name,
    hasAudio: c.assets.length > 0,
    sourceType: c.assets[0]?.sourceType || null,
    durationSeconds: c.assets[0]?.durationSeconds || null,
  }));

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">{labels.conversations}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {conversations.length} {labels.conversationCount} {labels.inWorkspace}{workspace.name}
          </p>
        </div>
        <Link
          href="/dashboard/conversations/new"
          className="px-5 py-2 rounded-lg text-sm font-semibold brand-gradient text-white glow-orange transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          {labels.newConversation}
        </Link>
      </div>

      {/* Empty state */}
      {conversations.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/50 p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold mb-2">{labels.noConversationsYet}</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
            {labels.noConversationsDesc}
          </p>
          <Link
            href="/dashboard/conversations/new"
            className="inline-block px-6 py-2.5 rounded-lg text-sm font-semibold brand-gradient text-white glow-orange transition-all hover:scale-[1.02]"
          >
            {labels.createFirstConversation}
          </Link>
        </div>
      )}

      {/* Conversation list with search/filter (Fix #7) */}
      {conversations.length > 0 && (
        <ConversationList conversations={serialized} />
      )}

      {/* Plan card */}
      <div className="mt-8 rounded-xl border border-border bg-card/60 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold">{planName}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {workspace._count.members} {labels.memberCount}
            </p>
          </div>
          {!subscription && (
            <Link
              href="/dashboard/settings"
              className="px-4 py-2 rounded-lg text-sm font-semibold brand-gradient text-white glow-orange transition-all hover:scale-[1.02]"
            >
              {labels.upgradeToPro}
            </Link>
          )}
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">{labels.conversationsUsage}</div>
            <div className="font-medium mt-0.5">{usage?.conversationCount ?? 0} / {convLimit}</div>
          </div>
          <div>
            <div className="text-muted-foreground">{labels.audioMinutes}</div>
            <div className="font-medium mt-0.5">{Math.round((usage?.audioSecondsUsed ?? 0) / 60)} / {audioMinLimit}</div>
          </div>
          <div>
            <div className="text-muted-foreground">{labels.aiQueries}</div>
            <div className="font-medium mt-0.5">{usage?.aiQueryCount ?? 0} / {aiLimit}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
