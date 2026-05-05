import { Links, Meta, Outlet, Scripts, ScrollRestoration, NavLink } from "react-router";
import { cn } from "~/lib/utils";
import "./app.css";

const navItems = [
  { to: "/", label: "Inicio" },
  { to: "/hospitales", label: "Hospitales" },
  { to: "/doctores", label: "Doctores" },
  { to: "/pacientes", label: "Pacientes" },
  { to: "/turnos", label: "Turnos" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Mono:wght@400;500&family=Anybody:wght@400;600;800&display=swap"
          rel="stylesheet"
        />
        <Meta />
        <Links />
      </head>
      <body>
        <div className="noise" />
        <div className="relative z-1 mx-auto max-w-[1280px] px-6 py-8 md:px-10">
          <header className="mb-10 flex items-baseline justify-between border-b-2 border-foreground pb-5">
            <h1 className="font-serif text-5xl font-normal tracking-tight">
              Turnos <em className="text-accent">PY</em>
            </h1>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              {new Date().toLocaleDateString("es-PY", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
          </header>

          <nav className="mb-8 flex gap-0 border-b border-border">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "border-b-2 border-transparent px-4 py-2 text-[0.7rem] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground",
                    isActive && "border-accent text-foreground"
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {children}
        </div>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}
