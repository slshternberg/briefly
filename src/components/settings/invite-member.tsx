"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Member {
  id: string;
  role: string;
  userId: string;
  user: { name: string | null; email: string };
}

export function InviteMember({
  members,
  canInvite,
  currentUserId,
}: {
  members: Member[];
  canInvite: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSent(false); setLoading(true);

    try {
      const res = await fetch("/api/workspaces/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error || "משהו השתבש");
        return;
      }
      setSent(true);
      setEmail("");
    } catch {
      setError("משהו השתבש. נסי שנית.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(memberId: string) {
    setRemoving(memberId);
    setError("");
    try {
      const res = await fetch(`/api/workspaces/members/${memberId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error || "לא ניתן להסיר את החבר");
        return;
      }
      router.refresh();
    } catch {
      setError("משהו השתבש. נסי שנית.");
    } finally {
      setRemoving(null);
    }
  }

  const ROLE_LABELS: Record<string, string> = {
    OWNER: "בעלים",
    ADMIN: "מנהל",
    MEMBER: "חבר",
  };

  return (
    <div className="space-y-3">
      <div className="divide-y divide-border">
        {members.map((m) => {
          const isOwner = m.role === "OWNER";
          const isSelf = m.userId === currentUserId;
          const canRemove = canInvite && !isOwner && !isSelf;

          return (
            <div key={m.id} className="flex items-center justify-between py-2.5 text-sm">
              <div className="min-w-0">
                <span className="font-medium truncate">{m.user.name || m.user.email}</span>
                {m.user.name && (
                  <span className="text-muted-foreground ml-2 text-xs">{m.user.email}</span>
                )}
                {isSelf && <span className="text-xs text-muted-foreground ml-1">(אתה)</span>}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-muted-foreground">{ROLE_LABELS[m.role] ?? m.role}</span>
                {canRemove && (
                  <button
                    onClick={() => handleRemove(m.id)}
                    disabled={removing === m.id}
                    className="text-xs text-destructive hover:text-destructive/80 transition disabled:opacity-50"
                  >
                    {removing === m.id ? "מסיר..." : "הסר"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {canInvite && (
        <form onSubmit={handleInvite} className="flex gap-2 pt-2 border-t border-border">
          <input
            type="email"
            required
            dir="ltr"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-semibold brand-gradient text-white glow-orange transition-all hover:scale-[1.01] disabled:opacity-50"
          >
            {loading ? "שולח..." : "הזמנה"}
          </button>
        </form>
      )}

      {sent && <p className="text-sm text-green-400">ההזמנה נשלחה בהצלחה!</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
