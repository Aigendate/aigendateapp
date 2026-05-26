"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "~/lib/utils";
import {
  HomeIcon,
  UsersIcon,
  BuildingOffice2Icon,
  UserGroupIcon,
  ClipboardDocumentListIcon,
  CalendarDaysIcon,
  ClockIcon,
} from "@heroicons/react/20/solid";

const menuItems = [
  { href: "/admin", label: "Dashboard", Icon: HomeIcon },
  { href: "/admin/pacientes", label: "Pacientes", Icon: UsersIcon },
  { href: "/admin/hospitales", label: "Hospitales", Icon: BuildingOffice2Icon },
  { href: "/admin/doctores", label: "Doctores", Icon: UserGroupIcon },
  { href: "/admin/turnos", label: "Turnos", Icon: ClipboardDocumentListIcon },
  { href: "/admin/agenda", label: "Agenda", Icon: CalendarDaysIcon },
  { href: "/admin/lista-espera", label: "Lista de Espera", Icon: ClockIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed left-3 top-3 z-50 flex h-8 w-8 items-center justify-center border border-border bg-card text-sm md:hidden"
        aria-label="Toggle menu"
      >
        {open ? "×" : "☰"}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-56 shrink-0 border-r border-border bg-card transition-transform md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
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
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-[0.75rem] transition-colors hover:bg-muted",
                  isActive
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center border",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground"
                  )}
                >
                  <item.Icon className="size-3.5" />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}