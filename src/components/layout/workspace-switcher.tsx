"use client";

import { useState, useEffect, useRef } from "react";
import { SessionProvider, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Workspace {
  id: string;
  name: string;
  role: string;
  isCurrent: boolean;
}

// Outer: provides the session context that the inner component reads.
// The layout renders this as a server component, so we can't rely on a
// SessionProvider higher up the tree.
export function WorkspaceSwitcher({ currentName }: { currentName: string }) {
  return (
    <SessionProvider>
      <WorkspaceSwitcherInner currentName={currentName} />
    </SessionProvider>
  );
}

function WorkspaceSwitcherInner({ currentName }: { currentName: string }) {
  const { update } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleOpen() {
    setOpen((v) => !v);
    if (workspaces.length === 0) {
      const res = await fetch("/api/workspaces");
      if (res.ok) {
        const data = await res.json() as { workspaces: Workspace[] };
        setWorkspaces(data.workspaces);
      }
    }
  }

  async function switchWorkspace(ws: Workspace) {
    if (ws.isCurrent) { setOpen(false); return; }
    setLoading(true);
    await update({ activeWorkspaceId: ws.id, activeWorkspaceRole: ws.role });
    router.refresh();
    setOpen(false);
    setLoading(false);
  }

  const others = workspaces.filter((w) => !w.isCurrent);
  if (others.length === 0 && workspaces.length > 0) {
    return (
      <div className="text-xs text-muted-foreground mt-2 truncate px-0.5">
        {currentName}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative mt-2">
      <button
        onClick={handleOpen}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition truncate max-w-full"
        title={currentName}
      >
        <span className="truncate">{currentName}</span>
        <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 w-48 rounded-lg border border-border bg-card shadow-lg py-1">
          {workspaces.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">טוען...</div>
          ) : (
            workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => switchWorkspace(ws)}
                disabled={loading}
                className={`w-full text-right px-3 py-2 text-xs flex items-center justify-between gap-2 hover:bg-sidebar-accent transition ${
                  ws.isCurrent ? "font-medium text-foreground" : "text-muted-foreground"
                }`}
              >
                <span className="truncate">{ws.name}</span>
                {ws.isCurrent && (
                  <svg className="w-3 h-3 shrink-0 text-primary" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
