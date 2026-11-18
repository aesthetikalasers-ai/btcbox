import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@radix-ui/react-dialog";
import { AlertCircle, BarChart3, CheckCircle2, ChevronDown, Inbox, Minus, MoreHorizontal, Plus, TrendingDown, TrendingUp, TriangleAlert } from "lucide-react";
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
  getAccount,
  getPerpFundingHistory,
  getPerpMarkets,
  getPerpOpenOrders,
  getPerpOrderHistory,
  getPerpPositions,
  getPerpTrades,
  submitPerpOrder,
  type AccountBalance,
  type PerpMarket,
  type PerpOrder,
  type PerpPosition,
} from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useMarketStream } from "../../lib/useMarketStream";
import { localeTags, useI18n } from "../../lib/i18n";
import { TradeProductNav } from "../trade/TradeProductNav";
import { PositionRiskPanel, fromPerpPosition } from "../trade/PositionRiskPanel";
import { TradesPanel } from "../trade/TradesPanel";
import { useMarketStreamEvent } from "../../lib/useMarketStreamEvent";
import { OrderBookDepth } from "../trade/OrderBookDepth";
import { ChartDrawer } from "../trade/ChartDrawer";
import { cn } from "../../lib/utils";

type Tab = "open" | "history" | "trades" | "funding";

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


