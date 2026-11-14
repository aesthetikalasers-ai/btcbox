import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Search, Star } from "lucide-react";
import { TokenIcon } from "../../components/ui/TokenIcon";
import { getMarkets, type MarketTicker } from "../../lib/api";
import { useI18n, localeTags } from "../../lib/i18n";

type SortKey = "volume" | "change" | "price";
type MarketFilter = "all" | "favorites" | "gainers" | "losers";

const tradeSymbol = (symbol: string) => (symbol.endsWith("USDT") ? symbol : `${symbol}USDT`);

const fmtPrice = (value: number, locale: string) =>
  new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: value >= 1 ? 2 : 8,
  }).format(value);

const fmtCompact = (value: string, locale: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0
    ? new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 2 }).format(parsed)
    : "—";
};

const fmtChange = (value: number, locale: string) =>
  `${value > 0 ? "+" : ""}${value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

const FAVORITES_KEY = "btcbox.market-favorites";

/**
 * High-density professional data table.
 *
 * Layout notes:
 * - A real <table> with `table-fixed` locks column widths, so ticking prices
 *   never reflow the row (the reason every numeric cell uses tabular-nums).
 * - Mobile drops the 24h-amount column and the chart shortcut; the trade CTA
 *   stays because it is the primary action on a phone.
 */
function MarketTable({ markets, locale, loading, error, favorites, onToggleFavorite, onOpenChart }: {
  markets: MarketTicker[];
  locale: string;
  loading: boolean;
  error: string;
  favorites: string[];
  onToggleFavorite: (sym: string) => void;
  onOpenChart: (sym: string) => void;
}) {
  const { t } = useI18n();

  if (error) {
    return (
      <div className="rounded-md border border-brand-danger/30 bg-brand-surface px-4 py-8 text-center" role="alert">
        <p className="text-[13px] font-semibold text-brand-danger">{t("Market feed unavailable")}</p>
        <p className="mt-1.5 break-words text-[12px] text-brand-text-muted">{t(error)}</p>
      </div>
    );
  }

  if (loading && markets.length === 0) {
    return (
      <div className="overflow-hidden rounded-md border border-brand-border bg-brand-surface" role="status" aria-label={t("Loading markets")}>
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 border-b border-brand-border/60 px-3 py-3 last:border-b-0">
            <div className="h-6 w-6 animate-pulse rounded-full bg-brand-surface-hover" />
            <div className="h-3 w-20 animate-pulse rounded bg-brand-surface-hover" />
            <div className="ml-auto h-3 w-16 animate-pulse rounded bg-brand-surface-hover" />
          </div>
        ))}
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div className="rounded-md border border-brand-border bg-brand-surface px-4 py-10 text-center text-[13px] text-brand-text-muted">
        {t("No market pairs are currently available.")}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-brand-border bg-brand-surface">
      {/* Mobile: two-column card grid. */}
      <div className="grid grid-cols-2 gap-px bg-brand-border/60 sm:hidden">
        {markets.map((market) => {
          const up = market.chg >= 0;
          const isFavorite = favorites.includes(market.sym);
          return (
            <div key={market.sym} className="flex min-w-0 flex-col gap-1.5 bg-brand-surface p-3">
              <div className="flex items-center gap-1.5">
                <TokenIcon symbol={market.sym} className="h-4 w-4 shrink-0" />
                <Link to={`/trade/${tradeSymbol(market.sym)}`} className="truncate text-[13px] font-semibold text-brand-text">
                  {market.sym}
                </Link>
                <button
                  type="button"
                  aria-label={`${t(isFavorite ? "Remove from favorites" : "Add to favorites")} ${market.sym}`}
                  aria-pressed={isFavorite}
                  onClick={() => onToggleFavorite(market.sym)}
                  className="ml-auto shrink-0 text-brand-text-disabled transition-colors hover:text-brand-accent"
                >
                  <Star className={`h-3.5 w-3.5 ${isFavorite ? "fill-brand-accent text-brand-accent" : ""}`} />
                </button>
              </div>
              <span className="font-mono text-[15px] font-semibold tabular-nums text-brand-text">{fmtPrice(market.price, locale)}</span>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[12px] font-medium tabular-nums" style={{ color: up ? "#0ECB81" : "#F6465D" }}>
                  {fmtChange(market.chg, locale)}
                </span>
                <button
                  type="button"
                  onClick={() => onOpenChart(market.sym)}
                  aria-label={`${market.sym} ${t("Chart")}`}
                  className="flex h-6 w-6 items-center justify-center rounded text-brand-text-muted transition-colors hover:bg-brand-surface-2 hover:text-brand-text"
                >
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <path d="M2 12V4M6 12V7M10 12V2M14 12V9" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: fixed-column table. */}
      <table className="hidden w-full table-fixed border-collapse sm:table">
        <thead>
          <tr className="border-b border-brand-border text-[10px] font-medium text-brand-text-muted">
            <th scope="col" className="w-[42%] px-3 py-2 text-left font-medium sm:w-[30%]">{t("Pair")}</th>
            <th scope="col" className="w-[30%] px-1 py-2 text-right font-medium sm:w-[20%]">{t("Last price")}</th>
            <th scope="col" className="w-[28%] px-3 py-2 text-right font-medium sm:w-[18%]">{t("24h change")}</th>
            <th scope="col" className="hidden px-3 py-2 text-right font-medium sm:table-cell sm:w-[18%]">{t("24h amount")}</th>
            <th scope="col" className="hidden px-3 py-2 text-right font-medium sm:table-cell sm:w-[14%]">{t("Action")}</th>
          </tr>
        </thead>
        <tbody>
          {markets.map((market) => {
            const up = market.chg >= 0;
            const isFavorite = favorites.includes(market.sym);
            return (
              <tr key={market.sym} className="border-b border-brand-border/60 last:border-b-0 hover:bg-brand-surface-hover">
                <td className="px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <button
                      type="button"
                      aria-label={`${t(isFavorite ? "Remove from favorites" : "Add to favorites")} ${market.sym}`}
                      aria-pressed={isFavorite}
                      onClick={() => onToggleFavorite(market.sym)}
                      className="hidden h-6 w-6 shrink-0 items-center justify-center rounded text-brand-text-disabled transition-colors hover:text-brand-accent sm:flex"
                    >
                      <Star className={`h-3.5 w-3.5 ${isFavorite ? "fill-brand-accent text-brand-accent" : ""}`} />
                    </button>
                    <TokenIcon symbol={market.sym} className="h-5 w-5 shrink-0" />
                    <Link to={`/trade/${tradeSymbol(market.sym)}`} className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold leading-tight text-brand-text">{market.sym}</span>
                      <span className="block truncate text-[10px] leading-tight text-brand-text-muted">/USDT</span>
                    </Link>
                  </div>
                </td>
                <td className="px-1 py-2.5 text-right">
                  <span className="font-mono text-[13px] font-medium tabular-nums text-brand-text">{fmtPrice(market.price, locale)}</span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className="font-mono text-[13px] font-medium tabular-nums" style={{ color: up ? "#0ECB81" : "#F6465D" }}>
                    {fmtChange(market.chg, locale)}
                  </span>
                </td>
                <td className="hidden px-3 py-2.5 text-right sm:table-cell">
                  <span className="font-mono text-[12px] tabular-nums text-brand-text-secondary">{fmtCompact(market.vol, locale)}</span>
                </td>
                <td className="hidden px-3 py-2.5 sm:table-cell">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => onOpenChart(market.sym)}
                      aria-label={`${market.sym} ${t("Chart")}`}
                      className="flex h-7 w-7 items-center justify-center rounded text-brand-text-muted transition-colors hover:bg-brand-surface-2 hover:text-brand-text"
                    >
                      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                        <path d="M2 12V4M6 12V7M10 12V2M14 12V9" strokeLinecap="round" />
                      </svg>
                    </button>
                    <Link
                      to={`/trade/${tradeSymbol(market.sym)}`}
                      className="flex h-7 items-center rounded border border-brand-border px-2 text-[11px] font-semibold text-brand-text transition-colors hover:border-brand-accent hover:text-brand-accent"
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
    ["favorites", "Favorites"],
    ["gainers", "Gainers"],
    ["losers", "Losers"],
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
    <div className="tone-markets mx-auto flex w-full min-w-0 flex-col gap-3 p-4 sm:p-5">
      <header className="flex min-w-0 items-center justify-between gap-3">
        <h1 className="min-w-0 truncate text-[17px] font-semibold leading-tight text-brand-text">{t("Markets")}</h1>
        <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-brand-text-muted">
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full ${error ? "bg-brand-danger" : loading ? "bg-brand-text-disabled" : "bg-brand-accent"}`}
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
            className="h-10 w-full min-w-0 rounded-md border border-brand-border bg-brand-surface-2 pl-9 pr-3 text-[13px] text-brand-text placeholder:text-brand-text-muted focus:border-brand-accent focus:outline-none"
          />
        </label>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto" role="group" aria-label={t("Spot markets")}>
            {filters.map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
                className={`shrink-0 rounded px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                  filter === key
                    ? "bg-brand-surface-hover text-brand-text"
                    : "text-brand-text-muted hover:text-brand-text"
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
            className="h-8 w-full shrink-0 rounded border border-brand-border bg-brand-surface-2 px-2 text-[11px] text-brand-text outline-none focus:border-brand-accent sm:w-[132px]"
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
      />
    </div>
  );
}

