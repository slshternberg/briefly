import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <p className="text-6xl font-bold text-primary mb-4">404</p>
        <h1 className="text-2xl font-bold mb-2">הדף לא נמצא</h1>
        <p className="text-muted-foreground mb-8">
          הדף שחיפשת אינו קיים או הוסר.
        </p>
        <Link
          href="/dashboard"
          className="rounded-lg px-5 py-2.5 text-sm font-semibold brand-gradient text-white glow-orange transition-all hover:scale-[1.01]"
        >
          חזרה לדשבורד
        </Link>
      </div>
    </div>
  );
}