export function ContractPage() {
  const { t, language } = useI18n();
  const { status } = useAuth();
  const { tickers } = useMarketStream({ tickers: true });
  const locale = localeTags[language];
  const [markets, setMarkets] = useState<PerpMarket[]>([]);
  const [marketsLoading, setMarketsLoading] = useState(true);
  const [marketsError, setMarketsError] = useState("");
  const [symbol, setSymbol] = useState("");
  const [orderType, setOrderType] = useState<"market" | "limit">("limit");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reduceOnly, setReduceOnly] = useState(false);
  const [closePosition, setClosePosition] = useState(false);
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
  const [mobileSegTab, setMobileSegTab] = useState<"positions" | "open" | "history">("positions");
  const [dialogOpen, setDialogOpen] = useState(false);
  // 交易对选择弹窗：深色抽屉，遍历 markets，支持搜索。
  const [symbolPickerOpen, setSymbolPickerOpen] = useState(false);
  const [symbolSearch, setSymbolSearch] = useState("");
  // 移动端盘口深度聚合精度（点击循环切换）。
  const [depthStep, setDepthStep] = useState<"0.001" | "0.01" | "0.1" | "1">("0.001");
  // Mobile compact order form (Binance-style): open/close intent, quick percentage
  // of available balance, and TP/SL toggle. These are presentation-only helpers;
  // they map onto the existing side / reduceOnly / closePosition order fields.
  const [mobileSideTab, setMobileSideTab] = useState<"open" | "close">("open");
  const [mobilePercent, setMobilePercent] = useState(0);
  const [mobileTpSl, setMobileTpSl] = useState(false);
  // Popover open state for the mobile leverage multiplier picker (Binance-style
  // tap-to-open dropdown instead of inline pills).
  const [leverageOpen, setLeverageOpen] = useState(false);
  // Initial-margin input (USDT) for the mobile order form. Typing here derives the
  // equivalent contract quantity (margin × leverage / price) and writes it back to
  // `quantity`, keeping a single source of truth for order submission.
  const [marginInput, setMarginInput] = useState("");
  // Countdown to the next funding settlement (mobile funding-rate row). Derived
  // from the selected market's `next_funding_at`; falls back to a rolling 8h
  // interval anchored to the hour so the row always shows a live countdown.
  const [fundingCountdown, setFundingCountdown] = useState("");
  // Available USDT balance (free margin) for the compact mobile order form. Fetched
  // from the account endpoint so the "available" and "openable" figures track the
  // real wallet instead of hard-coded placeholders. In demo preview this resolves
  // to the synthetic demo account.
  const [availableUsdt, setAvailableUsdt] = useState<number | null>(null);

  const selectedMarket = useMemo(() => markets.find((m) => m.symbol === symbol) ?? markets[0], [markets, symbol]);
  const maxLeverage = selectedMarket?.max_leverage ?? 1;
  const effectiveLeverage = Math.min(leveragePills, maxLeverage);
  const markPrice = selectedMarket?.mark_price ?? null;
  const indexPrice = selectedMarket?.index_price ?? null;
  const depthMid = markPrice !== null && Number(markPrice) > 0 ? Number(markPrice) : undefined;

  // Live 24h ticker for the selected contract symbol (Binance-style header).
  // Falls back to the mark price from the market catalogue when the stream has
  // not produced a ticker for this symbol yet.
  const baseAsset = selectedMarket?.base_asset ?? (symbol ? symbol.replace(/USDT$/i, "") : "BTC");
  const liveTicker = useMemo(() => tickers.find((tk) => tk.sym.toUpperCase() === baseAsset.toUpperCase()) ?? null, [tickers, baseAsset]);
  const displayPrice = liveTicker?.price ?? (markPrice !== null && markPrice !== undefined ? Number(markPrice) : null);
  const displayChg = liveTicker?.chg ?? null;

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

  // Deterministic demo order book so the compact mobile depth panel always renders
  // something meaningful — even in demo preview where the live depth stream is not
  // available. Prices are seeded from the mark price; never presented as live.
  const demoDepthBook = useMemo(() => {
    const mid = Number(markPrice ?? NaN);
    if (!Number.isFinite(mid) || mid <= 0) return null;
    // Tight, realistic spread: one tick away (≈0.01%), then increasing steps, so
    // the best ask/bid sit right against the mid price instead of floating far
    // above/below it (which reads like a mirrored/again-flipped book).
    const tick = Math.max(0.01, Number(mid.toFixed(2)) * 0.0001 * 0.1);
    const bids: [string, string][] = [];
    const asks: [string, string][] = [];
    for (let i = 0; i < 6; i += 1) {
      const spread = tick * (i + 1);
      // Deterministic pseudo-random sizes (no Math.random, keeps render stable).
      const size = (0.08 + ((i * 137) % 100) / 100 * 1.5).toFixed(4);
      // bids descend from best (closest to mid) downward; asks ascend away from mid.
      bids.push([(mid - spread).toFixed(2), size]);
      asks.push([(mid + spread).toFixed(2), size]);
    }
    return { bids, asks };
  }, [markPrice]);

  const mobileDepthBook = liveDepth.data ?? demoDepthBook;

  // Buy/sell depth ratio for the mobile order book footer (Binance-style split bar).
  // Pure presentation; never used for order sizing.
  const depthRatio = useMemo(() => {
    const book = mobileDepthBook;
    if (!book) return null;
    const bidTotal = book.bids.reduce((sum, [, qty]) => sum + Number(qty || 0), 0);
    const askTotal = book.asks.reduce((sum, [, qty]) => sum + Number(qty || 0), 0);
    const total = bidTotal + askTotal;
    if (!Number.isFinite(total) || total <= 0) return null;
    const bidPct = (bidTotal / total) * 100;
    return { bidPct: Math.min(100, Math.max(0, bidPct)), askPct: 100 - Math.min(100, Math.max(0, bidPct)) };
  }, [mobileDepthBook]);

  useEffect(() => {
    if (leveragePills > maxLeverage) setLeveragePills(maxLeverage as 10 | 20 | 50 | 100);
  }, [maxLeverage, leveragePills]);

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

  // Resolve the USDT free balance for the mobile order entry's "available" row.
  // Works for both live accounts and the demo preview (getAccount returns the
  // synthetic demo account when DEMO_PREVIEW_ACTIVE is set). Never blocks the
  // rest of the terminal: on failure we keep the previous value / show a dash.
  useEffect(() => {
    const controller = new AbortController();
    getAccount(controller.signal)
      .then((snapshot) => {
        if (controller.signal.aborted) return;
        const usdt: AccountBalance | undefined = snapshot.balances?.USDT;
        const free = usdt ? Number(usdt.free) : NaN;
        setAvailableUsdt(Number.isFinite(free) ? free : null);
      })
      .catch(() => {
        if (!controller.signal.aborted) setAvailableUsdt(null);
      });
    return () => controller.abort();
  }, []);

  // Live countdown to the next funding settlement. Anchored to the market's
  // `next_funding_at` when available, otherwise to the top of the current 8-hour
  // window (00:00 / 08:00 / 16:00 UTC) so the mobile row always ticks.
  useEffect(() => {
    const fmt = (ms: number) => {
      if (ms <= 0) return "00:00:00";
      const total = Math.floor(ms / 1000);
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${pad(h)}:${pad(m)}:${pad(s)}`;
    };
    const tick = () => {
      const next = selectedMarket?.next_funding_at ? new Date(selectedMarket.next_funding_at).getTime() : null;
      let target = next;
      if (!target || !Number.isFinite(target)) {
        const interval = selectedMarket?.funding_interval_sec || 28800;
        const now = Date.now();
        target = Math.ceil(now / (interval * 1000)) * (interval * 1000);
      }
      setFundingCountdown(fmt(target - Date.now()));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [selectedMarket]);

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

  // Maximum openable contract quantity at the current leverage: available USDT ×
  // leverage / entry price. Pure display for the mobile "openable" row — the
  // actual order still goes through server-side margin checks.
  const openableQty = useMemo(() => {
    if (availableUsdt === null || !Number.isFinite(availableUsdt) || availableUsdt <= 0) return null;
    const px = Number(markPrice ?? NaN);
    if (!Number.isFinite(px) || px <= 0 || effectiveLeverage < 1) return null;
    return roundTo(div(mul(availableUsdt, effectiveLeverage), px), 6);
  }, [availableUsdt, markPrice, effectiveLeverage]);

  // Typing an initial margin derives the equivalent contract quantity and syncs it
  // back into `quantity` (single source of truth for submission). Empty input
  // clears the quantity.
  const handleMarginChange = (raw: string) => {
    const value = sanitizeDecimal(raw, 2);
    setMarginInput(value);
    const margin = Number(value);
    const px = Number(markPrice ?? NaN);
    if (!value || !Number.isFinite(margin) || margin <= 0 || !Number.isFinite(px) || px <= 0 || effectiveLeverage < 1) {
      setQuantity("");
      return;
    }
    const qty = div(mul(margin, effectiveLeverage), px);
    setQuantity(qty > 0 ? qty.toFixed(quantityDecimals) : "");
  };

  // Quick percentage of available balance → margin (and therefore quantity).
  const applyMarginPercent = (pct: number) => {
    setMobilePercent(pct);
    if (availableUsdt === null || !Number.isFinite(availableUsdt) || availableUsdt <= 0) return;
    const margin = roundTo(mul(availableUsdt, pct / 100), 2);
    handleMarginChange(String(margin));
  };

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
            ...fromPerpPosition(pos),
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

  const mobileHistoryBody = orderHistory.length === 0 ? (
    <EmptyState icon={Inbox} title={t("No order history")} hint={t("Filled and cancelled orders will appear here.")} />
  ) : (
    <div className="space-y-2 px-3">
      {orderHistory.map((o) => (
        <div key={o.order_id} className="rounded-lg bg-[#1e2329] px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-bold text-[#eaecef]">{o.symbol}</span>
            {sideBadge(o.side, t)}
          </div>
          <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px]">
            <div className="flex justify-between"><span className="text-[10px] text-brand-text-muted">{t("Type")}</span><span className="uppercase text-brand-text-secondary">{o.type}</span></div>
            <div className="flex justify-between"><span className="text-[10px] text-brand-text-muted">{t("Price")}</span><span className="text-brand-text">{money(o.price, locale)}</span></div>
            <div className="flex justify-between"><span className="text-[10px] text-brand-text-muted">{t("Quantity")}</span><span className="text-brand-text">{money(o.quantity, locale, 6)}</span></div>
            <div className="flex justify-between"><span className="text-[10px] text-brand-text-muted">{t("Status")}</span><span className="text-brand-text-secondary">{o.status}</span></div>
          </div>
        </div>
      ))}
    </div>
  );

  const mobileSegLabels: Array<["positions" | "open" | "history", string, number]> = [
    ["positions", t("Positions"), positions.length],
    ["open", t("Open orders"), openOrders.length],
    ["history", t("History"), orderHistory.length],
  ];

  // 移动端底部订单/仓位区的精简居中空状态（弱化图标 + 单行小字提示）。
  const mobileEmpty = (text: string) => (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Inbox className="mb-1.5 h-7 w-7 text-[#474d57]" aria-hidden="true" />
      <p className="text-xs text-[#848e9c]">{text}</p>
    </div>
  );

  const mobilePositionsAndOrders = (
    <div className="flex-1">
      <div className="sticky top-0 z-10 flex h-9 items-end gap-4 border-b border-white/5 bg-[#0b0e11] px-3.5" role="tablist" aria-label={t("Orders and history")}>
        {mobileSegLabels.map(([key, label, count]) => (
          <button key={key} type="button" role="tab" aria-selected={mobileSegTab === key} onClick={() => setMobileSegTab(key)}
            className={cn("relative flex h-full items-center text-[13px] font-semibold transition-colors", mobileSegTab === key ? "text-[#eaecef]" : "text-brand-text-muted hover:text-brand-text-secondary")}>
            {label} ({count})
            {mobileSegTab === key ? <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-[#f0b90b]" /> : null}
          </button>
        ))}
      </div>
      <div className="pt-3">
        {mobileSegTab === "positions"
          ? (positions.length === 0 && !positionsLoading && !positionsError ? mobileEmpty(t("No positions")) : positionsBody)
          : mobileSegTab === "open"
            ? (openOrders.length === 0 && !positionsLoading ? mobileEmpty(t("No orders")) : openOrdersBody)
            : (orderHistory.length === 0 ? mobileEmpty(t("No history")) : mobileHistoryBody)}
      </div>
    </div>
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
              <span className="text-xs font-semibold text-brand-text">{t("Cross")}</span>
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


  // Mobile-only compact order entry (Binance futures style). Kept separate from
  // `orderEntryCard` so the desktop layout stays untouched.
  const mobileOrderEntry = (
    <form onSubmit={(e) => void submitOrder(e)} className="compact-trade-form flex h-full flex-col gap-1.5 text-[#eaecef]">
      {/* 开仓 / 平仓 胶囊切换（币安风格 h-9 大胶囊） */}
      <div className="grid grid-cols-2 gap-1 rounded-md bg-[#1e2329] p-[3px]" role="group" aria-label={t("Position intent")}>
        {(["open", "close"] as const).map((kind) => (
          <button key={kind} type="button" aria-pressed={mobileSideTab === kind}
            onClick={() => { setMobileSideTab(kind); setReduceOnly(kind === "close"); setClosePosition(kind === "close"); }}
            className={cn("rounded py-2 text-[13px] leading-none font-semibold transition-colors", mobileSideTab === kind ? "bg-[#2b3139] text-white" : "text-[#848e9c] hover:text-[#eaecef]")}>
            {kind === "open" ? t("Open position") : t("Close position")}
          </button>
        ))}
      </div>

      {/* 全仓（固定）+ 杠杆（币安风格 h-[32px]） */}
      <div className="relative grid grid-cols-2 gap-2">
        <button type="button"
          className="flex h-8 items-center justify-between rounded-md bg-[#2b3139] px-3 text-[13px] leading-none font-medium text-[#eaecef]">
          <span>{t("Cross")}</span>
          <span className="text-[11px] leading-none text-[#848e9c]">▾</span>
        </button>
        <button type="button" aria-expanded={leverageOpen} onClick={() => setLeverageOpen((v) => !v)}
          className="flex h-8 items-center justify-between rounded-md bg-[#2b3139] px-3 text-[13px] leading-none font-semibold text-brand-accent transition-colors hover:opacity-90">
          <span>{effectiveLeverage}×</span>
          <span className={cn("text-[11px] leading-none text-[#848e9c] transition-transform", leverageOpen && "rotate-180")}>▾</span>
        </button>
        {leverageOpen ? (
          <div className="absolute right-0 top-full z-20 mt-1 w-[calc(50%-3px)] overflow-hidden rounded-md border border-brand-border bg-brand-surface shadow-lg shadow-black/40">
            {([10, 20, 50, 100] as const).filter((n) => n <= maxLeverage).map((n) => (
              <button key={n} type="button" onClick={() => { setLeveragePills(n); setLeverageOpen(false); }}
                className={cn("flex w-full items-center justify-between px-3 py-2.5 text-xs transition-colors hover:bg-brand-surface-hover",
                  effectiveLeverage === n ? "font-bold text-brand-accent" : "font-medium text-brand-text-secondary")}>
                <span>{n}×</span>
                {effectiveLeverage === n ? <span className="text-brand-accent">✓</span> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* 委托类型 Select（币安风格 h-9） */}
      <div className="relative">
        <label className="sr-only" htmlFor="mobile-order-type">{t("Order type")}</label>
        <Select
          id="mobile-order-type"
          value={orderType}
          onChange={(event) => setOrderType(event.target.value as "limit" | "market")}
          className="h-9 w-full rounded-md bg-[#2b3139] px-3 text-[13px] font-medium text-[#eaecef]"
        >
          <option value="market">{t("Market")}</option>
          <option value="limit">{t("Limit")}</option>
        </Select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#848e9c]">▾</span>
      </div>

      {/* 价格 / 市价提示 输入（币安风格 h-10） */}
      <div className="flex h-10 items-center justify-between rounded-md bg-[#2b3139] px-3">
        {orderType === "market" ? (
          <input type="text" disabled
            placeholder={t("Filled at the best available market price")}
            aria-label={t("Price")}
            className="w-full bg-transparent text-[13px] font-medium text-[#848e9c] outline-none placeholder:text-[#848e9c]" />
        ) : (
          <input type="text" inputMode="decimal" value={price}
            onChange={(e) => setPrice(sanitizeDecimal(e.target.value, priceDecimals))}
            placeholder={markPrice === null ? t("Price") : money(markPrice, "en-US", 2)}
            aria-label={t("Price")}
            className="w-full bg-transparent font-mono text-[13px] font-medium tabular-nums outline-none placeholder:text-[#848e9c]" />
        )}
        <span className="ml-2 shrink-0 text-[11px] font-medium text-[#848e9c]">USDT ▾</span>
      </div>

      {/* 市价模式：初始保证金 (USDT) 输入（币安风格 h-10） */}
      {orderType === "market" ? (
        <div className="flex h-10 items-center justify-between rounded-md bg-[#2b3139] px-3">
          <input type="text" inputMode="decimal" value={marginInput}
            onChange={(e) => handleMarginChange(e.target.value)}
            placeholder={t("Initial margin")} aria-label={t("Initial margin")}
            className="w-full bg-transparent font-mono text-[13px] font-medium tabular-nums outline-none placeholder:text-[#848e9c]" />
          <span className="ml-2 shrink-0 text-[11px] font-medium text-[#848e9c]">USDT</span>
        </div>
      ) : null}

      {/* 数量 (BTC) 输入（币安风格 h-10） */}
      <div className="flex h-10 items-center justify-between rounded-md bg-[#2b3139] px-3">
        <input type="text" inputMode="decimal" value={quantity}
          onChange={(e) => setQuantity(sanitizeDecimal(e.target.value, quantityDecimals))}
          placeholder={selectedMarket ? `${selectedMarket.min_quantity}` : "0.0000"}
          aria-label={t("Quantity")}
          className="w-full bg-transparent font-mono text-[13px] font-medium tabular-nums outline-none placeholder:text-[#848e9c]" />
        <span className="ml-2 shrink-0 text-[11px] font-medium text-[#848e9c]">{selectedMarket?.base_asset ?? "BTC"}</span>
      </div>

      {/* 百分比快速下单（币安风格：菱形手柄 + 小圆点轨道） */}
      <div className="relative flex w-full items-center justify-between" style={{ height: 20 }}>
        {/* 底层细轨道 */}
        <div className="absolute inset-x-0 bg-[#2b3139]" style={{ height: 2 }} />
        {/* 已选进度（绿色，纯水平细线） */}
        <div className="absolute left-0 bg-brand-accent" style={{ height: 2, width: `${mobilePercent}%` }} />
        {/* 5 个刻度点 0/25/50/75/100（点击填入对应比例） */}
        {[0, 25, 50, 75, 100].map((step) => (
          <button key={step} type="button" onClick={() => applyMarginPercent(step)} aria-label={`${step}%`}
            className="relative z-10 flex items-center justify-center"
            style={{
              width: 20,
              height: 20,
              padding: 0,
              border: "none",
              background: "transparent",
              appearance: "none",
              flexShrink: 0,
            }}>
            {/* 当前选中位置显示菱形手柄，其余为小圆点 */}
            {mobilePercent === step ? (
              <span style={{
                width: 10,
                height: 10,
                transform: "rotate(45deg)",
                backgroundColor: "#eaecef",
                display: "block",
              }} />
            ) : (
              <span style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: mobilePercent >= step ? "#0ecb81" : "#1e2329",
                border: mobilePercent >= step ? "none" : "1.5px solid #4a5158",
                display: "block",
              }} />
            )}
          </button>
        ))}
      </div>

      {/* 可用 / 可开 辅助行（币安节奏：按钮前） */}
      <div className="space-y-1 text-[12px] tabular-nums">
        <div className="flex justify-between"><span className="text-[#848e9c]">{t("Available")}</span><span className="text-[#eaecef]">{availableUsdt === null ? EM_DASH : `${money(availableUsdt, locale, 2)} USDT`} ⇄</span></div>
        <div className="flex justify-between"><span className="text-[#848e9c]">{t("Openable")}</span><span className="text-[#eaecef]">{openableQty === null ? EM_DASH : `${money(openableQty, locale, 4)} ${selectedMarket?.base_asset ?? "BTC"}`}</span></div>
      </div>

      {/* 止盈 / 止损 勾选（币安节奏：可用下方） */}
      <label className="flex items-center gap-2 text-[12px] text-[#848e9c]">
        <input type="checkbox" checked={mobileTpSl} onChange={(e) => setMobileTpSl(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-[#4a5158] bg-transparent accent-[#f0b90b]" />
        {t("Take profit / Stop loss")}
      </label>

      {/* 可开保证金（币安节奏：开多按钮上方） */}
      <div className="flex justify-between text-[12px] tabular-nums"><span className="text-[#848e9c]">{t("Open margin")}</span><span className="text-[#eaecef]">{estimatedMargin === null ? "0 USDT" : `${money(estimatedMargin, locale, 2)} USDT`}</span></div>

      {/* 开多 / 平多 按钮（币安风格 h-11） */}
      <button type="submit" onClick={() => setSide("buy")} disabled={busy}
        className="relative flex h-11 w-full items-center justify-center rounded-md bg-brand-success text-[15px] font-bold text-white transition hover:opacity-90 active:scale-[0.99] disabled:opacity-60">
        <span>{mobileSideTab === "open" ? t("Long") : t("Close short")}</span>
        <span className="absolute right-3 text-[11px] font-normal opacity-90">{mobileSideTab === "open" ? t("Up") : ""}</span>
      </button>

      {/* 可平 辅助行（币安节奏：两个按钮之间） */}
      <div className="flex justify-between text-[12px] tabular-nums"><span className="text-[#848e9c]">{t("Closeable")}</span><span className="text-[#eaecef]">0.00 USDT</span></div>

      {/* 开空 / 平空 按钮（币安风格 h-11） */}
      <button type="submit" onClick={() => setSide("sell")} disabled={busy}
        className="relative flex h-11 w-full items-center justify-center rounded-md bg-brand-danger text-[15px] font-bold text-white transition hover:opacity-90 active:scale-[0.99] disabled:opacity-60">
        <span>{mobileSideTab === "open" ? t("Short") : t("Close long")}</span>
        <span className="absolute right-3 text-[11px] font-normal opacity-90">{mobileSideTab === "open" ? t("Down") : ""}</span>
      </button>

      {submitError ? <p role="alert" className="flex items-start gap-1.5 rounded-md border border-brand-danger/30 bg-brand-danger/10 p-2 text-[11px] text-brand-danger"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{submitError}</p> : null}
      {submitOk ? <p role="status" className="flex items-start gap-1.5 rounded-md border border-brand-success/30 bg-brand-success/10 p-2 text-[11px] text-brand-success"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />{submitOk}</p> : null}
    </form>
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
      {/* 全出血通栏：产品切换栏 + 行情 header 无缝融合（局部覆盖，不影响其他页面） */}
      <div className="w-full bg-[#0b0e11] [&>nav]:!bg-[#0b0e11]">
        <TradeProductNav leftIndent="px-5 sm:px-6 md:px-8 lg:px-8" />
      </div>
      <div className="mx-auto flex min-h-dvh w-full min-w-0 max-w-[430px] flex-col bg-[#0b0e11] px-0 pb-24 text-[#eaecef] lg:max-w-[1560px] lg:gap-4 lg:px-8 lg:pb-6 lg:pt-4">
        <header className="flex min-w-0 flex-col justify-center gap-2 px-3.5 pt-2.5 pb-1 lg:h-auto lg:rounded-xl lg:border lg:border-brand-border lg:bg-brand-surface lg:px-4 lg:py-2">
          {/* 行 1：合约名（市场选择）+ 永续标签 + 图表/更多 图标 */}
          <div className="flex min-w-0 items-center gap-2">
            <div className="relative min-w-0">
              <button
                type="button"
                onClick={() => setSymbolPickerOpen(true)}
                disabled={markets.length === 0}
                className="flex min-w-0 items-center gap-1 rounded text-[18px] font-bold leading-none text-brand-text transition-colors hover:text-brand-text-secondary"
              >
                <span className="truncate">{selectedMarket?.symbol ?? "BTCUSDT"}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-brand-text-muted" aria-hidden="true" />
              </button>
            </div>
            <Badge variant="outline" className="shrink-0 border-brand-violet/30 bg-brand-violet/10 px-1.5 py-0.5 text-[11px] leading-none text-brand-violet">{t("Perpetual")}</Badge>
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <Button type="button" variant="ghost" size="icon" aria-label={t("Chart")} className="h-8 w-8 text-brand-text-muted" onClick={() => setDialogOpen(true)}>
                <BarChart3 className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button type="button" variant="ghost" size="icon" aria-label={t("More")} className="h-8 w-8 text-brand-text-muted">
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
          {/* 行 2：大号最新价 + 涨跌幅（左），标记/指数价（右侧右对齐），避免重叠 */}
          <div className="flex min-w-0 items-baseline justify-between gap-2">
            <div className="flex min-w-0 shrink-0 items-baseline gap-2">
              <span className={cn("bf-tabular font-mono text-[20px] font-bold leading-none", displayChg !== null ? (displayChg >= 0 ? "text-brand-success" : "text-brand-danger") : "text-brand-text")}>{displayPrice !== null && displayPrice !== undefined ? money(displayPrice, locale) : EM_DASH}</span>
              <span className={cn("bf-tabular font-mono text-[12px] font-semibold", displayChg !== null ? (displayChg >= 0 ? "text-brand-success" : "text-brand-danger") : "text-brand-text-muted")}>
                {displayChg !== null ? `${displayChg >= 0 ? "+" : ""}${displayChg.toFixed(2)}%` : EM_DASH}
              </span>
            </div>
            <div className="hidden min-w-0 shrink-0 items-center gap-2 text-right text-[11px] text-brand-text-muted lg:flex">
              <span className="flex items-center gap-1"><span>{t("Mark")}</span><span className="bf-tabular font-mono text-brand-text-secondary">{money(markPrice, locale)}</span></span>
              <span className="flex items-center gap-1"><span>{t("Index")}</span><span className="bf-tabular font-mono text-brand-text-secondary">{money(indexPrice, locale)}</span></span>
            </div>
          </div>
        </header>

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
              {/* 左右双栏：左下单 + 右紧凑盘口（底边严格齐平），顶部加呼吸间距 */}
              <div className="compact-trade-form mt-2.5 grid grid-cols-[1.28fr_1fr] items-stretch gap-2.5 border-t border-[#2b3139]/40 px-3 pt-2">
                {/* 左：移动端紧凑下单表单 */}
                <div className="flex min-w-0 flex-col">{mobileOrderEntry}</div>

                {/* 右：Binance 紧凑盘口（顶部对齐，精度框 mt-auto 推底对齐左栏主按钮） */}
                <div className="flex min-w-0 flex-col justify-start text-[10px] tabular-nums">
                  {/* 顶部：资金费率 + 倒计时 */}
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-[10px] text-brand-text-muted">{t("Funding rate")}</span>
                    <span className="text-right">
                      <span className="font-mono text-[11px] font-semibold text-brand-text-secondary">{fundingRatePct}</span>
                      <span className="ml-1.5 font-mono text-[11px] text-brand-text-muted">{fundingCountdown}</span>
                    </span>
                  </div>

                  {/* 表头（币安风格：币种名 + 单位分两行） */}
                  <div className="grid grid-cols-[1.1fr_0.9fr] border-b border-white/5 pb-0.5 font-semibold leading-tight text-[10px] text-brand-text-muted">
                    <span>{t("Price")}<br />(USDT)</span>
                    <span className="text-right">{t("Quantity")}<br />(USDT)</span>
                  </div>
                  {(() => {
                    const asks = mobileDepthBook ? mobileDepthBook.asks.slice(0, 5).reverse() : [];
                    const bids = mobileDepthBook ? mobileDepthBook.bids.slice(0, 5) : [];
                    let max = 0;
                    for (const [, q] of [...asks, ...bids]) { const n = Number(q); if (n > max) max = n; }
                    const fmt = (v: unknown) => (v === undefined || v === null || v === "" ? "—" : Number(v).toLocaleString("en-US", { maximumFractionDigits: 8 }));
                    return (
                      <>
                        <div className="flex flex-col space-y-0.5">
                          {asks.map((row, i) => {
                            const depth = max ? (Number(row[1]) / max) * 100 : 0;
                            return (
                              <div key={`a${i}`} className="relative grid grid-cols-[1.1fr_0.9fr] h-[21px] leading-[21px] text-[11px]">
                                <span className="absolute inset-y-0 right-0 bg-[#f6465d]/15 transition-all duration-150" style={{ width: `${depth}%` }} />
                                <span className="relative text-left text-[#f6465d]">{fmt(row[0])}</span>
                                <span className="relative text-right text-gray-300">{fmt(row[1])}</span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="my-0.5 text-center leading-tight">
                          <div className="text-[17px] font-bold leading-none text-brand-success">{fmt(depthMid)}</div>
                          <div className="mt-0.5 text-[11px] text-[#848e9c] underline decoration-dotted underline-offset-2">{fmt(markPrice)}</div>
                        </div>
                        <div className="flex flex-col space-y-0.5">
                          {bids.map((row, i) => {
                            const depth = max ? (Number(row[1]) / max) * 100 : 0;
                            return (
                              <div key={`b${i}`} className="relative grid grid-cols-[1.1fr_0.9fr] h-[21px] leading-[21px] text-[11px]">
                                <span className="absolute inset-y-0 right-0 bg-[#0ecb81]/15 transition-all duration-150" style={{ width: `${depth}%` }} />
                                <span className="relative text-left text-[#0ecb81]">{fmt(row[0])}</span>
                                <span className="relative text-right text-gray-300">{fmt(row[1])}</span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}

                  {/* 底部：多空比例条 + 精度 Select + 盘口切换（mt-auto 推底对齐左栏开空按钮） */}
                  <div className="mt-auto space-y-1 pt-1">
                    {depthRatio ? (
                      <div className="flex items-center justify-between text-[10px] tabular-nums">
                        <span className="text-brand-success">{depthRatio.bidPct.toFixed(2)}%</span>
                        <div className="mx-1.5 h-1 flex-1 overflow-hidden rounded-full bg-brand-danger/40">
                          <div className="h-full bg-brand-success" style={{ width: `${depthRatio.bidPct}%` }} />
                        </div>
                        <span className="text-brand-danger">{depthRatio.askPct.toFixed(2)}%</span>
                      </div>
                    ) : null}
                    <div className="flex items-center gap-1">
                      <button type="button"
                        onClick={() => setDepthStep((cur) => cur === "0.001" ? "0.01" : cur === "0.01" ? "0.1" : cur === "0.1" ? "1" : "0.001")}
                        className="flex h-6 flex-1 items-center justify-between rounded bg-[#2b3139] px-2 text-[11px] leading-none text-[#eaecef]">
                        <span>{depthStep}</span>
                        <span className="text-[10px] leading-none text-[#848e9c]">▾</span>
                      </button>
                      <button type="button" aria-label={t("Order book view")}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[#2b3139] text-[#848e9c]">
                        <span className="text-[11px] leading-none">☰</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 持仓 / 委托（下方全宽）：分段页签已含持仓明细 */}
              <div className="mt-2 flex flex-1 flex-col">
                {mobilePositionsAndOrders}
                {positionsError ? <p className="px-3 text-xs text-brand-danger" role="alert">{positionsError}</p> : null}
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

      {/* 交易对选择弹窗：深色抽屉，搜索 + 遍历 markets */}
      <Dialog open={symbolPickerOpen} onOpenChange={(open) => { setSymbolPickerOpen(open); if (!open) setSymbolSearch(""); }}>
        <DialogContent className="fixed inset-x-0 bottom-0 z-[80] mx-auto w-full max-w-[430px] rounded-t-2xl border border-[#2b3139] bg-[#1e2329] p-0 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] sm:max-w-[430px]">
          <div className="flex items-center gap-2 px-3 pt-3">
            <DialogTitle className="min-w-0 flex-1 text-sm font-bold text-[#eaecef]">{t("Select market")}</DialogTitle>
            <DialogDescription className="sr-only">{t("Choose a perpetual contract symbol")}</DialogDescription>
            <button type="button" onClick={() => setSymbolPickerOpen(false)} className="flex h-7 w-7 items-center justify-center rounded text-brand-text-muted hover:bg-brand-surface-hover" aria-label={t("Close")}>
              <ChevronDown className="h-4 w-4 rotate-180" aria-hidden="true" />
            </button>
          </div>
          <div className="px-3 pt-2">
            <input
              type="text"
              value={symbolSearch}
              onChange={(e) => setSymbolSearch(e.target.value)}
              placeholder={t("Search symbol")}
              className="h-9 w-full rounded-md border border-[#2b3139] bg-[#161a1e] px-3 text-sm text-[#eaecef] outline-none placeholder:text-brand-text-muted focus:border-brand-accent"
            />
          </div>
          <div className="mt-2 max-h-[60vh] overflow-y-auto px-3 pb-2">
            {markets
              .filter((m) => m.symbol.toLowerCase().includes(symbolSearch.trim().toLowerCase()))
              .map((m) => {
                const base = m.base_asset ?? m.symbol.replace(/USDT$/i, "");
                const tk = tickers.find((t) => t.sym.toUpperCase() === base.toUpperCase()) ?? null;
                const chg = tk?.chg ?? null;
                return (
                  <button
                    key={m.symbol}
                    type="button"
                    onClick={() => { setSymbol(m.symbol); setSymbolPickerOpen(false); setSymbolSearch(""); }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left transition-colors hover:bg-[#2b3139]/60",
                      m.symbol === selectedMarket?.symbol ? "bg-[#2b3139]/40" : "",
                    )}
                  >
                    <span className="text-sm font-medium text-[#eaecef]">{m.symbol}</span>
                    <span className="flex items-center gap-3 text-right">
                      <span className="bf-tabular font-mono text-sm text-[#eaecef]">{tk?.price !== undefined && tk?.price !== null ? money(Number(tk.price), locale) : EM_DASH}</span>
                      <span className={cn("bf-tabular w-16 font-mono text-xs", chg !== null ? (chg >= 0 ? "text-brand-success" : "text-brand-danger") : "text-brand-text-muted")}>
                        {chg !== null ? `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%` : EM_DASH}
                      </span>
                    </span>
                  </button>
                );
              })}
            {markets.filter((m) => m.symbol.toLowerCase().includes(symbolSearch.trim().toLowerCase())).length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-brand-text-muted">{t("No matching market")}</p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border border-brand-border bg-brand-surface sm:max-w-[900px]">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
            <DialogTitle className="text-sm font-bold">{t("Chart")} — {selectedMarket?.symbol ?? "BTCUSDT"}</DialogTitle>
            <DialogDescription className="text-xs text-brand-text-muted">{t("Perpetual contract candlestick chart")}</DialogDescription>
          </div>
        </DialogContent>
      </Dialog>

      {/* 移动端底部常驻 K 线抽屉（默认收起） */}
      <div className="lg:hidden">
        <ChartDrawer symbol={selectedMarket?.symbol ?? "BTC/USDT"} />
      </div>
    </>
  );
}

