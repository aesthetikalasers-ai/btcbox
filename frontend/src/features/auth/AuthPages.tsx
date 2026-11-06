import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Chrome, KeyRound, ShieldCheck, Wallet } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { useAuth } from "../../lib/auth";

export function AuthPage({ mode, redirectTo }: { mode: "login" | "register"; redirectTo?: string }) {
  const {
    status, needsCredentials, busy, error, notice, googleEnabled, ethereumWallets,
    signInWithGoogle, signInWithUsername, signInWithWeb3, verifyTwoFactor, clearError,
  } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyBusy, setVerifyBusy] = useState(false);
  const navigate = useNavigate();

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

  const walletButtons = <>
    {ethereumWallets.length > 0
      ? ethereumWallets.map((wallet) => (
        <Button key={wallet.info.uuid} type="button" variant="outline" className="w-full" disabled={busy || status !== "anonymous"} onClick={() => void signInWithWeb3("ethereum", wallet.provider)}>
          <Wallet className="mr-2 h-4 w-4" /> Continue with {wallet.info.name}
        </Button>
      ))
      : <Button type="button" variant="outline" className="w-full" disabled={busy || status !== "anonymous"} onClick={() => void signInWithWeb3("ethereum")}>
        <Wallet className="mr-2 h-4 w-4" /> Connect Ethereum wallet
      </Button>}
    <Button type="button" variant="outline" className="w-full" disabled={busy || status !== "anonymous"} onClick={() => void signInWithWeb3("solana")}>
      <Wallet className="mr-2 h-4 w-4" /> Connect Solana wallet
    </Button>
  </>;

  return <main className="mx-auto flex min-h-[calc(100dvh-112px)] w-full max-w-[440px] items-center justify-center px-4 py-8 sm:px-6">
    <Card className="w-full border-brand-border bg-brand-surface shadow-xl">
      <CardHeader className="gap-3 px-5 pb-2 pt-6 text-center sm:px-8 sm:pt-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-surface-2 text-brand-text-secondary">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <CardTitle className="text-xl font-semibold tracking-tight">
          {status === "two-factor" ? "Verify your sign-in" : mode === "login" ? "Welcome back" : "Create your BTCBOX account"}
        </CardTitle>
        <CardDescription className="mx-auto max-w-[320px] text-sm leading-6 text-brand-text-muted">
          {status === "two-factor"
            ? "Enter your authenticator code to finish signing in."
            : mode === "login"
              ? "Sign in with your BTCBOX username, Google account or crypto wallet."
              : "Create your account with Google or a supported crypto wallet. You will set a BTCBOX username and password after verification."}
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
            <span className="text-brand-text-secondary">Authenticator code</span>
            <Input value={verifyCode} onChange={event => setVerifyCode(event.target.value.replace(/\\D/g, "").slice(0, 8))} inputMode="numeric" autoComplete="one-time-code" placeholder="Enter code" required />
          </label>
          <Button type="submit" className="w-full" disabled={verifyBusy || verifyCode.length < 6}>{verifyBusy ? "Verifying…" : "Verify and continue"}</Button>
        </form> : <>
          {mode === "login" && <form className="space-y-3" onSubmit={submitUsernameLogin}>
            <label className="block space-y-1.5 text-sm">
              <span className="text-brand-text-secondary">Username</span>
              <Input value={username} onChange={event => setUsername(event.target.value.toLowerCase())} autoComplete="username" minLength={3} maxLength={24} pattern="[a-z0-9][a-z0-9_]{2,23}" placeholder="Enter your BTCBOX username" required />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="text-brand-text-secondary">Password</span>
              <Input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" minLength={12} maxLength={128} placeholder="Enter your password" required />
            </label>
            <Button type="submit" className="w-full" disabled={busy || username.length < 3 || password.length < 12}>
              <KeyRound className="mr-2 h-4 w-4" /> {busy ? "Signing in…" : "Sign in with username"}
            </Button>
          </form>}

          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-brand-border" /></div>
            <div className="relative flex justify-center"><span className="bg-brand-surface px-3 text-xs text-brand-text-muted">OR CONTINUE WITH</span></div>
          </div>

          {googleEnabled
            ? <Button type="button" className="w-full" size="lg" disabled={busy || status !== "anonymous"} onClick={() => void signInWithGoogle()}>
              <Chrome className="mr-2 h-5 w-5" /> Continue with Google
            </Button>
            : <div className="rounded-lg bg-brand-surface-2 p-3 text-sm text-brand-text-muted" role="status">Google sign-in is temporarily unavailable.</div>}

          <div className="space-y-2">{walletButtons}</div>
        </>}

        <div className="border-t border-brand-border pt-4 text-center text-sm text-brand-text-secondary">
          {mode === "login"
            ? <>New to BTCBOX? <Link className="font-medium text-brand-text underline underline-offset-4" to="/register">Create account</Link></>
            : <>Already have an account? <Link className="font-medium text-brand-text underline underline-offset-4" to="/login">Sign in</Link></>}
        </div>
        <Link to="/home" className="flex min-h-10 items-center justify-center gap-2 text-xs text-brand-text-muted hover:text-brand-text"><ArrowLeft className="h-3.5 w-3.5" /> Back to BTCBOX</Link>
      </CardContent>
    </Card>
  </main>;
}

export function AuthCallbackPage() {
  const { finishOAuth, status, needsCredentials, error, busy } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (status !== "loading" && status !== "authenticated" && status !== "two-factor") void finishOAuth(); }, [finishOAuth, status]);
  useEffect(() => {
    if (status === "authenticated") navigate(needsCredentials ? "/account-setup" : "/home", { replace: true });
    else if (status === "two-factor") navigate("/login", { replace: true });
  }, [status, needsCredentials, navigate]);
  return <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-3 p-6 text-center">
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-brand-accent" />
    <p className="text-sm text-brand-text-secondary">{error || (busy ? "Completing secure sign-in…" : "Finishing sign-in…")}</p>
    {error && <Link to="/login" className="text-sm underline">Return to sign in</Link>}
  </div>;
}
