import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-cyan/70", {
  variants: { variant: {
    default: "border-transparent bg-primary text-primary-foreground",
    secondary: "border-transparent bg-secondary text-secondary-foreground",
    destructive: "border border-brand-danger/25 bg-brand-danger/10 text-brand-danger",
    success: "border border-brand-success/25 bg-brand-success/10 text-brand-success",
    warning: "border border-brand-warning/25 bg-brand-warning/10 text-brand-warning",
    info: "border border-brand-info/25 bg-brand-info/10 text-brand-info",
    outline: "border-brand-border-strong bg-brand-surface-2/50 text-brand-text-secondary"
  } },
  defaultVariants: { variant: "default" }
});
export type BadgeProps = React.ComponentProps<"div"> & VariantProps<typeof badgeVariants>;
export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
export { badgeVariants };
