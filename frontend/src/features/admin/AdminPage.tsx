import { AuthRestoreState } from "../../components/AuthRestoreState";
import { BrandLogo } from "../../components/BrandLogo";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { useAuth } from "../../lib/auth";
import { localeTags, useI18n } from "../../lib/i18n";
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
  getAdminSecondsOpenPositions,
  getAdminSpotMarkets,
  getAdminSupportMessages,
  getAdminUser,
  getAdminUsers,
  getAdminWithdrawals,
  saveAdminConfig,
  saveAdminSecondsPolicy,
  saveAdminSpotMarket,
  type AdminAuditRecord,
  type AdminConfig,
  type AdminKycRecord,
  type AdminSession,
  type AdminSpotMarket,
  type AdminSecondsOpenPosition,
  type AdminSecondsOpenPositionsSnapshot,
  type AdminUserRecord,
  type AdminWithdrawalRecord,
} from "../../lib/api";

type ReviewDialogState = { kind: "withdrawal"; id: string } | { kind: "kyc"; uid: string };
type Tab = "overview" | "users" | "deposits" | "withdrawals" | "kyc" | "audit" | "orders" | "support" | "admins" | "seconds" | "markets";
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
  { id: "markets", label: "Spot markets", permission: "system_config.read" },
];
const adminPermissionOptions = [["dashboard.read","Dashboard"],["users.read","Read users"],["users.manage","Manage users"],["users.freeze","Freeze accounts"],["kyc.read","Read KYC"],["kyc.review","Review KYC"],["deposits.read","Read deposits"],["deposits.review","Manual deposit credit"],["payout_addresses.read_sensitive","Read sensitive customer payout addresses"],["payout_addresses.manage","Manage customer payout addresses"],["withdrawals.read","Read withdrawals"],["withdrawals.review","Review and mark paid"],["orders.read","Read orders"],["support.read","Read support"],["support.reply","Reply to support"],["support.manage","Manage support"],["announcements.read","Read announcements"],["announcements.manage","Manage announcements"],["system_config.read","Read system configuration"],["system_config.write","Edit system configuration"],["seconds_policy.read","Read Seconds policy"],["seconds_policy.manage","Manage Seconds policy"],["financial_audit.read","Read financial audit"]] as const;
const depositAddressKeys = [
  "USDT-TRC20", "USDT-ERC20", "USDT-BEP20", "BTC-BTC",
  "ETH-ERC20", "SOL-SOL", "BNB-BEP20", "USDC-ERC20",
];
const assets = ["USDT", "BTC", "ETH", "SOL", "BNB", "USDC"];
const spotAssets = ["USDT", "USDC", "BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX", "LINK", "DOT", "TRX", "LTC", "BCH", "NEAR", "UNI", "ATOM", "ETC"];

function asText(value: unknown) {
  return value === null || value === undefined ? "—" : String(value);
}
function formatDate(value: unknown, locale: string) {
  if (!value) return "—";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString(locale);
}
function statusVariant(status: string): "default" | "outline" | "destructive" {
  if (["completed", "approved", "verified", "active"].includes(status)) return "default";
  if (["rejected", "failed", "blocked"].includes(status)) return "destructive";
  return "outline";
}

