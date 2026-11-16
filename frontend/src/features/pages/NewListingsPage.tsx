import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Rocket } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { TokenIcon } from "../../components/ui/TokenIcon";
import { getMarkets, getSpotMarketPairs, type MarketTicker, type SpotMarketPair } from "../../lib/api";
import { localeTags, useI18n } from "../../lib/i18n";
import { PageFrame } from "./Pages";

/**
 * New listings (新币 / 打新).
 *
 * Shaped like a listing board rather than a card wall: on an exchange the reader
 * scans columns (pair → price → 24h change → action), so every pair shares one
 * grid instead of getting its own tile.
 *
 * Two surfaces stay separated:
 *   1. The spot pairs the backend reports as listed — real figures only. A pair
 *      with no ticker prints an em dash rather than a zero.
 *   2. The Launchpad subscription programme — closed until the backend opens it,
 *      so it is a slim strip, never the biggest element on the page.
 */
export function NewListingsPage() {
  const { t, language } = useI18n();
  const [pairs, setPairs] = useState<SpotMarketPair[]>([]);
  const [tickers, setTickers] = useState<Record<string, MarketTicker>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    Promise.allSettled([getSpotMarketPairs(controller.signal), getMarkets(controller.signal)]).then(([pairResult, marketResult]) => {
      if (controller.signal.aborted) return;
      if (pairResult.status === "fulfilled") {
        setPairs(pairResult.value);
        setError("");
      } else {
        setPairs([]);
        setError(pairResult.reason instanceof Error ? pairResult.reason.message : "Spot-market catalogue is unavailable.");
      }
      if (marketResult.status === "fulfilled") {
        const bySymbol: Record<string, MarketTicker> = {};
        for (const ticker of marketResult.value) bySymbol[ticker.sym.toUpperCase()] = ticker;
        setTickers(bySymbol);
      } else {
        setTickers({});
      }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);

  const tags = localeTags[language];
  const price = (value: number) => {
    if (!Number.isFinite(value) || value === 0) return "—";
    const digits = value >= 1 ? 2 : value >= 0.01 ? 4 : 6;
    return value.toLocaleString(tags, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  };
  const change = (value: number) => (Number.isFinite(value) ? `${value >= 0 ? "+" : ""}${value.toFixed(2)}%` : "—");


  return (
    <PageFrame title="New listings" tone="market" backTo="/me">
      <p className="max-w-2xl text-sm leading-relaxed text-brand-text-muted">
        {t("Discover the latest assets listed on BTCBOX")}
      </p>

      {/* A programme, not a tradeable pair: a slim strip keeps it visible without
          outranking the listings that actually can be traded today. */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-brand-warning/25 bg-brand-warning/[0.06] px-3 py-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-warning/10 text-brand-warning">
          <Rocket className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-brand-text">
            {t("Launchpad")}
            <Badge variant="outline" className="border-brand-warning/30 bg-brand-warning/10 text-[10px] text-brand-warning">{t("Coming soon")}</Badge>
          </span>
          <span className="mt-0.5 block text-[11px] leading-relaxed text-brand-text-muted">
            {t("Launchpad subscriptions open per project. No subscription window is open right now, so no quota is shown.")}
          </span>
        </span>
      </div>

      <section className="overflow-hidden rounded-lg border border-brand-border bg-brand-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-border px-3 py-2.5 sm:px-4">
          <h2 className="type-section-title font-bold">{t("Spot markets")}</h2>
          {!loading && !error ? (
            <span className="font-mono text-xs tabular-nums text-brand-text-muted">{pairs.length} {t("pairs available")}</span>
          ) : null}
        </div>

        <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_5.5rem] gap-3 border-b border-brand-border/60 px-4 py-2 text-[11px] font-semibold text-brand-text-muted sm:grid">
          <span>{t("Pair")}</span>
          <span className="text-right">{t("Last price")}</span>
          <span className="text-right">{t("24h change")}</span>
          <span className="text-right">{t("Trade")}</span>
        </div>


        {loading ? (
          <div className="divide-y divide-brand-border/60" role="status" aria-label={t("Loading configured spot markets…")}>
            {[0, 1, 2].map(row => (
              <div key={row} className="flex items-center gap-3 px-4 py-3.5">
                <span className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-brand-surface-2" />
                <span className="h-3 w-20 animate-pulse rounded bg-brand-surface-2" />
                <span className="ml-auto h-3 w-16 animate-pulse rounded bg-brand-surface-2" />
                <span className="h-3 w-12 animate-pulse rounded bg-brand-surface-2" />
              </div>
            ))}
          </div>
        ) : null}

        {error ? (
          <div className="px-4 py-6 text-center" role="alert">
            <p className="text-sm text-brand-danger">{t(error)}</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => { setError(""); setReload(n => n + 1); }}>
              {t("Try again")}
            </Button>
          </div>
        ) : null}

        {!loading && !error && pairs.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-brand-text-muted" role="status">
            {t("No newly listed pair is published yet.")}
          </p>
        ) : null}


        {pairs.length ? (
          <div className="divide-y divide-brand-border/60">
            {pairs.map(pair => {
              const base = pair.base_asset.toUpperCase();
              const quote = pair.quote_asset.toUpperCase();
              const ticker = tickers[base];
              const up = (ticker?.chg ?? 0) >= 0;
              return (
                <Link
                  key={base + "/" + quote}
                  to={"/trade/" + base + quote}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 transition-colors hover:bg-brand-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-accent/60 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_5.5rem] sm:px-4"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <TokenIcon symbol={base} className="h-8 w-8 shrink-0" />
                    <span className="min-w-0">
                      <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-brand-text">
                        <span className="truncate">{base}<span className="text-brand-text-muted">/{quote}</span></span>
                        <Badge variant="outline" className="shrink-0 border-brand-accent/30 bg-brand-accent/10 px-1.5 py-0 text-[9px] font-bold text-brand-accent">{t("NEW")}</Badge>
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 text-[11px] tabular-nums text-brand-text-muted sm:hidden">
                        <span>{ticker ? price(ticker.price) : "—"}</span>
                        <span className={up ? "text-brand-success" : "text-brand-danger"}>{ticker ? change(ticker.chg) : "—"}</span>
                      </span>
                    </span>
                  </span>
                  <span className="hidden text-right font-mono text-sm tabular-nums text-brand-text sm:block">{ticker ? price(ticker.price) : "—"}</span>
                  <span className={`hidden text-right font-mono text-sm tabular-nums sm:block ${up ? "text-brand-success" : "text-brand-danger"}`}>{ticker ? change(ticker.chg) : "—"}</span>
                  <span className="justify-self-end text-xs font-semibold text-brand-text-secondary sm:justify-self-end">
                    <span className="inline-flex h-8 items-center gap-1 rounded-md border border-brand-border px-2.5">
                      <span className="sm:hidden">{t("Trade")}</span>
                      <span className="hidden sm:inline">{t("Trade now")}</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        ) : null}
      </section>
    </PageFrame>
  );
}

