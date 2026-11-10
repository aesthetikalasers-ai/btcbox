import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeftRight, RefreshCw, TrendingUp, TrendingDown, X } from "lucide-react";
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

type Tab = "open" | "history" | "trades" | "funding";

function money(value: number | string | null | undefined, locale: string, digits = 4) {
  if (value === undefined || value === null || value === "") return "—";
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(locale, { maximumFractionDigits: digits });
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
  const [tab, setTab] = useState<Tab>("open");
  const [reload, setReload] = useState(0);

  const selectedMarket = useMemo(() => markets.find((m) => m.symbol === symbol) ?? markets[0], [markets, symbol]);
  const maxLeverage = selectedMarket?.max_leverage ?? 1;
  const effectiveLeverage = Math.min(leverage, maxLeverage);
  const markPrice = selectedMarket?.mark_price ?? null;
  const indexPrice = selectedMarket?.index_price ?? null;

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
  }, [reload]);

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
  }, [status, reload, submitOk]);

  useEffect(() => {
    if (status !== "authenticated" || !symbol || (tab !== "trades" && tab !== "funding")) return;
    const controller = new AbortController();
    if (tab === "trades") {
      getPerpTrades(symbol, controller.signal).then(setTrades).catch(() => { if (!controller.signal.aborted) setTrades([]); });
    } else {
      getPerpFundingHistory(symbol, controller.signal).then(setFunding).catch(() => { if (!controller.signal.aborted) setFunding([]); });
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

  return (
    <div className="mx-auto flex w-full max-w-[1520px] min-w-0 flex-col gap-5 p-3 sm:p-4 md:p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[.18em] text-brand-text-secondary">{t("BTCBOX / TRADE")}</p>
          <h1 className="type-page-title text-brand-text">{t("Perpetual")}</h1>
          <p className="type-body mt-2 max-w-2xl text-brand-text-secondary">{t("Perpetual contract trading")} · {selectedMarket ? `${selectedMarket.symbol} · ${t("Leverage")} 1–${selectedMarket.max_leverage}×` : t("Awaiting the perpetual contract backend.")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setReload((n) => n + 1)}>
          <RefreshCw className={"mr-2 h-4 w-4 " + (marketsLoading || positionsLoading ? "animate-spin" : "")} />{t("Refresh")}
        </Button>
      </div>

      {marketsError ? (
        <Card className="border-brand-warning/30 bg-brand-surface"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-5"><p className="text-sm text-brand-warning" role="alert">{marketsError}</p><Button size="sm" variant="outline" onClick={() => setReload((n) => n + 1)}>{t("Try again")}</Button></CardContent></Card>
      ) : null}

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(280px,22%)_minmax(0,1fr)_minmax(320px,34%)]">
        {/* Left: order entry */}
        <Card className="border-brand-border bg-brand-surface">
          <CardHeader><CardTitle>{t("Submit")}</CardTitle><CardDescription>{selectedMarket ? selectedMarket.symbol : t("Contract markets")}</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <label className="block space-y-1 text-sm"><span className="text-brand-text-muted">{t("Contract markets")}</span>
              <select value={symbol} onChange={(e) => setSymbol(e.target.value)} disabled={marketsLoading || !markets.length} className="h-12 w-full rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-3 text-sm text-brand-text outline-none focus:border-brand-accent/60 focus:ring-2 focus:ring-brand-accent/15">
                {markets.length ? markets.map((m) => <option key={m.symbol} value={m.symbol}>{m.symbol} · {m.status}</option>) : <option value="">{t("Awaiting the perpetual contract backend.")}</option>}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={orderType === "limit" ? "secondary" : "outline"} aria-pressed={orderType === "limit"} onClick={() => setOrderType("limit")}>{t("Limit")}</Button>
              <Button type="button" variant={orderType === "market" ? "secondary" : "outline"} aria-pressed={orderType === "market"} onClick={() => setOrderType("market")}>{t("Market")}</Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={side === "buy" ? "default" : "outline"} aria-pressed={side === "buy"} onClick={() => setSide("buy")}><TrendingUp className="mr-2 h-4 w-4" />{t("Long")}</Button>
              <Button type="button" variant={side === "sell" ? "destructive" : "outline"} aria-pressed={side === "sell"} onClick={() => setSide("sell")}><TrendingDown className="mr-2 h-4 w-4" />{t("Short")}</Button>
            </div>
            <label className="block space-y-1.5 text-sm">
              <span className="flex items-center justify-between text-brand-text-muted"><span>{t("Leverage")}</span><span className="font-semibold tabular-nums text-brand-text">{effectiveLeverage}×</span></span>
              <input type="range" min={1} max={maxLeverage} step={1} value={effectiveLeverage} onChange={(e) => setLeverage(Number(e.target.value))} className="w-full accent-brand-accent" aria-label={t("Leverage")} />
            </label>
            {orderType === "limit" ? (
              <label className="block space-y-1 text-sm"><span className="text-brand-text-muted">{t("Price")} (USDT)</span>
                <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" className="h-12 w-full rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-3 text-sm text-brand-text outline-none placeholder:text-brand-text-muted focus:border-brand-accent/60 focus:ring-2 focus:ring-brand-accent/15" />
              </label>
            ) : null}
            <label className="block space-y-1 text-sm"><span className="text-brand-text-muted">{t("Quantity")}</span>
              <input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0.00" className="h-12 w-full rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-3 text-sm text-brand-text outline-none placeholder:text-brand-text-muted focus:border-brand-accent/60 focus:ring-2 focus:ring-brand-accent/15" />
            </label>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="flex items-center gap-2 text-brand-text-secondary"><input type="checkbox" checked={reduceOnly} onChange={(e) => setReduceOnly(e.target.checked)} className="h-4 w-4 accent-brand-accent" />{t("Reduce only")}</label>
              <label className="flex items-center gap-2 text-brand-text-secondary"><input type="checkbox" checked={closePosition} onChange={(e) => setClosePosition(e.target.checked)} className="h-4 w-4 accent-brand-accent" />{t("Close position")}</label>
            </div>
            <p className="text-sm text-brand-text-muted">{t("Estimated margin")}: <strong className="tabular-nums text-brand-text">{estimatedMargin === null ? "—" : money(estimatedMargin, locale)} USDT</strong></p>
            {submitError ? <p className="break-all text-xs text-brand-danger" role="alert">{submitError}</p> : null}
            {submitOk ? <p className="break-all text-xs text-brand-success">{submitOk}</p> : null}
            <form onSubmit={(e) => void submitOrder(e)}>
              <Button type="submit" className="w-full" disabled={busy || !selectedMarket || (orderType === "limit" && !price) || !quantity}>
                {busy ? t("Loading…") : side === "buy" ? `${t("Long")} ${selectedMarket?.base_asset ?? ""}` : `${t("Short")} ${selectedMarket?.base_asset ?? ""}`}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Center: chart placeholder + mark/index price */}
        <Card className="border-brand-border bg-brand-surface">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div><CardTitle>{selectedMarket ? `${selectedMarket.symbol} · ${t("Perpetual")}` : t("Perpetual")}</CardTitle><CardDescription>{t("Awaiting the perpetual contract feed.")}</CardDescription></div>
            <Badge variant="outline">{selectedMarket?.status ?? t("Unavailable")}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-dashed border-brand-border bg-brand-surface-2/40 p-6 text-center text-sm text-brand-text-muted" role="status" aria-live="polite">
              <div className="space-y-2">
                <ArrowLeftRight className="mx-auto h-6 w-6 opacity-50" />
                <p>{t("Awaiting the perpetual contract feed.")}</p>
                <p className="text-xs">No synthetic chart data is shown. The candlestick feed will render when the backend perpetual market feed is enabled.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div className="rounded-lg bg-brand-surface-2/70 p-3"><p className="text-xs text-brand-text-muted">{t("Mark price")}</p><p className="mt-1 font-semibold tabular-nums">{money(markPrice, locale)}</p></div>
              <div className="rounded-lg bg-brand-surface-2/70 p-3"><p className="text-xs text-brand-text-muted">{t("Index price")}</p><p className="mt-1 font-semibold tabular-nums">{money(indexPrice, locale)}</p></div>
              <div className="rounded-lg bg-brand-surface-2/70 p-3"><p className="text-xs text-brand-text-muted">{t("Funding rate")}</p><p className="mt-1 font-semibold tabular-nums">{selectedMarket?.funding_rate_cap ? `≤${Number(selectedMarket.funding_rate_cap * 100).toLocaleString(locale, { maximumFractionDigits: 3 })}%` : "—"}</p></div>
              <div className="rounded-lg bg-brand-surface-2/70 p-3"><p className="text-xs text-brand-text-muted">{t("Leverage")}</p><p className="mt-1 font-semibold tabular-nums">1–{maxLeverage}×</p></div>
            </div>
          </CardContent>
        </Card>

        {/* Right: positions table */}
        <Card className="border-brand-border bg-brand-surface">
          <CardHeader><CardTitle>{t("Position")}</CardTitle><CardDescription>{positionsLoading ? t("Loading…") : positionsError ? positionsError : `${positions.length} ${t("Open positions").toLowerCase()}`}</CardDescription></CardHeader>
          <CardContent>
            {positionsLoading ? <p className="p-4 text-sm text-brand-text-muted" role="status">{t("Loading…")}</p>
              : positionsError ? <p className="p-4 text-sm text-brand-warning">{positionsError}</p>
              : positions.length === 0 ? <p className="p-4 text-sm text-brand-text-muted">{t("No open positions.")}</p>
              : <div className="space-y-3">
                {positions.map((pos) => (
                  <div key={pos.position_id} className="rounded-xl border border-brand-border bg-brand-surface-2/40 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">{pos.symbol}</span>
                      <Badge variant="outline" className={pos.side === "long" ? "border-brand-success/30 text-brand-success" : "border-brand-danger/30 text-brand-danger"}>{pos.side === "long" ? t("Long") : t("Short")}</Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs sm:grid-cols-3">
                      <div><p className="text-brand-text-muted">{t("Size")}</p><p className="tabular-nums">{money(pos.quantity, locale, 6)}</p></div>
                      <div><p className="text-brand-text-muted">{t("Entry price")}</p><p className="tabular-nums">{money(pos.entry_price, locale)}</p></div>
                      <div><p className="text-brand-text-muted">{t("Mark price")}</p><p className="tabular-nums">{money(pos.mark_price, locale)}</p></div>
                      <div><p className="text-brand-text-muted">{t("Liquidation price")}</p><p className="tabular-nums">{money(pos.liquidation_price, locale)}</p></div>
                      <div><p className="text-brand-text-muted">{t("Isolated margin")}</p><p className="tabular-nums">{money(pos.isolated_margin, locale)}</p></div>
                      <div><p className="text-brand-text-muted">{t("Unrealized PnL")}</p><p className={"tabular-nums " + (Number(pos.unrealized_pnl ?? 0) > 0 ? "text-brand-success" : Number(pos.unrealized_pnl ?? 0) < 0 ? "text-brand-danger" : "")}>{money(pos.unrealized_pnl, locale)}</p></div>
                      <div><p className="text-brand-text-muted">{t("Realized PnL")}</p><p className={"tabular-nums " + (Number(pos.realized_pnl) > 0 ? "text-brand-success" : Number(pos.realized_pnl) < 0 ? "text-brand-danger" : "")}>{money(pos.realized_pnl, locale)}</p></div>
                    </div>
                    <Button size="sm" variant="outline" className="mt-3 min-h-9" onClick={() => void closePos(pos.symbol)}>{t("Close position")}</Button>
                  </div>
                ))}
              </div>}
          </CardContent>
        </Card>
      </div>

      {/* Tabs: open orders / order history / trade history / funding history */}
      <Card className="border-brand-border bg-brand-surface">
        <CardHeader>
          <div className="flex flex-wrap gap-1" role="tablist" aria-label={t("Contract markets")}>
            {tabs.map(([key, label]) => (
              <Button key={key} type="button" size="sm" variant={tab === key ? "secondary" : "ghost"} aria-pressed={tab === key} onClick={() => setTab(key)}>{label}</Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {tab === "open" ? (
            openOrders.length === 0 ? <p className="p-4 text-sm text-brand-text-muted">{t("No orders returned")}</p>
            : <div className="space-y-2">
              {openOrders.map((o) => (
                <div key={o.order_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-border bg-brand-surface-2/40 p-3 text-sm">
                  <div className="min-w-0 space-y-0.5">
                    <span className="font-semibold">{o.symbol} · {o.type} · {o.side === "buy" ? t("Long") : t("Short")} · {o.leverage}×</span>
                    <p className="text-xs text-brand-text-muted tabular-nums">{t("Price")}: {money(o.price, locale)} · {t("Quantity")}: {money(o.quantity, locale, 6)} · {o.reduceOnly ? t("Reduce only") + " · " : ""}{o.status}</p>
                  </div>
                  <Button size="sm" variant="outline" className="min-h-9" onClick={() => void cancelOrder(o.order_id)}><X className="mr-1 h-3.5 w-3.5" />{t("Cancel")}</Button>
                </div>
              ))}
            </div>
          ) : tab === "history" ? (
            orderHistory.length === 0 ? <p className="p-4 text-sm text-brand-text-muted">{t("No orders returned")}</p>
            : <div className="space-y-2">
              {orderHistory.map((o) => (
                <div key={o.order_id} className="rounded-lg border border-brand-border bg-brand-surface-2/40 p-3 text-sm">
                  <span className="font-semibold">{o.symbol} · {o.type} · {o.side === "buy" ? t("Long") : t("Short")}</span>
                  <p className="mt-1 text-xs text-brand-text-muted tabular-nums">{t("Price")}: {money(o.price, locale)} · {t("Quantity")}: {money(o.quantity, locale, 6)} · {o.status} · {o.created_at ?? "—"}</p>
                </div>
              ))}
            </div>
          ) : tab === "trades" ? (
            trades.length === 0 ? <p className="p-4 text-sm text-brand-text-muted">{t("No orders returned")}</p>
            : <div className="space-y-2">
              {trades.map((tr) => (
                <div key={tr.trade_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-border bg-brand-surface-2/40 p-3 text-sm">
                  <span className="font-semibold">{tr.side === "buy" ? t("Long") : t("Short")}</span>
                  <span className="text-xs text-brand-text-muted tabular-nums">{t("Price")}: {money(tr.price, locale)} · {t("Quantity")}: {money(tr.quantity, locale, 6)} · {tr.created_at ?? "—"}</span>
                </div>
              ))}
            </div>
          ) : (
            funding.length === 0 ? <p className="p-4 text-sm text-brand-text-muted">{t("No orders returned")}</p>
            : <div className="space-y-2">
              {funding.map((f, i) => (
                <div key={`${f.funding_at}-${i}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-border bg-brand-surface-2/40 p-3 text-sm">
                  <span className="text-xs text-brand-text-muted">{f.funding_at}</span>
                  <span className="text-xs tabular-nums">{t("Funding rate")}: {money(f.funding_rate, locale, 6)} · {t("Mark price")}: {money(f.mark_price, locale)} · {t("Realized PnL")}: {money(f.payment, locale)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
