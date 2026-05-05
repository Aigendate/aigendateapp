import { cn } from "~/lib/utils";

interface BarChartProps {
  items: { label: string; value: number }[];
  color?: "primary" | "accent";
}

export function BarChart({ items, color = "primary" }: BarChartProps) {
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <div
            className="w-[120px] shrink-0 truncate text-[0.7rem]"
            title={item.label}
          >
            {item.label}
          </div>
          <div className="relative h-[22px] flex-1 overflow-hidden bg-muted">
            <div
              className={cn(
                "h-full transition-[width] duration-500",
                color === "accent" ? "bg-accent" : "bg-primary"
              )}
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
          <div className="w-7 shrink-0 text-right text-[0.65rem] font-medium">
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}
