import { cn } from "~/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex items-center px-2.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-wider",
  {
    variants: {
      variant: {
        default: "bg-primary-light text-primary",
        accent: "bg-accent-light text-accent",
        destructive: "bg-destructive-light text-destructive",
        outline: "border border-border text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
