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
      {/*
       * Mobile: a true full-screen window — the form is unusable at "small card"
       * size on a phone, so it fills the viewport with no gaps, no rounded
       * corners and no page scroll behind it.
       * Desktop: a fixed, viewport-centered 480px card.
       *
       * The content is a three-part column (fixed header / scrollable body /
       * fixed footer) so the top-right close button never scrolls away while a
       * long form or the on-screen keyboard shrinks the viewport.
       */}
      <Dialog.Content
        aria-describedby="auth-dialog-description"
        className="fixed inset-0 z-[301] flex h-[100dvh] w-full max-w-none flex-col overflow-hidden rounded-none border-0 bg-brand-surface shadow-2xl focus:outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[min(720px,calc(100dvh-3rem))] sm:w-[min(calc(100vw-2rem),480px)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:border-brand-accent/20"
      >
        <div className="shrink-0 border-b border-brand-border/70 bg-brand-surface pt-[env(safe-area-inset-top)] sm:pt-0">
          <div className="h-1 bg-brand-accent" />
          <div className="flex items-start gap-3 px-4 pb-3 pt-3 sm:px-5 sm:pb-3 sm:pt-4">
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
            {/* Always the top-right X, on phone and desktop. 44px touch target on mobile. */}
            <Dialog.Close asChild>
              <button type="button" aria-label={t("Close")} className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-brand-text-muted transition-colors hover:bg-brand-surface-hover hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/70 sm:mr-0 sm:h-9 sm:w-9">
                <X className="h-5 w-5 sm:h-4 sm:w-4" />
              </button>
            </Dialog.Close>
          </div>
          {/* Language switching gets its own row on phones so it never squeezes the X off-screen. */}
          {canChangeLanguage && (
            <div className="flex items-center justify-end border-t border-brand-border-subtle px-4 py-2 sm:border-0 sm:px-5 sm:pb-3 sm:pt-0">
              <label className="flex h-9 items-center gap-1 rounded-lg border border-brand-border bg-brand-surface-2 px-2 text-brand-accent">
                <select aria-label={t("Language")} value={language} onChange={event => setLanguage(event.target.value as Language)} className="max-w-[120px] cursor-pointer appearance-none bg-transparent text-xs font-semibold text-brand-text outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/70 sm:max-w-[92px] [color-scheme:dark]">
                  <option className="bg-brand-surface text-brand-text" value="ja">🇯🇵 日本語</option>
                  <option className="bg-brand-surface text-brand-text" value="zh-CN">🇨🇳 中文</option>
                  <option className="bg-brand-surface text-brand-text" value="en">🇺🇸 English</option>
                  <option className="bg-brand-surface text-brand-text" value="es">🇪🇸 Español</option>
                  <option className="bg-brand-surface text-brand-text" value="de">🇩🇪 Deutsch</option>
                  <option className="bg-brand-surface text-brand-text" value="it">🇮🇹 Italiano</option>
                  <option className="bg-brand-surface text-brand-text" value="pt">🇵🇹 Português</option>
                </select>
              </label>
            </div>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-4 [-webkit-overflow-scrolling:touch] sm:px-5 sm:pb-5">
          <AuthFormPanel mode={mode} onModeChange={onModeChange} onAuthenticated={close} onForgetContext={close} />
        </div>
        <p className="flex shrink-0 items-center justify-center gap-2 border-t border-brand-border bg-brand-surface px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] text-center text-[11px] text-brand-text-muted sm:px-5 sm:pb-3">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" /> {t("Your session is encrypted in transit.")}
        </p>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
