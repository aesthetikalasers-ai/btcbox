import * as React from "react";
import { cn } from "../../lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full min-w-0 rounded-lg border border-brand-border-strong bg-brand-surface-2/70 px-3 py-2 text-base text-foreground shadow-sm shadow-black/10 placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/70 focus-visible:border-brand-cyan/50 aria-[invalid=true]:border-brand-danger/70 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-brand-danger/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = "Input";
