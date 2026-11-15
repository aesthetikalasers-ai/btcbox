import { useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { Check, ChevronRight, Copy, Lock, ShieldCheck, Smartphone, Wallet, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { getAccount, type AccountSnapshot } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";

/**
 * Account security — minimal 3-block layout (identity card / login methods /
 * security settings). Complex verification flows fold into a bottom sheet.
 */
export function AccountSecurityPage() {
  const { t } = useI18n();
  const { status, busy, error, notice, email, googleEnabled, ethereumWallets, identityLinkSourceVerified, identityLinkNeedsTwoFactor, reauthenticateIdentityLinkWithGoogle, reauthenticateIdentityLinkWithWeb3, completeIdentityLinkReauthTwoFactor, linkGoogleIdentity, linkWeb3Identity, credentialRecoveryReady, credentialRecoveryNeedsTwoFactor, reauthenticateCredentialsWithGoogle, reauthenticateCredentialsWithWeb3, completeCredentialRecoveryTwoFactor, recoverBtcboxPassword } = useAuth();
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [loadError, setLoadError] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [sheet, setSheet] = useState<null | "link-ethereum" | "link-solana" | "link-google" | "password" | "2fa">(null);

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

  if (status === "loading") return <div role="status" aria-live="polite" className="mx-auto flex min-h-[40vh] items-center justify-center text-sm text-brand-text-muted">{t("Loading account security…")}</div>;
  if (status !== "authenticated") return <Navigate to="/login" replace />;

  const identities = account?.linked_identities || [];
  const hasGoogle = identities.some((identity) => identity.provider === "google") || account?.auth_providers?.includes("google") === true;
  const hasEthereum = account?.wallet_chain === "ethereum" || identities.some((identity) => identity.provider === "web3" && identity.wallet_chain === "ethereum");
  const hasSolana = account?.wallet_chain === "solana" || identities.some((identity) => identity.provider === "web3" && identity.wallet_chain === "solana");
  const primaryAddress = account?.wallet_address || "";
  const primaryName = account?.username || email || "BTCBOX user";
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
    <div aria-hidden="true" className="pointer-events-none absolute -top-20 right-0 h-72 w-72 rounded-full bg-brand-accent/10 blur-[90px]" />
      {/* 1. Identity card */}
      <div className="relative overflow-hidden rounded-2xl border border-brand-accent/25 bg-gradient-to-br from-brand-accent/[0.16] via-brand-surface to-brand-surface p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-tr from-brand-accent to-brand-cyan text-sm font-bold text-black">
              {primaryName.charAt(0).toUpperCase()}
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
                <span className="truncate font-mono">{primaryAddress || `UID: ${uid}`}</span>
              </div>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-brand-accent/30 bg-brand-accent/10 px-2.5 py-1 text-xs font-semibold text-brand-accent">
            {t("Verified")}
          </span>
        </div>
        {uid && <div className="mt-4 border-t border-white/10 pt-3 text-xs text-brand-text-muted">UID: {uid}</div>}
      </div>

      {(error || loadError) && <p role="alert" className="rounded-xl border border-brand-danger/25 bg-brand-danger/[0.06] p-3 text-sm leading-6 text-brand-danger">{t(error || loadError)}</p>}
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
              <span className="text-sm font-medium text-brand-text">{t("Login password")}</span>
            </span>
            <span className="flex items-center gap-1.5 text-xs">
              <span className="text-brand-text-muted">{account?.has_login_password ? t("Set") : t("Not set")}</span>
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
          <button type="button" className="flex h-14 w-full items-center justify-between px-4 text-left transition-colors hover:bg-white/[0.02]">
            <span className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-violet/10 text-brand-violet"><Smartphone className="h-4 w-4" /></span>
              <span className="text-sm font-medium text-brand-text">{t("Device management")}</span>
            </span>
            <span className="flex items-center gap-1.5 text-xs">
              <span className="text-brand-text-muted">{t("Current device")}</span>
              <ChevronRight className="h-4 w-4 text-brand-text-muted" />
            </span>
          </button>
        </div>
      </div>

      {/* Bottom sheet */}
      {sheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSheet(null)}>
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
              <div className="space-y-3">
                {credentialRecoveryReady ? (
                  <form className="space-y-3" aria-busy={busy} onSubmit={async (event: FormEvent<HTMLFormElement>) => {
                    event.preventDefault();
                    if (busy || newPassword !== confirmNewPassword) return;
                    try { await recoverBtcboxPassword(newPassword); setNewPassword(""); setConfirmNewPassword(""); setSheet(null); } catch {}
                  }}>
                    <label className="block space-y-1.5 text-sm"><span className="text-brand-text-secondary">{t("New password")}</span><Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={12} maxLength={128} placeholder={t("At least 12 characters")} required /></label>
                    <label className="block space-y-1.5 text-sm"><span className="text-brand-text-secondary">{t("Confirm new password")}</span><Input type="password" value={confirmNewPassword} onChange={(event) => setConfirmNewPassword(event.target.value)} autoComplete="new-password" minLength={12} maxLength={128} required /></label>
                    {confirmNewPassword && newPassword !== confirmNewPassword && <p role="alert" className="text-sm text-brand-danger">{t("Passwords do not match.")}</p>}
                    <Button type="submit" className="w-full" aria-busy={busy} disabled={busy || newPassword.length < 12 || newPassword !== confirmNewPassword}>{t("Save new password")}</Button>
                  </form>
                ) : credentialRecoveryNeedsTwoFactor ? (
                  <form className="space-y-3" aria-busy={busy} onSubmit={async (event) => { event.preventDefault(); if (busy) return; try { await completeCredentialRecoveryTwoFactor(twoFactorCode); setTwoFactorCode(""); } catch {} }}>
                    <label className="block space-y-1.5 text-sm"><span className="text-brand-text-secondary">{t("Authenticator code")}</span><Input value={twoFactorCode} onChange={(event) => setTwoFactorCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder={t("Enter your 2FA code")} required /></label>
                    <Button type="submit" className="w-full" aria-busy={busy} disabled={busy || twoFactorCode.length < 6}>{t("Verify and continue")}</Button>
                  </form>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-brand-text-secondary">{t("Verify a connected Google account or wallet to open a reset window.")}</p>
                    <div className="grid gap-2">
                      {hasGoogle && <Button variant="outline" aria-busy={busy} disabled={busy || !googleEnabled} onClick={() => void reauthenticateCredentialsWithGoogle()}>{t("Verify with Google")}</Button>}
                      {hasEthereum && <Button variant="outline" aria-busy={busy} disabled={busy} onClick={() => ethereumWallets.length > 1 ? undefined : void reauthenticateCredentialsWithWeb3("ethereum", twoFactorCode, ethereumWallets[0]?.provider)}>{t("Verify with Ethereum wallet")}</Button>}
                      {hasSolana && <Button variant="outline" aria-busy={busy} disabled={busy} onClick={() => void reauthenticateCredentialsWithWeb3("solana", twoFactorCode)}>{t("Verify with Solana wallet")}</Button>}
                    </div>
                    {!hasGoogle && !hasEthereum && !hasSolana && <p className="text-sm text-brand-text-muted">{t("No connected method available for password recovery.")}</p>}
                  </div>
                )}
              </div>
            )}

            {sheet === "2fa" && (
              <div className="space-y-3">
                <p className="text-sm text-brand-text-secondary">{account?.twofa_enabled ? t("Two-factor authentication is enabled on this account.") : t("Enable two-factor authentication to protect your account.")}</p>
                <Button className="w-full" variant="outline" onClick={() => setSheet(null)}>{t("Close")}</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  ;
}

