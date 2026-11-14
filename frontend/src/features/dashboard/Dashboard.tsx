import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowRight,
  ChartNoAxesCombined,
  Gift,
  Rocket,
  Sprout,
  TrendingUp,
  Users,
} from "lucide-react";
import { TokenIcon } from "../../components/ui/TokenIcon";
import { HotFlameIcon } from "../../components/ui/HotFlameIcon";
import { getMarkets, type MarketTicker } from "../../lib/api";
import { useI18n, localeTags } from "../../lib/i18n";

const pairSymbol = (symbol: string) => (symbol.endsWith("USDT") ? symbol : `${symbol}USDT`);

/** Price formatter: 2 decimals for majors, up to 8 for sub-dollar assets. */
const fmtPrice = (value: number, locale: string) =>
  new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: value >= 1 ? 2 : 8,
  }).format(value);

const fmtChange = (value: number, locale: string) =>
  `${value > 0 ? "+" : ""}${value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

/** Compact large-number formatter (e.g. 1.28B, 2.4M). */
const fmtCompact = (value: string | number, locale: string) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0
    ? new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 2 }).format(n)
    : "—";
};

/**
 * Deterministic micro-sparkline from a ticker's real 24h high/low/mid so the
 * Hot Coins strip has a live-feel trend without fabricating history. Values are
 * normalized into a stable 5-point polyline.
 */
function Sparkline({ high, low, price, up }: { high: number; low: number; price: number; up: boolean }) {
  const points = useMemo(() => {
    if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(price) || high <= low) {
      return "0,8 12,8 24,8 36,8 48,8";
    }
    const range = high - low;
    const y = (v: number) => 14 - Math.max(1, Math.min(13, ((v - low) / range) * 12 + 1));
    const mid = (high + low) / 2;
    const seq = [low, low + range * 0.35, mid, high - range * 0.25, price];
    return seq.map((v, i) => `${i * 12},${y(v).toFixed(1)}`).join(" ");
  }, [high, low, price]);
  const color = up ? "#0ECB81" : "#F6465D";
  return (
    <svg viewBox="0 0 48 16" className="h-4 w-12 shrink-0" aria-hidden="true" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Auto-playing promotional banner carousel (Hero area). Soft rounded corners,
 * gradient backgrounds, dot indicators, and prev/next arrows. Fully translated.
 */
function BannerCarousel() {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const slides = [
    { title: t("New token listings"), sub: t("Discover the latest assets listed on BTCBOX"), to: "/markets", gradient: "from-brand-accent/25 via-brand-surface to-brand-surface" },
    { title: t("Staking rewards"), sub: t("Earn passive rewards on your idle assets"), to: "/earn", gradient: "from-brand-violet/25 via-brand-surface to-brand-surface" },
    { title: t("Trading competition"), sub: t("Compete, trade, and win exclusive prizes"), to: "/trade-hub", gradient: "from-brand-cyan/25 via-brand-surface to-brand-surface" },
  ];

  useEffect(() => {
    const id = window.setInterval(() => setIndex((i) => (i + 1) % slides.length), 5000);
    return () => window.clearInterval(id);
  }, [slides.length]);

  return (
    <section aria-label={t("Trending")} className="relative overflow-hidden rounded-2xl border border-brand-border bg-brand-surface">
      {/* Decorative background glow. */}
      <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-accent/15 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-12 -left-8 h-36 w-36 rounded-full bg-brand-violet/15 blur-3xl" />
      <div className="relative flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${index * 100}%)` }}>
        {slides.map((slide) => (
          <Link key={slide.title} to={slide.to} className={`min-w-full bg-gradient-to-br ${slide.gradient} px-5 py-5`}>
            <div className="min-w-0">
              <p className="truncate text-[16px] font-bold text-brand-text">{slide.title}</p>
              <p className="mt-1 truncate text-xs text-brand-text-muted">{slide.sub}</p>
              <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-brand-accent/15 px-3 py-1 text-[11px] font-semibold text-brand-accent">
                {t("Trade now")} <ArrowRight className="h-3 w-3" />
              </span>
            </div>
          </Link>
        ))}
      </div>
      <div className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 gap-1.5">
        {slides.map((_, i) => (
          <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? "w-4 bg-brand-accent" : "w-1.5 bg-brand-text-disabled"}`} />
        ))}
      </div>
    </section>
  );
}

/**
 * Hot Coins horizontal marquee: top gainers by 24h change with a micro-sparkline.
 */
function TickerMarquee({ markets, locale }: { markets: MarketTicker[]; locale: string }) {
  const { t } = useI18n();
  const hot = useMemo(() => [...markets].sort((a, b) => b.chg - a.chg).slice(0, 8), [markets]);
  if (hot.length === 0) return null;

  return (
    <section aria-label={t("Gainers")}>
      <div className="no-scrollbar flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1">
        {hot.map((m) => {
          const up = m.chg >= 0;
          return (
            <Link key={m.sym} to={`/trade/${pairSymbol(m.sym)}`} className="flex w-[calc(50%-0.25rem)] shrink-0 snap-start items-center gap-2.5 rounded-xl border border-brand-border bg-brand-surface px-3 py-2.5 transition-colors hover:border-brand-border-strong sm:w-[170px]">
              <TokenIcon symbol={m.sym} className="h-6 w-6 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate text-xs font-semibold text-brand-text">{m.sym}</span>
                  <span className="shrink-0 font-mono text-[10px] font-semibold tabular-nums" style={{ color: up ? "#0ECB81" : "#F6465D" }}>{fmtChange(m.chg, locale)}</span>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <span className={`truncate font-mono font-medium tabular-nums text-brand-text ${m.price >= 1 ? "text-[13px]" : "text-[11px]"}`}>{fmtPrice(m.price, locale)}</span>
                  <Sparkline high={m.high} low={m.low} price={m.price} up={up} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}


/**
 * Quick feature entry: a modern 8-icon dual-row grid with subtle gradient icon
 * tiles and crisp iconography.
 */
function QuickActions() {
  const { t } = useI18n();
  const entries = [
    { to: "/trade", label: t("Spot"), icon: ArrowLeftRight, tone: "from-brand-accent/30 to-brand-accent/10 text-brand-accent" },
    { to: "/contract", label: t("Perpetual"), icon: TrendingUp, tone: "from-brand-violet/30 to-brand-violet/10 text-brand-violet" },
    { to: "/seconds", label: t("Seconds"), icon: ChartNoAxesCombined, tone: "from-brand-cyan/30 to-brand-cyan/10 text-brand-cyan" },
    { to: "/earn", label: t("Earn"), icon: Sprout, tone: "from-brand-success/30 to-brand-success/10 text-brand-success" },
    { to: "/deposit", label: t("Deposit"), icon: ArrowDownToLine, tone: "from-brand-info/30 to-brand-info/10 text-brand-info" },
    { to: "/trade-hub", label: t("Rewards"), icon: Gift, tone: "from-brand-orange/30 to-brand-orange/10 text-brand-orange" },
    { to: "/trade-hub", label: t("Launchpad"), icon: Rocket, tone: "from-brand-indigo/30 to-brand-indigo/10 text-brand-indigo" },
    { to: "/support", label: t("More"), icon: Users, tone: "from-brand-teal/30 to-brand-teal/10 text-brand-teal" },
  ];
  return (
    <section aria-label={t("Quick access")}>
      <div className="grid grid-cols-4 gap-y-4">
        {entries.map((entry) => (
          <Link key={entry.label} to={entry.to} className="group flex flex-col items-center gap-2">
            <span className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${entry.tone} transition-transform group-hover:scale-105`}>
              <entry.icon className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <span className="text-[11px] font-medium text-brand-text-secondary">{entry.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * Compact market table. Uses a real <table> so column widths stay locked while
 * prices tick — the whole point of tabular-nums in a trading terminal.
 */
function MarketTable({ markets, locale, onViewAll }: { markets: MarketTicker[]; locale: string; onViewAll: () => void }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<"hot" | "gainers" | "new" | "volume">("hot");
  const tabs = [
    { key: "hot" as const, label: t("Hot pairs") },
    { key: "gainers" as const, label: t("Gainers") },
    { key: "new" as const, label: t("New listings") },
    { key: "volume" as const, label: t("24h volume") },
  ];
  const rows = useMemo(() => {
    const list = [...markets];
    if (tab === "gainers") list.sort((a, b) => b.chg - a.chg);
    else if (tab === "volume") list.sort((a, b) => Number(b.vol) - Number(a.vol));
    else if (tab === "new") list.sort((a, b) => (b.providerTs ?? b.snapshotTs ?? 0) - (a.providerTs ?? a.snapshotTs ?? 0));
    else list.sort((a, b) => Number(b.vol) - Number(a.vol));
    return list.slice(0, 8);
  }, [markets, tab]);
  if (rows.length === 0) return null;

  return (
    <section aria-label={t("Market overview")} className="overflow-hidden rounded-md border border-brand-border bg-brand-surface">
      <div className="flex items-center justify-between border-b border-brand-border px-3 py-2.5">
        <h2 className="text-[13px] font-semibold text-brand-text">{t("Market overview")}</h2>
        <button
          type="button"
          onClick={onViewAll}
          className="flex items-center gap-0.5 text-[11px] font-medium text-brand-text-muted transition-colors hover:text-brand-accent"
        >
          {t("View all markets")}
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      {/* Horizontal sub-tabs: Hot / Gainers / New / Volume. */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-brand-border px-2 py-1.5" role="tablist" aria-label={t("Market overview")}>
        {tabs.map((t2) => (
          <button
            key={t2.key}
            type="button"
            role="tab"
            aria-selected={tab === t2.key}
            onClick={() => setTab(t2.key)}
            className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
              tab === t2.key ? "bg-brand-accent/15 text-brand-accent" : "text-brand-text-muted hover:text-brand-text"
            }`}
          >
            {t2.label}
          </button>
        ))}
      </div>

      {/* Mobile: single-column list — icon+symbol left, price right, change pill. */}
      <div className="sm:hidden">
        {rows.map((m, idx) => {
          const up = m.chg >= 0;
          const isHot = (tab === "hot" || tab === "gainers") && idx < 3;
          return (
            <Link
              key={m.sym}
              to={`/trade/${pairSymbol(m.sym)}`}
              className="flex min-w-0 items-center gap-3 border-b border-brand-border/60 px-3 py-3 last:border-b-0"
            >
              <TokenIcon symbol={m.sym} className="h-7 w-7 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1">
                  <span className="truncate text-[15px] font-semibold leading-tight text-brand-text">{m.sym}</span>
                  {isHot ? <HotFlameIcon className="h-3.5 w-3.5 shrink-0" /> : null}
                </span>
                <span className="mt-0.5 block truncate text-[11px] font-normal leading-tight text-brand-text-muted">{m.sym}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-[16px] font-semibold leading-tight tabular-nums text-brand-text">{fmtPrice(m.price, locale)}</span>
                <span className="mt-0.5 block text-[12px] font-normal tabular-nums text-brand-text-muted">${fmtPrice(m.price, locale)}</span>
              </span>
              <span
                className={`flex h-8 w-[76px] shrink-0 items-center justify-center rounded-[4px] text-[14px] font-semibold tabular-nums ${up ? "bg-brand-success/15 text-brand-success" : "bg-brand-danger/15 text-brand-danger"}`}
              >
                {fmtChange(m.chg, locale)}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Desktop: fixed-column table. */}
      <table className="hidden w-full table-fixed border-collapse sm:table">
        <thead>
          <tr className="border-b border-brand-border text-[10px] font-medium text-brand-text-muted">
            <th scope="col" className="w-[38%] px-3 py-2 text-left font-medium">{t("Pair")}</th>
            <th scope="col" className="w-[30%] px-1 py-2 text-right font-medium">{t("Last price")}</th>
            <th scope="col" className="w-[32%] px-3 py-2 text-right font-medium">{t("24h change")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => {
            const up = m.chg >= 0;
            return (
              <tr key={m.sym} className="border-b border-brand-border/60 last:border-b-0 hover:bg-brand-surface-hover">
                <td className="px-3 py-2">
                  <Link to={`/trade/${pairSymbol(m.sym)}`} className="flex min-w-0 items-center gap-2">
                    <TokenIcon symbol={m.sym} className="h-[18px] w-[18px] shrink-0" />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold leading-tight text-brand-text">{m.sym}</span>
                      <span className="block truncate text-[10px] leading-tight text-brand-text-muted">/USDT</span>
                    </span>
                  </Link>
                </td>
                <td className="px-1 py-2 text-right">
                  <span className="font-mono text-[13px] font-medium tabular-nums text-brand-text">{fmtPrice(m.price, locale)}</span>
                </td>
                <td className="px-3 py-2 text-right">
                  <span className="font-mono text-[13px] font-medium tabular-nums" style={{ color: up ? "#0ECB81" : "#F6465D" }}>
                    {fmtChange(m.chg, locale)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}


export function Dashboard() {
  const { language, t } = useI18n();
  const locale = localeTags[language];
  const navigate = useNavigate();
  const [markets, setMarkets] = useState<MarketTicker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let refreshing = false;
    let pending: AbortController | undefined;
    const load = () => {
      if (cancelled || refreshing) return;
      refreshing = true;
      const controller = new AbortController();
      pending = controller;
      const timeout = window.setTimeout(() => controller.abort(), 10000);
      // Surface failures to the user instead of silently swallowing them:
      // an empty market list must never be mistaken for "no pairs listed".
      getMarkets(controller.signal)
        .then((mkts) => {
          if (cancelled) return;
          setMarkets(mkts);
          setError("");
        })
        .catch((cause: unknown) => {
          if (cancelled) return;
          if (cause instanceof Error && cause.name === "AbortError") return;
          setMarkets([]);
          setError(cause instanceof Error ? cause.message : "Market data is temporarily unavailable.");
        })
        .finally(() => {
          window.clearTimeout(timeout);
          refreshing = false;
          if (!cancelled) setLoading(false);
        });
    };
    load();
    // Refresh on the same 5s cadence as the markets page so the home ticker
    // and overview table track the live feed instead of freezing on mount.
    const poll = window.setInterval(load, 5000);
    return () => { cancelled = true; window.clearInterval(poll); pending?.abort(); };
  }, []);

  return (
    <div className="tone-home mx-auto flex w-full min-w-0 flex-col gap-3 p-4 sm:gap-4 sm:p-5">
      <BannerCarousel />
      <TickerMarquee markets={markets} locale={locale} />
      <QuickActions />
      <MarketTable markets={markets} locale={locale} onViewAll={() => navigate("/markets")} />
    </div>
  );
}

