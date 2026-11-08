import * as React from "react";
import { cn } from "../../lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full min-w-0 rounded-xl border border-brand-border-strong bg-brand-surface-2 px-3 py-2 text-base text-foreground shadow-[inset_0_1px_2px_rgba(0,0,0,0.22)] placeholder:text-muted-foreground transition-[border-color,box-shadow,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/65 focus-visible:border-white/25 aria-[invalid=true]:border-brand-danger/75 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-brand-danger/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = "Input";
