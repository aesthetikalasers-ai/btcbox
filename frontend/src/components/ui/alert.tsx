import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "../../lib/utils";

export type AlertTone = "danger" | "success" | "warning" | "info";

const tones: Record<AlertTone, { icon: typeof Info; box: string; iconClass: string }> = {
  danger: { icon: XCircle, box: "border-brand-danger/30 bg-brand-danger/[0.06] text-brand-danger", iconClass: "text-brand-danger" },
  success: { icon: CheckCircle2, box: "border-brand-success/30 bg-brand-success/[0.06] text-brand-success", iconClass: "text-brand-success" },
  warning: { icon: AlertTriangle, box: "border-brand-warning/30 bg-brand-warning/[0.06] text-brand-warning", iconClass: "text-brand-warning" },
  info: { icon: Info, box: "border-brand-info/30 bg-brand-info/[0.06] text-brand-info", iconClass: "text-brand-info" },
};

export function Alert({ tone = "danger", title, children, action, className, role }: {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  role?: "alert" | "status";
}) {
  const { icon: Icon, box, iconClass } = tones[tone];
  return <div role={role ?? (tone === "danger" ? "alert" : "status")} className={cn("flex min-w-0 items-start gap-3 rounded-control border p-3 text-sm", box, className)}>
    <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", iconClass)} aria-hidden="true" />
    <div className="min-w-0 flex-1 space-y-1">
      {title ? <p className="font-semibold leading-5">{title}</p> : null}
      {children ? <div className="break-words leading-5">{children}</div> : null}
    </div>
    {action ? <div className="shrink-0 self-center">{action}</div> : null}
  </div>;
}
