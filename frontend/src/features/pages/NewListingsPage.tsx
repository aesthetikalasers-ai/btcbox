import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Rocket, Sparkles } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { getSpotMarketPairs, type SpotMarketPair } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { PageFrame } from "./Pages";

/**
 * New listings (新币 / 打新).
 *
 * Two distinct surfaces live here and they stay separated:
 *   1. The spot pairs the backend actually reports as listed — real data only.
 *   2. The Launchpad subscription programme — not open yet, so it renders an
 *      explicit "coming soon" notice instead of an invented countdown or quota.
 */
export function NewListingsPage() {
  const { t } = useI18n();
  const [pairs, setPairs] = useState<SpotMarketPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    getSpotMarketPairs(controller.signal)
      .then((result) => { if (!controller.signal.aborted) setPairs(result); })
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name === "AbortError") return;
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Spot-market catalogue is unavailable.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);

  return (
    <PageFrame title="New listings" tone="market" backTo="/me">
      <p className="max-w-2xl text-sm leading-relaxed text-brand-text-muted">
        {t("Discover the latest assets listed on BTCBOX")}
      </p>

      {/* Launchpad is a subscription programme, not the spot list below. It stays
          explicitly closed until the backend opens it. */}
      <Card className="border-brand-border bg-gradient-to-br from-brand-surface to-brand-surface-2">
        <CardHeader className="gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-warning/10 text-brand-warning">
                <Rocket className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <CardTitle className="text-base font-bold">{t("Launchpad")}</CardTitle>
            </div>
            <Badge variant="outline" className="border-brand-warning/30 bg-brand-warning/10 text-brand-warning text-[10px]">
              {t("Coming soon")}
            </Badge>
          </div>
          <CardDescription className="text-xs leading-relaxed">
            {t("Launchpad subscriptions open per project. No subscription window is open right now, so no quota is shown.")}
          </CardDescription>
        </CardHeader>
      </Card>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-border/40 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-accent" strokeWidth={1.75} />
            <h2 className="type-section-title font-bold">{t("Spot markets")}</h2>
          </div>
          {!loading && !error ? (
            <span className="font-mono text-xs text-brand-text-muted">{pairs.length} {t("pairs available")}</span>
          ) : null}
        </div>

        {loading ? (
          <Card className="border-brand-border bg-brand-surface">
            <CardContent className="p-6 text-center text-sm text-brand-text-muted" role="status">
              {t("Loading configured spot markets…")}
            </CardContent>
          </Card>
        ) : null}

        {error ? (
          <Card className="border-brand-danger/30 bg-brand-surface">
            <CardContent className="p-6 text-center text-sm text-brand-danger" role="alert">
              <p>{t(error)}</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => { setError(""); setLoading(true); setReload(n => n + 1); }}>
                {t("Try again")}
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {!loading && !error && pairs.length === 0 ? (
          <Card className="border-brand-border bg-brand-surface">
            <CardContent className="p-6 text-center text-sm text-brand-text-muted" role="status">
              {t("No newly listed pair is published yet.")}
            </CardContent>
          </Card>
        ) : null}

        {pairs.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pairs.map((pair) => (
              <Card key={pair.base_asset + "/" + pair.quote_asset} className="card-lift border-brand-border bg-brand-surface transition-all hover:border-brand-accent/40">
                <CardHeader className="py-4">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base font-bold">{pair.base_asset}/{pair.quote_asset}</CardTitle>
                    <Badge variant="outline" className="border-brand-success/30 text-brand-success text-[10px]">{t("Active")}</Badge>
                  </div>
                  <CardDescription className="mt-1 text-xs">{t("Instant spot execution pair")}</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between pb-4 pt-0">
                  <span className="font-mono text-xs text-brand-text-muted">{pair.quote_asset} {t("Market")}</span>
                  <Button asChild size="sm" variant="outline" className="h-8 text-xs font-semibold hover:border-brand-accent hover:text-brand-accent">
                    <Link to={"/trade/" + pair.base_asset + pair.quote_asset}>
                      {t("Trade now")} <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}
      </section>
    </PageFrame>
  );
}
