import Link from "next/link";
import Image from "next/image";
import { getServerLanguage } from "@/lib/language";
import { getLabels, isRTL } from "@/lib/ui-labels";

function FloatingOrb({ className }: { className?: string }) {
  return (
    <div
      className={`absolute rounded-full blur-3xl opacity-20 pointer-events-none ${className}`}
    />
  );
}

export default async function HomePage() {
  const lang = await getServerLanguage();
  const labels = getLabels(lang);
  const rtl = isRTL(lang);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <FloatingOrb className="w-96 h-96 bg-brand-orange -top-48 -left-48" />
      <FloatingOrb className="w-[500px] h-[500px] bg-brand-purple top-1/3 -right-64" />
      <FloatingOrb className="w-72 h-72 bg-brand-coral bottom-20 left-1/4" />
      <div className="absolute inset-0 noise-bg" />

      <header className="relative z-10 flex items-center justify-between px-8 py-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <Image src="/images/logo.png" alt="Briefly" width={300} height={150} className="object-contain" priority />
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition"
          >
            {labels.signIn}
          </Link>
          <Link
            href="/register"
            className="px-5 py-2 rounded-lg text-sm font-semibold brand-gradient text-white glow-orange transition-all hover:scale-[1.02]"
          >
            {labels.startForFree}
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex flex-col items-center justify-center text-center px-6 pt-24 pb-32 max-w-4xl mx-auto">
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
          <span className="block">{labels.heroTitle1}</span>
          <span className="brand-gradient-text">{labels.heroTitle2}</span>
        </h1>

        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl leading-relaxed mb-10">
          {labels.heroDesc}
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link
            href="/register"
            className="group px-8 py-3.5 rounded-xl text-base font-semibold brand-gradient text-white glow-orange transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            {labels.startForFree}
            <span className={`inline-block ${rtl ? "mr-2" : "ml-2"} transition-transform group-hover:${rtl ? "-translate-x-1" : "translate-x-1"}`}>
              {rtl ? "\u2190" : "\u2192"}
            </span>
          </Link>
          <Link
            href="/login"
            className="px-8 py-3.5 rounded-xl text-base font-medium border border-border hover:bg-card/50 transition"
          >
            {labels.iHaveAccount}
          </Link>
        </div>
      </main>

      {/* BizFly footer */}
      <div className="relative z-10 flex justify-center pb-10">
        <a
          href="https://bizfly.co.il/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-3 px-6 py-3 rounded-full border border-white/20 bg-white/10 backdrop-blur-sm text-base font-semibold text-foreground shadow-lg hover:bg-white/15 hover:border-white/30 hover:scale-[1.03] transition-all"
        >
          <Image src="/images/logo bizfly.png" alt="BizFly" width={100} height={34} className="object-contain" />
          <span className="text-white/40">|</span>
          <span>מבית BizFly</span>
        </a>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}
