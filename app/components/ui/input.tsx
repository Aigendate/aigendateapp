import { cn } from "~/lib/utils";

function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "w-full border border-border bg-background px-3 py-2 font-mono text-[0.8rem] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary",
        className
      )}
      {...props}
    />
  );
}

export { Input };
