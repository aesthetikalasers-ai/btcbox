import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-[16px] border border-brand-border-subtle bg-brand-surface p-4 md:rounded-[20px] md:p-[18px]",
        "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02),0_8px_32px_rgba(0,0,0,0.55)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-brand-border pb-4">
      <h2 className="type-card-title min-w-0 text-brand-text">{title}</h2>
      {children}
    </div>
  );
}
