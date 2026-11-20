import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

// Disabled states are deliberately split by variant (Step 12):
// - Primary/destructive CTAs turn into a neutral grey surface with muted text,
//   so "clickable" (solid emerald) vs "not ready" (grey) is unmistakable —
//   e.g. the sign-in and 2FA submit buttons before the form is valid.
// - Outline/secondary/ghost/link controls keep the translucent dim so their
//   border layout stays unchanged while disabled.
const variants = cva(
  "inline-flex min-w-0 max-w-full select-none items-center justify-center gap-2 whitespace-normal text-center leading-tight rounded-lg text-sm font-semibold tracking-[0.005em] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg disabled:pointer-events-none disabled:cursor-not-allowed active:translate-y-px",
  {
    variants: {
      variant: {
        // Primary: brand teal background + dark text for contrast (Step 12).
        default: "bg-primary text-primary-foreground shadow-sm hover:brightness-105 disabled:bg-brand-surface-2 disabled:text-brand-text-disabled disabled:shadow-none",
        destructive: "bg-destructive text-white shadow-sm hover:brightness-110 disabled:bg-brand-surface-2 disabled:text-brand-text-disabled disabled:shadow-none",
        outline: "border border-brand-border-strong bg-transparent text-brand-text shadow-sm hover:border-brand-accent/60 hover:bg-white/[0.045] disabled:opacity-45",
        secondary: "border border-brand-border bg-brand-surface-2 text-brand-text shadow-sm hover:border-white/15 hover:bg-white/[0.055] disabled:opacity-45",
        ghost: "text-brand-text-secondary hover:bg-white/[0.045] hover:text-brand-text disabled:opacity-45",
        link: "min-h-0 h-auto rounded-none p-0 text-primary text-left underline-offset-4 hover:underline disabled:opacity-45",
      },
      size: {
        default: "min-h-11 h-auto px-4 py-2 sm:px-5",
        sm: "min-h-10 h-auto rounded-lg px-3 py-2 text-[13px] sm:px-4",
        lg: "min-h-12 h-auto rounded-lg px-5 py-2.5 text-[15px] sm:px-7",
        icon: "h-11 w-11 min-w-11 shrink-0 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof variants> {
  asChild?: boolean;
  loading?: boolean;
  disabled?: boolean;
  /** Full-width button (block-level). */
  block?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, block = false, children, ...props }, ref) => {
    const classes = cn(variants({ variant, size }), block && "w-full", className);
    // When asChild, Radix Slot must receive exactly ONE child element — never inject
    // a sibling loader (it breaks Slot). Loading still disables the slotted control.
    if (asChild) {
      return (
        <Slot ref={ref} className={classes} aria-busy={loading || undefined} aria-disabled={disabled || loading || undefined} {...props}>
          {children}
        </Slot>
      );
    }
    return (
      <button ref={ref} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
        {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
export { variants as buttonVariants };
