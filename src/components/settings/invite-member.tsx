"use client";

import { useState } from "react";

interface Member {
  id: string;
  role: string;
  user: { name: string | null; email: string };
}

export function InviteMember({ members, canInvite }: { members: Member[]; canInvite: boolean }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
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

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {members.map((m) => (
          <div key={m.id} className="flex items-center justify-between text-sm py-1.5">
            <div>
              <span className="font-medium">{m.user.name || m.user.email}</span>
              {m.user.name && (
                <span className="text-muted-foreground ml-2 text-xs">{m.user.email}</span>
              )}
            </div>
            <span className="text-xs text-muted-foreground capitalize">{m.role.toLowerCase()}</span>
          </div>
        ))}
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
