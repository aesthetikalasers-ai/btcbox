import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowRight,
  ChartNoAxesCombined,
  ChevronRight,
  ClipboardList,
  Gift,
  Rocket,
  Sparkles,
  Sprout,
  TrendingUp,
  Users,
} from "lucide-react";
import { TokenIcon } from "../../components/ui/TokenIcon";
import { HotFlameIcon } from "../../components/ui/HotFlameIcon";
import { getMarkets, type MarketTicker } from "../../lib/api";
import { getAssetName } from "../../lib/marketData";
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

/**
 * Seamless horizontal marquee ticker strip. No per-coin cards, borders, or
 * background plates — a single borderless auto-scrolling tape so the strip reads
 * as one continuous market feed (Binance-style) rather than a row of nested boxes.
 * It duplicates the item set so the CSS marquee loop can wrap without a jump.
 */
function TickerMarquee({ markets, locale }: { markets: MarketTicker[]; locale: string }) {
  const hot = useMemo(() => [...markets].sort((a, b) => b.chg - a.chg).slice(0, 8), [markets]);
  if (hot.length === 0) return null;
  // Render the list twice for a seamless translateX loop.
  const items = [...hot, ...hot];

  return (
    <section aria-label="Live ticker" className="relative overflow-hidden">
      <div className="no-scrollbar flex w-max animate-[ticker-scroll_40s_linear_infinite] items-center gap-8 px-1 py-2">
        {items.map((m, i) => {
          const up = m.chg >= 0;
          return (
            <Link key={`${m.sym}-${i}`} to={`/trade/${pairSymbol(m.sym)}`} className="flex shrink-0 items-center gap-2">
              <TokenIcon symbol={m.sym} className="h-5 w-5 shrink-0" />
              <span className="text-xs font-semibold text-brand-text">{m.sym}</span>
              <span className="font-mono text-xs font-medium tabular-nums text-brand-text-secondary">{fmtPrice(m.price, locale)}</span>
              <span
                className={`inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums ${up ? "bg-brand-accent/[0.07] text-brand-accent" : "bg-brand-danger/[0.07] text-brand-danger"}`}
              >
                {fmtChange(m.chg, locale)}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

interface BannerSlide {
  title: string;
  sub: string;
  to: string;
  gradient: string;
  glow: string;
  glowTop: string;
}

/**
 * Auto-playing promotional banner carousel (Hero area). Soft rounded corners,
 * gradient backgrounds, dot indicators, and prev/next arrows. Fully translated.
 */
function BannerCarousel({ markets }: { markets: MarketTicker[] }) {
  const { t, language } = useI18n();
  const [index, setIndex] = useState(0);
  // Pick a live BTC ticker for the non-interactive price panel. Falls back to
  // nothing when the feed is empty so we never render a fabricated price.
  const btc = markets.find((market) => market.sym === "BTC");
  const btcUp = (btc?.chg ?? 0) >= 0;
  const slides: BannerSlide[] = [
    { title: t("Supported markets"), sub: t("Browse supported spot pairs and their live market data."), to: "/markets", gradient: "from-brand-accent/40 via-brand-surface to-brand-surface", glow: "radial-gradient(120% 120% at 100% 100%, color-mix(in srgb, var(--color-brand-accent) 26%, transparent), transparent 60%)", glowTop: "radial-gradient(90% 90% at 0% 0%, color-mix(in srgb, var(--color-brand-accent) 18%, transparent), transparent 55%)" },
    { title: t("Earn products"), sub: t("Review the products and terms currently published in BTCBOX Earn."), to: "/earn", gradient: "from-brand-violet/40 via-brand-surface to-brand-surface", glow: "radial-gradient(120% 120% at 100% 100%, color-mix(in srgb, var(--color-brand-violet) 26%, transparent), transparent 60%)", glowTop: "radial-gradient(90% 90% at 0% 0%, color-mix(in srgb, var(--color-brand-violet) 18%, transparent), transparent 55%)" },
    { title: t("Trading workspace"), sub: t("Open spot, perpetual and seconds trading products from one place."), to: "/trade-hub", gradient: "from-brand-cyan/40 via-brand-surface to-brand-surface", glow: "radial-gradient(120% 120% at 100% 100%, color-mix(in srgb, var(--color-brand-cyan) 26%, transparent), transparent 60%)", glowTop: "radial-gradient(90% 90% at 0% 0%, color-mix(in srgb, var(--color-brand-cyan) 18%, transparent), transparent 55%)" },
  ];

  useEffect(() => {
    const id = window.setInterval(() => setIndex((i) => (i + 1) % slides.length), 5000);
    return () => window.clearInterval(id);
  }, [slides.length]);

  return (
    <section aria-label={t("Trending")} className="relative -mx-4 overflow-hidden rounded-none border-y border-white/[0.08] bg-brand-surface shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] transition-all duration-300 hover:border-brand-accent/30 sm:-mx-5 md:border-t-0">
      <div className="relative flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${index * 100}%)` }}>
        {slides.map((slide: BannerSlide) => (
          <Link key={slide.title} to={slide.to} className={`relative min-w-full bg-gradient-to-br ${slide.gradient} px-5 py-6 md:px-8 md:py-12`}>
            {/* Multi-layered emerald + teal radial glow (right half) */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ backgroundImage: slide.glow }} />
            <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ backgroundImage: slide.glowTop }} />
            <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ backgroundImage: "radial-gradient(90% 90% at 85% 30%, color-mix(in srgb, var(--color-brand-accent) 28%, transparent), transparent 55%), radial-gradient(70% 70% at 95% 80%, color-mix(in srgb, var(--color-brand-cyan) 22%, transparent), transparent 60%)" }} />
            {/* Tight upper-right highlight core for layered breathing glow. */}
            <div aria-hidden="true" className="pointer-events-none absolute -top-10 right-6 h-36 w-36 rounded-full bg-brand-accent/20 blur-[45px]" />
            {/* Subtle geometric micro-grid with radial fade mask for fintech texture. */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 opacity-[0.16] sm:block" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "18px 18px", WebkitMaskImage: "radial-gradient(100% 100% at 100% 0%, black 40%, transparent 100%)", maskImage: "radial-gradient(100% 100% at 100% 0%, black 40%, transparent 100%)" }} />
            <div className="relative flex min-w-0 items-center justify-between gap-6">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-accent/40 bg-brand-accent/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">
                  {t("Trending")}
                </span>
                <p className="mt-2.5 truncate text-xl font-extrabold tracking-tight text-brand-text md:text-3xl">{slide.title}</p>
                <p className="mt-1 truncate text-xs text-brand-text-muted md:text-sm">{slide.sub}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-accent px-4 py-2 text-[12px] font-semibold text-black transition-transform hover:scale-[1.03] active:scale-95">
                  {t("Trade now")} <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
              {/* Non-interactive live price panel (desktop only) */}
              {btc && (
                <div className="hidden shrink-0 md:flex w-72 flex-col justify-between rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md p-6 shadow-2xl">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-brand-text-muted">BTC / USDT</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-bold ${btcUp ? "bg-brand-accent/20 text-brand-accent" : "bg-brand-danger/20 text-brand-danger"}`}>
                      {btcUp ? "+" : ""}{btc.chg.toFixed(2)}%
                    </span>
                  </div>
                  <div className="mt-3 font-mono text-3xl font-extrabold tracking-tight tabular-nums text-brand-text">
                    ${fmtPrice(btc.price, localeTags[language])}
                  </div>
                  <div className="mt-3 h-16 w-full bg-gradient-to-t from-brand-accent/20 to-transparent rounded-lg border-b-2 border-brand-accent" />
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
      <div className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 gap-1.5">
        {slides.map((_: BannerSlide, i: number) => (
          <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? "w-4 bg-brand-accent" : "w-1.5 bg-brand-text-disabled"}`} />
        ))}
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
  // `badge` is optional: it is reserved for campaigns that are genuinely live.
  const entries: Array<{ to: string; label: string; icon: typeof ArrowLeftRight; badge?: string }> = [
    { to: "/trade", label: t("Spot"), icon: ArrowLeftRight },
    { to: "/contract", label: t("Perpetual"), icon: TrendingUp },
    { to: "/seconds", label: t("Seconds"), icon: ChartNoAxesCombined },
    { to: "/earn", label: t("Earn"), icon: Sprout },
    { to: "/deposit", label: t("Deposit"), icon: ArrowDownToLine },
    { to: "/rewards", label: t("Rewards"), icon: Gift },
    { to: "/orders", label: t("Orders"), icon: ClipboardList },
    { to: "/support", label: t("Support"), icon: Users },
  ];
  return (
    <section aria-label={t("Quick access")}>
      <div className="grid grid-cols-4 gap-y-4">
        {entries.map((entry) => (
          <Link key={entry.label} to={entry.to} className="group flex flex-col items-center gap-2">
            <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-gradient-to-b from-brand-surface-hover to-brand-surface-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] text-brand-text-secondary transition-all duration-300 group-hover:scale-105 group-hover:text-brand-accent group-hover:border-brand-accent/30 group-hover:shadow-[0_8px_30px_rgba(14,203,129,0.12)]">
              <entry.icon className="h-5 w-5" strokeWidth={1.75} />
              {entry.badge && (
                <span className="absolute -right-0.5 -top-0.5 rounded-full bg-brand-accent px-1 py-0.5 text-[10px] font-bold leading-none text-black">
                  {entry.badge}
                </span>
              )}
            </span>
            <span className="text-[11px] font-medium text-brand-text-secondary">{entry.label}</span>
          </Link>
        ))}
      </div>
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
    <div className="tone-home relative mx-auto flex w-full min-w-0 flex-col space-y-2 p-4 sm:space-y-3 sm:p-5">
      {/* Ambient multi-layer glow: soft wide diffusion + tight upper-right core. */}
      <div aria-hidden="true" className="pointer-events-none absolute -top-20 right-0 h-72 w-72 rounded-full bg-brand-accent/10 blur-[90px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -top-8 right-10 h-36 w-36 rounded-full bg-brand-accent/20 blur-[45px]" />
      {/* Page-level heading for accessibility and SEO. Visually hidden so the
          hero carousel remains the primary visual anchor on the home screen. */}
      <h1 className="sr-only">{t("Digital asset exchange")}</h1>
      <BannerCarousel markets={markets} />
      <TickerMarquee markets={markets} locale={locale} />
      <QuickActions />
      <MarketTable markets={markets} locale={locale} onViewAll={() => navigate("/markets")} />
    </div>
  );
}

