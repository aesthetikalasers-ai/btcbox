import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import type { AccountRestriction } from "../lib/api";

/**
 * Global high-priority targeted notice modal.
 *
 * Driven entirely by the backend `AccountSnapshot.restriction` field. When the
 * server flags a single user (account suspension, fund freeze, or a risk-control
 * alert), this modal renders centered on a dark backdrop mask that blocks all
 * background interaction until the user acts.
 *
 * Rendering rules:
 *   - `level` chooses the accent (danger = red, warning = amber, info = blue).
 *   - `actions` renders the backend-provided buttons (each may navigate via `href`).
 *   - When `dismissible` is true (or there are no actions), a single "Understood"
 *     button dismisses the modal locally. Otherwise it stays blocking.
 */
export function AccountNoticeModal() {
  const { accountRestriction } = useAuth();
  const { t } = useI18n();
  const [dismissed, setDismissed] = useState(false);

  const restriction = dismissed ? null : accountRestriction;
  const open = !!restriction;

  const tone = useMemo(() => {
    const level = restriction?.level ?? "info";
    if (level === "danger") {
      return {
        icon: ShieldAlert,
        iconBox: "bg-brand-danger/15 text-brand-danger",
        ring: "border-brand-danger/40",
        badge: "text-brand-danger",
      };
    }
    if (level === "warning") {
      return {
        icon: AlertTriangle,
        iconBox: "bg-brand-warning/15 text-brand-warning",
        ring: "border-brand-warning/40",
        badge: "text-brand-warning",
      };
    }
    return {
      icon: Info,
      iconBox: "bg-brand-info/15 text-brand-info",
      ring: "border-brand-info/40",
      badge: "text-brand-info",
    };
  }, [restriction?.level]);

  const actions: Array<{ label: string; href?: string }> = restriction?.actions ?? [];
  const dismissible = restriction?.dismissible ?? actions.length === 0;

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next && dismissible) setDismissed(true); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={restriction?.detail ? "account-notice-detail" : undefined}
          className={`fixed left-1/2 top-1/2 z-[301] w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border ${tone.ring} bg-brand-surface p-6 shadow-2xl`}
        >
          <div className="flex items-start gap-4">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone.iconBox}`}>
              <tone.icon className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-base font-semibold leading-tight text-brand-text">
                {restriction?.title}
              </Dialog.Title>
              {restriction?.detail ? (
                <p id="account-notice-detail" className="mt-2 text-sm leading-6 text-brand-text-secondary">
                  {restriction.detail}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {dismissible ? (
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="flex h-11 items-center justify-center rounded-lg border border-brand-border px-4 text-sm font-semibold text-brand-text-secondary transition-colors hover:border-brand-border-strong hover:text-brand-text"
                >
                  {t("Got it")}
                </button>
              </Dialog.Close>
            ) : null}
            {actions.map((action) => {
              const content = (
                <span className="flex h-11 items-center justify-center rounded-lg bg-brand-accent px-4 text-sm font-bold text-brand-text">
                  {action.label}
                </span>
              );
              return action.href ? (
                <Dialog.Close key={action.label} asChild>
                  <a href={action.href} className="w-full sm:w-auto">{content}</a>
                </Dialog.Close>
              ) : (
                <Dialog.Close key={action.label} asChild>
                  <button type="button" className="w-full sm:w-auto">{content}</button>
                </Dialog.Close>
              );
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
