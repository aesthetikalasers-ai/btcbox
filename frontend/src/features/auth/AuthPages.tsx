import { AuthRestoreState } from "../../components/AuthRestoreState";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowLeft, ArrowRight, KeyRound, ShieldCheck, Wallet, ChartNoAxesCombined, Globe2, LockKeyhole } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { BrandLogo } from "../../components/BrandLogo";
import { useAuth } from "../../lib/auth";
import { useI18n, type Language } from "../../lib/i18n";

export function AuthPage({ mode, redirectTo }: { mode: "login" | "register"; redirectTo?: string }) {
  const { t, language, setLanguage, canChangeLanguage } = useI18n();
  const {
    status, needsCredentials, busy, error, notice, googleEnabled, walletEnabled, ethereumWallets,
    signInWithGoogle, signInWithUsername, signInWithWeb3, signInWithEmail, signUpWithEmail, requestPasswordReset,
    verifyTwoFactor, clearError,
  } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [emailPassword, setEmailPassword] = useState("");

  const translateAuthMessage = (message: string) => {
    const normalized = message.toLowerCase();
    if (normalized.includes("email address not authorized") || normalized.includes("email_address_not_authorized")) return t("Email address not authorized");
    if (normalized.includes("email rate limit exceeded") || normalized.includes("over_email_send_rate_limit")) return t("Email rate limit exceeded");
    if (normalized.includes("user already registered")) return t("User already registered");
    if (normalized.includes("invalid login credentials")) return t("Invalid login credentials");
    if (normalized.includes("email not confirmed")) return t("Email not confirmed");
    return t(message);
  };
  const [showPassword, setShowPassword] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [googleStarted, setGoogleStarted] = useState(false);
  const navigate = useNavigate();
  const registering = mode === "register";

  useEffect(() => {
    clearError();
    setWalletMenuOpen(false);
  }, [mode]);
  // Once a Google OAuth redirect has started, keep the button disabled until the
  // flow either fails (busy resets) or the page navigates away. Prevents double submit.
  useEffect(() => { if (!busy) setGoogleStarted(false); }, [busy]);

  useEffect(() => {
    if (status === "authenticated") navigate(needsCredentials ? "/account-setup" : (redirectTo || "/home"), { replace: true });

  }, [status, needsCredentials, navigate, redirectTo]);

  if (status === "loading") return <AuthRestoreState />;
  // Never render the clickable sign-in form while a sign-in is already in progress
  // or the session is established; avoids duplicate submissions on the same page.
  if (status !== "anonymous" && status !== "two-factor") return <div className="mx-auto flex min-h-[60vh] flex-col items-center justify-center gap-3 text-sm text-brand-text-muted">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-border border-t-brand-accent" aria-hidden="true" />
    {t("Completing sign-in…")}
  </div>;

  const submitUsernameLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try { await signInWithUsername(username, password); }
    catch { /* AuthProvider displays the safe error. */ }
  };

  const submitEmailAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      if (registering) await signUpWithEmail(emailAddress, emailPassword);
      else await signInWithEmail(emailAddress, emailPassword);
    } catch { /* AuthProvider displays the safe error. */ }
  };

  const submitEmailPasswordReset = async () => {
    try { await requestPasswordReset(emailAddress); }
    catch { /* AuthProvider displays the safe error. */ }
  };


  const walletButtons = <div className="mt-2 grid gap-2" role="group" aria-label={t("Wallet")}>
    {ethereumWallets.length > 0
      ? ethereumWallets.map((wallet) => (
        <Button key={wallet.info.uuid} type="button" variant="outline" className="min-h-11 w-full justify-start" aria-busy={busy} disabled={!walletEnabled || busy || status !== "anonymous"} onClick={() => void signInWithWeb3("ethereum", wallet.provider)}>
          <Wallet className="mr-2 h-4 w-4" /> {t("Continue with {wallet}").replace("{wallet}", wallet.info.name)}
        </Button>
      ))
      : <Button type="button" variant="outline" className="min-h-11 w-full justify-start" aria-busy={busy} disabled={!walletEnabled || busy || status !== "anonymous"} onClick={() => void signInWithWeb3("ethereum")}>
        <Wallet className="mr-2 h-4 w-4" /> {t("Connect Ethereum wallet")}
      </Button>}
    <Button type="button" variant="outline" className="min-h-11 w-full justify-start" aria-busy={busy} disabled={!walletEnabled || busy || status !== "anonymous"} onClick={() => void signInWithWeb3("solana")}>
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
      <Button type="button" variant="outline" className="h-12 min-h-12 w-full justify-center gap-2 px-3" aria-expanded={walletMenuOpen} aria-controls="auth-wallet-options" aria-busy={busy} disabled={!walletEnabled || busy || status !== "anonymous"} title={!walletEnabled ? t("Wallet sign-in is temporarily unavailable.") : undefined} onClick={() => setWalletMenuOpen(open => !open)}>
        <Wallet className="h-5 w-5 shrink-0" /> <span>{t("Wallet")}</span>
      </Button>
    </div>
    {!googleEnabled && <p className="text-xs text-brand-text-muted" role="status">{t("Google sign-in is temporarily unavailable.")}</p>}
    {!walletEnabled && <p className="text-xs text-brand-text-muted" role="status">{t("Wallet sign-in is temporarily unavailable.")}</p>}
    {walletMenuOpen && <div id="auth-wallet-options">{walletButtons}</div>}
  </>;

  return <main className="tone-support relative mx-auto flex min-h-[100dvh] w-full max-w-[1120px] items-center px-3 py-6 sm:px-6 sm:py-10 lg:px-8">

    <div className="grid w-full items-center gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(380px,.95fr)] lg:gap-16">
      <section className="hidden min-w-0 flex-col justify-center lg:flex">
        <Link to="/home" className="mb-12 w-fit"><BrandLogo /></Link>
        <p className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-brand-cyan"><span className="h-1.5 w-1.5 rounded-full bg-brand-success" /> {t("Digital asset exchange")}</p>
        <h1 className="max-w-[560px] text-3xl font-semibold leading-[1.12] tracking-tight text-brand-text xl:text-4xl">
          {registering ? t("A clearer way to enter the digital asset market.") : t("Welcome back to your market.")}
        </h1>
        <p className="mt-5 max-w-[480px] text-base leading-7 text-brand-text-secondary">
          {registering
            ? t("Create your BTCBOX account with email or Google, verify your identity, and complete your account setup.")
            : t("Access your BTCBOX account with your username, Google or a supported crypto wallet.")}
        </p>
        <div className="mt-9 grid max-w-[520px] gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
            <ChartNoAxesCombined className="mb-3 h-5 w-5 text-brand-cyan" />
            <p className="text-sm font-semibold text-brand-text">{t("Public market access")}</p>
            <p className="mt-1 text-xs leading-5 text-brand-text-muted">{t("Explore market information before signing in.")}</p>
          </div>
          <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
            <ShieldCheck className="mb-3 h-5 w-5 text-brand-success" />
            <p className="text-sm font-semibold text-brand-text">{t("Account-first controls")}</p>
            <p className="mt-1 text-xs leading-5 text-brand-text-muted">{t("Personal assets and account actions stay protected.")}</p>
          </div>
        </div>
        <Link to="/markets" className="mt-8 inline-flex min-h-11 w-fit items-center gap-2 text-sm font-semibold text-brand-text-secondary transition-colors hover:text-brand-text">
          {t("Explore public markets")} <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <div className="mx-auto w-full max-w-[480px]">
        <div className="mb-5 flex items-center justify-between lg:hidden">
          <Link to="/home" aria-label={t("BTCBOX home")}><BrandLogo compact /></Link>
          <Link to="/markets" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-brand-text-secondary transition-colors hover:bg-brand-surface-hover hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/70">{t("Explore markets")} <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
        <Card className="w-full overflow-hidden border-brand-cyan/20 bg-brand-surface  ">
          <div className="h-1 bg-brand-accent"/>
          <CardHeader className="gap-3 border-b border-brand-border/70 bg-brand-surface px-5 pb-4 pt-6 sm:px-8 sm:pt-8">
            <div className="flex items-center gap-2">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-brand-cyan/25 bg-brand-cyan/[0.12] text-brand-cyan shadow-sm shadow-brand-cyan/[0.08]">
                {status === "two-factor" ? <ShieldCheck className="h-5 w-5" /> : registering ? <Globe2 className="h-5 w-5" /> : <LockKeyhole className="h-5 w-5" />}
              </span>
              <span className="text-xs font-semibold uppercase tracking-[.16em] text-brand-text-muted">{registering ? t("Join BTCBOX") : t("Secure access")}</span><label className="ml-auto flex h-9 items-center gap-1 rounded-lg border border-brand-border bg-brand-surface-2 px-2 text-brand-cyan shadow-sm shadow-brand-cyan/10"><Globe2 className="h-3.5 w-3.5"/><select disabled={!canChangeLanguage} aria-label={t("Language")} value={language} onChange={event => setLanguage(event.target.value as Language)} className="w-[76px] appearance-none bg-transparent text-xs font-semibold text-brand-text outline-none"><option className="bg-brand-surface text-brand-text" value="en">English</option><option className="bg-brand-surface text-brand-text" value="ja">日本語</option><option className="bg-brand-surface text-brand-text" value="zh-CN">中文</option><option className="bg-brand-surface text-brand-text" value="es">Español</option><option className="bg-brand-surface text-brand-text" value="de">Deutsch</option><option className="bg-brand-surface text-brand-text" value="it">Italiano</option><option className="bg-brand-surface text-brand-text" value="pt">Português</option></select></label>
            </div>
            <CardTitle className="text-2xl font-semibold tracking-tight">
              {status === "two-factor" ? t("Verify your sign-in") : registering ? t("Create your BTCBOX account") : t("Welcome back")}
            </CardTitle>
            {(status === "two-factor" || registering) && <CardDescription className="max-w-[380px] text-sm leading-6 text-brand-text-muted">
              {status === "two-factor"
                ? t("Enter your authenticator code to finish signing in.")
                : t("Create your BTCBOX account with email or Google, verify your identity, and complete your account setup.")}
            </CardDescription>}
            {status !== "two-factor" && <div data-testid="auth-mode-switcher" className="grid grid-cols-2 rounded-xl border border-brand-border bg-brand-surface-2 p-1 text-sm font-semibold">
              <Link to="/login" className={`flex min-h-10 items-center justify-center rounded-lg transition-colors ${!registering ? "bg-brand-accent text-white shadow-sm" : "text-brand-text-secondary hover:text-brand-text"}`}>{t("Sign in")}</Link>
              <Link to="/register" className={`flex min-h-10 items-center justify-center rounded-lg transition-colors ${registering ? "bg-brand-accent text-white shadow-sm" : "text-brand-text-secondary hover:text-brand-text"}`}>{t("Create account")}</Link>
            </div>}
          </CardHeader>
          <CardContent className="space-y-4 px-5 pb-6 sm:px-8 sm:pb-8">
            {error && <div role="alert" className="flex items-start justify-between gap-3 rounded-lg border border-loss/30 bg-loss/10 p-3 text-sm text-loss">
              <span className="min-w-0 break-words">{t(error)}{/already registered|already linked/i.test(error) && <> <Link to="/login" className="font-semibold underline underline-offset-4 hover:opacity-80">{t("Go to sign in")}</Link></>}</span>
              <button type="button" aria-label={t("Dismiss sign-in error")} className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg px-2 text-xs font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/70" onClick={clearError}>{t("Dismiss")}</button>
            </div>}
            {notice && <div role="status" className="rounded-lg border border-brand-border bg-brand-surface-2 p-3 text-sm text-brand-text-secondary">{translateAuthMessage(notice)}</div>}

            {status === "two-factor" ? <form className="space-y-3" aria-busy={verifyBusy} onSubmit={async event => {
              event.preventDefault(); if (verifyBusy) return; setVerifyBusy(true);
              try { await verifyTwoFactor(verifyCode); } catch { /* Safe error is displayed by AuthProvider. */ }
              finally { setVerifyBusy(false); }
            }}>
              <label className="block space-y-2 text-sm">
                <span className="text-brand-text-secondary">{t("Authenticator code")}</span>
                <Input className="h-12" value={verifyCode} onChange={event => setVerifyCode(event.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" autoComplete="one-time-code" placeholder={t("Enter code")} required aria-label={t("Authenticator code")} />
              </label>
              <Button type="submit" className="min-h-12 w-full" disabled={verifyBusy || verifyCode.length < 6}>{verifyBusy ? t("Verifying…") : t("Verify and continue")}</Button>
            </form> : <>
              {mode === "login" && <form className="space-y-3" aria-busy={busy} onSubmit={submitUsernameLogin}>
                <label className="block space-y-1.5 text-sm">
                  <span className="text-brand-text-secondary">{t("Username")}</span>
                  <Input className="h-12" value={username} onChange={event => setUsername(event.target.value.toLowerCase())} autoComplete="username" minLength={3} maxLength={24} pattern="[a-z0-9][a-z0-9_]{2,23}" placeholder={t("Enter your BTCBOX username")} required />
                </label>
                <label className="block space-y-1.5 text-sm">
                  <span className="text-brand-text-secondary">{t("Password")}</span>
                  <span className="relative block"><Input aria-label={t("Password")} className="h-12 pr-12" type={showPassword ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" minLength={12} maxLength={128} placeholder={t("Enter your password")} required /><button type="button" aria-label={t(showPassword ? "Hide password" : "Show password")} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-brand-text-muted">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span>
                </label>
                <Button type="submit" className="min-h-12 w-full" aria-busy={busy} disabled={busy || username.length < 3 || password.length < 12}>
                  <KeyRound className="mr-2 h-4 w-4" /> {busy ? t("Signing in…") : t("Sign in with username")}
                </Button>
              </form>}

              <form className="space-y-3 border-t border-brand-border pt-4" aria-busy={busy} onSubmit={submitEmailAuth}>
                <label className="block space-y-1.5 text-sm">
                  <span className="text-brand-text-secondary">{t("Email address")}</span>
                  <Input aria-label={t("Email address")} className="h-12" type="email" value={emailAddress} onChange={event => setEmailAddress(event.target.value)} autoComplete="email" inputMode="email" maxLength={254} placeholder={t("Email address")} required />
                </label>
                <label className="block space-y-1.5 text-sm">
                  <span className="text-brand-text-secondary">{t("Email password")}</span>
                  <Input aria-label={t("Email password")} className="h-12" type="password" value={emailPassword} onChange={event => setEmailPassword(event.target.value)} autoComplete={registering ? "new-password" : "current-password"} minLength={8} maxLength={128} placeholder={t("Email password")} required />
                </label>
                <Button type="submit" className="min-h-12 w-full" aria-busy={busy} disabled={busy || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress.trim()) || emailPassword.length < 8}>
                  {busy ? (registering ? t("Creating account…") : t("Signing in…")) : t(registering ? "Create account with email" : "Sign in with email")}
                </Button>
                {!registering && <button type="button" className="flex min-h-11 w-full items-center justify-center rounded-lg text-sm font-medium text-brand-text-secondary underline-offset-4 hover:text-brand-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/70 disabled:opacity-50" disabled={busy || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress.trim())} onClick={() => void submitEmailPasswordReset()}>{t("Forgot password?")}</button>}
              </form>

              {identityButtons}

            </>}

            <div className="border-t border-brand-border pt-4 text-center text-sm text-brand-text-secondary">
              {mode === "login"
                ? <>{t("New to BTCBOX?")} <Link className="font-semibold text-brand-accent underline-offset-4 hover:underline" to="/register">{t("Create account")}</Link></>
                : <>{t("Already have an account?")} <Link className="font-semibold text-brand-accent underline-offset-4 hover:underline" to="/login">{t("Sign in")}</Link></>}
            </div>
            <Link to="/home" className="flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-xs text-brand-text-muted transition-colors hover:bg-brand-surface-hover hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/70"><ArrowLeft className="h-3.5 w-3.5" /> {t("Back to BTCBOX")}</Link>
          </CardContent>
        </Card>
        <p className="mt-4 flex items-center justify-center gap-2 text-center text-[11px] text-brand-text-muted"><ShieldCheck className="h-3.5 w-3.5 shrink-0" /> {t("Protected account access · Public markets remain available without signing in")}</p>
      </div>
    </div>
  </main>;
}