export function AdminPage() {
  const { t, language } = useI18n();
  const numberLocale = localeTags[language];
  const { status: authStatus, getSupabaseAccessToken } = useAuth();
  const [token, setToken] = useState("");
  const [session, setSession] = useState<AdminSession | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const payoutSubmitLockRef = useRef(false);
  const reviewActionLocksRef = useRef<Record<string, boolean>>({});
  const manualCreditLocksRef = useRef<Record<string, boolean>>({});
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
  const [reviewQueueLoading, setReviewQueueLoading] = useState(false);
  const [payoutReferences, setPayoutReferences] = useState<Record<string, string>>({});
  const [reviewDialog, setReviewDialog] = useState<ReviewDialogState | null>(null);
  const [reviewReason, setReviewReason] = useState("");
  const [config, setConfig] = useState<AdminConfig>({
    deposit_addresses: {},
    withdrawal_fees: {},
    announcement: "",
  });
  const [kyc, setKyc] = useState<AdminKycRecord[]>([]);
  const [audit, setAudit] = useState<AdminAuditRecord[]>([]);
  const [auditNextBefore, setAuditNextBefore] = useState<string | null>(null);
  const [auditPageLoading, setAuditPageLoading] = useState(false);
  const auditPageRequestRef = useRef(0);
  const tabLoadRequestRef = useRef(0);
  const userDetailRequestRef = useRef(0);
  const adminCandidatesRequestRef = useRef(0);
  const secondsQueueRequestRef = useRef(0);
  const kycRefreshLockRef = useRef(false);
  const kycQueueRequestRef = useRef(0);
  const withdrawalQueueRequestRef = useRef(0);
  const supportQueueRequestRef = useRef(0);
  const supportReplyLocksRef = useRef<Record<string, boolean>>({});
  const [auditSource, setAuditSource] = useState("unknown");
  const [auditCompleteness, setAuditCompleteness] = useState("unknown");
  const [orders, setOrders] = useState<Array<Record<string, unknown>>>([]);
  const [ordersSource, setOrdersSource] = useState("unknown");
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
  const [spotMarkets, setSpotMarkets] = useState<AdminSpotMarket[]>([]);
  const [spotMarketDraft, setSpotMarketDraft] = useState({
    base_asset: "BTC", quote_asset: "USDT", enabled: true,
    price_tick: "0.01", quantity_step: "0.000001", min_quantity: "0.000001",
    min_notional: "1", min_limit_price: "", max_limit_price: "", reason: "",
  });
  const [spotMarketRequestId, setSpotMarketRequestId] = useState("");
  const [secondsPolicy, setSecondsPolicy] = useState<{policy_id:string;policy_version:number;symbols:string[];durations_sec:number[];min_stake:number|string;max_stake:number|string;payout_bps:number;per_user_open_exposure:number|string|null;max_open_positions_per_user:number|null}|null>(null);
  const [secondsOpenPositions, setSecondsOpenPositions] = useState<AdminSecondsOpenPosition[]>([]);
  const [secondsOpenSummary, setSecondsOpenSummary] = useState<AdminSecondsOpenPositionsSnapshot | null>(null);
  const [secondsQueueLoading, setSecondsQueueLoading] = useState(false);
  const [secondsQueueError, setSecondsQueueError] = useState("");
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
      setError(adminText("Sign in with your BTCBOX administrator Supabase identity."));
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
      setError(adminText("Sign in with your BTCBOX administrator Supabase identity."));
      return;
    }
    let active = true;
    setLoading(true);
    refreshTokenAndSession().catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : adminText("Administrator access could not be verified"));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authStatus, refreshTokenAndSession]);

  useEffect(() => {
    if (!session?.user_id) return;
    const prefix = "btcbox.admin.payout-reference.v1." + session.user_id + ".";
    const restored: Record<string, string> = {};
    try {
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (!key || !key.startsWith(prefix)) continue;
        const saved = JSON.parse(window.localStorage.getItem(key) || "null");
        const withdrawalId = key.slice(prefix.length);
        if (saved && saved.version === 1 && saved.actor_id === session.user_id &&
            saved.withdrawal_id === withdrawalId && typeof saved.reference === "string" &&
            saved.reference.length > 0 && saved.reference.length <= 160 &&
            !/[\u0000-\u001f\u007f]/.test(saved.reference)) {
          restored[withdrawalId] = saved.reference;
        }
      }
      setPayoutReferences(restored);
    } catch {
      setError("A saved payout reference could not be read. Check the withdrawal status and chain transaction before entering a new reference.");
    }
  }, [session?.user_id]);

  const allowedTabs = useMemo(() => [...tabs.filter((item) => hasPermission(item.permission)), ...(session?.is_super_admin ? [{ id: "admins" as Tab, label: "Administrators", permission: "super_admin.only" }] : [])], [hasPermission, session]);
  useEffect(() => {
    if (allowedTabs.length && !allowedTabs.some((item) => item.id === tab)) setTab(allowedTabs[0].id);
  }, [allowedTabs, tab]);

  const loadTab = useCallback(async () => {
    const requestId = ++tabLoadRequestRef.current;
    if (tab !== "users") userDetailRequestRef.current += 1;
    if (tab !== "seconds") secondsQueueRequestRef.current += 1;
    if (!token || !session) return;
    const auditRequestId = ++auditPageRequestRef.current;
    setAuditPageLoading(false);
    setLoading(true);
    setError("");
    try {
      if (tab === "overview") {
        setStats(null);
        const snapshot = await getAdminStats(token);
        if (requestId !== tabLoadRequestRef.current) return;
        setStats(snapshot);
      }
      if (tab === "users") {
        userDetailRequestRef.current += 1;
        setUsers([]);
        setSelectedUser(null);
        const snapshot = await getAdminUsers(token, search);
        if (requestId !== tabLoadRequestRef.current) return;
        setUsers(snapshot.users);
      }
      if (tab === "deposits") {
        setConfig({ deposit_addresses: {}, withdrawal_fees: {}, announcement: "" });
        const snapshot = await getAdminConfig(token);
        if (requestId !== tabLoadRequestRef.current) return;
        setConfig(snapshot);
      }
      if (tab === "markets") {
        setSpotMarkets([]);
        const result = await getAdminSpotMarkets(token);
        if (requestId !== tabLoadRequestRef.current) return;
        setSpotMarkets(result.markets || []);
        const pendingKey = "btcbox.admin.spot-market.v1." + session.user_id;
        try {
          const raw = window.localStorage.getItem(pendingKey);
          if (raw) {
            const saved = JSON.parse(raw);
            if (saved && saved.version === 1 && saved.actor_id === session.user_id &&
                typeof saved.request_id === "string" && /^[A-Za-z0-9_-]{16,100}$/.test(saved.request_id) &&
                saved.draft && typeof saved.draft.base_asset === "string" && typeof saved.draft.quote_asset === "string" &&
                typeof saved.draft.reason === "string") {
              setSpotMarketDraft(saved.draft);
              setSpotMarketRequestId(saved.request_id);
            }
          }
        } catch {
          setError("A saved spot-market update could not be read. Check the market list before creating another update.");
        }
      }
      if (tab === "withdrawals") {
        const queueRequestId = ++withdrawalQueueRequestRef.current;
        setWithdrawals([]);
        try {
          const snapshot = await getAdminWithdrawals(token);
          if (requestId !== tabLoadRequestRef.current || queueRequestId !== withdrawalQueueRequestRef.current) return;
          setWithdrawals(snapshot.withdrawals || []);
        } catch (reason) {
          if (requestId !== tabLoadRequestRef.current || queueRequestId !== withdrawalQueueRequestRef.current) return;
          throw reason;
        }
      }
      if (tab === "kyc") {
        const queueRequestId = ++kycQueueRequestRef.current;
        setKyc([]);
        try {
          const snapshot = await getAdminKyc(token);
          if (requestId !== tabLoadRequestRef.current || queueRequestId !== kycQueueRequestRef.current) return;
          setKyc(snapshot.kycs || []);
        } catch (reason) {
          if (requestId !== tabLoadRequestRef.current || queueRequestId !== kycQueueRequestRef.current) return;
          throw reason;
        }
      }
      if (tab === "audit") {
        // Never leave a previously loaded audit snapshot visible while a new
        // read is pending or after that read fails.
        setAudit([]);
        setAuditNextBefore(null);
        setAuditSource("unknown");
        setAuditCompleteness("unknown");
        const snapshot = await getAdminAuditLogs(token);
        if (requestId === tabLoadRequestRef.current && auditRequestId === auditPageRequestRef.current) {
          setAudit(snapshot.logs || []);
          setAuditNextBefore(snapshot.source === "postgres_financial_audit_log" ? snapshot.next_before || null : null);
          setAuditSource(snapshot.source || "unknown");
          setAuditCompleteness(snapshot.completeness || "unknown");
        }
      }
      if (tab === "orders") {
        setOrders([]);
        setOrdersSource("unknown");
        const snapshot = await getAdminOrders(token);
        if (requestId !== tabLoadRequestRef.current) return;
        setOrders((snapshot.orders || []) as unknown as Array<Record<string, unknown>>);
        setOrdersSource(snapshot.source || "unknown");
      }
      if (tab === "support") {
        const queueRequestId = ++supportQueueRequestRef.current;
        setSupport([]);
        try {
          const snapshot = await getAdminSupportMessages(token);
          if (requestId !== tabLoadRequestRef.current || queueRequestId !== supportQueueRequestRef.current) return;
          setSupport((snapshot.messages || []) as unknown as Array<Record<string, unknown>>);
        } catch (reason) {
          if (requestId !== tabLoadRequestRef.current || queueRequestId !== supportQueueRequestRef.current) return;
          throw reason;
        }
      }
      if (tab === "seconds") {
        setSecondsPolicy(null);
        setSecondsOpenPositions([]);
        setSecondsOpenSummary(null);
        setSecondsQueueError("");
        const result = await getAdminSecondsPolicy(token);
        if (requestId !== tabLoadRequestRef.current) return;
        setSecondsPolicy(result.policy); setSecondsSymbols(result.policy.symbols); setSecondsDurations(result.policy.durations_sec);
        setSecondsMinStake(String(result.policy.min_stake)); setSecondsMaxStake(String(result.policy.max_stake));
        setSecondsPayoutPercent((result.policy.payout_bps / 100).toString());
        setSecondsExposure(result.policy.per_user_open_exposure === null ? "" : String(result.policy.per_user_open_exposure));
        setSecondsMaxOpenPositions(result.policy.max_open_positions_per_user === null ? "" : String(result.policy.max_open_positions_per_user));
        const secondsQueueRequestId = ++secondsQueueRequestRef.current;
        try {
          const queue = await getAdminSecondsOpenPositions(token);
          if (requestId !== tabLoadRequestRef.current || secondsQueueRequestId !== secondsQueueRequestRef.current) return;
          setSecondsOpenPositions(queue.positions);
          setSecondsOpenSummary(queue);
          setSecondsQueueError("");
        } catch (queueError) {
          if (requestId !== tabLoadRequestRef.current || secondsQueueRequestId !== secondsQueueRequestRef.current) return;
          setSecondsOpenPositions([]);
          setSecondsOpenSummary(null);
          setSecondsQueueError(queueError instanceof Error ? queueError.message : "Open Seconds positions are temporarily unavailable.");
        }
      }
      if (tab === "admins" && session.is_super_admin) {
        setAdminMemberships([]);
        setAdminCandidates([]);
        const candidatesRequestId = ++adminCandidatesRequestRef.current;
        const [membershipResult, userResult] = await Promise.all([getAdminMemberships(token), getAdminUsers(token, adminSearch)]);
        if (requestId !== tabLoadRequestRef.current) return;
        setAdminMemberships(membershipResult.admins || []);
        if (candidatesRequestId === adminCandidatesRequestRef.current) setAdminCandidates(userResult.users || []);
      }
    } catch (reason) {
      if (requestId === tabLoadRequestRef.current) {
        setError(reason instanceof Error ? reason.message : "Could not load administrator data.");
      }
    } finally {
      if (requestId === tabLoadRequestRef.current) setLoading(false);
    }
  }, [token, session, tab, search, adminSearch]);

  useEffect(() => {
    void loadTab();
    return () => { tabLoadRequestRef.current += 1; };
  }, [loadTab]);

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
    const requestId = ++userDetailRequestRef.current;
    setBusy(true); setError(""); setNotice("");
    // A failed user-detail read must never leave another user's balances or
    // manual-credit controls on screen as if they belonged to the new selection.
    setSelectedUser(null);
    try {
      const result = await getAdminUser(token, uid);
      if (requestId === userDetailRequestRef.current) setSelectedUser(result.user);

    } catch (reason) {
      if (requestId === userDetailRequestRef.current) {
        setError(reason instanceof Error ? reason.message : "User account could not be loaded.");
      }
    } finally {
      if (requestId === userDetailRequestRef.current) setBusy(false);
    }
  };

  const manualCredit = async (event: FormEvent<HTMLFormElement>, coin: string) => {
    event.preventDefault();
    if (!token || !selectedUser || manualCreditLocksRef.current[coin]) return;
    if (creditPendingInvalid[coin]) {
      setError("A saved manual-credit request is unreadable. Check the user's ledger before creating another credit.");
      return;
    }
    const selectedUid = selectedUser.uid;
    const selectedUserRequestId = userDetailRequestRef.current;
    const amount = (creditAmount[coin] || "").trim();
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(amount) || /^0(?:\.0*)?$/.test(amount)) {
      setError("Enter the verified amount received.");
      return;
    }
    const reference = (creditReference[coin] || "").trim();
    if (!reference || reference.length > 160 || /[\u0000-\u001f\u007f]/.test(reference)) {
      setError("Enter the verified transaction hash or receipt reference before crediting.");
      return;
    }
    if (!session?.user_id) {
      setError("The authenticated administrator identity is unavailable. No credit was sent.");
      return;
    }
    manualCreditLocksRef.current[coin] = true;
    const storageKey = "btcbox.admin.manual-credit.v1." + session.user_id + "." + selectedUser.uid + "." + coin;
    let stableRequestId = creditRequestIds[coin];
    if (!stableRequestId) {
      try { stableRequestId = window.crypto.randomUUID(); }
      catch {
        manualCreditLocksRef.current[coin] = false;
        setError("Secure manual-credit request IDs are unavailable in this browser. No credit was sent.");
        return;
      }
      const intent = {
        version: 1, actor_id: session.user_id, target_uid: selectedUser.uid, coin,
        request_id: stableRequestId, amount,
        reference, note: creditNote[coin] || "",
        created_at: Date.now(),
      };
      try { window.localStorage.setItem(storageKey, JSON.stringify(intent)); }
      catch {
        manualCreditLocksRef.current[coin] = false;
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
        reference,
        note: creditNote[coin] || "",
        idempotency_key: stableRequestId,
      });
      creditAccepted = true;
      try { window.localStorage.removeItem(storageKey); } catch {}
      setCreditRequestIds(current => { const next = { ...current }; delete next[coin]; return next; });
      setCreditPendingInvalid(current => { const next = { ...current }; delete next[coin]; return next; });
      setNotice(result.duplicate ? "This manual credit was already recorded." : "Manual credit recorded and audit event submitted.");
      // A completed credit must not steal focus from a different user selected
      // while the request was in flight. Refresh only the still-current detail.
      if (userDetailRequestRef.current === selectedUserRequestId && selectedUser?.uid === selectedUid) {
        await selectUser(selectedUid);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Manual credit was not confirmed.");
      if (!creditAccepted && reason instanceof ApiError && reason.status >= 400 && reason.status < 500 && reason.status !== 409) {
        try { window.localStorage.removeItem(storageKey); } catch {}
        setCreditRequestIds(current => { const next = { ...current }; delete next[coin]; return next; });
      }
    } finally { manualCreditLocksRef.current[coin] = false; setBusy(false); }
  };
  const refreshWithdrawalQueue = async (confirmedAction: string) => {
    const requestId = ++withdrawalQueueRequestRef.current;
    setReviewQueueLoading(true);
    setWithdrawals([]);
    try {
      const snapshot = await getAdminWithdrawals(token);
      if (requestId !== withdrawalQueueRequestRef.current) return;
      setWithdrawals(snapshot.withdrawals || []);
      setError("");
      setNotice(confirmedAction);
    } catch {
      if (requestId !== withdrawalQueueRequestRef.current) return;
      setWithdrawals([]);
      setError(confirmedAction + " The queue could not refresh. Reload this tab before taking another action.");
    } finally {
      if (requestId === withdrawalQueueRequestRef.current) setReviewQueueLoading(false);
    }
  };
  const refreshWithdrawalQueueManually = async () => {
    if (!token) return;
    const requestId = ++withdrawalQueueRequestRef.current;
    setReviewQueueLoading(true); setWithdrawals([]); setError(""); setNotice("");
    try {
      const snapshot = await getAdminWithdrawals(token);
      if (requestId !== withdrawalQueueRequestRef.current) return;
      setWithdrawals(snapshot.withdrawals || []);
      setNotice("Withdrawal queue refreshed.");
    } catch (reason) {
      if (requestId !== withdrawalQueueRequestRef.current) return;
      setWithdrawals([]);
      setError(reason instanceof Error ? reason.message : "Withdrawal review queue could not be refreshed.");
    } finally {
      if (requestId === withdrawalQueueRequestRef.current) setReviewQueueLoading(false);
    }
  };
  const loadOlderAuditRecords = async () => {
    if (!token || !auditNextBefore || auditPageLoading) return;
    const cursor = auditNextBefore;
    const requestId = ++auditPageRequestRef.current;
    setAuditPageLoading(true);
    setError("");
    try {
      const snapshot = await getAdminAuditLogs(token, 50, undefined, cursor);
      if (requestId !== auditPageRequestRef.current || cursor !== auditNextBefore) return;
      const nextSource = snapshot.source || "unknown";
      const nextCompleteness = snapshot.completeness || "unknown";
      if (nextSource !== auditSource || nextCompleteness !== auditCompleteness) {
        setError("Audit source changed while loading older records. Refresh the Audit log before continuing.");
        setAuditNextBefore(null);
        return;
      }
      setAudit(current => {
        const seen = new Set(current.map(item => item.id));
        return [...current, ...(snapshot.logs || []).filter(item => !seen.has(item.id))];
      });
      setAuditNextBefore(snapshot.next_before || null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Older audit records could not be loaded.");
    } finally {
      if (requestId === auditPageRequestRef.current) setAuditPageLoading(false);
    }
  };

  const refreshKycQueue = async () => {
    if (!token || kycRefreshLockRef.current) return;
    const requestId = ++kycQueueRequestRef.current;
    kycRefreshLockRef.current = true;
    setReviewQueueLoading(true); setError(""); setNotice("");
    // A failed refresh must not leave an older KYC decision queue actionable.
    setKyc([]);
    try {
      const snapshot = await getAdminKyc(token);
      if (requestId !== kycQueueRequestRef.current) return;
      setKyc(snapshot.kycs || []);
      setNotice("KYC review queue refreshed.");
    } catch (reason) {
      if (requestId !== kycQueueRequestRef.current) return;
      setError(reason instanceof Error ? reason.message : "KYC review queue could not be refreshed.");
    } finally {
      kycRefreshLockRef.current = false;
      if (requestId === kycQueueRequestRef.current) setReviewQueueLoading(false);
    }
  };
  const refreshKycQueueAfterReview = async (successMessage: string) => {
    const requestId = ++kycQueueRequestRef.current;
    setKyc([]);
    try {
      const snapshot = await getAdminKyc(token);
      if (requestId !== kycQueueRequestRef.current) return;
      setKyc(snapshot.kycs || []);
      setNotice(successMessage);
    } catch {
      if (requestId !== kycQueueRequestRef.current) return;
      setError(successMessage + " The queue could not refresh. Reload this tab before reviewing another application.");
    }
  };
  // A 409 WITHDRAWAL_ALREADY_PROCESSED means the operation actually succeeded on
  // the first (response-lost) attempt; a retry must be surfaced as a confirmed
  // notice, not as a red failure, and the queue should be refreshed.
  const isAlreadyProcessed = (reason: unknown): reason is ApiError =>
    reason instanceof ApiError && reason.code === "WITHDRAWAL_ALREADY_PROCESSED";
  const handleAlreadyProcessed = (message: string) => {
    setNotice(message);
    setError("");
    void refreshWithdrawalQueue(message + " ");
  };
  const approveWithdrawal = async (id: string) => {
    const lockKey = "withdrawal:" + id;
    if (!token || reviewActionLocksRef.current[lockKey]) return;
    reviewActionLocksRef.current[lockKey] = true;
    setBusy(true); setError(""); setNotice("");
    try {
      await adminApproveWithdrawal(token, id);
      setWithdrawals(current => current.map(item => item.id === id ? { ...item, status: "approved" } : item));
      setNotice("Withdrawal approved. Staff must still transfer the funds manually.");
      await refreshWithdrawalQueue("Withdrawal approval confirmed.");
    } catch (reason) {
      if (isAlreadyProcessed(reason)) { handleAlreadyProcessed("Withdrawal was already approved on a previous attempt. No duplicate charge was made."); }
      else { setError(reason instanceof Error ? reason.message : "Approval was not confirmed."); }
    }
    finally { reviewActionLocksRef.current[lockKey] = false; setBusy(false); }
  };
  const rejectWithdrawal = (id: string) => {
    setReviewDialog({ kind: "withdrawal", id });
    setReviewReason("");
    setError("");
    setNotice("");
  };

  const confirmReviewRejection = async () => {
    if (!token || !reviewDialog) return;
    const reasonText = reviewReason.trim();
    if (!reasonText) {
      setError("A rejection reason is required.");
      return;
    }
    const target = reviewDialog;
    const actionLockKey = target.kind === "withdrawal" ? "withdrawal:" + target.id : "kyc:" + target.uid;
    if (reviewActionLocksRef.current[actionLockKey]) return;
    reviewActionLocksRef.current[actionLockKey] = true;
    setBusy(true); setError(""); setNotice("");
    try {
      if (target.kind === "withdrawal") {
        await adminRejectWithdrawal(token, target.id, reasonText);
        setWithdrawals(current => current.filter(item => item.id !== target.id));
        setNotice("Withdrawal rejected and refund confirmed.");
        setReviewDialog(null);
        setReviewReason("");
        await refreshWithdrawalQueue("Withdrawal rejection and refund confirmed.");
      } else {
        await adminRejectKyc(token, target.uid, reasonText);
        setReviewDialog(null);
        setReviewReason("");
        await refreshKycQueueAfterReview("KYC rejected.");
      }
    } catch (reason) {
      if (target.kind === "withdrawal" && isAlreadyProcessed(reason)) {
        setReviewDialog(null); setReviewReason("");
        handleAlreadyProcessed("Withdrawal was already reviewed on a previous attempt. No duplicate refund was issued.");
      } else {
        setError(reason instanceof Error ? reason.message : "Rejection was not confirmed.");
      }
    } finally {
      reviewActionLocksRef.current[actionLockKey] = false;
      setBusy(false);
    }
  };

  const markPaid = async (id: string) => {
    if (!token || payoutSubmitLockRef.current) return;
    const reference = (payoutReferences[id] || "").trim();
    if (!reference || reference.length > 160 || /[\u0000-\u001f\u007f]/.test(reference)) {
      setError("Enter a valid TxID / payout reference (1–160 characters).");
      return;
    }
    if (!session?.user_id) {
      setError("The authenticated administrator identity is unavailable. No payout update was sent.");
      return;
    }
    const storageKey = "btcbox.admin.payout-reference.v1." + session.user_id + "." + id;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({
        version: 1, actor_id: session.user_id, withdrawal_id: id, reference,
      }));
    } catch {
      setError("This browser cannot safely save the payout reference. No payout update was sent.");
      return;
    }
    payoutSubmitLockRef.current = true;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await adminMarkWithdrawalPaid(token, { id, reference, note: "Staff manually transferred funds." });
      try { window.localStorage.removeItem(storageKey); } catch {}
      setWithdrawals(current => current.filter(item => item.id !== id));
      setPayoutReferences(current => { const next = { ...current }; delete next[id]; return next; });
      setNotice(result.duplicate ? "This payout reference was already recorded." : "Manual payout completion recorded.");
      await refreshWithdrawalQueue("Manual payout completion confirmed.");
      if (result.duplicate) setNotice("This payout reference was already recorded.");
    } catch (reason) {
      setError((reason instanceof Error ? reason.message : "Payout completion was not confirmed.") +
        " The same reference has been saved. Verify the transaction and withdrawal history before retrying.");
    } finally { payoutSubmitLockRef.current = false; setBusy(false); }
  };

  const saveAddresses = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await saveAdminConfig(token, config);
      setNotice("Finance configuration saved.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Configuration was not saved."); }
    finally { setBusy(false); }
  };

  const reviewKyc = async (uid: string, approved: boolean) => {
    if (!token) return;
    if (!approved) {
      setReviewDialog({ kind: "kyc", uid });
      setReviewReason("");
      setError("");
      setNotice("");
      return;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      await adminApproveKyc(token, uid);
      await refreshKycQueueAfterReview("KYC approved.");
    } catch (reason) {
      // KYC 409 responses include actionable states such as missing documents
      // and exception approval requirements; they are not proof of a prior success.
      setError(reason instanceof Error ? reason.message : "KYC review was not confirmed.");
    } finally {
      setBusy(false);
    }
  };

  const refreshSupportQueue = async () => {
    if (!token) return;
    const requestId = ++supportQueueRequestRef.current;
    setSupport([]); setError(""); setNotice("");
    try {
      const snapshot = await getAdminSupportMessages(token);
      if (requestId !== supportQueueRequestRef.current) return;
      setSupport((snapshot.messages || []) as unknown as Array<Record<string, unknown>>);
      setNotice("Support queue refreshed.");
    } catch (reason) {
      if (requestId !== supportQueueRequestRef.current) return;
      setSupport([]);
      setError(reason instanceof Error ? reason.message : "Support queue could not be refreshed.");
    }
  };

  const replySupport = async (uid: string) => {
    if (!token || supportReplyLocksRef.current[uid]) return;
    const content = (supportReply[uid] || "").trim();
    if (!content) return;
    let requestId = supportReplyRequestIds[uid];
    if (!requestId) {
      try { requestId = window.crypto.randomUUID(); }
      catch {
        setError("Secure support reply request IDs are unavailable in this browser. No reply was sent.");
        return;
      }
      setSupportReplyRequestIds((current) => ({ ...current, [uid]: requestId }));
    }
    supportReplyLocksRef.current[uid] = true;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await adminReplySupport(token, uid, content, requestId);
      setSupportReply((current) => ({ ...current, [uid]: "" }));
      setSupportReplyRequestIds((current) => { const next = { ...current }; delete next[uid]; return next; });
      const successMessage = result.audit_sync_pending ? "Support reply sent; audit delivery is pending." : "Support reply sent.";
      const queueRequestId = ++supportQueueRequestRef.current;
      setSupport([]);
      try {
        const snapshot = await getAdminSupportMessages(token);
        if (queueRequestId !== supportQueueRequestRef.current) return;
        setSupport((snapshot.messages || []) as unknown as Array<Record<string, unknown>>);
        setNotice(successMessage);
      } catch {
        if (queueRequestId !== supportQueueRequestRef.current) return;
        setSupport([]);
        setError(successMessage + " The conversation could not refresh. Reload this tab before replying again.");
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Support reply failed."); }
    finally { supportReplyLocksRef.current[uid] = false; setBusy(false); }
  };

  const saveSpotMarket = async () => {
    if (!token || !session?.user_id || !hasPermission("system_config.write")) return;
    const draft = {
      base_asset: spotMarketDraft.base_asset.trim().toUpperCase(),
      quote_asset: "USDT",
      enabled: spotMarketDraft.enabled,
      price_tick: spotMarketDraft.price_tick.trim(),
      quantity_step: spotMarketDraft.quantity_step.trim(),
      min_quantity: spotMarketDraft.min_quantity.trim(),
      min_notional: spotMarketDraft.min_notional.trim(),
      min_limit_price: spotMarketDraft.min_limit_price.trim(),
      max_limit_price: spotMarketDraft.max_limit_price.trim(),
      reason: spotMarketDraft.reason.trim(),
    };
    const decimal = /^(?:0|[1-9]\d{0,19})(?:\.\d{1,18})?$/;
    const asset = /^[A-Z0-9]{2,16}$/;
    if (!asset.test(draft.base_asset) || !asset.test(draft.quote_asset) || draft.base_asset === draft.quote_asset ||
        !decimal.test(draft.price_tick) || Number(draft.price_tick) <= 0 ||
        !decimal.test(draft.quantity_step) || Number(draft.quantity_step) <= 0 ||
        !decimal.test(draft.min_quantity) || Number(draft.min_quantity) <= 0 ||
        !decimal.test(draft.min_notional) ||
        (draft.min_limit_price && (!decimal.test(draft.min_limit_price) || Number(draft.min_limit_price) <= 0)) ||
        (draft.max_limit_price && (!decimal.test(draft.max_limit_price) || Number(draft.max_limit_price) <= 0)) ||
        (draft.min_limit_price && draft.max_limit_price && Number(draft.min_limit_price) > Number(draft.max_limit_price)) ||
        !draft.reason || draft.reason.length > 500) {
      setError("Check the pair, positive tick/step/minimums, optional price bounds and required reason.");
      return;
    }
    const storageKey = "btcbox.admin.spot-market.v1." + session.user_id;
    let requestId = spotMarketRequestId;
    if (!requestId) {
      requestId = window.crypto.randomUUID();
      try {
        window.localStorage.setItem(storageKey, JSON.stringify({
          version: 1, actor_id: session.user_id, request_id: requestId, draft,
          created_at: Date.now(),
        }));
      } catch {
        setError("This browser cannot safely save the spot-market request. No update was sent.");
        return;
      }
      setSpotMarketRequestId(requestId);
    }
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await saveAdminSpotMarket(token, {
        ...draft,
        min_limit_price: draft.min_limit_price || null,
        max_limit_price: draft.max_limit_price || null,
        request_id: requestId,
      });
      try { window.localStorage.removeItem(storageKey); } catch {}
      setSpotMarketRequestId("");
      setSpotMarketDraft(current => ({ ...current, reason: "" }));
      setNotice(result.replayed ? "This spot-market update was already saved." : "Spot-market configuration saved.");
      try {
        const refreshed = await getAdminSpotMarkets(token);
        setSpotMarkets(refreshed.markets || []);
      } catch {
        setError("The market update was saved, but the list could not be refreshed. Retry loading the Spot markets tab.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Spot-market update could not be confirmed. Retry the same saved request.");
    } finally { setBusy(false); }
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
      if (action === "provision") setAdminTargetUserId("");
      try {
        const refreshed = await getAdminMemberships(token);
        setAdminMemberships(refreshed.admins || []);
      } catch {
        setError("Administrator change is confirmed; the list could not refresh. Reload this tab before taking another action.");
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Administrator change could not be confirmed. Refresh before retrying."); }
    finally { setBusy(false); }
  };

  if (authStatus === "loading") return <AuthRestoreState />;
  if (authStatus === "anonymous" || authStatus === "two-factor" || authStatus === "password-recovery") return <div className="mx-auto max-w-3xl p-4 md:p-6"><AuthPage mode="login" redirectTo="/admin" /></div>;
  if (loading && !session) return <div className="mx-auto max-w-7xl p-6"><Card><CardContent className="p-8 text-sm text-brand-text-muted">{adminText("Verifying administrator identity…")}</CardContent></Card></div>;
  if (!session) return <div className="mx-auto max-w-3xl p-6"><Card><CardHeader><CardTitle>{adminText("BTCBOX Administrator")}</CardTitle><CardDescription>{adminText("Administrator access requires a verified Supabase Auth identity with an active BTCBOX administrator membership.")}</CardDescription></CardHeader><CardContent><p className="text-sm text-rose-300">{adminText(error || "Administrator membership was not found.")}</p></CardContent></Card></div>;

  return <div className="tone-admin mx-auto w-full max-w-[1600px] space-y-5 p-3 sm:p-5 lg:p-7">
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-brand-border bg-brand-surface p-5 sm:items-center sm:p-6">
      <div><BrandLogo compact /><p className="type-meta mt-3 font-semibold uppercase tracking-[0.18em] text-brand-accent">{adminText("BTCBOX / CONTROL CENTER")}</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-brand-text sm:text-3xl">{adminText("Administrator Console")}</h1><p className="mt-1 text-sm text-brand-text-muted">{session.is_super_admin ? adminText("Super Administrator") : adminText("Role-based administrator")} · {session.user_id}</p></div>
      <Badge variant="outline">{session.is_super_admin ? adminText("SUPER ADMIN") : adminText("ACTIVE ADMIN")}</Badge>
    </div>
    <div role="navigation" aria-label="管理功能" className="flex max-w-full gap-2 overflow-x-auto border-b border-brand-border pb-3">
      {allowedTabs.map(item => <Button key={item.id} className="shrink-0 whitespace-nowrap" size="sm" variant={tab === item.id ? "default" : "outline"} onClick={() => { setTab(item.id); setError(""); setNotice(""); }}>{adminText(item.label)}</Button>)}
    </div>
    {error ? <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-300">{adminText(error)}</div> : null}
    {notice ? <div role="status" className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 text-sm text-emerald-300">{adminText(notice)}</div> : null}
    {loading ? <Card><CardContent className="p-6 text-sm text-brand-text-muted">{adminText("Loading")}{adminText(allowedTabs.find(item=>item.id===tab)?.label||tab)}…</CardContent></Card> : null}

    {!loading && tab === "overview" && stats ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ["Total users", stats.total_users], ["Pending withdrawals", stats.pending_withdrawals],
        ["Pending KYC", stats.pending_kyc], ["Review queue", stats.pending_admin_review_withdrawals],
      ].map(([label, value], index) => <Card key={adminText(String(label))} className="overflow-hidden border-brand-border bg-brand-surface "><div className={"h-1 "+(index===0?"bg-brand-cyan":index===1?"bg-brand-warning":index===2?"bg-brand-violet":"bg-brand-teal")}/><CardContent className="p-4 sm:p-5"><p className="type-meta font-semibold uppercase tracking-wide text-brand-text-muted">{adminText(label)}</p><p className="mt-2 text-2xl font-bold tracking-tight tabular-nums text-brand-text sm:text-3xl">{asText(value)}</p></CardContent></Card>)}
    </div> : null}

    {!loading && tab === "users" ? <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
      <Card><CardHeader><CardTitle>{adminText("Users")}</CardTitle><CardDescription>{adminText("Search a user, then select an asset row for staff manual credit.")}</CardDescription></CardHeader><CardContent>
        <form className="mb-3 flex gap-2" onSubmit={event => { event.preventDefault(); void loadTab(); }}><input value={search} onChange={event => setSearch(event.target.value)} placeholder={adminText("Search UID or email")} className="h-11 min-w-0 flex-1 rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-brand-text outline-none transition-colors focus:border-brand-accent/60 focus:ring-2 focus:ring-brand-accent/15"/><Button size="sm" type="submit">{adminText("Search")}</Button></form>
        <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr className="border-b border-brand-border text-xs text-brand-text-muted"><th className="p-2">UID</th><th className="p-2">{adminText("Email")}</th><th className="p-2">{adminText("KYC")}</th><th className="p-2">{adminText("Status")}</th><th className="p-2"></th></tr></thead><tbody>{users.map(user=><tr key={user.uid} className="border-b border-brand-border/60"><td className="p-2 font-mono text-xs">{user.uid}</td><td className="p-2">{user.email}</td><td className="p-2">{user.kyc_status || user.kyc?.status || "—"}</td><td className="p-2"><Badge variant={user.frozen?"destructive":"outline"}>{user.frozen?adminText("Frozen"):adminText("Active")}</Badge></td><td className="p-2"><Button size="sm" variant="outline" onClick={()=>void selectUser(user.uid)}>{adminText("Open")}</Button></td></tr>)}</tbody></table></div>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>{adminText("Manual credit")}</CardTitle><CardDescription>{adminText("UID and asset are bound by the selected user and asset row. No pending deposit order is created.")}</CardDescription></CardHeader><CardContent>
        {!selectedUser ? <p className="text-sm text-brand-text-muted">{adminText("Select a user to load their current balances.")}</p> : <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{selectedUser.email} · <span className="font-mono">{selectedUser.uid}</span></p>{hasPermission("deposits.read") ? <Badge variant="outline">{selectedUser.financial_balance_source === "postgres_financial_ledger" ? adminText("Balances: PostgreSQL ledger") : selectedUser.financial_balance_source === "legacy_state_retention_limited" ? adminText("Balances: legacy state · limited") : adminText("Balances: source unknown")}</Badge> : null}</div>
          {!hasPermission("deposits.read") ? <p className="text-sm text-brand-text-muted">{adminText("Balance details require the deposits.read permission.")}</p> : <div className="space-y-3">{assets.map(coin=><form key={coin} className="rounded-xl border border-brand-border p-3" onSubmit={event=>void manualCredit(event,coin)}>
            <div className="mb-2 flex items-center justify-between"><span className="font-semibold">{coin}</span><span className="text-xs text-brand-text-muted">{adminText("Available:")}{asText(selectedUser.balances?.[coin]?.free ?? "0")}</span></div>
            <input disabled={!!creditRequestIds[coin]||!!creditPendingInvalid[coin]||busy} value={creditAmount[coin]||""} onChange={event=>setCreditAmount(current=>({...current,[coin]:event.target.value}))} placeholder={adminText("Verified amount received")} className="mb-2 w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-brand-text" inputMode="decimal"/>
            <input disabled={!!creditRequestIds[coin]||!!creditPendingInvalid[coin]||busy} value={creditReference[coin]||""} onChange={event=>setCreditReference(current=>({...current,[coin]:event.target.value}))} placeholder={adminText("Required TxID / receipt reference")} required maxLength={160} className="mb-2 w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-brand-text"/>
            <input disabled={!!creditRequestIds[coin]||!!creditPendingInvalid[coin]||busy} value={creditNote[coin]||""} onChange={event=>setCreditNote(current=>({...current,[coin]:event.target.value}))} placeholder={adminText("Note (optional)")} className="mb-2 w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-brand-text"/>
            <Button type="submit" size="sm" disabled={busy || !!creditPendingInvalid[coin] || !hasPermission("deposits.review") || !hasPermission("deposits.read")}>{creditRequestIds[coin] ? adminText("Retry same credit request") : adminText("Confirm manual credit")}</Button>
          </form>)}</div>}
          {hasPermission("deposits.read") ? <section className="mt-6 space-y-3 border-t border-brand-border pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold">Deposit history · latest 20</h3><p className="mt-1 text-xs text-brand-text-muted">The account snapshot returns the 20 most recent deposits. Use the Audit log for the wider financial event trail.</p></div><Badge variant="outline">{selectedUser.deposit_history_source === "postgres_financial_ledger" ? "Source: PostgreSQL ledger" : selectedUser.deposit_history_source === "legacy_state_retention_limited" ? "Source: legacy state · limited" : "Source: unavailable"}</Badge></div>
            {!selectedUser.deposit_history ? <p className="text-sm text-brand-text-muted">Deposit history is not available in this response. Refresh the user record before reviewing a credit.</p> :
              selectedUser.deposit_history.length === 0 ? <p className="text-sm text-brand-text-muted">No deposit records found.</p> :
              <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead><tr className="border-b border-brand-border text-brand-text-muted"><th className="p-2">Asset / network</th><th className="p-2">Amount</th><th className="p-2">Status</th><th className="p-2">Record ID</th><th className="p-2">Reference</th><th className="p-2">Time</th></tr></thead><tbody>{selectedUser.deposit_history.map((item,index)=><tr key={item.id || index} className="border-b border-brand-border/60"><td className="p-2">{item.coin} · {item.network || "—"}</td><td className="p-2 font-mono tabular-nums">{asText(item.amount)}</td><td className="p-2"><Badge variant={statusVariant(item.status)}>{item.status}</Badge></td><td className="max-w-[180px] truncate p-2 font-mono" title={item.id || ""}>{item.id || "—"}</td><td className="max-w-[220px] truncate p-2 font-mono" title={item.reference || item.txid || ""}>{item.reference || item.txid || "—"}</td><td className="whitespace-nowrap p-2">{formatDate(item.time, numberLocale)}</td></tr>)}</tbody></table></div>}
          </section> : null}
        </>}
      </CardContent></Card>
    </div> : null}

    {!loading && tab === "deposits" ? <Card><CardHeader><CardTitle>{adminText("Finance configuration")}</CardTitle><CardDescription>{adminText("Configure customer deposit addresses and server-enforced withdrawal fees. Staff verify incoming transfers and manually credit the selected user's asset row.")}</CardDescription></CardHeader><CardContent><form onSubmit={saveAddresses} className="space-y-5">
      <section className="space-y-3"><h3 className="text-sm font-semibold text-brand-text">{adminText("Deposit addresses")}</h3><div className="grid gap-3 md:grid-cols-2">{depositAddressKeys.map(key=><label key={key} className="block space-y-1"><span className="text-xs font-semibold text-brand-text-muted">{key.replace("_"," · ")}</span><input value={config.deposit_addresses[key]||""} onChange={event=>setConfig(current=>({...current,deposit_addresses:{...current.deposit_addresses,[key]:event.target.value}}))} className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-brand-text" placeholder={adminText("Configured wallet address")}/></label>)}</div></section>
      <section className="space-y-3"><div><h3 className="text-sm font-semibold text-brand-text">{adminText("Withdrawal fees")}</h3><p className="text-xs text-brand-text-muted">{adminText("These values are applied by the server when a withdrawal is submitted. Enter zero to disable a fee for an asset.")}</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{assets.map(coin=><label key={coin} className="block space-y-1"><span className="text-xs font-semibold text-brand-text-muted">{coin} {adminText("fee")}</span><input inputMode="decimal" value={config.withdrawal_fees?.[coin] ?? ""} onChange={event=>setConfig(current=>({...current,withdrawal_fees:{...current.withdrawal_fees,[coin]:event.target.value}}))} className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-brand-text" placeholder="0"/></label>)}</div></section>
      <label className="block space-y-1"><span className="text-xs font-semibold text-brand-text-muted">{adminText("Customer announcement")}</span><textarea value={config.announcement||""} onChange={event=>setConfig(current=>({...current,announcement:event.target.value}))} rows={3} className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-brand-text"/></label>
      <Button type="submit" disabled={busy || !hasPermission("system_config.write")}>{adminText("Save configuration")}</Button>
    </form></CardContent></Card> : null}

    {!loading && tab === "withdrawals" ? <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>Withdrawal queue</CardTitle><CardDescription>Approve or reject requests. After staff actually transfer funds, mark paid with the TxID/reference.</CardDescription></div><Button size="sm" variant="outline" disabled={reviewQueueLoading || busy} onClick={()=>void refreshWithdrawalQueueManually()}>{reviewQueueLoading ? "Refreshing…" : "Refresh queue"}</Button></div></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead><tr className="border-b border-brand-border text-xs text-brand-text-muted"><th className="p-2">ID</th><th className="p-2">User</th><th className="p-2">Asset / amount</th><th className="p-2">Network / destination</th><th className="p-2">Status</th><th className="p-2">Action</th></tr></thead><tbody>{withdrawals.map(item=><tr key={item.id} className="border-b border-brand-border/60 align-top"><td className="p-2 font-mono text-xs">{item.id}</td><td className="p-2">{item.uid}</td><td className="p-2">{item.coin} {item.amount}<div className="text-xs text-brand-text-muted">Fee {item.fee}</div></td><td className="max-w-[260px] break-all p-2">{item.network}<div className="text-xs text-brand-text-muted">{item.address}</div></td><td className="p-2"><Badge variant={statusVariant(item.status)}>{item.status}</Badge></td><td className="min-w-[220px] space-y-2 p-2">{item.status==="pending"||item.status==="pending_admin_review"?<><Button size="sm" disabled={busy||reviewQueueLoading||!hasPermission("withdrawals.review")} onClick={()=>void approveWithdrawal(item.id)}>Approve</Button><Button size="sm" variant="outline" disabled={busy||reviewQueueLoading||!hasPermission("withdrawals.review")} onClick={()=>void rejectWithdrawal(item.id)}>Reject</Button></>:item.status==="approved"?<><input disabled={reviewQueueLoading} value={payoutReferences[item.id]||""} onChange={event=>setPayoutReferences(current=>({...current,[item.id]:event.target.value}))} placeholder="Required TxID / reference" maxLength={160} className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-2 py-2 text-xs text-brand-text"/><Button size="sm" disabled={busy||reviewQueueLoading||!payoutReferences[item.id]?.trim()||!hasPermission("withdrawals.review")} onClick={()=>void markPaid(item.id)}>Mark paid</Button></>:<span className="text-xs text-brand-text-muted">{item.payout_reference||"—"}</span>}</td></tr>)}</tbody></table></div></CardContent></Card> : null}

    {!loading && tab === "kyc" ? <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>KYC review</CardTitle><Button size="sm" variant="outline" disabled={reviewQueueLoading || busy} onClick={()=>void refreshKycQueue()}>{reviewQueueLoading ? "Refreshing…" : "Refresh queue"}</Button></div></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead><tr className="border-b border-brand-border text-xs text-brand-text-muted"><th className="p-2">User</th><th className="p-2">Name</th><th className="p-2">Document</th><th className="p-2">Status</th><th className="p-2">Submitted</th><th className="p-2">Action</th></tr></thead><tbody>{kyc.map(item=><tr key={item.uid} className="border-b border-brand-border/60"><td className="p-2">{item.uid}<div className="text-xs text-brand-text-muted">{item.email}</div></td><td className="p-2">{item.name}</td><td className="p-2">{item.id_type}<div className="mt-1 text-xs">{item.document_url&&!item.document_preview_error?<a href={item.document_url} target="_blank" rel="noreferrer" className="text-brand-accent underline underline-offset-2">Open secure image</a>:<span className="text-brand-text-muted">{item.document_preview_error||"Document image missing"}</span>}</div></td><td className="p-2">{item.status}</td><td className="p-2">{formatDate(item.submitted_at, numberLocale)}</td><td className="space-x-2 p-2"><Button size="sm" disabled={busy||!hasPermission("kyc.review")||!item.document_uploaded||!item.document_url||!!item.document_preview_error} onClick={()=>void reviewKyc(item.uid,true)}>Approve</Button><Button size="sm" variant="outline" disabled={busy||!hasPermission("kyc.review")} onClick={()=>void reviewKyc(item.uid,false)}>Reject</Button>{!item.document_uploaded||!item.document_url||item.document_preview_error?<p className="mt-1 text-xs text-amber-300">{!item.document_uploaded?"Identity document upload is required before approval.":"Document preview unavailable; refresh the queue before approval."}</p>:null}</td></tr>)}</tbody></table></div></CardContent></Card> : null}

    {!loading && tab === "audit" ? <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-2"><div><CardTitle>Financial audit log</CardTitle><CardDescription>{auditCompleteness === "postgres_canonical" ? "Canonical append-only PostgreSQL history. Financial operations and account history use the same database source." : auditCompleteness === "state_document_retention_limited" ? "Retention-limited state-file history. Do not treat this list as a complete financial audit record." : "Audit source is not confirmed. Do not treat this list as complete until the source is verified."} Operator ID is the recorded actor identifier, not a display name.</CardDescription></div><Badge variant={auditCompleteness === "postgres_canonical" ? "default" : "destructive"}>{auditSource === "postgres_financial_audit_log" ? "PostgreSQL canonical" : auditSource === "btcbox_state" ? "State file · limited" : "Source unknown"}</Badge></div></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm"><thead><tr className="border-b border-brand-border text-xs text-brand-text-muted"><th className="p-2">Event ID</th><th className="p-2">Time</th><th className="p-2">Operator ID</th><th className="p-2">Action</th><th className="p-2">Affected user UID</th><th className="p-2">Sync</th><th className="p-2">Detail</th></tr></thead><tbody>{audit.length ? audit.map((item,index)=><tr key={item.id||index} className="border-b border-brand-border/60"><td className="p-2 font-mono text-xs">{item.id}</td><td className="p-2">{formatDate(item.time, numberLocale)}</td><td className="p-2 font-mono text-xs">{item.by}</td><td className="p-2">{item.action}</td><td className="p-2">{item.uid}</td><td className="p-2">{item.postgres_sync_status}</td><td className="max-w-[280px] break-all p-2 text-xs">{item.detail}</td></tr>) : <tr><td colSpan={7} className="p-6 text-center text-sm text-brand-text-muted">No audit records are available in this snapshot.</td></tr>}</tbody></table></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-brand-text-muted">Showing {audit.length} records from this source snapshot.</p>{auditNextBefore ? <Button type="button" variant="outline" disabled={auditPageLoading} onClick={()=>void loadOlderAuditRecords()}>{auditPageLoading ? "Loading older records..." : "Load older records"}</Button> : <span className="text-xs text-brand-text-muted">{auditSource === "postgres_financial_audit_log" ? "No older records in this snapshot." : "Legacy snapshot pagination is unavailable; this source is retention-limited."}</span>}</div></CardContent></Card> : null}

    {!loading && tab === "orders" ? <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-2"><div><CardTitle>Orders</CardTitle><CardDescription>{ordersSource === "postgres_financial_matching" ? "Customer order history and this administrator view use the canonical PostgreSQL matching orders." : ordersSource === "legacy_state" ? "Legacy state fallback is active because matching-engine mode was not requested." : "Order data source is not confirmed."}</CardDescription></div><Badge variant={ordersSource === "postgres_financial_matching" ? "default" : "destructive"}>{ordersSource === "postgres_financial_matching" ? "Source: PostgreSQL matching" : ordersSource === "legacy_state" ? "Source: legacy state" : "Source: unknown"}</Badge></div></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead><tr className="border-b border-brand-border text-xs text-brand-text-muted"><th className="p-2">ID</th><th className="p-2">User</th><th className="p-2">Symbol</th><th className="p-2">Side</th><th className="p-2">Status</th><th className="p-2">Created</th></tr></thead><tbody>{orders.map((item,index)=><tr key={asText(item.id)||index} className="border-b border-brand-border/60"><td className="p-2 font-mono text-xs">{asText(item.id)}</td><td className="p-2">{asText(item.uid||item.user_id)}</td><td className="p-2">{asText(item.symbol)}</td><td className="p-2">{asText(item.side)}</td><td className="p-2">{asText(item.status)}</td><td className="p-2">{formatDate(item.created_at||item.time, numberLocale)}</td></tr>)}</tbody></table></div></CardContent></Card> : null}

    {!loading && tab === "support" ? <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle>Support messages</CardTitle><Button size="sm" variant="outline" disabled={busy} onClick={()=>void refreshSupportQueue()}>Refresh queue</Button></CardHeader><CardContent className="space-y-3">{support.map((item,index)=>{const uid=asText(item.uid||item.user_id);return <div key={asText(item.id)||index} className="rounded-xl border border-brand-border p-3"><p className="text-xs text-brand-text-muted">{uid} · {formatDate(item.created_at||item.time)}</p><p className="mt-2 whitespace-pre-wrap text-sm">{asText(item.content||item.message)}</p><textarea value={supportReply[uid]||""} onChange={event=>{setSupportReply(current=>({...current,[uid]:event.target.value}));try { setSupportReplyRequestIds(current=>({...current,[uid]:window.crypto.randomUUID()})); } catch { setError("Secure support reply request IDs are unavailable in this browser. No reply was sent."); }}} rows={2} className="mt-3 w-full rounded-lg border border-brand-border bg-brand-surface-2 p-2 text-sm text-brand-text" placeholder="Reply to customer"/><Button size="sm" className="mt-2" disabled={busy||!supportReply[uid]?.trim()||!hasPermission("support.reply")} onClick={()=>void replySupport(uid)}>Send reply</Button></div>;})}</CardContent></Card> : null}
    {!loading && tab === "markets" ? <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.9fr)]">
      <Card><CardHeader><CardTitle>{adminText("Spot market catalogue")}</CardTitle><CardDescription>{adminText("Only enabled pairs accept limit orders. Market orders remain disabled; maker/taker fees stay at zero until fee movements are implemented atomically.")}</CardDescription></CardHeader><CardContent className="space-y-3">
        {spotMarkets.length ? <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b border-brand-border text-xs text-brand-text-muted"><th className="p-2">{adminText("Pair")}</th><th className="p-2">{adminText("Status")}</th><th className="p-2">{adminText("Tick / step")}</th><th className="p-2">{adminText("Min quantity / notional")}</th><th className="p-2"></th></tr></thead><tbody>{spotMarkets.map(market=><tr key={market.base_asset + "/" + market.quote_asset} className="border-b border-brand-border/60"><td className="p-2 font-semibold">{market.base_asset}/{market.quote_asset}</td><td className="p-2"><Badge variant={market.enabled ? "default" : "outline"}>{market.enabled ? adminText("Enabled") : adminText("Disabled")}</Badge></td><td className="p-2 text-xs tabular-nums">{asText(market.price_tick)} / {asText(market.quantity_step)}</td><td className="p-2 text-xs tabular-nums">{asText(market.min_quantity)} / {asText(market.min_notional)}</td><td className="p-2"><Button size="sm" variant="outline" disabled={busy || !!spotMarketRequestId || !hasPermission("system_config.write")} onClick={()=>setSpotMarketDraft({base_asset:market.base_asset,quote_asset:market.quote_asset,enabled:market.enabled,price_tick:String(market.price_tick),quantity_step:String(market.quantity_step),min_quantity:String(market.min_quantity),min_notional:String(market.min_notional),min_limit_price:market.min_limit_price==null?"":String(market.min_limit_price),max_limit_price:market.max_limit_price==null?"":String(market.max_limit_price),reason:""})}>{adminText("Edit")}</Button></td></tr>)}</tbody></table></div> : <p className="text-sm text-brand-text-muted">{adminText("No spot pairs have been configured yet.")}</p>}
        <Button size="sm" variant="outline" disabled={busy || !!spotMarketRequestId || !hasPermission("system_config.write")} onClick={()=>setSpotMarketDraft({base_asset:"",quote_asset:"USDT",enabled:false,price_tick:"0.01",quantity_step:"0.000001",min_quantity:"0.000001",min_notional:"1",min_limit_price:"",max_limit_price:"",reason:""})}>{adminText("Add market pair")}</Button>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>{adminText("Market parameters")}</CardTitle><CardDescription>{adminText("Changes are permission-checked, request-ID protected and audited by PostgreSQL. Existing orders keep their accepted terms.")}</CardDescription></CardHeader><CardContent className="space-y-3">
        {spotMarketRequestId ? <p role="status" className="rounded-lg border border-amber-500/30 p-3 text-xs text-amber-300">{adminText("A previous request is unconfirmed. Retry the exact same update; fields are locked to prevent changing the payload.")}</p> : null}
        <div className="grid grid-cols-2 gap-3"><label className="space-y-1 text-sm"><span>{adminText("Base asset")}</span><select value={spotMarketDraft.base_asset} disabled={busy||!!spotMarketRequestId||!hasPermission("system_config.write")} onChange={event=>setSpotMarketDraft(current=>({...current,base_asset:event.target.value}))} className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-brand-text"><option value="">{adminText("Select asset")}</option>{spotAssets.map(asset=><option key={asset} value={asset}>{asset}</option>)}</select></label><label className="space-y-1 text-sm"><span>{adminText("Quote asset")}</span><input value="USDT" readOnly disabled className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-brand-text"/></label></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={spotMarketDraft.enabled} disabled={busy||!!spotMarketRequestId||!hasPermission("system_config.write")} onChange={event=>setSpotMarketDraft(current=>({...current,enabled:event.target.checked}))}/>{adminText("Enable this market")}</label>
        <div className="grid grid-cols-2 gap-3">{([["price_tick","Price tick"],["quantity_step","Quantity step"],["min_quantity","Minimum quantity"],["min_notional","Minimum notional"]] as const).map(([key,label])=><label key={key} className="space-y-1 text-sm"><span>{adminText(label)}</span><input value={spotMarketDraft[key as keyof typeof spotMarketDraft] as string} disabled={busy||!!spotMarketRequestId||!hasPermission("system_config.write")} onChange={event=>setSpotMarketDraft(current=>({...current,[key]:event.target.value}))} inputMode="decimal" className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-brand-text"/></label>)}</div>
        <div className="grid grid-cols-2 gap-3"><label className="space-y-1 text-sm"><span>{adminText("Minimum limit price (optional)")}</span><input value={spotMarketDraft.min_limit_price} disabled={busy||!!spotMarketRequestId||!hasPermission("system_config.write")} onChange={event=>setSpotMarketDraft(current=>({...current,min_limit_price:event.target.value}))} inputMode="decimal" className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-brand-text"/></label><label className="space-y-1 text-sm"><span>{adminText("Maximum limit price (optional)")}</span><input value={spotMarketDraft.max_limit_price} disabled={busy||!!spotMarketRequestId||!hasPermission("system_config.write")} onChange={event=>setSpotMarketDraft(current=>({...current,max_limit_price:event.target.value}))} inputMode="decimal" className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-brand-text"/></label></div>
        <label className="block space-y-1 text-sm"><span>{adminText("Reason (required)")}</span><textarea value={spotMarketDraft.reason} disabled={busy||!!spotMarketRequestId||!hasPermission("system_config.write")} onChange={event=>setSpotMarketDraft(current=>({...current,reason:event.target.value}))} rows={2} maxLength={500} className="w-full rounded-lg border border-brand-border bg-brand-surface-2 p-3 text-brand-text"/></label>
        {hasPermission("system_config.write") ? <Button block disabled={busy||!spotMarketDraft.reason.trim()} onClick={()=>void saveSpotMarket()}>{spotMarketRequestId ? adminText("Retry same update") : adminText("Save market settings")}</Button> : <p className="text-sm text-brand-text-muted">{adminText("Your administrator role is read-only for spot markets.")}</p>}
      </CardContent></Card>
    </div> : null}
    {!loading && tab === "seconds" && secondsPolicy ? <Card><CardHeader><CardTitle>{adminText("Seconds contract policy")}</CardTitle><CardDescription>{adminText("Changes create and activate a new immutable policy version. Existing open positions keep their original policy snapshot. 85% is the minimum payout rate; no fixed upper limit is imposed.")}</CardDescription></CardHeader><CardContent className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><Badge variant="outline">{adminText("Active version")}{secondsPolicy.policy_version}</Badge><span className="text-xs text-brand-text-muted">{adminText("Policy ID ·")}{secondsPolicy.policy_id}</span></div>
      <div><p className="mb-2 text-sm font-semibold">{adminText("Supported markets")}</p><div className="flex flex-wrap gap-2">{["BTC","ETH","SOL","BNB"].map(symbol=><label key={symbol} className="flex items-center gap-2 rounded-lg border border-brand-border px-3 py-2 text-sm"><input type="checkbox" checked={secondsSymbols.includes(symbol)} disabled={busy||!hasPermission("seconds_policy.manage")} onChange={event=>setSecondsSymbols(current=>event.target.checked?[...current,symbol]:current.filter(item=>item!==symbol))}/>{symbol}</label>)}</div></div>
      <div><p className="mb-2 text-sm font-semibold">{adminText("Contract durations (seconds)")}</p><div className="flex flex-wrap gap-2">{secondsDurations.slice().sort((a,b)=>a-b).map(duration=><button key={duration} type="button" disabled={busy||!hasPermission("seconds_policy.manage")||secondsDurations.length<=1} onClick={()=>setSecondsDurations(current=>current.filter(item=>item!==duration))} className="rounded-lg border border-brand-border px-3 py-2 text-sm tabular-nums">{duration}{adminText("s")}<span className="ml-1 text-brand-text-muted">×</span></button>)}</div><div className="mt-2 flex gap-2"><input type="number" min="1" step="1" value={secondsDurationInput} disabled={busy||!hasPermission("seconds_policy.manage")} onChange={event=>setSecondsDurationInput(event.target.value)} className="w-32 rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-brand-text" aria-label={adminText("Add duration in seconds")}/><Button size="sm" type="button" variant="outline" disabled={busy||!hasPermission("seconds_policy.manage")||!Number.isSafeInteger(Number(secondsDurationInput))||Number(secondsDurationInput)<=0||secondsDurations.includes(Number(secondsDurationInput))} onClick={()=>{setSecondsDurations(current=>[...current,Number(secondsDurationInput)].sort((a,b)=>a-b));setSecondsDurationInput("");}}>{adminText("Add duration")}</Button></div></div>
      <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm"><span>{adminText("Minimum stake (USDT)")}</span><input value={secondsMinStake} disabled={busy||!hasPermission("seconds_policy.manage")} onChange={event=>setSecondsMinStake(event.target.value)} inputMode="decimal" className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-brand-text"/></label><label className="space-y-1 text-sm"><span>{adminText("Maximum stake (USDT)")}</span><input value={secondsMaxStake} disabled={busy||!hasPermission("seconds_policy.manage")} onChange={event=>setSecondsMaxStake(event.target.value)} inputMode="decimal" className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-brand-text"/></label><label className="space-y-1 text-sm"><span>{adminText("Winning payout rate (%) · minimum 85")}</span><input value={secondsPayoutPercent} disabled={busy||!hasPermission("seconds_policy.manage")} onChange={event=>setSecondsPayoutPercent(event.target.value)} inputMode="decimal" className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-brand-text"/></label><label className="space-y-1 text-sm"><span>{adminText("Per-user open exposure limit (USDT, optional)")}</span><input value={secondsExposure} disabled={busy||!hasPermission("seconds_policy.manage")} onChange={event=>setSecondsExposure(event.target.value)} inputMode="decimal" placeholder={adminText("No additional limit")} className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-brand-text"/></label><label className="space-y-1 text-sm"><span>{adminText("Maximum unfinished positions per user (optional)")}</span><input type="number" min="1" step="1" value={secondsMaxOpenPositions} disabled={busy||!hasPermission("seconds_policy.manage")} onChange={event=>setSecondsMaxOpenPositions(event.target.value)} placeholder={adminText("No count limit")} className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-brand-text"/></label></div>
      <label className="block space-y-1 text-sm"><span>{adminText("Reason for policy change (required)")}</span><textarea value={secondsReason} disabled={busy||!hasPermission("seconds_policy.manage")} onChange={event=>setSecondsReason(event.target.value)} rows={2} maxLength={500} className="w-full rounded-lg border border-brand-border bg-brand-surface-2 p-3 text-brand-text" placeholder={adminText("Explain why these rules are changing")}/></label>
      {hasPermission("seconds_policy.manage")?<Button block disabled={busy||!secondsReason.trim()} onClick={()=>void saveSecondsPolicy()}>{adminText("Create and activate new policy version")}</Button>:<p className="text-sm text-brand-text-muted">{adminText("Your administrator role is read-only for Seconds policy.")}</p>}
    </CardContent></Card> : null}
    {!loading && tab === "seconds" ? <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><div><CardTitle>Open Seconds positions</CardTitle><CardDescription>Read-only live queue. Due positions remain visible until the server confirms settlement; staff cannot force a result or manually release frozen funds here.</CardDescription></div><Button size="sm" variant="outline" disabled={secondsQueueLoading || !token} onClick={() => { if (!token) return; const requestId = ++secondsQueueRequestRef.current; setSecondsQueueLoading(true); setSecondsOpenPositions([]); setSecondsOpenSummary(null); setSecondsQueueError(""); void getAdminSecondsOpenPositions(token).then(result => { if (requestId !== secondsQueueRequestRef.current) return; setSecondsOpenPositions(result.positions); setSecondsOpenSummary(result); }).catch(reason => { if (requestId === secondsQueueRequestRef.current) { setSecondsOpenPositions([]); setSecondsOpenSummary(null); setSecondsQueueError(reason instanceof Error ? reason.message : "Open Seconds positions are temporarily unavailable."); } }).finally(() => { if (requestId === secondsQueueRequestRef.current) setSecondsQueueLoading(false); }); }}>{secondsQueueLoading ? "Refreshing…" : "Refresh queue"}</Button></div></CardHeader><CardContent className="space-y-3">
      {secondsQueueError ? <p role="alert" className="rounded-lg border border-brand-border p-3 text-sm text-brand-text-muted">{secondsQueueError}</p> : null}
      {secondsOpenSummary ? <div className="grid gap-2 sm:grid-cols-3"><div className="rounded-lg border border-brand-border p-3"><p className="text-xs text-brand-text-muted">Open positions</p><p className="mt-1 text-lg font-semibold">{secondsOpenSummary.total_open_count}</p></div><div className="rounded-lg border border-brand-border p-3"><p className="text-xs text-brand-text-muted">Open exposure · USDT</p><p className="mt-1 text-lg font-semibold">{Number(secondsOpenSummary.total_open_exposure).toLocaleString(numberLocale,{maximumFractionDigits:8})}</p></div><div className="rounded-lg border border-brand-border p-3"><p className="text-xs text-brand-text-muted">Past maturity, not yet settled</p><p className="mt-1 text-lg font-semibold">{secondsOpenSummary.overdue_count}</p></div></div> : null}
      {secondsOpenSummary?.truncated ? <p className="text-xs text-brand-text-muted">Showing the earliest 100 open positions. Summary totals include all open positions.</p> : null}
      {secondsOpenPositions.length ? <div className="space-y-2">{secondsOpenPositions.map(position=><div key={position.position_id} className="rounded-xl border border-brand-border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="font-semibold">{position.symbol}/USDT · {position.direction.toUpperCase()}</div><Badge variant={position.overdue ? "destructive" : "outline"}>{position.overdue ? "Maturity reached · awaiting settlement" : "Open"}</Badge></div><div className="mt-2 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4"><div><span className="text-brand-text-muted">Stake</span><p className="font-medium">{Number(position.amount).toLocaleString(numberLocale,{maximumFractionDigits:8})} USDT</p></div><div><span className="text-brand-text-muted">Open price</span><p className="font-medium">{Number(position.open_price).toLocaleString(numberLocale,{maximumFractionDigits:12})}</p></div><div><span className="text-brand-text-muted">Duration / payout</span><p className="font-medium">{position.duration_sec}s · {position.payout_bps_snapshot === null ? "Legacy 85%" : (position.payout_bps_snapshot/100)+"%"}</p></div><div><span className="text-brand-text-muted">Maturity</span><p className="font-medium">{new Date(position.settle_at).toLocaleString(numberLocale)}</p></div></div><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-brand-text-muted"><span>User UID · <span className="font-mono">{position.user_id}</span></span><span>Position · <span className="font-mono">{position.position_id}</span></span><span>Policy v{position.policy_version ?? "legacy"}</span></div></div>)}</div> : secondsQueueError ? null : <p className="rounded-lg border border-dashed border-brand-border p-6 text-center text-sm text-brand-text-muted">No open Seconds positions.</p>}
    </CardContent></Card> : null}
    {!loading && tab === "admins" && session.is_super_admin ? <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
      <Card><CardHeader><CardTitle>Delegated administrators</CardTitle><CardDescription>Only the Super Admin can provision, change, suspend or revoke administrator access. Every change requires a reason and is recorded by the database.</CardDescription></CardHeader><CardContent className="space-y-3">
        {adminMemberships.length ? adminMemberships.map(item=><div key={item.user_id} className="rounded-xl border border-brand-border p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-mono text-xs text-brand-text">{item.user_id}</p><p className="mt-1 text-xs text-brand-text-muted">Revision {item.revision} · {formatDate(item.updated_at||item.created_at, numberLocale)}</p></div><Badge variant={statusVariant(item.status)}>{item.status}</Badge></div><p className="mt-2 break-words text-xs text-brand-text-muted">{item.permissions.join(" · ") || "No permissions"}</p><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busy||item.status==="revoked"} onClick={()=>{setAdminTargetUserId(item.user_id);setAdminPermissions(item.permissions);setAdminReason("");setAdminRequestId("");setAdminRequestKey("");}}>Edit permissions</Button>{item.status==="active"?<Button size="sm" variant="outline" disabled={busy} onClick={()=>void submitAdminMembershipChange("suspend",item.user_id,item.revision,[])}>Suspend</Button>:null}{item.status==="suspended"?<Button size="sm" variant="outline" disabled={busy} onClick={()=>void submitAdminMembershipChange("reactivate",item.user_id,item.revision,item.permissions)}>Reactivate</Button>:null}{item.status!=="revoked"?<Button size="sm" variant="destructive" disabled={busy} onClick={()=>void submitAdminMembershipChange("revoke",item.user_id,item.revision,[])}>Revoke</Button>:null}</div></div>) : <p className="text-sm text-brand-text-muted">No delegated administrators have been provisioned.</p>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>{adminMemberships.some(item=>item.user_id===adminTargetUserId)?"Edit administrator permissions":"Provision administrator"}</CardTitle><CardDescription>Select an existing BTCBOX user. The database verifies that the target UUID belongs to a real Supabase Auth user.</CardDescription></CardHeader><CardContent className="space-y-3">
        <form className="flex gap-2" onSubmit={event=>{event.preventDefault();if(!token)return;const requestId=++adminCandidatesRequestRef.current;setAdminCandidates([]);setError("");void getAdminUsers(token,adminSearch).then(result=>{if(requestId===adminCandidatesRequestRef.current)setAdminCandidates(result.users||[]);}).catch(reason=>{if(requestId===adminCandidatesRequestRef.current)setError(reason instanceof Error?reason.message:"User search failed.");});}}><input value={adminSearch} onChange={event=>setAdminSearch(event.target.value)} placeholder="Search user email or UID" className="min-w-0 flex-1 rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-brand-text"/><Button size="sm" type="submit" variant="outline">Search</Button></form>
        <select value={adminTargetUserId} onChange={event=>{const value=event.target.value;setAdminTargetUserId(value);const found=adminMemberships.find(item=>item.user_id===value);setAdminPermissions(found?.permissions||[]);setAdminRequestId("");setAdminRequestKey("");}} className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-brand-text"><option value="">Select an Auth-linked user</option>{adminCandidates.filter(user=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(user.admin_auth_user_id||"")&&!adminMemberships.some(item=>item.user_id===user.admin_auth_user_id)).map(user=><option key={user.uid} value={user.admin_auth_user_id}>{user.email} · BTCBOX UID {user.uid}</option>)}{adminMemberships.some(item=>item.user_id===adminTargetUserId)?<option value={adminTargetUserId}>{adminTargetUserId}</option>:null}</select>
        <div className="grid gap-2 sm:grid-cols-2">{adminPermissionOptions.map(([key,label])=><label key={key} className="flex items-center gap-2 rounded-lg border border-brand-border p-2 text-xs"><input type="checkbox" checked={adminPermissions.includes(key)} onChange={event=>setAdminPermissions(current=>event.target.checked?[...current,key]:current.filter(item=>item!==key))}/><span>{label}</span></label>)}</div>
        <textarea value={adminReason} onChange={event=>setAdminReason(event.target.value)} rows={2} maxLength={500} placeholder="Required reason for this administrator change" className="w-full rounded-lg border border-brand-border bg-brand-surface-2 p-3 text-sm text-brand-text"/>
        <Button block disabled={busy||!adminTargetUserId||(!adminMemberships.some(item=>item.user_id===adminTargetUserId)&&!adminPermissions.length)||!adminReason.trim()} onClick={()=>{const existing=adminMemberships.find(item=>item.user_id===adminTargetUserId);void submitAdminMembershipChange(existing?"set_permissions":"provision",adminTargetUserId,existing?.revision||0,adminPermissions);}}>{adminMemberships.some(item=>item.user_id===adminTargetUserId)?"Save permissions":"Provision administrator"}</Button>
      </CardContent></Card>
    </div> : null}
    {reviewDialog ? <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4"
      role="presentation"
      onMouseDown={event => { if (event.target === event.currentTarget && !busy) { setReviewDialog(null); setReviewReason(""); } }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-dialog-title"
        aria-describedby="review-dialog-description"
        className="w-full max-w-lg rounded-xl border border-brand-border bg-brand-surface p-5 shadow-2xl"
      >
        <div className="mb-4">
          <h2 id="review-dialog-title" className="text-lg font-semibold text-brand-text">
            {reviewDialog.kind === "withdrawal" ? adminText("Reject withdrawal") : adminText("Reject KYC application")}
          </h2>
          <p id="review-dialog-description" className="mt-1 text-sm text-brand-text-muted">
            {reviewDialog.kind === "withdrawal"
              ? adminText("The rejection and refund will be recorded together. Enter the reason for the audit record.")
              : adminText("Enter the reason that will be recorded with this KYC decision.")}
          </p>
        </div>
        <label className="block space-y-2 text-sm">
          <span className="font-medium text-brand-text">{adminText("Rejection reason")}<span className="text-rose-400">*</span></span>
          <textarea
            autoFocus
            value={reviewReason}
            onChange={event => setReviewReason(event.target.value)}
            rows={4}
            maxLength={300}
            disabled={busy}
            placeholder={adminText("Enter a clear reason (up to 300 characters)")}
            className="w-full resize-y rounded-lg border border-brand-border bg-brand-surface-2 p-3 text-brand-text outline-none focus:border-brand-accent"
          />
          <span className="block text-right text-xs text-brand-text-muted">{reviewReason.length}/300</span>
        </label>
        {error ? <p role="alert" className="mt-3 text-sm text-rose-300">{adminText(error)}</p> : null}
        <div className="mt-5 flex flex-col-reverse justify-end gap-2 sm:flex-row">
          <Button type="button" variant="outline" disabled={busy} onClick={() => { setReviewDialog(null); setReviewReason(""); }}>{adminText("Cancel")}</Button>
          <Button type="button" variant="destructive" disabled={busy || !reviewReason.trim()} onClick={() => void confirmReviewRejection()}>
            {busy ? adminText("Submitting…") : adminText("Confirm rejection")}
          </Button>
        </div>
      </section>
    </div> : null}
  </div>;
}
