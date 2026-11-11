import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export function PageHeader({ eyebrow, title, description, actions, className }: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return <header className={cn("flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
    <div className="min-w-0">
      <p className="page-accent type-eyebrow mb-1.5">{eyebrow}</p>
      <h1 className="type-page-title break-words text-brand-text">{title}</h1>
      {description ? <p className="type-body-compact mt-2 max-w-2xl break-words text-brand-text-secondary">{description}</p> : null}
    </div>
    {actions ? <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div> : null}
  </header>;
}
