import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { useAuth } from "../../lib/auth";
import { requestAdmin, type AdminPayload } from "../../lib/admin-api";

type AdminTab = "overview" | "users" | "withdrawals" | "orders" | "kyc" | "support";
type AdminRow = Record<string, unknown>;
const TABS: Array<{ id: AdminTab; label: string; endpoint: string; key: string }> = [
  { id: "overview", label: "Overview", endpoint: "stats", key: "" },
  { id: "users", label: "Users", endpoint: "users", key: "users" },
  { id: "withdrawals", label: "Withdrawals", endpoint: "withdrawals", key: "withdrawals" },
  { id: "orders", label: "Orders", endpoint: "orders", key: "orders" },
  { id: "kyc", label: "KYC review", endpoint: "kyc", key: "kycs" },
  { id: "support", label: "Support", endpoint: "support/messages", key: "messages" },
];
function valueOf(row: AdminRow, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== "") return String(value);
  }
  return "—";
}
function AdminTable({ rows, columns, empty }: { rows: AdminRow[]; columns: Array<{ label: string; keys: string[] }>; empty: string }) {
  if (!rows.length) return <div className="rounded-xl border border-dashed border-brand-border p-8 text-center text-sm text-brand-text-muted">{empty}</div>;
  return <div className="overflow-x-auto rounded-xl border border-brand-border">
    <table className="w-full min-w-[680px] text-left text-sm">
      <thead className="bg-brand-surface-2 text-xs uppercase tracking-wide text-brand-text-muted"><tr>{columns.map((column) => <th key={column.label} className="px-4 py-3 font-semibold">{column.label}</th>)}</tr></thead>
      <tbody>{rows.map((row, index) => <tr key={valueOf(row, ["id", "uid", "position_id"]) + ":" + index} className="border-t border-brand-border/70">
        {columns.map((column) => <td key={column.label} className="max-w-[280px] break-words px-4 py-3 text-brand-text-secondary">{valueOf(row, column.keys)}</td>)}
      </tr>)}</tbody>
    </table>
  </div>;
}
export function AdminPage() {
  const { status, getSupabaseAccessToken } = useAuth();
  const [tab, setTab] = useState<AdminTab>("overview");
  const [search, setSearch] = useState("");
  const [payload, setPayload] = useState<AdminPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const active = TABS.find((item) => item.id === tab) || TABS[0];

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError("");
    try {
      const token = await getSupabaseAccessToken();
      const endpoint = tab === "users" && search.trim()
        ? `users?search=${encodeURIComponent(search.trim())}`
        : active.endpoint;
      const result = await requestAdmin<AdminPayload>(token, endpoint, { signal });
      if (!signal?.aborted) setPayload(result);
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      if (!signal?.aborted) {
        setPayload(null);
        setError(cause instanceof Error ? cause.message : "Administrator data could not be loaded.");
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [active.endpoint, getSupabaseAccessToken, search, tab]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, retry]);

  const rows = useMemo(() => {
    const raw = payload && active.key ? payload[active.key] : [];
    return Array.isArray(raw) ? raw.filter((item): item is AdminRow => !!item && typeof item === "object") : [];
  }, [active.key, payload]);

  const runAction = async (path: string, body: Record<string, unknown>) => {
    setBusy(true); setError("");
    try {
      const token = await getSupabaseAccessToken();
      await requestAdmin(token, path, { method: "POST", body });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Administrator action was not confirmed.");
    } finally { setBusy(false); }
  };

  if (status !== "authenticated") return <div className="mx-auto max-w-4xl p-6 text-sm text-brand-text-muted">Sign in with an authorized administrator account to open the BTCBOX Admin Console.</div>;

  return <div className="mx-auto flex w-full max-w-[1600px] min-w-0 flex-col gap-5 p-3 sm:p-5 lg:p-7">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="mb-1 text-xs font-bold uppercase tracking-[.18em] text-brand-text-muted">BTCBOX / CONTROL CENTER</p><h1 className="type-page-title text-brand-text">Admin Console</h1><p className="type-body mt-1 text-brand-text-secondary">Server-authorized administration. Permissions are checked on every request.</p></div>
      <Badge variant="outline" className="border-brand-accent/30 bg-brand-accent/10 text-brand-text-secondary">Supabase Auth + RBAC</Badge>
    </div>
    <div className="flex gap-2 overflow-x-auto pb-1">
      {TABS.map((item) => <Button key={item.id} size="sm" variant={tab === item.id ? "default" : "outline"} className="shrink-0" onClick={() => { setTab(item.id); setPayload(null); }}>{item.label}</Button>)}
      <Button size="sm" variant="ghost" className="ml-auto shrink-0" disabled={loading || busy} onClick={() => setRetry((n) => n + 1)}>Refresh</Button>
    </div>
    {error ? <Card className="border-rose-500/30 bg-brand-surface"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4"><p className="text-sm text-rose-300" role="alert">{error}</p><Button size="sm" variant="outline" onClick={() => setRetry((n) => n + 1)}>Retry</Button></CardContent></Card> : null}
    {loading ? <Card className="border-brand-border bg-brand-surface"><CardContent className="p-6 text-sm text-brand-text-muted" role="status">Loading authorized administrator data…</CardContent></Card> : null}
    {!loading && tab === "overview" && payload ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ["Total users", payload.total_users], ["Pending withdrawals", payload.pending_withdrawals],
        ["Pending admin review", payload.pending_admin_review_withdrawals], ["Pending KYC", payload.pending_kyc],
      ].map(([label, value]) => <Card key={String(label)} className="border-brand-border bg-brand-surface"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-brand-text-muted">{label}</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold tabular-nums text-brand-text">{value === undefined ? "—" : String(value)}</p></CardContent></Card>)}
      <Card className="border-brand-border bg-brand-surface sm:col-span-2 xl:col-span-4"><CardHeader><CardTitle className="text-sm">Configured deposit addresses</CardTitle></CardHeader><CardContent><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{Object.entries((payload.deposit_addresses && typeof payload.deposit_addresses === "object" ? payload.deposit_addresses : {}) as Record<string, unknown>).map(([network, address]) => <div key={network} className="min-w-0 rounded-lg border border-brand-border p-3"><p className="text-xs text-brand-text-muted">{network}</p><p className="mt-1 break-all text-sm text-brand-text">{String(address || "Not configured")}</p></div>)}</div></CardContent></Card>
    </div> : null}
    {!loading && tab === "users" ? <div className="flex flex-col gap-3"><div className="max-w-md"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by email or UID" /></div><AdminTable rows={rows} columns={[{label:"UID",keys:["uid"]},{label:"Email",keys:["email"]},{label:"KYC",keys:["kyc_status"]},{label:"Total USDT",keys:["total_usdt"]},{label:"Status",keys:["frozen"]},{label:"Created",keys:["created_at"]}]} empty="No users found." /></div> : null}
    {!loading && tab === "withdrawals" ? <AdminTable rows={rows} columns={[{label:"Request",keys:["id"]},{label:"UID",keys:["uid"]},{label:"Asset",keys:["coin"]},{label:"Amount",keys:["amount"]},{label:"Network",keys:["network"]},{label:"Destination",keys:["address"]},{label:"Status",keys:["status"]},{label:"Submitted",keys:["time","created_at"]}]} empty="No withdrawals are waiting for review." /> : null}
    {!loading && tab === "orders" ? <AdminTable rows={rows} columns={[{label:"Order",keys:["id"]},{label:"UID",keys:["uid"]},{label:"Market",keys:["symbol"]},{label:"Side",keys:["side"]},{label:"Type",keys:["type"]},{label:"Amount",keys:["amount"]},{label:"Status",keys:["status"]},{label:"Time",keys:["time"]}]} empty="No orders found." /> : null}
    {!loading && tab === "kyc" ? <AdminTable rows={rows} columns={[{label:"UID",keys:["uid"]},{label:"Email",keys:["email"]},{label:"Applicant",keys:["name"]},{label:"Document type",keys:["id_type"]},{label:"Status",keys:["status"]},{label:"Submitted",keys:["submitted_at"]}]} empty="No KYC applications are waiting for review." /> : null}
    {!loading && tab === "support" ? <AdminTable rows={rows} columns={[{label:"Message",keys:["id"]},{label:"UID",keys:["uid"]},{label:"Email",keys:["email"]},{label:"Message content",keys:["content"]},{label:"Time",keys:["time"]}]} empty="No support messages." /> : null}
    {!loading && error === "" && !payload ? <Card className="border-brand-border bg-brand-surface"><CardContent className="p-5 text-sm text-brand-text-muted">No administrator data is available.</CardContent></Card> : null}
  </div>;
}
