import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";

export function Card({ children, className }: { children: ReactNode, className?: string }) {
  return (
    <div className={cn(
      "bg-brand-surface border border-brand-border-subtle rounded-[16px] md:rounded-[20px] p-4 md:p-[18px]",
      "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02),0_8px_32px_rgba(0,0,0,0.55)]",
      className
    )}>
      {children}
    </div>
  );
}

export function CardHeader({ title, children }: { title: string, children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-brand-border mb-4">
      <h2 className="type-card-title text-brand-text">{title}</h2>
      {children}
    </div>
  );
}
