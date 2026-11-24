import type { ComponentType, ReactNode } from "react";
import { cn } from "../../lib/utils";

export function EmptyState({ icon: Icon, title, hint, action, className }: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}) {
  return <div className={cn("empty-state", className)}>
    <span className="empty-state-icon"><Icon className="h-5 w-5" /></span>
    <p className="empty-state-title">{title}</p>
    {hint ? <p className="empty-state-hint">{hint}</p> : null}
    {action ? <div className="mt-2 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
  </div>;
}
