
import { useEffect, useRef, useState, type FormEvent } from "react";
import { RefreshCw, TrendingUp, TrendingDown, Clock3, ShieldCheck, ShieldAlert, BarChart2, Award } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import {
  getSecondsPositions,
  getSecondsPolicy,
  submitSecondsOrder,
  settleSecondsPosition,
  getMarkets,
  getKlines,
  getAccount,
  type SecondsPositionsSnapshot,
  type SecondsOrderInput,
  type SecondsPolicyResponse,
  type MarketCandle,
  type MarketTicker,
} from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useTrading } from "../../lib/trading";
import { useMarketStream } from "../../lib/useMarketStream";
import { useI18n, localeTags } from "../../lib/i18n";
import { CHART_THEME } from "../../lib/chartTheme";
import { TradeProductNav } from "../trade/TradeProductNav";
import { CandlestickSeries, ColorType, createChart, type UTCTimestamp } from "lightweight-charts";

/**
 * Professional Institutional-Grade Seconds Contract Trading Page
 */
export function SecondsPage() {
  const { t, language } = useI18n();
  const locale = localeTags[language];
  const { status } = useAuth();
  const signedOut = status !== "authenticated";
  const { placeSecondsOrder, settleSecondsTrade, lastSettleResult, dismissSettleResult, openSecondsTrade } = useTrading();
  const { status: marketStatus } = useMarketStream();
  const [snapshot, setSnapshot] = useState<SecondsPositionsSnapshot | null>(null);
  const [policy, setPolicy] = useState<SecondsPolicyResponse | null>(null);
  const [uid, setUid] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const [symbol, setSymbol] = useState("BTC");
  const [duration, setDuration] = useState(30);
  const [amount, setAmount] = useState("50");
  const [submitting, setSubmitting] = useState(false);
  const [clockNow, setClockNow] = useState(Date.now());
  const settling = useRef(new Set<string>());

  const [interval, setIntervalTab] = useState<"line" | "1m" | "5m" | "15m">("line");
  const [chartNode, setChartNode] = useState<HTMLDivElement | null>(null);
  const [candles, setCandles] = useState<MarketCandle[]>([]);
  const [activeTab, setActiveTab] = useState<"open" | "history">("open");
  const [ticker, setTicker] = useState<MarketTicker | null>(null);
  const [availableUSDT, setAvailableUSDT] = useState<string>("0.00");
  const [activeCountdown, setActiveCountdown] = useState<{ dir: "up" | "down"; endsAt: number; amount: string; payout: string } | null>(null);
  // Durable order intent: the exact request is persisted per account+symbol so
  // a network failure can be retried with the SAME request_id (a new id would
  // risk a duplicate position). While it is pending, entry stays locked.
  const [pendingIntent, setPendingIntent] = useState<SecondsOrderInput | null>(null);
  const pendingKey = uid ? "btcbox.seconds.pending.v1." + uid + "." + symbol : "";

  const DURATION_OPTIONS = [
    { sec: 30, rate: 85, label: "30s" },
    { sec: 60, rate: 88, label: "60s" },
    { sec: 180, rate: 90, label: "180s" },
    { sec: 300, rate: 92, label: "300s" },
  ];

  const QUICK_AMOUNTS = [10, 50, 100, 500];



  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // 纸面秒合约自动结算：倒计时归零时对比入场价与到期价
  useEffect(() => {
    if (!openSecondsTrade || openSecondsTrade.ends_at > Date.now()) return;
    const settlePrice = ticker ? ticker.price : openSecondsTrade.entry_price;
    settleSecondsTrade(openSecondsTrade.id, settlePrice);
    setActiveCountdown(null);
    // 结算后刷新后端持仓视图
    getSecondsPositions().then(setSnapshot).catch(() => {});
  }, [openSecondsTrade, clockNow, ticker, settleSecondsTrade]);

  useEffect(() => {
    let cancelled = false;
    const loadMarket = () => {
      getMarkets().then((mkts) => {
        if (cancelled) return;
        const found = mkts.find((m) => m.sym.toUpperCase() === symbol.toUpperCase());
        if (found) setTicker(found);
      }).catch(() => {});
    };
    loadMarket();
    const timer = window.setInterval(loadMarket, 3000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [symbol]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    Promise.allSettled([getAccount(controller.signal), getSecondsPositions(controller.signal), getSecondsPolicy(controller.signal)])
      .then(([accountResult, positionsResult, policyResult]) => {
        if (controller.signal.aborted) return;
        if (accountResult.status === "fulfilled") {
          const accountUid = accountResult.value.uid;
          setUid(accountUid);
          const usdtFree = accountResult.value.balances["USDT"]?.free;
          if (usdtFree !== undefined) setAvailableUSDT(String(usdtFree));
          // Reloading the page must not forget an unconfirmed request: without
          // this the user could submit a second order for the same click.
          if (accountUid) {
            try {
              const stored = window.localStorage.getItem("btcbox.seconds.pending.v1." + accountUid + "." + symbol);
              if (stored) setPendingIntent(JSON.parse(stored) as SecondsOrderInput);
            } catch { /* ignore unreadable storage */ }
          }
        }
        if (positionsResult.status === "fulfilled") setSnapshot(positionsResult.value);
        if (policyResult.status === "fulfilled") setPolicy(policyResult.value);
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);

  useEffect(() => {
    const node = chartNode;
    if (!node) return;
    let cancelled = false;
    const loadKlines = () => {
      const tf = interval === "line" ? "1m" : interval;
      getKlines(symbol + "USDT", tf).then((rows) => {
        if (!cancelled) setCandles(rows);
      }).catch(() => {});
    };
    loadKlines();
    const timer = window.setInterval(loadKlines, 5000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [symbol, interval, chartNode]);

  useEffect(() => {
    const node = chartNode;
    if (!node || !candles.length || node.clientWidth <= 0) return;
    const chart = createChart(node, {
      width: node.clientWidth,
      height: node.clientHeight || 220,
      handleScroll: { vertTouchDrag: false, horzTouchDrag: true },
      handleScale: { pinch: true },
      layout: { attributionLogo: false, background: { type: ColorType.Solid, color: CHART_THEME.background }, textColor: CHART_THEME.text, fontSize: 10 },
      grid: { vertLines: { color: CHART_THEME.grid }, horzLines: { color: CHART_THEME.grid } },
      rightPriceScale: { borderColor: CHART_THEME.border },
      timeScale: { borderColor: CHART_THEME.border, timeVisible: true, secondsVisible: false }
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: CHART_THEME.up, downColor: CHART_THEME.down, borderVisible: false, wickUpColor: CHART_THEME.up, wickDownColor: CHART_THEME.down
    });
    series.setData(candles.map((item) => ({
      time: Math.floor(item.time / 1000) as UTCTimestamp,
      open: item.open, high: item.high, low: item.low, close: item.close
    })).sort((a, b) => Number(a.time) - Number(b.time)));
    chart.timeScale().fitContent();
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) chart.applyOptions({ width: Math.floor(width) });
    });
    observer.observe(node);
    return () => { observer.disconnect(); chart.remove(); };
  }, [candles, chartNode]);

  const refresh = () => setReload((value) => value + 1);

  // Persist / clear the durable intent. Storage failures keep the in-memory
  // guard so the page never silently forgets an in-flight request.
  const persistIntent = (intent: SecondsOrderInput | null) => {
    setPendingIntent(intent);
    if (!pendingKey) return;
    try {
      if (intent) window.localStorage.setItem(pendingKey, JSON.stringify(intent));
      else window.localStorage.removeItem(pendingKey);
    } catch { /* in-memory state still guards this session */ }
  };

  // Retry the stored request as-is: the same request_id makes the server treat
  // it as idempotent, so a retry can never open a second position.
  const sendIntent = async (intent: SecondsOrderInput) => {
    if (submitting) return;
    setSubmitting(true); setError(""); setNotice("");
    try {
      const result = await submitSecondsOrder(intent);
      const latest = await getSecondsPositions();
      setSnapshot(latest);
      // Confirmation comes from the server position list, never from the POST
      // response alone: a request is only "confirmed" when it appears open.
      const confirmed = latest.open.some(position => String(position.position_id || "") !== "");
      if (confirmed) persistIntent(null);
      setNotice(confirmed
        ? (result.duplicate ? t("Order accepted") : t("Position opened successfully. Settlement will occur automatically at expiry."))
        : t("Order could not be confirmed."));
    } catch (reason) {
      // The intent stays persisted: the outcome is unknown, so the user must
      // retry the same request rather than submit a new one.
      setError(reason instanceof Error ? reason.message : t("Order could not be confirmed."));
    } finally { setSubmitting(false); }
  };

  const retryPendingIntent = () => {
    if (pendingIntent) void sendIntent(pendingIntent);
  };

  const submitSeconds = async (dir: "up" | "down") => {
    if (submitting) return;
    // Server policy is authoritative: without an explicit enabling flag the
    // page never sends an order.
    if (policy?.actions_enabled !== true) {
      setError(t("Seconds order entry is currently disabled by server policy."));
      return;
    }
    if (pendingIntent) {
      setError(t("An earlier Seconds request is still unconfirmed. Retry the same request before placing a new one."));
      return;
    }
    const numeric = Number(amount);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setError(t("Enter an amount greater than zero.")); return;
    }
    const intent: SecondsOrderInput = {
      request_id: window.crypto.randomUUID().replace(/-/g, ""),
      symbol,
      direction: dir,
      duration_sec: duration,
      amount: amount.trim()
    };
    persistIntent(intent);
    await sendIntent(intent);
  };

  const currentRate = DURATION_OPTIONS.find((d) => d.sec === duration)?.rate || 85;
  const profitExpect = Number(amount) > 0 ? (Number(amount) * (1 + currentRate / 100)).toFixed(2) : "0.00";
  const openCount = snapshot?.open.length || 0;



  return (
    <>
      <TradeProductNav />
      <div className="relative mx-auto flex w-full max-w-[1520px] min-w-0 flex-col gap-4 p-3 pb-32 sm:gap-5 sm:p-4 md:p-6 lg:p-8 lg:pb-8">
        {/* Ambient multi-layer glow + glass highlight ring, matching Dashboard / Markets. */}
        <div aria-hidden="true" className="pointer-events-none absolute -top-20 right-0 h-72 w-72 rounded-full bg-brand-accent/10 blur-[90px]" />
        <div aria-hidden="true" className="pointer-events-none absolute -top-8 right-10 h-36 w-36 rounded-full bg-brand-accent/20 blur-[45px]" />
        {/* Header & Asset Bar（币安风格：紧凑币种切换行，无大标题卡） */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {["BTC", "ETH", "SOL"].map((coin) => (
              <button key={coin} type="button" onClick={() => setSymbol(coin)} className={`h-9 px-3 rounded-md font-bold text-[13px] transition-all ${symbol === coin ? "bg-brand-accent text-[#05201A]" : "bg-brand-surface border border-brand-border text-brand-text-muted hover:text-brand-text"}`}>
                {coin}/USDT
              </button>
            ))}
          </div>
          <span className="font-mono text-lg font-bold text-brand-text tabular-nums">
            {ticker ? ticker.price.toLocaleString(locale, { minimumFractionDigits: 2 }) : "—"}
            <span className={"ml-2 text-xs font-mono font-bold px-1.5 py-0.5 rounded " + (Number(ticker?.chg || 0) >= 0 ? "text-profit bg-profit/10" : "text-loss bg-loss/10")}>
              {ticker ? (Number(ticker.chg) >= 0 ? "+" : "") + Number(ticker.chg).toFixed(2) + "%" : ""}
            </span>
          </span>
        </div>

        {notice ? <div role="status" className="rounded-xl border border-brand-success/30 bg-brand-success/10 p-3 text-xs font-semibold text-brand-success flex items-center gap-2"><ShieldCheck className="h-4 w-4 shrink-0" />{notice}</div> : null}
        {error ? <div role="alert" className="rounded-xl border border-brand-danger/30 bg-brand-danger/10 p-3 text-xs font-semibold text-brand-danger flex items-center gap-2"><ShieldAlert className="h-4 w-4 shrink-0" />{error}</div> : null}
        {pendingIntent ? (
          <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-accent/30 bg-brand-accent/10 p-3 text-xs font-semibold text-brand-text">
            <span className="min-w-0">{t("An earlier Seconds request is still unconfirmed. Retry the same request before placing a new one.")}</span>
            <Button type="button" size="sm" variant="outline" disabled={submitting} onClick={retryPendingIntent} className="h-9 shrink-0">{t("Retry same request")}</Button>
          </div>
        ) : null}

        {/* Grid Workspace: Chart + Order Entry */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(380px,1fr)]">
          {/* Left: Chart & Market Ticker */}
          <div className="space-y-4">
            <Card className="border-brand-border bg-brand-surface shadow-xl overflow-hidden">
              <CardHeader className="py-3 px-4 border-b border-brand-border/40 flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-lg font-bold text-brand-text">{ticker ? ticker.price.toLocaleString(locale, { minimumFractionDigits: 2 }) : "—"} USDT</span>
                  <span className={"text-xs font-mono font-bold px-2 py-0.5 rounded " + (Number(ticker?.chg || 0) >= 0 ? "text-profit bg-profit/10" : "text-loss bg-loss/10")}>
                    {ticker ? (Number(ticker.chg) >= 0 ? "+" : "") + Number(ticker.chg).toFixed(2) + "%" : "+0.00%"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {(["line", "1m", "5m", "15m"] as const).map((tf) => (
                    <button key={tf} type="button" onClick={() => setIntervalTab(tf)} className={`h-7 px-2.5 rounded-lg text-xs font-semibold transition-colors ${interval === tf ? "bg-brand-accent/20 text-brand-accent" : "text-brand-text-muted hover:text-brand-text"}`}>
                      {tf === "line" ? t("Line") : tf}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="p-3">
                <div ref={setChartNode} className="h-[280px] sm:h-[340px] w-full" />
              </CardContent>
            </Card>
          </div>

          {/* Right: Seconds Entry Form */}
          <Card className="border-brand-border bg-brand-surface shadow-xl">
            <CardHeader className="pb-3 border-b border-brand-border/40">
              <CardTitle className="text-base font-bold flex items-center gap-2"><Award className="h-4 w-4 text-brand-accent" />{t("Instant Order Entry")}</CardTitle>
              <CardDescription>{t("Select duration and direction to execute policy-driven position.")}</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2 text-xs">
                  <span className="text-brand-text-muted font-medium">{t("Settlement duration")}</span>
                  <span className="text-brand-accent font-mono font-bold">Payout: +{currentRate}%</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {DURATION_OPTIONS.map((opt) => (
                    <button key={opt.sec} type="button" onClick={() => setDuration(opt.sec)} className={`flex flex-col items-center justify-center py-1.5 rounded-xl border transition-all ${duration === opt.sec ? "border-brand-accent bg-brand-accent/20 text-brand-accent shadow-sm shadow-brand-accent/20 font-bold" : "border-brand-border/50 bg-brand-surface text-brand-text-muted hover:border-brand-border-strong hover:text-brand-text"}`}>
                      <span className="font-mono text-xs">{opt.label}</span>
                      <span className="text-[9px] opacity-70">+{opt.rate}%</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-brand-text-muted font-medium">{t("Investment amount")} (USDT)</span>
                  <span className="text-brand-text-muted font-mono">{t("Available")}: <strong className="text-brand-text">{Number(availableUSDT).toFixed(2)}</strong></span>
                </div>
                <div className="flex items-center rounded-xl border border-brand-border bg-brand-surface-2 h-12 px-3 focus-within:border-brand-accent">
                  <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="h-full flex-1 bg-transparent font-mono text-sm text-brand-text outline-none placeholder:text-brand-text-muted" />
                  <span className="text-xs font-bold text-brand-text-muted">USDT</span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  {QUICK_AMOUNTS.map((val) => (
                    <button key={val} type="button" onClick={() => setAmount(String(val))} className={`h-7 flex-1 rounded-lg border border-brand-border/60 bg-brand-surface-2 text-xs font-mono font-medium text-brand-text-muted hover:border-brand-accent hover:text-brand-accent ${amount === String(val) ? "border-brand-accent text-brand-accent bg-brand-accent/10" : ""}`}>
                      {val}
                    </button>
                  ))}
                  <button type="button" onClick={() => setAmount(Number(availableUSDT) > 0 ? String(Math.floor(Number(availableUSDT))) : "100")} className="h-7 px-3 rounded-lg border border-brand-border/60 bg-brand-surface-2 text-xs font-semibold text-brand-text-muted hover:border-brand-accent hover:text-brand-accent">
                    {t("Max")}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs px-1 text-brand-text-muted p-2.5 rounded-xl bg-brand-surface-2/50 border border-brand-border/40">
                <span>{t("Expected return")}</span>
                <span className="font-mono font-bold text-sm text-brand-text"><strong className="text-profit">{profitExpect}</strong> USDT</span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button type="button" disabled={submitting || !!pendingIntent} onClick={() => submitSeconds("up")} className="h-11 rounded-md bg-profit text-[#05201A] font-bold text-[15px] flex items-center justify-center gap-2 hover:bg-profit/90 active:scale-[0.99] transition-transform disabled:opacity-50">
                  <TrendingUp className="h-5 w-5 stroke-[2.5]" />
                  <span>{t("Buy up (long)")} (+{currentRate}%)</span>
                </button>
                <button type="button" disabled={submitting || !!pendingIntent} onClick={() => submitSeconds("down")} className="h-11 rounded-md bg-loss text-white font-bold text-[15px] flex items-center justify-center gap-2 hover:bg-loss/90 active:scale-[0.99] transition-transform disabled:opacity-50">
                  <TrendingDown className="h-5 w-5 stroke-[2.5]" />
                  <span>{t("Buy down (short)")} (+{currentRate}%)</span>
                </button>
              </div>
              {activeCountdown ? (
                <div className="rounded-xl border border-brand-accent/40 bg-brand-accent/[0.06] p-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-bold text-brand-text">
                      {activeCountdown.dir === "up" ? <TrendingUp className="h-4 w-4 text-profit" /> : <TrendingDown className="h-4 w-4 text-loss" />}
                      {activeCountdown.dir === "up" ? t("Buy up (long)") : t("Buy down (short)")}
                    </span>
                    <span className="font-mono text-2xl font-bold tabular-nums text-brand-accent">
                      {Math.max(0, Math.ceil((activeCountdown.endsAt - clockNow) / 1000))}s
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-brand-text-muted">
                    <span>{t("Stake")} {activeCountdown.amount} USDT</span>
                    <span>{t("Expected return")} <span className="font-mono font-semibold tabular-nums text-profit">{activeCountdown.payout} USDT</span></span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-surface-2">
                    <div className="h-full rounded-full bg-brand-accent transition-all duration-1000" style={{ width: `${Math.min(100, Math.max(0, (activeCountdown.endsAt - clockNow) / (duration * 1000) * 100))}%` }} />
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {/* Bottom Positions & History Tab */}
        <Card className="border-brand-border bg-brand-surface shadow-xl">
          <CardHeader className="pb-0 border-b border-brand-border/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6" role="tablist">
                <button type="button" role="tab" aria-selected={activeTab === "open"} onClick={() => setActiveTab("open")} className={`relative pb-3 text-xs font-bold transition-colors ${activeTab === "open" ? "text-brand-text" : "text-brand-text-muted hover:text-brand-text-secondary"}`}>
                  {t("Open positions")} ({openCount})
                  {activeTab === "open" ? <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-brand-accent" /> : null}
                </button>
                <button type="button" role="tab" aria-selected={activeTab === "history"} onClick={() => setActiveTab("history")} className={`relative pb-3 text-xs font-bold transition-colors ${activeTab === "history" ? "text-brand-text" : "text-brand-text-muted hover:text-brand-text-secondary"}`}>
                  {t("History")}
                  {activeTab === "history" ? <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-brand-accent" /> : null}
                </button>
              </div>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={refresh}>
                <RefreshCw className={"h-3.5 w-3.5 " + (loading ? "animate-spin" : "")} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {activeTab === "open" ? (
              snapshot?.open.length ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {snapshot.open.map((item) => {
                    const directionUp = item.direction === "up";
                    const secondsLeft = Math.max(0, Math.ceil((item.settle_at * 1000 - clockNow) / 1000));
                    return (
                      <div key={item.position_id} className="p-4 rounded-xl bg-brand-surface-2/60 border border-brand-border/50 flex items-center justify-between text-xs font-mono">
                        <div>
                          <div className="flex items-center gap-2 font-bold text-brand-text">
                            <span>{item.symbol}/USDT</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${directionUp ? "bg-profit/15 text-profit" : "bg-loss/15 text-loss"}`}>
                              {directionUp ? "↑ " + t("Up") : "↓ " + t("Down")} ({item.duration_sec}s)
                            </span>
                          </div>
                          <p className="text-[11px] text-brand-text-muted mt-1.5">
                            {t("Principal")}: <strong className="text-brand-text">{item.amount}</strong> · {t("Entry")}: <strong className="text-brand-text">{item.open_price}</strong>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-brand-accent font-bold text-base">{secondsLeft > 0 ? secondsLeft + "s" : t("Settling…")}</p>
                          <p className="text-[10px] text-brand-text-muted">{t("Remaining")}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-10 text-center text-xs text-brand-text-muted">{t("No active seconds contract positions.")}</div>
              )
            ) : (
              snapshot?.history.length ? (
                <div className="space-y-2">
                  {snapshot.history.map((item) => {
                    const isWin = item.win;
                    const isTie = item.tie;
                    return (
                      <div key={item.position_id} className="p-3.5 rounded-xl bg-brand-surface-2/40 border border-brand-border/40 flex items-center justify-between text-xs font-mono">
                        <div>
                          <p className="font-semibold text-brand-text text-sm">{item.symbol}/USDT · {item.duration_sec}s</p>
                          <p className="text-[11px] text-brand-text-muted mt-0.5">{t("Investment")}: {item.amount} USDT</p>
                        </div>
                        <div className="text-right">
                          <span className={`font-bold text-sm ${isWin ? "text-profit" : isTie ? "text-brand-text-secondary" : "text-loss"}`}>
                            {isWin ? "+" + item.pnl : isTie ? "0.00" : item.pnl} USDT
                          </span>
                          <p className="text-[10px] text-brand-text-muted uppercase">{isWin ? t("Win") : isTie ? t("Tie") : t("Loss")}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-10 text-center text-xs text-brand-text-muted">{t("No settlement history records.")}</div>
              )
            )}
          </CardContent>
        </Card>
      </div>
      {lastSettleResult ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-2xl border border-brand-border bg-brand-surface p-6 text-center shadow-overlay">
            <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${lastSettleResult.outcome === "won" ? "bg-brand-success/15 text-brand-success" : lastSettleResult.outcome === "tie" ? "bg-brand-text-muted/15 text-brand-text-muted" : "bg-brand-danger/15 text-brand-danger"}`}>
              {lastSettleResult.outcome === "won" ? <TrendingUp className="h-7 w-7" /> : lastSettleResult.outcome === "tie" ? <Clock3 className="h-7 w-7" /> : <TrendingDown className="h-7 w-7" />}
            </div>
            <h3 className="mt-4 text-lg font-bold text-brand-text">
              {lastSettleResult.outcome === "won" ? t("Congratulations! Profitable settlement") : lastSettleResult.outcome === "tie" ? t("Tie settlement") : t("This round was a loss")}
            </h3>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums" style={{ color: lastSettleResult.outcome === "won" ? CHART_THEME.up : lastSettleResult.outcome === "tie" ? CHART_THEME.text : CHART_THEME.down }}>
              {lastSettleResult.outcome === "won" ? "+" : lastSettleResult.outcome === "tie" ? "" : "-"}{lastSettleResult.payout.toFixed(2)} USDT
            </p>
            <p className="mt-1 text-xs text-brand-text-muted">{t("Staked principal")} {lastSettleResult.amount.toFixed(2)} USDT</p>
            <button type="button" onClick={dismissSettleResult} className="mt-5 flex min-h-11 w-full items-center justify-center rounded-xl bg-brand-accent text-sm font-bold text-[#05201A] transition-colors hover:bg-brand-accent/90">
              {t("Got it")}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}


