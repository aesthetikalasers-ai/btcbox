import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ChevronLeft, RefreshCw, TrendingUp, TrendingDown, X, AlertCircle, CheckCircle2, Inbox } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import {
  ApiError,
  cancelPerpOrder,
  closePerpPosition,
  getPerpFundingHistory,
  getPerpMarkets,
  getPerpOpenOrders,
  getPerpOrderHistory,
  getPerpPositions,
  getPerpTrades,
  submitPerpOrder,
  type PerpMarket,
  type PerpOrder,
  type PerpPosition,
} from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { localeTags, useI18n } from "../../lib/i18n";
import { TradeProductNav } from "../trade/TradeProductNav";
import { OrderBookDepth } from "../trade/OrderBookDepth";
import { ChartDrawer } from "../trade/ChartDrawer";
import { cn } from "../../lib/utils";

type Tab = "open" | "history" | "trades" | "funding";

function money(value: number | string | null | undefined, locale: string, digits = 4) {
  if (value === undefined || value === null || value === "") return "—";
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(locale, { maximumFractionDigits: digits });
}

/** Signed PnL: explicit + / - prefix (colour-blind safe) + semantic colour class. */
function pnl(value: number | string | null | undefined, locale: string, digits = 4) {
  const num = typeof value === "number" ? value : Number(value);
  if (value === undefined || value === null || value === "" || !Number.isFinite(num)) {
    return { text: "—", className: "pnl-flat" };
  }
  if (num > 0) return { text: `+${money(num, locale, digits)}`, className: "pnl-pos" };
  if (num < 0) return { text: money(num, locale, digits), className: "pnl-neg" };
  return { text: money(num, locale, digits), className: "pnl-flat" };
}

function sideBadge(side: string, t: (v: string) => string) {
  const long = side === "buy" || side === "long";
  return (
    <Badge variant="outline" className={long ? "border-brand-success/30 bg-brand-success/10 text-brand-success" : "border-brand-danger/30 bg-brand-danger/10 text-brand-danger"}>
      {long ? t("Long") : t("Short")}
    </Badge>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="empty-state" role="status">
      <div className="empty-state-icon"><Inbox className="h-5 w-5" /></div>
      <p className="empty-state-title">{title}</p>
      <p className="empty-state-hint">{hint}</p>
    </div>
  );
}

function TableSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="skeleton-bar h-8 w-full" />)}
    </div>
  );
}

