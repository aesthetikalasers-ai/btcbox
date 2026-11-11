import { useMemo } from "react";
import { Search } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { TokenIcon } from "../../../components/ui/TokenIcon";
import { Card } from "./Card";
import type { MarketTicker } from "../../../lib/api";
import { useI18n, localeTags } from "../../../lib/i18n";

const names: Record<string, string> = {
  BTC: "Bitcoin", ETH: "Ethereum", SOL: "Solana", BNB: "BNB",
  XRP: "XRP", DOGE: "Dogecoin", ADA: "Cardano", AVAX: "Avalanche",
  LINK: "Chainlink", DOT: "Polkadot", TRX: "TRON", LTC: "Litecoin",
  BCH: "Bitcoin Cash", NEAR: "NEAR Protocol", UNI: "Uniswap",
  ATOM: "Cosmos", ETC: "Ethereum Classic",
};

const price = (value: number, locale: string) => new Intl.NumberFormat(locale, {
  minimumFractionDigits: 2,
  maximumFractionDigits: value >= 1 ? 4 : 8,
}).format(value);

const formatCompact = (value: number | string | undefined | null, locale: string) => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (num === undefined || num === null || !Number.isFinite(num) || num < 0) return "—";
  if (num === 0) return "0.00";
  return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 2 }).format(num);
};

