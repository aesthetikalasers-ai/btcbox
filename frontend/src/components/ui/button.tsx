import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const variants = cva(
  "inline-flex min-w-0 max-w-full select-none items-center justify-center gap-2 whitespace-normal text-center leading-tight rounded-xl text-sm font-semibold tracking-[0.005em] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg disabled:pointer-events-none disabled:opacity-45 active:translate-y-px",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_4px_12px_rgba(0,0,0,0.24)] hover:brightness-105",
        destructive: "bg-destructive text-white shadow-sm hover:brightness-110",
        outline: "border border-brand-border-strong bg-brand-surface text-brand-text shadow-sm hover:border-white/20 hover:bg-white/[0.045]",
        secondary: "border border-brand-border bg-brand-surface-2 text-brand-text shadow-sm hover:border-white/15 hover:bg-white/[0.055]",
        ghost: "text-brand-text-secondary hover:bg-white/[0.045] hover:text-brand-text",
        link: "min-h-0 h-auto rounded-none p-0 text-primary text-left underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-11 h-auto px-4 py-2 sm:px-5",
        sm: "min-h-10 h-auto rounded-lg px-3 py-2 text-[13px] sm:px-4",
        lg: "min-h-12 h-auto rounded-xl px-5 py-2.5 text-[15px] sm:px-7",
        icon: "h-11 w-11 min-w-11 shrink-0 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof variants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp ref={ref} className={cn(variants({ variant, size }), className)} {...props} />;
  },
);
Button.displayName = "Button";
export { variants as buttonVariants };
