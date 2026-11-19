import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Search, Star } from "lucide-react";
import { TokenIcon } from "../../components/ui/TokenIcon";
import { getMarkets, type MarketTicker } from "../../lib/api";
import { useI18n, localeTags } from "../../lib/i18n";

type SortKey = "volume" | "change" | "price";
type MarketFilter = "all" | "hot" | "favorites" | "gainers" | "losers";

const tradeSymbol = (symbol: string) => (symbol.endsWith("USDT") ? symbol : `${symbol}USDT`);

// Human-readable full asset names, shown under the ticker symbol so users see
// e.g. "Bitcoin" under BTC rather than the raw 24h volume.
const ASSET_NAMES: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
  BNB: "BNB",
  XRP: "XRP",
  DOGE: "Dogecoin",
  ADA: "Cardano",
  AVAX: "Avalanche",
  LINK: "Chainlink",
  DOT: "Polkadot",
  LTC: "Litecoin",
  TRX: "TRON",
  ATOM: "Cosmos",
  NEAR: "NEAR Protocol",
  UNI: "Uniswap",
  BCH: "Bitcoin Cash",
  ETC: "Ethereum Classic",
  USDC: "USD Coin",
  USDT: "Tether USD",
};

const fmtPrice = (value: number, locale: string) =>
  new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: value >= 1 ? 2 : 8,
  }).format(value);

