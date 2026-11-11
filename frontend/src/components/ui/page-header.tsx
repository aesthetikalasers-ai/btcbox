import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
export function PageHeader({ eyebrow, title, description, actions, className }: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return <header className={cn("flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
    <div className="min-w-0">
      <h1 className="type-page-title break-words text-brand-text">{title}</h1>
    </div>
    {actions ? <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div> : null}
  </header>;
}
