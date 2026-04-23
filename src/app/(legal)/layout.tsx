import Link from "next/link";
import Image from "next/image";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" dir="rtl">
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/" className="hover:opacity-80 transition">
            <Image src="/images/logo.png" alt="Briefly" width={120} height={60} className="object-contain" priority />
          </Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-12">
        {children}
      </main>
      <footer className="border-t border-border/40 mt-16">
        <div className="max-w-4xl mx-auto px-6 py-6 flex flex-wrap gap-4 text-sm text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground transition">מדיניות פרטיות</Link>
          <Link href="/terms" className="hover:text-foreground transition">תנאי שימוש</Link>
          <Link href="/help" className="hover:text-foreground transition">עזרה</Link>
        </div>
      </footer>
    </div>
  );
}