export function AuthCallbackPage() {
  const { t } = useI18n();
  const { finishOAuth, status, needsCredentials, error, busy, completePasswordRecovery } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryError, setRecoveryError] = useState("");
  const oauthAttempted = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();
  const callbackIntent = new URLSearchParams(location.search).get("intent");
  const callbackDestination = callbackIntent === "register" ? "/register" : "/login";
  // Identity-conflict errors mean the account already exists -> send to sign-in, not back to register.
  const accountExistsError = !!error && /already registered|already linked|account is frozen/i.test(error);
  const effectiveDestination = accountExistsError ? "/login" : callbackDestination;
  useEffect(() => {
    if (!oauthAttempted.current && status !== "loading" && status !== "authenticated" && status !== "two-factor" && status !== "password-recovery") {
      oauthAttempted.current = true;
      void finishOAuth();
    }
  }, [finishOAuth, status]);
  useEffect(() => {
    if (status === "authenticated") navigate(needsCredentials ? "/account-setup" : "/home", { replace: true });
    else if (status === "two-factor") navigate("/login", { replace: true });
  }, [status, needsCredentials, navigate]);
  useEffect(() => {
    if (!error || status !== "anonymous") return;
    const redirectId = window.setTimeout(() => navigate(effectiveDestination, { replace: true }), 6000);
    return () => window.clearTimeout(redirectId);
  }, [effectiveDestination, error, navigate, status]);
  const submitRecovery = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRecoveryError("");
    if (newPassword.length < 8 || newPassword.length > 128) {
      setRecoveryError(t("Use a password between 8 and 128 characters."));
      return;
    }
    if (newPassword !== confirmPassword) {
      setRecoveryError(t("The passwords do not match."));
      return;
    }
    try { await completePasswordRecovery(newPassword); }
    catch (cause) { setRecoveryError(cause instanceof Error ? cause.message : t("Password could not be updated.")); }
  };
  if (status === "password-recovery") return <main className="tone-support mx-auto flex min-h-[100dvh] w-full max-w-[520px] items-center px-3 py-8 sm:px-6">
    <Card className="w-full overflow-hidden border-brand-cyan/20 bg-brand-surface  ">
      <div className="h-1 bg-brand-accent"/>
      <CardHeader className="gap-3 border-b border-brand-border/70 bg-brand-surface px-5 pt-7 sm:px-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-cyan/20 bg-brand-cyan/10 text-brand-cyan"><LockKeyhole className="h-5 w-5" /></div>
        <CardTitle className="text-2xl">{t("Reset your password")}</CardTitle>
        <CardDescription>{t("Choose a new password for your BTCBOX email account.")}</CardDescription>
      </CardHeader>
      <CardContent className="px-5 pb-7 sm:px-8">
        <form className="space-y-3" aria-busy={busy} onSubmit={submitRecovery}>
          <label className="block space-y-1.5 text-sm"><span className="text-brand-text-secondary">{t("New password")}</span><Input className="h-12" type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} autoComplete="new-password" minLength={8} maxLength={128} required /></label>
          <label className="block space-y-1.5 text-sm"><span className="text-brand-text-secondary">{t("Confirm new password")}</span><Input className="h-12" type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} maxLength={128} required /></label>
          {(recoveryError || error) && <p role="alert" className="rounded-lg border border-loss/30 bg-loss/10 p-3 text-sm text-loss">{t(recoveryError || error)}</p>}
          <Button type="submit" className="min-h-12 w-full" disabled={busy || newPassword.length < 8 || newPassword !== confirmPassword}>{busy ? t("Updating password…") : t("Update password")}</Button>
        </form>
      </CardContent>
    </Card>
  </main>;
  return <div className="tone-support mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-3 p-6 text-center">
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-brand-accent" />
    <p role={error ? "alert" : "status"} aria-live={error ? "assertive" : "polite"} className="text-sm text-brand-text-secondary">{error ? t(error) : busy ? t("Completing secure sign-in…") : t("Finishing sign-in…")}</p>
    {error && <Link to={callbackDestination} className="inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold underline underline-offset-4 transition-colors hover:bg-brand-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/70">{t("Return to sign in")}</Link>}
  </div>;
}
