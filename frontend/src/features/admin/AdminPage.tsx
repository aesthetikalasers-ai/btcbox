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
  getAdminMemberships,
  manageAdminMembership,
  getAdminOrders,
  getAdminSession,
  getAdminStats,
  getAdminSecondsPolicy,
  getAdminSupportMessages,
  getAdminUser,
  getAdminUsers,
  getAdminWithdrawals,
  saveAdminConfig,
  saveAdminSecondsPolicy,
  type AdminAuditRecord,
  type AdminConfig,
  type AdminKycRecord,
  type AdminSession,
  type AdminUserRecord,
  type AdminWithdrawalRecord,
} from "../../lib/api";

type Tab = "overview" | "users" | "deposits" | "withdrawals" | "kyc" | "audit" | "orders" | "support" | "admins" | "seconds";
const tabs: Array<{ id: Tab; label: string; permission: string }> = [
  { id: "overview", label: "Overview", permission: "dashboard.read" },
  { id: "users", label: "Users & manual credit", permission: "users.read" },
  { id: "deposits", label: "Deposit addresses", permission: "system_config.read" },
  { id: "withdrawals", label: "Withdrawals", permission: "withdrawals.read" },
  { id: "kyc", label: "KYC", permission: "kyc.read" },
  { id: "audit", label: "Audit log", permission: "financial_audit.read" },
  { id: "orders", label: "Orders", permission: "orders.read" },
  { id: "support", label: "Support", permission: "support.read" },
  { id: "seconds", label: "Seconds policy", permission: "seconds_policy.read" },
];
const adminPermissionOptions = [["dashboard.read","Dashboard"],["users.read","Read users"],["users.manage","Manage users"],["users.freeze","Freeze accounts"],["kyc.read","Read KYC"],["kyc.review","Review KYC"],["deposits.read","Read deposits"],["deposits.review","Manual deposit credit"],["withdrawals.read","Read withdrawals"],["withdrawals.review","Review and mark paid"],["orders.read","Read orders"],["support.read","Read support"],["support.reply","Reply to support"],["support.manage","Manage support"],["announcements.read","Read announcements"],["announcements.manage","Manage announcements"],["system_config.read","Read system configuration"],["system_config.write","Edit system configuration"],["seconds_policy.read","Read Seconds policy"],["seconds_policy.manage","Manage Seconds policy"],["financial_audit.read","Read financial audit"],["financial_adjustment.request","Request financial adjustment"]] as const;
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
  const { status: authStatus, getSupabaseAccessToken } = useAuth();
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
  const [creditPendingInvalid, setCreditPendingInvalid] = useState<Record<string, boolean>>({});
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawalRecord[]>([]);
  const [payoutReferences, setPayoutReferences] = useState<Record<string, string>>({});
  const [config, setConfig] = useState<AdminConfig>({ deposit_addresses: {}, announcement: "" });
  const [kyc, setKyc] = useState<AdminKycRecord[]>([]);
  const [audit, setAudit] = useState<AdminAuditRecord[]>([]);
  const [orders, setOrders] = useState<Array<Record<string, unknown>>>([]);
  const [support, setSupport] = useState<Array<Record<string, unknown>>>([]);
  const [supportReply, setSupportReply] = useState<Record<string, string>>({});
  const [supportReplyRequestIds, setSupportReplyRequestIds] = useState<Record<string, string>>({});
  const [adminMemberships, setAdminMemberships] = useState<Array<{user_id:string;status:"active"|"suspended"|"revoked";revision:number;permissions:string[];created_at?:string;updated_at?:string}>>([]);
  const [adminCandidates, setAdminCandidates] = useState<AdminUserRecord[]>([]);
  const [adminSearch, setAdminSearch] = useState("");
  const [adminTargetUserId, setAdminTargetUserId] = useState("");
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const [adminReason, setAdminReason] = useState("");
  const [adminRequestId, setAdminRequestId] = useState("");
  const [adminRequestKey, setAdminRequestKey] = useState("");
  const [secondsPolicy, setSecondsPolicy] = useState<{policy_id:string;policy_version:number;symbols:string[];durations_sec:number[];min_stake:number|string;max_stake:number|string;payout_bps:number;per_user_open_exposure:number|string|null;max_open_positions_per_user:number|null}|null>(null);
  const [secondsSymbols, setSecondsSymbols] = useState<string[]>([]);
  const [secondsDurations, setSecondsDurations] = useState<number[]>([]);
  const [secondsMinStake, setSecondsMinStake] = useState("");
  const [secondsMaxStake, setSecondsMaxStake] = useState("");
  const [secondsPayoutPercent, setSecondsPayoutPercent] = useState("85");
  const [secondsExposure, setSecondsExposure] = useState("");
  const [secondsMaxOpenPositions, setSecondsMaxOpenPositions] = useState("");
  const [secondsDurationInput, setSecondsDurationInput] = useState("60");
  const [secondsReason, setSecondsReason] = useState("");
  const [secondsRequestId, setSecondsRequestId] = useState("");
  const [secondsRequestKey, setSecondsRequestKey] = useState("");

  const hasPermission = useCallback((permission: string) => {
    return !!session && (session.is_super_admin || session.permissions.includes(permission));
  }, [session]);

  const refreshTokenAndSession = useCallback(async () => {
    const accessToken = await getSupabaseAccessToken();
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
  }, [getSupabaseAccessToken]);

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

  const allowedTabs = useMemo(() => [...tabs.filter((item) => hasPermission(item.permission)), ...(session?.is_super_admin ? [{ id: "admins" as Tab, label: "Administrators", permission: "super_admin.only" }] : [])], [hasPermission, session]);
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
      if (tab === "seconds") {
        const result = await getAdminSecondsPolicy(token);
        setSecondsPolicy(result.policy); setSecondsSymbols(result.policy.symbols); setSecondsDurations(result.policy.durations_sec);
        setSecondsMinStake(String(result.policy.min_stake)); setSecondsMaxStake(String(result.policy.max_stake));
        setSecondsPayoutPercent((result.policy.payout_bps / 100).toString());
        setSecondsExposure(result.policy.per_user_open_exposure === null ? "" : String(result.policy.per_user_open_exposure));
        setSecondsMaxOpenPositions(result.policy.max_open_positions_per_user === null ? "" : String(result.policy.max_open_positions_per_user));
      }
      if (tab === "admins" && session.is_super_admin) {
        const [membershipResult, userResult] = await Promise.all([getAdminMemberships(token), getAdminUsers(token, adminSearch)]);
        setAdminMemberships(membershipResult.admins || []);
        setAdminCandidates(userResult.users || []);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load administrator data.");
    } finally {
      setLoading(false);
    }
  }, [token, session, tab, search, adminSearch]);

  useEffect(() => { void loadTab(); }, [loadTab]);

  useEffect(() => {
    if (!session?.user_id || !selectedUser?.uid) return;
    const amounts: Record<string,string> = {};
    const references: Record<string,string> = {};
    const notes: Record<string,string> = {};
    const requestIds: Record<string,string> = {};
    const invalid: Record<string,boolean> = {};
    for (const coin of assets) {
      const key = "btcbox.admin.manual-credit.v1." + session.user_id + "." + selectedUser.uid + "." + coin;
      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) continue;
        const saved = JSON.parse(raw);
        if (saved && saved.version === 1 && saved.actor_id === session.user_id && saved.target_uid === selectedUser.uid && saved.coin === coin &&
            typeof saved.request_id === "string" && /^[A-Za-z0-9_-]{16,100}$/.test(saved.request_id) &&
            typeof saved.amount === "string" && /^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(saved.amount) &&
            typeof saved.reference === "string" && typeof saved.note === "string") {
          amounts[coin] = saved.amount;
          references[coin] = saved.reference;
          notes[coin] = saved.note;
          requestIds[coin] = saved.request_id;
        } else invalid[coin] = true;
      } catch { invalid[coin] = true; }
    }
    setCreditAmount(amounts);
    setCreditReference(references);
    setCreditNote(notes);
    setCreditRequestIds(requestIds);
    setCreditPendingInvalid(invalid);
  }, [session?.user_id, selectedUser?.uid]);


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
    if (creditPendingInvalid[coin]) {
      setError("A saved manual-credit request is unreadable. Check the user's ledger before creating another credit.");
      return;
    }
    const amount = (creditAmount[coin] || "").trim();
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(amount) || /^0(?:\.0*)?$/.test(amount)) {
      setError("Enter the verified amount received.");
      return;
    }
    if (!session?.user_id) {
      setError("The authenticated administrator identity is unavailable. No credit was sent.");
      return;
    }
    const storageKey = "btcbox.admin.manual-credit.v1." + session.user_id + "." + selectedUser.uid + "." + coin;
    let stableRequestId = creditRequestIds[coin];
    if (!stableRequestId) {
      stableRequestId = window.crypto.randomUUID();
      const intent = {
        version: 1, actor_id: session.user_id, target_uid: selectedUser.uid, coin,
        request_id: stableRequestId, amount,
        reference: creditReference[coin] || "", note: creditNote[coin] || "",
        created_at: Date.now(),
      };
      try { window.localStorage.setItem(storageKey, JSON.stringify(intent)); }
      catch {
        setError("This browser cannot safely save the manual-credit request. No credit was sent.");
        return;
      }
      setCreditRequestIds(current => ({ ...current, [coin]: stableRequestId! }));
    }
    setBusy(true); setError(""); setNotice("");
    let creditAccepted = false;
    try {
      const result = await adminManualCredit(token, {
        uid: selectedUser.uid, coin, amount,
        reference: creditReference[coin] || "",
        note: creditNote[coin] || "",
        idempotency_key: stableRequestId,
      });
      creditAccepted = true;
      try { window.localStorage.removeItem(storageKey); } catch {}
      setCreditRequestIds(current => { const next = { ...current }; delete next[coin]; return next; });
      setCreditPendingInvalid(current => { const next = { ...current }; delete next[coin]; return next; });
      setNotice(result.duplicate ? "This manual credit was already recorded." : "Manual credit recorded and audit event submitted.");
      await selectUser(selectedUser.uid);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Manual credit was not confirmed.");
      if (!creditAccepted && reason instanceof ApiError && reason.status >= 400 && reason.status < 500 && reason.status !== 409) {
        try { window.localStorage.removeItem(storageKey); } catch {}
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
    const requestId = supportReplyRequestIds[uid] || window.crypto.randomUUID();
    setSupportReplyRequestIds((current) => ({ ...current, [uid]: requestId }));
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await adminReplySupport(token, uid, content, requestId);
      setNotice(result.audit_sync_pending ? "Support reply sent; audit delivery is pending." : "Support reply sent.");
      setSupportReply((current) => ({ ...current, [uid]: "" }));
      setSupportReplyRequestIds((current) => { const next = { ...current }; delete next[uid]; return next; });
      setSupport((await getAdminSupportMessages(token)).messages || []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Support reply failed."); }
    finally { setBusy(false); }
  };

  const saveSecondsPolicy = async () => {
    if (!token || !secondsPolicy || !hasPermission("seconds_policy.manage")) return;
    const reason = secondsReason.trim();
    const payoutBps = Math.round(Number(secondsPayoutPercent) * 100);
    const maxOpenPositions = secondsMaxOpenPositions.trim() === "" ? null : Number(secondsMaxOpenPositions);
    if (!reason || !secondsSymbols.length || !secondsDurations.length || !Number.isFinite(payoutBps) || payoutBps < 8500 || (maxOpenPositions !== null && (!Number.isSafeInteger(maxOpenPositions) || maxOpenPositions <= 0))) {
      setError("Enter a reason, at least one market and duration, and a payout rate of at least 85%."); return;
    }
    const requestKey = JSON.stringify({ expected_policy_version: secondsPolicy.policy_version, symbols: [...secondsSymbols].sort(), durations_sec: [...secondsDurations].sort((a,b)=>a-b), min_stake: secondsMinStake, max_stake: secondsMaxStake, payout_bps: payoutBps, per_user_open_exposure: secondsExposure.trim() || null, max_open_positions_per_user: maxOpenPositions, reason });
    const requestId = secondsRequestId && secondsRequestKey === requestKey ? secondsRequestId : window.crypto.randomUUID();
    setSecondsRequestKey(requestKey); setSecondsRequestId(requestId); setBusy(true); setError(""); setNotice("");
    try {
      const result = await saveAdminSecondsPolicy(token, { expected_policy_version: secondsPolicy.policy_version, symbols: secondsSymbols, durations_sec: secondsDurations, min_stake: secondsMinStake, max_stake: secondsMaxStake, payout_bps: payoutBps, per_user_open_exposure: secondsExposure.trim() || null, max_open_positions_per_user: maxOpenPositions, reason, request_id: requestId });
      setSecondsPolicy(result.policy); setSecondsRequestId(""); setSecondsRequestKey(""); setSecondsReason("");
      setNotice(result.replayed ? "This Seconds policy update was already activated." : "New Seconds policy version activated.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Seconds policy update could not be confirmed. Refresh before retrying."); }
    finally { setBusy(false); }
  };

  const submitAdminMembershipChange = async (action: "provision" | "set_permissions" | "suspend" | "reactivate" | "revoke", targetUserId: string, expectedRevision: number, permissions: string[]) => {
    if (!token || !session?.is_super_admin || !targetUserId) return;
    const reason = adminReason.trim();
    if (!reason) { setError("A reason is required for every administrator change."); return; }
    const requestKey = JSON.stringify({ action, targetUserId, expectedRevision, permissions: [...permissions].sort(), reason });
    const requestId = adminRequestId && adminRequestKey === requestKey ? adminRequestId : window.crypto.randomUUID();
    setAdminRequestKey(requestKey); setAdminRequestId(requestId); setBusy(true); setError(""); setNotice("");
    try {
      await manageAdminMembership(token, { target_user_id: targetUserId, expected_revision: expectedRevision, action, permissions, reason, request_id: requestId });
      setNotice(action === "provision" ? "Administrator access provisioned." : action === "set_permissions" ? "Administrator permissions updated." : action === "suspend" ? "Administrator suspended." : action === "reactivate" ? "Administrator reactivated." : "Administrator access revoked.");
      setAdminRequestId(""); setAdminRequestKey(""); setAdminReason("");
      const refreshed = await getAdminMemberships(token); setAdminMemberships(refreshed.admins || []);
      if (action === "provision") setAdminTargetUserId("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Administrator change could not be confirmed. Refresh before retrying."); }
    finally { setBusy(false); }
  };

  if (authStatus === "anonymous" || authStatus === "two-factor" || authStatus === "password-recovery") return <div className="mx-auto max-w-3xl p-4 md:p-6"><AuthPage mode="login" redirectTo="/admin" /></div>;
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
            <input disabled={!!creditRequestIds[coin]||!!creditPendingInvalid[coin]||busy} value={creditAmount[coin]||""} onChange={event=>setCreditAmount(current=>({...current,[coin]:event.target.value}))} placeholder="Verified amount received" className="mb-2 w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-brand-text" inputMode="decimal"/>
            <input disabled={!!creditRequestIds[coin]||!!creditPendingInvalid[coin]||busy} value={creditReference[coin]||""} onChange={event=>setCreditReference(current=>({...current,[coin]:event.target.value}))} placeholder="TxID / reference (optional)" className="mb-2 w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-brand-text"/>
            <input disabled={!!creditRequestIds[coin]||!!creditPendingInvalid[coin]||busy} value={creditNote[coin]||""} onChange={event=>setCreditNote(current=>({...current,[coin]:event.target.value}))} placeholder="Note (optional)" className="mb-2 w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-brand-text"/>
            <Button type="submit" size="sm" disabled={busy || !!creditPendingInvalid[coin] || !hasPermission("deposits.review")}>{creditRequestIds[coin] ? "Retry same credit request" : "Confirm manual credit"}</Button>
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

    {!loading && tab === "support" ? <Card><CardHeader><CardTitle>Support messages</CardTitle></CardHeader><CardContent className="space-y-3">{support.map((item,index)=>{const uid=asText(item.uid||item.user_id);return <div key={asText(item.id)||index} className="rounded-xl border border-brand-border p-3"><p className="text-xs text-brand-text-muted">{uid} · {formatDate(item.created_at||item.time)}</p><p className="mt-2 whitespace-pre-wrap text-sm">{asText(item.content||item.message)}</p><textarea value={supportReply[uid]||""} onChange={event=>{setSupportReply(current=>({...current,[uid]:event.target.value}));setSupportReplyRequestIds(current=>({...current,[uid]:window.crypto.randomUUID()}));}} rows={2} className="mt-3 w-full rounded-lg border border-brand-border bg-brand-surface-2 p-2 text-sm text-brand-text" placeholder="Reply to customer"/><Button size="sm" className="mt-2" disabled={busy||!supportReply[uid]?.trim()||!hasPermission("support.reply")} onClick={()=>void replySupport(uid)}>Send reply</Button></div>;})}</CardContent></Card> : null}
    {!loading && tab === "seconds" && secondsPolicy ? <Card><CardHeader><CardTitle>Seconds contract policy</CardTitle><CardDescription>Changes create and activate a new immutable policy version. Existing open positions keep their original policy snapshot. 85% is the minimum payout rate; no fixed upper limit is imposed.</CardDescription></CardHeader><CardContent className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><Badge variant="outline">Active version {secondsPolicy.policy_version}</Badge><span className="text-xs text-brand-text-muted">Policy ID · {secondsPolicy.policy_id}</span></div>
      <div><p className="mb-2 text-sm font-semibold">Supported markets</p><div className="flex flex-wrap gap-2">{["BTC","ETH","SOL","BNB"].map(symbol=><label key={symbol} className="flex items-center gap-2 rounded-lg border border-brand-border px-3 py-2 text-sm"><input type="checkbox" checked={secondsSymbols.includes(symbol)} disabled={busy||!hasPermission("seconds_policy.manage")} onChange={event=>setSecondsSymbols(current=>event.target.checked?[...current,symbol]:current.filter(item=>item!==symbol))}/>{symbol}</label>)}</div></div>
      <div><p className="mb-2 text-sm font-semibold">Contract durations (seconds)</p><div className="flex flex-wrap gap-2">{secondsDurations.slice().sort((a,b)=>a-b).map(duration=><button key={duration} type="button" disabled={busy||!hasPermission("seconds_policy.manage")||secondsDurations.length<=1} onClick={()=>setSecondsDurations(current=>current.filter(item=>item!==duration))} className="rounded-lg border border-brand-border px-3 py-2 text-sm tabular-nums">{duration}s <span className="ml-1 text-brand-text-muted">×</span></button>)}</div><div className="mt-2 flex gap-2"><input type="number" min="1" step="1" value={secondsDurationInput} disabled={busy||!hasPermission("seconds_policy.manage")} onChange={event=>setSecondsDurationInput(event.target.value)} className="w-32 rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-brand-text" aria-label="Add duration in seconds"/><Button size="sm" type="button" variant="outline" disabled={busy||!hasPermission("seconds_policy.manage")||!Number.isSafeInteger(Number(secondsDurationInput))||Number(secondsDurationInput)<=0||secondsDurations.includes(Number(secondsDurationInput))} onClick={()=>{setSecondsDurations(current=>[...current,Number(secondsDurationInput)].sort((a,b)=>a-b));setSecondsDurationInput("");}}>Add duration</Button></div></div>
      <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm"><span>Minimum stake (USDT)</span><input value={secondsMinStake} disabled={busy||!hasPermission("seconds_policy.manage")} onChange={event=>setSecondsMinStake(event.target.value)} inputMode="decimal" className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-brand-text"/></label><label className="space-y-1 text-sm"><span>Maximum stake (USDT)</span><input value={secondsMaxStake} disabled={busy||!hasPermission("seconds_policy.manage")} onChange={event=>setSecondsMaxStake(event.target.value)} inputMode="decimal" className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-brand-text"/></label><label className="space-y-1 text-sm"><span>Winning payout rate (%) · minimum 85</span><input value={secondsPayoutPercent} disabled={busy||!hasPermission("seconds_policy.manage")} onChange={event=>setSecondsPayoutPercent(event.target.value)} inputMode="decimal" className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-brand-text"/></label><label className="space-y-1 text-sm"><span>Per-user open exposure limit (USDT, optional)</span><input value={secondsExposure} disabled={busy||!hasPermission("seconds_policy.manage")} onChange={event=>setSecondsExposure(event.target.value)} inputMode="decimal" placeholder="No additional limit" className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-brand-text"/></label><label className="space-y-1 text-sm"><span>Maximum unfinished positions per user (optional)</span><input type="number" min="1" step="1" value={secondsMaxOpenPositions} disabled={busy||!hasPermission("seconds_policy.manage")} onChange={event=>setSecondsMaxOpenPositions(event.target.value)} placeholder="No count limit" className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-brand-text"/></label></div>
      <label className="block space-y-1 text-sm"><span>Reason for policy change (required)</span><textarea value={secondsReason} disabled={busy||!hasPermission("seconds_policy.manage")} onChange={event=>setSecondsReason(event.target.value)} rows={2} maxLength={500} className="w-full rounded-lg border border-brand-border bg-brand-surface-2 p-3 text-brand-text" placeholder="Explain why these rules are changing"/></label>
      {hasPermission("seconds_policy.manage")?<Button block disabled={busy||!secondsReason.trim()} onClick={()=>void saveSecondsPolicy()}>Create and activate new policy version</Button>:<p className="text-sm text-brand-text-muted">Your administrator role is read-only for Seconds policy.</p>}
    </CardContent></Card> : null}
    {!loading && tab === "admins" && session.is_super_admin ? <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
      <Card><CardHeader><CardTitle>Delegated administrators</CardTitle><CardDescription>Only the Super Admin can provision, change, suspend or revoke administrator access. Every change requires a reason and is recorded by the database.</CardDescription></CardHeader><CardContent className="space-y-3">
        {adminMemberships.length ? adminMemberships.map(item=><div key={item.user_id} className="rounded-xl border border-brand-border p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-mono text-xs text-brand-text">{item.user_id}</p><p className="mt-1 text-xs text-brand-text-muted">Revision {item.revision} · {formatDate(item.updated_at||item.created_at)}</p></div><Badge variant={statusVariant(item.status)}>{item.status}</Badge></div><p className="mt-2 break-words text-xs text-brand-text-muted">{item.permissions.join(" · ") || "No permissions"}</p><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busy||item.status==="revoked"} onClick={()=>{setAdminTargetUserId(item.user_id);setAdminPermissions(item.permissions);setAdminReason("");setAdminRequestId("");setAdminRequestKey("");}}>Edit permissions</Button>{item.status==="active"?<Button size="sm" variant="outline" disabled={busy} onClick={()=>void submitAdminMembershipChange("suspend",item.user_id,item.revision,[])}>Suspend</Button>:null}{item.status==="suspended"?<Button size="sm" variant="outline" disabled={busy} onClick={()=>void submitAdminMembershipChange("reactivate",item.user_id,item.revision,item.permissions)}>Reactivate</Button>:null}{item.status!=="revoked"?<Button size="sm" variant="destructive" disabled={busy} onClick={()=>void submitAdminMembershipChange("revoke",item.user_id,item.revision,[])}>Revoke</Button>:null}</div></div>) : <p className="text-sm text-brand-text-muted">No delegated administrators have been provisioned.</p>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>{adminMemberships.some(item=>item.user_id===adminTargetUserId)?"Edit administrator permissions":"Provision administrator"}</CardTitle><CardDescription>Select an existing BTCBOX user. The database verifies that the target UUID belongs to a real Supabase Auth user.</CardDescription></CardHeader><CardContent className="space-y-3">
        <form className="flex gap-2" onSubmit={event=>{event.preventDefault();void getAdminUsers(token,adminSearch).then(result=>setAdminCandidates(result.users||[])).catch(reason=>setError(reason instanceof Error?reason.message:"User search failed."));}}><input value={adminSearch} onChange={event=>setAdminSearch(event.target.value)} placeholder="Search user email or UID" className="min-w-0 flex-1 rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-brand-text"/><Button size="sm" type="submit" variant="outline">Search</Button></form>
        <select value={adminTargetUserId} onChange={event=>{const value=event.target.value;setAdminTargetUserId(value);const found=adminMemberships.find(item=>item.user_id===value);setAdminPermissions(found?.permissions||[]);setAdminRequestId("");setAdminRequestKey("");}} className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-brand-text"><option value="">Select an existing user</option>{adminCandidates.filter(user=>!adminMemberships.some(item=>item.user_id===user.uid)).map(user=><option key={user.uid} value={user.uid}>{user.email} · {user.uid}</option>)}{adminMemberships.some(item=>item.user_id===adminTargetUserId)?<option value={adminTargetUserId}>{adminTargetUserId}</option>:null}</select>
        <div className="grid gap-2 sm:grid-cols-2">{adminPermissionOptions.map(([key,label])=><label key={key} className="flex items-center gap-2 rounded-lg border border-brand-border p-2 text-xs"><input type="checkbox" checked={adminPermissions.includes(key)} onChange={event=>setAdminPermissions(current=>event.target.checked?[...current,key]:current.filter(item=>item!==key))}/><span>{label}</span></label>)}</div>
        <textarea value={adminReason} onChange={event=>setAdminReason(event.target.value)} rows={2} maxLength={500} placeholder="Required reason for this administrator change" className="w-full rounded-lg border border-brand-border bg-brand-surface-2 p-3 text-sm text-brand-text"/>
        <Button block disabled={busy||!adminTargetUserId||(!adminMemberships.some(item=>item.user_id===adminTargetUserId)&&!adminPermissions.length)||!adminReason.trim()} onClick={()=>{const existing=adminMemberships.find(item=>item.user_id===adminTargetUserId);void submitAdminMembershipChange(existing?"set_permissions":"provision",adminTargetUserId,existing?.revision||0,adminPermissions);}}>{adminMemberships.some(item=>item.user_id===adminTargetUserId)?"Save permissions":"Provision administrator"}</Button>
      </CardContent></Card>
    </div> : null}
  </div>;
}
