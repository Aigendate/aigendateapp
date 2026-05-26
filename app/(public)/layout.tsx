import Link from "next/link";
import { Nav } from "~/components/nav";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const today = new Date().toLocaleDateString("es-PY", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="relative z-1 mx-auto max-w-[1280px] px-6 py-8 md:px-10">
      <header className="mb-10 flex flex-col gap-4 border-b-2 border-foreground pb-5 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" aria-label="Aigendate">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Aigendate" className="h-10 w-auto sm:h-12" />
        </Link>
        <div className="flex items-center gap-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            {today}
          </div>
          <Link
            href="/admin"
            className="border border-border bg-card px-3 py-1.5 text-[0.65rem] uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Admin
          </Link>
        </div>
      </header>

      <Nav />

      {children}
    </div>
  );
}
