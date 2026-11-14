import * as React from "react";
import { cn } from "../../lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input"> & { variant?: "default" | "outline" | "secondary"; size?: "default" | "sm" | "lg" }>(
  ({ className, type, variant = "default", size = "default", placeholder = "0.00", ...props }, ref) => {
    const variantClasses = {
      default: "border-brand-border bg-brand-surface-2 placeholder:text-brand-text-faint",
      outline: "border-brand-border-strong bg-transparent placeholder:text-brand-text-muted",
      secondary: "border-brand-border bg-brand-surface-2 placeholder:text-brand-text-muted",
    };
    const sizeStyles = {
      default: "h-11 py-2 text-sm",
      sm: "h-10 px-3 py-2 text-[13px]",
      lg: "h-12 px-5 py-2.5 text-[15px]",
    };
    
    return (
      <input
        type={type}
        className={cn(
          "rounded-lg transition-colors",
          variantClasses[variant],
          sizeStyles[size],
          "placeholder:text-brand-text-faint outline-none"
        )}
        placeholder={placeholder}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
