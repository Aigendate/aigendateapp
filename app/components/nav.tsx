"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "~/lib/utils";

const navItems = [
  { href: "/", label: "Inicio" },
  { href: "/hospitales", label: "Hospitales" },
  { href: "/doctores", label: "Doctores" },
  { href: "/pacientes", label: "Pacientes" },
  { href: "/turnos", label: "Turnos" },
  { href: "/asistente", label: "Asistente" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="mb-8 flex gap-0 overflow-x-auto border-b border-border">
      {navItems.map((item) => {
        const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "border-b-2 border-transparent px-4 py-2 text-[0.7rem] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground",
              isActive && "border-accent text-foreground"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
