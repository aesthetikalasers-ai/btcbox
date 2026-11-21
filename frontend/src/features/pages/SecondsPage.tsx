
import { useEffect, useState } from "react";
import { RefreshCw, TrendingUp, TrendingDown, ShieldCheck, ShieldAlert, Award, ChevronDown } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader } from "../../components/ui/card";
import {
  getSecondsPositions,
  getSecondsPolicy,
  submitSecondsOrder,
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
import { useI18n, localeTags } from "../../lib/i18n";
import { Link } from "react-router-dom";
import { BottomOrderPanel, BottomPanelEmpty } from "../trade/BottomOrderPanel";
import { TradeProductNav } from "../trade/TradeProductNav";
import { MarketPickerDialog } from "../trade/MarketPickerDialog";
import { TradesPanel } from "../trade/TradesPanel";
import { CHART_THEME } from "../../lib/chartTheme";
import { CandlestickSeries, ColorType, createChart, type UTCTimestamp } from "lightweight-charts";

/**
 * Professional Institutional-Grade Seconds Contract Trading Page
 */
export function SecondsPage() {
  const { t, language } = useI18n();
  const locale = localeTags[language];
  const { status } = useAuth();
  const signedOut = status !== "authenticated";
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

  const [interval, setIntervalTab] = useState<"line" | "1m" | "5m" | "15m">("line");
  const [chartNode, setChartNode] = useState<HTMLDivElement | null>(null);
  const [candles, setCandles] = useState<MarketCandle[]>([]);
  const [symbolPickerOpen, setSymbolPickerOpen] = useState(false);
  // 持仓 / 当前委托 / 历史 — the same three tabs the perpetual terminal uses.
  const [activeTab, setActiveTab] = useState<"positions" | "orders" | "history">("positions");
  const [bottomExpanded, setBottomExpanded] = useState(true);
  const [ticker, setTicker] = useState<MarketTicker | null>(null);
  const [availableUSDT, setAvailableUSDT] = useState<string | null>(null);
  // Durable order intent: the exact request is persisted per account+symbol so
  // a network failure can be retried with the SAME request_id (a new id would
  // risk a duplicate position). While it is pending, entry stays locked.
  const [pendingIntent, setPendingIntent] = useState<SecondsOrderInput | null>(null);
  const pendingKey = uid ? "btcbox.seconds.pending.v1." + uid + "." + symbol : "";

  const QUICK_AMOUNTS = [10, 50, 100, 500] as const;
  const currentRate = policy ? policy.policy.payout_bps / 100 : null;
  const durationOptions = policy
    ? policy.policy.durations_sec.map((sec) => ({ sec, label: `${sec}s` }))
    : [];
  const minStake = policy ? Number(policy.policy.min_stake) : null;
  const maxStake = policy ? Number(policy.policy.max_stake) : null;
  const quickAmounts = policy?.actions_enabled === true && minStake !== null && maxStake !== null && availableUSDT !== null
    ? QUICK_AMOUNTS.filter((value) => value >= minStake && value <= maxStake && value <= Number(availableUSDT))
    : [];



  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

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
          if (usdtFree !== undefined && usdtFree !== null && Number.isFinite(Number(usdtFree)) && Number(usdtFree) >= 0) setAvailableUSDT(String(usdtFree));
          else setAvailableUSDT(null);
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
      height: node.clientHeight || 195,
      handleScroll: { vertTouchDrag: false, horzTouchDrag: true },
      handleScale: { pinch: true },
      layout: { attributionLogo: false, background: { type: ColorType.Solid, color: CHART_THEME.background }, textColor: CHART_THEME.text, fontSize: 10 },
      grid: { vertLines: { color: CHART_THEME.grid }, horzLines: { color: CHART_THEME.grid } },
      rightPriceScale: { borderColor: CHART_THEME.border },
      timeScale: { borderColor: CHART_THEME.border, timeVisible: true, secondsVisible: false, rightOffset: 6, minBarSpacing: 5 }
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: CHART_THEME.up, downColor: CHART_THEME.down, borderVisible: false, wickUpColor: CHART_THEME.up, wickDownColor: CHART_THEME.down
    });
    series.setData(candles.map((item) => ({
      time: Math.floor(item.time) as UTCTimestamp,
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
    if (!policy) {
      setError(t("The active seconds policy is unavailable. No order was sent."));
      return;
    }
    if (availableUSDT === null) {
      setError(t("Your available balance could not be verified. No order was sent."));
      return;
    }
    const numeric = Number(amount);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setError(t("Enter an amount greater than zero.")); return;
    }
    if (minStake === null || maxStake === null || numeric < minStake || numeric > maxStake) {
      setError(t("Amount is outside the active policy limits."));
      return;
    }
    if (numeric > Number(availableUSDT)) {
      setError(t("Insufficient available USDT balance."));
      return;
    }
    if (!policy.policy.symbols.includes(symbol) || !policy.policy.durations_sec.includes(duration)) {
      setError(t("This market or duration is not enabled by the active policy."));
      return;
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

  const profitExpect = currentRate !== null && Number(amount) > 0
    ? (Number(amount) * (1 + currentRate / 100)).toFixed(2)
    : "—";

  useEffect(() => {
    if (!policy) return;
    if (!policy.policy.symbols.includes(symbol)) setSymbol(policy.policy.symbols[0] ?? "");
    if (!policy.policy.durations_sec.includes(duration)) setDuration(policy.policy.durations_sec[0] ?? 0);
  }, [policy, symbol, duration]);
  const openCount = snapshot?.open.length || 0;



  return (
    <>
      <h1 className="sr-only">{t("Seconds contracts")}</h1>
      {/* The global header owns the product switcher (Spot / Perpetual /
          Seconds / Earn). Rendering a second copy here duplicated the tabs and
          cost a full row above the workspace. */}
      <div className="relative mx-auto flex w-full max-w-[1520px] min-w-0 flex-col gap-4 p-3 pb-6 sm:gap-5 sm:p-4 sm:pb-8 md:p-6 lg:p-8">
        {/* Ambient multi-layer glow + glass highlight ring, matching Dashboard / Markets. */}
        <div aria-hidden="true" className="pointer-events-none absolute -top-20 right-0 h-72 w-72 rounded-full bg-brand-accent/10 blur-[90px]" />
        <div aria-hidden="true" className="pointer-events-none absolute -top-8 right-10 h-36 w-36 rounded-full bg-brand-accent/20 blur-[45px]" />
        {/* 统一二级导航（现货 / 永续 / 秒合约 / 理财），与其它交易视图同款 */}
        <TradeProductNav />
        {/* 币对选择（下拉）+ 最新价 + 涨跌幅：单行不折，价格与标签都不硬切 */}
        <div className="flex min-w-0 items-center gap-2">
          <button type="button" onClick={() => setSymbolPickerOpen(true)} aria-haspopup="dialog" aria-expanded={symbolPickerOpen}
            aria-label={t("Select market")}
            className="flex h-9 shrink-0 items-center gap-1 rounded-lg border border-brand-border bg-brand-surface px-2.5 text-[15px] font-bold leading-none text-brand-text transition-colors hover:border-brand-accent/50 hover:text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/40">
            <span className="font-mono tabular-nums">{symbol}/USDT</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-brand-text-muted" aria-hidden="true" />
          </button>
          <div className="ml-auto flex shrink-0 items-baseline gap-1.5 whitespace-nowrap" aria-live="polite">
            <span className="font-mono text-[20px] font-bold leading-none tabular-nums text-brand-text sm:text-2xl">
              {ticker ? ticker.price.toLocaleString(locale, { minimumFractionDigits: 2 }) : "—"}
            </span>
            {ticker ? (
              <span className={"shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums " + (Number(ticker.chg) >= 0 ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss")}>
                {(Number(ticker.chg) >= 0 ? "+" : "") + Number(ticker.chg).toFixed(2) + "%"}
              </span>
            ) : null}
          </div>
        </div>

        {notice ? <div role="status" className="rounded-xl border border-brand-success/30 bg-brand-success/10 p-3 text-xs font-semibold text-brand-success flex items-center gap-2"><ShieldCheck className="h-4 w-4 shrink-0" />{notice}</div> : null}
        {error ? <div role="alert" className="rounded-xl border border-brand-danger/30 bg-brand-danger/10 p-3 text-xs font-semibold text-brand-danger flex items-center gap-2"><ShieldAlert className="h-4 w-4 shrink-0" />{error}</div> : null}

        {/* 未登录引导：与现货/永续使用同一套文案与按钮 */}
        {signedOut ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-border bg-brand-surface px-3 py-2.5">
            <p className="text-xs text-brand-text-muted">{t("Please sign in to view your account data")}</p>
            <Button asChild size="sm" variant="outline" className="h-8 shrink-0"><Link to="/login">{t("Go to sign in")}</Link></Button>
          </div>
        ) : null}
        {pendingIntent ? (
          <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-accent/30 bg-brand-accent/10 p-3 text-xs font-semibold text-brand-text">
            <span className="min-w-0">{t("An earlier Seconds request is still unconfirmed. Retry the same request before placing a new one.")}</span>
            <Button type="button" size="sm" variant="outline" disabled={submitting} onClick={retryPendingIntent} className="h-9 shrink-0">{t("Retry same request")}</Button>
          </div>
        ) : null}

        {/* Grid Workspace: Chart + Order Entry */}
        <div className="grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* Left: Chart & Market Ticker */}
          <div className="space-y-3 sm:space-y-4">
            <Card className="border-brand-border bg-brand-surface shadow-xl overflow-hidden">
              <CardHeader className="flex min-w-0 flex-row items-center justify-between gap-2 border-b border-brand-border/40 px-3 py-2 sm:px-4">
                <div className="flex min-w-0 shrink-0 items-center gap-1.5 whitespace-nowrap">
                  <span className="font-mono text-sm font-bold text-brand-text">{symbol}/USDT</span>
                </div>
                {/* 周期栏：横向滚动 + shrink-0，任何语言下「分时」都不竖排/半截硬切 */}
                <div className="no-scrollbar -mr-1 flex min-w-0 flex-1 items-center justify-end gap-0.5 overflow-x-auto whitespace-nowrap">
                  {(["line", "1m", "5m", "15m"] as const).map((tf) => (
                    <button key={tf} type="button" onClick={() => setIntervalTab(tf)}
                      className={`h-7 shrink-0 whitespace-nowrap rounded-lg px-2 text-[11px] font-semibold sm:px-2.5 sm:text-xs ${interval === tf ? "bg-brand-accent/20 text-brand-accent" : "text-brand-text-muted hover:text-brand-text"}`}>
                      {tf === "line" ? t("Line") : tf}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="p-2 sm:p-3">
                <div ref={setChartNode} className="h-[195px] sm:h-[320px] md:h-[360px] w-full" />
              </CardContent>
            </Card>
          </div>

          {/* Right: entry form — flat, hairline-divided, same density as the spot / perpetual terminals */}
          <section aria-label={t("Instant Order Entry")} className="flex min-w-0 flex-col">
            <div className="flex min-w-0 items-baseline justify-between gap-2 border-b border-brand-border/60 pb-1.5">
              <h2 className="flex shrink-0 items-center gap-1.5 text-[13px] font-bold text-brand-text"><Award className="h-4 w-4 text-brand-accent" aria-hidden="true" />{t("Instant Order Entry")}</h2>
              <p className="truncate text-[11px] text-brand-text-muted">{t("Pick a duration and direction; the round settles automatically.")}</p>
            </div>
            <div className="space-y-2.5 pt-2">
              <div>
                <div className="flex justify-between items-center mb-2 text-xs">
                  <span className="text-brand-text-muted font-medium">{t("Settlement duration")}</span>
                  <span className="text-brand-accent font-mono font-bold">{t("Return rate")}: {currentRate === null ? "—" : `+${currentRate.toFixed(2)}%`}</span>
                </div>
                {!policy ? <p role="status" className="mb-2 text-xs text-brand-text-muted">{t("The active seconds policy is unavailable. Payout rates and order entry are disabled until it can be verified.")}</p> : null}
                {policy && !policy.actions_enabled ? <p role="status" className="mb-2 text-xs text-brand-text-muted">{t("Seconds order entry is currently disabled by server policy.")}</p> : null}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {durationOptions.map((opt) => (
                    <button key={opt.sec} type="button" disabled={!policy || policy.actions_enabled !== true} onClick={() => setDuration(opt.sec)} className={`flex flex-col items-center justify-center rounded-lg border py-1.5 transition-all ${duration === opt.sec ? "border-brand-accent bg-brand-accent/20 text-brand-accent shadow-sm shadow-brand-accent/20 font-bold" : "border-brand-border/50 bg-brand-surface text-brand-text-muted hover:border-brand-border-strong hover:text-brand-text"}`}>
                      <span className="font-mono text-xs">{opt.label}</span>
                      <span className="text-[9px] opacity-70">{currentRate === null ? "—" : `+${currentRate.toFixed(2)}%`}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-brand-text-muted font-medium">{t("Investment amount")} (USDT)</span>
                  <span className="text-brand-text-muted font-mono">{t("Available")}: <strong className="text-brand-text">{signedOut || availableUSDT === null ? "—" : Number(availableUSDT).toFixed(2)}</strong></span>
                </div>
                <div className="flex h-11 items-center rounded-lg border border-brand-border bg-brand-surface-2 px-3 focus-within:border-brand-accent">
                  <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" disabled={!policy || policy.actions_enabled !== true || availableUSDT === null || Number(availableUSDT) <= 0} className="h-full flex-1 bg-transparent font-mono text-sm text-brand-text outline-none placeholder:text-brand-text-muted" />
                  <span className="text-xs font-bold text-brand-text-muted">USDT</span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  {quickAmounts.map((val) => (
                    <button key={val} type="button" onClick={() => setAmount(String(val))} className={`h-[30px] flex-1 rounded-md border border-brand-border/60 bg-brand-surface-2 font-mono text-xs font-medium tabular-nums text-brand-text-muted hover:border-brand-accent hover:text-brand-accent ${amount === String(val) ? "border-brand-accent text-brand-accent bg-brand-accent/10" : ""}`}>
                      {val}
                    </button>
                  ))}
                  <button type="button" disabled={!policy || policy.actions_enabled !== true || availableUSDT === null || Number(availableUSDT) <= 0} onClick={() => setAmount(availableUSDT !== null && maxStake !== null ? String(Math.min(Number(availableUSDT), maxStake)) : "")} className="h-[30px] rounded-md border border-brand-border/60 bg-brand-surface-2 px-3 text-xs font-semibold text-brand-text-muted hover:border-brand-accent hover:text-brand-accent disabled:opacity-40">
                    {t("Max")}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs px-1 text-brand-text-muted p-2.5 rounded-xl bg-brand-surface-2/50 border border-brand-border/40">
                <span>{t("Expected return")}</span>
                <span className="font-mono font-bold text-sm text-brand-text"><strong className="text-profit">{profitExpect}</strong>{profitExpect === "—" ? "" : " USDT"}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button type="button" disabled={submitting || !!pendingIntent || policy?.actions_enabled !== true || availableUSDT === null || Number(availableUSDT) <= 0 || currentRate === null} onClick={() => submitSeconds("up")} className="flex h-11 items-center justify-center gap-2 rounded-lg bg-profit text-[15px] font-bold text-[#05201A] transition-transform hover:bg-profit/90 active:scale-[0.99] disabled:opacity-50">
                  <TrendingUp className="h-5 w-5 stroke-[2.5]" />
                  <span>{t("Buy up (long)")} {currentRate === null ? "" : `(+${currentRate.toFixed(2)}%)`}</span>
                </button>
                <button type="button" disabled={submitting || !!pendingIntent || policy?.actions_enabled !== true || availableUSDT === null || Number(availableUSDT) <= 0 || currentRate === null} onClick={() => submitSeconds("down")} className="flex h-11 items-center justify-center gap-2 rounded-lg bg-loss text-[15px] font-bold text-white transition-transform hover:bg-loss/90 active:scale-[0.99] disabled:opacity-50">
                  <TrendingDown className="h-5 w-5 stroke-[2.5]" />
                  <span>{t("Buy down (short)")} {currentRate === null ? "" : `(+${currentRate.toFixed(2)}%)`}</span>
                </button>
              </div>
            </div>
            {/* 最新成交（成交明细）：与永续/现货共用 TradesPanel，窄屏只显示最近 8 条 */}
            <div className="mt-3 border-t border-brand-border/60 pt-3">
              <TradesPanel symbol={`${symbol}USDT`} limit={8} />
            </div>
          </section>
        </div>

        {/* 币对切换：与现货/永续共用同一套搜索抽屉 */}
        <MarketPickerDialog
          open={symbolPickerOpen}
          onOpenChange={setSymbolPickerOpen}
          description={t("Choose a short-term contract pair")}
          emptyLabel={t("No matching market")}
          activeId={`${symbol}USDT`}
          items={(policy?.policy.symbols ?? []).map((coin) => {
            const tk = coin === symbol ? ticker : null;
            return {
              id: `${coin}USDT`,
              label: `${coin}/USDT`,
              price: tk ? tk.price.toLocaleString(locale, { minimumFractionDigits: 2 }) : null,
              changePct: tk ? Number(tk.chg) : null,
            };
          })}
          onSelect={(id) => setSymbol(id.replace(/USDT$/, ""))}
        />

        {/* Bottom positions / current orders / history — shared panel so the tab
            strip, underline, collapse arrow and empty state match the perpetual
            and spot terminals. */}
        <BottomOrderPanel
          ariaLabel={t("Trading details")}
          className="border-t border-brand-border pt-3"
          tabs={[
            { key: "positions", label: `${t("Positions")} (${openCount})` },
            { key: "orders", label: `${t("Open orders")} (${pendingIntent ? 1 : 0})` },
            { key: "history", label: `${t("History")} (${snapshot?.history.length ?? 0})` },
          ]}
          active={activeTab}
          onActiveChange={(key) => setActiveTab(key as "positions" | "orders" | "history")}
          expanded={bottomExpanded}
          onToggle={() => setBottomExpanded((value) => !value)}
          trailing={(
            <Button size="sm" variant="ghost" className="h-8 w-8 text-xs" onClick={refresh} aria-label={t("Refresh")}>
              <RefreshCw className={"h-3.5 w-3.5 " + (loading ? "animate-spin" : "")} />
            </Button>
          )}
        >
          {activeTab === "positions" ? (
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
                <BottomPanelEmpty>{t("No active seconds contract positions.")}</BottomPanelEmpty>
              )
            ) : activeTab === "orders" ? (
              <div className="space-y-2">
                {pendingIntent ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-accent/30 bg-brand-accent/10 p-3 text-xs">
                    <span className="min-w-0">{t("An earlier Seconds request is still unconfirmed. Retry the same request before placing a new one.")}</span>
                    <Button type="button" size="sm" variant="outline" disabled={submitting} onClick={retryPendingIntent} className="h-9 shrink-0">{t("Retry same request")}</Button>
                  </div>
                ) : (
                  <BottomPanelEmpty>{t("No open orders")}</BottomPanelEmpty>
                )}
              </div>
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
                <BottomPanelEmpty>{t("No settlement history records.")}</BottomPanelEmpty>
              )
            )}
        </BottomOrderPanel>
      </div>

    </>
  );
}


