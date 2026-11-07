import * as React from "react";
import { cn } from "../../lib/utils";

const cardPadding = "p-4 sm:p-5 lg:p-6";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("min-w-0 rounded-2xl border border-brand-border bg-card text-card-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.02),0_8px_32px_rgba(0,0,0,0.42)]", className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex min-w-0 flex-col space-y-1.5", cardPadding, className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 className={cn("type-card-title leading-snug tracking-tight text-brand-text", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("type-body-compact text-muted-foreground", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("min-w-0 px-4 pb-4 sm:px-5 sm:pb-5 lg:px-6 lg:pb-6", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex min-w-0 items-center px-4 pb-4 sm:px-5 sm:pb-5 lg:px-6 lg:pb-6", className)} {...props} />;
}
