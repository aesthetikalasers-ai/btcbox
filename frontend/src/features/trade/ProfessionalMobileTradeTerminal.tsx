import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../../lib/i18n";
import { getMarkets, getOrderBook, type MarketTicker, type OrderBookSnapshot } from "../../lib/api";
import { ChartDrawer } from "./ChartDrawer";

type ActionSide = "long" | "short";
type OrderType = "limit" | "market";

const SYMBOL = "BTCUSDT";
const PAIR_LABEL = "BTC/USDT";
const LEVERAGE_OPTIONS = [10, 20, 50, 100] as const;
const RATIO_OPTIONS = [25, 50, 75, 100] as const;
const REFRESH_INTERVAL_MS = 5000;

/**
 * BTCBOX mobile spot trade terminal (reference layout).
 *
 * Read-only market snapshot plus a local working draft of the order ticket.
 * Order submission routes through the shared order-entry flow on the desktop
 * terminal; this screen keeps market price, order book, and ticket state in
 * sync without issuing duplicate REST orders.
 */
export default function ProfessionalMobileTradeTerminal() {
  const { t } = useI18n();
  const [actionSide, setActionSide] = useState<ActionSide>("long");
  const [orderType, setOrderType] = useState<OrderType>("limit");
  const [leverage, setLeverage] = useState<number>(20);
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [ratio, setRatio] = useState<number>(0);

  const [ticker, setTicker] = useState<MarketTicker | null>(null);
  const [book, setBook] = useState<OrderBookSnapshot | null>(null);
  const [feedError, setFeedError] = useState(false);
  const mountedRef = useRef(false);

  const refreshMarketData = useCallback(async (signal: AbortSignal) => {
    try {
      const rows = await getMarkets(signal);
      if (signal.aborted) return;
      const found = rows.find((item) => item.sym.toUpperCase().startsWith("BTC")) || null;
      setTicker(found);
      setFeedError(false);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      if (mountedRef.current) setFeedError(true);
    }
    try {
      const snapshot = await getOrderBook(SYMBOL, signal);
      if (signal.aborted) return;
      setBook(snapshot);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setBook(null);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();
    void refreshMarketData(controller.signal);
    const timer = window.setInterval(() => {
      const pollController = new AbortController();
      void refreshMarketData(pollController.signal);
    }, REFRESH_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [refreshMarketData]);

  const asks = useMemo(() => (book ? book.asks.slice(0, 6).reverse() : []), [book]);
  const bids = useMemo(() => (book ? book.bids.slice(0, 6) : []), [book]);
  const lastPrice = ticker?.price ?? null;
  const changePct = ticker?.chg ?? 0;

  const maxSize = useMemo(() => {
    let max = 0;
    for (const [, amount] of [...asks, ...bids]) {
      const value = Number(amount);
      if (Number.isFinite(value) && value > max) max = value;
    }
    return max;
  }, [asks, bids]);

  const applyRatio = (pct: number) => {
    setRatio(pct);
    if (pct <= 0) {
      setQuantity("");
      return;
    }
    const unitPrice = orderType === "limit" ? Number(price) : lastPrice ?? 0;
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) return;
    const notional = (12450 * pct) / 100;
    setQuantity((notional / unitPrice).toFixed(4).replace(/\.?0+$/, ""));
  };

  const formatPrice = (value: number | null | undefined) =>
    value === null || value === undefined || !Number.isFinite(value)
      ? "—"
      : value.toLocaleString("en-US", { maximumFractionDigits: 8 });
  const formatAmount = (value: string | number | undefined) =>
    value === undefined || value === "" ? "—" : String(value);

  const up = changePct >= 0;

  return (
    <div className="relative flex min-h-screen w-full select-none flex-col overflow-x-hidden bg-[#0b0e11] pb-16 font-sans text-white">
      <div className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#161a1e]">
        <div className="flex items-center justify-between gap-2 px-3 py-1">
          <div className="flex min-w-0 items-center space-x-1.5">
            <span className="truncate text-xs font-black tracking-wide text-brand-text">{PAIR_LABEL}</span>
            <span className="shrink-0 rounded-[4px] bg-[#0ecb81]/15 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[#0ecb81]">{t("Spot")}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className={`tnum text-lg font-black ${up ? "text-[#0ecb81]" : "text-[#f6465d]"}`}>
              {formatPrice(lastPrice)}
            </span>
            <span className={`tnum rounded px-1.5 py-0.5 text-[10px] font-bold ${up ? "bg-[#0ecb81]/15 text-[#0ecb81]" : "bg-[#f6465d]/15 text-[#f6465d]"}`}>
              {up ? "▲" : "▼"} {Math.abs(changePct).toFixed(2)}%
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 px-3 py-0.5 text-[10px] text-brand-text-muted">
          <span className="tnum truncate">24H {t("High")} {ticker?.high ? formatPrice(ticker.high) : "—"}</span>
          <span className="tnum truncate">24H {t("Volume")} {ticker?.vol ?? "—"}</span>
          <span className="tnum truncate">24H {t("Low")} {ticker?.low ? formatPrice(ticker.low) : "—"}</span>
        </div>
      </div>

      {feedError && (
        <p className="px-3 py-1 text-[10px] text-[#f6465d]" role="status">
          {t("Live market data is temporarily unavailable.")}
        </p>
      )}

      <div className="border-b border-white/10 bg-[#161a1e]">
        <div className="grid grid-cols-12 gap-2 px-3 pb-2 pt-2">
          <div className="col-span-7 flex flex-col space-y-1.5">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-black/40 p-0.5 text-[11px] font-bold">
              <button type="button" onClick={() => setActionSide("long")} className={`rounded-md py-1 ${actionSide === "long" ? "bg-[#2b3139] text-white" : "text-gray-400"}`}>
                {t("Long")}
              </button>
              <button type="button" onClick={() => setActionSide("short")} className={`rounded-md py-1 ${actionSide === "short" ? "bg-[#2b3139] text-white" : "text-gray-400"}`}>
                {t("Short")}
              </button>
            </div>

            <div className="rounded-lg border border-white/10 bg-black/30 p-1.5">
              <div className="flex items-center justify-between px-0.5 text-[10px] text-gray-400">
                <span>{t("Leverage")}</span>
                <span className="font-bold text-[#0ecb81] tabular-nums">{leverage}x</span>
              </div>
              <div className="mt-1 grid grid-cols-4 gap-1">
                {LEVERAGE_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setLeverage(option)}
                    className={`py-1 rounded text-[11px] font-bold transition-colors ${leverage === option ? "bg-[#0ecb81]/15 text-[#0ecb81]" : "text-gray-400 hover:text-white"}`}
                  >
                    {option}x
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1 rounded-lg bg-black/40 p-0.5 text-[11px] font-bold">
              <button type="button" onClick={() => setOrderType("limit")} className={`rounded-md py-1 transition-all ${orderType === "limit" ? "bg-[#2b3139] text-white" : "text-gray-400"}`}>
                {t("Limit")}
              </button>
              <button type="button" onClick={() => setOrderType("market")} className={`rounded-md py-1 transition-all ${orderType === "market" ? "bg-[#2b3139] text-white" : "text-gray-400"}`}>
                {t("Market")}
              </button>
            </div>

            {orderType === "limit" && (
              <div className="rounded-lg border border-white/10 bg-black/40 px-2 py-1">
                <div className="text-[9px] text-gray-400">{t("Price (USDT)")}</div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  placeholder={formatPrice(lastPrice)}
                  className="w-full bg-transparent text-xs font-bold tabular-nums text-white outline-none"
                />
              </div>
            )}

            <div className="rounded-lg border border-white/10 bg-black/40 px-2 py-1">
              <div className="text-[9px] text-gray-400">{t("Amount (BTC)")}</div>
              <input
                type="text"
                inputMode="decimal"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="0.00"
                className="w-full bg-transparent text-xs font-bold tabular-nums text-white outline-none"
              />
            </div>

            <div className="pt-0.5">
              <input
                type="range"
                min={0}
                max={100}
                step={25}
                value={ratio}
                onChange={(event) => applyRatio(Number(event.target.value))}
                className="h-1 w-full accent-[#0ecb81]"
                aria-label={t("Position ratio")}
              />
              <div className="mt-1 grid grid-cols-4 gap-1">
                {RATIO_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => applyRatio(option)}
                    className={`flex min-h-9 items-center justify-center rounded-md border text-[10px] font-semibold tabular-nums transition-colors ${ratio === option ? "border-[#0ecb81]/40 text-[#0ecb81]" : "border-white/10 text-gray-400 hover:text-white"}`}
                  >
                    {option}%
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between px-0.5 text-[10px] tabular-nums text-gray-400">
              <span>{t("Available")}</span>
              <span className="font-semibold text-white">12,450.00 USDT</span>
            </div>
          </div>

          <div className="col-span-5 flex flex-col text-[10px] tabular-nums">
            <div className="grid grid-cols-[1.1fr_0.9fr] border-b border-white/5 pb-1 font-semibold text-[9px] text-gray-400">
              <span>{t("Price")}</span>
              <span className="text-right">{t("Amount")}</span>
            </div>
            <div className="flex flex-col">
              {asks.map((row, index) => {
                const depth = maxSize ? (Number(row[1]) / maxSize) * 100 : 0;
                return (
                  <div key={`ask-${index}`} className="relative grid h-[18px] grid-cols-[1.1fr_0.9fr] leading-[18px]">
                    <span className="absolute inset-y-0 right-0 bg-[#f6465d]/10" style={{ width: `${depth}%` }} />
                    <span className="relative text-left text-[#f6465d]">{formatPrice(Number(row[0]))}</span>
                    <span className="relative text-right text-gray-300">{formatAmount(row[1])}</span>
                  </div>
                );
              })}
            </div>
            <div className="my-1 py-1.5 text-center">
              <span className="text-sm font-black text-[#0ecb81]">{formatPrice(lastPrice)}</span>
            </div>
            <div className="flex flex-col">
              {bids.map((row, index) => {
                const depth = maxSize ? (Number(row[1]) / maxSize) * 100 : 0;
                return (
                  <div key={`bid-${index}`} className="relative grid h-[18px] grid-cols-[1.1fr_0.9fr] leading-[18px]">
                    <span className="absolute inset-y-0 right-0 bg-[#0ecb81]/10" style={{ width: `${depth}%` }} />
                    <span className="relative text-left text-[#0ecb81]">{formatPrice(Number(row[0]))}</span>
                    <span className="relative text-right text-gray-300">{formatAmount(row[1])}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 px-3 pt-2">
        <button
          type="button"
          onClick={() => setActionSide("long")}
          className={`rounded-xl py-3 text-xs font-black tracking-wider transition-all active:scale-[0.98] ${actionSide === "long"
            ? "bg-gradient-to-r from-[#0ecb81] to-[#0ab371] text-gray-950 shadow-[0_4px_20px_rgba(14,203,129,0.45)]"
            : "border border-[#0ecb81]/40 bg-[#0ecb81]/20 text-[#0ecb81]"}`}
        >
          {t("Open long")}
        </button>
        <button
          type="button"
          onClick={() => setActionSide("short")}
          className={`rounded-xl py-3 text-xs font-black tracking-wider transition-all active:scale-[0.98] ${actionSide === "short"
            ? "bg-gradient-to-r from-[#f6465d] to-[#d9384f] text-white shadow-[0_4px_20px_rgba(246,70,93,0.45)]"
            : "border border-[#f6465d]/40 bg-[#f6465d]/20 text-[#f6465d]"}`}
        >
          {t("Open short")}
        </button>
      </div>

      <div className="px-3 pt-2">
        <div className="flex space-x-6 border-b border-white/10 pb-2 text-xs font-bold">
          <span className="border-b-2 border-[#0ecb81] pb-2 text-[#0ecb81]">{t("Open positions")} (0)</span>
          <span className="text-gray-400">{t("Open orders")} (0)</span>
        </div>
      </div>

      <ChartDrawer symbol={PAIR_LABEL} marketType="spot" />

      <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between border-t border-white/10 bg-[#161a1e] px-4 py-2 text-xs">
        <button type="button" className="text-gray-400">{t("Home")}</button>
        <button type="button" className="text-gray-400">{t("Markets")}</button>
        <button type="button" className="relative font-bold text-[#0ecb81]">
          <span>{t("Trade")}</span>
          <div className="absolute -top-2 h-1 w-5 rounded-full bg-[#0ecb81] shadow-[0_0_8px_rgba(14,203,129,0.8)]" />
        </button>
        <button type="button" className="text-gray-400">{t("Assets")}</button>
        <button type="button" className="text-gray-400">{t("Profile")}</button>
      </div>
    </div>
  );
}
