import { AuthRestoreState } from "../../components/AuthRestoreState";
import { BrandLogo } from "../../components/BrandLogo";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { useAuth } from "../../lib/auth";
import { adminText } from "../../lib/admin-i18n";
import { AuthPage } from "../auth/AuthPages";
import {
  ApiError,
  adminAdjustBalance,
  adminApproveKyc,
  adminApproveWithdrawal,
  adminManualCredit,
  adminResetUserEmail,
  adminResetUserPassword,
  adminSetUserFrozen,
  adminMarkWithdrawalPaid,
  adminRejectKyc,
  adminRejectWithdrawal,
  adminReplySupport,
  markAdminSupportRead,
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
  getAdminAddresses,
  manageAdminAddress,
  type AdminPayoutAddress,
  getAdminSupportFaq,
  saveAdminSupportFaq,
  deleteAdminSupportFaq,
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
  type AdminSupportFaqEntry,
  type AdminSecondsOpenPosition,
  type AdminSecondsOpenPositionsSnapshot,
  type AdminUserRecord,
  type AdminWithdrawalRecord,
} from "../../lib/api";

type ReviewDialogState = { kind: "withdrawal"; id: string } | { kind: "kyc" | "kyc-manual"; uid: string };
type Tab = "overview" | "users" | "deposits" | "withdrawals" | "kyc" | "audit" | "orders" | "support" | "support-faq" | "payout-addresses" | "admins" | "seconds" | "markets";
const tabs: Array<{ id: Tab; label: string; permission: string }> = [
  { id: "overview", label: "Overview", permission: "dashboard.read" },
  { id: "users", label: "Users & manual credit", permission: "users.read" },
  { id: "deposits", label: "Deposit addresses", permission: "system_config.read" },
  { id: "withdrawals", label: "Withdrawals", permission: "withdrawals.read" },
  { id: "kyc", label: "KYC", permission: "kyc.read" },
  { id: "audit", label: "Audit log", permission: "financial_audit.read" },
  { id: "orders", label: "Orders", permission: "orders.read" },
  { id: "support", label: "Support", permission: "support.read" },
  { id: "payout-addresses", label: "Bank payout details", permission: "payout_addresses.read_sensitive" },
  { id: "support-faq", label: "Help centre", permission: "support.manage" },
  { id: "seconds", label: "Seconds policy", permission: "seconds_policy.read" },
  { id: "markets", label: "Spot markets", permission: "system_config.read" },
];
const adminPermissionOptions = [["dashboard.read","Dashboard"],["users.read","Read users"],["users.manage","Manage users"],["users.freeze","Freeze accounts"],["financial_adjustment.request","Manual balance adjustment"],["kyc.read","Read KYC"],["kyc.review","Review KYC"],["deposits.read","Read deposits"],["deposits.review","Manual deposit credit"],["payout_addresses.read_sensitive","Read sensitive customer payout addresses"],["payout_addresses.manage","Manage customer payout addresses"],["withdrawals.read","Read withdrawals"],["withdrawals.review","Review and mark paid"],["orders.read","Read orders"],["support.read","Read support"],["support.reply","Reply to support"],["support.manage","Manage support"],["announcements.read","Read announcements"],["announcements.manage","Manage announcements"],["system_config.read","Read system configuration"],["system_config.write","Edit system configuration"],["seconds_policy.read","Read Seconds policy"],["seconds_policy.manage","Manage Seconds policy"],["financial_audit.read","Read financial audit"]] as const;
const depositAddressKeys = [
  "USDT-TRC20", "USDT-ERC20", "USDT-BEP20", "BTC-BTC",
  "ETH-ERC20", "SOL-SOL", "BNB-BEP20", "USDC-ERC20",
];
const assets = ["USDT", "BTC", "ETH", "SOL", "BNB", "USDC"];
const spotAssets = ["USDT", "USDC", "BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX", "LINK", "DOT", "TRX", "LTC", "BCH", "NEAR", "UNI", "ATOM", "ETC", "APT", "ARB", "OP", "SUI", "INJ", "TIA", "FIL"];

function asText(value: unknown) {
  return value === null || value === undefined ? "—" : String(value);
}
function formatDate(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("zh-CN");
}
function statusVariant(status: string): "success" | "warning" | "destructive" | "info" | "outline" {
  const s = String(status).toLowerCase();
  if (["completed", "approved", "verified", "active", "enabled", "paid", "settled", "success", "successful"].includes(s)) return "success";
  if (["rejected", "failed", "blocked", "revoked", "expired", "cancelled", "canceled", "error"].includes(s)) return "destructive";
  if (["pending", "pending_admin_review", "review", "waiting", "suspended", "processing", "submitted", "in_review"].includes(s)) return "warning";
  return "outline";
}
function permissionLabel(key: string): string {
  const found = adminPermissionOptions.find(([k]) => k === key);
  return found ? adminText(found[1]) : adminText(key);
}

function groupSupportThreads(messages: Array<Record<string, unknown>>) {
  const grouped = new Map<string, { uid: string; email: string; messages: Array<Record<string, unknown>> }>();
  for (const message of messages) {
    const uid = String(message.uid || message.user_id || "").trim();
    if (!uid) continue;
    let thread = grouped.get(uid);
    if (!thread) {
      thread = { uid, email: String(message.email || ""), messages: [] };
      grouped.set(uid, thread);
    }
    if (!thread.email && typeof message.email === "string") thread.email = message.email;
    thread.messages.push(message);
  }
  return Array.from(grouped.values()).map((thread) => {
    thread.messages.sort((left, right) => String(left.time || "").localeCompare(String(right.time || "")));
    const latest = thread.messages[thread.messages.length - 1];
    let unanswered = 0;
    for (let index = thread.messages.length - 1; index >= 0; index -= 1) {
      if (thread.messages[index].from === "admin") break;
      if (thread.messages[index].from === "user") unanswered += 1;
    }
    const adminUnreadCount = Math.max(0, ...thread.messages.map(message => Number(message.admin_unread_count || 0)).filter(Number.isFinite));
    return { ...thread, latestTime: String(latest?.time || ""), latestFrom: latest?.from, unanswered, adminUnreadCount };
  }).sort((left, right) => right.latestTime.localeCompare(left.latestTime));
}


