import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, ChevronRight, Copy, Lock, ShieldCheck, Wallet, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { TwoFactorCard } from "./TwoFactorCard";
import { PageFrame } from "../pages/Pages";
import { getAccount, type AccountSnapshot } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useAuthDialog } from "../../lib/auth-dialog";
import { DEV_OPEN_ACCOUNT_PAGES } from "../../lib/devAccess";
import { useI18n } from "../../lib/i18n";
import { normalizeKycStatus, kycStatusLabel } from "../../lib/status-mapping";

/**
 * Authentication initialization failures are reported by the local market
 * gateway in English operator copy. Translate that reply to a shipped message so
 * the localized account screen never renders an English alert.
 */
function localizedAuthError(message: string, t: (key: string) => string) {
  if (/AUTH_CLIENT_CONFIG_UNAVAILABLE|authentication is not configured for the local market gateway|BTCBOX authentication is not configured/i.test(message)) {
    return t("Authentication is unavailable. Please reload and try again.");
  }
  return message ? t(message) : "";
}

/**
 * Account security — minimal 3-block layout (identity card / login methods /
 * security settings). Complex verification flows fold into a bottom sheet.
 */
export function AccountSecurityPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { status, busy, error, notice, email, googleEnabled, ethereumWallets, identityLinkSourceVerified, identityLinkNeedsTwoFactor, reauthenticateIdentityLinkWithGoogle, reauthenticateIdentityLinkWithWeb3, completeIdentityLinkReauthTwoFactor, linkGoogleIdentity, linkWeb3Identity, setSupabaseLoginPassword } = useAuth();
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const { openAuthDialog } = useAuthDialog();
  const [loadError, setLoadError] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [sheet, setSheet] = useState<null | "link-ethereum" | "link-solana" | "link-google" | "password" | "2fa">(null);

  const refreshAccount = useCallback(async () => {
    try { setAccount(await getAccount()); setLoadError(""); }
    catch { setLoadError("Account security details are temporarily unavailable. Refresh to try again."); }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    getAccount().then((result) => {
      if (active) { setAccount(result); setLoadError(""); }
    }).catch((cause) => {
      if (active) setLoadError("Account security details are temporarily unavailable. Refresh to try again.");
    });
    return () => { active = false; };
  }, [status, notice]);

  if (status === "loading") return <PageFrame title={t("Security settings")} tone="account" backTo="/me"><div role="status" aria-live="polite" className="mx-auto flex min-h-[40vh] items-center justify-center text-sm text-brand-text-muted">{t("Loading account security…")}</div></PageFrame>;
  // Local development opens the page so the layout can be edited; a production
  // build still redirects because `import.meta.env.DEV` compiles to false.
  if (status !== "authenticated" && !DEV_OPEN_ACCOUNT_PAGES) return <Navigate to="/login" replace />;

  const identities = account?.linked_identities || [];
  const hasGoogle = identities.some((identity) => identity.provider === "google") || account?.auth_providers?.includes("google") === true;
  const hasEthereum = account?.wallet_chain === "ethereum" || identities.some((identity) => identity.provider === "web3" && identity.wallet_chain === "ethereum");
  const hasSolana = account?.wallet_chain === "solana" || identities.some((identity) => identity.provider === "web3" && identity.wallet_chain === "solana");
  const primaryAddress = account?.wallet_address || "";
  // A signed-out visitor must not be presented as a verified identity.
  const signedIn = status === "authenticated";
  const kycStatus = account ? normalizeKycStatus(account.kyc?.status) : "unknown";
  const primaryName = signedIn ? account?.username || email || "—" : t("Not signed in");
  const uid = account?.uid || "";

  const copyUid = async () => {
    if (!uid) return;
    try { await navigator.clipboard.writeText(uid); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } catch {}
  };
  const copyAddress = async () => {
    if (!primaryAddress) return;
    try { await navigator.clipboard.writeText(primaryAddress); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } catch {}
  };

  const openSheet = (kind: "link-ethereum" | "link-solana" | "link-google" | "password" | "2fa") => {
    setTwoFactorCode("");
    setNewPassword("");
    setConfirmNewPassword("");
    setSheet(kind);
  };

  const methodRows = [
    { key: "ethereum", label: "Ethereum wallet", linked: hasEthereum, value: account?.wallet_chain === "ethereum" ? primaryAddress : undefined, tone: "bg-brand-indigo/15 text-brand-indigo", onLink: () => openSheet("link-ethereum") },
    { key: "solana", label: "Solana wallet", linked: hasSolana, value: account?.wallet_chain === "solana" ? primaryAddress : undefined, tone: "bg-brand-violet/15 text-brand-violet", onLink: () => openSheet("link-solana") },
    { key: "google", label: "Google account", linked: hasGoogle, value: email || undefined, tone: "bg-brand-surface-hover text-brand-text-secondary", onLink: () => openSheet("link-google") },
  ] as const;

  return <div aria-busy={busy} className="tone-account relative mx-auto w-full max-w-2xl space-y-5 p-3 pb-24 sm:p-5">
    <div className="relative flex min-w-0 items-center gap-3 border-b border-brand-border pb-3">
      <button type="button" onClick={() => navigate("/me")} aria-label={t("Back")} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand-border text-brand-text-muted hover:border-brand-accent/40 hover:text-brand-text"><ArrowLeft className="h-4 w-4" /></button>
      <h1 className="type-page-title min-w-0 truncate text-brand-text">{t("Security settings")}</h1>
    </div>
    <div aria-hidden="true" className="pointer-events-none absolute -top-20 right-0 h-72 w-72 rounded-full bg-brand-accent/10 blur-[90px]" />
      {/* 1. Identity card */}
      <div className="relative overflow-hidden rounded-2xl border border-brand-accent/25 bg-gradient-to-br from-brand-accent/[0.16] via-brand-surface to-brand-surface p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-tr from-brand-accent to-brand-cyan text-sm font-bold text-black">
              {signedIn ? primaryName.charAt(0).toUpperCase() : <Lock className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-base font-semibold tracking-tight text-brand-text">{primaryName}</span>
                {(primaryAddress || uid) && (
                  <button type="button" onClick={() => (primaryAddress ? copyAddress() : copyUid())} aria-label={t("Copy")} className="text-brand-text-muted transition-colors hover:text-brand-accent">
                    {copied ? <Check className="h-3.5 w-3.5 text-brand-accent" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-brand-text-muted">
                <span className="truncate font-mono">{signedIn ? primaryAddress || `UID: ${uid}` : t("Sign in to view")}</span>
              </div>
            </div>
          </div>
          {signedIn ? (
            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${kycStatus === "verified" ? "border-brand-success/30 bg-brand-success/10 text-brand-success" : kycStatus === "rejected" ? "border-brand-danger/30 bg-brand-danger/10 text-brand-danger" : "border-brand-border bg-brand-surface-2 text-brand-text-muted"}`}>
              {kycStatusLabel(kycStatus, t)}
            </span>
          ) : (
            <Button type="button" size="sm" className="h-8 shrink-0 px-3 text-xs" onClick={() => openAuthDialog("login")}>
              {t("Sign in")}
            </Button>
          )}
        </div>
        {uid && <div className="mt-4 border-t border-white/10 pt-3 text-xs text-brand-text-muted">UID: {uid}</div>}
      </div>

      {localizedAuthError(error || loadError, t) && <p role="alert" className="rounded-xl border border-brand-danger/25 bg-brand-danger/[0.06] p-3 text-sm leading-6 text-brand-danger">{localizedAuthError(error || loadError, t)}</p>}
      {notice && <p role="status" className="rounded-xl border border-brand-success/20 bg-brand-success/[0.05] p-3 text-sm leading-6 text-brand-text-secondary">{t(notice)}</p>}

      {/* 2. Login methods */}
      <div>
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-brand-text-muted">{t("Login methods")}</h2>
        <div className="mt-2 overflow-hidden rounded-2xl border border-white/[0.06] bg-brand-surface divide-y divide-white/[0.05]">
          {methodRows.map((row) => (
            <button key={row.key} type="button" onClick={row.linked ? undefined : row.onLink} className="flex h-14 w-full items-center justify-between px-4 text-left transition-colors hover:bg-white/[0.02]">
              <span className="flex items-center gap-3">
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${row.tone}`}>
                  {row.key === "google" ? <span className="text-xs font-bold">G</span> : <Wallet className="h-4 w-4" />}
                </span>
                <span className="text-sm font-medium text-brand-text">{t(row.label)}</span>
              </span>
              <span className="flex items-center gap-1.5 text-xs">
                {row.linked ? (
                  <span className="truncate font-mono text-brand-text-muted">{row.value || t("Connected")}</span>
                ) : (
                  <span className="font-medium text-brand-accent">{t(row.key === "google" ? "Link Google" : row.key === "ethereum" ? "Link Ethereum wallet" : "Link Solana wallet")}</span>
                )}
                <ChevronRight className="h-4 w-4 text-brand-text-muted" />
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Security settings */}
      <div>
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-brand-text-muted">{t("Security settings")}</h2>
        <div className="mt-2 overflow-hidden rounded-2xl border border-white/[0.06] bg-brand-surface divide-y divide-white/[0.05]">
          <button type="button" onClick={() => openSheet("password")} className="flex h-14 w-full items-center justify-between px-4 text-left transition-colors hover:bg-white/[0.02]">
            <span className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-cyan/10 text-brand-cyan"><Lock className="h-4 w-4" /></span>
              <span className="text-sm font-medium text-brand-text">{t("Email sign-in password")}</span>
            </span>
            <span className="flex items-center gap-1.5 text-xs">
              <span className="text-brand-text-muted">{email ? t("Manage") : t("Unavailable")}</span>
              <ChevronRight className="h-4 w-4 text-brand-text-muted" />
            </span>
          </button>
          <button type="button" onClick={() => openSheet("2fa")} className="flex h-14 w-full items-center justify-between px-4 text-left transition-colors hover:bg-white/[0.02]">
            <span className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-teal/10 text-brand-teal"><ShieldCheck className="h-4 w-4" /></span>
              <span className="text-sm font-medium text-brand-text">{t("Two-factor authentication (2FA)")}</span>
            </span>
            <span className="flex items-center gap-1.5 text-xs">
              {account?.twofa_enabled ? (
                <span className="text-brand-text-muted">{t("Enabled")}</span>
              ) : (
                <span className="rounded-full border border-brand-accent/30 bg-brand-accent/10 px-2 py-0.5 font-medium text-brand-accent">{t("Recommended")}</span>
              )}
              <ChevronRight className="h-4 w-4 text-brand-text-muted" />
            </span>
          </button>

        </div>
      </div>

      {/* Bottom sheet */}
      {sheet && createPortal(
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSheet(null)}>
          <div className="w-full max-w-2xl rounded-t-2xl border border-brand-border bg-brand-surface-2 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <h3 className="text-lg font-bold text-brand-text">
                {sheet === "link-ethereum" && t("Connect Ethereum wallet")}
                {sheet === "link-solana" && t("Connect Solana wallet")}
                {sheet === "link-google" && t("Connect Google account")}
                {sheet === "password" && t("Change / reset password")}
                {sheet === "2fa" && t("Two-factor authentication")}
              </h3>
              <button type="button" onClick={() => setSheet(null)} className="rounded-full bg-white/5 p-1.5 text-brand-text-muted hover:text-brand-text" aria-label={t("Close")}><X className="h-4 w-4" /></button>
            </div>

            {(sheet === "link-ethereum" || sheet === "link-solana" || sheet === "link-google") && (
              <div className="space-y-3">
                {!identityLinkSourceVerified ? (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-accent">{t("Step 1 · Verify an existing method")}</p>
                    <p className="text-sm text-brand-text-secondary">{t("First verify a method already connected to this account.")}</p>
                    <div className="grid gap-2">
                      {hasGoogle && <Button variant="outline" aria-busy={busy} disabled={busy || !googleEnabled} onClick={() => void reauthenticateIdentityLinkWithGoogle()}>{t("Verify with Google")}</Button>}
                      {hasEthereum && <Button variant="outline" aria-busy={busy} disabled={busy} onClick={() => ethereumWallets.length > 1 ? undefined : void reauthenticateIdentityLinkWithWeb3("ethereum", twoFactorCode, ethereumWallets[0]?.provider)}>{t("Verify with Ethereum wallet")}</Button>}
                      {hasSolana && <Button variant="outline" aria-busy={busy} disabled={busy} onClick={() => void reauthenticateIdentityLinkWithWeb3("solana", twoFactorCode)}>{t("Verify with Solana wallet")}</Button>}
                    </div>
                    {identityLinkNeedsTwoFactor && (
                      <form className="space-y-2" aria-busy={busy} onSubmit={async (event) => { event.preventDefault(); if (busy) return; try { await completeIdentityLinkReauthTwoFactor(twoFactorCode); setTwoFactorCode(""); } catch {} }}>
                        <label className="block space-y-1.5 text-sm"><span className="text-brand-text-secondary">{t("Authenticator code (required when account 2FA is enabled)")}</span><Input value={twoFactorCode} onChange={(event) => setTwoFactorCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder={t("Enter your 2FA code")} required /></label>
                        <Button type="submit" className="w-full" aria-busy={busy} disabled={busy || twoFactorCode.length !== 6}>{t("Confirm existing identity")}</Button>
                      </form>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-accent">{t("Step 2 · Verify the new method")}</p>
                    <p className="text-sm text-brand-success">{t("Existing identity verified. Connect the new method.")}</p>
                    {sheet === "link-ethereum" && (
                      ethereumWallets.length > 1 ? (
                        <div className="space-y-2">{ethereumWallets.map((wallet) => <Button key={wallet.info.uuid} variant="outline" className="w-full justify-start" aria-busy={busy} disabled={busy || hasEthereum} onClick={() => void linkWeb3Identity("ethereum", wallet.provider)}><Wallet className="h-4 w-4" />{wallet.info.name}</Button>)}</div>
                      ) : (
                        <Button className="w-full" aria-busy={busy} disabled={busy || hasEthereum} onClick={() => void linkWeb3Identity("ethereum", ethereumWallets[0]?.provider)}><Wallet className="h-4 w-4" />{hasEthereum ? t("Ethereum connected") : t("Connect Ethereum wallet")}</Button>
                      )
                    )}
                    {sheet === "link-solana" && <Button className="w-full" aria-busy={busy} disabled={busy || hasSolana} onClick={() => void linkWeb3Identity("solana")}><Wallet className="h-4 w-4" />{hasSolana ? t("Solana connected") : t("Connect Solana wallet")}</Button>}
                    {sheet === "link-google" && <Button className="w-full" aria-busy={busy} disabled={busy || !googleEnabled || hasGoogle} onClick={() => void linkGoogleIdentity()}>G · {hasGoogle ? t("Google connected") : t("Connect Google account")}</Button>}
                  </div>
                )}
              </div>
            )}

            {sheet === "password" && (
              <form className="space-y-3" aria-busy={busy} onSubmit={async (event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                if (busy || newPassword !== confirmNewPassword || newPassword.length < 8) return;
                try {
                  await setSupabaseLoginPassword(newPassword);
                  setNewPassword(""); setConfirmNewPassword(""); setSheet(null);
                } catch {}
              }}>
                <p className="text-sm text-brand-text-secondary">{t("Set or change the password for this email sign-in method. This does not create or change a BTCBOX username password; your account and UID stay the same.")}</p>
                <label className="block space-y-1.5 text-sm"><span className="text-brand-text-secondary">{t("New password")}</span><Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={8} maxLength={128} placeholder={t("At least 8 characters")} required /></label>
                <label className="block space-y-1.5 text-sm"><span className="text-brand-text-secondary">{t("Confirm new password")}</span><Input type="password" value={confirmNewPassword} onChange={(event) => setConfirmNewPassword(event.target.value)} autoComplete="new-password" minLength={8} maxLength={128} required /></label>
                {confirmNewPassword && newPassword !== confirmNewPassword && <p role="alert" className="text-sm text-brand-danger">{t("Passwords do not match.")}</p>}
                {error && <p role="alert" className="text-sm text-brand-danger">{t(error)}</p>}
                <Button type="submit" className="w-full" aria-busy={busy} disabled={busy || newPassword.length < 8 || newPassword !== confirmNewPassword}>{t("Save new password")}</Button>
              </form>
            )}

            {sheet === "2fa" && (
              <div className="max-h-[70vh] space-y-3 overflow-y-auto overscroll-contain">
                <TwoFactorCard account={account} onChanged={() => { void refreshAccount(); }} />
                <Button className="w-full" variant="outline" onClick={() => setSheet(null)}>{t("Close")}</Button>
              </div>
            )}
          </div>
        </div>
      , document.body)}
    </div>
  ;
}

