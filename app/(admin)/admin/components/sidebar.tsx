"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "~/lib/utils";

const menuItems = [
  { href: "/admin", label: "Dashboard", icon: "~" },
  { href: "/admin/pacientes", label: "Pacientes", icon: "P" },
  { href: "/admin/hospitales", label: "Hospitales", icon: "H" },
  { href: "/admin/doctores", label: "Doctores", icon: "D" },
  { href: "/admin/turnos", label: "Turnos", icon: "T" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-card">
      <div className="px-5 py-6">
        <div className="text-[0.65rem] font-medium uppercase tracking-widest text-muted-foreground">
          Admin Panel
        </div>
      </div>
      <nav className="flex flex-col gap-0.5 px-3 pb-6">
        {menuItems.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 text-[0.75rem] transition-colors hover:bg-muted",
                isActive
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center border text-[0.6rem] font-bold",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border"
                )}
              >
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