export function AdminPage() {
  const { status: authStatus, getSupabaseAccessToken } = useAuth();
  const [token, setToken] = useState("");
  const [session, setSession] = useState<AdminSession | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [navSearch, setNavSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const payoutSubmitLockRef = useRef(false);
  const reviewActionLocksRef = useRef<Record<string, boolean>>({});
  const manualCreditLocksRef = useRef<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [userSearchBusy, setUserSearchBusy] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserRecord | null>(null);
  const [selectedUserAddresses, setSelectedUserAddresses] = useState<AdminPayoutAddress[]>([]);
  const [selectedUserSupport, setSelectedUserSupport] = useState<Array<Record<string, unknown>>>([]);
  const [profileRelatedLoading, setProfileRelatedLoading] = useState(false);
  const [creditAmount, setCreditAmount] = useState<Record<string, string>>({});
  const [creditReference, setCreditReference] = useState<Record<string, string>>({});
  const [creditNote, setCreditNote] = useState<Record<string, string>>({});
  const [creditRequestIds, setCreditRequestIds] = useState<Record<string, string>>({});
  const [creditPendingInvalid, setCreditPendingInvalid] = useState<Record<string, boolean>>({});
  // Balance adjustment (credit / debit / freeze / unfreeze) for the selected user.
  const [adjustCoin, setAdjustCoin] = useState("USDT");
  const [adjustMode, setAdjustMode] = useState<"credit" | "debit" | "freeze" | "unfreeze">("credit");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustBusy, setAdjustBusy] = useState(false);
  const [adjustRequestId, setAdjustRequestId] = useState("");
  const [adjustPendingInvalid, setAdjustPendingInvalid] = useState(false);
  // Account actions: freeze state, credential changes and a direct staff message.
  const [accountActionBusy, setAccountActionBusy] = useState(false);
  const [freezeReason, setFreezeReason] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [directMessage, setDirectMessage] = useState("");
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawalRecord[]>([]);
  const [reviewQueueLoading, setReviewQueueLoading] = useState(false);
  const [payoutReferences, setPayoutReferences] = useState<Record<string, string>>({});
  const [reviewDialog, setReviewDialog] = useState<ReviewDialogState | null>(null);
  const [reviewReason, setReviewReason] = useState("");
  const [manualIdentityConfirmed, setManualIdentityConfirmed] = useState(false);
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
  const userSearchRequestRef = useRef(0);
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
  const [payoutAddresses, setPayoutAddresses] = useState<AdminPayoutAddress[]>([]);
  const [editingPayoutAddress, setEditingPayoutAddress] = useState<AdminPayoutAddress | null>(null);
  const [pendingDeletePayoutAddress, setPendingDeletePayoutAddress] = useState<AdminPayoutAddress | null>(null);
  const [payoutAddressDraft, setPayoutAddressDraft] = useState({ account_holder:"", bank_name:"", account_number:"", iban:"", country:"", routing_number:"", swift:"", bank_address:"", note:"", reason:"" });

  // Help-centre editor state. Content lives in the backend state document, so the
  // console is the only place FAQs are created or changed.
  const [supportFaq, setSupportFaq] = useState<AdminSupportFaqEntry[]>([]);
  const [supportFaqBusy, setSupportFaqBusy] = useState(false);
  const [supportFaqEditingId, setSupportFaqEditingId] = useState("");
  const [supportFaqQuestion, setSupportFaqQuestion] = useState("");
  const [supportFaqAnswer, setSupportFaqAnswer] = useState("");
  const [supportFaqOrder, setSupportFaqOrder] = useState("0");
  const [supportFaqEnabled, setSupportFaqEnabled] = useState(true);
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
  const visibleTabs = useMemo(() => {
    const query = navSearch.trim().toLocaleLowerCase();
    return allowedTabs.filter(item => !query || item.id.toLocaleLowerCase().includes(query) || item.label.toLocaleLowerCase().includes(query) || adminText(item.label).toLocaleLowerCase().includes(query));
  }, [allowedTabs, navSearch]);
  useEffect(() => {
    if (allowedTabs.length && !allowedTabs.some((item) => item.id === tab)) setTab(allowedTabs[0].id);
  }, [allowedTabs, tab]);

  const loadTab = useCallback(async () => {
    const requestId = ++tabLoadRequestRef.current;
    if (tab !== "users") {
      userDetailRequestRef.current += 1;
      setProfileRelatedLoading(false);
    }
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
        const snapshot = await getAdminUsers(token, "");
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
      if (tab === "payout-addresses") {
        setPayoutAddresses([]);
        setEditingPayoutAddress(null);
        const snapshot = await getAdminAddresses(token);
        if (requestId !== tabLoadRequestRef.current) return;
        setPayoutAddresses(snapshot.addresses || []);
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
      if (tab === "support-faq") {
        setSupportFaq([]);
        const snapshot = await getAdminSupportFaq(token);
        if (requestId !== tabLoadRequestRef.current) return;
        setSupportFaq(snapshot.entries || []);
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
  }, [token, session, tab, adminSearch]);

  useEffect(() => {
    void loadTab();
    return () => { tabLoadRequestRef.current += 1; };
  }, [loadTab]);

  useEffect(() => {
    if (!session?.user_id || !selectedUser?.uid) return;
    const key = "btcbox.admin.balance-adjustment.v1." + session.user_id + "." + selectedUser.uid;
    setAdjustRequestId("");
    setAdjustPendingInvalid(false);
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && saved.version === 1 && saved.actor_id === session.user_id && saved.target_uid === selectedUser.uid &&
            typeof saved.request_id === "string" && /^[A-Za-z0-9_-]{16,100}$/.test(saved.request_id) &&
            typeof saved.coin === "string" && assets.includes(saved.coin) &&
            typeof saved.delta === "string" && /^-?(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(saved.delta) &&
            typeof saved.mode === "string" && ["adjust", "freeze", "unfreeze"].includes(saved.mode) &&
            typeof saved.reason === "string") {
          setAdjustCoin(saved.coin);
          setAdjustMode(saved.mode === "freeze" ? "freeze" : saved.mode === "unfreeze" ? "unfreeze" : saved.delta.startsWith("-") ? "debit" : "credit");
          setAdjustAmount(saved.delta.replace(/^-/, ""));
          setAdjustReason(saved.reason);
          setAdjustRequestId(saved.request_id);
        } else setAdjustPendingInvalid(true);
      }
    } catch { setAdjustPendingInvalid(true); }
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
    setSelectedUserAddresses([]);
    setSelectedUserSupport([]);
    const canReadAddresses = hasPermission("payout_addresses.read_sensitive");
    const canReadSupport = hasPermission("support.read");
    setProfileRelatedLoading(canReadAddresses || canReadSupport);
    try {
      const [result, addressResult, supportResult] = await Promise.all([
        getAdminUser(token, uid),
        canReadAddresses ? getAdminAddresses(token).catch(() => null) : Promise.resolve(null),
        canReadSupport ? getAdminSupportMessages(token).catch(() => null) : Promise.resolve(null),
      ]);
      if (requestId === userDetailRequestRef.current) {
        setSelectedUser(result.user);
        setSelectedUserAddresses((addressResult?.addresses || []).filter(item => item.uid === uid));
        setSelectedUserSupport(((supportResult?.messages || []) as unknown as Array<Record<string, unknown>>).filter(message => String(message.uid || message.user_id || "") === uid));
      }
    } catch (reason) {
      if (requestId === userDetailRequestRef.current) {
        setError(reason instanceof Error ? reason.message : "User account could not be loaded.");
      }
    } finally {
      if (requestId === userDetailRequestRef.current) {
        setBusy(false);
        setProfileRelatedLoading(false);
      }
    }
  };

  // Re-read the selected user after a confirmed write so the balances on screen
  // come from the server. A failed refresh must not mask the confirmed result.
  const refreshSelectedUser = async (uid: string) => {
    try { await selectUser(uid); } catch { /* Confirmed writes stay reported through the notice. */ }
  };

  const searchUsers = async (query: string) => {
    if (!token || userSearchBusy) return;
    const normalizedQuery = query.trim();
    const requestId = ++userSearchRequestRef.current;
    setUserSearchBusy(true);
    setError("");
    try {
      const snapshot = await getAdminUsers(token, normalizedQuery);
      if (requestId === userSearchRequestRef.current) setUsers(snapshot.users || []);
    } catch (reason) {
      if (requestId === userSearchRequestRef.current) {
        setError(reason instanceof Error ? reason.message : "User search could not be completed.");
      }
    } finally {
      if (requestId === userSearchRequestRef.current) setUserSearchBusy(false);
    }
  };

  const submitBalanceAdjustment = async () => {
    if (!token || !selectedUser || adjustBusy) return;
    const uid = selectedUser.uid;
    const amount = adjustAmount.trim();
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(amount) || /^0(?:\.0*)?$/.test(amount)) {
      setError("Enter an amount greater than 0.");
      return;
    }
    if (adjustPendingInvalid) {
      setError("A saved balance-adjustment request could not be read. Check the financial audit log before creating another operation.");
      return;
    }
    const mode = adjustMode === "freeze" ? "freeze" : adjustMode === "unfreeze" ? "unfreeze" : "adjust";
    const reason = adjustReason.trim();
    if (mode !== "adjust" && reason.length < 5) {
      setError("Enter a reason of at least 5 characters.");
      return;
    }
    const delta = adjustMode === "debit" ? "-" + amount : amount;
    const storageKey = "btcbox.admin.balance-adjustment.v1." + session?.user_id + "." + uid;
    const intent = { version: 1, actor_id: session?.user_id, target_uid: uid, coin: adjustCoin, delta, mode, reason };
    let requestId = adjustRequestId;
    if (requestId) {
      try {
        const saved = JSON.parse(window.localStorage.getItem(storageKey) || "null");
        if (!saved || saved.request_id !== requestId || saved.actor_id !== session?.user_id || saved.target_uid !== uid ||
            saved.coin !== adjustCoin || saved.delta !== delta || saved.mode !== mode || saved.reason !== reason) {
          setError("A balance-adjustment request is still pending. Retry the exact same operation; do not change its details.");
          return;
        }
      } catch {
        setAdjustPendingInvalid(true);
        setError("The saved balance-adjustment request could not be verified. Check the financial audit log before continuing.");
        return;
      }
    } else {
      try { requestId = window.crypto.randomUUID(); }
      catch { setError("Secure request IDs are unavailable in this browser. No balance change was made."); return; }
      try { window.localStorage.setItem(storageKey, JSON.stringify({ ...intent, request_id: requestId, created_at: Date.now() })); }
      catch { setError("This browser cannot safely save the balance-adjustment request. No balance change was sent."); return; }
      setAdjustRequestId(requestId);
    }
    setAdjustBusy(true); setError(""); setNotice("");
    try {
      const result = await adminAdjustBalance(token, { uid, coin: adjustCoin, delta, mode, ...(reason ? { reason } : {}), request_id: requestId });
      try { window.localStorage.removeItem(storageKey); } catch {}
      setAdjustRequestId(""); setAdjustPendingInvalid(false);
      setNotice(result.msg || "Balance adjusted.");
      setAdjustAmount(""); setAdjustReason("");
      await refreshSelectedUser(uid);
    } catch (cause) {
      setError((cause instanceof Error ? cause.message : "Balance adjustment could not be confirmed.") + " Retry the same operation to safely confirm the result; do not create a new adjustment.");
    } finally { setAdjustBusy(false); }
  };

  const submitFreezeToggle = async () => {
    if (!token || !selectedUser || accountActionBusy) return;
    const uid = selectedUser.uid;
    const nextFrozen = !selectedUser.frozen;
    const reason = freezeReason.trim();
    if (!reason) { setError("Enter a reason before changing the account state."); return; }
    setAccountActionBusy(true); setError(""); setNotice("");
    try {
      const result = await adminSetUserFrozen(token, { uid, frozen: nextFrozen, reason });
      setNotice(result.msg || (nextFrozen ? "Account frozen." : "Account unfrozen."));
      setFreezeReason("");
      await refreshSelectedUser(uid);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Account state could not be changed.");
    } finally { setAccountActionBusy(false); }
  };

  const submitPasswordReset = async () => {
    if (!token || !selectedUser || accountActionBusy) return;
    const uid = selectedUser.uid;
    if (newPassword.length < 12 || newPassword.length > 256) {
      setError("The new password must be 12-256 characters.");
      return;
    }
    setAccountActionBusy(true); setError(""); setNotice("");
    try {
      const result = await adminResetUserPassword(token, { uid, new_password: newPassword });
      setNotice(result.msg || "Password has been reset.");
      setNewPassword("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Password could not be reset.");
    } finally { setAccountActionBusy(false); }
  };

  const submitEmailReset = async () => {
    if (!token || !selectedUser || accountActionBusy) return;
    const uid = selectedUser.uid;
    const email = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      setError("Enter a valid email address.");
      return;
    }
    setAccountActionBusy(true); setError(""); setNotice("");
    try {
      const result = await adminResetUserEmail(token, { uid, new_email: email });
      setNotice(result.msg || "Email updated.");
      setNewEmail("");
      await refreshSelectedUser(uid);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Email could not be changed.");
    } finally { setAccountActionBusy(false); }
  };

  // Staff can open a conversation with any existing customer account, including
  // accounts that never wrote in, because the backend creates the thread.
  const sendDirectMessage = async () => {
    if (!token || !selectedUser || accountActionBusy) return;
    const uid = selectedUser.uid;
    const content = directMessage.trim();
    if (!content) { setError("Enter a message before sending."); return; }
    if (content.length > 2000) { setError("Keep the message under 2000 characters."); return; }
    let requestId = "";
    try { requestId = window.crypto.randomUUID(); }
    catch { setError("Secure request IDs are unavailable in this browser. No message was sent."); return; }
    setAccountActionBusy(true); setError(""); setNotice("");
    try {
      await adminReplySupport(token, uid, content, requestId);
      setNotice("Message sent to the customer.");
      setDirectMessage("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The message could not be sent.");
    } finally { setAccountActionBusy(false); }
  };

  const manualCredit = async (event: FormEvent<HTMLFormElement>, coin: string) => {
    event.preventDefault();
    if (!token || !selectedUser || manualCreditLocksRef.current[coin]) return;
    if (selectedUser.financial_balance_source !== "postgres_financial_ledger") {
      setError("Manual credit is disabled until the user's PostgreSQL ledger balance source is confirmed. No credit was sent.");
      return;
    }
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
      setError(reviewDialog.kind === "kyc-manual" ? "A manual verification method and review note are required." : "A rejection reason is required.");
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
      } else if (target.kind === "kyc-manual") {
        if (!manualIdentityConfirmed) {
          setError("Confirm that you personally verified the customer's identity before approval.");
          return;
        }
        await adminApproveKyc(token, target.uid, { admin_override: true, reason: reasonText });
        setReviewDialog(null);
        setReviewReason("");
        setManualIdentityConfirmed(false);
        await refreshKycQueueAfterReview("KYC approved after manual identity verification.");
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

  const beginPayoutAddressEdit = (item: AdminPayoutAddress) => {
    setEditingPayoutAddress(item);
    setPayoutAddressDraft({ account_holder:item.account_holder||"", bank_name:item.bank_name||"", account_number:item.account_number||"", iban:item.iban||"", country:item.country||"", routing_number:item.routing_number||"", swift:item.swift||"", bank_address:item.bank_address||"", note:item.note||"", reason:"" });
    setError(""); setNotice("");
  };

  const savePayoutAddress = async () => {
    if (!token || !editingPayoutAddress || !payoutAddressDraft.reason.trim() || busy) return;
    if (editingPayoutAddress.type === "bank" && !payoutAddressDraft.account_number.trim() && !payoutAddressDraft.iban.trim()) {
      setError("Enter an account number or IBAN."); return;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await manageAdminAddress(token, { id:editingPayoutAddress.id, action:"update", ...payoutAddressDraft });
      const snapshot = await getAdminAddresses(token);
      setPayoutAddresses(snapshot.addresses || []);
      if (selectedUser) setSelectedUserAddresses((snapshot.addresses || []).filter(item => item.uid === selectedUser.uid));
      setEditingPayoutAddress(null);
      setNotice(result.audit_sync_pending ? "Bank payout details saved; audit delivery is pending." : "Bank payout details saved.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Bank payout details were not saved."); }
    finally { setBusy(false); }
  };

  const deletePayoutAddress = async (item: AdminPayoutAddress) => {
    if (!token || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await manageAdminAddress(token, { id:item.id, action:"delete", reason:"Administrator removed saved payout details." });
      setPayoutAddresses(current => current.filter(entry => entry.id !== item.id));
      setSelectedUserAddresses(current => current.filter(entry => entry.id !== item.id));
      if (editingPayoutAddress?.id === item.id) setEditingPayoutAddress(null);
      setPendingDeletePayoutAddress(null);
      setNotice(result.audit_sync_pending ? "Bank payout details deleted; audit delivery is pending." : "Bank payout details deleted.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Bank payout details were not deleted."); }
    finally { setBusy(false); }
  };

  const markSupportThreadRead = async (uid: string) => {
    if (!token || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await markAdminSupportRead(token, uid);
      const snapshot = await getAdminSupportMessages(token);
      const messages = (snapshot.messages || []) as unknown as Array<Record<string, unknown>>;
      setSupport(messages);
      setSelectedUserSupport(messages.filter(message => String(message.uid || message.user_id || "") === uid));
      setNotice(result.audit_sync_pending ? "Conversation marked read; audit delivery is pending." : "Conversation marked as read.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Conversation read state could not be saved."); }
    finally { setBusy(false); }
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

  const refreshSupportFaq = async () => {
    if (!token) return;
    setError(""); setNotice("");
    try {
      const snapshot = await getAdminSupportFaq(token);
      setSupportFaq(snapshot.entries || []);
    } catch (reason) {
      setSupportFaq([]);
      setError(reason instanceof Error ? reason.message : "Help-centre entries could not be loaded.");
    }
  };

  const resetSupportFaqForm = () => {
    setSupportFaqEditingId("");
    setSupportFaqQuestion("");
    setSupportFaqAnswer("");
    setSupportFaqOrder("0");
    setSupportFaqEnabled(true);
  };

  const startEditSupportFaq = (entry: AdminSupportFaqEntry) => {
    setSupportFaqEditingId(entry.id);
    setSupportFaqQuestion(entry.question);
    setSupportFaqAnswer(entry.answer);
    setSupportFaqOrder(String(entry.order));
    setSupportFaqEnabled(entry.enabled);
    setError(""); setNotice("");
  };

  const saveSupportFaqEntry = async () => {
    if (!token || supportFaqBusy) return;
    const question = supportFaqQuestion.trim();
    const answer = supportFaqAnswer.trim();
    if (question.length < 4 || answer.length < 4) {
      setError("Enter a question and an answer of at least 4 characters each.");
      return;
    }
    const order = Number(supportFaqOrder || 0);
    if (!Number.isFinite(order) || order < 0 || order > 9999) {
      setError("Order must be a number between 0 and 9,999.");
      return;
    }
    setSupportFaqBusy(true); setError(""); setNotice("");
    try {
      await saveAdminSupportFaq(token, {
        ...(supportFaqEditingId ? { id: supportFaqEditingId } : {}),
        question, answer, order: Math.round(order), enabled: supportFaqEnabled,
      });
      resetSupportFaqForm();
      await refreshSupportFaq();
      setNotice("Help-centre entry saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The help-centre entry was not saved.");
    } finally {
      setSupportFaqBusy(false);
    }
  };

  const removeSupportFaqEntry = async (id: string) => {
    if (!token || supportFaqBusy) return;
    setSupportFaqBusy(true); setError(""); setNotice("");
    try {
      await deleteAdminSupportFaq(token, id);
      if (supportFaqEditingId === id) resetSupportFaqForm();
      await refreshSupportFaq();
      setNotice("Help-centre entry deleted.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The help-centre entry was not deleted.");
    } finally {
      setSupportFaqBusy(false);
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
      let readReceiptPending = false;
      try { await markAdminSupportRead(token, uid); }
      catch { readReceiptPending = true; }
      setSupportReply((current) => ({ ...current, [uid]: "" }));
      setSupportReplyRequestIds((current) => { const next = { ...current }; delete next[uid]; return next; });
      const successMessage = [
        result.audit_sync_pending ? "Support reply sent; audit delivery is pending." : "Support reply sent.",
        readReceiptPending ? " The reply was sent, but the read receipt could not be saved; refresh the conversation." : ""
      ].join("");
      const queueRequestId = ++supportQueueRequestRef.current;
      setSupport([]);
      try {
        const snapshot = await getAdminSupportMessages(token);
        if (queueRequestId !== supportQueueRequestRef.current) return;
        const messages = (snapshot.messages || []) as unknown as Array<Record<string, unknown>>;
        setSupport(messages);
        setSelectedUserSupport(messages.filter(message => String(message.uid || message.user_id || "") === uid));
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
  if (authStatus === "anonymous" || authStatus === "two-factor" || authStatus === "password-recovery") return <main className="min-h-screen bg-brand-bg px-4 py-8 sm:py-12">
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="border-b border-brand-border pb-5">
        <BrandLogo compact />
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-brand-accent">BTCBOX · 管理后台</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-brand-text sm:text-3xl">{adminText("Administrator sign in")}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-text-muted">{adminText("This is the private BTCBOX control center. Sign in with the Google or email identity that has been granted administrator access. Customer trading pages and balances are not part of this portal.")}</p>
      </header>
      <section aria-label={adminText("Administrator authentication")} className="w-full">
        <AuthPage mode="login" redirectTo="/admin" />
      </section>
      <p className="text-center text-xs text-brand-text-muted">{adminText("Access is verified against the BTCBOX administrator membership database after sign in.")}</p>
    </div>
  </main>;
  if (loading && !session) return <div className="mx-auto max-w-7xl p-6"><Card><CardContent className="p-8 text-sm text-brand-text-muted">{adminText("Verifying administrator identity…")}</CardContent></Card></div>;
  if (!session) return <div className="mx-auto max-w-3xl p-6"><Card><CardHeader><CardTitle>{adminText("BTCBOX Administrator")}</CardTitle><CardDescription>{adminText("Administrator access requires a verified Supabase Auth identity with an active BTCBOX administrator membership.")}</CardDescription></CardHeader><CardContent><p className="text-sm text-brand-danger">{adminText(error || "Administrator membership was not found.")}</p></CardContent></Card></div>;

  return <div className="tone-admin mx-auto w-full max-w-[1600px] space-y-5 p-3 sm:p-5 lg:p-7">
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-brand-border bg-brand-surface p-5 sm:items-center sm:p-6">
      <div><BrandLogo compact /><p className="type-meta mt-3 font-semibold uppercase tracking-[0.18em] text-brand-accent">{adminText("BTCBOX / CONTROL CENTER")}</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-brand-text sm:text-3xl">{adminText("Administrator Console")}</h1><p className="mt-1 text-sm text-brand-text-muted">{session.is_super_admin ? adminText("Super Administrator") : adminText("Role-based administrator")} · {session.user_id}</p></div>
      <Badge variant={session.is_super_admin ? "default" : "info"}>{session.is_super_admin ? adminText("SUPER ADMIN") : adminText("ACTIVE ADMIN")}</Badge>
    </div>
    {!session.is_super_admin ? <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-brand-border bg-brand-surface px-4 py-2.5"><span className="type-meta font-semibold uppercase tracking-wide text-brand-text-muted">当前权限</span>{session.permissions.length ? session.permissions.map(key => <Badge key={key} variant="outline" className="text-[11px]">{permissionLabel(key)}</Badge>) : <span className="text-xs text-brand-text-muted">无单独授权（超级管理员权限外）</span>}</div> : null}
    <div className="space-y-2">
      <input value={navSearch} onChange={event => setNavSearch(event.target.value)} placeholder={adminText("Search admin features")} aria-label={adminText("Search admin features")} className="h-10 w-full rounded-xl border border-brand-border bg-brand-surface px-3 text-sm text-brand-text outline-none focus:border-brand-accent/60 sm:max-w-xs"/>
      <div role="navigation" aria-label="管理功能" className="flex max-w-full gap-2 overflow-x-auto border-b border-brand-border pb-3">
        {visibleTabs.map(item => <Button key={item.id} className="shrink-0 whitespace-nowrap" size="sm" variant={tab === item.id ? "default" : "outline"} onClick={() => { setTab(item.id); setError(""); setNotice(""); }}>{adminText(item.label)}</Button>)}
        {visibleTabs.length === 0 ? <span className="px-2 py-2 text-sm text-brand-text-muted">{adminText("No matching admin features")}</span> : null}
      </div>
    </div>
    {error ? <div role="alert" className="rounded-xl border border-brand-danger/30 bg-brand-danger/10 p-3 text-sm text-brand-danger">{adminText(error)}</div> : null}
    {notice ? <div role="status" className="rounded-xl border border-brand-success/30 bg-brand-success/10 p-3 text-sm text-brand-success">{adminText(notice)}</div> : null}
    {loading ? <Card><CardContent className="p-6 text-sm text-brand-text-muted">{adminText("Loading")}{adminText(allowedTabs.find(item=>item.id===tab)?.label||tab)}…</CardContent></Card> : null}

    {!loading && tab === "overview" && stats ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ["Total users", stats.total_users], ["Pending withdrawals", stats.pending_withdrawals],
        ["Pending KYC", stats.pending_kyc], ["Review queue", stats.pending_admin_review_withdrawals],
      ].map(([label, value], index) => <Card key={adminText(String(label))} className="overflow-hidden border-brand-border bg-brand-surface"><div className={"h-1 "+(index===0?"bg-brand-info":index===1?"bg-brand-text-muted":index===2?"bg-brand-text-muted":"bg-brand-accent")}/><CardContent className="p-4 sm:p-5"><p className="type-meta font-semibold uppercase tracking-wide text-brand-text-muted">{adminText(String(label))}</p><p className="type-price mt-2 text-brand-text">{asText(value)}</p></CardContent></Card>)}
    </div> : null}

    {!loading && tab === "users" ? <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
      <Card><CardHeader><CardTitle>{adminText("Users")}</CardTitle><CardDescription>{adminText("Search a user, then select an asset row for staff manual credit.")}</CardDescription></CardHeader><CardContent>
        <form className="mb-3 flex gap-2" onSubmit={event => { event.preventDefault(); void searchUsers(searchInput); }}><input value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder={adminText("Search UID or email")} className="h-11 min-w-0 flex-1 rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-brand-text outline-none transition-colors focus:border-brand-accent/60 focus:ring-2 focus:ring-brand-accent/15"/><Button size="sm" type="submit" disabled={userSearchBusy}>{userSearchBusy ? adminText("Searching…") : adminText("Search")}</Button></form>
        <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr className="border-b border-brand-border bg-brand-surface-2/50 type-label uppercase tracking-wide text-brand-text-muted"><th className="px-3 py-2.5">UID</th><th className="px-3 py-2.5">{adminText("Email")}</th><th className="px-3 py-2.5">{adminText("KYC")}</th><th className="px-3 py-2.5">{adminText("Status")}</th><th className="px-3 py-2.5 text-right">{adminText("Action")}</th></tr></thead><tbody>{users.map(user=><tr key={user.uid} className="border-b border-brand-border-subtle transition-colors hover:bg-brand-surface-hover/40"><td className="px-3 py-2.5 font-mono text-xs">{user.uid}</td><td className="px-3 py-2.5">{user.email}</td><td className="px-3 py-2.5"><Badge variant={statusVariant(user.kyc_status || user.kyc?.status || "")}>{user.kyc_status || user.kyc?.status || "—"}</Badge></td><td className="px-3 py-2.5"><Badge variant={user.frozen?"destructive":"success"}>{user.frozen?adminText("Frozen"):adminText("Active")}</Badge></td><td className="px-3 py-2.5 text-right"><Button size="sm" variant="outline" onClick={()=>void selectUser(user.uid)}>{adminText("Open")}</Button></td></tr>)}{users.length===0 ? <tr><td colSpan={5} className="px-3 py-10 text-center text-sm text-brand-text-muted">暂无用户记录，调整搜索条件后重试。</td></tr> : null}</tbody></table></div>
      </CardContent></Card>
      <div className="space-y-4"><Card><CardHeader><CardTitle>{adminText("Manual credit")}</CardTitle><CardDescription>{adminText("UID and asset are bound by the selected user and asset row. No pending deposit order is created.")}</CardDescription></CardHeader><CardContent>
        {!selectedUser ? <p className="text-sm text-brand-text-muted">{adminText("Select a user to load their current balances.")}</p> : <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{selectedUser.email} · <span className="font-mono">{selectedUser.uid}</span></p>{hasPermission("deposits.read") ? <Badge variant="outline">{selectedUser.financial_balance_source === "postgres_financial_ledger" ? adminText("Balances: PostgreSQL ledger") : selectedUser.financial_balance_source === "legacy_state_retention_limited" ? adminText("Balances: legacy state · limited") : adminText("Balances: source unknown")}</Badge> : null}</div>
          {selectedUser.financial_balance_source !== "postgres_financial_ledger" ? <p role="status" className="mb-3 text-xs text-brand-warning">{adminText("Manual credit is disabled until the user's PostgreSQL ledger balance source is confirmed.")}</p> : null}
          {!hasPermission("deposits.read") ? <p className="text-sm text-brand-text-muted">{adminText("Balance details require the deposits.read permission.")}</p> : <div className="space-y-3">{assets.map(coin=><form key={coin} className="rounded-xl border border-brand-border p-3" onSubmit={event=>void manualCredit(event,coin)}>
            <div className="mb-2 flex items-center justify-between"><span className="font-semibold">{coin}</span><span className="text-xs text-brand-text-muted">{adminText("Available:")}{selectedUser.balances?.[coin]?.free == null ? "—" : asText(selectedUser.balances[coin].free)}</span></div>
            <input disabled={!!creditRequestIds[coin]||!!creditPendingInvalid[coin]||busy||selectedUser.financial_balance_source!=="postgres_financial_ledger"} value={creditAmount[coin]||""} onChange={event=>setCreditAmount(current=>({...current,[coin]:event.target.value}))} placeholder={adminText("Verified amount received")} className="mb-2 w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-brand-text" inputMode="decimal"/>
            <input disabled={!!creditRequestIds[coin]||!!creditPendingInvalid[coin]||busy} value={creditReference[coin]||""} onChange={event=>setCreditReference(current=>({...current,[coin]:event.target.value}))} placeholder={adminText("Required TxID / receipt reference")} required maxLength={160} className="mb-2 w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-brand-text"/>
            <input disabled={!!creditRequestIds[coin]||!!creditPendingInvalid[coin]||busy} value={creditNote[coin]||""} onChange={event=>setCreditNote(current=>({...current,[coin]:event.target.value}))} placeholder={adminText("Note (optional)")} className="mb-2 w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-brand-text"/>
            <Button type="submit" size="sm" disabled={busy || !!creditPendingInvalid[coin] || selectedUser.financial_balance_source!=="postgres_financial_ledger" || !hasPermission("deposits.review") || !hasPermission("deposits.read")}>{creditRequestIds[coin] ? adminText("Retry same credit request") : adminText("Confirm manual credit")}</Button>
          </form>)}</div>}
          {hasPermission("deposits.read") ? <section className="mt-6 space-y-3 border-t border-brand-border pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold">{adminText("Deposit history · latest 20")}</h3><p className="mt-1 text-xs text-brand-text-muted">{adminText("The account snapshot returns the 20 most recent deposits. Use the Audit log for the wider financial event trail.")}</p></div><Badge variant="outline">{selectedUser.deposit_history_source === "postgres_financial_ledger" ? adminText("Source: PostgreSQL ledger") : selectedUser.deposit_history_source === "legacy_state_retention_limited" ? adminText("Source: legacy state · limited") : adminText("Source: unavailable")}</Badge></div>
            {!selectedUser.deposit_history ? <p className="text-sm text-brand-text-muted">{adminText("Deposit history is not available in this response. Refresh the user record before reviewing a credit.")}</p> :
              selectedUser.deposit_history.length === 0 ? <p className="text-sm text-brand-text-muted">{adminText("No deposit records found.")}</p> :
              <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead><tr className="border-b border-brand-border bg-brand-surface-2/50 type-label uppercase tracking-wide text-brand-text-muted"><th className="px-3 py-2.5">{adminText("Asset / network")}</th><th className="px-3 py-2.5 text-right">{adminText("Amount")}</th><th className="px-3 py-2.5">{adminText("Status")}</th><th className="px-3 py-2.5">{adminText("Record ID")}</th><th className="px-3 py-2.5">{adminText("Reference")}</th><th className="px-3 py-2.5">{adminText("Time")}</th></tr></thead><tbody>{selectedUser.deposit_history.map((item,index)=><tr key={item.id || index} className="border-b border-brand-border-subtle transition-colors hover:bg-brand-surface-hover/40"><td className="px-3 py-2.5">{item.coin} · {item.network || "—"}</td><td className="px-3 py-2.5 text-right font-mono tabular-nums">{asText(item.amount)}</td><td className="px-3 py-2.5"><Badge variant={statusVariant(item.status)}>{adminText(item.status)}</Badge></td><td className="max-w-[180px] truncate px-3 py-2.5 font-mono" title={item.id || ""}>{item.id || "—"}</td><td className="max-w-[220px] truncate px-3 py-2.5 font-mono" title={item.reference || item.txid || ""}>{item.reference || item.txid || "—"}</td><td className="whitespace-nowrap px-3 py-2.5">{formatDate(item.time)}</td></tr>)}</tbody></table></div>}
          </section> : null}
        </>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>{adminText("Balance adjustment")}</CardTitle><CardDescription>{adminText("Add, deduct, freeze or unfreeze the selected user's available balance. Every operation is audited and idempotent.")}</CardDescription></CardHeader><CardContent className="space-y-3">
        {!selectedUser ? <p className="text-sm text-brand-text-muted">{adminText("Select a user first.")}</p> : <>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1 text-sm"><span className="text-brand-text-muted">{adminText("Asset")}</span><select value={adjustCoin} onChange={event => setAdjustCoin(event.target.value)} disabled={adjustBusy || !!adjustRequestId || adjustPendingInvalid} className="h-11 w-full rounded-xl border border-brand-border bg-brand-surface-2 px-3 text-sm text-brand-text">{assets.map(coin => <option key={coin}>{coin}</option>)}</select></label>
            <label className="space-y-1 text-sm"><span className="text-brand-text-muted">{adminText("Operation")}</span><select value={adjustMode} onChange={event => setAdjustMode(event.target.value as "credit" | "debit" | "freeze" | "unfreeze")} disabled={adjustBusy || !!adjustRequestId || adjustPendingInvalid} className="h-11 w-full rounded-xl border border-brand-border bg-brand-surface-2 px-3 text-sm text-brand-text"><option value="credit">{adminText("Add balance")}</option><option value="debit">{adminText("Deduct balance")}</option><option value="freeze">{adminText("Freeze funds")}</option><option value="unfreeze">{adminText("Unfreeze funds")}</option></select></label>
          </div>
          <p className="text-xs text-brand-text-muted">{adminText("Available")}: {selectedUser.balances?.[adjustCoin]?.free == null ? "—" : asText(selectedUser.balances[adjustCoin].free)} · {adminText("Frozen")}: {selectedUser.balances?.[adjustCoin]?.frozen == null ? "—" : asText(selectedUser.balances[adjustCoin].frozen)}</p>
          <input value={adjustAmount} onChange={event => setAdjustAmount(event.target.value)} disabled={adjustBusy || !!adjustRequestId || adjustPendingInvalid} inputMode="decimal" placeholder={adminText("Amount")} className="h-11 w-full rounded-xl border border-brand-border bg-brand-surface-2 px-3 text-sm text-brand-text"/>
          {(adjustMode === "freeze" || adjustMode === "unfreeze") ? <input value={adjustReason} onChange={event => setAdjustReason(event.target.value)} disabled={adjustBusy || !!adjustRequestId || adjustPendingInvalid} maxLength={200} placeholder={adminText("Reason (required, at least 5 characters)")} className="h-11 w-full rounded-xl border border-brand-border bg-brand-surface-2 px-3 text-sm text-brand-text"/> : null}
          <Button size="sm" disabled={adjustBusy || adjustPendingInvalid || !hasPermission("financial_adjustment.request") || !adjustAmount.trim() || ((adjustMode === "freeze" || adjustMode === "unfreeze") && adjustReason.trim().length < 5)} onClick={() => void submitBalanceAdjustment()}>{adjustBusy ? adminText("Processing…") : adjustRequestId ? adminText("Retry same adjustment") : adminText("Confirm adjustment")}</Button>{adjustPendingInvalid ? <p role="alert" className="text-xs text-brand-danger">{adminText("Saved adjustment request is unreadable. Check the financial audit log before continuing.")}</p> : adjustRequestId ? <p className="text-xs text-brand-warning">{adminText("A previous adjustment is awaiting confirmation. Retry the same operation; its request ID is preserved to prevent duplicate credit or debit.")}</p> : null}
          {!hasPermission("financial_adjustment.request") ? <p className="text-xs text-brand-warning">{adminText("Requires the financial_adjustment.request permission.")}</p> : null}
        </>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>{adminText("Account actions")}</CardTitle><CardDescription>{adminText("Freeze the account, reset the login password or email, and send a staff message to the customer.")}</CardDescription></CardHeader><CardContent className="space-y-4">
        {!selectedUser ? <p className="text-sm text-brand-text-muted">{adminText("Select a user first.")}</p> : <>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold">{adminText("Account state")}</span><Badge variant={selectedUser.frozen ? "destructive" : "success"}>{selectedUser.frozen ? adminText("Frozen") : adminText("Active")}</Badge></div>
            <input value={freezeReason} onChange={event => setFreezeReason(event.target.value)} disabled={accountActionBusy} maxLength={200} placeholder={adminText("Reason for the account state change")} className="h-11 w-full rounded-xl border border-brand-border bg-brand-surface-2 px-3 text-sm text-brand-text"/>
            <Button size="sm" variant={selectedUser.frozen ? "outline" : "destructive"} disabled={accountActionBusy || !hasPermission("users.freeze") || !freezeReason.trim()} onClick={() => void submitFreezeToggle()}>{selectedUser.frozen ? adminText("Unfreeze account") : adminText("Freeze account")}</Button>
            {!hasPermission("users.freeze") ? <p className="text-xs text-brand-warning">{adminText("Requires the users.freeze permission.")}</p> : null}
          </div>
          <div className="space-y-2 border-t border-brand-border pt-3">
            <p className="text-sm font-semibold">{adminText("Reset login password")}</p>
            <input value={newPassword} onChange={event => setNewPassword(event.target.value)} disabled={accountActionBusy} type="password" autoComplete="new-password" placeholder={adminText("New password (12-256 characters)")} className="h-11 w-full rounded-xl border border-brand-border bg-brand-surface-2 px-3 text-sm text-brand-text"/>
            <Button size="sm" disabled={accountActionBusy || !hasPermission("users.manage") || newPassword.length < 12} onClick={() => void submitPasswordReset()}>{adminText("Reset password")}</Button>
            {!hasPermission("users.manage") ? <p className="text-xs text-brand-warning">{adminText("Requires the users.manage permission.")}</p> : null}
          </div>
          <div className="space-y-2 border-t border-brand-border pt-3">
            <p className="text-sm font-semibold">{adminText("Change email")}</p>
            <input value={newEmail} onChange={event => setNewEmail(event.target.value)} disabled={accountActionBusy} type="email" placeholder={adminText("New email address")} className="h-11 w-full rounded-xl border border-brand-border bg-brand-surface-2 px-3 text-sm text-brand-text"/>
            <Button size="sm" disabled={accountActionBusy || !hasPermission("users.manage") || !newEmail.trim()} onClick={() => void submitEmailReset()}>{adminText("Change email")}</Button>
          </div>
          <div className="space-y-2 border-t border-brand-border pt-3">
            <p className="text-sm font-semibold">{adminText("Contact customer")}</p>
            <p className="text-xs text-brand-text-muted">{adminText("Sends a staff message into the customer's support thread. A new thread is created when the customer has never written in.")}</p>
            <textarea value={directMessage} onChange={event => setDirectMessage(event.target.value)} disabled={accountActionBusy} rows={3} maxLength={2000} placeholder={adminText("Message to the customer")} className="w-full rounded-xl border border-brand-border bg-brand-surface-2 p-3 text-sm text-brand-text"/>
            <Button size="sm" disabled={accountActionBusy || !hasPermission("support.reply") || !directMessage.trim()} onClick={() => void sendDirectMessage()}>{adminText("Send message")}</Button>
            {!hasPermission("support.reply") ? <p className="text-xs text-brand-warning">{adminText("Requires the support.reply permission.")}</p> : null}
          </div>
        </>}
      </CardContent></Card>
      {selectedUser ? <>
      {hasPermission("payout_addresses.read_sensitive") ? <Card><CardHeader><CardTitle>{adminText("This user's saved addresses and bank cards")}</CardTitle><CardDescription>{adminText("Only records linked to the selected UID are shown here. Sensitive details remain permission-protected.")}</CardDescription></CardHeader><CardContent className="space-y-3">
        {profileRelatedLoading ? <p className="text-sm text-brand-text-muted">{adminText("Loading linked records…")}</p> : null}
        {selectedUserAddresses.map(item => <div key={item.id} className="rounded-xl border border-brand-border p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{item.type === "bank" ? adminText("Bank card") : adminText("Crypto address")}</Badge><span className="text-xs text-brand-text-muted">{formatDate(item.created_at)}</span></div>{item.type === "bank" ? <><p className="mt-2 text-sm font-semibold">{item.bank_name} · {item.account_holder}</p><p className="mt-1 break-all font-mono text-xs">{item.iban ? "IBAN " + item.iban : "Account " + (item.account_number || "—")}</p><p className="mt-1 break-words text-xs text-brand-text-muted">{[item.country,item.routing_number ? "Routing " + item.routing_number : "",item.swift ? "SWIFT " + item.swift : "",item.bank_address].filter(Boolean).join(" · ")}</p></> : <><p className="mt-2 text-sm font-semibold">{item.coin} · {item.network}</p><p className="mt-1 break-all font-mono text-xs">{item.address}</p></>}</div><div className="flex shrink-0 gap-2"><Button size="sm" variant="outline" disabled={busy || item.type !== "bank" || !hasPermission("payout_addresses.manage")} onClick={() => beginPayoutAddressEdit(item)}>{adminText("Edit")}</Button><Button size="sm" variant="destructive" disabled={busy || !hasPermission("payout_addresses.manage")} onClick={() => setPendingDeletePayoutAddress(item)}>{adminText("Delete")}</Button></div></div></div>)}
        {!profileRelatedLoading && selectedUserAddresses.length === 0 ? <p className="rounded-lg border border-dashed border-brand-border p-5 text-center text-sm text-brand-text-muted">{adminText("No saved addresses or bank cards for this user.")}</p> : null}
        {editingPayoutAddress?.uid === selectedUser.uid ? <div className="space-y-3 rounded-xl border border-brand-accent/30 bg-brand-surface-2 p-3"><p className="text-sm font-semibold">{adminText("Edit bank payout details")}</p><div className="grid gap-3 sm:grid-cols-2">{([["account_holder","Account holder"],["bank_name","Bank name"],["account_number","Local account number"],["iban","IBAN"],["country","Country code"],["routing_number","Routing number"],["swift","SWIFT / BIC"],["bank_address","Bank address"],["note","Note"]] as const).map(([key,label])=><label key={key} className="space-y-1 text-sm"><span>{adminText(label)}</span><input value={payoutAddressDraft[key]} disabled={busy||!hasPermission("payout_addresses.manage")} onChange={event=>setPayoutAddressDraft(current=>({...current,[key]:event.target.value}))} className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text"/></label>)}</div><label className="block space-y-1 text-sm"><span>{adminText("Reason for change (required)")}</span><textarea value={payoutAddressDraft.reason} onChange={event=>setPayoutAddressDraft(current=>({...current,reason:event.target.value}))} rows={2} maxLength={200} className="w-full rounded-lg border border-brand-border bg-brand-surface p-3 text-sm text-brand-text"/></label><div className="flex gap-2"><Button size="sm" disabled={busy||!hasPermission("payout_addresses.manage")||!payoutAddressDraft.reason.trim()} onClick={()=>void savePayoutAddress()}>{adminText("Save changes")}</Button><Button size="sm" variant="outline" disabled={busy} onClick={()=>setEditingPayoutAddress(null)}>{adminText("Cancel")}</Button></div></div> : null}
      </CardContent></Card> : null}
      {hasPermission("support.read") ? <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><div><CardTitle>{adminText("This user's customer service conversation")}</CardTitle><CardDescription>{adminText("Messages below are linked to this UID only. Reply here to keep the conversation attached to the same customer.")}</CardDescription></div>{(() => { const thread = groupSupportThreads(selectedUserSupport)[0]; return thread?.adminUnreadCount ? <Button size="sm" variant="outline" disabled={busy} onClick={() => void markSupportThreadRead(selectedUser!.uid)}>{adminText("Mark read")}</Button> : null; })()}</div></CardHeader><CardContent className="space-y-3">
        {profileRelatedLoading ? <p className="text-sm text-brand-text-muted">{adminText("Loading linked records…")}</p> : null}
        {selectedUserSupport.map((message,index) => <div key={asText(message.id) || index} className={message.from === "admin" ? "ml-5 rounded-lg bg-brand-accent/10 p-3" : "mr-5 rounded-lg bg-brand-surface-2 p-3"}><div className="flex items-center justify-between gap-2"><Badge variant={message.from === "admin" ? "outline" : "secondary"}>{message.from === "admin" ? adminText("Administrator") : adminText("Customer")}</Badge><span className="text-[11px] text-brand-text-muted">{formatDate(message.time)}</span></div><p className="mt-2 whitespace-pre-wrap break-words text-sm">{asText(message.content)}</p></div>)}
        {!profileRelatedLoading && selectedUserSupport.length === 0 ? <p className="rounded-lg border border-dashed border-brand-border p-5 text-center text-sm text-brand-text-muted">{adminText("No customer service messages for this user yet.")}</p> : null}
        <textarea value={supportReply[selectedUser.uid] || ""} onChange={event => { const uid = selectedUser.uid; setSupportReply(current => ({...current,[uid]:event.target.value})); try { setSupportReplyRequestIds(current => ({...current,[uid]:window.crypto.randomUUID()})); } catch { setError("Secure support reply request IDs are unavailable in this browser. No reply was sent."); } }} rows={3} maxLength={2000} disabled={!hasPermission("support.reply")} className="w-full rounded-lg border border-brand-border bg-brand-surface-2 p-3 text-sm text-brand-text" placeholder={adminText("Reply to this customer")}/>
        <Button size="sm" disabled={busy || !hasPermission("support.reply") || !supportReply[selectedUser.uid]?.trim()} onClick={() => void replySupport(selectedUser.uid)}>{adminText("Send reply")}</Button>
        {!hasPermission("support.reply") ? <p className="text-xs text-brand-warning">{adminText("Requires the support.reply permission.")}</p> : null}
      </CardContent></Card> : null}
      </> : null}
      </div>
    </div> : null}

    {!loading && tab === "deposits" ? <Card><CardHeader><CardTitle>{adminText("Finance configuration")}</CardTitle><CardDescription>{adminText("Configure customer deposit addresses and server-enforced withdrawal fees. Staff verify incoming transfers and manually credit the selected user's asset row.")}</CardDescription></CardHeader><CardContent><form onSubmit={saveAddresses} className="space-y-5">
      <section className="space-y-3"><h3 className="text-sm font-semibold text-brand-text">{adminText("Deposit addresses")}</h3><div className="grid gap-3 md:grid-cols-2">{depositAddressKeys.map(key=><label key={key} className="block space-y-1"><span className="text-xs font-semibold text-brand-text-muted">{key.replace("_"," · ")}</span><input value={config.deposit_addresses[key]||""} onChange={event=>setConfig(current=>({...current,deposit_addresses:{...current.deposit_addresses,[key]:event.target.value}}))} className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-brand-text" placeholder={adminText("Configured wallet address")}/></label>)}</div></section>
      <section className="space-y-3"><div><h3 className="text-sm font-semibold text-brand-text">{adminText("Withdrawal fees")}</h3><p className="text-xs text-brand-text-muted">{adminText("These values are applied by the server when a withdrawal is submitted. Enter zero to disable a fee for an asset.")}</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{assets.map(coin=><label key={coin} className="block space-y-1"><span className="text-xs font-semibold text-brand-text-muted">{coin} {adminText("fee")}</span><input inputMode="decimal" value={config.withdrawal_fees?.[coin] ?? ""} onChange={event=>setConfig(current=>({...current,withdrawal_fees:{...current.withdrawal_fees,[coin]:event.target.value}}))} className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-brand-text" placeholder="0"/></label>)}</div></section>
      <label className="block space-y-1"><span className="text-xs font-semibold text-brand-text-muted">{adminText("Customer announcement")}</span><textarea value={config.announcement||""} onChange={event=>setConfig(current=>({...current,announcement:event.target.value}))} rows={3} className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-brand-text"/></label>
      <Button type="submit" disabled={busy || !hasPermission("system_config.write")}>{adminText("Save configuration")}</Button>
    </form></CardContent></Card> : null}

    {!loading && tab === "withdrawals" ? <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{adminText("Withdrawal queue")}</CardTitle><CardDescription>{adminText("Approve or reject requests. After staff actually transfer funds, mark paid with the TxID/reference.")}</CardDescription></div><Button size="sm" variant="outline" disabled={reviewQueueLoading || busy} onClick={()=>void refreshWithdrawalQueueManually()}>{reviewQueueLoading ? adminText("Refreshing…") : adminText("Refresh queue")}</Button></div></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead><tr className="border-b border-brand-border bg-brand-surface-2/50 type-label uppercase tracking-wide text-brand-text-muted"><th className="px-3 py-2.5">{adminText("ID")}</th><th className="px-3 py-2.5">{adminText("User")}</th><th className="px-3 py-2.5 text-right">{adminText("Asset / amount")}</th><th className="px-3 py-2.5">{adminText("Network / destination")}</th><th className="px-3 py-2.5">{adminText("Status")}</th><th className="px-3 py-2.5">{adminText("Action")}</th></tr></thead><tbody>{withdrawals.map(item=><tr key={item.id} className="border-b border-brand-border-subtle align-top transition-colors hover:bg-brand-surface-hover/40"><td className="px-3 py-2.5 font-mono text-xs">{item.id}</td><td className="px-3 py-2.5">{item.uid}</td><td className="px-3 py-2.5 text-right tabular-nums"><span className="mr-1 text-xs text-brand-text-muted">{item.coin}</span>{item.amount}<div className="text-xs text-brand-text-muted">{adminText("Fee")} {item.fee}</div></td><td className="max-w-[260px] break-all px-3 py-2.5">{item.network}<div className="text-xs text-brand-text-muted">{item.address}</div></td><td className="px-3 py-2.5"><Badge variant={statusVariant(item.status)}>{adminText(item.status)}</Badge></td><td className="min-w-[220px] space-y-2 px-3 py-2.5">{item.status==="pending"||item.status==="pending_admin_review"?<><Button size="sm" disabled={busy||reviewQueueLoading||!hasPermission("withdrawals.review")} onClick={()=>void approveWithdrawal(item.id)}>{adminText("Approve")}</Button><Button size="sm" variant="destructive" disabled={busy||reviewQueueLoading||!hasPermission("withdrawals.review")} onClick={()=>void rejectWithdrawal(item.id)}>{adminText("Reject")}</Button></>:item.status==="approved"?<><input disabled={reviewQueueLoading} value={payoutReferences[item.id]||""} onChange={event=>setPayoutReferences(current=>({...current,[item.id]:event.target.value}))} placeholder={adminText("Required TxID / reference")} maxLength={160} className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-2 py-2 text-xs text-brand-text"/><Button size="sm" disabled={busy||reviewQueueLoading||!payoutReferences[item.id]?.trim()||!hasPermission("withdrawals.review")} onClick={()=>void markPaid(item.id)}>{adminText("Mark paid")}</Button></>:<span className="text-xs text-brand-text-muted">{item.payout_reference||"—"}</span>}</td></tr>)}{withdrawals.length===0 ? <tr><td colSpan={6} className="px-3 py-10 text-center text-sm text-brand-text-muted">暂无待处理提现申请。</td></tr> : null}</tbody></table></div></CardContent></Card> : null}

    {!loading && tab === "kyc" ? <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>{adminText("KYC review")}</CardTitle><Button size="sm" variant="outline" disabled={reviewQueueLoading || busy} onClick={()=>void refreshKycQueue()}>{reviewQueueLoading ? adminText("Refreshing…") : adminText("Refresh queue")}</Button></div></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead><tr className="border-b border-brand-border bg-brand-surface-2/50 type-label uppercase tracking-wide text-brand-text-muted"><th className="px-3 py-2.5">{adminText("User")}</th><th className="px-3 py-2.5">{adminText("Name")}</th><th className="px-3 py-2.5">{adminText("Document")}</th><th className="px-3 py-2.5">{adminText("Status")}</th><th className="px-3 py-2.5">{adminText("Submitted")}</th><th className="px-3 py-2.5">{adminText("Action")}</th></tr></thead><tbody>{kyc.map(item=><tr key={item.uid} className="border-b border-brand-border-subtle transition-colors hover:bg-brand-surface-hover/40"><td className="px-3 py-2.5">{item.uid}<div className="text-xs text-brand-text-muted">{item.email}</div></td><td className="px-3 py-2.5">{item.name}</td><td className="px-3 py-2.5">{item.id_type}<div className="mt-1 text-xs">{item.document_url&&!item.document_preview_error?<a href={item.document_url} target="_blank" rel="noreferrer" className="text-brand-accent underline underline-offset-2">{adminText("Open secure image")}</a>:<span className="text-brand-text-muted">{item.document_preview_error||"Document image missing"}</span>}</div></td><td className="px-3 py-2.5"><Badge variant={statusVariant(item.status)}>{adminText(item.status)}</Badge></td><td className="whitespace-nowrap px-3 py-2.5">{formatDate(item.submitted_at)}</td><td className="space-x-2 px-3 py-2.5"><Button size="sm" disabled={busy||!hasPermission("kyc.review")||!item.document_uploaded||!item.document_url||!!item.document_preview_error} onClick={()=>void reviewKyc(item.uid,true)}>{adminText("Approve")}</Button><Button size="sm" variant="outline" disabled={busy||!hasPermission("kyc.review")} onClick={()=>{setReviewDialog({kind:"kyc-manual",uid:item.uid});setReviewReason("");setManualIdentityConfirmed(false);setError("");setNotice("");}}>{adminText("Manual identity verification")}</Button><Button size="sm" variant="destructive" disabled={busy||!hasPermission("kyc.review")} onClick={()=>void reviewKyc(item.uid,false)}>{adminText("Reject")}</Button>{!item.document_uploaded||!item.document_url||item.document_preview_error?<p className="mt-1 text-xs text-brand-text-muted">{!item.document_uploaded?adminText("Identity document upload is required before approval."):adminText("Document preview unavailable; refresh the queue before approval.")}</p>:null}</td></tr>)}{kyc.length===0 ? <tr><td colSpan={6} className="px-3 py-10 text-center text-sm text-brand-text-muted">暂无待审核 KYC 申请。</td></tr> : null}</tbody></table></div></CardContent></Card> : null}

    {!loading && tab === "audit" ? <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-2"><div><CardTitle>{adminText("Financial audit log")}</CardTitle><CardDescription>{auditCompleteness === "postgres_canonical" ? adminText("Canonical append-only PostgreSQL history. Financial operations and account history use the same database source.") : auditCompleteness === "state_document_retention_limited" ? adminText("Retention-limited state-file history. Do not treat this list as a complete financial audit record.") : adminText("Audit source is not confirmed. Do not treat this list as complete until the source is verified.")} {adminText("Operator ID is the recorded actor identifier, not a display name.")}</CardDescription></div><Badge variant={auditCompleteness === "postgres_canonical" ? "default" : "destructive"}>{auditSource === "postgres_financial_audit_log" ? adminText("PostgreSQL canonical") : auditSource === "btcbox_state" ? adminText("State file · limited") : adminText("Source unknown")}</Badge></div></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm"><thead><tr className="border-b border-brand-border bg-brand-surface-2/50 type-label uppercase tracking-wide text-brand-text-muted"><th className="px-3 py-2.5">{adminText("Event ID")}</th><th className="px-3 py-2.5">{adminText("Time")}</th><th className="px-3 py-2.5">{adminText("Operator ID")}</th><th className="px-3 py-2.5">{adminText("Action")}</th><th className="px-3 py-2.5">{adminText("Affected user UID")}</th><th className="px-3 py-2.5">{adminText("Sync")}</th><th className="px-3 py-2.5">{adminText("Detail")}</th></tr></thead><tbody>{audit.length ? audit.map((item,index)=><tr key={item.id||index} className="border-b border-brand-border-subtle transition-colors hover:bg-brand-surface-hover/40"><td className="px-3 py-2.5 font-mono text-xs">{item.id}</td><td className="whitespace-nowrap px-3 py-2.5">{formatDate(item.time)}</td><td className="px-3 py-2.5 font-mono text-xs">{item.by}</td><td className="px-3 py-2.5">{item.action}</td><td className="px-3 py-2.5">{item.uid}</td><td className="px-3 py-2.5"><Badge variant={item.postgres_sync_status === "synced" || item.postgres_sync_status === "completed" ? "success" : "outline"}>{asText(item.postgres_sync_status)}</Badge></td><td className="max-w-[280px] break-all px-3 py-2.5 text-xs">{item.detail}</td></tr>) : <tr><td colSpan={7} className="px-3 py-10 text-center text-sm text-brand-text-muted">{adminText("No audit records are available in this snapshot.")}</td></tr>}</tbody></table></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-brand-text-muted">{adminText("Showing")}{audit.length} {adminText("records from this source snapshot.")}</p>{auditNextBefore ? <Button type="button" variant="outline" disabled={auditPageLoading} onClick={()=>void loadOlderAuditRecords()}>{auditPageLoading ? adminText("Loading older records...") : adminText("Load older records")}</Button> : <span className="text-xs text-brand-text-muted">{auditSource === "postgres_financial_audit_log" ? adminText("No older records in this snapshot.") : adminText("Legacy snapshot pagination is unavailable; this source is retention-limited.")}</span>}</div></CardContent></Card> : null}

    {!loading && tab === "orders" ? <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-2"><div><CardTitle>{adminText("Orders")}</CardTitle><CardDescription>{ordersSource === "postgres_financial_matching" ? adminText("Customer order history and this administrator view use the canonical PostgreSQL matching orders.") : ordersSource === "legacy_state" ? adminText("Legacy state fallback is active because matching-engine mode was not requested.") : adminText("Order data source is not confirmed.")}</CardDescription></div><Badge variant={ordersSource === "postgres_financial_matching" ? "default" : "destructive"}>{ordersSource === "postgres_financial_matching" ? adminText("Source: PostgreSQL matching") : ordersSource === "legacy_state" ? adminText("Source: legacy state") : adminText("Source: unknown")}</Badge></div></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead><tr className="border-b border-brand-border bg-brand-surface-2/50 type-label uppercase tracking-wide text-brand-text-muted"><th className="px-3 py-2.5">{adminText("ID")}</th><th className="px-3 py-2.5">{adminText("User")}</th><th className="px-3 py-2.5">{adminText("Symbol")}</th><th className="px-3 py-2.5">{adminText("Side")}</th><th className="px-3 py-2.5">{adminText("Status")}</th><th className="px-3 py-2.5">{adminText("Created")}</th></tr></thead><tbody>{orders.map((item,index)=><tr key={asText(item.id)||index} className="border-b border-brand-border-subtle transition-colors hover:bg-brand-surface-hover/40"><td className="px-3 py-2.5 font-mono text-xs">{asText(item.id)}</td><td className="px-3 py-2.5">{asText(item.uid||item.user_id)}</td><td className="px-3 py-2.5 font-medium">{asText(item.symbol)}</td><td className="px-3 py-2.5">{adminText(asText(item.side))}</td><td className="px-3 py-2.5"><Badge variant={statusVariant(asText(item.status))}>{adminText(asText(item.status))}</Badge></td><td className="whitespace-nowrap px-3 py-2.5">{formatDate(item.created_at||item.time)}</td></tr>)}{orders.length===0 ? <tr><td colSpan={6} className="px-3 py-10 text-center text-sm text-brand-text-muted">暂无订单记录。</td></tr> : null}</tbody></table></div></CardContent></Card> : null}

    {!loading && tab === "payout-addresses" ? <div className="space-y-4">
      <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><div><CardTitle>{adminText("Customer bank payout details")}</CardTitle><CardDescription>{adminText("Sensitive bank details are visible only to administrators with the required permission. All changes are audited.")}</CardDescription></div><Button size="sm" variant="outline" disabled={busy} onClick={()=>{setPayoutAddresses([]);void getAdminAddresses(token).then(result=>setPayoutAddresses(result.addresses||[])).catch(reason=>setError(reason instanceof Error?reason.message:"Payout details could not be refreshed."));}}>{adminText("Refresh")}</Button></div></CardHeader><CardContent className="space-y-3">
      {payoutAddresses.filter(item=>item.type==="bank").map(item=><div key={item.id} className="rounded-xl border border-brand-border p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold">{item.bank_name} · {item.account_holder}</p><p className="mt-1 text-xs text-brand-text-muted">{item.email||item.uid} · {item.uid}</p><p className="mt-2 break-all font-mono text-xs">{item.iban ? "IBAN "+item.iban : "Account "+(item.account_number||"—")}</p><p className="mt-1 text-xs text-brand-text-muted">{[item.country,item.routing_number?"Routing "+item.routing_number:"",item.swift?"SWIFT "+item.swift:"",item.bank_address].filter(Boolean).join(" · ")}</p><p className="mt-1 text-xs text-brand-text-muted">{formatDate(item.created_at)}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" disabled={busy||!hasPermission("payout_addresses.manage")} onClick={()=>beginPayoutAddressEdit(item)}>{adminText("Edit")}</Button><Button size="sm" variant="destructive" disabled={busy||!hasPermission("payout_addresses.manage")} onClick={()=>setPendingDeletePayoutAddress(item)}>{adminText("Delete")}</Button></div></div></div>)}
      {payoutAddresses.filter(item=>item.type==="bank").length===0?<p className="rounded-lg border border-dashed border-brand-border p-6 text-center text-sm text-brand-text-muted">{adminText("No saved bank payout details.")}</p>:null}
      </CardContent></Card>
      {editingPayoutAddress ? <Card><CardHeader><CardTitle>{adminText("Edit bank payout details")}</CardTitle></CardHeader><CardContent className="space-y-3"><div className="grid gap-3 sm:grid-cols-2">{([["account_holder","Account holder"],["bank_name","Bank name"],["account_number","Local account number"],["iban","IBAN"],["country","Country code"],["routing_number","Routing number"],["swift","SWIFT / BIC"],["bank_address","Bank address"],["note","Note"]] as const).map(([key,label])=><label key={key} className="space-y-1 text-sm"><span>{adminText(label)}</span><input value={payoutAddressDraft[key]} disabled={busy||!hasPermission("payout_addresses.manage")} onChange={event=>setPayoutAddressDraft(current=>({...current,[key]:event.target.value}))} className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-brand-text"/></label>)}</div><label className="block space-y-1 text-sm"><span>{adminText("Reason for change (required)")}</span><textarea value={payoutAddressDraft.reason} onChange={event=>setPayoutAddressDraft(current=>({...current,reason:event.target.value}))} rows={2} maxLength={200} className="w-full rounded-lg border border-brand-border bg-brand-surface-2 p-3 text-sm text-brand-text"/></label><div className="flex gap-2"><Button disabled={busy||!hasPermission("payout_addresses.manage")||!payoutAddressDraft.reason.trim()} onClick={()=>void savePayoutAddress()}>{adminText("Save changes")}</Button><Button variant="outline" disabled={busy} onClick={()=>setEditingPayoutAddress(null)}>{adminText("Cancel")}</Button></div></CardContent></Card>:null}
    </div> : null}
    {!loading && tab === "support" ? <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle>{adminText("Support messages")}</CardTitle><Button size="sm" variant="outline" disabled={busy} onClick={()=>void refreshSupportQueue()}>{adminText("Refresh queue")}</Button></CardHeader><CardContent className="space-y-3">{groupSupportThreads(support).map((thread)=> <div key={thread.uid} className="rounded-xl border border-brand-border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold text-brand-text">{thread.email || thread.uid}</p><p className="text-xs text-brand-text-muted">{thread.uid}</p></div><div className="flex flex-wrap items-center gap-2"><Badge variant={thread.unanswered > 0 ? "warning" : "success"}>{thread.unanswered > 0 ? adminText("Awaiting reply") + " · " + thread.unanswered : adminText("Replied")}</Badge>{thread.adminUnreadCount > 0 ? <Badge variant="info">{adminText("Unread") + " · " + thread.adminUnreadCount}</Badge> : null}{thread.adminUnreadCount > 0 ? <Button size="sm" variant="outline" disabled={busy} onClick={()=>void markSupportThreadRead(thread.uid)}>{adminText("Mark read")}</Button> : null}</div></div><div className="mt-3 space-y-2 rounded-lg bg-brand-surface-2/50 p-3">{thread.messages.map((message,index)=><div key={asText(message.id)||index} className={message.from === "admin" ? "ml-5 rounded-lg bg-brand-accent/10 p-2.5" : "mr-5 rounded-lg bg-brand-surface p-2.5"}><div className="flex items-center justify-between gap-2"><Badge variant={message.from === "admin" ? "outline" : "secondary"}>{message.from === "admin" ? adminText("Administrator") : adminText("Customer")}</Badge><span className="text-[11px] text-brand-text-muted">{formatDate(asText(message.time))}</span></div><p className="mt-2 whitespace-pre-wrap break-words text-sm">{asText(message.content)}</p></div>)}</div><textarea value={supportReply[thread.uid]||""} onChange={event=>{setSupportReply(current=>({...current,[thread.uid]:event.target.value}));try { setSupportReplyRequestIds(current=>({...current,[thread.uid]:window.crypto.randomUUID()})); } catch { setError("Secure support reply request IDs are unavailable in this browser. No reply was sent."); }}} rows={2} className="mt-3 w-full rounded-lg border border-brand-border bg-brand-surface-2 p-2 text-sm text-brand-text" placeholder={adminText("Reply to customer")}/><Button size="sm" className="mt-2" disabled={busy||!supportReply[thread.uid]?.trim()||!hasPermission("support.reply")} onClick={()=>void replySupport(thread.uid)}>{adminText("Send reply")}</Button></div>)}{support.length===0 ? <p className="rounded-lg border border-dashed border-brand-border p-6 text-center text-sm text-brand-text-muted">暂无客服消息。</p> : null}</CardContent></Card> : null}
    {!loading && tab === "support-faq" ? <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>{adminText("Help centre entries")}</CardTitle>
              <CardDescription>{adminText("Published to the customer support page. Hidden entries stay here but customers never see them.")}</CardDescription>
            </div>
            <Button size="sm" variant="outline" disabled={supportFaqBusy} onClick={()=>void refreshSupportFaq()}>{adminText("Refresh")}</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {supportFaq.map(entry=><div key={entry.id} className="rounded-xl border border-brand-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={entry.enabled ? "success" : "outline"}>{entry.enabled ? adminText("Published") : adminText("Hidden")}</Badge>
              <span className="type-meta text-brand-text-muted">{adminText("Order")} {entry.order}</span>
              <span className="ml-auto font-mono text-[11px] text-brand-text-muted">{entry.id}</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-brand-text">{entry.question}</p>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-brand-text-secondary">{entry.answer}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={supportFaqBusy || !hasPermission("support.manage")} onClick={()=>startEditSupportFaq(entry)}>{adminText("Edit")}</Button>
              <Button size="sm" variant="outline" className="border-brand-danger/30 text-brand-danger hover:bg-brand-danger/5 hover:text-brand-danger" disabled={supportFaqBusy || !hasPermission("support.manage")} onClick={()=>void removeSupportFaqEntry(entry.id)}>{adminText("Delete")}</Button>
            </div>
          </div>)}
          {supportFaq.length === 0 ? <p className="rounded-lg border border-dashed border-brand-border p-6 text-center text-sm text-brand-text-muted">{adminText("No help-centre entries yet.")}</p> : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{supportFaqEditingId ? adminText("Edit help-centre entry") : adminText("New help-centre entry")}</CardTitle>
          <CardDescription>{adminText("Stored in the backend state document; customers receive enabled entries in this order.")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="block text-xs font-semibold text-brand-text-secondary">{adminText("Question")}
            <input value={supportFaqQuestion} onChange={event=>setSupportFaqQuestion(event.target.value)} maxLength={300} className="mt-1 w-full rounded-lg border border-brand-border bg-brand-surface-2 p-2 text-sm text-brand-text" placeholder={adminText("How do I verify my account?")} />
          </label>
          <label className="block text-xs font-semibold text-brand-text-secondary">{adminText("Answer")}
            <textarea value={supportFaqAnswer} onChange={event=>setSupportFaqAnswer(event.target.value)} rows={6} maxLength={4000} className="mt-1 w-full rounded-lg border border-brand-border bg-brand-surface-2 p-2 text-sm text-brand-text" placeholder={adminText("Explain the steps clearly.")} />
          </label>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block text-xs font-semibold text-brand-text-secondary">{adminText("Order")}
              <input value={supportFaqOrder} onChange={event=>setSupportFaqOrder(event.target.value)} inputMode="numeric" className="mt-1 w-24 rounded-lg border border-brand-border bg-brand-surface-2 p-2 text-sm text-brand-text" />
            </label>
            <label className="flex items-center gap-2 pb-2 text-xs font-semibold text-brand-text-secondary">
              <input type="checkbox" checked={supportFaqEnabled} onChange={event=>setSupportFaqEnabled(event.target.checked)} className="h-4 w-4" />
              {adminText("Show to customers")}
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={supportFaqBusy || !hasPermission("support.manage")} onClick={()=>void saveSupportFaqEntry()}>{supportFaqBusy ? adminText("Saving…") : adminText("Save entry")}</Button>
            <Button size="sm" variant="outline" disabled={supportFaqBusy} onClick={resetSupportFaqForm}>{adminText("Clear form")}</Button>
          </div>
        </CardContent>
      </Card>
    </div> : null}
    {!loading && tab === "markets" ? <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.9fr)]">
      <Card><CardHeader><CardTitle>{adminText("Spot market catalogue")}</CardTitle><CardDescription>{adminText("Only enabled pairs accept limit orders. Market orders remain disabled; maker/taker fees stay at zero until fee movements are implemented atomically.")}</CardDescription></CardHeader><CardContent className="space-y-3">
        {spotMarkets.length ? <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b border-brand-border bg-brand-surface-2/50 type-label uppercase tracking-wide text-brand-text-muted"><th className="px-3 py-2.5">{adminText("Pair")}</th><th className="px-3 py-2.5">{adminText("Status")}</th><th className="px-3 py-2.5 text-right">{adminText("Tick / step")}</th><th className="px-3 py-2.5 text-right">{adminText("Min quantity / notional")}</th><th className="px-3 py-2.5 text-right">{adminText("Action")}</th></tr></thead><tbody>{spotMarkets.map(market=><tr key={market.base_asset + "/" + market.quote_asset} className="border-b border-brand-border-subtle transition-colors hover:bg-brand-surface-hover/40"><td className="px-3 py-2.5 font-semibold">{market.base_asset}/{market.quote_asset}</td><td className="px-3 py-2.5"><Badge variant={market.enabled ? "success" : "outline"}>{market.enabled ? adminText("Enabled") : adminText("Disabled")}</Badge></td><td className="px-3 py-2.5 text-right text-xs tabular-nums">{asText(market.price_tick)} / {asText(market.quantity_step)}</td><td className="px-3 py-2.5 text-right text-xs tabular-nums">{asText(market.min_quantity)} / {asText(market.min_notional)}</td><td className="px-3 py-2.5 text-right"><Button size="sm" variant="outline" disabled={busy || !!spotMarketRequestId || !hasPermission("system_config.write")} onClick={()=>setSpotMarketDraft({base_asset:market.base_asset,quote_asset:market.quote_asset,enabled:market.enabled,price_tick:String(market.price_tick),quantity_step:String(market.quantity_step),min_quantity:String(market.min_quantity),min_notional:String(market.min_notional),min_limit_price:market.min_limit_price==null?"":String(market.min_limit_price),max_limit_price:market.max_limit_price==null?"":String(market.max_limit_price),reason:""})}>{adminText("Edit")}</Button></td></tr>)}</tbody></table></div> : <p className="text-sm text-brand-text-muted">{adminText("No spot pairs have been configured yet.")}</p>}
        <Button size="sm" variant="outline" disabled={busy || !!spotMarketRequestId || !hasPermission("system_config.write")} onClick={()=>setSpotMarketDraft({base_asset:"",quote_asset:"USDT",enabled:false,price_tick:"0.01",quantity_step:"0.000001",min_quantity:"0.000001",min_notional:"1",min_limit_price:"",max_limit_price:"",reason:""})}>{adminText("Add market pair")}</Button>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>{adminText("Market parameters")}</CardTitle><CardDescription>{adminText("Changes are permission-checked, request-ID protected and audited by PostgreSQL. Existing orders keep their accepted terms.")}</CardDescription></CardHeader><CardContent className="space-y-3">
        {spotMarketRequestId ? <p role="status" className="rounded-lg border border-brand-border bg-brand-surface-2 p-3 text-xs text-brand-text-muted">{adminText("A previous request is unconfirmed. Retry the exact same update; fields are locked to prevent changing the payload.")}</p> : null}
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
    {!loading && tab === "seconds" ? <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><div><CardTitle>{adminText("Open Seconds positions")}</CardTitle><CardDescription>{adminText("Read-only live queue. Due positions remain visible until the server confirms settlement; staff cannot force a result or manually release frozen funds here.")}</CardDescription></div><Button size="sm" variant="outline" disabled={secondsQueueLoading || !token} onClick={() => { if (!token) return; const requestId = ++secondsQueueRequestRef.current; setSecondsQueueLoading(true); setSecondsOpenPositions([]); setSecondsOpenSummary(null); setSecondsQueueError(""); void getAdminSecondsOpenPositions(token).then(result => { if (requestId !== secondsQueueRequestRef.current) return; setSecondsOpenPositions(result.positions); setSecondsOpenSummary(result); }).catch(reason => { if (requestId === secondsQueueRequestRef.current) { setSecondsOpenPositions([]); setSecondsOpenSummary(null); setSecondsQueueError(reason instanceof Error ? reason.message : "Open Seconds positions are temporarily unavailable."); } }).finally(() => { if (requestId === secondsQueueRequestRef.current) setSecondsQueueLoading(false); }); }}>{secondsQueueLoading ? adminText("Refreshing…") : adminText("Refresh queue")}</Button></div></CardHeader><CardContent className="space-y-3">
      {secondsQueueError ? <p role="alert" className="rounded-lg border border-brand-border p-3 text-sm text-brand-text-muted">{secondsQueueError}</p> : null}
      {secondsOpenSummary ? <div className="grid gap-2 sm:grid-cols-3"><div className="rounded-lg border border-brand-border p-3"><p className="text-xs text-brand-text-muted">{adminText("Open positions")}</p><p className="mt-1 text-xl font-semibold tabular-nums text-brand-text">{secondsOpenSummary.total_open_count}</p></div><div className="rounded-lg border border-brand-border p-3"><p className="text-xs text-brand-text-muted">{adminText("Open exposure · USDT")}</p><p className="mt-1 text-xl font-semibold tabular-nums text-brand-text">{Number(secondsOpenSummary.total_open_exposure).toLocaleString("zh-CN",{maximumFractionDigits:8})}</p></div><div className="rounded-lg border border-brand-border p-3"><p className="text-xs text-brand-text-muted">{adminText("Past maturity, not yet settled")}</p><p className="mt-1 text-xl font-semibold tabular-nums text-brand-text">{secondsOpenSummary.overdue_count}</p></div></div> : null}
      {secondsOpenSummary?.truncated ? <p className="text-xs text-brand-text-muted">{adminText("Showing the earliest 100 open positions. Summary totals include all open positions.")}</p> : null}
      {secondsOpenPositions.length ? <div className="space-y-2">{secondsOpenPositions.map(position=><div key={position.position_id} className="rounded-xl border border-brand-border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="font-semibold">{position.symbol}/USDT · {position.direction.toUpperCase()}</div><Badge variant={position.overdue ? "destructive" : "outline"}>{position.overdue ? adminText("Maturity reached · awaiting settlement") : adminText("Open")}</Badge></div><div className="mt-2 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4"><div><span className="text-brand-text-muted">{adminText("Stake")}</span><p className="font-medium">{Number(position.amount).toLocaleString("zh-CN",{maximumFractionDigits:8})} USDT</p></div><div><span className="text-brand-text-muted">{adminText("Open price")}</span><p className="font-medium">{Number(position.open_price).toLocaleString("zh-CN",{maximumFractionDigits:12})}</p></div><div><span className="text-brand-text-muted">{adminText("Duration / payout")}</span><p className="font-medium">{position.duration_sec}{adminText("s ·")}{position.payout_bps_snapshot === null ? adminText("Legacy 85%") : (position.payout_bps_snapshot/100)+"%"}</p></div><div><span className="text-brand-text-muted">{adminText("Maturity")}</span><p className="font-medium">{new Date(position.settle_at).toLocaleString("zh-CN")}</p></div></div><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-brand-text-muted"><span>{adminText("User UID ·")}<span className="font-mono">{position.user_id}</span></span><span>{adminText("Position ·")}<span className="font-mono">{position.position_id}</span></span><span>{adminText("Policy v")}{position.policy_version ?? "legacy"}</span></div></div>)}</div> : secondsQueueError ? null : <p className="rounded-lg border border-dashed border-brand-border p-6 text-center text-sm text-brand-text-muted">{adminText("No open Seconds positions.")}</p>}
    </CardContent></Card> : null}
    {!loading && tab === "admins" && session.is_super_admin ? <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
      <Card><CardHeader><CardTitle>{adminText("Delegated administrators")}</CardTitle><CardDescription>{adminText("Only the Super Admin can provision, change, suspend or revoke administrator access. Every change requires a reason and is recorded by the database.")}</CardDescription></CardHeader><CardContent className="space-y-3">
        {adminMemberships.length ? adminMemberships.map(item=><div key={item.user_id} className="rounded-xl border border-brand-border p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-mono text-xs text-brand-text">{item.user_id}</p><p className="mt-1 text-xs text-brand-text-muted">{adminText("Revision")}{item.revision} · {formatDate(item.updated_at||item.created_at)}</p></div><Badge variant={statusVariant(item.status)}>{adminText(item.status)}</Badge></div><div className="mt-2 flex flex-wrap gap-1.5">{item.permissions.length ? item.permissions.map(key=><Badge key={key} variant="outline" className="text-[11px]">{permissionLabel(key)}</Badge>) : <span className="text-xs text-brand-text-muted">无权限</span>}</div><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busy||item.status==="revoked"} onClick={()=>{setAdminTargetUserId(item.user_id);setAdminPermissions(item.permissions);setAdminReason("");setAdminRequestId("");setAdminRequestKey("");}}>{adminText("Edit permissions")}</Button>{item.status==="active"?<Button size="sm" variant="outline" disabled={busy} onClick={()=>void submitAdminMembershipChange("suspend",item.user_id,item.revision,[])}>{adminText("Suspend")}</Button>:null}{item.status==="suspended"?<Button size="sm" variant="outline" disabled={busy} onClick={()=>void submitAdminMembershipChange("reactivate",item.user_id,item.revision,item.permissions)}>{adminText("Reactivate")}</Button>:null}{item.status!=="revoked"?<Button size="sm" variant="destructive" disabled={busy} onClick={()=>void submitAdminMembershipChange("revoke",item.user_id,item.revision,[])}>{adminText("Revoke")}</Button>:null}</div></div>) : <p className="text-sm text-brand-text-muted">{adminText("No delegated administrators have been provisioned.")}</p>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>{adminMemberships.some(item=>item.user_id===adminTargetUserId)?adminText("Edit administrator permissions"):adminText("Provision administrator")}</CardTitle><CardDescription>{adminText("Select an existing BTCBOX user. The database verifies that the target UUID belongs to a real Supabase Auth user.")}</CardDescription></CardHeader><CardContent className="space-y-3">
        <form className="flex gap-2" onSubmit={event=>{event.preventDefault();if(!token)return;const requestId=++adminCandidatesRequestRef.current;setAdminCandidates([]);setError("");void getAdminUsers(token,adminSearch).then(result=>{if(requestId===adminCandidatesRequestRef.current)setAdminCandidates(result.users||[]);}).catch(reason=>{if(requestId===adminCandidatesRequestRef.current)setError(reason instanceof Error?reason.message:"User search failed.");});}}><input value={adminSearch} onChange={event=>setAdminSearch(event.target.value)} placeholder={adminText("Search user email or UID")} className="h-11 min-w-0 flex-1 rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-brand-text outline-none transition-colors focus:border-brand-accent/60 focus:ring-2 focus:ring-brand-accent/15"/><Button size="sm" type="submit" variant="outline">{adminText("Search")}</Button></form>
        <select value={adminTargetUserId} onChange={event=>{const value=event.target.value;setAdminTargetUserId(value);const found=adminMemberships.find(item=>item.user_id===value);setAdminPermissions(found?.permissions||[]);setAdminRequestId("");setAdminRequestKey("");}} className="w-full rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-sm text-brand-text"><option value="">{adminText("Select an Auth-linked user")}</option>{adminCandidates.filter(user=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(user.admin_auth_user_id||"")&&!adminMemberships.some(item=>item.user_id===user.admin_auth_user_id)).map(user=><option key={user.uid} value={user.admin_auth_user_id}>{user.email} {adminText("· BTCBOX UID")}{user.uid}</option>)}{adminMemberships.some(item=>item.user_id===adminTargetUserId)?<option value={adminTargetUserId}>{adminTargetUserId}</option>:null}</select>
        <div className="grid gap-2 sm:grid-cols-2">{adminPermissionOptions.map(([key,label])=><label key={key} className="flex items-center gap-2 rounded-lg border border-brand-border p-2 text-xs"><input type="checkbox" checked={adminPermissions.includes(key)} onChange={event=>setAdminPermissions(current=>event.target.checked?[...current,key]:current.filter(item=>item!==key))}/><span>{adminText(label)}</span></label>)}</div>
        <textarea value={adminReason} onChange={event=>setAdminReason(event.target.value)} rows={2} maxLength={500} placeholder={adminText("Required reason for this administrator change")} className="w-full rounded-lg border border-brand-border bg-brand-surface-2 p-3 text-sm text-brand-text"/>
        <Button block disabled={busy||!adminTargetUserId||(!adminMemberships.some(item=>item.user_id===adminTargetUserId)&&!adminPermissions.length)||!adminReason.trim()} onClick={()=>{const existing=adminMemberships.find(item=>item.user_id===adminTargetUserId);void submitAdminMembershipChange(existing?"set_permissions":"provision",adminTargetUserId,existing?.revision||0,adminPermissions);}}>{adminMemberships.some(item=>item.user_id===adminTargetUserId)?adminText("Save permissions"):adminText("Provision administrator")}</Button>
      </CardContent></Card>
    </div> : null}
    {pendingDeletePayoutAddress ? <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-bg/80 p-4" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="delete-payout-title" className="w-full max-w-md rounded-xl border border-brand-border bg-brand-surface p-5 shadow-2xl"><h2 id="delete-payout-title" className="text-lg font-semibold">{adminText("Delete bank payout details?")}</h2><p className="mt-2 text-sm text-brand-text-muted">{pendingDeletePayoutAddress.bank_name} · {pendingDeletePayoutAddress.account_holder}. {adminText("This action cannot be undone and will be recorded in the audit log.")}</p><div className="mt-5 flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={()=>setPendingDeletePayoutAddress(null)}>{adminText("Cancel")}</Button><Button variant="destructive" disabled={busy||!hasPermission("payout_addresses.manage")} onClick={()=>void deletePayoutAddress(pendingDeletePayoutAddress)}>{adminText("Confirm delete")}</Button></div></section></div>:null}
    {reviewDialog ? <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-bg/80 p-4"
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
            {reviewDialog.kind === "withdrawal" ? adminText("Reject withdrawal") : reviewDialog.kind === "kyc-manual" ? adminText("Manual identity verification") : adminText("Reject KYC application")}
          </h2>
          <p id="review-dialog-description" className="mt-1 text-sm text-brand-text-muted">
            {reviewDialog.kind === "withdrawal"
              ? adminText("The rejection and refund will be recorded together. Enter the reason for the audit record.")
              : reviewDialog.kind === "kyc-manual"
                ? adminText("Use this only after you have independently verified the customer's identity. Record the verification method and details; this action is audited.")
                : adminText("Enter the reason that will be recorded with this KYC decision.")}
          </p>
        </div>
        <label className="block space-y-2 text-sm">
          <span className="font-medium text-brand-text">{adminText(reviewDialog.kind === "kyc-manual" ? "Manual verification method and notes" : "Rejection reason")}<span className="text-brand-danger">*</span></span>
          <textarea
            autoFocus
            value={reviewReason}
            onChange={event => setReviewReason(event.target.value)}
            rows={4}
            maxLength={300}
            disabled={busy}
            placeholder={adminText(reviewDialog.kind === "kyc-manual" ? "Describe how identity was checked (for example, live video call and document comparison)." : "Enter a clear reason (up to 300 characters)")}
            className="w-full resize-y rounded-lg border border-brand-border bg-brand-surface-2 p-3 text-brand-text outline-none focus:border-brand-accent"
          />
          <span className="block text-right text-xs text-brand-text-muted">{reviewReason.length}/300</span>
        </label>
        {reviewDialog.kind === "kyc-manual" ? <label className="mt-4 flex items-start gap-2 text-sm text-brand-text"><input type="checkbox" checked={manualIdentityConfirmed} disabled={busy} onChange={event=>setManualIdentityConfirmed(event.target.checked)} className="mt-1" /><span>{adminText("I personally verified this customer's identity and confirm the evidence is sufficient.")}</span></label> : null}
        {error ? <p role="alert" className="mt-3 text-sm text-brand-danger">{adminText(error)}</p> : null}
        <div className="mt-5 flex flex-col-reverse justify-end gap-2 sm:flex-row">
          <Button type="button" variant="outline" disabled={busy} onClick={() => { setReviewDialog(null); setReviewReason(""); }}>{adminText("Cancel")}</Button>
          <Button type="button" variant={reviewDialog.kind === "kyc-manual" ? "default" : "destructive"} disabled={busy || !reviewReason.trim() || (reviewDialog.kind === "kyc-manual" && !manualIdentityConfirmed)} onClick={() => void confirmReviewRejection()}>
            {busy ? adminText("Submitting…") : adminText(reviewDialog.kind === "kyc-manual" ? "Confirm manual approval" : "Confirm rejection")}
          </Button>
        </div>
      </section>
    </div> : null}
  </div>;
}
