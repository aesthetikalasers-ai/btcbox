import * as React from "react";
import { cn } from "../../lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn("field-control flex disabled:cursor-not-allowed", className)}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = "Input";
