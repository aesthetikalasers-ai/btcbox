import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "../../lib/utils";
import { useI18n } from "../../lib/i18n";

export type ToastTone = "success" | "danger" | "warning" | "info";

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

export interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = React.createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const context = React.useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider.");
  return context;
}

const TONE_STYLE: Record<ToastTone, { icon: typeof Info; frame: string; iconColor: string }> = {
  success: { icon: CheckCircle2, frame: "border-positive/35", iconColor: "text-positive" },
  danger: { icon: XCircle, frame: "border-negative/40", iconColor: "text-negative" },
  warning: { icon: AlertTriangle, frame: "border-warning/40", iconColor: "text-warning" },
  info: { icon: Info, frame: "brand-border-strong", iconColor: "text-brand-accent" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const nextId = React.useRef(1);

  const dismiss = React.useCallback((id: number) => {
    setToasts((list) => list.filter((toast) => toast.id !== id));
  }, []);

  const push = React.useCallback((tone: ToastTone, message: string) => {
    const id = nextId.current++;
    setToasts((list) => [...list.slice(-3), { id, tone, message }]);
    window.setTimeout(() => dismiss(id), tone === "danger" ? 6500 : 4200);
  }, [dismiss]);

  const api = React.useMemo<ToastApi>(() => ({
    success: (message) => push("success", message),
    error: (message) => push("danger", message),
    warning: (message) => push("warning", message),
    info: (message) => push("info", message),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-label={t("Notifications")}
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 top-[calc(env(safe-area-inset-top)+4.25rem)] z-[70] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-4 sm:items-end"
      >
        {toasts.map((toast) => {
          const tone = TONE_STYLE[toast.tone];
          const Icon = tone.icon;
          return (
            <div
              key={toast.id}
              role={toast.tone === "danger" ? "alert" : "status"}
              className={cn(
                "anim-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-card border bg-brand-surface/95 p-3 shadow-overlay backdrop-blur-xl sm:w-auto sm:min-w-[18rem]",
                tone.frame,
              )}
            >
              <Icon aria-hidden="true" className={cn("mt-0.5 h-4.5 w-4.5 shrink-0", tone.iconColor)} />
              <p className="min-w-0 flex-1 break-words text-sm leading-5 text-brand-text">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label={t("Dismiss notification")}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-brand-text-muted transition-colors hover:bg-brand-surface-hover hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/70"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
