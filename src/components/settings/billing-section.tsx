"use client";

import { useState } from "react";

interface Plan {
  id: string;
  name: string;
  slug: string;
  priceMonthly: number;
  maxConversationsPerMonth: number;
  maxAudioMinutesPerMonth: number;
  maxAiQueriesPerMonth: number;
  maxMembersPerWorkspace: number;
}

interface Subscription {
  status: string;
  plan: Plan;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | string | null;
}

interface Usage {
  conversationCount: number;
  audioSecondsUsed: number;
  aiQueryCount: number;
}

interface BillingSectionProps {
  subscription: Subscription | null;
  usage: Usage | null;
  availablePlans: Plan[];
  canManage: boolean;
}

export function BillingSection({
  subscription,
  usage,
  availablePlans,
  canManage,
}: BillingSectionProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const isActive = subscription?.status === "ACTIVE" || subscription?.status === "TRIALING";

  async function handleUpgrade(planSlug: string) {
    setError("");
    setLoading(planSlug);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planSlug }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error || "משהו השתבש");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("משהו השתבש. נסי שנית.");
    } finally {
      setLoading(null);
    }
  }

  async function handlePortal() {
    setError("");
    setLoading("portal");
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error || "משהו השתבש");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("משהו השתבש");
    } finally {
      setLoading(null);
    }
  }

  const conversationLimit = subscription?.plan.maxConversationsPerMonth ?? 10;
  const audioMinutesLimit = subscription?.plan.maxAudioMinutesPerMonth ?? 120;
  const aiQueryLimit = subscription?.plan.maxAiQueriesPerMonth ?? 50;

  return (
    <div className="space-y-4">
      {/* Current plan */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">
            {isActive ? subscription!.plan.name : "חינמי"}
          </div>
          {subscription?.cancelAtPeriodEnd && subscription.currentPeriodEnd && (
            <div className="text-xs text-destructive mt-0.5">
              יבוטל ב-{new Date(subscription.currentPeriodEnd).toLocaleDateString("he-IL")}
            </div>
          )}
          {subscription?.status === "PAST_DUE" && (
            <div className="text-xs text-destructive mt-0.5">תשלום נכשל</div>
          )}
        </div>

        {canManage && (
          isActive ? (
            <button
              onClick={handlePortal}
              disabled={loading === "portal"}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-muted/40 transition disabled:opacity-50"
            >
              {loading === "portal" ? "טוען..." : "ניהול חיוב"}
            </button>
          ) : null
        )}
      </div>

      {/* Usage */}
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="rounded-lg border border-border bg-background p-3">
          <div className="text-muted-foreground mb-1">שיחות</div>
          <div className="font-semibold text-sm">{usage?.conversationCount ?? 0} / {conversationLimit}</div>
          <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, ((usage?.conversationCount ?? 0) / conversationLimit) * 100)}%` }}
            />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-background p-3">
          <div className="text-muted-foreground mb-1">דקות אודיו</div>
          <div className="font-semibold text-sm">
            {Math.round((usage?.audioSecondsUsed ?? 0) / 60)} / {audioMinutesLimit}
          </div>
          <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, (((usage?.audioSecondsUsed ?? 0) / 60) / audioMinutesLimit) * 100)}%` }}
            />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-background p-3">
          <div className="text-muted-foreground mb-1">שאילתות AI</div>
          <div className="font-semibold text-sm">{usage?.aiQueryCount ?? 0} / {aiQueryLimit}</div>
          <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, ((usage?.aiQueryCount ?? 0) / aiQueryLimit) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Available plans */}
      {!isActive && canManage && availablePlans.length > 0 && (
        <div className="pt-2 border-t border-border space-y-2">
          <p className="text-xs text-muted-foreground font-medium">שדרוג תוכנית:</p>
          {availablePlans.map((plan) => (
            <div key={plan.id} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <div className="text-sm font-medium">{plan.name}</div>
                <div className="text-xs text-muted-foreground">
                  {plan.maxConversationsPerMonth} שיחות · {plan.maxAudioMinutesPerMonth} דקות · {plan.maxMembersPerWorkspace} חברים
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">${plan.priceMonthly}/חודש</span>
                <button
                  onClick={() => handleUpgrade(plan.slug)}
                  disabled={!!loading}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold brand-gradient text-white glow-orange transition-all hover:scale-[1.01] disabled:opacity-50"
                >
                  {loading === plan.slug ? "טוען..." : "שדרגי"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isActive && availablePlans.length === 0 && (
        <p className="text-xs text-muted-foreground">
          שדרוג תוכנית יהיה זמין בקרוב.
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
