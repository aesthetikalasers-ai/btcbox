import { useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { Link2, ShieldCheck, Wallet } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { getAccount, type AccountSnapshot } from "../../lib/api";
import { useAuth } from "../../lib/auth";

export function AccountSecurityPage() {
  const { status, busy, error, notice, googleEnabled, linkGoogleIdentity, linkWeb3Identity, credentialRecoveryReady, reauthenticateCredentialsWithGoogle, reauthenticateCredentialsWithWeb3, recoverBtcboxPassword } = useAuth();
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [loadError, setLoadError] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    getAccount().then((result) => {
      if (active) { setAccount(result); setLoadError(""); }
    }).catch((cause) => {
      if (active) setLoadError(cause instanceof Error ? cause.message : "Account security details are unavailable.");
    });
    return () => { active = false; };
  }, [status, notice]);

  if (status === "loading") return <div className="mx-auto flex min-h-[40vh] items-center justify-center text-sm text-brand-text-muted">Loading account security…</div>;
  if (status !== "authenticated") return <Navigate to="/login" replace />;

  const identities = account?.linked_identities || [];
  const hasGoogle = identities.some((identity) => identity.provider === "google") || account?.auth_providers?.includes("google") === true;
  const hasEthereum = account?.wallet_chain === "ethereum" || identities.some((identity) => identity.provider === "web3" && identity.wallet_chain === "ethereum");
  const hasSolana = account?.wallet_chain === "solana" || identities.some((identity) => identity.provider === "web3" && identity.wallet_chain === "solana");

  return <div className="mx-auto w-full max-w-3xl space-y-5 p-4 pb-24 sm:p-6">
    <div className="flex items-center gap-3"><ShieldCheck className="h-6 w-6 text-brand-text-secondary"/><div><h1 className="text-xl font-semibold text-brand-text">Account security</h1><p className="text-sm text-brand-text-muted">Manage the sign-in methods connected to one BTCBOX account.</p></div></div>
    {(error || loadError) && <p role="alert" className="rounded-lg border border-loss/30 bg-loss/10 p-3 text-sm text-loss">{error || loadError}</p>}
    {notice && <p role="status" className="rounded-lg border border-brand-border bg-brand-surface-2 p-3 text-sm text-brand-text-secondary">{notice}</p>}
    <Card className="border-brand-border bg-brand-surface">
      <CardHeader><CardTitle className="text-base">BTCBOX account</CardTitle><CardDescription>Your internal account ID remains the owner of your balance, orders and history.</CardDescription></CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center justify-between gap-4"><span className="text-brand-text-muted">Username</span><span className="font-medium text-brand-text">{account?.username || "Not set"}</span></div>
        <div className="flex items-center justify-between gap-4"><span className="text-brand-text-muted">BTCBOX password</span><span className="font-medium text-brand-text">{account?.has_login_password ? "Set" : "Not set"}</span></div>
        <div className="flex items-center justify-between gap-4"><span className="text-brand-text-muted">Account ID</span><span className="font-mono text-xs text-brand-text-secondary">{account?.uid || "—"}</span></div>
      </CardContent>
    </Card>
    <Card className="border-brand-border bg-brand-surface">
      <CardHeader><CardTitle className="text-base">Connected sign-in methods</CardTitle><CardDescription>Each method below authenticates the same BTCBOX account. Linking requires a recent sign-in and proof of ownership of the new identity.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {identities.length === 0 && <p className="text-sm text-brand-text-muted">Your primary verified sign-in method is being synchronized.</p>}
        {identities.map((identity, index) => <div key={identity.provider + identity.wallet_chain + identity.wallet_address + index} className="flex flex-col gap-1 rounded-lg border border-brand-border p-3">
          <div className="flex items-center justify-between"><span className="font-medium capitalize text-brand-text">{identity.provider === "web3" ? (identity.wallet_chain || "Web3") + " wallet" : identity.provider}</span><span className="text-xs text-profit">Connected</span></div>
          {identity.wallet_address && <span className="break-all font-mono text-xs text-brand-text-muted">{identity.wallet_address}</span>}
        </div>)}
        {account?.wallet_address && !identities.some((identity) => identity.wallet_address === account.wallet_address) && <div className="rounded-lg border border-brand-border p-3"><span className="text-sm text-brand-text">Primary wallet · {account.wallet_chain}</span><p className="mt-1 break-all font-mono text-xs text-brand-text-muted">{account.wallet_address}</p></div>}
      </CardContent>
    </Card>
    <Card className="border-brand-border bg-brand-surface">
      <CardHeader><CardTitle className="text-base">Link another sign-in method</CardTitle><CardDescription>Do not link an identity that belongs to a different BTCBOX account. The system will reject identities already in use.</CardDescription></CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <Button variant="outline" disabled={busy || !googleEnabled || hasGoogle} onClick={() => void linkGoogleIdentity()}><Link2 className="h-4 w-4"/>{hasGoogle ? "Google connected" : "Link Google"}</Button>
        <Button variant="outline" disabled={busy || hasEthereum} onClick={() => void linkWeb3Identity("ethereum")}><Wallet className="h-4 w-4"/>{hasEthereum ? "Ethereum connected" : "Link Ethereum wallet"}</Button>
        <Button variant="outline" disabled={busy || hasSolana} onClick={() => void linkWeb3Identity("solana")}><Wallet className="h-4 w-4"/>{hasSolana ? "Solana connected" : "Link Solana wallet"}</Button>
      </CardContent>
    </Card>
    <Card className="border-brand-border bg-brand-surface">
      <CardHeader><CardTitle className="text-base">Reset BTCBOX password</CardTitle><CardDescription>Verify a Google account or wallet already connected to this BTCBOX account. A fresh verification opens a five-minute reset window.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {credentialRecoveryReady ? (
          <form className="space-y-3" onSubmit={async (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (newPassword !== confirmNewPassword) return;
            try {
              await recoverBtcboxPassword(newPassword);
              setNewPassword("");
              setConfirmNewPassword("");
            } catch { /* AuthProvider displays the safe error. */ }
          }}>
            <label className="block space-y-1.5 text-sm"><span className="text-brand-text-secondary">New BTCBOX password</span><Input type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} autoComplete="new-password" minLength={12} maxLength={128} placeholder="At least 12 characters" required /></label>
            <label className="block space-y-1.5 text-sm"><span className="text-brand-text-secondary">Confirm new password</span><Input type="password" value={confirmNewPassword} onChange={event => setConfirmNewPassword(event.target.value)} autoComplete="new-password" minLength={12} maxLength={128} placeholder="Enter it again" required /></label>
            {confirmNewPassword && newPassword !== confirmNewPassword && <p className="text-sm text-loss">Passwords do not match.</p>}
            <Button type="submit" className="w-full" disabled={busy || newPassword.length < 12 || newPassword !== confirmNewPassword}>Save new password</Button>
          </form>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {hasGoogle && <Button variant="outline" disabled={busy || !googleEnabled} onClick={() => void reauthenticateCredentialsWithGoogle()}>Verify with Google</Button>}
            {hasEthereum && <Button variant="outline" disabled={busy} onClick={() => void reauthenticateCredentialsWithWeb3("ethereum")}>Verify Ethereum wallet</Button>}
            {hasSolana && <Button variant="outline" disabled={busy} onClick={() => void reauthenticateCredentialsWithWeb3("solana")}>Verify Solana wallet</Button>}
            {!hasGoogle && !hasEthereum && !hasSolana && <p className="text-sm text-brand-text-muted">No linked Google account or wallet is available for password recovery. Contact support before changing your sign-in methods.</p>}
          </div>
        )}
      </CardContent>
    </Card>
    <p className="text-xs leading-5 text-brand-text-muted">If linking reports that your sign-in is no longer recent, sign out and sign back in, then retry. Identity linking never moves balances or merges two existing BTCBOX accounts.</p>
  </div>;
}
