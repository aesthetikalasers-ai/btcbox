import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Chrome, ShieldCheck, ArrowLeft, Mail, Eye, EyeOff } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { useAuth } from "../../lib/auth";

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { status, busy, error, notice, googleEnabled, signInWithGoogle, signInWithEmail, signUpWithEmail, requestPasswordReset, verifyTwoFactor, clearError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [view, setView] = useState<"auth" | "forgot">("auth");
  const [verifyBusy, setVerifyBusy] = useState(false);
  const navigate = useNavigate();
  useEffect(() => { if (status === "authenticated") navigate("/home", { replace: true }); else if (status === "two-factor") navigate("/login", { replace: true }); }, [status, navigate]);
  if (status === "loading") return <div className="mx-auto flex min-h-[60vh] items-center justify-center text-sm text-brand-text-muted">Loading authentication…</div>;
  const submitEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      if (mode === "register") await signUpWithEmail(email, password);
      else await signInWithEmail(email, password);
    } catch {
      // AuthProvider stores the safe, user-visible error message.
    }
  };
  return <div className="mx-auto flex min-h-[calc(100dvh-150px)] w-full max-w-[480px] items-center justify-center p-4 sm:p-6">
    <Card className="w-full border-brand-border bg-brand-surface shadow-xl">
      <CardHeader className="gap-3 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-border bg-brand-surface-2"><ShieldCheck className="h-6 w-6 text-brand-text-secondary"/></div>
        <CardTitle className="text-xl">{status === "two-factor" ? "Two-step verification" : view === "forgot" ? "Reset your password" : mode === "login" ? "Welcome back" : "Create your BTCBOX account"}</CardTitle>
        <CardDescription>{status === "two-factor" ? "Enter the verification code from your authenticator app." : view === "forgot" ? "Enter your account email and we’ll send a reset link if it exists." : mode === "login" ? "Sign in with your email or Google account." : "Register with your email or Google account."}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <div role="alert" className="rounded-lg border border-loss/30 bg-loss/10 p-3 text-sm text-loss">{error}<button className="ml-2 underline" onClick={clearError}>Dismiss</button></div>}
        {notice && <div role="status" className="rounded-lg border border-brand-border bg-brand-surface-2 p-3 text-sm text-brand-text-secondary">{notice}</div>}
        {status === "two-factor" ? <form className="space-y-3" onSubmit={async e=>{e.preventDefault();setVerifyBusy(true);try{await verifyTwoFactor(code);navigate("/home",{replace:true});}catch{/* Error is shown by AuthProvider. */}finally{setVerifyBusy(false);}}}>
          <Input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,8))} inputMode="numeric" autoComplete="one-time-code" placeholder="Authentication code" aria-label="Authentication code" required/>
          <Button type="submit" className="w-full" disabled={verifyBusy || code.length < 6}>{verifyBusy ? "Verifying…" : "Verify and continue"}</Button>
        </form> : view === "forgot" ? <form className="space-y-3" onSubmit={async e=>{e.preventDefault();try{await requestPasswordReset(email);}catch{/* Error is shown by AuthProvider. */}}}>
          <label className="block space-y-1.5 text-sm"><span className="text-brand-text-secondary">Email address</span><Input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com" required/></label>
          <Button type="submit" className="w-full" disabled={busy || !email.trim()}>{busy ? "Sending…" : "Send reset link"}</Button>
          <button type="button" className="w-full text-sm text-brand-text-secondary underline" onClick={()=>setView("auth")}>Back to sign in</button>
        </form> : <>
          <form className="space-y-3" onSubmit={submitEmail}>
            <label className="block space-y-1.5 text-sm"><span className="text-brand-text-secondary">Email address</span><Input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com" required/></label>
            <label className="block space-y-1.5 text-sm"><span className="text-brand-text-secondary">Password</span><span className="relative block"><Input type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" minLength={8} required className="pr-12"/><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={()=>setShowPassword(v=>!v)} className="absolute inset-y-0 right-3 text-brand-text-muted">{showPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}</button></span></label>
            <Button type="submit" className="w-full" disabled={busy || status !== "anonymous"}><Mail className="h-4 w-4"/>{busy ? "Please wait…" : mode === "login" ? "Sign in with email" : "Create account with email"}</Button>
          </form>
          {mode === "login" && <button type="button" className="w-full text-right text-xs text-brand-text-secondary underline" onClick={()=>setView("forgot")}>Forgot password?</button>}
          {googleEnabled && <><div className="flex items-center gap-3 py-1"><div className="h-px flex-1 bg-brand-border"/><span className="text-xs text-brand-text-muted">OR</span><div className="h-px flex-1 bg-brand-border"/></div><Button className="w-full" size="lg" variant="outline" disabled={busy || status !== "anonymous"} onClick={signInWithGoogle}><Chrome className="h-5 w-5"/> Continue with Google</Button></>}
        </>}
        <div className="text-center text-xs text-brand-text-muted">{mode === "login" ? <>New to BTCBOX? <Link className="text-brand-text underline underline-offset-4" to="/register">Create account</Link></> : <>Already have an account? <Link className="text-brand-text underline underline-offset-4" to="/login">Sign in</Link></>}</div>
        <Link to="/home" className="flex items-center justify-center gap-2 text-xs text-brand-text-muted hover:text-brand-text"><ArrowLeft className="h-3.5 w-3.5"/> Back to BTCBOX</Link>
      </CardContent>
    </Card>
  </div>;
}

export function AuthCallbackPage() {
  const { finishOAuth, completePasswordRecovery, status, error, busy } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  useEffect(() => { if (status !== "loading" && status !== "authenticated" && status !== "two-factor" && status !== "password-recovery") void finishOAuth(); }, [finishOAuth, status]);
  useEffect(() => { if (status === "authenticated") navigate("/home", { replace: true }); else if (status === "two-factor") navigate("/login", { replace: true }); }, [status, navigate]);
  if (status === "password-recovery") return <div className="mx-auto flex min-h-[60vh] max-w-lg items-center justify-center p-6"><Card className="w-full border-brand-border bg-brand-surface"><CardHeader><CardTitle>Choose a new password</CardTitle><CardDescription>Enter and confirm your new BTCBOX password.</CardDescription></CardHeader><CardContent><form className="space-y-3" onSubmit={async e=>{e.preventDefault();if(password!==confirmPassword)return;setSaving(true);try{await completePasswordRecovery(password);}catch{/* Error is shown below. */}finally{setSaving(false);}}}><Input type="password" autoComplete="new-password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} placeholder="New password" required/><Input type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Confirm new password" required/>{password && confirmPassword && password!==confirmPassword && <p className="text-sm text-loss">Passwords do not match.</p>}<Button type="submit" className="w-full" disabled={saving || busy || password.length<8 || password!==confirmPassword}>{saving?"Updating…":"Update password"}</Button></form>{error && <p role="alert" className="mt-3 text-sm text-loss">{error}</p>}</CardContent></Card></div>;
  return <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-3 p-6 text-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-brand-accent"/><p className="text-sm text-brand-text-secondary">{error || (busy ? "Completing secure sign-in…" : "Finishing sign-in…")}</p>{error && <Link to="/login" className="text-sm underline">Return to sign in</Link>}</div>;
}
