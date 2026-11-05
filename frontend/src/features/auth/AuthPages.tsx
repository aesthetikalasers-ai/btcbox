import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Chrome, ShieldCheck, ArrowLeft } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { useAuth } from "../../lib/auth";

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { status, busy, error, signInWithGoogle, verifyTwoFactor, clearError } = useAuth();
  const [code, setCode] = useState("");
  const [verifyBusy, setVerifyBusy] = useState(false);
  const navigate = useNavigate();
  useEffect(() => { if (status === "authenticated") navigate("/home", { replace: true }); else if (status === "two-factor") navigate("/login", { replace: true }); }, [status, navigate]);
  if (status === "loading") return <div className="mx-auto flex min-h-[60vh] items-center justify-center text-sm text-brand-text-muted">Loading authentication…</div>;
  return <div className="mx-auto flex min-h-[calc(100dvh-150px)] w-full max-w-[480px] items-center justify-center p-4 sm:p-6">
    <Card className="w-full border-brand-border bg-brand-surface shadow-xl">
      <CardHeader className="gap-3 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-border bg-brand-surface-2"><ShieldCheck className="h-6 w-6 text-brand-text-secondary"/></div>
        <CardTitle className="text-xl">{status === "two-factor" ? "Two-step verification" : mode === "login" ? "Welcome back" : "Create your BTCBOX account"}</CardTitle>
        <CardDescription>{status === "two-factor" ? "Enter the verification code from your authenticator app." : mode === "login" ? "Sign in securely with your Google account." : "Continue with Google to create your account."}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <div role="alert" className="rounded-lg border border-loss/30 bg-loss/10 p-3 text-sm text-loss">{error}<button className="ml-2 underline" onClick={clearError}>Dismiss</button></div>}
        {status === "two-factor" ? <form className="space-y-3" onSubmit={async e=>{e.preventDefault();setVerifyBusy(true);try{await verifyTwoFactor(code);navigate("/home",{replace:true});}finally{setVerifyBusy(false);}}}>
          <Input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,8))} inputMode="numeric" autoComplete="one-time-code" placeholder="Authentication code" aria-label="Authentication code" required/>
          <Button type="submit" className="w-full" disabled={verifyBusy || code.length < 6}>{verifyBusy ? "Verifying…" : "Verify and continue"}</Button>
        </form> : <Button className="w-full" size="lg" disabled={busy || status !== "anonymous"} onClick={signInWithGoogle}><Chrome className="h-5 w-5"/> {busy ? "Connecting to Google…" : "Continue with Google"}</Button>}
        <div className="text-center text-xs text-brand-text-muted">{mode === "login" ? <>New to BTCBOX? <Link className="text-brand-text underline underline-offset-4" to="/register">Create account</Link></> : <>Already have an account? <Link className="text-brand-text underline underline-offset-4" to="/login">Sign in</Link></>}</div>
        <Link to="/home" className="flex items-center justify-center gap-2 text-xs text-brand-text-muted hover:text-brand-text"><ArrowLeft className="h-3.5 w-3.5"/> Back to BTCBOX</Link>
      </CardContent>
    </Card>
  </div>;
}

export function AuthCallbackPage() {
  const { finishOAuth, status, error, busy } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (status !== "loading" && status !== "authenticated" && status !== "two-factor") void finishOAuth(); }, [finishOAuth, status]);
  useEffect(() => { if (status === "authenticated") navigate("/home", { replace: true }); }, [status, navigate]);
  return <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-3 p-6 text-center">
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-brand-accent"/>
    <p className="text-sm text-brand-text-secondary">{error || (busy ? "Completing secure sign-in…" : status === "two-factor" ? "Additional verification required." : "Finishing sign-in…")}</p>
    {error && <Link to="/login" className="text-sm underline">Return to sign in</Link>}
  </div>;
}
