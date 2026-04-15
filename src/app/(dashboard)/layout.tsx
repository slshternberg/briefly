import { requireAuth } from "@/lib/auth-guard";
import Link from "next/link";
import Image from "next/image";
import { LogoutButton } from "@/components/layout/logout-button";
import { getLabels, isRTL, getHtmlLang } from "@/lib/ui-labels";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, workspace } = await requireAuth();
  const lang = workspace.defaultLanguage || "English";
  const labels = getLabels(lang);
  const rtl = isRTL(lang);
  const htmlLang = getHtmlLang(lang);

  return (
    <div className="flex min-h-screen" dir={rtl ? "rtl" : "ltr"} lang={htmlLang}>
      {/* Sidebar */}
      <aside className={`w-64 border-${rtl ? "l" : "r"} border-border bg-sidebar flex flex-col`}>
        {/* Brand */}
        <div className="p-4 pb-6">
          <div className="flex items-center">
            <Image src="/images/logo.png" alt="Briefly" width={140} height={70} className="object-contain" priority />
          </div>
          <div className="text-xs text-muted-foreground mt-2 truncate">
            {workspace.name}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5 text-sm">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground font-medium transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
            {labels.navConversations}
          </Link>
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-sidebar-accent text-muted-foreground hover:text-sidebar-foreground transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {labels.navSettings}
          </Link>
        </nav>

        {/* User footer */}
        <div className="border-t border-border p-4">
          <div className="text-sm font-medium truncate">
            {session.user.name}
          </div>
          <div className="text-xs text-muted-foreground truncate mb-3">
            {session.user.email}
          </div>
          <LogoutButton label={labels.signOut} />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-8 overflow-y-auto">{children}</main>
    </div>
  );
}
