import { cn } from "~/lib/utils";

const colorMap = {
  primary: { bar: "bg-primary", value: "text-primary" },
  accent: { bar: "bg-accent", value: "text-accent" },
  purple: { bar: "bg-purple", value: "text-purple" },
  foreground: { bar: "bg-foreground", value: "text-foreground" },
  destructive: { bar: "bg-destructive", value: "text-destructive" },
} as const;

interface StatCardProps {
  label: string;
  value: number;
  color: keyof typeof colorMap;
  delay?: number;
}

export function StatCard({ label, value, color, delay = 0 }: StatCardProps) {
  const colors = colorMap[color];
  return (
    <div
      className="animate-slide-up relative overflow-hidden border border-border bg-card p-5 shadow-sm"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className={cn("absolute left-0 top-0 h-full w-1", colors.bar)} />
      <div className="ml-2 text-[0.7rem] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={cn("ml-2 mt-2 font-display text-4xl font-extrabold leading-none tracking-tight", colors.value)}>
        {value}
      </div>
    </div>
  );
}