const fmtChange = (value: number, locale: string) =>
  `${value > 0 ? "+" : ""}${value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

const FAVORITES_KEY = "btcbox.market-favorites";

/**
 * Deterministic micro-sparkline from a ticker's real 24h high/low/price. Values
 * are normalized into a stable 5-point polyline so the desktop row has a
 * live-feel trend without fabricating history.
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
    return seq.map((v: number, i: number) => `${i * 12},${y(v).toFixed(1)}`).join(" ");
  }, [high, low, price]);
  const color = up ? "var(--color-brand-accent)" : "var(--color-brand-danger)";
  return (
    <svg viewBox="0 0 48 16" className="h-4 w-12 shrink-0" aria-hidden="true" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * High-density professional data table.
 *
 * Layout notes:
 * - A real <table> with `table-fixed` locks column widths, so ticking prices
 *   never reflow the row (the reason every numeric cell uses tabular-nums).
 * - Mobile drops the 24h-amount column and the chart shortcut; the trade CTA
 *   stays because it is the primary action on a phone.
 */
function MarketTable({ markets, locale, loading, error, favorites, onToggleFavorite, onOpenChart, sort, onSort }: {
  markets: MarketTicker[];
  locale: string;
  loading: boolean;
  error: string;
  favorites: string[];
  onToggleFavorite: (sym: string) => void;
  onOpenChart: (sym: string) => void;
  sort: SortKey;
  onSort: (key: SortKey) => void;
}) {
  const { t } = useI18n();

  if (error) {
    return (
      <div className="rounded-xl border border-brand-danger/30 bg-brand-surface px-4 py-8 text-center" role="alert">
        <p className="text-[13px] font-semibold text-brand-danger">{t("Market feed unavailable")}</p>
        <p className="mt-1.5 break-words text-[12px] text-brand-text-muted">{t(error)}</p>
      </div>
    );
  }

  if (loading && markets.length === 0) {
    return (
      <div className="overflow-hidden rounded-xl border border-brand-border bg-brand-surface" role="status" aria-label={t("Loading markets")}>
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 border-b border-brand-border-subtle px-3 py-3 last:border-b-0">
            <div className="h-7 w-7 animate-pulse rounded-full bg-brand-surface-hover" />
            <div className="min-w-0 flex-1">
              <div className="h-3.5 w-20 animate-pulse rounded bg-brand-surface-hover" />
              <div className="mt-1.5 h-2.5 w-12 animate-pulse rounded bg-brand-surface-2" />
            </div>
            <div className="h-3.5 w-16 animate-pulse rounded bg-brand-surface-hover" />
            <div className="h-6 w-14 animate-pulse rounded-md bg-brand-surface-hover" />
          </div>
        ))}
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div className="rounded-xl border border-brand-border bg-brand-surface px-4 py-10 text-center text-[13px] text-brand-text-muted">
        {t("No market pairs are currently available.")}
      </div>
    );
  }

  return (
    <div className="-mx-4 overflow-hidden rounded-none border-y border-white/[0.08] bg-brand-surface shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] sm:-mx-5 md:mx-0 md:rounded-xl md:border md:border-white/[0.08]">
      {/* Mobile: compact 3-column list — name+volume / price / change badge. */}
      <div className="md:hidden">
        <div className="flex items-center gap-2 border-b border-brand-border px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-brand-text-muted">
          <span className="min-w-0 flex-1">{t("Pair")}</span>
          <span className="w-[88px] text-right">{t("Last price")}</span>
          <span className="w-[72px] text-right">{t("24h change")}</span>
        </div>
        {markets.map((market) => {
          const up = market.chg >= 0;
          const isFavorite = favorites.includes(market.sym);
          return (
            <div key={market.sym} className="flex min-w-0 items-center gap-2 border-b border-brand-border-subtle px-3 py-3 last:border-b-0 transition-colors duration-200 hover:bg-brand-surface-hover/50">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Link to={`/trade/${tradeSymbol(market.sym)}`} className="flex min-w-0 items-center gap-2">
                  <TokenIcon symbol={market.sym} className="h-7 w-7 shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold leading-tight text-brand-text">{market.sym}</span>
                    <span className="mt-0.5 block truncate text-[11px] leading-tight text-brand-text-muted">{t(ASSET_NAMES[market.sym] || market.sym)}</span>
                  </span>
                </Link>
                <button
                  type="button"
                  aria-label={`${t(isFavorite ? "Remove from favorites" : "Add to favorites")} ${market.sym}`}
                  aria-pressed={isFavorite}
                  onClick={() => onToggleFavorite(market.sym)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-brand-text-disabled transition-colors duration-200 hover:text-brand-accent"
                >
                  <Star className={`h-4 w-4 ${isFavorite ? "fill-brand-accent text-brand-accent" : ""}`} />
                </button>
              </div>
              <span className="w-[88px] shrink-0 text-right font-mono text-[15px] font-semibold tabular-nums text-brand-text">{fmtPrice(market.price, locale)}</span>
              <button
                type="button"
                aria-label={`${t(isFavorite ? "Remove from favorites" : "Add to favorites")} ${market.sym}`}
                aria-pressed={isFavorite}
                onClick={() => onToggleFavorite(market.sym)}
                className={`flex h-7 w-[72px] shrink-0 items-center justify-center rounded-md px-1 font-mono text-[13px] font-semibold tabular-nums transition-colors duration-200 ${up ? "bg-brand-accent/10 text-brand-accent" : "bg-brand-danger/10 text-brand-danger"}`}
              >
                {fmtChange(market.chg, locale)}
              </button>
            </div>
          );
        })}
      </div>

      {/* Desktop: fixed-column table. */}
      <table className="hidden w-full table-fixed border-collapse md:table">
        <thead>
          <tr className="border-b border-brand-border text-xs font-medium text-brand-text-muted">
            <th scope="col" className="w-[24%] px-3 py-2 text-left font-medium">{t("Pair")}</th>
            <th scope="col" className="w-[15%] px-1 py-2 text-right font-medium">
              <button type="button" onClick={() => onSort("price")} className={`inline-flex items-center gap-1 transition-colors duration-200 hover:text-brand-text ${sort === "price" ? "text-brand-accent" : ""}`}>
                {t("Last price")}
              </button>
            </th>
            <th scope="col" className="w-[14%] px-3 py-2 text-right font-medium">
              <button type="button" onClick={() => onSort("change")} className={`inline-flex items-center gap-1 transition-colors duration-200 hover:text-brand-text ${sort === "change" ? "text-brand-accent" : ""}`}>
                {t("24h change")}
              </button>
            </th>
            <th scope="col" className="w-[16%] px-3 py-2 text-right font-medium">{t("24h high")}</th>
            <th scope="col" className="w-[16%] px-3 py-2 text-right font-medium">{t("24h low")}</th>
            <th scope="col" className="w-[15%] px-3 py-2 text-right font-medium">{t("Trending")}</th>
            <th scope="col" className="w-[14%] px-3 py-2 text-right font-medium">{t("Action")}</th>
          </tr>
        </thead>
        <tbody>
          {markets.map((market) => {
            const up = market.chg >= 0;
            const isFavorite = favorites.includes(market.sym);
            return (
              <tr key={market.sym} className="border-b border-brand-border-subtle last:border-b-0 transition-colors duration-200 hover:bg-brand-surface-hover/50">
                <td className="px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <TokenIcon symbol={market.sym} className="h-5 w-5 shrink-0" />
                    <Link to={`/trade/${tradeSymbol(market.sym)}`} className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold leading-tight text-brand-text">{market.sym}</span>
                      <span className="block truncate text-[10px] leading-tight text-brand-text-muted">{t(ASSET_NAMES[market.sym] || market.sym)}</span>
                    </Link>
                    <button
                      type="button"
                      aria-label={`${t(isFavorite ? "Remove from favorites" : "Add to favorites")} ${market.sym}`}
                      aria-pressed={isFavorite}
                      onClick={() => onToggleFavorite(market.sym)}
                      className="hidden h-6 w-6 shrink-0 items-center justify-center rounded text-brand-text-disabled transition-colors duration-200 hover:text-brand-accent md:flex"
                    >
                      <Star className={`h-3.5 w-3.5 ${isFavorite ? "fill-brand-accent text-brand-accent" : ""}`} />
                    </button>
                  </div>
                </td>
                <td className="px-1 py-2.5 text-right">
                  <span className="font-mono text-[13px] font-medium tabular-nums text-brand-text">{fmtPrice(market.price, locale)}</span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className={`inline-flex min-w-[64px] items-center justify-center rounded-md px-2 py-0.5 font-mono text-[12px] font-medium tabular-nums ${up ? "bg-brand-accent/10 text-brand-accent" : "bg-brand-danger/10 text-brand-danger"}`}>
                    {fmtChange(market.chg, locale)}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className="font-mono text-[12px] tabular-nums text-brand-text-secondary">{fmtPrice(market.high, locale)}</span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className="font-mono text-[12px] tabular-nums text-brand-text-secondary">{fmtPrice(market.low, locale)}</span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex justify-end">
                    <Sparkline high={market.high} low={market.low} price={market.price} up={up} />
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => onOpenChart(market.sym)}
                      aria-label={`${market.sym} ${t("Chart")}`}
                      className="flex h-7 w-7 items-center justify-center rounded text-brand-text-muted transition-colors duration-200 hover:bg-brand-surface-hover hover:text-brand-text"
                    >
                      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                        <path d="M2 12V4M6 12V7M10 12V2M14 12V9" strokeLinecap="round" />
                      </svg>
                    </button>
                    <Link
                      to={`/trade/${tradeSymbol(market.sym)}`}
                      className="flex h-7 items-center rounded-md border border-brand-border px-2 text-[11px] font-semibold text-brand-text transition-colors duration-200 hover:border-brand-accent/40 hover:text-brand-accent"
                    >
                      {t("Trade")}
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}




export function MarketsPage() {
  const { t, language } = useI18n();
  const locale = localeTags[language];
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get("q") || "";

  const [markets, setMarkets] = useState<MarketTicker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState(urlQuery);
  const [filter, setFilter] = useState<MarketFilter>("all");
  const [sort, setSort] = useState<SortKey>("volume");
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const stored: unknown = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) || "[]");
      return Array.isArray(stored)
        ? stored.filter((value): value is string => typeof value === "string").slice(0, 200)
        : [];
    } catch {
      return [];
    }
  });

  // Poll the market feed every 5s. Abort in-flight requests on unmount so a
  // slow response can never overwrite fresher state.
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
      getMarkets(controller.signal)
        .then((rows) => {
          if (!cancelled) { setMarkets(rows); setError(""); }
        })
        .catch((reason: unknown) => {
          if (!cancelled) {
            setMarkets([]);
            setError(
              reason instanceof Error && reason.name !== "AbortError"
                ? reason.message
                : "Market data is temporarily unavailable. Please try again shortly.",
            );
          }
        })
        .finally(() => {
          window.clearTimeout(timeout);
          refreshing = false;
          if (!cancelled) setLoading(false);
        });
    };
    load();
    const poll = window.setInterval(load, 5000);
    return () => { cancelled = true; window.clearInterval(poll); pending?.abort(); };
  }, []);

  const toggleFavorite = (sym: string) => {
    setFavorites((current) => {
      const next = current.includes(sym) ? current.filter((value) => value !== sym) : [...current, sym];
      try { window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); } catch { /* storage may be blocked */ }
      return next;
    });
  };

  const filters: Array<[MarketFilter, string]> = [
    ["all", "All"],
    ["hot", "Hot"],
    ["gainers", "Gainers"],
    ["losers", "Losers"],
    ["favorites", "Favorites"],
  ];

  const visibleMarkets = useMemo(() => {
    const needle = query.trim().toUpperCase();
    const rows = markets.filter((market) => {
      if (needle && !market.sym.toUpperCase().includes(needle)) return false;
      if (filter === "favorites") return favorites.includes(market.sym);
      if (filter === "gainers") return market.chg > 0;
      if (filter === "losers") return market.chg < 0;
      return true;
    });
    return [...rows].sort((a, b) => {
      if (sort === "change") return b.chg - a.chg;
      if (sort === "price") return b.price - a.price;
      return Number(b.vol) - Number(a.vol);
    });
  }, [markets, query, filter, favorites, sort]);


  return (
    <div data-testid="public-market-page" className="tone-markets relative mx-auto flex w-full min-w-0 flex-col gap-3 p-4 sm:p-5">
      {/* Ambient multi-layer glow (subtle, top-right, non-interactive). */}
      <div aria-hidden="true" className="pointer-events-none absolute -top-20 right-0 h-72 w-72 rounded-full bg-brand-accent/10 blur-[90px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -top-8 right-10 h-36 w-36 rounded-full bg-brand-accent/20 blur-[45px]" />
      <header className="relative flex min-w-0 items-center justify-between gap-3">
        <h1 className="min-w-0 truncate text-[17px] font-semibold leading-tight text-brand-text">{t("Markets")}</h1>
        <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-brand-text-muted">
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${error ? "bg-brand-danger" : loading ? "bg-brand-text-disabled" : "bg-brand-accent animate-pulse"}`}
          />
          {error ? t("Market unavailable") : loading ? t("Connecting") : t("Live market")}
        </span>
      </header>

      {/* Toolbar: search + filter chips + sort. Single hairline row, no card chrome. */}
      <div className="flex flex-col gap-2">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text-muted" />
          <input
            value={query}
            onChange={(event) => {
              const value = event.target.value;
              setQuery(value);
              setSearchParams(value ? { q: value } : {}, { replace: true });
            }}
            aria-label={t("Search")}
            placeholder={t("Search")}
            className="h-11 w-full min-w-0 rounded-xl border border-white/[0.08] bg-brand-surface-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] pl-9 pr-3 text-[13px] text-brand-text placeholder:text-brand-text-muted transition-colors duration-200 focus:border-brand-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/30"
          />
        </label>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto" role="group" aria-label={t("Spot markets")}>
            {filters.map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={filter === key}
                onClick={() => { setFilter(key); if (key === "hot") setSort("volume"); if (key === "gainers" || key === "losers") setSort("change"); }}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                  filter === key
                    ? "border-brand-accent/50 bg-brand-accent/15 text-brand-accent"
                    : "border-transparent text-brand-text-muted hover:text-brand-text"
                }`}
              >
                {t(label)}
              </button>
            ))}
          </div>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            aria-label={t("Sort by")}
            className="h-9 w-full shrink-0 rounded-xl border border-white/[0.08] bg-brand-surface-2 px-2.5 text-[11px] text-brand-text outline-none transition-colors duration-200 hover:border-brand-accent/40 focus:border-brand-accent/50 sm:w-[132px]"
          >
            <option value="volume">{t("24h volume")}</option>
            <option value="change">{t("24h change")}</option>
            <option value="price">{t("Last price")}</option>
          </select>
        </div>
      </div>

      <MarketTable
        markets={visibleMarkets}
        locale={locale}
        loading={loading}
        error={error}
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
        onOpenChart={(sym) => navigate(`/chart/${tradeSymbol(sym)}`)}
        sort={sort}
        onSort={setSort}
      />
    </div>
  );
}

