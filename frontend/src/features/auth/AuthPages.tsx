import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Chrome, KeyRound, ShieldCheck, Wallet, ChartNoAxesCombined, Globe2, LockKeyhole } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { BrandLogo } from "../../components/BrandLogo";
import { useAuth } from "../../lib/auth";

export function AuthPage({ mode, redirectTo }: { mode: "login" | "register"; redirectTo?: string }) {
  const {
    status, needsCredentials, busy, error, notice, googleEnabled, ethereumWallets,
    signInWithGoogle, signInWithUsername, signInWithWeb3, signInWithEmail, signUpWithEmail,
    requestPasswordReset, verifyTwoFactor, clearError,
  } = useAuth();
  const [username, setUsername] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [password, setPassword] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyBusy, setVerifyBusy] = useState(false);
  const navigate = useNavigate();
  const registering = mode === "register";

  useEffect(() => {
    if (status === "authenticated") navigate(needsCredentials ? "/account-setup" : (redirectTo || "/home"), { replace: true });
    else if (status === "two-factor") navigate(redirectTo || "/login", { replace: true });
  }, [status, needsCredentials, navigate, redirectTo]);

  if (status === "loading") return <div className="mx-auto flex min-h-[60vh] items-center justify-center text-sm text-brand-text-muted">Loading secure sign-in…</div>;

  const submitUsernameLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try { await signInWithUsername(username, password); }
    catch { /* AuthProvider displays the safe error. */ }
  };

  const submitEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      if (mode === "login") await signInWithEmail(emailAddress, emailPassword);
      else await signUpWithEmail(emailAddress, emailPassword);
    } catch { /* AuthProvider displays the safe error. */ }
  };

  const walletButtons = <>
    {ethereumWallets.length > 0
      ? ethereumWallets.map((wallet) => (
        <Button key={wallet.info.uuid} type="button" variant="outline" className="w-full justify-start" aria-busy={busy} disabled={busy || status !== "anonymous"} onClick={() => void signInWithWeb3("ethereum", wallet.provider)}>
          <Wallet className="mr-2 h-4 w-4" /> Continue with {wallet.info.name}
        </Button>
      ))
      : <Button type="button" variant="outline" className="w-full justify-start" aria-busy={busy} disabled={busy || status !== "anonymous"} onClick={() => void signInWithWeb3("ethereum")}>
        <Wallet className="mr-2 h-4 w-4" /> Connect Ethereum wallet
      </Button>}
    <Button type="button" variant="outline" className="w-full justify-start" aria-busy={busy} disabled={busy || status !== "anonymous"} onClick={() => void signInWithWeb3("solana")}>
      <Wallet className="mr-2 h-4 w-4" /> Connect Solana wallet
    </Button>
  </>;

  return <main className="tone-support relative mx-auto flex min-h-[100dvh] w-full max-w-[1120px] items-center px-3 py-6 sm:px-6 sm:py-10 lg:px-8">
    <div className="pointer-events-none absolute inset-x-8 top-8 -z-10 h-64 rounded-full bg-brand-cyan/10 blur-3xl" />
    <div className="grid w-full items-center gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(380px,.95fr)] lg:gap-12">
      <section className="hidden min-w-0 flex-col justify-center lg:flex">
        <Link to="/home" className="mb-12 w-fit"><BrandLogo /></Link>
        <p className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-brand-cyan"><span className="h-1.5 w-1.5 rounded-full bg-brand-success" /> Digital asset exchange</p>
        <h1 className="max-w-[560px] text-4xl font-semibold leading-[1.12] tracking-tight text-brand-text xl:text-5xl">
          {registering ? "A clearer way to enter the digital asset market." : "Welcome back to your market."}
        </h1>
        <p className="mt-5 max-w-[480px] text-base leading-7 text-brand-text-secondary">
          {registering
            ? "Create your BTCBOX account with email or Google, then confirm your email address or complete Google verification."
            : "Access your BTCBOX account with email, username, Google or a supported crypto wallet."}
        </p>
        <div className="mt-9 grid max-w-[520px] gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-brand-border bg-gradient-to-br from-brand-surface via-brand-surface to-brand-cyan/[0.035] p-4">
            <ChartNoAxesCombined className="mb-3 h-5 w-5 text-brand-cyan" />
            <p className="text-sm font-semibold text-brand-text">Public market access</p>
            <p className="mt-1 text-xs leading-5 text-brand-text-muted">Explore market information before signing in.</p>
          </div>
          <div className="rounded-xl border border-brand-border bg-gradient-to-br from-brand-surface via-brand-surface to-brand-success/[0.035] p-4">
            <ShieldCheck className="mb-3 h-5 w-5 text-brand-success" />
            <p className="text-sm font-semibold text-brand-text">Account-first controls</p>
            <p className="mt-1 text-xs leading-5 text-brand-text-muted">Personal assets and account actions stay protected.</p>
          </div>
        </div>
        <Link to="/markets" className="mt-8 inline-flex min-h-11 w-fit items-center gap-2 text-sm font-semibold text-brand-text-secondary transition-colors hover:text-brand-text">
          Explore public markets <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <div className="mx-auto w-full max-w-[480px]">
        <div className="mb-5 flex items-center justify-between lg:hidden">
          <Link to="/home" aria-label="BTCBOX home"><BrandLogo compact /></Link>
          <Link to="/markets" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-brand-text-secondary transition-colors hover:bg-brand-surface-hover hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/70">Explore markets <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
        <Card className="w-full border-brand-border bg-brand-surface shadow-2xl shadow-black/20 ring-1 ring-white/[0.025]">
          <CardHeader className="gap-3 px-5 pb-3 pt-6 sm:px-8 sm:pt-8">
            <div className="flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-cyan/20 bg-brand-cyan/10 text-brand-cyan">
                {status === "two-factor" ? <ShieldCheck className="h-5 w-5" /> : registering ? <Globe2 className="h-5 w-5" /> : <LockKeyhole className="h-5 w-5" />}
              </span>
              <span className="text-xs font-semibold uppercase tracking-[.16em] text-brand-text-muted">{registering ? "Join BTCBOX" : "Secure access"}</span>
            </div>
            <CardTitle className="text-2xl font-semibold tracking-tight">
              {status === "two-factor" ? "Verify your sign-in" : registering ? "Create your BTCBOX account" : "Welcome back"}
            </CardTitle>
            <CardDescription className="max-w-[380px] text-sm leading-6 text-brand-text-muted">
              {status === "two-factor"
                ? "Enter your authenticator code to finish signing in."
                : registering
                  ? "Register with your email address or Google account. Confirm your email to activate secure access."
                  : "Sign in with your email, BTCBOX username, Google account or supported crypto wallet."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-5 pb-6 sm:px-8 sm:pb-8">
            {error && <div role="alert" className="flex items-start justify-between gap-3 rounded-lg border border-loss/30 bg-loss/10 p-3 text-sm text-loss">
              <span className="min-w-0 break-words">{error}</span>
              <button type="button" aria-label="Dismiss sign-in error" className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg px-2 text-xs font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/70" onClick={clearError}>Dismiss</button>
            </div>}
            {notice && <div role="status" className="rounded-lg border border-brand-border bg-brand-surface-2 p-3 text-sm text-brand-text-secondary">{notice}</div>}

            {status === "two-factor" ? <form className="space-y-3" aria-busy={verifyBusy} onSubmit={async event => {
              event.preventDefault(); setVerifyBusy(true);
              try { await verifyTwoFactor(verifyCode); } catch { /* Safe error is displayed by AuthProvider. */ }
              finally { setVerifyBusy(false); }
            }}>
              <label className="block space-y-2 text-sm">
                <span className="text-brand-text-secondary">Authenticator code</span>
                <Input value={verifyCode} onChange={event => setVerifyCode(event.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" autoComplete="one-time-code" placeholder="Enter code" required />
              </label>
              <Button type="submit" className="w-full" disabled={verifyBusy || verifyCode.length < 6}>{verifyBusy ? "Verifying…" : "Verify and continue"}</Button>
            </form> : <>
              {mode === "login" && <form className="space-y-3" aria-busy={busy} onSubmit={submitUsernameLogin}>
                <label className="block space-y-1.5 text-sm">
                  <span className="text-brand-text-secondary">Username</span>
                  <Input value={username} onChange={event => setUsername(event.target.value.toLowerCase())} autoComplete="username" minLength={3} maxLength={24} pattern="[a-z0-9][a-z0-9_]{2,23}" placeholder="Enter your BTCBOX username" required />
                </label>
                <label className="block space-y-1.5 text-sm">
                  <span className="text-brand-text-secondary">Password</span>
                  <Input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" minLength={12} maxLength={128} placeholder="Enter your password" required />
                </label>
                <Button type="submit" className="w-full" aria-busy={busy} disabled={busy || username.length < 3 || password.length < 12}>
                  <KeyRound className="mr-2 h-4 w-4" /> {busy ? "Signing in…" : "Sign in with username"}
                </Button>
              </form>}

              {mode === "login" && <div className="relative py-1">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-brand-border" /></div>
                <div className="relative flex justify-center"><span className="bg-brand-surface px-3 text-xs text-brand-text-muted">OR CONTINUE WITH EMAIL</span></div>
              </div>}
              <form className="space-y-3 rounded-xl border border-brand-border bg-brand-surface-2 p-4" aria-busy={busy} onSubmit={submitEmail}>
                <p className="text-sm font-semibold text-brand-text">{mode === "login" ? "Continue with email" : "Register with email"}</p>
                <label className="block space-y-1.5 text-sm">
                  <span className="text-brand-text-secondary">Email address</span>
                  <Input type="email" value={emailAddress} onChange={event => setEmailAddress(event.target.value)} autoComplete="email" maxLength={254} placeholder="you@example.com" required />
                </label>
                <label className="block space-y-1.5 text-sm">
                  <span className="text-brand-text-secondary">Email password</span>
                  <Input type="password" value={emailPassword} onChange={event => setEmailPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "register" ? 8 : 1} maxLength={128} placeholder="Enter your password" required />
                </label>
                <Button type="submit" className="w-full" variant="outline" disabled={busy || status !== "anonymous" || !emailAddress.trim() || (mode === "register" ? emailPassword.length < 8 : !emailPassword)}>
                  {busy ? "Please wait…" : mode === "login" ? "Sign in with email" : "Create account with email"}
                </Button>
                {mode === "login" && <button type="button" className="min-h-11 text-sm font-medium text-brand-text-secondary underline underline-offset-4 disabled:opacity-50" disabled={busy || !emailAddress.trim()} onClick={() => void requestPasswordReset(emailAddress).catch(() => {})}>Forgot password?</button>}
              </form>
              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-brand-border" /></div>
                <div className="relative flex justify-center"><span className="bg-brand-surface px-3 text-xs text-brand-text-muted">{mode === "login" ? "OR CONTINUE WITH GOOGLE" : "OR SIGN UP WITH GOOGLE"}</span></div>
              </div>
              {googleEnabled
                ? <Button type="button" className="w-full" size="lg" aria-busy={busy} disabled={busy || status !== "anonymous"} onClick={() => void signInWithGoogle()}>
                    <Chrome className="mr-2 h-5 w-5" /> Continue with Google
                  </Button>
                : <div className="rounded-lg border border-brand-border bg-brand-surface-2 p-3 text-sm text-brand-text-muted" role="status">Google sign-in is temporarily unavailable.</div>}

              <div className="space-y-2">{walletButtons}</div>
            </>}

            <div className="border-t border-brand-border pt-4 text-center text-sm text-brand-text-secondary">
              {mode === "login"
                ? <>New to BTCBOX? <Link className="font-semibold text-brand-accent underline-offset-4 hover:underline" to="/register">Create account</Link></>
                : <>Already have an account? <Link className="font-semibold text-brand-accent underline-offset-4 hover:underline" to="/login">Sign in</Link></>}
            </div>
            <Link to="/home" className="flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-xs text-brand-text-muted transition-colors hover:bg-brand-surface-hover hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/70"><ArrowLeft className="h-3.5 w-3.5" /> Back to BTCBOX</Link>
          </CardContent>
        </Card>
        <p className="mt-4 flex items-center justify-center gap-2 text-center text-[11px] text-brand-text-muted"><ShieldCheck className="h-3.5 w-3.5 shrink-0" /> Protected account access · Public markets remain available without signing in</p>
      </div>
    </div>
  </main>;
}

export function AuthCallbackPage() {
  const { finishOAuth, status, needsCredentials, error, busy, completePasswordRecovery } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryError, setRecoveryError] = useState("");
  const navigate = useNavigate();
  useEffect(() => {
    if (status !== "loading" && status !== "authenticated" && status !== "two-factor" && status !== "password-recovery") void finishOAuth();
  }, [finishOAuth, status]);
  useEffect(() => {
    if (status === "authenticated") navigate(needsCredentials ? "/account-setup" : "/home", { replace: true });
    else if (status === "two-factor") navigate("/login", { replace: true });
  }, [status, needsCredentials, navigate]);
  const submitRecovery = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRecoveryError("");
    if (newPassword.length < 8 || newPassword.length > 128) {
      setRecoveryError("Use a password between 8 and 128 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setRecoveryError("The passwords do not match.");
      return;
    }
    try { await completePasswordRecovery(newPassword); }
    catch (cause) { setRecoveryError(cause instanceof Error ? cause.message : "Password could not be updated."); }
  };
  if (status === "password-recovery") return <main className="tone-support mx-auto flex min-h-[100dvh] w-full max-w-[520px] items-center px-3 py-8 sm:px-6">
    <Card className="w-full border-brand-border bg-brand-surface shadow-2xl shadow-black/20">
      <CardHeader className="gap-3 px-5 pt-7 sm:px-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-cyan/20 bg-brand-cyan/10 text-brand-cyan"><LockKeyhole className="h-5 w-5" /></div>
        <CardTitle className="text-2xl">Reset your password</CardTitle>
        <CardDescription>Choose a new password for your BTCBOX email account.</CardDescription>
      </CardHeader>
      <CardContent className="px-5 pb-7 sm:px-8">
        <form className="space-y-3" aria-busy={busy} onSubmit={submitRecovery}>
          <label className="block space-y-1.5 text-sm"><span className="text-brand-text-secondary">New password</span><Input type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} autoComplete="new-password" minLength={8} maxLength={128} required /></label>
          <label className="block space-y-1.5 text-sm"><span className="text-brand-text-secondary">Confirm new password</span><Input type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} maxLength={128} required /></label>
          {(recoveryError || error) && <p role="alert" className="rounded-lg border border-loss/30 bg-loss/10 p-3 text-sm text-loss">{recoveryError || error}</p>}
          <Button type="submit" className="w-full" disabled={busy || newPassword.length < 8 || newPassword !== confirmPassword}>{busy ? "Updating password…" : "Update password"}</Button>
        </form>
      </CardContent>
    </Card>
  </main>;
  return <div className="tone-support mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-3 p-6 text-center">
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-brand-accent" />
    <p role={error ? "alert" : "status"} aria-live={error ? "assertive" : "polite"} className="text-sm text-brand-text-secondary">{error || (busy ? "Completing secure sign-in…" : "Finishing sign-in…")}</p>
    {error && <Link to="/login" className="inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold underline underline-offset-4 transition-colors hover:bg-brand-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/70">Return to sign in</Link>}
  </div>;
}
