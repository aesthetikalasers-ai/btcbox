import { useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { Link2, ShieldCheck, Wallet } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Alert } from "../../components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { getAccount, type AccountSnapshot } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";

export function AccountSecurityPage() {
  const { t } = useI18n();
  const { status, busy, error, notice, googleEnabled, ethereumWallets, identityLinkSourceVerified, identityLinkNeedsTwoFactor, reauthenticateIdentityLinkWithGoogle, reauthenticateIdentityLinkWithWeb3, completeIdentityLinkReauthTwoFactor, linkGoogleIdentity, linkWeb3Identity, credentialRecoveryReady, credentialRecoveryNeedsTwoFactor, reauthenticateCredentialsWithGoogle, reauthenticateCredentialsWithWeb3, completeCredentialRecoveryTwoFactor, recoverBtcboxPassword } = useAuth();
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [loadError, setLoadError] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [showLinkEthereumWallets, setShowLinkEthereumWallets] = useState(false);
  const [showSourceEthereumWallets, setShowSourceEthereumWallets] = useState(false);
  const [showRecoveryEthereumWallets, setShowRecoveryEthereumWallets] = useState(false);

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
  const linkedMethodCount = identities.length || [hasGoogle, hasEthereum, hasSolana].filter(Boolean).length;

  return <div aria-busy={busy} className="tone-account mx-auto w-full max-w-5xl space-y-5 p-3 pb-24 sm:space-y-6 sm:p-5 lg:p-7">
    <div className="flex flex-col justify-between gap-4 rounded-panel border border-brand-accent/25 bg-brand-surface p-5 sm:flex-row sm:items-center sm:p-6" style={{ backgroundImage: "radial-gradient(ellipse at top left, color-mix(in srgb, var(--color-brand-accent) 9%, transparent), transparent 55%)" }}>
      <div className="flex min-w-0 items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent"><ShieldCheck className="h-6 w-6"/></span><div><p className="type-meta font-semibold uppercase tracking-[.16em] page-accent">{t("Account center")}</p><h1 className="mt-1 text-xl font-semibold tracking-tight text-brand-text sm:text-2xl">{t("Account security")}</h1><p className="mt-1 max-w-xl text-sm leading-6 text-brand-text-muted">{t("Manage verified sign-in methods and protect access to your BTCBOX account.")}</p></div></div>
      <span className="inline-flex w-fit items-center gap-2 rounded-md border border-brand-success/25 bg-brand-success/[.07] px-3 py-1.5 text-xs font-semibold text-brand-success"><span className="h-1.5 w-1.5 rounded-full bg-brand-success"/>{account ? t("Account details loaded") : t("Checking account")}</span>
    </div>
    {(error || loadError) && <Alert tone="danger">{t(error || loadError)}</Alert>}
    {notice && <Alert tone="success">{t(notice)}</Alert>}
    <section aria-label={t("Security overview")} className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3">
      <Card className="border-brand-border bg-brand-surface"><CardContent className="flex items-center gap-3 p-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent"><Link2 className="h-5 w-5"/></span><div className="min-w-0"><p className="type-meta text-brand-text-muted">{t("Connected methods")}</p><p className="mt-1 text-lg font-semibold tabular-nums text-brand-text">{account ? linkedMethodCount : "—"}</p><p className="type-meta text-brand-text-muted">{t("Verified identity links")}</p></div></CardContent></Card>
      <Card className="border-brand-border bg-brand-surface"><CardContent className="flex items-center gap-3 p-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent"><ShieldCheck className="h-5 w-5"/></span><div className="min-w-0"><p className="type-meta text-brand-text-muted">{t("Two-factor authentication")}</p><p className="mt-1 text-lg font-semibold text-brand-text">{account ? account.twofa_enabled ? t("Enabled") : t("Not enabled") : "—"}</p><p className="type-meta text-brand-text-muted">{t("Account protection status")}</p></div></CardContent></Card>
      <Card className="border-brand-border bg-brand-surface"><CardContent className="flex items-center gap-3 p-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent"><Wallet className="h-5 w-5"/></span><div className="min-w-0"><p className="type-meta text-brand-text-muted">{t("BTCBOX password")}</p><p className="mt-1 text-lg font-semibold text-brand-text">{account ? account.has_login_password ? t("Set") : t("Not set") : "—"}</p><p className="type-meta text-brand-text-muted">{t("Password credential status")}</p></div></CardContent></Card>
    </section>
    <Card className="overflow-hidden border-brand-border bg-brand-surface">
      <CardHeader className="border-b border-brand-border/70 bg-brand-surface-2/70"><CardTitle className="text-base">{t("BTCBOX account")}</CardTitle><CardDescription>{t("Your internal account ID remains the owner of your balance, orders and history.")}</CardDescription></CardHeader>
      <CardContent className="space-y-3 p-4 text-sm sm:space-y-2 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-border/60 py-2 last:border-0"><span className="text-brand-text-muted">{t("Username")}</span><span className="min-w-0 break-all text-right font-medium text-brand-text">{account?.username || t("Not set")}</span></div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-brand-border/60 py-2"><span className="text-brand-text-muted">{t("BTCBOX password")}</span><span className="font-medium text-brand-text">{account?.has_login_password ? t("Set") : t("Not set")}</span></div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2"><span className="text-brand-text-muted">{t("Account ID")}</span><span className="min-w-0 max-w-full break-all text-right font-mono text-xs text-brand-text-secondary">{account?.uid || "—"}</span></div>
      </CardContent>
    </Card>
    <Card className="border-brand-border bg-brand-surface">
      <CardHeader className="border-b border-brand-border/70 bg-brand-surface-2/60"><CardTitle className="text-base">{t("Connected sign-in methods")}</CardTitle><CardDescription>{t("Each method below authenticates the same BTCBOX account. Linking requires a recent sign-in and proof of ownership of the new identity.")}</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {identities.length === 0 && <p className="text-sm text-brand-text-muted">{t("Your primary verified sign-in method is being synchronized.")}</p>}
        {identities.map((identity, index) => <div key={identity.provider + identity.wallet_chain + identity.wallet_address + index} className="flex min-w-0 flex-col gap-2 rounded-xl border border-brand-success/15 bg-brand-success/[0.025] p-3 transition-colors sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium capitalize text-brand-text">{identity.provider === "web3" ? (identity.wallet_chain || "Web3") + " wallet" : identity.provider}</span><span className="rounded-md border border-brand-success/25 bg-brand-success/[0.07] px-2 py-1 text-[11px] font-semibold tracking-wide text-brand-success">{t("Connected")}</span></div>
          {identity.wallet_address && <span className="break-all font-mono text-xs text-brand-text-muted">{identity.wallet_address}</span>}
        </div>)}
        {account?.wallet_address && !identities.some((identity) => identity.wallet_address === account.wallet_address) && <div className="rounded-lg border border-brand-border p-3"><span className="text-sm text-brand-text">{t("Primary wallet")} · {account.wallet_chain}</span><p className="mt-1 break-all font-mono text-xs text-brand-text-muted">{account.wallet_address}</p></div>}
      </CardContent>
    </Card>
    <Card className="border-brand-border bg-brand-surface">
      <CardHeader className="border-b border-brand-border/70 bg-brand-surface-2/60"><CardTitle className="text-base">{t("Link another sign-in method")}</CardTitle><CardDescription>{t("First reverify a sign-in method already connected to this BTCBOX account. Then verify the new method you want to add. The two proofs must be different.")}</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-3 rounded-xl border border-brand-border bg-brand-surface-2/60 p-3 sm:p-4">
          <p className="text-sm font-medium text-brand-text">{t("Step 1 · Verify an existing method")}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {hasGoogle && <Button variant="outline" aria-busy={busy} disabled={busy || !googleEnabled || identityLinkSourceVerified} onClick={() => void reauthenticateIdentityLinkWithGoogle()}>{t("Verify existing Google")}</Button>}
            {hasEthereum && <Button variant="outline" aria-busy={busy} disabled={busy || identityLinkSourceVerified} onClick={() => ethereumWallets.length > 1 ? setShowSourceEthereumWallets(value => !value) : void reauthenticateIdentityLinkWithWeb3("ethereum", twoFactorCode, ethereumWallets[0]?.provider)}>{t("Verify existing Ethereum wallet")}</Button>}
            {hasSolana && <Button variant="outline" aria-busy={busy} disabled={busy || identityLinkSourceVerified} onClick={() => void reauthenticateIdentityLinkWithWeb3("solana", twoFactorCode)}>{t("Verify existing Solana wallet")}</Button>}
          </div>
          {showSourceEthereumWallets && <div className="space-y-2">{ethereumWallets.map(wallet => <Button key={wallet.info.uuid} variant="outline" className="w-full justify-start" aria-busy={busy} disabled={busy} onClick={() => { setShowSourceEthereumWallets(false); void reauthenticateIdentityLinkWithWeb3("ethereum", twoFactorCode, wallet.provider); }}><Wallet className="h-4 w-4"/>{wallet.info.name}</Button>)}</div>}
          {account?.twofa_enabled && <label className="block space-y-1.5 text-sm"><span className="text-brand-text-secondary">{t("Authenticator code (required when account 2FA is enabled)")}</span><Input value={twoFactorCode} onChange={event => setTwoFactorCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder={t("Enter your 2FA code")} /></label>}
          {identityLinkNeedsTwoFactor && <form className="space-y-2" aria-busy={busy} onSubmit={async event => { event.preventDefault(); if (busy) return; try { await completeIdentityLinkReauthTwoFactor(twoFactorCode); setTwoFactorCode(""); } catch { /* AuthProvider displays the safe error. */ } }}>
            <p className="text-sm text-brand-text-secondary">{t("Google identity confirmed. Enter your authenticator code to complete this step.")}</p>
            <Button type="submit" className="w-full" aria-busy={busy} disabled={busy || twoFactorCode.length !== 6}>{t("Confirm existing identity")}</Button>
          </form>}
          {identityLinkSourceVerified && <p role="status" className="text-sm text-profit">{t("Existing identity verified. Continue to step 2.")}</p>}
        </div>
        <div className="space-y-3 rounded-xl border border-brand-border bg-brand-surface-2/40 p-3 sm:p-4">
          <p className="text-sm font-medium text-brand-text">{t("Step 2 · Verify the new method")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button variant="outline" aria-busy={busy} disabled={busy || !identityLinkSourceVerified || !googleEnabled || hasGoogle} onClick={() => void linkGoogleIdentity()}><Link2 className="h-4 w-4"/>{hasGoogle ? t("Google connected") : t("Link Google")}</Button>
            <Button variant="outline" aria-busy={busy} disabled={busy || !identityLinkSourceVerified || hasEthereum} onClick={() => ethereumWallets.length > 1 ? setShowLinkEthereumWallets(value => !value) : void linkWeb3Identity("ethereum", ethereumWallets[0]?.provider)}><Wallet className="h-4 w-4"/>{hasEthereum ? t("Ethereum connected") : t("Link Ethereum wallet")}</Button>
            <Button variant="outline" aria-busy={busy} disabled={busy || !identityLinkSourceVerified || hasSolana} onClick={() => void linkWeb3Identity("solana")}><Wallet className="h-4 w-4"/>{hasSolana ? t("Solana connected") : t("Link Solana wallet")}</Button>
          </div>
        </div>
        {showLinkEthereumWallets && <div className="col-span-full space-y-2 rounded-lg border border-brand-border bg-brand-surface-2 p-3">
          <p className="text-sm font-medium text-brand-text">{t("Choose the Ethereum wallet to link")}</p>
          {ethereumWallets.map(wallet => <Button key={wallet.info.uuid} variant="outline" className="w-full justify-start" aria-busy={busy} disabled={busy} onClick={() => { setShowLinkEthereumWallets(false); void linkWeb3Identity("ethereum", wallet.provider); }}><Wallet className="h-4 w-4"/>{wallet.info.name}</Button>)}
        </div>}
      </CardContent>
    </Card>
    <Card className="border-brand-border bg-brand-surface">
      <CardHeader className="border-b border-brand-border/70 bg-brand-surface-2/60"><CardTitle className="text-base">{t("Reset BTCBOX password")}</CardTitle><CardDescription>{t("Verify a Google account or wallet already connected to this BTCBOX account. A fresh verification opens a five-minute reset window.")}</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {credentialRecoveryReady ? (
          <form className="space-y-3" aria-busy={busy} onSubmit={async (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (busy || newPassword !== confirmNewPassword) return;
            try {
              await recoverBtcboxPassword(newPassword);
              setNewPassword("");
              setConfirmNewPassword("");
            } catch { /* AuthProvider displays the safe error. */ }
          }}>
            <label className="block space-y-1.5 text-sm"><span className="text-brand-text-secondary">{t("New BTCBOX password")}</span><Input type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} autoComplete="new-password" minLength={12} maxLength={128} placeholder={t("At least 12 characters")} required /></label>
            <label className="block space-y-1.5 text-sm"><span className="text-brand-text-secondary">{t("Confirm new password")}</span><Input type="password" value={confirmNewPassword} onChange={event => setConfirmNewPassword(event.target.value)} autoComplete="new-password" minLength={12} maxLength={128} aria-invalid={Boolean(confirmNewPassword && newPassword !== confirmNewPassword)} aria-describedby={confirmNewPassword && newPassword !== confirmNewPassword ? "recovery-password-error" : undefined} placeholder={t("Enter it again")} required /></label>
            {confirmNewPassword && newPassword !== confirmNewPassword && <p id="recovery-password-error" role="alert" className="text-sm text-loss">{t("Passwords do not match.")}</p>}
            <Button type="submit" className="w-full" aria-busy={busy} disabled={busy || newPassword.length < 12 || newPassword !== confirmNewPassword}>{t("Save new password")}</Button>
          </form>
        ) : credentialRecoveryNeedsTwoFactor ? (
          <form className="space-y-3" aria-busy={busy} onSubmit={async event => {
            event.preventDefault();
            if (busy) return;
            try { await completeCredentialRecoveryTwoFactor(twoFactorCode); setTwoFactorCode(""); }
            catch { /* AuthProvider displays the safe error. */ }
          }}>
            <label className="block space-y-1.5 text-sm"><span className="text-brand-text-secondary">{t("Authenticator code")}</span><Input value={twoFactorCode} onChange={event => setTwoFactorCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder={t("Enter your 2FA code")} required /></label>
            <Button type="submit" className="w-full" aria-busy={busy} disabled={busy || twoFactorCode.length < 6}>{t("Verify and continue")}</Button>
          </form>
        ) : (
          <div className="space-y-3">
            {account?.twofa_enabled && <label className="block space-y-1.5 text-sm"><span className="text-brand-text-secondary">{t("Authenticator code (required for wallet verification)")}</span><Input value={twoFactorCode} onChange={event => setTwoFactorCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder={t("Enter your 2FA code")} /></label>}
            <div className="grid gap-3 sm:grid-cols-2">
              {hasGoogle && <Button variant="outline" aria-busy={busy} disabled={busy || !googleEnabled} onClick={() => void reauthenticateCredentialsWithGoogle()}>{t("Verify with Google")}</Button>}
              {hasEthereum && <Button variant="outline" aria-busy={busy} disabled={busy || (account?.twofa_enabled === true && twoFactorCode.length < 6)} onClick={() => ethereumWallets.length > 1 ? setShowRecoveryEthereumWallets(value => !value) : void reauthenticateCredentialsWithWeb3("ethereum", twoFactorCode, ethereumWallets[0]?.provider)}>{t("Verify Ethereum wallet")}</Button>}
              {hasSolana && <Button variant="outline" aria-busy={busy} disabled={busy || (account?.twofa_enabled === true && twoFactorCode.length < 6)} onClick={() => void reauthenticateCredentialsWithWeb3("solana", twoFactorCode)}>{t("Verify Solana wallet")}</Button>}
              {showRecoveryEthereumWallets && <div className="col-span-full space-y-2 rounded-lg border border-brand-border bg-brand-surface-2 p-3">
                <p className="text-sm font-medium text-brand-text">{t("Choose the linked Ethereum wallet")}</p>
                {ethereumWallets.map(wallet => <Button key={wallet.info.uuid} variant="outline" className="w-full justify-start" aria-busy={busy} disabled={busy || (account?.twofa_enabled === true && twoFactorCode.length < 6)} onClick={() => { setShowRecoveryEthereumWallets(false); void reauthenticateCredentialsWithWeb3("ethereum", twoFactorCode, wallet.provider); }}><Wallet className="h-4 w-4"/>{wallet.info.name}</Button>)}
              </div>}
              {!hasGoogle && !hasEthereum && !hasSolana && <p className="text-sm text-brand-text-muted">{t("No linked Google account or wallet is available for password recovery. Contact support before changing your sign-in methods.")}</p>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
    <p className="text-xs leading-5 text-brand-text-muted">{t("If linking reports that your sign-in is no longer recent, sign out and sign back in, then retry. Identity linking never moves balances or merges two existing BTCBOX accounts.")}</p>
  </div>;
}
