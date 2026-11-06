import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Chrome, ShieldCheck, Wallet, ChevronRight, CheckCircle2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { useAuth } from "../../lib/auth";

export function AuthPage({ mode, redirectTo }: { mode: "login" | "register"; redirectTo?: string }) {
  const { status, needsCredentials, busy, error, notice, googleEnabled, ethereumWallets, signInWithGoogle, signInWithWeb3, verifyTwoFactor, clearError } = useAuth();
  const [showWalletChoices, setShowWalletChoices] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyBusy, setVerifyBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "authenticated") navigate(needsCredentials ? "/account-setup" : (redirectTo || "/home"), { replace: true });
    else if (status === "two-factor") navigate(redirectTo || "/login", { replace: true });
  }, [status, needsCredentials, navigate, redirectTo]);

  if (status === "loading") return <div className="mx-auto flex min-h-[60vh] items-center justify-center text-sm text-brand-text-muted">Loading secure sign-in…</div>;

  const dappUrl = window.location.origin + window.location.pathname;
  const phantomBrowseUrl = "https://phantom.app/ul/browse/" + encodeURIComponent(dappUrl) + "?ref=" + encodeURIComponent(window.location.origin);
  const coinbaseDappUrl = "https://go.cb-w.com/dapp?cb_url=" + encodeURIComponent(dappUrl);

  return <main className="mx-auto flex min-h-[calc(100dvh-112px)] w-full max-w-[440px] items-center justify-center px-4 py-8 sm:px-6">
    <Card className="w-full border-brand-border bg-brand-surface shadow-xl">
      <CardHeader className="gap-3 px-5 pb-2 pt-6 text-center sm:px-8 sm:pt-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-surface-2 text-brand-text-secondary">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <CardTitle className="text-xl font-semibold tracking-tight">{status === "two-factor" ? "Verify your sign-in" : mode === "login" ? "Welcome back" : "Create your BTCBOX account"}</CardTitle>
        <CardDescription className="mx-auto max-w-[320px] text-sm leading-6 text-brand-text-muted">
          {status === "two-factor" ? "Enter the verification code to finish signing in." : mode === "login" ? "Sign in securely with your Google account or crypto wallet." : "Create your account with Google or a supported crypto wallet."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-6 sm:px-8 sm:pb-8">
        {error && <div role="alert" className="flex items-start justify-between gap-3 rounded-lg border border-loss/30 bg-loss/10 p-3 text-sm text-loss">
          <span className="min-w-0 break-words">{error}</span>
          <button type="button" className="shrink-0 underline underline-offset-4" onClick={clearError}>Dismiss</button>
        </div>}
        {notice && <div role="status" className="rounded-lg border border-brand-border bg-brand-surface-2 p-3 text-sm text-brand-text-secondary">{notice}</div>}

        {status === "two-factor" ? <form className="space-y-3" onSubmit={async event => {
          event.preventDefault(); setVerifyBusy(true);
          try { await verifyTwoFactor(verifyCode); } catch { /* Safe error is displayed by AuthProvider. */ }
          finally { setVerifyBusy(false); }
        }}>
          <label className="block space-y-2 text-sm">
            <span className="text-brand-text-secondary">Verification code</span>
            <input value={verifyCode} onChange={event => setVerifyCode(event.target.value.replace(/\\D/g, "").slice(0, 8))} inputMode="numeric" autoComplete="one-time-code" placeholder="Enter code" className="h-12 w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 text-base text-brand-text outline-none focus-visible:ring-2 focus-visible:ring-brand-text/50" required />
          </label>
          <Button type="submit" className="w-full" disabled={verifyBusy || verifyCode.length < 6}>{verifyBusy ? "Verifying…" : "Verify and continue"}</Button>
        </form> : <>
          {googleEnabled ? <Button className="w-full" size="lg" disabled={busy || status !== "anonymous"} onClick={() => void signInWithGoogle()}>
            <Chrome className="mr-2 h-5 w-5" /> Continue with Google
          </Button> : <div className="rounded-lg bg-brand-surface-2 p-3 text-sm text-brand-text-muted" role="status">Google sign-in is temporarily unavailable.</div>}

          <div className="flex items-center gap-3 py-1">
            <div className="h-px flex-1 bg-brand-border" />
            <span className="text-[11px] font-medium uppercase tracking-[.14em] text-brand-text-muted">Or use a wallet</span>
            <div className="h-px flex-1 bg-brand-border" />
          </div>

          <Button className="w-full justify-between" size="lg" variant="outline" disabled={busy || status !== "anonymous"} onClick={() => setShowWalletChoices(value => !value)}>
            <span className="flex items-center"><Wallet className="mr-2 h-5 w-5" /> Connect wallet</span>
            <ChevronRight className={"h-4 w-4 transition-transform " + (showWalletChoices ? "rotate-90" : "")} />
          </Button>

          {showWalletChoices && <div className="space-y-2 rounded-lg bg-brand-surface-2 p-3">
            <p className="px-1 text-xs text-brand-text-muted">Choose the network for your wallet signature. No blockchain transaction will be sent.</p>
            <Button className="w-full justify-between" size="lg" variant="outline" disabled={busy} onClick={() => void signInWithWeb3("ethereum")}>
              <span className="flex items-center"><Wallet className="mr-2 h-4 w-4" /> Ethereum / EVM</span>
              <span className="text-xs text-brand-text-muted">{ethereumWallets.length ? ethereumWallets.length + " detected" : "Connect"}</span>
            </Button>
            {ethereumWallets.length > 0 && <div className="space-y-1 pl-2">
              {ethereumWallets.map(wallet => <button key={wallet.info.uuid} type="button" disabled={busy} onClick={() => void signInWithWeb3("ethereum", wallet.provider)} className="flex min-h-10 w-full items-center justify-between rounded-md px-3 text-left text-sm text-brand-text-secondary hover:bg-brand-surface-hover disabled:opacity-50">
                <span>{wallet.info.name}</span><CheckCircle2 className="h-3.5 w-3.5 text-profit" />
              </button>)}
            </div>}
            <Button className="w-full justify-between" size="lg" variant="outline" disabled={busy} onClick={() => void signInWithWeb3("solana")}>
              <span className="flex items-center"><Wallet className="mr-2 h-4 w-4" /> Solana</span>
              <span className="text-xs text-brand-text-muted">Connect</span>
            </Button>
          </div>}

          <p className="text-center text-xs leading-5 text-brand-text-muted">
            Wallet sign-in verifies ownership with a signature only. It never requests a transfer or token approval.
          </p>
          <div className="rounded-lg border border-brand-border px-3 py-3">
            <p className="text-sm font-medium text-brand-text">On mobile?</p>
            <p className="mt-1 text-xs leading-5 text-brand-text-muted">Open BTCBOX in your wallet app’s built-in browser, then choose Connect wallet.</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <a className="inline-flex min-h-9 items-center text-brand-text-secondary underline underline-offset-4" href={phantomBrowseUrl} target="_blank" rel="noreferrer">Open in Phantom</a>
              <a className="inline-flex min-h-9 items-center text-brand-text-secondary underline underline-offset-4" href={coinbaseDappUrl} target="_blank" rel="noreferrer">Open in Coinbase Wallet</a>
            </div>
          </div>
        </>}

        <div className="border-t border-brand-border pt-4 text-center text-sm text-brand-text-secondary">
          {mode === "login" ? <>New to BTCBOX? <Link className="font-medium text-brand-text underline underline-offset-4" to="/register">Create account</Link></> : <>Already have an account? <Link className="font-medium text-brand-text underline underline-offset-4" to="/login">Sign in</Link></>}
        </div>
        <Link to="/home" className="flex min-h-10 items-center justify-center gap-2 text-xs text-brand-text-muted hover:text-brand-text"><ArrowLeft className="h-3.5 w-3.5" /> Back to BTCBOX</Link>
      </CardContent>
    </Card>
  </main>;
}

