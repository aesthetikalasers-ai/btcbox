import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LockKeyhole } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";

/**
 * OAuth / email-link callback handler.
 *
 * Completes the Supabase redirect, then either enters the application, asks for
 * a second factor, or renders the password-recovery form. A failed callback
 * always offers a visible route back to sign in instead of a dead end.
 */
export function AuthCallbackPage() {
  const { t } = useI18n();
  const { finishOAuth, status, error, busy, completePasswordRecovery } = useAuth();
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
    if (status === "authenticated") navigate(callbackIntent === "register" ? "/me" : "/home", { replace: true });
    else if (status === "two-factor") navigate("/login", { replace: true });
  }, [status, navigate, callbackIntent]);
  useEffect(() => {
    if (!error || status !== "anonymous") return;
    const redirectId = window.setTimeout(() => navigate(effectiveDestination, { replace: true }), 6000);
    return () => window.clearTimeout(redirectId);
  }, [effectiveDestination, error, navigate, status]);

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
    <Card className="w-full overflow-hidden border-brand-accent/20 bg-brand-surface  ">
      <div className="h-1 bg-brand-accent"/>
      <CardHeader className="gap-3 border-b border-brand-border/70 bg-brand-surface px-5 pt-7 sm:px-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-accent/20 bg-brand-accent/10 text-brand-accent"><LockKeyhole className="h-5 w-5" /></div>
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
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-border border-t-brand-accent" />
    <p role={error ? "alert" : "status"} aria-live={error ? "assertive" : "polite"} className="text-sm text-brand-text-secondary">{error ? t(error) : busy ? t("Completing secure sign-in…") : t("Finishing sign-in…")}</p>
    {error && <Link to={callbackDestination} className="inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold underline underline-offset-4 transition-colors hover:bg-brand-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/70">{t("Return to sign in")}</Link>}
  </div>;
}
