import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, KeyRound, Wallet, ShieldCheck, Globe2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";

export type AuthMode = "login" | "register";

type PanelView = AuthMode | "forgot";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Shared authentication form body.
 *
 * Rendered by both the modal (`AuthDialog`) and the legacy `/login` and
 * `/register` compatibility routes so there is exactly one implementation of
 * the sign-in / sign-up / password-recovery behaviour.
 *
 * The panel only owns presentation state. Authentication decisions, errors and
 * the resulting session are delegated to `AuthProvider`, and the caller decides
 * what happens after a successful sign-in through `onAuthenticated`.
 */
export function AuthFormPanel({
  mode,
  onModeChange,
  onAuthenticated,
  onForgetContext,
  redirectTo,
}: {
  mode: AuthMode;
  onModeChange?: (mode: AuthMode) => void;
  onAuthenticated?: () => void;
  onForgetContext?: () => void;
  /** Destination used only when no `onAuthenticated` handler is supplied. */
  redirectTo?: string;
}) {
  const { t } = useI18n();
  const {
    status, busy, error, notice, googleEnabled, walletEnabled, ethereumWallets,
    signInWithGoogle, signInWithUsername, signInWithEmail, signUpWithEmail,
    signInWithWeb3, requestPasswordReset, clearError,
  } = useAuth();

  const navigate = useNavigate();
  const registering = mode === "register";
  const [view, setView] = useState<PanelView>(mode);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [googleStarted, setGoogleStarted] = useState(false);

  // The requested mode always wins when the caller switches it, while an
  // in-panel transition to "forgot password" is preserved until it is left.
  useEffect(() => {
    setView(mode);
    setWalletMenuOpen(false);
  }, [mode]);

  // Once a Google redirect has started keep the button disabled until the flow
  // either fails (busy resets) or the page navigates away.
  useEffect(() => { if (!busy) setGoogleStarted(false); }, [busy]);

  // Central success handling: the modal closes, the legacy routes redirect.
  useEffect(() => {
    if (status !== "authenticated") return;
    if (onAuthenticated) onAuthenticated();
    else navigate(redirectTo || (registering ? "/me" : "/home"), { replace: true });
  }, [status, onAuthenticated, navigate, registering, redirectTo]);

  const switchMode = (next: AuthMode) => {
    clearError();
    setView(next);
    if (onModeChange) onModeChange(next);
    else navigate(next === "register" ? "/register" : "/login", { replace: true });
  };

  const emailValid = EMAIL_PATTERN.test(email);

  const submitUsernameLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    try { await signInWithUsername(username, password); }
    catch { /* AuthProvider displays the safe error. */ }
  };

  const submitEmailLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    try { await signInWithEmail(email, emailPassword); }
    catch { /* AuthProvider displays the safe error. */ }
  };

  const walletButtons = <div className="mt-2 grid gap-2" role="group" aria-label={t("Wallet")}>
    {ethereumWallets.length > 0
      ? ethereumWallets.map((wallet) => (
        <Button key={wallet.info.uuid} type="button" variant="outline" className="min-h-11 w-full justify-start" aria-busy={busy} disabled={busy || status !== "anonymous"} onClick={() => void signInWithWeb3("ethereum", wallet.provider)}>
          <Wallet className="mr-2 h-4 w-4" /> {t("Continue with {wallet}").replace("{wallet}", wallet.info.name)}
        </Button>
      ))
      : <Button type="button" variant="outline" className="min-h-11 w-full justify-start" aria-busy={busy} disabled={busy || status !== "anonymous"} onClick={() => void signInWithWeb3("ethereum")}>
        <Wallet className="mr-2 h-4 w-4" /> {t("Connect Ethereum wallet")}
      </Button>}
    <Button type="button" variant="outline" className="min-h-11 w-full justify-start" aria-busy={busy} disabled={busy || status !== "anonymous"} onClick={() => void signInWithWeb3("solana")}>
      <Wallet className="mr-2 h-4 w-4" /> {t("Connect Solana wallet")}
    </Button>
  </div>;

  const identityButtons = <>
    <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1" data-testid="auth-provider-buttons">
      <Button type="button" variant="outline" className="h-12 min-h-12 w-full justify-center gap-2 px-3" aria-busy={busy || googleStarted} disabled={!googleEnabled || busy || status !== "anonymous" || googleStarted} title={!googleEnabled ? t("Google sign-in is temporarily unavailable.") : undefined} onClick={() => { setGoogleStarted(true); void signInWithGoogle(registering ? "register" : "login"); }}>
        <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5 shrink-0">
          <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11c-.5 2.5-1.9 4.6-4 6l6.4 5c3.8-3.5 6.2-8.6 6.2-14.7z"/>
          <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.4-4.8l-6.4-5c-1.8 1.2-4.1 2-7 2-5.4 0-10-3.7-11.6-8.6l-6.6 5.1C9.1 39.3 16 44 24 44z"/>
          <path fill="#FBBC05" d="M12.4 27.6c-.4-1.2-.7-2.4-.7-3.6s.2-2.5.7-3.6l-6.6-5.1C4.5 18 3.5 20.9 3.5 24s1 6 2.3 8.7l6.6-5.1z"/>
          <path fill="#EA4335" d="M24 11.4c3 0 5.7 1 7.8 3l5.8-5.8C34.1 5.3 29.5 3.5 24 3.5 16 3.5 9.1 8.2 5.8 15.3l6.6 5.1c1.6-4.9 6.2-9 11.6-9z"/>
        </svg>
        <span className="truncate">{googleStarted ? t("Redirecting…") : t("Google")}</span>
      </Button>
      <Button type="button" variant="outline" className="h-12 min-h-12 w-full justify-center gap-2 px-3" aria-expanded={walletMenuOpen} aria-controls="auth-wallet-options" aria-busy={busy} disabled={busy || status !== "anonymous"} onClick={() => setWalletMenuOpen(open => !open)}>
        <Wallet className="h-5 w-5 shrink-0" /> <span>{t("Wallet")}</span>
      </Button>
    </div>
    {!googleEnabled && <p className="text-xs text-brand-text-muted" role="status">{t("Google sign-in is temporarily unavailable.")}</p>}
    {walletEnabled === false && <p className="text-xs text-brand-text-muted" role="status">{t("Wallet sign-in is temporarily unavailable.")}</p>}
    {walletMenuOpen && <div id="auth-wallet-options">{walletButtons}</div>}
  </>;

  const modeTabs = <div data-testid="auth-mode-switcher" className="grid grid-cols-2 rounded-xl border border-brand-border bg-brand-surface-2 p-1 text-sm font-semibold">
    <button type="button" aria-pressed={!registering} onClick={() => switchMode("login")} className={`flex min-h-10 items-center justify-center rounded-lg transition-colors ${!registering ? "bg-brand-accent text-[#05201A] shadow-sm" : "text-brand-text-secondary hover:text-brand-text"}`}>{t("Sign in")}</button>
    <button type="button" aria-pressed={registering} onClick={() => switchMode("register")} className={`flex min-h-10 items-center justify-center rounded-lg transition-colors ${registering ? "bg-brand-accent text-[#05201A] shadow-sm" : "text-brand-text-secondary hover:text-brand-text"}`}>{t("Create account")}</button>
  </div>;

  const submitEmailRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    try { await signUpWithEmail(email, emailPassword); }
    catch { /* AuthProvider displays the safe error. */ }
  };

  const submitPasswordReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    try { await requestPasswordReset(resetEmail); }
    catch { /* AuthProvider displays the safe error. */ }
  };

  if (view === "forgot") {
    return <div className="space-y-4" data-testid="auth-forgot-password">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-brand-text">{t("Reset your password")}</h2>
        <p className="text-sm leading-6 text-brand-text-muted">{t("Enter the email address for your BTCBOX account and we will send a secure reset link.")}</p>
      </div>
      {error && <div role="alert" className="rounded-lg border border-loss/30 bg-loss/10 p-3 text-sm text-loss">{t(error)}</div>}
      {notice
        ? <div role="status" className="space-y-2 rounded-lg border border-brand-border bg-brand-surface-2 p-3 text-sm text-brand-text-secondary">
          <p>{t(notice)}</p>
          <button type="button" onClick={() => setView("login")} className="font-semibold text-brand-accent underline underline-offset-4 hover:opacity-80">{t("Back to sign in")}</button>
        </div>
        : <form className="space-y-3" aria-busy={busy} onSubmit={submitPasswordReset}>
          <div>
            <label htmlFor="btcbox-reset-email" className="block text-sm text-brand-text-muted mb-1.5">{t("Email")}</label>
            <Input id="btcbox-reset-email" className="h-12" type="email" value={resetEmail} onChange={event => setResetEmail(event.target.value)} autoComplete="email" placeholder={t("Enter your email address")} required />
          </div>
          <Button type="submit" className="min-h-12 w-full" aria-busy={busy} disabled={busy || !EMAIL_PATTERN.test(resetEmail)}>
            <KeyRound className="mr-2 h-4 w-4" /> {busy ? t("Sending reset link…") : t("Send reset link")}
          </Button>
          <button type="button" onClick={() => setView("login")} className="mx-auto flex min-h-11 items-center justify-center px-3 text-sm font-semibold text-brand-text-secondary underline-offset-4 hover:text-brand-text hover:underline">{t("Back to sign in")}</button>
        </form>}
    </div>;
  }

  return <div className="space-y-4" data-testid="auth-form-panel">
    {modeTabs}
    {error && <div role="alert" className="flex items-start justify-between gap-3 rounded-lg border border-loss/30 bg-loss/10 p-3 text-sm text-loss">
      <span className="min-w-0 break-words">{t(error)}{/already registered|already linked/i.test(error) && <> <button type="button" onClick={() => switchMode("login")} className="font-semibold underline underline-offset-4 hover:opacity-80">{t("Go to sign in")}</button></>}</span>
      <button type="button" aria-label={t("Dismiss sign-in error")} className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg px-2 text-xs font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/70" onClick={clearError}>{t("Dismiss")}</button>
    </div>}
    {notice && <div role="status" className="space-y-2 rounded-lg border border-brand-border bg-brand-surface-2 p-3 text-sm text-brand-text-secondary">
      <p>{t(notice)}</p>
      {registering && <button type="button" onClick={() => switchMode("login")} className="font-semibold text-brand-accent underline underline-offset-4 hover:opacity-80">{t("Go to sign in")}</button>}
    </div>}

    {registering
      ? <form className="space-y-3" aria-busy={busy} onSubmit={submitEmailRegister}>
        <div>
          <label htmlFor="btcbox-email" className="block text-sm text-brand-text-muted mb-1.5">{t("Email")}</label>
          <Input id="btcbox-email" className="h-12" type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" placeholder={t("Enter your email address")} required />
        </div>
        <div>
          <label htmlFor="btcbox-register-password" className="block text-sm text-brand-text-muted mb-1.5">{t("Password")}</label>
          <div className="relative">
            <Input id="btcbox-register-password" aria-label={t("Password")} className="h-12 pr-10" type={showEmailPassword ? "text" : "password"} value={emailPassword} onChange={event => setEmailPassword(event.target.value)} autoComplete="new-password" minLength={12} maxLength={128} placeholder={t("At least 12 characters")} required />
            <button type="button" aria-label={t(showEmailPassword ? "Hide password" : "Show password")} aria-pressed={showEmailPassword} onClick={() => setShowEmailPassword(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded text-brand-text-muted transition-colors hover:text-brand-text">{showEmailPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
          </div>
        </div>
        <Button type="submit" className="min-h-12 w-full" aria-busy={busy} disabled={busy || !emailValid || emailPassword.length < 12}>
          <KeyRound className="mr-2 h-4 w-4" /> {busy ? t("Creating account…") : t("Create account with email")}
        </Button>
        <p className="text-center text-xs leading-5 text-brand-text-muted">{t("After registering, confirm your email to activate sign-in. You can also sign in with Google or your wallet above.")}</p>
      </form>
      : <form className="space-y-3" aria-busy={busy} onSubmit={submitEmailLogin}>
        <div>
          <label htmlFor="btcbox-email-login" className="block text-sm text-brand-text-muted mb-1.5">{t("Email")}</label>
          <Input id="btcbox-email-login" className="h-12" type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" placeholder={t("Enter your email address")} required />
        </div>
        <div>
          <label htmlFor="btcbox-email-password" className="block text-sm text-brand-text-muted mb-1.5">{t("Password")}</label>
          <div className="relative">
            <Input id="btcbox-email-password" aria-label={t("Password")} className="h-12 pr-10" type={showEmailPassword ? "text" : "password"} value={emailPassword} onChange={event => setEmailPassword(event.target.value)} autoComplete="current-password" minLength={8} maxLength={128} placeholder={t("Enter your password")} required />
            <button type="button" aria-label={t(showEmailPassword ? "Hide password" : "Show password")} aria-pressed={showEmailPassword} onClick={() => setShowEmailPassword(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded text-brand-text-muted transition-colors hover:text-brand-text">{showEmailPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
          </div>
        </div>
        <div className="flex justify-end">
          <button type="button" onClick={() => { clearError(); setView("forgot"); }} className="min-h-11 px-1 text-sm font-semibold text-brand-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/70">{t("Forgot password?")}</button>
        </div>
        <Button type="submit" className="min-h-12 w-full" aria-busy={busy} disabled={busy || !emailValid || emailPassword.length < 8}>
          <KeyRound className="mr-2 h-4 w-4" /> {busy ? t("Signing in…") : t("Sign in with email")}
        </Button>
      </form>}




    <div className="flex items-center gap-3 text-xs text-brand-text-muted">
      <span className="h-px flex-1 bg-brand-border" /><span>{t("or")}</span><span className="h-px flex-1 bg-brand-border" />
    </div>
    {identityButtons}

    {!registering && <details className="group rounded-xl border border-brand-border bg-brand-surface-2/60">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-semibold text-brand-text-secondary transition-colors hover:text-brand-text">
        <Globe2 className="h-4 w-4" /> {t("Advanced: sign in with BTCBOX username")}
      </summary>
      <form className="space-y-3 border-t border-brand-border p-3" aria-busy={busy} onSubmit={submitUsernameLogin}>
        <div>
          <label htmlFor="btcbox-username" className="block text-sm text-brand-text-muted mb-1.5">{t("Username")}</label>
          <Input id="btcbox-username" className="h-12" value={username} onChange={event => setUsername(event.target.value.toLowerCase())} autoComplete="username" minLength={3} maxLength={24} pattern="[a-z0-9][a-z0-9_]{2,23}" placeholder={t("Enter your BTCBOX username")} />
        </div>
        <div>
          <label htmlFor="btcbox-password" className="block text-sm text-brand-text-muted mb-1.5">{t("Password")}</label>
          <div className="relative">
            <Input id="btcbox-password" aria-label={t("Password")} className="h-12 pr-10" type={showPassword ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" minLength={12} maxLength={128} placeholder={t("Enter your password")} />
            <button type="button" aria-label={t(showPassword ? "Hide password" : "Show password")} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded text-brand-text-muted transition-colors hover:text-brand-text">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
          </div>
        </div>
        <Button type="submit" className="min-h-12 w-full" aria-busy={busy} disabled={busy || username.length < 3 || password.length < 12}>
          <KeyRound className="mr-2 h-4 w-4" /> {busy ? t("Signing in…") : t("Sign in with username")}
        </Button>
      </form>
    </details>}

    <p className="flex items-center justify-center gap-2 pt-1 text-center text-[11px] text-brand-text-muted"><ShieldCheck className="h-3.5 w-3.5 shrink-0" /> {t("Protected account access · Public markets remain available without signing in")}</p>
    {onForgetContext && <div className="text-center"><Link to="/home" onClick={onForgetContext} className="text-xs font-semibold text-brand-text-muted underline-offset-4 hover:text-brand-text hover:underline">{t("Back to BTCBOX")}</Link></div>}
  </div>;
}