export function AuthCallbackPage() {
  const { finishOAuth, completePasswordRecovery, status, needsCredentials, error, busy } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  useEffect(() => { if (status !== "loading" && status !== "authenticated" && status !== "two-factor" && status !== "password-recovery") void finishOAuth(); }, [finishOAuth, status]);
  useEffect(() => { if (status === "authenticated") navigate(needsCredentials ? "/account-setup" : "/home", { replace: true }); else if (status === "two-factor") navigate("/login", { replace: true }); }, [status, needsCredentials, navigate]);
  if (status === "password-recovery") return <div className="mx-auto flex min-h-[60vh] max-w-lg items-center justify-center p-6"><Card className="w-full border-brand-border bg-brand-surface"><CardHeader><CardTitle>Choose a new password</CardTitle><CardDescription>Enter and confirm your new BTCBOX password.</CardDescription></CardHeader><CardContent><form className="space-y-3" onSubmit={async event => { event.preventDefault(); if (password !== confirmPassword) return; setSaving(true); try { await completePasswordRecovery(password); } catch { /* Error is shown below. */ } finally { setSaving(false); } }}><input type="password" autoComplete="new-password" minLength={12} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 12 characters" className="h-12 w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 text-base text-brand-text" required /><input type="password" autoComplete="new-password" minLength={12} maxLength={128} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} placeholder="Confirm new password" className="h-12 w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 text-base text-brand-text" required />{password && confirmPassword && password !== confirmPassword && <p className="text-sm text-loss">Passwords do not match.</p>}<Button type="submit" className="w-full" disabled={saving || busy || password.length < 12 || password.length > 128 || password !== confirmPassword}>{saving ? "Updating…" : "Update password"}</Button></form>{error && <p role="alert" className="mt-3 text-sm text-loss">{error}</p>}</CardContent></Card></div>;
  return <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-3 p-6 text-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-brand-accent" /><p className="text-sm text-brand-text-secondary">{error || (busy ? "Completing secure sign-in…" : "Finishing sign-in…")}</p>{error && <Link to="/login" className="text-sm underline">Return to sign in</Link>}</div>;
}
