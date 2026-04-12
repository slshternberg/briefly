import Link from "next/link";
import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      {/* Background effects */}
      <div className="absolute w-80 h-80 rounded-full blur-3xl opacity-10 bg-brand-orange -top-40 -right-40 pointer-events-none" />
      <div className="absolute w-96 h-96 rounded-full blur-3xl opacity-10 bg-brand-purple bottom-0 -left-48 pointer-events-none" />

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <Link href="/" className="hover:opacity-80 transition">
            <Image src="/images/logo.png" alt="Briefly" width={260} height={130} className="object-contain" priority />
          </Link>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-8 shadow-xl shadow-black/20">
          {children}
        </div>
      </div>
    </div>
  );
}
