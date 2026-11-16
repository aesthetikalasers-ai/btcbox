import * as Dialog from "@radix-ui/react-dialog";
import { useEffect } from "react";
import { X } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";
import { AuthPage } from "./AuthPages";

export function MainAuthDialog({ open, mode, onOpenChange, onModeChange }: {
  open: boolean;
  mode: "login" | "register";
  onOpenChange: (open: boolean) => void;
  onModeChange: (mode: "login" | "register") => void;
}) {
  const { status } = useAuth();
  const { t } = useI18n();
  useEffect(() => { if (status === "authenticated") onOpenChange(false); }, [status, onOpenChange]);
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[300] bg-black/75 backdrop-blur-sm" />
      <Dialog.Content aria-label={mode === "register" ? t("Create account") : t("Sign in")} className="fixed inset-0 z-[301] flex h-[100dvh] w-full flex-col overflow-y-auto bg-brand-bg focus:outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[min(900px,calc(100dvh-2rem))] sm:w-[min(calc(100vw-2rem),540px)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:border-brand-border sm:shadow-2xl">
        <div className="sticky top-0 z-10 flex min-h-12 shrink-0 items-center justify-between border-b border-brand-border bg-brand-surface/95 px-4 backdrop-blur">
          <Dialog.Title className="text-sm font-semibold text-brand-text">{mode === "register" ? t("Create account") : t("Sign in")}</Dialog.Title>
          <Dialog.Close asChild><button type="button" aria-label={t("Close")} className="flex h-11 w-11 items-center justify-center rounded-lg text-brand-text-muted hover:bg-brand-surface-hover hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"><X className="h-5 w-5" /></button></Dialog.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <AuthPage mode={mode} embedded onModeChange={onModeChange} />
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}