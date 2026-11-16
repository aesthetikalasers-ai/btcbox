import * as Dialog from "@radix-ui/react-dialog";
import { useCallback, useState } from "react";
import { LockKeyhole, ShieldCheck, X } from "lucide-react";
import { useI18n, type Language } from "../../lib/i18n";
import { AuthFormPanel, type AuthMode } from "./AuthFormPanel";

/**
 * Global authentication dialog.
 *
 * Sign in and Create account open the *same* dialog in different states, and the
 * user can switch between them without leaving the current page. Radix provides
 * the focus trap, Escape handling, scroll lock and backdrop interaction, so the
 * page underneath stays untouched (no navigation, no context loss).
 *
 * The dialog deliberately owns no authentication logic: `AuthFormPanel` and the
 * `AuthProvider` handle that, which keeps Email, Google and Wallet availability
 * exactly as configured by the server.
 */
export function AuthDialog({
  open,
  mode,
  onOpenChange,
  onModeChange,
}: {
  open: boolean;
  mode: AuthMode;
  onOpenChange: (open: boolean) => void;
  onModeChange: (mode: AuthMode) => void;
}) {
  const { t, language, setLanguage, canChangeLanguage } = useI18n();
  // Remember where the user came from so closing restores the same scroll spot.
  const [rememberedScrollY] = useState(() => (typeof window === "undefined" ? 0 : window.scrollY));

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const handleOpenChange = useCallback((next: boolean) => {
    if (next) return;
    onOpenChange(false);
    // Restore focus context by returning to the previous scroll position.
    if (typeof window !== "undefined") window.scrollTo({ top: rememberedScrollY });
  }, [onOpenChange, rememberedScrollY]);

  const registering = mode === "register";

  return <Dialog.Root open={open} onOpenChange={handleOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm" />
      <Dialog.Content
        aria-describedby="auth-dialog-description"
        className="fixed left-1/2 top-1/2 z-[301] max-h-[calc(100dvh-1rem)] w-[min(calc(100vw-1rem),480px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-brand-accent/20 bg-brand-surface shadow-2xl focus:outline-none sm:max-h-[calc(100dvh-3rem)]"
      >
        <div className="sticky top-0 z-10 border-b border-brand-border/70 bg-brand-surface/95 backdrop-blur-xl">
          <div className="h-1 bg-brand-accent" />
          <div className="flex items-start gap-3 px-5 pb-3 pt-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand-accent/25 bg-brand-accent/[0.12] text-brand-accent">
              <LockKeyhole className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate text-lg font-semibold tracking-tight text-brand-text">
                {registering ? t("Create your BTCBOX account") : t("Welcome back")}
              </Dialog.Title>
              <Dialog.Description id="auth-dialog-description" className="mt-0.5 text-xs leading-5 text-brand-text-muted">
                {registering ? t("Create an account with email, Google or a wallet.") : t("Sign in with email, Google or a wallet to access your BTCBOX account.")}
              </Dialog.Description>
            </div>
            {canChangeLanguage && <label className="flex h-9 shrink-0 items-center gap-1 rounded-lg border border-brand-border bg-brand-surface-2 px-2 text-brand-accent">
              <select aria-label={t("Language")} value={language} onChange={event => setLanguage(event.target.value as Language)} className="max-w-[92px] cursor-pointer appearance-none bg-transparent text-xs font-semibold text-brand-text outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/70 [color-scheme:dark]">
                <option className="bg-brand-surface text-brand-text" value="ja">🇯🇵 日本語</option>
                <option className="bg-brand-surface text-brand-text" value="zh-CN">🇨🇳 中文</option>
                <option className="bg-brand-surface text-brand-text" value="en">🇺🇸 English</option>
                <option className="bg-brand-surface text-brand-text" value="es">🇪🇸 Español</option>
                <option className="bg-brand-surface text-brand-text" value="de">🇩🇪 Deutsch</option>
                <option className="bg-brand-surface text-brand-text" value="it">🇮🇹 Italiano</option>
                <option className="bg-brand-surface text-brand-text" value="pt">🇵🇹 Português</option>
              </select>
            </label>}
            <Dialog.Close asChild>
              <button type="button" aria-label={t("Close")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-brand-text-muted transition-colors hover:bg-brand-surface-hover hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/70">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>
        </div>
        <div className="px-5 pb-5 pt-4">
          <AuthFormPanel mode={mode} onModeChange={onModeChange} onAuthenticated={close} onForgetContext={close} />
          <p className="mt-3 flex items-center justify-center gap-2 border-t border-brand-border pt-3 text-center text-[11px] text-brand-text-muted">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" /> {t("Your session is encrypted in transit.")}
          </p>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
