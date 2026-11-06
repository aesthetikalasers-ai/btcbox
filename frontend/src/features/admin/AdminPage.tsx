import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { useAuth } from "../../lib/auth";
import { AuthPage } from "../auth/AuthPages";
import {
  ApiError,
  adminApproveKyc,
  adminApproveWithdrawal,
  adminManualCredit,
  adminMarkWithdrawalPaid,
  adminRejectKyc,
  adminRejectWithdrawal,
  adminReplySupport,
  getAdminAuditLogs,
  getAdminConfig,
  getAdminKyc,
  getAdminOrders,
  getAdminSession,
  getAdminStats,
  getAdminSupportMessages,
  getAdminUser,
  getAdminUsers,
  getAdminWithdrawals,
  saveAdminConfig,
  type AdminAuditRecord,
  type AdminConfig,
  type AdminKycRecord,
  type AdminSession,
  type AdminUserRecord,
  type AdminWithdrawalRecord,
} from "../../lib/api";

type Tab = "overview" | "users" | "deposits" | "withdrawals" | "kyc" | "audit" | "orders" | "support";
const tabs: Array<{ id: Tab; label: string; permission: string }> = [
  { id: "overview", label: "Overview", permission: "dashboard.read" },
  { id: "users", label: "Users & manual credit", permission: "users.read" },
  { id: "deposits", label: "Deposit addresses", permission: "system_config.read" },
  { id: "withdrawals", label: "Withdrawals", permission: "withdrawals.read" },
  { id: "kyc", label: "KYC", permission: "kyc.read" },
  { id: "audit", label: "Audit log", permission: "financial_audit.read" },
  { id: "orders", label: "Orders", permission: "orders.read" },
  { id: "support", label: "Support", permission: "support.read" },
];
const depositAddressKeys = [
  "USDT-TRC20", "USDT-ERC20", "USDT-BEP20", "BTC-BTC",
  "ETH-ERC20", "SOL-SOL", "BNB-BEP20", "USDC-ERC20",
];
const assets = ["USDT", "BTC", "ETH", "SOL", "BNB", "USDC"];

function asText(value: unknown) {
  return value === null || value === undefined ? "—" : String(value);
}
function formatDate(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}
function statusVariant(status: string): "default" | "outline" | "destructive" {
  if (["completed", "approved", "verified", "active"].includes(status)) return "default";
  if (["rejected", "failed", "blocked"].includes(status)) return "destructive";
  return "outline";
}

