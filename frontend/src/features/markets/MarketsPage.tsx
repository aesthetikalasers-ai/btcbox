import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Search } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { TokenIcon } from "../../components/ui/TokenIcon";
import { getKlines, getMarkets, type MarketCandle, type MarketTicker } from "../../lib/api";
import { useI18n, localeTags } from "../../lib/i18n";
import { CandlestickSeries, ColorType, createChart, type UTCTimestamp } from "lightweight-charts";

const intervals = ["1m", "5m", "1h", "1d"] as const;
type SortKey = "volume" | "change" | "price";
type MarketFilter = "all" | "favorites" | "gainers" | "losers";
const price = (value: number, locale: string) => new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: value >= 1 ? 4 : 8 }).format(value);
const compact = (value: string, locale: string) => { const parsed = Number(value); return Number.isFinite(parsed) && parsed >= 0 ? new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 2 }).format(parsed) : "—"; };
const tradeSymbol = (symbol: string) => symbol.endsWith("USDT") ? symbol : `${symbol}USDT`;

function SelectedMarketChart({ candles, loading, error, interval, onIntervalChange, pair, locale, t }: {
  candles: MarketCandle[]; loading: boolean; error: string; interval: string; onIntervalChange: (value: string) => void; pair: string; locale: string; t: (value: string) => string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const latest = candles[candles.length - 1];
  useEffect(() => {
    const node = containerRef.current;
    if (!node || !candles.length || node.clientWidth === 0) return;
    const chart = createChart(node, { width: node.clientWidth, height: 300, layout: { attributionLogo: false, background: { type: ColorType.Solid, color: "transparent" }, textColor: "#9aa8b7", fontFamily: "Inter", fontSize: 11 }, grid: { vertLines: { color: "rgba(255,255,255,.035)" }, horzLines: { color: "rgba(255,255,255,.035)" } }, rightPriceScale: { borderColor: "rgba(255,255,255,.08)" }, timeScale: { borderColor: "rgba(255,255,255,.08)", timeVisible: true, secondsVisible: false }, handleScroll: { vertTouchDrag: false, horzTouchDrag: true }, handleScale: { pinch: true } });
    chartRef.current = chart;
    const series = chart.addSeries(CandlestickSeries, { upColor: "#0ecb81", downColor: "#f6465d", borderVisible: false, wickUpColor: "#0ecb81", wickDownColor: "#f6465d" });
    series.setData(candles.map((candle) => ({ time: Math.floor(candle.time / 1000) as UTCTimestamp, open: candle.open, high: candle.high, low: candle.low, close: candle.close })).sort((a, b) => Number(a.time) - Number(b.time)));
    chart.timeScale().fitContent();
    const observer = new ResizeObserver((entries) => { const width = entries[0]?.contentRect.width; if (width) chart.applyOptions({ width: Math.floor(width) }); });
    observer.observe(node);
    return () => { observer.disconnect(); chartRef.current = null; chart.remove(); };
  }, [candles]);
  return <Card className="min-w-0 overflow-hidden">
    <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0"><div className="min-w-0"><CardTitle>{t("Market analytics")}</CardTitle><p className="mt-1 text-xs text-brand-text-muted">{pair} · {interval}</p></div><div className="flex flex-wrap gap-1" role="group" aria-label={t("Chart")}>{intervals.map((value) => <button key={value} type="button" aria-pressed={interval === value} onClick={() => onIntervalChange(value)} className={`min-h-10 rounded-lg px-3 text-xs font-semibold ${interval === value ? "bg-brand-accent/10 text-brand-accent" : "text-brand-text-muted hover:bg-brand-surface-2 hover:text-brand-text"}`}>{value}</button>)}</div></CardHeader>
    <CardContent>{latest && !loading && !error && <p className="mb-3 text-sm font-semibold tabular-nums">{price(latest.close, locale)} <span className="text-xs font-normal text-brand-text-muted">USDT</span></p>}{loading ? <div className="flex h-[260px] items-center justify-center text-sm text-brand-text-muted" role="status">{t("Loading…")}</div> : error ? <div className="flex h-[260px] items-center justify-center text-center text-sm text-rose-300" role="alert">{t(error)}</div> : !candles.length ? <div className="flex h-[260px] items-center justify-center text-sm text-brand-text-muted">{t("Historical chart data is currently unavailable.")}</div> : <div ref={containerRef} className="h-[260px] min-w-0 w-full" aria-label={`${pair} ${t("Market analytics")}`}/>}</CardContent>
  </Card>;
}

export function MarketsPage() {
  const { t, language } = useI18n();
  const locale = localeTags[language];
  const [markets, setMarkets] = useState<MarketTicker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MarketFilter>("all");
  const [favorites, setFavorites] = useState<string[]>(() => { try { const stored: unknown = JSON.parse(window.localStorage.getItem("btcbox.market-favorites") || "[]"); return Array.isArray(stored) ? stored.filter((value): value is string => typeof value === "string").slice(0, 200) : []; } catch { return []; } });
  const [sort, setSort] = useState<SortKey>("volume");
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [interval, setInterval] = useState<string>("1h");
  const [candles, setCandles] = useState<MarketCandle[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState("");
  const [reload, setReload] = useState(0);
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    let cancelled = false; let refreshing = false; let pending: AbortController | undefined;
    const load = () => { if (cancelled || refreshing) return; refreshing = true; const controller = new AbortController(); pending = controller; const timeout = window.setTimeout(() => controller.abort(), 10000); getMarkets(controller.signal).then((rows) => { if (!cancelled) { setMarkets(rows); setError(""); } }).catch((reason: unknown) => { if (!cancelled) { setMarkets([]); setError(reason instanceof Error && reason.name !== "AbortError" ? reason.message : "Market data is temporarily unavailable. Please try again shortly."); } }).finally(() => { window.clearTimeout(timeout); refreshing = false; if (!cancelled) setLoading(false); }); };
    load(); const poll = window.setInterval(load, 5000); return () => { cancelled = true; window.clearInterval(poll); pending?.abort(); };
  }, [reload]);
  useEffect(() => { const timer = window.setInterval(() => setClock(Date.now()), 5000); return () => window.clearInterval(timer); }, []);

  const latestSnapshotTs = markets.reduce((latest, item) => Math.max(latest, item.snapshotTs || 0), 0);
  const isStale = markets.some((item) => !item.snapshotTs || clock / 1000 - item.snapshotTs > 90);
  const effectiveError = error || (isStale && markets.length ? "The market service snapshot is older than 90 seconds. Quotes are hidden until a fresh snapshot arrives." : "");
  const visibleMarkets = useMemo(() => markets.filter((market) => {
    if (filter === "favorites" && !favorites.includes(market.sym)) return false;
    if (filter === "gainers" && market.chg <= 0) return false;
    if (filter === "losers" && market.chg >= 0) return false;
    const normalized = query.trim().toLowerCase();
    return !normalized || market.sym.toLowerCase().includes(normalized);
  }).sort((a, b) => sort === "change" ? b.chg - a.chg : sort === "price" ? b.price - a.price : Number(b.vol) - Number(a.vol)), [markets, filter, favorites, query, sort]);
  const selectedMarket = visibleMarkets.find((market) => market.sym === selectedSymbol) || visibleMarkets[0];
  const providerMarket = markets.reduce<MarketTicker | null>((latest, item) => (item.providerTs || 0) > (latest?.providerTs || 0) ? item : latest, null);
  const serverAge = latestSnapshotTs > 0 ? Math.max(0, Math.floor(clock / 1000 - latestSnapshotTs)) : null;
  const providerAge = providerMarket?.providerTs ? Math.max(0, Math.floor(clock / 1000 - providerMarket.providerTs)) : null;
  useEffect(() => {
    if (effectiveError || !selectedMarket) { setCandles([]); setChartLoading(false); setChartError(""); return; }
    const controller = new AbortController(); setCandles([]); setChartError(""); setChartLoading(true);
    getKlines(tradeSymbol(selectedMarket.sym), interval, controller.signal).then((rows) => { if (!controller.signal.aborted) setCandles(rows); }).catch((reason: unknown) => { if (reason instanceof Error && reason.name === "AbortError") return; if (!controller.signal.aborted) { setCandles([]); setChartError(reason instanceof Error ? reason.message : "Chart data is temporarily unavailable."); } }).finally(() => { if (!controller.signal.aborted) setChartLoading(false); });
    return () => controller.abort();
  }, [selectedMarket?.sym, interval, effectiveError]);
  const toggleFavorite = (symbol: string) => { const next = favorites.includes(symbol) ? favorites.filter((value) => value !== symbol) : [...favorites, symbol]; setFavorites(next); try { window.localStorage.setItem("btcbox.market-favorites", JSON.stringify(next)); } catch { /* Remain usable without storage. */ } };
  const filters: Array<[MarketFilter, string]> = [["all", "Spot markets"], ["favorites", "Favorites"], ["gainers", "Gainers"], ["losers", "Losers"]];

  return <div className="tone-market mx-auto flex w-full max-w-[1600px] min-w-0 flex-col gap-5 overflow-x-clip p-3 sm:gap-6 sm:p-5 lg:p-8">
    <header className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div className="min-w-0"><p className="mb-2 text-xs font-semibold tracking-[.18em] text-brand-accent">{t("BTCBOX / MARKETS")}</p><h1 className="type-page-title text-brand-text">{t("Market overview")}</h1><p className="mt-2 text-sm text-brand-text-secondary">{t("Live spot prices and 24-hour market movement.")}</p></div><div className="flex min-w-0 flex-wrap items-center gap-2"><Badge variant="outline">{loading ? t("Connecting") : error ? t("Feed unavailable") : isStale && markets.length ? t("Snapshot stale") : !markets.length ? t("No markets enabled") : t("Live market feed")}</Badge>{markets.length > 0 && !effectiveError && <Badge variant="outline">{visibleMarkets.length} {t("pairs")}</Badge>}<Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => setReload((value) => value + 1)}>{t("Refresh")}</Button></div></header>
    <section className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,1fr)] lg:items-start" aria-label={t("Market analytics")}>
      <Card className="min-w-0 overflow-hidden p-0">
        <CardHeader className="gap-3 border-b border-brand-border pb-4"><div className="flex min-w-0 flex-wrap items-center justify-between gap-2"><div className="min-w-0"><CardTitle>{t("Spot markets")}</CardTitle><p className="mt-1 text-xs text-brand-text-muted">{t("Live prices from the BTCBOX market service")}</p></div>{selectedMarket && !effectiveError && <Button asChild size="sm" variant="secondary"><Link to={`/trade/${tradeSymbol(selectedMarket.sym)}`}>{t("Spot trading")} <ArrowUpRight className="h-4 w-4"/></Link></Button>}</div>
          <label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text-muted"/><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label={t("Search BTCBOX")} placeholder={t("Search")} className="h-11 w-full min-w-0 rounded-xl border border-brand-border bg-brand-surface-2 pl-10 pr-3 text-sm text-brand-text placeholder:text-brand-text-muted focus:border-brand-accent focus:outline-none"/></label>
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2"><div className="flex min-w-0 flex-wrap gap-1" role="group" aria-label={t("Spot markets")}>{filters.map(([key, label]) => <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)} className={`min-h-10 rounded-lg px-3 text-xs font-semibold ${filter === key ? "bg-brand-accent/10 text-brand-accent" : "text-brand-text-muted hover:bg-brand-surface-2"}`}>{t(label)}</button>)}</div><label className="flex min-w-0 items-center gap-2 text-xs text-brand-text-muted"><span className="hidden sm:inline">{t("Sort by")}</span><select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} aria-label={t("Sort by")} className="h-10 min-w-0 max-w-[135px] rounded-lg border border-brand-border bg-brand-surface-2 px-2 text-xs text-brand-text"><option value="volume">{t("24h volume")}</option><option value="change">{t("24h change")}</option><option value="price">{t("Last price")}</option></select></label></div>
          <details className="text-xs text-brand-text-muted"><summary className="min-h-8 w-fit cursor-pointer py-2">{t("Market data")}</summary><div className="space-y-1 break-words pb-1"><p>{serverAge === null ? t("Server snapshot time unavailable") : `${t("Server snapshot")} · ${serverAge}${t("seconds ago")}`}</p><p>{providerAge === null ? t("Provider timestamp unavailable") : `${t("Provider snapshot")} · ${(providerMarket?.source || t("source unavailable")).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32)} · ${providerAge}${t("seconds ago")}`}</p></div></details>
        </CardHeader>
        {effectiveError ? <CardContent className="py-8" role="alert"><p className="text-sm font-semibold text-rose-300">{t("Market feed unavailable")}</p><p className="mt-2 break-words text-sm text-brand-text-muted">{t(effectiveError)}</p></CardContent>
          : loading && !markets.length ? <CardContent className="space-y-3 py-6" role="status" aria-label={t("Loading markets")}>{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded-lg bg-brand-surface-2"/>)}<p className="text-sm text-brand-text-muted">{t("Loading…")}</p></CardContent>
            : !visibleMarkets.length ? <CardContent className="py-10 text-center text-sm text-brand-text-muted">{t("No market pairs are currently available.")}</CardContent>
              : <div className="divide-y divide-brand-border/70">{visibleMarkets.map((market) => <div key={market.sym} className={`grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(95px,.8fr)_minmax(92px,.75fr)_minmax(82px,.7fr)] sm:gap-3 sm:px-5 ${selectedMarket?.sym === market.sym ? "bg-brand-accent/[0.045]" : "hover:bg-brand-surface-2/60"}`}>
                <div className="flex min-w-0 items-center gap-2 sm:gap-3"><button type="button" aria-label={`${t(favorites.includes(market.sym) ? "Remove from favorites" : "Add to favorites")} ${market.sym}`} aria-pressed={favorites.includes(market.sym)} onClick={() => toggleFavorite(market.sym)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-brand-text-muted hover:text-brand-accent"><span aria-hidden="true" className={favorites.includes(market.sym) ? "text-brand-accent" : ""}>{favorites.includes(market.sym) ? "★" : "☆"}</span></button><TokenIcon symbol={market.sym} className="h-8 w-8 shrink-0"/><button type="button" onClick={() => setSelectedSymbol(market.sym)} aria-pressed={selectedMarket?.sym === market.sym} className="min-w-0 text-left"><span className="block truncate text-sm font-semibold text-brand-text">{market.sym}/USDT</span><span className="type-meta block truncate text-brand-text-muted">{market.sym}</span></button></div>
                <div className="min-w-0 text-right sm:text-left"><p className="type-meta text-brand-text-muted sm:hidden">{t("Last price")}</p><p className="mt-1 truncate text-sm font-semibold tabular-nums text-brand-text sm:mt-0">{price(market.price, locale)}</p></div>
                <div className="min-w-0 text-right sm:text-left"><p className="type-meta text-brand-text-muted sm:hidden">{t("24h change")}</p><p className={`mt-1 truncate text-sm font-semibold tabular-nums sm:mt-0 ${market.chg >= 0 ? "text-profit" : "text-loss"}`}>{market.chg > 0 ? "+" : ""}{market.chg.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</p></div>
                <div className="col-span-2 min-w-0 text-right sm:col-span-1 sm:text-left"><p className="type-meta text-brand-text-muted sm:hidden">{t("24h volume")}</p><p className="mt-1 truncate text-xs tabular-nums text-brand-text-secondary sm:mt-0">{compact(market.vol, locale)} USDT</p></div>
              </div>)}</div>}
      </Card>
      <SelectedMarketChart candles={candles} loading={chartLoading} error={chartError} interval={interval} onIntervalChange={setInterval} pair={selectedMarket ? `${selectedMarket.sym}/USDT` : "—"} locale={locale} t={t}/>
    </section>
  </div>;
}