function Change({ value, locale }: { value: number; locale: string }) {
  return <span className={`inline-flex min-w-[76px] justify-center rounded-lg px-2.5 py-1.5 text-xs font-semibold tabular-nums ${value >= 0 ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"}`}>
    {value > 0 ? "+" : ""}{value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
  </span>;
}

export function LiveMarketsTable({ markets, loading, error }: {
  markets: MarketTicker[];
  loading: boolean;
  error: string;
}) {
  const { t, language } = useI18n();
  const [sort, setSort] = useState("volume");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { const saved: unknown = JSON.parse(localStorage.getItem("btcbox.market-favorites") || "[]"); return Array.isArray(saved) ? saved.filter((item): item is string => typeof item === "string").slice(0, 200) : []; } catch { return []; }
  });
  const toggleFavorite = (symbol: string) => {
    const next = favorites.includes(symbol) ? favorites.filter(item => item !== symbol) : [...favorites, symbol];
    setFavorites(next);
    try { localStorage.setItem("btcbox.market-favorites", JSON.stringify(next)); } catch { /* Remain usable when browser storage is unavailable. */ }
  };
  const favoriteButton = (symbol: string) => <button type="button" aria-label={t("Favorites") + " " + symbol} aria-pressed={favorites.includes(symbol)} onClick={() => toggleFavorite(symbol)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-brand-text-muted hover:text-brand-accent"><Star className={"h-4 w-4 " + (favorites.includes(symbol) ? "fill-brand-accent text-brand-accent" : "")} /></button>;
  const numberLocale = localeTags[language];
  // Price-flash detection: read previous prices during render (StrictMode-safe),
  // commit the new prices only after paint so the next diff still compares correctly.
  const prevPricesRef = useRef<Record<string, number>>({});
  const flashMap = useMemo(() => {
    const map: Record<string, "up" | "down"> = {};
    for (const item of markets) {
      const prev = prevPricesRef.current[item.sym];
      if (prev !== undefined && prev !== item.price) map[item.sym] = item.price > prev ? "up" : "down";
    }
    return map;
  }, [markets]);
  useEffect(() => {
    const next: Record<string, number> = {};
    for (const item of markets) next[item.sym] = item.price;
    prevPricesRef.current = next;
  }, [markets]);
  const flashClassOf = (sym: string) => {
    const dir = flashMap[sym];
    return dir === "up" ? "price-flash-up" : dir === "down" ? "price-flash-down" : "";
  };
  const [searchParams, setSearchParams] = useSearchParams();
  const query = (searchParams.get("q") || "").trim().toLowerCase();
  const latestSnapshotTs = markets.reduce((latest, item) => Math.max(latest, item.snapshotTs || 0), 0);
  const snapshotAgeSeconds = latestSnapshotTs > 0 ? Math.max(0, Math.floor(Date.now() / 1000 - latestSnapshotTs)) : null;
  const snapshotStale = snapshotAgeSeconds !== null && snapshotAgeSeconds > 90;
  const feedError = error || (snapshotStale ? "The market service snapshot is older than 90 seconds. Quotes are hidden until a fresh snapshot arrives." : "");
  const displayMarkets = feedError ? [] : markets;
  const latestProviderMarket = displayMarkets.reduce<MarketTicker | null>((latest, item) =>
    (item.providerTs || 0) > (latest?.providerTs || 0) ? item : latest, null);
  const providerTimestamp = latestProviderMarket?.providerTs || 0;
  const providerSource = (latestProviderMarket?.source || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
  const snapshotTime = latestSnapshotTs > 0
    ? new Intl.DateTimeFormat(numberLocale, { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(latestSnapshotTs * 1000))
    : "";
  const providerTime = providerTimestamp > 0
    ? new Intl.DateTimeFormat(numberLocale, { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(providerTimestamp * 1000))
    : "";
  const providerAgeSeconds = providerTimestamp > 0 ? Math.max(0, Math.floor(Date.now() / 1000 - providerTimestamp)) : null;
  const visibleMarkets = useMemo(() => displayMarkets.filter((item) => {
    if (!query) return true;
    return item.sym.toLowerCase().includes(query) || (names[item.sym] || "").toLowerCase().includes(query);
  }), [displayMarkets, query]);
  return (
    <Card className="flex flex-col overflow-hidden p-0 md:p-0">
      <div className="flex items-center justify-between gap-3 border-b border-brand-border px-4 py-4 md:px-6">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight text-brand-text">{t("Spot markets")}</h2>
          <p className="mt-1 text-xs text-brand-text-muted">{t("Live prices from the BTCBOX market service")}</p>
          <p className="mt-1 text-[11px] text-brand-text-muted" aria-label={snapshotTime ? `Server snapshot ${snapshotTime}` : "Server snapshot time unavailable"}>{snapshotTime ? `Server snapshot · ${snapshotTime} · ${snapshotAgeSeconds}s ago` : "Server snapshot time unavailable"}</p>
          <p className="mt-1 text-[11px] text-brand-text-muted" aria-label={providerTime ? `Provider snapshot ${providerSource || "source unavailable"} at ${providerTime}, ${providerAgeSeconds} seconds old` : "Provider timestamp unavailable"}>
            {providerTime ? `Provider snapshot · ${providerSource || "source unavailable"} · ${providerTime} · ${providerAgeSeconds}s ago` : "Provider timestamp unavailable"}
          </p>
        </div>
        <span className="shrink-0 rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 text-xs font-semibold text-brand-text-secondary">
          {loading ? t("Loading…") : feedError ? t("Unavailable") : `${visibleMarkets.length} ${t("pairs")}`}
        </span>
      </div>
      {displayMarkets.length > 0 && <div className="border-b border-brand-border px-4 py-3 md:px-6">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text-muted" />
          <input type="search" aria-label={t("Search BTCBOX")} placeholder={t("Search")} value={searchParams.get("q") || ""} onChange={(event) => setSearchParams(event.target.value ? { q: event.target.value } : {})} className="h-11 w-full rounded-xl border border-brand-border bg-brand-surface px-3 pl-10 text-sm text-brand-text placeholder:text-brand-text-muted focus:border-brand-accent focus:outline-none" />
        </label>
      </div>
      {feedError && displayMarkets.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm font-semibold text-brand-text">{t("Market feed unavailable")}</p>
          <p className="mt-2 break-words text-sm text-brand-text-muted">{feedError}</p>
        </div>
      ) : loading && displayMarkets.length === 0 ? (
        <div className="space-y-3 px-5 py-8" aria-label="Loading markets">
          {Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-12 animate-pulse rounded-xl bg-white/[0.05]" />)}
        </div>
      ) : visibleMarkets.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-brand-text-muted">{t("No market pairs are currently available.")}</div>
      ) : (
        <>
          <div className="divide-y divide-brand-border/70 sm:hidden">
            {visibleMarkets.map((item) => (
              <Link key={item.sym} to={`/trade/${item.sym}`} aria-label={`${item.sym} spot trading`} className="flex min-h-[76px] items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-brand-surface-hover active:bg-brand-surface-hover">
                <div className="flex min-w-0 items-center gap-3">
                  <TokenIcon symbol={item.sym} className="h-9 w-9 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-brand-text">{item.sym}/USDT</p>
                    <p className="type-meta mt-0.5 truncate text-brand-text-muted">{t("24h volume")} {formatCompact(item.vol, numberLocale)}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span key={item.price} className={"text-base font-bold tabular-nums text-brand-text "+flashClassOf(item.sym)}>{price(item.price, numberLocale)}</span>
                  <Change value={item.chg} locale={numberLocale} />
                </div>
              </Link>
            ))}
          </div>
          <div className="hidden w-full overflow-x-auto sm:block">
            <table className="w-full min-w-[700px] border-collapse text-left">
              <thead><tr className="border-b border-brand-border bg-brand-surface-2/70">
                {["Asset", "Last price", "24h change", "24h volume", "24h high", "24h low"].map((label) =>
                  <th key={label} className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-brand-text-muted md:px-6">{t(label)}</th>
                )}
              </tr></thead>
              <tbody>{visibleMarkets.map((item) => (
                <tr key={item.sym} className="border-b border-brand-border/50 transition-colors last:border-0 hover:bg-brand-surface-hover">
                  <td className="h-16 whitespace-nowrap px-4 py-2 md:px-6">
                    <div className="flex items-center gap-3">
                      <TokenIcon symbol={item.sym} className="h-8 w-8" />
                      <Link to={`/trade/${item.sym}`} aria-label={`${item.sym} spot trading`} className="group min-w-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent">
                        <p className="text-sm font-semibold text-brand-text group-hover:text-brand-accent">{names[item.sym] || item.sym}</p><p className="text-xs text-brand-text-muted">{item.sym}/USDT</p>
                      </Link>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 text-base font-semibold tabular-nums text-brand-text md:px-6"><span key={item.price} className={flashClassOf(item.sym)}>{price(item.price, numberLocale)}</span></td>
                  <td className="whitespace-nowrap px-4 md:px-6"><Change value={item.chg} locale={numberLocale} /></td>
                  <td className="whitespace-nowrap px-4 text-sm tabular-nums text-brand-text-secondary md:px-6">{formatCompact(item.vol, numberLocale)} USDT</td>
                  <td className="whitespace-nowrap px-4 text-sm tabular-nums text-brand-text-secondary md:px-6">{price(item.high, numberLocale)}</td>
                  <td className="whitespace-nowrap px-4 text-sm tabular-nums text-brand-text-secondary md:px-6">{price(item.low, numberLocale)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
