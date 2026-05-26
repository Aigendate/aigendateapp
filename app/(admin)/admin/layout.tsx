import Link from "next/link";
import { Sidebar } from "./components/sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-1 flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-card px-8 py-4">
          <div className="font-display text-lg font-extrabold tracking-tight">
            Aigendate Admin
          </div>
          <Link
            href="/"
            className="border border-border px-3 py-1.5 text-[0.65rem] uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Volver al sitio
          </Link>
        </header>
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}
