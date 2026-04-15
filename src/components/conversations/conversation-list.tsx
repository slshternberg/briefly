"use client";

import { useState } from "react";
import Link from "next/link";
import { useLabels } from "@/lib/client-language";
import { getClientLanguage } from "@/lib/client-language";
import { isRTL } from "@/lib/ui-labels";

interface ConversationItem {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  createdByName: string | null;
  hasAudio: boolean;
  sourceType: string | null;
  durationSeconds: number | null;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  UPLOADED: "bg-blue-500/10 text-blue-400",
  PROCESSING: "bg-yellow-500/10 text-yellow-400",
  COMPLETED: "bg-green-500/10 text-green-400",
  FAILED: "bg-destructive/10 text-destructive",
};

export function ConversationList({ conversations }: { conversations: ConversationItem[] }) {
  const labels = useLabels();
  const lang = getClientLanguage();
  const rtl = isRTL(lang);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const STATUS_LABELS: Record<string, string> = {
    DRAFT: labels.draft,
    UPLOADED: labels.uploaded,
    PROCESSING: labels.processing,
    COMPLETED: labels.completed,
    FAILED: labels.failed,
  };

  const filterOptions = [
    { value: "all", label: labels.all },
    { value: "COMPLETED", label: labels.completed },
    { value: "UPLOADED", label: labels.uploaded },
    { value: "DRAFT", label: labels.draft },
    { value: "PROCESSING", label: labels.processing },
    { value: "FAILED", label: labels.failed },
  ];

  const filtered = conversations.filter((c) => {
    const matchesSearch = !search || c.title.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || c.status === filter;
    return matchesSearch && matchesFilter;
  });

  const dateLocale = rtl ? "he-IL" : "en-US";

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <div className="flex-1 relative">
          <svg className={`absolute ${rtl ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={labels.searchConversations}
            dir="auto"
            className={`w-full rounded-lg border border-border bg-background ${rtl ? "pr-9 pl-3" : "pl-9 pr-3"} py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition`}
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
        >
          {filterOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          {labels.noSearchResults}
        </div>
      ) : (
        <div className="rounded-xl border border-border divide-y divide-border">
          {filtered.map((conv) => {
            const statusColor = STATUS_COLORS[conv.status] || STATUS_COLORS.DRAFT;
            const statusLabel = STATUS_LABELS[conv.status] || conv.status;

            return (
              <Link
                key={conv.id}
                href={`/dashboard/conversations/${conv.id}`}
                className="flex items-center justify-between p-4 hover:bg-card/80 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    {conv.hasAudio ? (
                      conv.sourceType === "RECORDED" ? (
                        <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                        </svg>
                      )
                    ) : (
                      <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{conv.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(conv.createdAt).toLocaleDateString(dateLocale, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {" "}
                      {new Date(conv.createdAt).toLocaleTimeString(dateLocale, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {conv.durationSeconds ? ` · ${formatDuration(conv.durationSeconds)}` : ""}
                      {conv.createdByName ? ` · ${conv.createdByName}` : ""}
                    </div>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusColor}`}>
                  {statusLabel}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
