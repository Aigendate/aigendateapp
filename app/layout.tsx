import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "~/components/nav";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Aigendate",
  description: "Turnos médicos en Paraguay",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const today = new Date().toLocaleDateString("es-PY", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Mono:wght@400;500&family=Anybody:wght@400;600;800&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" type="image/svg+xml" href="/logo-icon.svg" />
      </head>
      <body>
        <div className="noise" />
        <div className="relative z-1 mx-auto max-w-[1280px] px-6 py-8 md:px-10">
          <header className="mb-10 flex items-center justify-between border-b-2 border-foreground pb-5">
            <Link href="/" aria-label="Aigendate">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="Aigendate" className="h-12 w-auto" />
            </Link>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              {today}
            </div>
          </header>

          <Nav />

          {children}
        </div>
      </body>
    </html>
  );
}
