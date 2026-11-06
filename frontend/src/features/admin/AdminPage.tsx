import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
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
  const [actionMessage, setActionMessage] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [creditUser, setCreditUser] = useState<AdminRow | null>(null);
  const [creditAsset, setCreditAsset] = useState("USDT");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReference, setCreditReference] = useState("");
  const [creditNote, setCreditNote] = useState("");
  const [payoutReferences, setPayoutReferences] = useState<Record<string, string>>({});
  const [supportDrafts, setSupportDrafts] = useState<Record<string, string>>({});
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


  const performAction = async (path: string, body: Record<string, unknown>, success: string): Promise<boolean> => {
    setActionBusy(true); setError(""); setActionMessage("");
    try {
      const token = await getSupabaseAccessToken();
      await requestAdmin(token, path, { method: "POST", body });
      setActionMessage(success);
      await load();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The server did not confirm this administrator action.");
      return false;
    } finally { setActionBusy(false); }
  };

  const submitManualCredit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!creditUser || !String(creditUser.uid || "") || !creditAmount.trim()) return;
    const confirmed = await performAction("deposit/confirm", {
      uid: String(creditUser.uid), coin: creditAsset, amount: creditAmount.trim(),
      reference: creditReference.trim(), note: creditNote.trim(), idempotency_key: crypto.randomUUID(),
    }, "Manual credit confirmed by the financial service.");
    if (confirmed) { setCreditAmount(""); setCreditReference(""); setCreditNote(""); setCreditUser(null); }
  };

  const rows = useMemo(() => {
    const raw = payload && active.key ? payload[active.key] : [];
    return Array.isArray(raw) ? raw.filter((item): item is AdminRow => !!item && typeof item === "object") : [];
  }, [active.key, payload]);

  if (status !== "authenticated") return <div className="mx-auto max-w-4xl p-6 text-sm text-brand-text-muted">Sign in with an authorized administrator account to open the BTCBOX Admin Console.</div>;

  return <div className="mx-auto flex w-full max-w-[1600px] min-w-0 flex-col gap-5 p-3 sm:p-5 lg:p-7">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="mb-1 text-xs font-bold uppercase tracking-[.18em] text-brand-text-muted">BTCBOX / CONTROL CENTER</p><h1 className="type-page-title text-brand-text">Admin Console</h1><p className="type-body mt-1 text-brand-text-secondary">Server-authorized administration. Permissions are checked on every request.</p></div>
      <Badge variant="outline" className="border-brand-accent/30 bg-brand-accent/10 text-brand-text-secondary">Supabase Auth + RBAC</Badge>
    </div>
    <div className="flex gap-2 overflow-x-auto pb-1">
      {TABS.map((item) => <Button key={item.id} size="sm" variant={tab === item.id ? "default" : "outline"} className="shrink-0" onClick={() => { setTab(item.id); setPayload(null); }}>{item.label}</Button>)}
      <Button size="sm" variant="ghost" className="ml-auto shrink-0" disabled={loading} onClick={() => setRetry((n) => n + 1)}>Refresh</Button>
    </div>
    {actionMessage ? <p className="rounded-xl border border-emerald-500/30 p-3 text-sm text-emerald-300" role="status">{actionMessage}</p> : null}
    {error ? <Card className="border-rose-500/30 bg-brand-surface"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4"><p className="text-sm text-rose-300" role="alert">{error}</p><Button size="sm" variant="outline" onClick={() => setRetry((n) => n + 1)}>Retry</Button></CardContent></Card> : null}
    {loading ? <Card className="border-brand-border bg-brand-surface"><CardContent className="p-6 text-sm text-brand-text-muted" role="status">Loading authorized administrator data…</CardContent></Card> : null}
    {!loading && tab === "overview" && payload ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ["Total users", payload.total_users], ["Pending withdrawals", payload.pending_withdrawals],
        ["Pending admin review", payload.pending_admin_review_withdrawals], ["Pending KYC", payload.pending_kyc],
      ].map(([label, value]) => <Card key={String(label)} className="border-brand-border bg-brand-surface"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-brand-text-muted">{label}</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold tabular-nums text-brand-text">{value === undefined ? "—" : String(value)}</p></CardContent></Card>)}
      <Card className="border-brand-border bg-brand-surface sm:col-span-2 xl:col-span-4"><CardHeader><CardTitle className="text-sm">Configured deposit addresses</CardTitle></CardHeader><CardContent><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{Object.entries((payload.deposit_addresses && typeof payload.deposit_addresses === "object" ? payload.deposit_addresses : {}) as Record<string, unknown>).map(([network, address]) => <div key={network} className="min-w-0 rounded-lg border border-brand-border p-3"><p className="text-xs text-brand-text-muted">{network}</p><p className="mt-1 break-all text-sm text-brand-text">{String(address || "Not configured")}</p></div>)}</div></CardContent></Card>
    </div> : null}
    {!loading && tab === "users" ? <div className="flex flex-col gap-3">
      <div className="max-w-md"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by email or UID" /></div>
      <div className="overflow-x-auto rounded-xl border border-brand-border"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-brand-surface-2 text-xs uppercase tracking-wide text-brand-text-muted"><tr>{["UID","Email","KYC","Total USDT","Frozen","Created","Action"].map(x=><th key={x} className="px-4 py-3">{x}</th>)}</tr></thead><tbody>{rows.map((row,index)=><tr key={String(row.uid||index)} className="border-t border-brand-border/70"><td className="px-4 py-3">{valueOf(row,["uid"])}</td><td className="px-4 py-3">{valueOf(row,["email"])}</td><td className="px-4 py-3">{valueOf(row,["kyc_status"])}</td><td className="px-4 py-3">{valueOf(row,["total_usdt"])}</td><td className="px-4 py-3">{row.frozen===true?"Yes":"No"}</td><td className="px-4 py-3">{valueOf(row,["created_at"])}</td><td className="px-4 py-3"><Button size="sm" variant="outline" disabled={actionBusy} onClick={()=>setCreditUser(row)}>Manual credit</Button></td></tr>)}</tbody></table></div>
      {creditUser ? <Card className="border-brand-border bg-brand-surface"><CardHeader><CardTitle>Manual credit · UID {String(creditUser.uid)}</CardTitle></CardHeader><CardContent><form className="grid gap-3 sm:grid-cols-2" onSubmit={submitManualCredit}>
        <label className="space-y-1 text-sm"><span className="text-brand-text-muted">Asset</span><select value={creditAsset} onChange={e=>setCreditAsset(e.target.value)} className="w-full rounded-xl border border-brand-border bg-brand-surface-2 p-3 text-brand-text">{["USDT","BTC","ETH","SOL"].map(x=><option key={x}>{x}</option>)}</select></label>
        <label className="space-y-1 text-sm"><span className="text-brand-text-muted">Amount</span><input value={creditAmount} onChange={e=>setCreditAmount(e.target.value)} inputMode="decimal" required className="w-full rounded-xl border border-brand-border bg-brand-surface-2 p-3 text-brand-text" placeholder="0.00"/></label>
        <label className="space-y-1 text-sm"><span className="text-brand-text-muted">Reference (optional)</span><input value={creditReference} onChange={e=>setCreditReference(e.target.value)} className="w-full rounded-xl border border-brand-border bg-brand-surface-2 p-3 text-brand-text"/></label>
        <label className="space-y-1 text-sm"><span className="text-brand-text-muted">Note (optional)</span><input value={creditNote} onChange={e=>setCreditNote(e.target.value)} className="w-full rounded-xl border border-brand-border bg-brand-surface-2 p-3 text-brand-text"/></label>
        <div className="flex gap-2 sm:col-span-2"><Button type="submit" disabled={actionBusy||!creditAmount.trim()}>Confirm manual credit</Button><Button type="button" variant="outline" onClick={()=>setCreditUser(null)}>Cancel</Button></div>
      </form><p className="mt-3 text-xs text-amber-300">The server requires the financial cutover and atomic ledger RPC. A blocked request is not credited.</p></CardContent></Card> : null}
    </div> : null}
    {!loading && tab === "withdrawals" ? <div className="space-y-3">{rows.length ? rows.map((row,index)=>{const id=String(row.id||index);const status=String(row.status||"");return <Card key={id} className="border-brand-border bg-brand-surface"><CardContent className="space-y-3 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold">{valueOf(row,["amount"])} {valueOf(row,["coin"])} · UID {valueOf(row,["uid"])}</p><p className="mt-1 break-all text-xs text-brand-text-muted">{valueOf(row,["address"])} · {valueOf(row,["network"])}</p><p className="mt-1 text-xs text-brand-text-muted">{valueOf(row,["email"])} · {valueOf(row,["time","created_at"])}</p></div><Badge variant={status==="completed"?"outline":status==="rejected"?"destructive":"secondary"}>{status||"—"}</Badge></div><div className="flex flex-wrap gap-2"><Button size="sm" disabled={actionBusy||(status!=="pending"&&status!=="pending_admin_review")} onClick={()=>performAction("withdraw/approve",{id},"Withdrawal approval confirmed by server.")}>Approve</Button><Button size="sm" variant="outline" disabled={actionBusy||(status!=="pending"&&status!=="pending_admin_review")} onClick={()=>performAction("withdraw/reject",{id,reason:"Rejected after staff review."},"Withdrawal rejection confirmed by server.")}>Reject</Button><div className="flex min-w-[240px] flex-1 gap-2"><input value={payoutReferences[id]||""} onChange={e=>setPayoutReferences(current=>({...current,[id]:e.target.value}))} placeholder="Required TxID / payout reference" className="min-w-0 flex-1 rounded-lg border border-brand-border bg-brand-surface-2 px-3 text-xs text-brand-text"/><Button size="sm" variant="secondary" disabled={actionBusy||status!=="approved"||!(payoutReferences[id]||"").trim()} onClick={()=>performAction("withdraw/mark-paid",{id,reference:payoutReferences[id].trim()},"Manual payout completion recorded by server.")}>Mark paid</Button></div></div></CardContent></Card>;}) : <div className="rounded-xl border border-dashed border-brand-border p-8 text-center text-sm text-brand-text-muted">No withdrawals are waiting for review.</div>}</div> : null}
    {!loading && tab === "orders" ? <AdminTable rows={rows} columns={[{label:"Order",keys:["id"]},{label:"UID",keys:["uid"]},{label:"Market",keys:["symbol"]},{label:"Side",keys:["side"]},{label:"Type",keys:["type"]},{label:"Amount",keys:["amount"]},{label:"Status",keys:["status"]},{label:"Time",keys:["time"]}]} empty="No orders found." /> : null}
    {!loading && tab === "kyc" ? <div className="space-y-2">{rows.length?rows.map((row,index)=><div key={String(row.uid||index)} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-border p-4"><div><p className="font-semibold">{valueOf(row,["name"])} · UID {valueOf(row,["uid"])}</p><p className="text-xs text-brand-text-muted">{valueOf(row,["email"])} · {valueOf(row,["id_type"])} · {valueOf(row,["submitted_at"])}</p></div><div className="flex gap-2"><Button size="sm" disabled={actionBusy} onClick={()=>performAction("kyc/approve",{uid:String(row.uid)},"KYC approval confirmed by server.")}>Approve</Button><Button size="sm" variant="outline" disabled={actionBusy} onClick={()=>performAction("kyc/reject",{uid:String(row.uid),reason:"Rejected after staff review."},"KYC rejection confirmed by server.")}>Reject</Button></div></div>):<div className="rounded-xl border border-dashed border-brand-border p-8 text-center text-sm text-brand-text-muted">No KYC applications are waiting for review.</div>}</div> : null}
    {!loading && tab === "support" ? <div className="space-y-3">{rows.length?rows.map((row,index)=>{const uid=String(row.uid||"");return <Card key={String(row.id||index)} className="border-brand-border bg-brand-surface"><CardContent className="space-y-3 p-4"><div><p className="font-semibold">{valueOf(row,["email"])} · UID {uid}</p><p className="mt-1 text-xs text-brand-text-muted">{valueOf(row,["time"])}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm text-brand-text-secondary">{valueOf(row,["content"])}</p></div><div className="flex flex-col gap-2 sm:flex-row"><textarea value={supportDrafts[uid]||""} onChange={e=>setSupportDrafts(current=>({...current,[uid]:e.target.value}))} rows={2} placeholder="Write a support reply…" className="min-w-0 flex-1 rounded-lg border border-brand-border bg-brand-surface-2 p-3 text-sm text-brand-text"/><Button size="sm" className="self-end" disabled={actionBusy||!(supportDrafts[uid]||"").trim()} onClick={()=>performAction("support/reply",{uid,content:supportDrafts[uid].trim()},"Support reply sent.")}>Send reply</Button></div></CardContent></Card>;}) : <div className="rounded-xl border border-dashed border-brand-border p-8 text-center text-sm text-brand-text-muted">No support messages.</div>}</div> : null}
    {!loading && error === "" && !payload ? <Card className="border-brand-border bg-brand-surface"><CardContent className="p-5 text-sm text-brand-text-muted">No administrator data is available.</CardContent></Card> : null}
  </div>;
}
