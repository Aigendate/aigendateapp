import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Sidebar } from "./components/sidebar";
import { requireAdmin } from "./auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Gate the whole admin section on the email allowlist. The middleware
  // guarantees a signed-in user; this enforces *which* users are admins.
  await requireAdmin();

  return (
    <div className="relative z-1 flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 md:px-8 md:py-4">
          <div className="pl-10 font-display text-lg font-extrabold tracking-tight md:pl-0">
            Aigendate Admin
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="border border-border px-3 py-1.5 text-[0.65rem] uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Volver al sitio
            </Link>
            <UserButton />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
