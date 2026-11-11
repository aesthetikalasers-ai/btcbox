import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle } from "lucide-react";
import { Button } from "./button";
import { cn } from "../../lib/utils";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  tone?: "danger" | "default";
  loading?: boolean;
  error?: string;
  onConfirm: () => void;
}

/**
 * Shared high-risk action dialog. Radix supplies the focus trap, Escape handling
 * and keyboard navigation; this component standardises copy, loading and error
 * presentation so every dangerous flow behaves identically.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = "default",
  loading = false,
  error,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!loading) onOpenChange(next); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[65] bg-black/65 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={description ? "confirm-dialog-description" : undefined}
          className="fixed left-1/2 top-1/2 z-[66] w-[min(calc(100vw-1.5rem),26rem)] -translate-x-1/2 -translate-y-1/2 rounded-panel border border-brand-border bg-brand-surface p-5 shadow-overlay focus:outline-none"
        >
          <div className="flex items-start gap-3">
            <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tone === "danger" ? "bg-negative/10 text-negative" : "bg-brand-accent/10 text-brand-accent")}>
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <Dialog.Title className="text-base font-semibold tracking-tight text-brand-text">{title}</Dialog.Title>
              {description && <Dialog.Description id="confirm-dialog-description" className="mt-1.5 text-sm leading-6 text-brand-text-secondary">{description}</Dialog.Description>}
            </div>
          </div>
          {error && <p role="alert" className="mt-4 rounded-control border border-negative/35 bg-negative/[0.08] p-3 text-sm leading-5 text-negative">{error}</p>}
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={loading} onClick={() => onOpenChange(false)}>{cancelLabel}</Button>
            <Button type="button" variant={tone === "danger" ? "destructive" : "default"} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