export function ContractPage() {
  const { t, language } = useI18n();
  const { status } = useAuth();
  const locale = localeTags[language];
  const [markets, setMarkets] = useState<PerpMarket[]>([]);
  const [marketsLoading, setMarketsLoading] = useState(true);
  const [marketsError, setMarketsError] = useState("");
  const [symbol, setSymbol] = useState("");
  const [orderType, setOrderType] = useState<"market" | "limit">("limit");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [leverage, setLeverage] = useState(1);
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reduceOnly, setReduceOnly] = useState(false);
  const [closePosition, setClosePosition] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitOk, setSubmitOk] = useState("");
  const [positions, setPositions] = useState<PerpPosition[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [positionsError, setPositionsError] = useState("");
  const [openOrders, setOpenOrders] = useState<PerpOrder[]>([]);
  const [orderHistory, setOrderHistory] = useState<PerpOrder[]>([]);
  const [trades, setTrades] = useState<Array<{ trade_id: string; side: string; price: number | string; quantity: number | string; created_at?: string }>>([]);
  const [funding, setFunding] = useState<Array<{ funding_at: string; funding_rate: number | string; payment?: number | string; mark_price?: number | string | null }>>([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("open");
  const [reload, setReload] = useState(0);
  // Mobile segment-3 sub-tab: Positions vs Open orders (scroll-snap segment 3).
  const [mobileSegTab, setMobileSegTab] = useState<"positions" | "open">("positions");

  const selectedMarket = useMemo(() => markets.find((m) => m.symbol === symbol) ?? markets[0], [markets, symbol]);
  const maxLeverage = selectedMarket?.max_leverage ?? 1;
  const effectiveLeverage = Math.min(leverage, maxLeverage);
  const markPrice = selectedMarket?.mark_price ?? null;
  const indexPrice = selectedMarket?.index_price ?? null;
  const leveragePct = maxLeverage > 1 ? ((effectiveLeverage - 1) / (maxLeverage - 1)) * 100 : 0;
  const depthMid = markPrice && Number(markPrice) > 0 ? Number(markPrice) : 67000;

  useEffect(() => {
    if (leverage > maxLeverage) setLeverage(maxLeverage);
  }, [maxLeverage, leverage]);

  useEffect(() => {
    const controller = new AbortController();
    setMarketsLoading(true);
    setMarketsError("");
    getPerpMarkets(controller.signal)
      .then((rows) => {
        if (controller.signal.aborted) return;
        setMarkets(rows);
        setSymbol((current) => (rows.some((m) => m.symbol === current) ? current : rows[0]?.symbol ?? ""));
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setMarkets([]);
        setMarketsError(reason instanceof ApiError ? reason.message : t("Awaiting the perpetual contract backend."));
      })
      .finally(() => { if (!controller.signal.aborted) setMarketsLoading(false); });
    return () => controller.abort();
  }, [reload, t]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const controller = new AbortController();
    setPositionsLoading(true);
    setPositionsError("");
    getPerpPositions(controller.signal)
      .then((rows) => { if (!controller.signal.aborted) setPositions(rows); })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setPositions([]);
        setPositionsError(reason instanceof ApiError ? reason.message : t("Awaiting the perpetual contract backend."));
      })
      .finally(() => { if (!controller.signal.aborted) setPositionsLoading(false); });
    getPerpOpenOrders(controller.signal).then(setOpenOrders).catch(() => { if (!controller.signal.aborted) setOpenOrders([]); });
    getPerpOrderHistory(controller.signal).then(setOrderHistory).catch(() => { if (!controller.signal.aborted) setOrderHistory([]); });
    return () => controller.abort();
  }, [status, reload, submitOk, t]);

  useEffect(() => {
    if (status !== "authenticated" || !symbol || (tab !== "trades" && tab !== "funding")) return;
    const controller = new AbortController();
    setTabLoading(true);
    if (tab === "trades") {
      getPerpTrades(symbol, controller.signal).then(setTrades).catch(() => { if (!controller.signal.aborted) setTrades([]); })
        .finally(() => { if (!controller.signal.aborted) setTabLoading(false); });
    } else {
      getPerpFundingHistory(symbol, controller.signal).then(setFunding).catch(() => { if (!controller.signal.aborted) setFunding([]); })
        .finally(() => { if (!controller.signal.aborted) setTabLoading(false); });
    }
    return () => controller.abort();
  }, [status, symbol, tab, reload]);

  const estimatedMargin = useMemo(() => {
    const qty = Number(quantity);
    const px = orderType === "limit" ? Number(price) : Number(markPrice ?? NaN);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(px) || px <= 0 || effectiveLeverage < 1) return null;
    return (px * qty) / effectiveLeverage;
  }, [quantity, price, orderType, markPrice, effectiveLeverage]);

  async function submitOrder(event: FormEvent) {
    event.preventDefault();
    if (!selectedMarket || busy) return;
    setSubmitError("");
    setSubmitOk("");
    if (orderType === "limit" && (!price || Number(price) <= 0)) { setSubmitError(t("Price")); return; }
    if (!quantity || Number(quantity) <= 0) { setSubmitError(t("Quantity")); return; }
    setBusy(true);
    try {
      const result = await submitPerpOrder({
        symbol: selectedMarket.symbol,
        type: orderType,
        side,
        price: orderType === "limit" ? price.trim() : undefined,
        quantity: quantity.trim(),
        leverage: effectiveLeverage,
        reduceOnly,
        closePosition,
        clientOrderId: window.crypto.randomUUID(),
      });
      setSubmitOk(`${t("Submit")} · ${result.order_id.slice(0, 12)}…`);
      setQuantity("");
      setReload((n) => n + 1);
    } catch (reason: unknown) {
      setSubmitError(reason instanceof Error ? reason.message : t("Awaiting the perpetual contract backend."));
    } finally {
      setBusy(false);
    }
  }

  async function cancelOrder(orderId: string) {
    try {
      await cancelPerpOrder({ orderId, clientCancelId: window.crypto.randomUUID() });
      setReload((n) => n + 1);
    } catch {
      /* keep the row; user can retry */
    }
  }

  async function closePos(posSymbol: string) {
    try {
      await closePerpPosition({ symbol: posSymbol, clientOrderId: window.crypto.randomUUID() });
      setReload((n) => n + 1);
    } catch {
      /* keep the row; user can retry */
    }
  }

  const tabs: Array<[Tab, string]> = [
    ["open", t("Open orders")],
    ["history", t("Order history")],
    ["trades", t("Trade history")],
    ["funding", t("Funding history")],
  ];

  const signedOut = status !== "authenticated";

  // ---- Reusable content blocks (shared between mobile snap segments and desktop grid) ----
  const orderEntryCard = (
    <Card className="border-brand-border bg-brand-surface">
      <CardHeader className="pb-3"><CardTitle>{t("Submit")}</CardTitle><CardDescription>{selectedMarket ? selectedMarket.symbol : t("Contract markets")}</CardDescription></CardHeader>
      <CardContent className="space-y-3.5">
        <label className="block space-y-1.5 text-sm">
          <span className="type-label text-brand-text-muted">{t("Contract markets")}</span>
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)} disabled={marketsLoading || !markets.length} className="field-control">
            {markets.length ? markets.map((m) => <option key={m.symbol} value={m.symbol}>{m.symbol} · {m.status}</option>) : <option value="">{t("Awaiting the perpetual contract backend.")}</option>}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant={orderType === "limit" ? "secondary" : "outline"} aria-pressed={orderType === "limit"} onClick={() => setOrderType("limit")} className="min-h-10">{t("Limit")}</Button>
          <Button type="button" variant={orderType === "market" ? "secondary" : "outline"} aria-pressed={orderType === "market"} onClick={() => setOrderType("market")} className="min-h-10">{t("Market")}</Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant={side === "buy" ? "default" : "outline"} aria-pressed={side === "buy"} onClick={() => setSide("buy")} className="min-h-10"><TrendingUp className="mr-2 h-4 w-4" />{t("Long")}</Button>
          <Button type="button" variant={side === "sell" ? "destructive" : "outline"} aria-pressed={side === "sell"} onClick={() => setSide("sell")} className="min-h-10"><TrendingDown className="mr-2 h-4 w-4" />{t("Short")}</Button>
        </div>

        <div className="space-y-1.5">
          <span className="flex items-center justify-between text-sm"><span className="type-label text-brand-text-muted">{t("Leverage")}</span><span className="font-semibold tabular-nums text-brand-text">{effectiveLeverage}×</span></span>
          <input type="range" min={1} max={maxLeverage} step={1} value={effectiveLeverage} onChange={(e) => setLeverage(Number(e.target.value))} className="leverage-range" aria-label={t("Leverage")} style={{ background: `linear-gradient(to right, #21C7A8 0%, #21C7A8 ${leveragePct}%, #243443 ${leveragePct}%, #243443 100%)` }} />
          <span className="flex justify-between text-[11px] tabular-nums text-brand-text-faint"><span>1×</span><span>{maxLeverage}×</span></span>
        </div>

        {orderType === "limit" ? (
          <label className="block space-y-1.5 text-sm"><span className="type-label text-brand-text-muted">{t("Price")} (USDT)</span>
            <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" className="field-control" />
          </label>
        ) : null}

        <label className="block space-y-1.5 text-sm"><span className="type-label text-brand-text-muted">{t("Quantity")}</span>
          <input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0.00" className="field-control" />
        </label>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm text-brand-text-secondary"><input type="checkbox" checked={reduceOnly} onChange={(e) => setReduceOnly(e.target.checked)} className="h-4 w-4 accent-brand-accent" />{t("Reduce only")}</label>
          <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm text-brand-text-secondary"><input type="checkbox" checked={closePosition} onChange={(e) => setClosePosition(e.target.checked)} className="h-4 w-4 accent-brand-accent" />{t("Close position")}</label>
        </div>

        <div className="summary-row"><span className="label">{t("Estimated margin")}</span><span className="value">{estimatedMargin === null ? "—" : `${money(estimatedMargin, locale)} USDT`}</span></div>

        {submitError ? <p className="inline-alert inline-alert-error" role="alert"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{submitError}</p> : null}
        {submitOk ? <p className="inline-alert inline-alert-success" role="status"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{submitOk}</p> : null}

        <form onSubmit={(e) => void submitOrder(e)}>
          <Button type="submit" variant={side === "buy" ? "default" : "destructive"} className="min-h-12 w-full text-[15px] font-bold" disabled={busy || !selectedMarket || (orderType === "limit" && !price) || !quantity}>
            {busy ? t("Loading…") : side === "buy" ? `${t("Long")} ${selectedMarket?.base_asset ?? ""}` : `${t("Short")} ${selectedMarket?.base_asset ?? ""}`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );

  const positionsBody = (
    positionsLoading ? (
      <div className="space-y-3 p-1" role="status"><div className="skeleton-bar h-24 w-full" /><div className="skeleton-bar h-24 w-full" /></div>
    ) : positionsError ? (
      <p className="p-4 text-sm text-brand-warning" role="alert">{positionsError}</p>
    ) : positions.length === 0 ? (
      <EmptyState title={t("No open positions.")} hint={t("Open a position from the order form and it will appear here.")} />
    ) : (
      <div className="space-y-3">
        {positions.map((pos) => {
          const upnl = pnl(pos.unrealized_pnl, locale);
          const rpnl = pnl(pos.realized_pnl, locale);
          return (
            <div key={pos.position_id} className="rounded-xl border border-brand-border bg-brand-surface-2/40 p-3.5 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-brand-text">{pos.symbol}</span>
                {sideBadge(pos.side, t)}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 sm:grid-cols-3">
                <div><p className="text-[11px] uppercase tracking-wide text-brand-text-muted">{t("Size")}</p><p className="mt-0.5 tabular-nums text-brand-text-secondary">{money(pos.quantity, locale, 6)}</p></div>
                <div><p className="text-[11px] uppercase tracking-wide text-brand-text-muted">{t("Entry price")}</p><p className="mt-0.5 tabular-nums text-brand-text-secondary">{money(pos.entry_price, locale)}</p></div>
                <div><p className="text-[11px] uppercase tracking-wide text-brand-text-muted">{t("Mark price")}</p><p className="mt-0.5 tabular-nums text-brand-text-secondary">{money(pos.mark_price, locale)}</p></div>
                <div><p className="text-[11px] uppercase tracking-wide text-brand-text-muted">{t("Liquidation price")}</p><p className="mt-0.5 tabular-nums text-brand-text-secondary">{money(pos.liquidation_price, locale)}</p></div>
                <div><p className="text-[11px] uppercase tracking-wide text-brand-text-muted">{t("Isolated margin")}</p><p className="mt-0.5 tabular-nums text-brand-text-secondary">{money(pos.isolated_margin, locale)}</p></div>
                <div><p className="text-[11px] uppercase tracking-wide text-brand-text-muted">{t("Unrealized PnL")}</p><p className={`mt-0.5 font-semibold tabular-nums ${upnl.className}`}>{upnl.text}</p></div>
                <div className="col-span-2 border-t border-brand-border-subtle pt-2.5 sm:col-span-3"><p className="text-[11px] uppercase tracking-wide text-brand-text-muted">{t("Realized PnL")}</p><p className={`mt-0.5 font-semibold tabular-nums ${rpnl.className}`}>{rpnl.text}</p></div>
              </div>
              <Button size="sm" variant="outline" className="mt-3 min-h-10 w-full" onClick={() => void closePos(pos.symbol)}>{t("Close position")}</Button>
            </div>
          );
        })}
      </div>
    )
  );

  const positionsCard = (
    <Card className="border-brand-border bg-brand-surface">
      <CardHeader className="pb-3"><CardTitle>{t("Position")}</CardTitle><CardDescription>{positionsLoading ? t("Loading…") : positionsError ? positionsError : `${positions.length} ${t("Open positions").toLowerCase()}`}</CardDescription></CardHeader>
      <CardContent>{positionsBody}</CardContent>
    </Card>
  );

  const openOrdersBody = (
    positionsLoading ? <TableSkeleton /> : openOrders.length === 0 ? (
      <EmptyState title={t("No open orders")} hint={t("Open orders will appear here once submitted and before they fill.")} />
    ) : (
      <div className="table-scroll"><table className="data-table">
        <thead><tr><th>{t("Symbol")}</th><th>{t("Type")}</th><th>{t("Side")}</th><th className="num">{t("Price")}</th><th className="num">{t("Quantity")}</th><th className="num">{t("Leverage")}</th><th>{t("Status")}</th><th className="num">{t("Action")}</th></tr></thead>
        <tbody>{openOrders.map((o) => (
          <tr key={o.order_id}>
            <td className="font-semibold text-brand-text">{o.symbol}</td>
            <td className="uppercase">{o.type}</td>
            <td>{sideBadge(o.side, t)}</td>
            <td className="num">{money(o.price, locale)}</td>
            <td className="num">{money(o.quantity, locale, 6)}</td>
            <td className="num">{o.leverage}×</td>
            <td><span className="text-xs text-brand-text-muted">{o.reduceOnly ? `${t("Reduce only")} · ` : ""}{o.status}</span></td>
            <td className="num"><Button size="sm" variant="outline" className="min-h-10 px-2.5 text-xs" onClick={() => void cancelOrder(o.order_id)}><X className="mr-1 h-3.5 w-3.5" />{t("Cancel")}</Button></td>
          </tr>
        ))}</tbody>
      </table></div>
    )
  );

  // Mobile segment 3: Positions & Open orders sub-tabs.
  const mobilePositionsAndOrders = (
    <Card className="border-brand-border bg-brand-surface">
      <CardHeader className="pb-0">
        <div className="flex gap-1 border-b border-brand-border" role="tablist" aria-label={t("Positions")}>
          {([["positions", t("Positions")], ["open", t("Open orders")]] as const).map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={mobileSegTab === key} onClick={() => setMobileSegTab(key)}
              className={cn("relative min-h-10 px-3.5 text-sm font-semibold transition-colors", mobileSegTab === key ? "text-brand-text" : "text-brand-text-muted hover:text-brand-text-secondary")}>
              {label}
              {mobileSegTab === key ? <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-violet" /> : null}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="pt-3">{mobileSegTab === "positions" ? positionsBody : openOrdersBody}</CardContent>
    </Card>
  );

  const statsStrip = (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      <div className="rounded-lg bg-brand-surface-2/70 p-3"><p className="text-[11px] uppercase tracking-wide text-brand-text-muted">{t("Mark price")}</p><p className="mt-1 font-semibold tabular-nums text-brand-text">{money(markPrice, locale)}</p></div>
      <div className="rounded-lg bg-brand-surface-2/70 p-3"><p className="text-[11px] uppercase tracking-wide text-brand-text-muted">{t("Index price")}</p><p className="mt-1 font-semibold tabular-nums text-brand-text">{money(indexPrice, locale)}</p></div>
      <div className="rounded-lg bg-brand-surface-2/70 p-3"><p className="text-[11px] uppercase tracking-wide text-brand-text-muted">{t("Funding rate")}</p><p className="mt-1 font-semibold tabular-nums text-brand-text">{selectedMarket?.funding_rate_cap ? `≤${Number(selectedMarket.funding_rate_cap * 100).toLocaleString(locale, { maximumFractionDigits: 3 })}%` : "—"}</p></div>
      <div className="rounded-lg bg-brand-surface-2/70 p-3"><p className="text-[11px] uppercase tracking-wide text-brand-text-muted">{t("Leverage")}</p><p className="mt-1 font-semibold tabular-nums text-brand-text">1–{maxLeverage}×</p></div>
    </div>
  );

  const [mobileTradeTab, setMobileTradeTab] = useState(0);

  return (
    <>
      <TradeProductNav />
      <div className="mx-auto flex w-full max-w-[1520px] min-w-0 flex-col gap-4 p-3 pb-32 sm:gap-5 sm:p-4 md:p-6 lg:p-8 lg:pb-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link to="/trade-hub" className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-brand-text-muted transition-colors hover:text-brand-text">
              <ChevronLeft className="h-3.5 w-3.5" />{t("Trade hub")}
            </Link>
            <p className="mb-1 text-xs font-bold uppercase tracking-[.18em] text-brand-text-secondary">{t("BTCBOX / TRADE")}</p>
            <h1 className="type-page-title text-brand-text">{t("Perpetual")}</h1>
            <p className="type-body mt-2 max-w-2xl text-brand-text-secondary">{t("Perpetual contract trading")} · {selectedMarket ? `${selectedMarket.symbol} · ${t("Leverage")} 1–${selectedMarket.max_leverage}×` : t("Awaiting the perpetual contract backend.")}</p>
          </div>
          <Button variant="outline" size="sm" className="min-h-10" onClick={() => setReload((n) => n + 1)}>
            <RefreshCw className={"mr-2 h-4 w-4 " + (marketsLoading || positionsLoading ? "animate-spin" : "")} />{t("Refresh")}
          </Button>
        </div>

        {marketsError ? (
          <Card className="border-brand-warning/30 bg-brand-surface"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-5"><p className="text-sm text-brand-warning" role="alert">{marketsError}</p><Button size="sm" variant="outline" onClick={() => setReload((n) => n + 1)}>{t("Try again")}</Button></CardContent></Card>
        ) : null}

        {signedOut ? (
          <Card className="border-brand-border bg-brand-surface"><CardContent className="p-5 text-sm text-brand-text-muted">{t("Sign in to view")}</CardContent></Card>
        ) : null}

        {statsStrip}

        {/* Mobile: explicit tab switcher (order entry / depth / positions+orders) — a genuinely
            different interaction paradigm from the desktop multi-column grid below.
            K-line remains the bottom drawer (tap to expand). */}
        <div className="md:hidden">
          <div role="tablist" aria-label={t("Order entry, market depth and positions")} className="mb-3 flex gap-1 rounded-xl border border-brand-border bg-brand-surface-2/60 p-1">
            {[t("Submit"), t("Order book"), t("Position")].map((label, i) => (
              <button
                key={label}
                role="tab"
                aria-selected={mobileTradeTab === i}
                type="button"
                onClick={() => setMobileTradeTab(i)}
                className={"min-h-10 flex-1 rounded-lg px-2 text-[13px] font-semibold transition-colors " + (mobileTradeTab === i ? "bg-brand-surface text-brand-text shadow-sm" : "text-brand-text-muted hover:text-brand-text-secondary")}
              >
                {label}
              </button>
            ))}
          </div>
          <div>{[orderEntryCard, <OrderBookDepth mid={depthMid} />, mobilePositionsAndOrders][mobileTradeTab]}</div>
        </div>
        <div className="hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-3">
          {orderEntryCard}
          <OrderBookDepth mid={depthMid} />
          <div className="md:col-span-2 lg:col-span-1">{positionsCard}</div>
        </div>

        {/* Tabs: open orders / order history / trade history / funding history */}
        <Card className="border-brand-border bg-brand-surface">
          <CardHeader className="pb-0">
            <div className="flex flex-wrap gap-1 border-b border-brand-border pb-0" role="tablist" aria-label={t("Contract markets")}>
              {tabs.map(([key, label]) => (
                <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
                  className={`relative min-h-10 px-3.5 text-sm font-semibold transition-colors ${tab === key ? "text-brand-text" : "text-brand-text-muted hover:text-brand-text-secondary"}`}>
                  {label}
                  {tab === key ? <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-accent" /> : null}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            {signedOut ? (
              <EmptyState title={t("Sign in to view")} hint={t("Order, trade and funding history requires an authenticated account.")} />
            ) : tab === "open" ? (
              openOrdersBody
            ) : tab === "history" ? (
              positionsLoading ? <TableSkeleton /> : orderHistory.length === 0 ? (
                <EmptyState title={t("No order history")} hint={t("Filled and cancelled orders will appear here.")} />
              ) : (
                <div className="table-scroll"><table className="data-table">
                  <thead><tr><th>{t("Symbol")}</th><th>{t("Type")}</th><th>{t("Side")}</th><th className="num">{t("Price")}</th><th className="num">{t("Quantity")}</th><th>{t("Status")}</th><th>{t("Time")}</th></tr></thead>
                  <tbody>{orderHistory.map((o) => (
                    <tr key={o.order_id}>
                      <td className="font-semibold text-brand-text">{o.symbol}</td>
                      <td className="uppercase">{o.type}</td>
                      <td>{sideBadge(o.side, t)}</td>
                      <td className="num">{money(o.price, locale)}</td>
                      <td className="num">{money(o.quantity, locale, 6)}</td>
                      <td><span className="text-xs text-brand-text-muted">{o.status}</span></td>
                      <td className="text-xs text-brand-text-muted">{o.created_at ?? "—"}</td>
                    </tr>
                  ))}</tbody>
                </table></div>
              )
            ) : tab === "trades" ? (
              tabLoading ? <TableSkeleton /> : trades.length === 0 ? (
                <EmptyState title={t("No trades yet")} hint={t("Your executed trades for this market will appear here.")} />
              ) : (
                <div className="table-scroll"><table className="data-table">
                  <thead><tr><th>{t("Side")}</th><th className="num">{t("Price")}</th><th className="num">{t("Quantity")}</th><th>{t("Time")}</th></tr></thead>
                  <tbody>{trades.map((tr) => (
                    <tr key={tr.trade_id}>
                      <td>{sideBadge(tr.side, t)}</td>
                      <td className="num">{money(tr.price, locale)}</td>
                      <td className="num">{money(tr.quantity, locale, 6)}</td>
                      <td className="text-xs text-brand-text-muted">{tr.created_at ?? "—"}</td>
                    </tr>
                  ))}</tbody>
                </table></div>
              )
            ) : (
              tabLoading ? <TableSkeleton /> : funding.length === 0 ? (
                <EmptyState title={t("No funding payments yet")} hint={t("Funding payments are settled periodically and will appear here.")} />
              ) : (
                <div className="table-scroll"><table className="data-table">
                  <thead><tr><th>{t("Time")}</th><th className="num">{t("Funding rate")}</th><th className="num">{t("Mark price")}</th><th className="num">{t("Funding payment")}</th></tr></thead>
                  <tbody>{funding.map((f, i) => {
                    const pay = pnl(f.payment, locale, 6);
                    return (
                      <tr key={`${f.funding_at}-${i}`}>
                        <td className="text-xs text-brand-text-muted">{f.funding_at}</td>
                        <td className="num">{money(f.funding_rate, locale, 6)}</td>
                        <td className="num">{money(f.mark_price, locale)}</td>
                        <td className={`num font-semibold ${pay.className}`}>{pay.text}</td>
                      </tr>
                    );
                  })}</tbody>
                </table></div>
              )
            )}
          </CardContent>
        </Card>
      </div>

      <ChartDrawer symbol={selectedMarket?.symbol ?? "BTC/USDT"} />
    </>
  );
}