export function AdminPage() {
  const { status: authStatus, getAccessToken } = useAuth();
  const [token, setToken] = useState("");
  const [session, setSession] = useState<AdminSession | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<AdminUserRecord | null>(null);
  const [creditAmount, setCreditAmount] = useState<Record<string, string>>({});
  const [creditReference, setCreditReference] = useState<Record<string, string>>({});
  const [creditNote, setCreditNote] = useState<Record<string, string>>({});
  const [creditRequestIds, setCreditRequestIds] = useState<Record<string, string>>({});
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawalRecord[]>([]);
  const [payoutReferences, setPayoutReferences] = useState<Record<string, string>>({});
  const [config, setConfig] = useState<AdminConfig>({ deposit_addresses: {}, announcement: "" });
  const [kyc, setKyc] = useState<AdminKycRecord[]>([]);
  const [audit, setAudit] = useState<AdminAuditRecord[]>([]);
  const [orders, setOrders] = useState<Array<Record<string, unknown>>>([]);
  const [support, setSupport] = useState<Array<Record<string, unknown>>>([]);
  const [supportReply, setSupportReply] = useState<Record<string, string>>({});

  const hasPermission = useCallback((permission: string) => {
    return !!session && (session.is_super_admin || session.permissions.includes(permission));
  }, [session]);

  const refreshTokenAndSession = useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      setToken("");
      setSession(null);
      setError("Sign in with your BTCBOX administrator Supabase identity.");
      setLoading(false);
      return;
    }
    setToken(accessToken);
    const current = await getAdminSession(accessToken);
    setSession(current);
    setError("");
  }, [getAccessToken]);

  useEffect(() => {
    if (authStatus === "loading") return;
    if (authStatus !== "authenticated") {
      setLoading(false);
      setError("Sign in with your BTCBOX administrator Supabase identity.");
      return;
    }
    let active = true;
    setLoading(true);
    refreshTokenAndSession().catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : "Administrator access could not be verified.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authStatus, refreshTokenAndSession]);

  const allowedTabs = useMemo(() => tabs.filter((item) => hasPermission(item.permission)), [hasPermission]);
  useEffect(() => {
    if (allowedTabs.length && !allowedTabs.some((item) => item.id === tab)) setTab(allowedTabs[0].id);
  }, [allowedTabs, tab]);

  const loadTab = useCallback(async () => {
    if (!token || !session) return;
    setLoading(true);
    setError("");
    try {
      if (tab === "overview") setStats(await getAdminStats(token));
      if (tab === "users") setUsers((await getAdminUsers(token, search)).users);
      if (tab === "deposits") setConfig(await getAdminConfig(token));
      if (tab === "withdrawals") setWithdrawals((await getAdminWithdrawals(token)).withdrawals || []);
      if (tab === "kyc") setKyc((await getAdminKyc(token)).kycs || []);
      if (tab === "audit") setAudit((await getAdminAuditLogs(token)).logs || []);
      if (tab === "orders") setOrders(((await getAdminOrders(token)).orders || []) as unknown as Array<Record<string, unknown>>);
      if (tab === "support") setSupport(((await getAdminSupportMessages(token)).messages || []) as unknown as Array<Record<string, unknown>>);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load administrator data.");
    } finally {
      setLoading(false);
    }
  }, [token, session, tab, search]);

  useEffect(() => { void loadTab(); }, [loadTab]);

  const selectUser = async (uid: string) => {
    if (!token) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await getAdminUser(token, uid);
      setSelectedUser(result.user);
      setCreditAmount({});
      setCreditReference({});
      setCreditNote({});
      setCreditRequestIds({});
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "User account could not be loaded.");
    } finally { setBusy(false); }
  };

  const manualCredit = async (event: FormEvent<HTMLFormElement>, coin: string) => {
    event.preventDefault();
    if (!token || !selectedUser) return;
    const amount = (creditAmount[coin] || "").trim();
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(amount) || Number(amount) <= 0) {
      setError("Enter the verified amount received.");
      return;
    }
    setBusy(true); setError(""); setNotice("");
    const stableRequestId = creditRequestIds[coin] || window.crypto.randomUUID();
    setCreditRequestIds(current => ({ ...current, [coin]: stableRequestId }));
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await adminManualCredit(token, {
        uid: selectedUser.uid, coin, amount,
        reference: creditReference[coin] || "",
        note: creditNote[coin] || "",
        idempotency_key: stableRequestId,
      });
      setNotice(result.duplicate ? "This manual credit was already recorded." : "Manual credit recorded and audit event submitted.");
      setCreditRequestIds(current => { const next = { ...current }; delete next[coin]; return next; });
      await selectUser(selectedUser.uid);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Manual credit was not confirmed.");
      if (reason instanceof ApiError && reason.status >= 400 && reason.status < 500) {
        setCreditRequestIds(current => { const next = { ...current }; delete next[coin]; return next; });
      }
    } finally { setBusy(false); }
  };

  const approveWithdrawal = async (id: string) => {
    if (!token) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await adminApproveWithdrawal(token, id);
      setNotice("Withdrawal approved. Staff must still transfer the funds manually.");
      setWithdrawals((await getAdminWithdrawals(token)).withdrawals || []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Approval failed."); }
    finally { setBusy(false); }
  };
  const rejectWithdrawal = async (id: string) => {
    if (!token) return;
    const reasonText = window.prompt("Reason for rejecting this withdrawal:");
    if (!reasonText?.trim()) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await adminRejectWithdrawal(token, id, reasonText.trim());
      setNotice("Withdrawal rejected.");
      setWithdrawals((await getAdminWithdrawals(token)).withdrawals || []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Rejection failed."); }
    finally { setBusy(false); }
  };
  const markPaid = async (id: string) => {
    if (!token) return;
    const reference = (payoutReferences[id] || "").trim();
    if (!reference) { setError("TxID / payout reference is required."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await adminMarkWithdrawalPaid(token, { id, reference, note: "Staff manually transferred funds." });
      setNotice(result.duplicate ? "This payout reference was already recorded." : "Manual payout completion recorded.");
      setWithdrawals((await getAdminWithdrawals(token)).withdrawals || []);
      setPayoutReferences((current) => ({ ...current, [id]: "" }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Payout completion was not confirmed."); }
    finally { setBusy(false); }
  };

  const saveAddresses = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await saveAdminConfig(token, config);
      setNotice("Deposit address configuration saved.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Configuration was not saved."); }
    finally { setBusy(false); }
  };

  const reviewKyc = async (uid: string, approved: boolean) => {
    if (!token) return;
    const reasonText = approved ? "" : (window.prompt("Reason for rejecting this KYC application:") || "");
    if (!approved && !reasonText.trim()) return;
    setBusy(true); setError(""); setNotice("");
    try {
      if (approved) await adminApproveKyc(token, uid);
      else await adminRejectKyc(token, uid, reasonText.trim());
      setNotice(approved ? "KYC approved." : "KYC rejected.");
      setKyc((await getAdminKyc(token)).kycs || []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "KYC review failed."); }
    finally { setBusy(false); }
  };

  const replySupport = async (uid: string) => {
    if (!token) return;
    const content = (supportReply[uid] || "").trim();
    if (!content) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await adminReplySupport(token, uid, content);
      setNotice("Support reply sent.");
      setSupportReply((current) => ({ ...current, [uid]: "" }));
      setSupport((await getAdminSupportMessages(token)).messages || []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Support reply failed."); }
    finally { setBusy(false); }
  };

  if (authStatus === "anonymous" || authStatus === "two-factor" || authStatus === "password-recovery") return <div className="mx-auto max-w-3xl p-4 md:p-6"><AuthPage mode="login" /></div>;
  if (loading && !session) return <div className="mx-auto max-w-7xl p-6"><Card><CardContent className="p-8 text-sm text-brand-text-muted">Verifying administrator identity…</CardContent></Card></div>;
  if (!session) return <div className="mx-auto max-w-3xl p-6"><Card><CardHeader><CardTitle>BTCBOX Administrator</CardTitle><CardDescription>Administrator access requires a verified Supabase Auth identity with an active BTCBOX administrator membership.</CardDescription></CardHeader><CardContent><p className="text-sm text-rose-300">{error || "Administrator membership was not found."}</p></CardContent></Card></div>;

  return <div className="mx-auto w-full max-w-7xl space-y-5 p-4 md:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-text-muted">BTCBOX / CONTROL CENTER</p><h1 className="mt-1 text-2xl font-bold text-brand-text">Administrator Console</h1><p className="mt-1 text-sm text-brand-text-muted">{session.is_super_admin ? "Super Administrator" : "Role-based administrator"} · {session.user_id}</p></div>
      <Badge variant="outline">{session.is_super_admin ? "SUPER ADMIN" : "ACTIVE ADMIN"}</Badge>
    </div>
    <div className="flex flex-wrap gap-2 border-b border-brand-border pb-3">
      {allowedTabs.map(item => <Button key={item.id} size="sm" variant={tab === item.id ? "default" : "outline"} onClick={() => { setTab(item.id); setError(""); setNotice(""); }}>{item.label}</Button>)}
    </div>
    {error ? <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-300">{error}</div> : null}
    {notice ? <div role="status" className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 text-sm text-emerald-300">{notice}</div> : null}
    {loading ? <Card><CardContent className="p-6 text-sm text-brand-text-muted">Loading {tab}…</CardContent></Card> : null}

    {!loading && tab === "overview" && stats ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ["Total users", stats.total_users], ["Pending withdrawals", stats.pending_withdrawals],
        ["Pending KYC", stats.pending_kyc], ["Review queue", stats.pending_admin_review_withdrawals],
      ].map(([label, value]) => <Card key={String(label)}><CardContent className="p-5"><p className="text-xs text-brand-text-muted">{label}</p><p className="mt-2 text-2xl font-bold tabular-nums text-brand-text">{asText(value)}</p></CardContent></Card>)}
    </div> : null}

    {!loading && tab === "users" ? <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
      <Card><CardHeader><CardTitle>Users</CardTitle><CardDescription>Search a user, then select an asset row for staff manual credit.</CardDescription></CardHeader><CardContent>
        <form className="mb-3 flex gap-2" onSubmit={event => { event.preventDefault(); void loadTab(); }}><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search UID or email" className="min-w-0 flex-1 rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-brand-text"/><Button size="sm" type="submit">Search</Button></form>
        <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr className="border-b border-brand-border text-xs text-brand-text-muted"><th className="p-2">UID</th><th className="p-2">Email</th><th className="p-2">KYC</th><th className="p-2">Status</th><th className="p-2"></th></tr></thead><tbody>{users.map(user=><tr key={user.uid} className="border-b border-brand-border/60"><td className="p-2 font-mono text-xs">{user.uid}</td><td className="p-2">{user.email}</td><td className="p-2">{user.kyc_status || user.kyc?.status || "—"}</td><td className="p-2"><Badge variant={user.frozen?"destructive":"outline"}>{user.frozen?"Frozen":"Active"}</Badge></td><td className="p-2"><Button size="sm" variant="outline" onClick={()=>void selectUser(user.uid)}>Open</Button></td></tr>)}</tbody></table></div>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Manual credit</CardTitle><CardDescription>UID and asset are bound by the selected user and asset row. No pending deposit order is created.</CardDescription></CardHeader><CardContent>
        {!selectedUser ? <p className="text-sm text-brand-text-muted">Select a user to load their current balances.</p> : <>
          <p className="mb-3 text-sm font-semibold">{selectedUser.email} · <span className="font-mono">{selectedUser.uid}</span></p>
          <div className="space-y-3">{assets.map(coin=><form key={coin} className="rounded-xl border border-brand-border p-3" onSubmit={event=>void manualCredit(event,coin)}>
            <div className="mb-2 flex items-center justify-between"><span className="font-semibold">{coin}</span><span className="text-xs text-brand-text-muted">Available: {asText(selectedUser.balances?.[coin]?.free ?? "0")}</span></div>
            <input disabled={!!creditRequestIds[coin]||busy} value={creditAmount[coin]||""} onChange={event=>setCreditAmount(current=>({...current,[coin]:event.target.value}))} placeholder="Verified amount received" className="mb-2 w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-brand-text" inputMode="decimal"/>
            <input disabled={!!creditRequestIds[coin]||busy} value={creditReference[coin]||""} onChange={event=>setCreditReference(current=>({...current,[coin]:event.target.value}))} placeholder="TxID / reference (optional)" className="mb-2 w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-brand-text"/>
            <input disabled={!!creditRequestIds[coin]||busy} value={creditNote[coin]||""} onChange={event=>setCreditNote(current=>({...current,[coin]:event.target.value}))} placeholder="Note (optional)" className="mb-2 w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-brand-text"/>
            <Button type="submit" size="sm" disabled={busy || !hasPermission("deposits.review")}>{creditRequestIds[coin] ? "Retry same credit request" : "Confirm manual credit"}</Button>
          </form>)}</div>
        </>}
      </CardContent></Card>
    </div> : null}

    {!loading && tab === "deposits" ? <Card><CardHeader><CardTitle>Deposit addresses</CardTitle><CardDescription>Configure the exact asset/network addresses shown to customers. Staff verify receipts and manually credit the selected user's asset row.</CardDescription></CardHeader><CardContent><form onSubmit={saveAddresses} className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">{depositAddressKeys.map(key=><label key={key} className="block space-y-1"><span className="text-xs font-semibold text-brand-text-muted">{key.replace("_"," · ")}</span><input value={config.deposit_addresses[key]||""} onChange={event=>setConfig(current=>({...current,deposit_addresses:{...current.deposit_addresses,[key]:event.target.value}}))} className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-brand-text" placeholder="Configured wallet address"/></label>)}</div>
      <label className="block space-y-1"><span className="text-xs font-semibold text-brand-text-muted">Customer announcement</span><textarea value={config.announcement||""} onChange={event=>setConfig(current=>({...current,announcement:event.target.value}))} rows={3} className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-brand-text"/></label>
      <Button type="submit" disabled={busy || !hasPermission("system_config.write")}>Save configuration</Button>
    </form></CardContent></Card> : null}

    {!loading && tab === "withdrawals" ? <Card><CardHeader><CardTitle>Withdrawal queue</CardTitle><CardDescription>Approve or reject requests. After staff actually transfer funds, mark paid with the TxID/reference.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead><tr className="border-b border-brand-border text-xs text-brand-text-muted"><th className="p-2">ID</th><th className="p-2">User</th><th className="p-2">Asset / amount</th><th className="p-2">Network / destination</th><th className="p-2">Status</th><th className="p-2">Action</th></tr></thead><tbody>{withdrawals.map(item=><tr key={item.id} className="border-b border-brand-border/60 align-top"><td className="p-2 font-mono text-xs">{item.id}</td><td className="p-2">{item.uid}</td><td className="p-2">{item.coin} {item.amount}<div className="text-xs text-brand-text-muted">Fee {item.fee}</div></td><td className="max-w-[260px] break-all p-2">{item.network}<div className="text-xs text-brand-text-muted">{item.address}</div></td><td className="p-2"><Badge variant={statusVariant(item.status)}>{item.status}</Badge></td><td className="min-w-[220px] space-y-2 p-2">{item.status==="pending"||item.status==="pending_admin_review"?<><Button size="sm" disabled={busy||!hasPermission("withdrawals.review")} onClick={()=>void approveWithdrawal(item.id)}>Approve</Button><Button size="sm" variant="outline" disabled={busy||!hasPermission("withdrawals.review")} onClick={()=>void rejectWithdrawal(item.id)}>Reject</Button></>:item.status==="approved"?<><input value={payoutReferences[item.id]||""} onChange={event=>setPayoutReferences(current=>({...current,[item.id]:event.target.value}))} placeholder="Required TxID / reference" className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-2 py-2 text-xs text-brand-text"/><Button size="sm" disabled={busy||!payoutReferences[item.id]?.trim()||!hasPermission("withdrawals.review")} onClick={()=>void markPaid(item.id)}>Mark paid</Button></>:<span className="text-xs text-brand-text-muted">{item.payout_reference||"—"}</span>}</td></tr>)}</tbody></table></div></CardContent></Card> : null}

    {!loading && tab === "kyc" ? <Card><CardHeader><CardTitle>KYC review</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead><tr className="border-b border-brand-border text-xs text-brand-text-muted"><th className="p-2">User</th><th className="p-2">Name</th><th className="p-2">Document</th><th className="p-2">Status</th><th className="p-2">Submitted</th><th className="p-2">Action</th></tr></thead><tbody>{kyc.map(item=><tr key={item.uid} className="border-b border-brand-border/60"><td className="p-2">{item.uid}<div className="text-xs text-brand-text-muted">{item.email}</div></td><td className="p-2">{item.name}</td><td className="p-2">{item.id_type}</td><td className="p-2">{item.status}</td><td className="p-2">{formatDate(item.submitted_at)}</td><td className="space-x-2 p-2"><Button size="sm" disabled={busy||!hasPermission("kyc.review")} onClick={()=>void reviewKyc(item.uid,true)}>Approve</Button><Button size="sm" variant="outline" disabled={busy||!hasPermission("kyc.review")} onClick={()=>void reviewKyc(item.uid,false)}>Reject</Button></td></tr>)}</tbody></table></div></CardContent></Card> : null}

    {!loading && tab === "audit" ? <Card><CardHeader><CardTitle>Financial audit log</CardTitle><CardDescription>Source and synchronization status are displayed as returned by the backend.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead><tr className="border-b border-brand-border text-xs text-brand-text-muted"><th className="p-2">Time</th><th className="p-2">Actor</th><th className="p-2">Action</th><th className="p-2">User</th><th className="p-2">Sync</th><th className="p-2">Detail</th></tr></thead><tbody>{audit.map((item,index)=><tr key={item.id||index} className="border-b border-brand-border/60"><td className="p-2">{formatDate(item.time)}</td><td className="p-2 font-mono text-xs">{item.by}</td><td className="p-2">{item.action}</td><td className="p-2">{item.uid}</td><td className="p-2">{item.postgres_sync_status}</td><td className="max-w-[280px] break-all p-2 text-xs">{item.detail}</td></tr>)}</tbody></table></div></CardContent></Card> : null}

    {!loading && tab === "orders" ? <Card><CardHeader><CardTitle>Orders</CardTitle><CardDescription>Read-only operational view.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead><tr className="border-b border-brand-border text-xs text-brand-text-muted"><th className="p-2">ID</th><th className="p-2">User</th><th className="p-2">Symbol</th><th className="p-2">Side</th><th className="p-2">Status</th><th className="p-2">Created</th></tr></thead><tbody>{orders.map((item,index)=><tr key={asText(item.id)||index} className="border-b border-brand-border/60"><td className="p-2 font-mono text-xs">{asText(item.id)}</td><td className="p-2">{asText(item.uid||item.user_id)}</td><td className="p-2">{asText(item.symbol)}</td><td className="p-2">{asText(item.side)}</td><td className="p-2">{asText(item.status)}</td><td className="p-2">{formatDate(item.created_at||item.time)}</td></tr>)}</tbody></table></div></CardContent></Card> : null}

    {!loading && tab === "support" ? <Card><CardHeader><CardTitle>Support messages</CardTitle></CardHeader><CardContent className="space-y-3">{support.map((item,index)=>{const uid=asText(item.uid||item.user_id);return <div key={asText(item.id)||index} className="rounded-xl border border-brand-border p-3"><p className="text-xs text-brand-text-muted">{uid} · {formatDate(item.created_at||item.time)}</p><p className="mt-2 whitespace-pre-wrap text-sm">{asText(item.content||item.message)}</p><textarea value={supportReply[uid]||""} onChange={event=>setSupportReply(current=>({...current,[uid]:event.target.value}))} rows={2} className="mt-3 w-full rounded-lg border border-brand-border bg-brand-surface-2 p-2 text-sm text-brand-text" placeholder="Reply to customer"/><Button size="sm" className="mt-2" disabled={busy||!supportReply[uid]?.trim()||!hasPermission("support.reply")} onClick={()=>void replySupport(uid)}>Send reply</Button></div>;})}</CardContent></Card> : null}
  </div>;
}
