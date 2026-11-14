import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@radix-ui/react-dialog";
import { AlertCircle, BarChart3, CheckCircle2, Inbox, Minus, Plus, RefreshCw, TrendingDown, TrendingUp, TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { EmptyState } from "../../components/ui/empty-state";
import { TableSkeleton } from "../../components/ui/loading";
import { Select } from "../../components/ui/select";
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
import { useMarketStream } from "../../lib/useMarketStream";
import { localeTags, useI18n } from "../../lib/i18n";
import { TradeProductNav } from "../trade/TradeProductNav";
import { PositionRiskPanel } from "../trade/PositionRiskPanel";
import { TradesPanel } from "../trade/TradesPanel";
import { useMarketStreamEvent } from "../../lib/useMarketStreamEvent";
import { OrderBookDepth } from "../trade/OrderBookDepth";
import { ChartDrawer } from "../trade/ChartDrawer";
import { cn } from "../../lib/utils";

type Tab = "open" | "history" | "trades" | "funding";
type MobileSegment = "order" | "book" | "positions";

const EM_DASH = "—";

/**
 * Decimal-safe arithmetic helpers. JavaScript binary floating point makes
 * `0.1 + 0.2 === 0.30000000000000004`; for financial math (price × quantity,
 * percentage allocations, margin) we round to a sane number of decimals after
 * each operation so the UI never renders `0.30000000000000004`-style artefacts.
 */
function roundTo(value: number, decimals = 8): number {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Multiply two decimals with fixed-point precision (fixes 0.1 * 0.2 drift). */
function mul(a: number, b: number): number {
  const aDec = (String(a).split(".")[1] || "").length;
  const bDec = (String(b).split(".")[1] || "").length;
  const factor = 10 ** Math.max(aDec, bDec);
  return (Math.round(a * factor) * Math.round(b * factor)) / factor ** 2;
}

/** Safe division that never returns Infinity/NaN. */
function div(a: number, b: number): number {
  if (!Number.isFinite(b) || b === 0) return 0;
  return a / b;
}

/**
 * Sanitise a decimal input string: strips anything that is not a digit or a
 * single decimal point, collapses extra dots, and clamps the fractional digits
 * to the market's precision (price_tick / quantity_step). Used on every
 * keystroke so invalid characters never enter state.
 */
function sanitizeDecimal(raw: string, maxDecimals: number): string {
  let value = raw.replace(/[^0-9.]/g, "");
  const firstDot = value.indexOf(".");
  if (firstDot !== -1) {
    value = value.slice(0, firstDot + 1) + value.slice(firstDot + 1).replace(/\./g, "");
  }
  if (maxDecimals >= 0) {
    const dot = value.indexOf(".");
    if (dot !== -1) value = value.slice(0, dot + 1 + maxDecimals);
  }
  return value;
}

/** Number of decimal places implied by a tick/step string, e.g. "0.01" -> 2. */
function decimalsFromTick(tick: string | number | null | undefined): number {
  const num = Number(tick);
  if (!Number.isFinite(num) || num <= 0) return -1; // -1 = no limit
  const str = String(tick);
  const dot = str.indexOf(".");
  return dot === -1 ? 0 : str.length - dot - 1;
}

/** Locale-aware numeric display; always renders an em dash instead of a fake zero. */
function money(value: number | string | null | undefined, locale: string, digits = 4) {
  if (value === undefined || value === null || value === "") return EM_DASH;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return EM_DASH;
  return num.toLocaleString(locale, { maximumFractionDigits: digits });
}

/** Signed PnL: explicit + / - prefix (colour-blind safe) plus a semantic colour class. */
function pnl(value: number | string | null | undefined, locale: string, digits = 4) {
  const num = typeof value === "number" ? value : Number(value);
  if (value === undefined || value === null || value === "" || !Number.isFinite(num)) {
    return { text: EM_DASH, className: "text-brand-text-muted" };
  }
  if (num > 0) return { text: `+${money(num, locale, digits)}`, className: "text-profit" };
  if (num < 0) return { text: money(num, locale, digits), className: "text-loss" };
  return { text: money(num, locale, digits), className: "text-brand-text-muted" };
}

function sideBadge(side: string, t: (value: string) => string) {
  const long = side === "buy" || side === "long";
  return (
    <Badge variant="outline" className={long ? "border-brand-success/30 bg-brand-success/10 font-bold text-brand-success" : "border-brand-danger/30 bg-brand-danger/10 font-bold text-brand-danger"}>
      {long ? t("Long") : t("Short")}
    </Badge>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0 bg-brand-surface px-3 py-2.5 sm:px-4">
      <dt className="truncate text-[11px] font-medium text-brand-text-muted">{label}</dt>
      <dd className={cn("bf-tabular mt-0.5 truncate font-mono text-[13px] font-semibold sm:text-sm", tone ?? "text-brand-text")}>{value}</dd>
    </div>
  );
}


export function ContractPage() {
  const { t, language } = useI18n();
  const { status } = useAuth();
  const { getTicker } = useMarketStream();
  const locale = localeTags[language];
  const [markets, setMarkets] = useState<PerpMarket[]>([]);
  const [marketsLoading, setMarketsLoading] = useState(true);
  const [marketsError, setMarketsError] = useState("");
  const [symbol, setSymbol] = useState("");
  const [orderType, setOrderType] = useState<"market" | "limit">("limit");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [leverage, setLeverage] = useState(10);
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reduceOnly, setReduceOnly] = useState(false);
  const [closePosition, setClosePosition] = useState(false);
  const [marginMode, setMarginMode] = useState<"cross" | "isolated">("cross");
  const [leveragePills, setLeveragePills] = useState<10 | 20 | 50 | 100>(10);
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
  const [mobileSegTab, setMobileSegTab] = useState<"positions" | "open">("positions");
  const [mobileSegment, setMobileSegment] = useState<MobileSegment>("order");
  const [dialogOpen, setDialogOpen] = useState(false);

  const selectedMarket = useMemo(() => markets.find((m) => m.symbol === symbol) ?? markets[0], [markets, symbol]);
  const maxLeverage = selectedMarket?.max_leverage ?? 1;
  const effectiveLeverage = Math.min(leveragePills, maxLeverage);
  const markPrice = selectedMarket?.mark_price ?? null;
  const indexPrice = selectedMarket?.index_price ?? null;
  const depthMid = markPrice !== null && Number(markPrice) > 0 ? Number(markPrice) : undefined;

  // The perpetual page shows the same underlying book as the spot pair, so the
  // stream is only opened when the contract symbol is a valid spot symbol.
  const streamSymbol = /^[A-Z0-9]{5,20}USDT$/.test(symbol) ? symbol : "";
  const liveDepth = useMarketStreamEvent<{ bids: [string, string][]; asks: [string, string][] }>({
    channel: "depth",
    symbol: streamSymbol,
    enabled: streamSymbol !== "",
    parse: (payload) => {
      const b = payload as { ok?: boolean; bids?: unknown; asks?: unknown } | null;
      if (!b || b.ok !== true || !Array.isArray(b.bids) || !Array.isArray(b.asks)) return null;
      const norm = (rows: unknown[]): [string, string][] => rows
        .filter((row): row is [string | number, string | number] => Array.isArray(row) && row.length >= 2 && Number(row[0]) > 0 && Number(row[1]) > 0)
        .map((row) => [String(row[0]), String(row[1])]);
      const bids = norm(b.bids);
      const asks = norm(b.asks);
      return bids.length && asks.length ? { bids, asks } : null;
    },
  });

  const fundingRatePct = selectedMarket?.funding_rate_cap !== undefined && selectedMarket.funding_rate_cap !== null
    ? `${(Number(selectedMarket.funding_rate_cap) * 100).toFixed(4)}%`
    : EM_DASH;

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
    if (status !== "authenticated") {
      setPositions([]);
      setOpenOrders([]);
      setOrderHistory([]);
      setPositionsError("");
      setPositionsLoading(false);
      return;
    }
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
    getPerpOpenOrders(controller.signal).then((rows) => { if (!controller.signal.aborted) setOpenOrders(rows); }).catch(() => { if (!controller.signal.aborted) setOpenOrders([]); });
    getPerpOrderHistory(controller.signal).then((rows) => { if (!controller.signal.aborted) setOrderHistory(rows); }).catch(() => { if (!controller.signal.aborted) setOrderHistory([]); });
    return () => controller.abort();
  }, [status, reload, submitOk, t]);

  useEffect(() => {
    if (status !== "authenticated" || !symbol || (tab !== "trades" && tab !== "funding")) return;
    const controller = new AbortController();
    setTabLoading(true);
    if (tab === "trades") {
      getPerpTrades(symbol, controller.signal).then((rows) => { if (!controller.signal.aborted) setTrades(rows); }).catch(() => { if (!controller.signal.aborted) setTrades([]); })
        .finally(() => { if (!controller.signal.aborted) setTabLoading(false); });
    } else {
      getPerpFundingHistory(symbol, controller.signal).then((rows) => { if (!controller.signal.aborted) setFunding(rows); }).catch(() => { if (!controller.signal.aborted) setFunding([]); })
        .finally(() => { if (!controller.signal.aborted) setTabLoading(false); });
    }
    return () => controller.abort();
  }, [status, symbol, tab, reload]);


  const estimatedMargin = useMemo(() => {
    const qty = Number(quantity);
    const px = orderType === "limit" ? Number(price) : Number(markPrice ?? NaN);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(px) || px <= 0 || effectiveLeverage < 1) return null;
    return roundTo(div(mul(px, qty), effectiveLeverage), 2);
  }, [quantity, price, orderType, markPrice, effectiveLeverage]);

  async function submitOrder(event: FormEvent) {
    event.preventDefault();
    if (!selectedMarket || busy) return;
    setSubmitError("");
    setSubmitOk("");
    if (orderType === "limit" && (!price || Number(price) <= 0)) { setSubmitError(t("Enter a valid price.")); return; }
    if (!quantity || Number(quantity) <= 0) { setSubmitError(t("Enter a valid quantity.")); return; }
    const minQuantity = Number(selectedMarket.min_quantity);
    if (Number.isFinite(minQuantity) && minQuantity > 0 && Number(quantity) < minQuantity) {
      setSubmitError(t("Quantity is below the market minimum."));
      return;
    }
    setBusy(true);
    try {
      // The exchange is the only source of truth for positions. A local
      // "paper" position is never created here: if the request fails the user
      // sees an error, not a position that does not exist server-side.
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
      setSubmitOk(`${t("Order submitted")} — ${result.order_id.slice(0, 12)}`);
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
    } catch { /* surfaced through the next refresh */ }
  }

  async function closePos(posSymbol: string) {
    try {
      await closePerpPosition({ symbol: posSymbol, clientOrderId: window.crypto.randomUUID() });
      setReload((n) => n + 1);
    } catch { /* surfaced through the next refresh */ }
  }

  const tabs: Array<[Tab, string]> = [
    ["open", t("Open orders")],
    ["history", t("Order history")],
    ["trades", t("Trade history")],
    ["funding", t("Funding history")],
  ];

  const signedOut = status !== "authenticated";


  const positionsBody = positionsLoading ? <TableSkeleton rows={2} /> : positionsError ? (
    <p className="p-4 text-sm text-brand-danger" role="alert">{positionsError}</p>
  ) : positions.length === 0 ? (
    <EmptyState icon={Inbox} title={t("No open positions.")} hint={t("Open a position from the order form and it will appear here.")} />
  ) : (
    <div className="space-y-3">
      {positions.map((pos) => {
        const upnl = pnl(pos.unrealized_pnl, locale);
        const rpnl = pos.realized_pnl !== undefined ? pnl(pos.realized_pnl, locale) : null;
        return (
          <div key={pos.position_id} className="space-y-3 rounded-lg border border-brand-border bg-brand-surface-2/50 p-4 text-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-bold text-brand-text">{pos.symbol}</span>
                <span className="rounded border border-brand-border bg-brand-surface px-1.5 py-0.5 font-mono text-[10px] text-brand-text-muted">{pos.leverage || effectiveLeverage}×</span>
              </div>
              {sideBadge(pos.side, t)}
            </div>
            <div className="grid grid-cols-2 gap-2.5 font-mono sm:grid-cols-3">
              <div><span className="block text-[10px] text-brand-text-muted">{t("Size")}</span><span className="bf-tabular font-medium text-brand-text">{money(pos.quantity, locale, 6)}</span></div>
              <div><span className="block text-[10px] text-brand-text-muted">{t("Entry price")}</span><span className="bf-tabular font-medium text-brand-text">{money(pos.entry_price, locale)}</span></div>
              <div><span className="block text-[10px] text-brand-text-muted">{t("Mark price")}</span><span className="bf-tabular font-medium text-brand-text">{money(pos.mark_price, locale)}</span></div>
              <div><span className="block text-[10px] text-brand-text-muted">{t("Liquidation price")}</span><span className="bf-tabular font-medium text-brand-danger">{money(pos.liquidation_price, locale)}</span></div>
              <div><span className="block text-[10px] text-brand-text-muted">{t("Isolated margin")}</span><span className="bf-tabular font-medium text-brand-text">{money(pos.isolated_margin, locale)} USDT</span></div>
              <div><span className="block text-[10px] text-brand-text-muted">{t("Unrealized PnL")}</span><span className={cn("bf-tabular font-bold", upnl.className)}>{upnl.text} USDT</span></div>
            </div>
            {rpnl ? (
              <div className="flex items-center justify-between border-t border-brand-border/40 pt-2 font-mono">
                <span className="text-[10px] text-brand-text-muted">{t("Realized PnL")}</span>
                <span className={cn("bf-tabular font-bold", rpnl.className)}>{rpnl.text} USDT</span>
              </div>
            ) : null}
            <Button size="sm" variant="outline" className="h-10 w-full border-brand-danger/40 text-xs font-semibold text-brand-danger hover:bg-brand-danger/10" onClick={() => void closePos(pos.symbol)}>
              {t("Close position")}
            </Button>
          </div>
        );
      })}
    </div>
  );

  const positionsCard = (
    <Card className="border-brand-border bg-brand-surface">
      <CardHeader className="border-b border-brand-border/60 pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-bold">{t("Positions")}</CardTitle>
          <Badge variant="outline" className="border-brand-border-subtle bg-brand-surface-2 font-mono text-[11px] text-brand-text-secondary">{positions.length}</Badge>
        </div>
        <CardDescription>{positionsLoading ? t("Loading…") : positionsError ? positionsError : `${positions.length} ${t("Open positions").toLowerCase()}`}</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">{positionsBody}</CardContent>
    </Card>
  );
  // Risk dashboard derived from the server-reported position book. Positions
  // without a mark/liquidation price render "—" rather than a computed guess;
  // the panel never fabricates a liquidation distance.
  const positionRiskCard = (
    <Card className="border-brand-border bg-brand-surface">
      <CardHeader className="border-b border-brand-border/60 pb-3">
        <CardTitle className="text-sm font-bold">{t("Position risk")}</CardTitle>
        <CardDescription>{t("Distance to liquidation and margin ratio per position")}</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <PositionRiskPanel
          positions={positions.map((pos) => ({
            id: pos.position_id,
            symbol: pos.symbol,
            side: pos.side === "buy" || pos.side === "long" ? "long" : "short",
            quantity: Number(pos.quantity),
            entryPrice: Number(pos.entry_price),
            markPrice: Number.isFinite(Number(pos.mark_price)) ? Number(pos.mark_price) : null,
            liquidationPrice: Number.isFinite(Number(pos.liquidation_price)) ? Number(pos.liquidation_price) : null,
            margin: Number.isFinite(Number(pos.margin)) ? Number(pos.margin) : null,
            leverage: Number.isFinite(Number(pos.leverage)) ? Number(pos.leverage) : effectiveLeverage,
          }))}
          emptyHint="Open a position to see its liquidation distance and margin ratio."
        />
      </CardContent>
    </Card>
  );



  const openOrdersBody = positionsLoading ? <TableSkeleton rows={2} /> : openOrders.length === 0 ? (
    <EmptyState icon={Inbox} title={t("No open orders")} hint={t("Open orders will appear here once submitted and before they fill.")} />
  ) : (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs font-mono">
        <thead>
          <tr className="border-b border-brand-border/40 text-brand-text-muted">
            <th className="px-2 py-2 font-medium">{t("Symbol")}</th>
            <th className="px-2 py-2 font-medium">{t("Type")}</th>
            <th className="px-2 py-2 font-medium">{t("Side")}</th>
            <th className="px-2 py-2 text-right font-medium">{t("Price")}</th>
            <th className="px-2 py-2 text-right font-medium">{t("Quantity")}</th>
            <th className="px-2 py-2 text-right font-medium">{t("Action")}</th>
          </tr>
        </thead>
        <tbody>
          {openOrders.map((o) => (
            <tr key={o.order_id} className="border-b border-brand-border/20 hover:bg-brand-surface-2/40">
              <td className="px-2 py-3 font-bold text-brand-text">{o.symbol}</td>
              <td className="px-2 py-3 uppercase text-brand-text-muted">{o.type}</td>
              <td className="px-2 py-3">{sideBadge(o.side, t)}</td>
              <td className="bf-tabular px-2 py-3 text-right font-medium">{money(o.price, locale)}</td>
              <td className="bf-tabular px-2 py-3 text-right font-medium">{money(o.quantity, locale, 6)}</td>
              <td className="px-2 py-3 text-right">
                <Button size="sm" variant="outline" className="h-8 border-brand-danger/30 px-2 text-[11px] text-brand-danger hover:bg-brand-danger/10" onClick={() => void cancelOrder(o.order_id)}>
                  {t("Cancel")}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const mobilePositionsAndOrders = (
    <Card className="border-brand-border bg-brand-surface">
      <CardHeader className="border-b border-brand-border/60 pb-0">
        <div className="flex gap-4" role="tablist">
          {([["positions", t("Positions")], ["open", t("Open orders")]] as const).map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={mobileSegTab === key} onClick={() => setMobileSegTab(key)}
              className={cn("relative pb-2.5 text-xs font-bold transition-colors", mobileSegTab === key ? "text-brand-text" : "text-brand-text-muted hover:text-brand-text-secondary")}>
              {label}
              {mobileSegTab === key ? <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-brand-accent" /> : null}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="pt-3">{mobileSegTab === "positions" ? positionsBody : openOrdersBody}</CardContent>
    </Card>
  );


  const priceTick = Number(selectedMarket?.price_tick) > 0 ? Number(selectedMarket?.price_tick) : 0.01;
  const priceDecimals = Math.max(0, Math.round(-Math.log10(priceTick)));
  const quantityDecimals = decimalsFromTick(selectedMarket?.quantity_step);
  const stepPrice = (delta: number) => {
    const current = Number(price);
    const base = Number.isFinite(current) && current > 0 ? current : 0;
    // Round the stepped price to the market tick so +/– buttons never leave
    // floating-point residue like 67123.34000000001.
    const next = Math.max(priceTick, roundTo(base + delta * priceTick, priceDecimals));
    setPrice(next.toFixed(priceDecimals));
  };

  const orderEntryCard = (
    <Card className="border-brand-border bg-brand-surface">
      <CardHeader className="border-b border-brand-border/60 pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-bold">{t("Place order")}</CardTitle>
          <Badge variant="outline" className="border-brand-violet/30 bg-brand-violet/10 font-mono text-[11px] text-brand-violet">{effectiveLeverage}×</Badge>
        </div>
        <CardDescription className="truncate">
          {selectedMarket ? `${selectedMarket.base_asset} / ${selectedMarket.quote_asset}` : t("Contract markets")}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <form onSubmit={(e) => void submitOrder(e)} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-brand-border/60 bg-brand-surface-2/60 p-1" role="group" aria-label={t("Order type")}>
            {(["limit", "market"] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                aria-pressed={orderType === kind}
                onClick={() => setOrderType(kind)}
                className={cn(
                  "min-h-9 rounded-md text-xs font-semibold transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50",
                  orderType === kind ? "bg-brand-surface text-brand-text shadow-sm" : "text-brand-text-muted hover:text-brand-text",
                )}
              >
                {kind === "limit" ? t("Limit") : t("Market")}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed={side === "buy"}
              onClick={() => setSide("buy")}
              className={cn(
                "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-all active:scale-[0.99]",
                side === "buy" ? "bg-brand-accent text-[#05201A] shadow-sm" : "border border-brand-border bg-brand-surface-2 text-brand-text-secondary hover:border-brand-border-strong",
              )}
            >
              <TrendingUp className="h-4 w-4" aria-hidden="true" />{t("Long")}
            </button>
            <button
              type="button"
              aria-pressed={side === "sell"}
              onClick={() => setSide("sell")}
              className={cn(
                "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-all active:scale-[0.99]",
                side === "sell" ? "bg-brand-danger text-white shadow-sm" : "border border-brand-border bg-brand-surface-2 text-brand-text-secondary hover:border-brand-border-strong",
              )}
            >
              <TrendingDown className="h-4 w-4" aria-hidden="true" />{t("Short")}
            </button>
          </div>

          <div className="rounded-lg border border-brand-border/60 bg-brand-surface-2/40 px-3 py-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-brand-text-muted">{t("Leverage")}</span>
              <span className="font-mono text-sm font-bold text-brand-accent">{effectiveLeverage}×</span>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1 rounded-lg border border-brand-border bg-brand-surface-2/60 p-1.5" role="group" aria-label={t("Leverage")}>
              {([10, 20, 50, 100] as const).map((n) => (
                <button key={n} type="button" aria-pressed={leveragePills === n} onClick={() => setLeveragePills(n)} className={`min-h-8 rounded-md px-1.5 text-xs font-bold transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50 ${leveragePills === n ? "bg-brand-accent/15 text-brand-accent" : "text-brand-text-muted hover:text-brand-text"}`}>{n}×</button>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-brand-border bg-brand-surface-2/60 px-3 py-2">
              <span className="text-xs text-brand-text-muted">{t("Margin mode")}</span>
              <button type="button" aria-pressed={marginMode === "cross"} onClick={() => setMarginMode("cross")} className={`min-h-8 rounded-md px-3 text-xs font-semibold transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50 ${marginMode === "cross" ? "bg-brand-accent/15 text-brand-accent" : "text-brand-text-muted hover:text-brand-text"}`}>{t("Cross")}</button>
              <button type="button" aria-pressed={marginMode === "isolated"} onClick={() => setMarginMode("isolated")} className={`min-h-8 rounded-md px-3 text-xs font-semibold transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50 ${marginMode === "isolated" ? "bg-brand-accent/15 text-brand-accent" : "text-brand-text-muted hover:text-brand-text"}`}>{t("Isolated")}</button>
            </div>
          </div>


          {orderType === "limit" ? (
            <div>
              <label className="mb-1 block text-[11px] font-medium text-brand-text-muted">{t("Price")} (USDT)</label>
              <div className="flex items-center gap-1.5">
                <button type="button" aria-label={t("Decrease price")} onClick={() => stepPrice(-1)} className="flex h-10 w-9 shrink-0 items-center justify-center rounded-md border border-brand-border bg-brand-surface-2 text-brand-text-muted transition-all duration-150 hover:border-brand-accent hover:text-brand-text active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50"><Minus className="h-3.5 w-3.5" /></button>
                <input
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(sanitizeDecimal(e.target.value, priceDecimals))}
                  placeholder={markPrice === null ? "0.00" : money(markPrice, "en-US", 2)}
                  aria-label={t("Price")}
                  className="bf-tabular h-10 min-w-0 flex-1 rounded-md border border-brand-border bg-brand-surface-2 px-2.5 font-mono text-sm text-brand-text outline-none transition-colors focus:border-brand-accent"
                />
                <button type="button" aria-label={t("Increase price")} onClick={() => stepPrice(1)} className="flex h-10 w-9 shrink-0 items-center justify-center rounded-md border border-brand-border bg-brand-surface-2 text-brand-text-muted transition-all duration-150 hover:border-brand-accent hover:text-brand-text active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50"><Plus className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ) : null}

          <div>
            <label className="mb-1 block text-[11px] font-medium text-brand-text-muted">
              {t("Quantity")} ({selectedMarket?.base_asset ?? "BTC"})
            </label>
            <input
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(sanitizeDecimal(e.target.value, quantityDecimals))}
              placeholder={selectedMarket ? `${t("Min")} ${selectedMarket.min_quantity}` : "0.0000"}
              aria-label={t("Quantity")}
              className="bf-tabular h-10 w-full rounded-md border border-brand-border bg-brand-surface-2 px-2.5 font-mono text-sm text-brand-text outline-none transition-colors focus:border-brand-accent"
            />
          </div>

          {orderType === "limit" ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-0.5 text-xs">
              <label className="flex cursor-pointer items-center gap-1.5 text-brand-text-secondary"><input type="checkbox" checked={reduceOnly} onChange={(e) => setReduceOnly(e.target.checked)} className="h-3.5 w-3.5 rounded border-brand-border accent-brand-accent" />{t("Reduce only")}</label>
              <label className="flex cursor-pointer items-center gap-1.5 text-brand-text-secondary"><input type="checkbox" checked={closePosition} onChange={(e) => setClosePosition(e.target.checked)} className="h-3.5 w-3.5 rounded border-brand-border accent-brand-accent" />{t("Close position")}</label>
            </div>
          ) : null}

          <div className="flex items-center justify-between rounded-lg border border-brand-border/60 bg-brand-surface-2/40 px-3 py-2.5 text-xs">
            <span className="text-brand-text-muted">{t("Estimated margin")}</span>
            <span className="bf-tabular font-mono font-bold text-brand-text">{estimatedMargin === null ? EM_DASH : `${money(estimatedMargin, locale, 2)} USDT`}</span>
          </div>

          {submitError ? <p role="alert" className="flex items-start gap-2 rounded-lg border border-brand-danger/30 bg-brand-danger/10 p-2.5 text-xs text-brand-danger"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{submitError}</p> : null}
          {submitOk ? <p role="status" className="flex items-start gap-2 rounded-lg border border-brand-success/30 bg-brand-success/10 p-2.5 text-xs text-brand-success"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />{submitOk}</p> : null}

          <Button
            type="submit"
            disabled={busy || !selectedMarket || (orderType === "limit" && !price) || !quantity}
            loading={busy}
            className={cn("min-h-11 w-full text-xs font-bold", side === "buy" ? "bg-brand-accent text-[#05201A] hover:bg-brand-accent/90" : "bg-brand-danger text-white hover:bg-brand-danger/90")}
          >
            {side === "buy" ? `${t("Long")} ${selectedMarket?.base_asset ?? ""}` : `${t("Short")} ${selectedMarket?.base_asset ?? ""}`}
          </Button>
          <p className="text-center text-[10px] leading-relaxed text-brand-text-faint">{t("Perpetual orders are submitted to the BTCBOX matching engine and confirmed by the server.")}</p>
        </form>
      </CardContent>
    </Card>
  );


  const historyBody = () => {
    if (signedOut) {
      return (
        <EmptyState
          icon={Inbox}
          title={t("Please sign in to view your account data")}
          hint={t("Sign in to view orders, trades and funding history.")}
          action={<Button asChild size="sm" className="h-10"><Link to="/login">{t("Go to sign in")}</Link></Button>}
        />
      );
    }
    if (tab === "open") return openOrdersBody;
    if (tab === "history") {
      return positionsLoading ? <TableSkeleton rows={2} /> : orderHistory.length === 0 ? (
        <EmptyState icon={Inbox} title={t("No order history")} hint={t("Filled and cancelled orders will appear here.")} />
      ) : (
        <div className="overflow-x-auto"><table className="w-full text-left text-xs font-mono">
          <thead><tr className="border-b border-brand-border/40 text-brand-text-muted"><th className="px-2 py-2 font-medium">{t("Symbol")}</th><th className="px-2 py-2 font-medium">{t("Type")}</th><th className="px-2 py-2 font-medium">{t("Side")}</th><th className="px-2 py-2 text-right font-medium">{t("Price")}</th><th className="px-2 py-2 text-right font-medium">{t("Quantity")}</th><th className="px-2 py-2 font-medium">{t("Status")}</th></tr></thead>
          <tbody>{orderHistory.map((o) => (
            <tr key={o.order_id} className="border-b border-brand-border/20">
              <td className="px-2 py-3 font-bold text-brand-text">{o.symbol}</td>
              <td className="px-2 py-3 uppercase text-brand-text-muted">{o.type}</td>
              <td className="px-2 py-3">{sideBadge(o.side, t)}</td>
              <td className="bf-tabular px-2 py-3 text-right font-medium">{money(o.price, locale)}</td>
              <td className="bf-tabular px-2 py-3 text-right font-medium">{money(o.quantity, locale, 6)}</td>
              <td className="px-2 py-3 text-brand-text-muted">{o.status}</td>
            </tr>
          ))}</tbody>
        </table></div>
      );
    }
    if (tab === "trades") {
      return tabLoading ? <TableSkeleton rows={2} /> : trades.length === 0 ? (
        <EmptyState icon={Inbox} title={t("No trades yet")} hint={t("Your executed trades for this market will appear here.")} />
      ) : (
        <div className="overflow-x-auto"><table className="w-full text-left text-xs font-mono">
          <thead><tr className="border-b border-brand-border/40 text-brand-text-muted"><th className="px-2 py-2 font-medium">{t("Side")}</th><th className="px-2 py-2 text-right font-medium">{t("Price")}</th><th className="px-2 py-2 text-right font-medium">{t("Quantity")}</th><th className="px-2 py-2 font-medium">{t("Time")}</th></tr></thead>
          <tbody>{trades.map((tr) => (
            <tr key={tr.trade_id} className="border-b border-brand-border/20">
              <td className="px-2 py-3">{sideBadge(tr.side, t)}</td>
              <td className="bf-tabular px-2 py-3 text-right font-medium">{money(tr.price, locale)}</td>
              <td className="bf-tabular px-2 py-3 text-right font-medium">{money(tr.quantity, locale, 6)}</td>
              <td className="px-2 py-3 text-brand-text-muted">{tr.created_at ?? EM_DASH}</td>
            </tr>
          ))}</tbody>
        </table></div>
      );
    }
    return tabLoading ? <TableSkeleton rows={2} /> : funding.length === 0 ? (
      <EmptyState icon={Inbox} title={t("No funding payments yet")} hint={t("Funding payments are settled periodically and will appear here.")} />
    ) : (
      <div className="overflow-x-auto"><table className="w-full text-left text-xs font-mono">
        <thead><tr className="border-b border-brand-border/40 text-brand-text-muted"><th className="px-2 py-2 font-medium">{t("Time")}</th><th className="px-2 py-2 text-right font-medium">{t("Funding rate")}</th><th className="px-2 py-2 text-right font-medium">{t("Mark price")}</th><th className="px-2 py-2 text-right font-medium">{t("Funding payment")}</th></tr></thead>
        <tbody>{funding.map((f, i) => {
          const pay = pnl(f.payment, locale, 6);
          return (
            <tr key={`${f.funding_at}-${i}`} className="border-b border-brand-border/20">
              <td className="px-2 py-3 text-brand-text-muted">{f.funding_at}</td>
              <td className="bf-tabular px-2 py-3 text-right font-medium">{money(f.funding_rate, locale, 6)}</td>
              <td className="bf-tabular px-2 py-3 text-right font-medium">{money(f.mark_price, locale)}</td>
              <td className={cn("bf-tabular px-2 py-3 text-right font-bold", pay.className)}>{pay.text}</td>
            </tr>
          );
        })}</tbody>
      </table></div>
    );
  };

  const historyCard = (
    <Card className="border-brand-border bg-brand-surface">
      <CardHeader className="border-b border-brand-border/60 pb-0">
        <div className="flex flex-wrap gap-4" role="tablist" aria-label={t("Orders and history")}>
          {tabs.map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
              className={cn("relative pb-3 text-xs font-bold transition-colors", tab === key ? "text-brand-text" : "text-brand-text-muted hover:text-brand-text-secondary")}>
              {label}
              {tab === key ? <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-brand-accent" /> : null}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="pt-4">{historyBody()}</CardContent>
    </Card>
  );


  return (
    <>
      <TradeProductNav />
      <div className="mx-auto flex w-full min-w-0 max-w-[1560px] flex-col gap-4 px-3 pb-6 pt-3 sm:px-4 sm:pt-4 md:px-6 lg:px-8">
        <header className="flex min-w-0 flex-col gap-3 rounded-xl border border-brand-border bg-brand-surface p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="type-page-title truncate text-brand-text">{selectedMarket?.symbol ?? "BTCUSDT"}</h1>
              <Badge variant="outline" className="shrink-0 border-brand-violet/30 bg-brand-violet/10 text-[11px] text-brand-violet">{t("Perpetual")}</Badge>
              {selectedMarket ? <Badge variant="warning" className="shrink-0 text-[11px]">{t(selectedMarket.status === "trading" ? "Live trading" : "Read only")}</Badge> : null}
            </div>
            <div className="flex min-w-0 items-baseline gap-1.5">
              <span className="bf-tabular font-mono text-xl font-semibold text-brand-text sm:text-2xl">{money(markPrice, locale)}</span>
              <span className="text-[11px] font-medium text-brand-text-muted">USDT</span>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <div className="min-w-0 flex-1 sm:flex-none">
              <label className="sr-only" htmlFor="perp-market-select">{t("Market")}</label>
              <Select
                id="perp-market-select"
                value={selectedMarket?.symbol ?? ""}
                onChange={(event) => setSymbol(event.target.value)}
                disabled={markets.length === 0}
                className="h-11 w-full min-w-0 sm:w-[180px]"
              >
                {markets.length === 0 ? <option value="">{t("No markets enabled")}</option> : null}
                {markets.map((market) => <option key={market.symbol} value={market.symbol}>{market.symbol}</option>)}
              </Select>
            </div>
            <Button type="button" variant="outline" size="sm" className="h-11 shrink-0" onClick={() => setDialogOpen(true)}>
              <BarChart3 className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">{t("Chart")}</span>
            </Button>
            <Button type="button" variant="outline" size="icon" aria-label={t("Refresh")} className="h-11 w-11 shrink-0" onClick={() => setReload((n) => n + 1)}>
              <RefreshCw className={cn("h-4 w-4", marketsLoading && "animate-spin")} aria-hidden="true" />
            </Button>
          </div>
        </header>

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-brand-border bg-brand-border sm:grid-cols-4">
          <Metric label={t("Mark price")} value={`${money(markPrice, locale)} USDT`} />
          <Metric label={t("Index price")} value={money(indexPrice, locale)} />
          <Metric label={t("Funding rate cap")} value={fundingRatePct} />
          <Metric label={t("Max leverage")} value={`${maxLeverage}×`} tone="text-brand-violet" />
        </dl>

        {marketsError ? (
          <Card className="border-brand-danger/30 bg-brand-surface">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <p className="flex min-w-0 items-start gap-2 text-xs text-brand-danger" role="alert"><TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />{marketsError}</p>
              <Button size="sm" variant="outline" className="h-10" onClick={() => setReload((n) => n + 1)} disabled={marketsLoading} loading={marketsLoading}>{t("Try again")}</Button>
            </CardContent>
          </Card>
        ) : null}

        {signedOut ? (
          <Card className="border-brand-border bg-brand-surface">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <p className="text-xs text-brand-text-muted">{t("Please sign in to view your account data")}</p>
              <Button asChild size="sm" className="h-10"><Link to="/login">{t("Go to sign in")}</Link></Button>
            </CardContent>
          </Card>
        ) : null}


        {marketsLoading && markets.length === 0 ? <TableSkeleton rows={4} /> : markets.length === 0 && !marketsError ? (
          <EmptyState icon={Inbox} title={t("No markets enabled")} hint={t("Perpetual contract trading is currently unavailable.")} action={<Button size="sm" variant="outline" onClick={() => setReload((n) => n + 1)}>{t("Try again")}</Button>} />
        ) : null}

        {markets.length > 0 ? (
          <>
            <div className="lg:hidden">
              <div className="grid grid-cols-3 gap-1 rounded-xl border border-brand-border bg-brand-surface p-1 text-xs font-semibold" role="tablist" aria-label={t("Trading panels")}>
                {([["order", t("Quick order")], ["book", t("Order book")], ["positions", t("Positions")]] as const).map(([key, label]) => (
                  <button key={key} type="button" role="tab" aria-selected={mobileSegment === key} onClick={() => setMobileSegment(key)}
                    className={cn("min-h-10 rounded-lg px-1 transition-colors", mobileSegment === key ? "bg-brand-surface-2 text-brand-text" : "text-brand-text-muted hover:text-brand-text")}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-3">
                {mobileSegment === "order" ? orderEntryCard : null}
                {mobileSegment === "book" ? <OrderBookDepth mid={depthMid} book={liveDepth.data} streamState={liveDepth.state} /> : null}
                {mobileSegment === "positions" ? <div className="space-y-3">{signedOut ? null : positionsCard}{signedOut ? null : positionRiskCard}{mobilePositionsAndOrders}{positionsError ? <p className="text-xs text-brand-danger" role="alert">{positionsError}</p> : null}</div> : null}
              </div>
            </div>

            <div className="hidden min-w-0 items-start gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
              <div className="flex min-w-0 flex-col gap-4">
                {signedOut ? null : positionsCard}
                {historyCard}
              </div>
              <div className="flex min-w-0 flex-col gap-4">
                {signedOut ? null : positionRiskCard}
                {orderEntryCard}
                <OrderBookDepth mid={depthMid} book={liveDepth.data} streamState={liveDepth.state} />
                {streamSymbol ? <TradesPanel symbol={streamSymbol} /> : null}
              </div>
            </div>
          </>
        ) : null}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border border-brand-border bg-brand-surface sm:max-w-[900px]">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
            <DialogTitle className="text-sm font-bold">{t("Chart")} — {selectedMarket?.symbol ?? "BTCUSDT"}</DialogTitle>
            <DialogDescription className="text-xs text-brand-text-muted">{t("Perpetual contract candlestick chart")}</DialogDescription>
          </div>
          <div className="h-[420px] w-full">
            <ChartDrawer symbol={selectedMarket?.symbol ?? "BTC/USDT"} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

