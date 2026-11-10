import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border border-brand-border bg-brand-surface p-4 shadow-sm sm:p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-brand-border-subtle pb-3">
      <h2 className="type-card-title min-w-0 text-brand-text">{title}</h2>
      {children}
    </div>
  );
}
