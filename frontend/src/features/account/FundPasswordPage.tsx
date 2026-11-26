import { useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { useAuth } from "../../lib/auth";
import { DEV_OPEN_ACCOUNT_PAGES } from "../../lib/devAccess";
import { getAccount, setFundPassword, type AccountSnapshot } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { PageFrame } from "../pages/Pages";

export function FundPasswordPage() {
  const { t } = useI18n();
  const { status } = useAuth();
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (status !== "authenticated") { setLoading(false); return; }
    let active = true;
    getAccount().then((snapshot) => { if (active) setAccount(snapshot); })
      .catch(() => { if (active) setError("Account security details are temporarily unavailable. Refresh and try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [status]);

  if (status === "loading") return <PageFrame title={t("Fund password")} tone="account" backTo="/me"><div className="p-8 text-center text-sm text-brand-text-muted" role="status">{t("Loading…")}</div></PageFrame>;
  if (status !== "authenticated" && !DEV_OPEN_ACCOUNT_PAGES) return <Navigate to="/login" replace />;

  const requiresCurrentPassword = account?.has_login_password !== false;
  const validPassword = newPassword.length >= 8 && /[A-Za-z]/.test(newPassword) && /\d/.test(newPassword) && !/\s/.test(newPassword);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setError(""); setSuccess("");
    if (!validPassword) { setError("Use at least 8 characters with both letters and numbers, and no spaces."); return; }
    if (newPassword !== confirmPassword) { setError("The two fund passwords do not match."); return; }
    if (requiresCurrentPassword && !currentPassword) { setError("Enter your current login password to confirm this change."); return; }
    setBusy(true);
    try {
      await setFundPassword({
        fund_password: newPassword,
        ...(requiresCurrentPassword ? { current_password: currentPassword } : {}),
      });
      setSuccess("Fund password saved successfully.");
      setNewPassword(""); setConfirmPassword(""); setCurrentPassword("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Fund password could not be saved.");
    } finally { setBusy(false); }
  };

  return (
    <PageFrame title={t("Fund password")} tone="account" backTo="/me">
      <div className="mx-auto w-full max-w-xl space-y-4">
        <Card className="border-brand-border bg-brand-surface">
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-teal/10 text-brand-teal"><KeyRound className="h-5 w-5" /></span>
              <div><CardTitle>{t("Set or change fund password")}</CardTitle><CardDescription>{t("Create a separate password for account fund security. It is not your login password.")}</CardDescription></div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-brand-text-muted" role="status">{t("Loading account security…")}</p> : !account ? (
              <p className="text-sm text-brand-danger" role="alert">{t("Account security details could not be verified. Refresh the page before changing your fund password.")}</p>
            ) : (
              <form className="space-y-4" onSubmit={submit} autoComplete="off" aria-busy={busy}>
                <div className="rounded-lg border border-brand-border bg-brand-surface-2 p-3 text-sm text-brand-text-secondary">
                  <div className="flex items-center gap-2 font-semibold text-brand-text"><ShieldCheck className="h-4 w-4 text-brand-success" />{t("Account verification")}</div>
                  <p className="mt-1">{t("Fund password is stored separately from your login password. Never share it with anyone.")}</p>
                  <p className="mt-2">{requiresCurrentPassword ? t("For your security, enter your current login password below to confirm this change. You do not need to sign out or sign in again.") : t("For accounts using only Google or a wallet, a recent sign-in may be required to confirm this change.")}</p>
                </div>
                <label className="block space-y-1.5 text-sm"><span className="text-brand-text-secondary">{t("New fund password")}</span>
                  <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={8} maxLength={128} placeholder={t("At least 8 characters, letters and numbers")} required />
                </label>
                <label className="block space-y-1.5 text-sm"><span className="text-brand-text-secondary">{t("Confirm fund password")}</span>
                  <Input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} maxLength={128} placeholder={t("Re-enter fund password")} required />
                </label>
                {requiresCurrentPassword && <label className="block space-y-1.5 text-sm"><span className="text-brand-text-secondary">{t("Confirm current login password")}</span>
                  <Input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" placeholder={t("Enter current login password")} required />
                </label>}
                {error && <p className="text-sm text-brand-danger" role="alert">{t(error)}</p>}
                {success && <p className="text-sm text-brand-success" role="status">{t(success)}</p>}
                <Button type="submit" className="w-full" disabled={busy || loading}>{busy ? t("Saving…") : t("Save fund password")}</Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </PageFrame>
  );
}
