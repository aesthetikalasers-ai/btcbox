import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, ChartNoAxesCombined, Sprout, TrendingUp, Zap, Activity } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { useI18n } from "../../lib/i18n";
import { getSpotMarketPairs, type SpotMarketPair } from "../../lib/api";
import { PageFrame } from "./Pages";

export function TradeHubPage() {
  const { t } = useI18n();
  const [spotPairs, setSpotPairs] = useState<SpotMarketPair[]>([]);
  const [pairsLoading, setPairsLoading] = useState(true);
  const [pairsError, setPairsError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setPairsLoading(true);
    setPairsError(false);
    getSpotMarketPairs(controller.signal)
      .then((pairs) => { if (!controller.signal.aborted) setSpotPairs(pairs); })
      .catch((reason) => {
        if (reason instanceof Error && reason.name === "AbortError") return;
        if (!controller.signal.aborted) setPairsError(true);
      })
      .finally(() => { if (!controller.signal.aborted) setPairsLoading(false); });
    return () => controller.abort();
  }, [retry]);

  return (
    <PageFrame title="Choose your trading mode" tone="trading">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card className="card-lift border-brand-border bg-brand-surface shadow-xl flex flex-col justify-between">
          <CardHeader>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-brand-accent/20 bg-brand-accent/10 text-brand-accent">
              <ChartNoAxesCombined className="h-6 w-6" />
            </div>
            <CardTitle className="text-lg font-bold">{t("Spot")}</CardTitle>
            <CardDescription className="text-xs">{t("Buy and sell digital assets on spot markets.")}</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Button asChild size="sm" variant="secondary" className="w-full font-semibold">
              <Link to="/markets">{t("Open")} <ArrowUpRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="card-lift border-brand-border bg-brand-surface shadow-xl flex flex-col justify-between">
          <CardHeader>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-brand-violet/20 bg-brand-violet/10 text-brand-violet">
              <TrendingUp className="h-6 w-6" />
            </div>
            <CardTitle className="text-lg font-bold">{t("Contract")}</CardTitle>
            <CardDescription className="text-xs">{t("Explore perpetual contract markets.")}</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Button asChild size="sm" variant="secondary" className="w-full font-semibold">
              <Link to="/contract">{t("Open")} <ArrowUpRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="card-lift border-brand-border bg-brand-surface shadow-xl flex flex-col justify-between">
          <CardHeader>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-brand-cyan/20 bg-brand-cyan/10 text-brand-cyan">
              <Zap className="h-6 w-6" />
            </div>
            <CardTitle className="text-lg font-bold">{t("Seconds")}</CardTitle>
            <CardDescription className="text-xs">{t("Explore seconds trading markets.")}</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Button asChild size="sm" variant="secondary" className="w-full font-semibold">
              <Link to="/seconds">{t("Open")} <ArrowUpRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="card-lift border-brand-border bg-brand-surface shadow-xl flex flex-col justify-between">
          <CardHeader>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-brand-success/20 bg-brand-success/10 text-brand-success">
              <Sprout className="h-6 w-6" />
            </div>
            <CardTitle className="text-lg font-bold">{t("Earn")}</CardTitle>
            <CardDescription className="text-xs">{t("Explore Earn products and yields.")}</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Button asChild size="sm" variant="secondary" className="w-full font-semibold">
              <Link to="/earn">{t("Open")} <ArrowUpRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-4 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-border/40 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-brand-accent" />
            <h2 className="type-section-title font-bold">{t("Spot markets")}</h2>
          </div>
          {!pairsLoading && !pairsError ? <span className="text-xs text-brand-text-muted font-mono">{spotPairs.length} {t("pairs available")}</span> : null}
        </div>

        {pairsLoading ? (
          <Card className="border-brand-border bg-brand-surface"><CardContent className="p-6 text-sm text-brand-text-muted text-center" role="status">{t("Loading spot markets…")}</CardContent></Card>
        ) : null}

        {pairsError ? (
          <Card className="border-brand-border bg-brand-surface"><CardContent className="flex flex-wrap items-center justify-center gap-3 p-6 text-sm text-brand-text-muted" role="alert"><span>{t("Unable to load spot markets. Please try again.")}</span><Button size="sm" variant="outline" onClick={() => setRetry((value) => value + 1)}>{t("Try again")}</Button></CardContent></Card>
        ) : null}

        {spotPairs.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {spotPairs.map((pair) => (
              <Card key={pair.base_asset + "/" + pair.quote_asset} className="card-lift border-brand-border bg-brand-surface hover:border-brand-accent/40 transition-all">
                <CardHeader className="py-4">
                  <CardTitle className="text-base font-bold">{pair.base_asset}/{pair.quote_asset}</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between pt-0 pb-4">
                  <span className="text-xs text-brand-text-muted font-mono">{pair.quote_asset} {t("Market")}</span>
                  <Button asChild size="sm" variant="outline" className="h-8 text-xs font-semibold hover:border-brand-accent hover:text-brand-accent">
                    <Link to={"/trade/" + pair.base_asset + pair.quote_asset}>{t("Open")} <ArrowUpRight className="ml-1 h-3.5 w-3.5" /></Link>
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
