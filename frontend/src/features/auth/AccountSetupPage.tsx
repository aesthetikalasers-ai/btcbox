import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { useAuth } from "../../lib/auth";

export function AccountSetupPage() {
  const { status, needsCredentials, busy, error, notice, setBtcboxCredentials } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "authenticated" && !needsCredentials) navigate("/home", { replace: true });
  }, [status, needsCredentials, navigate]);

  if (status === "loading") return <div className="mx-auto flex min-h-[60vh] items-center justify-center text-sm text-brand-text-muted">Checking your BTCBOX account…</div>;
  if (status !== "authenticated") return <Navigate to="/login" replace />;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== confirmPassword) return;
    try { await setBtcboxCredentials(username, password); navigate("/home", { replace: true }); }
    catch { /* AuthProvider displays the safe error. */ }
  };

  return <div className="tone-support mx-auto flex min-h-[100dvh] w-full max-w-[520px] items-center justify-center p-4 sm:p-6">
    <Card className="w-full overflow-hidden border-brand-indigo/20 bg-brand-surface shadow-xl">
      <CardHeader className="gap-3 border-b border-brand-border/70 bg-gradient-to-br from-brand-indigo/[0.08] via-brand-surface to-brand-surface p-6 text-center sm:p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-indigo/20 bg-brand-indigo/[0.08]"><ShieldCheck className="h-6 w-6 text-brand-indigo"/></div>
        <CardTitle className="text-xl">Set up your BTCBOX account</CardTitle>
        <CardDescription>Your Google account or wallet is verified. Now create a BTCBOX username and password. They will belong to this same account and its existing records.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-5 sm:p-7">
        {error && <p role="alert" className="rounded-xl border border-brand-danger/25 bg-brand-danger/[0.06] p-3 text-sm leading-6 text-brand-danger">{error}</p>}
        {notice && <p role="status" className="rounded-xl border border-brand-success/20 bg-brand-success/[0.05] p-3 text-sm leading-6 text-brand-text-secondary">{notice}</p>}
        <form className="space-y-4" aria-busy={busy} onSubmit={submit}>
          <label className="block space-y-1.5 text-sm"><span className="text-brand-text-secondary">Choose a username</span><Input value={username} onChange={e=>setUsername(e.target.value.toLowerCase())} autoComplete="username" minLength={3} maxLength={24} pattern="[a-z0-9][a-z0-9_]{2,23}" placeholder="3–24 letters, numbers or underscores" required/></label>
          <label className="block space-y-1.5 text-sm"><span className="text-brand-text-secondary">Create a password</span><Input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" minLength={12} maxLength={128} placeholder="At least 12 characters" required/></label>
          <label className="block space-y-1.5 text-sm"><span className="text-brand-text-secondary">Confirm password</span><Input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} autoComplete="new-password" minLength={12} maxLength={128} placeholder="Enter the password again" required/></label>
          {confirmPassword && password !== confirmPassword && <p role="alert" className="rounded-lg border border-brand-danger/20 bg-brand-danger/[0.05] px-3 py-2 text-sm text-brand-danger">Passwords do not match.</p>}
          <Button type="submit" className="w-full" aria-busy={busy} disabled={busy || username.length < 3 || password.length < 12 || password !== confirmPassword}><KeyRound className="h-4 w-4"/>{busy ? "Saving securely…" : "Save BTCBOX credentials"}</Button>
        </form>
      </CardContent>
    </Card>
  </div>;
}
