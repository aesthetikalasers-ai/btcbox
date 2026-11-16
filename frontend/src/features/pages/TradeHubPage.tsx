import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, ChartNoAxesCombined, ArrowLeftRight, Sprout, TrendingUp, ShieldCheck, Zap, Activity } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";
import { getSpotMarketPairs, getTradingStatus, getSecondsPolicy, getEarnCatalog, getPerpMarkets, type SpotMarketPair, type TradingStatus } from "../../lib/api";
import { PageFrame } from "./Pages";


/**
 * Professional Institutional-Grade TradeHub Service Directory
 */
export function TradeHubPage() {
  const { t } = useI18n();
  const { status } = useAuth();
  const [spotPairs, setSpotPairs] = useState<SpotMarketPair[]>([]);
  const [pairsLoading, setPairsLoading] = useState(true);
  const [pairsError, setPairsError] = useState("");
  const [tradingStatus, setTradingStatus] = useState<TradingStatus | null>(null);
  const [tradingStatusError, setTradingStatusError] = useState("");
  const [secondsAvailability, setSecondsAvailability] = useState<"loading" | "sign-in" | "enabled" | "read-only" | "unavailable">("loading");
  const [earnAvailability, setEarnAvailability] = useState<"loading" | "sign-in" | "enabled" | "read-only" | "empty" | "unavailable">("loading");
  const [perpAvailability, setPerpAvailability] = useState<"loading" | "sign-in" | "enabled" | "read-only" | "unavailable">("loading");

  useEffect(() => {
    const controller = new AbortController();
    getSpotMarketPairs(controller.signal)
      .then(setSpotPairs)
      .catch((reason) => {
        if (reason instanceof Error && reason.name === "AbortError") return;
        setPairsError(reason instanceof Error ? reason.message : "Spot-market catalogue is unavailable.");
      })
      .finally(() => { if (!controller.signal.aborted) setPairsLoading(false); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setTradingStatus(null); setTradingStatusError("");
    getTradingStatus(controller.signal).then((snapshot) => {
      if (!controller.signal.aborted) setTradingStatus(snapshot);
    }).catch((reason) => {
      if (reason instanceof Error && reason.name === "AbortError") return;
      if (!controller.signal.aborted) setTradingStatusError(reason instanceof Error ? reason.message : "Spot execution status is unavailable.");
    });

    if (status === "loading") {
      setSecondsAvailability("loading"); setEarnAvailability("loading"); setPerpAvailability("loading");
    } else if (status !== "authenticated") {
      setSecondsAvailability("sign-in"); setEarnAvailability("sign-in"); setPerpAvailability("sign-in");
    } else {
      Promise.allSettled([getSecondsPolicy(controller.signal), getEarnCatalog(controller.signal), getPerpMarkets(controller.signal)]).then(([seconds, earn, perp]) => {
        if (controller.signal.aborted) return;
        setSecondsAvailability(seconds.status === "fulfilled" ? (seconds.value.actions_enabled ? "enabled" : "read-only") : "unavailable");
        setEarnAvailability(earn.status === "rejected" ? "unavailable" : earn.value.products.length === 0 ? "empty" : earn.value.actions_enabled ? "enabled" : "read-only");
        setPerpAvailability(perp.status === "fulfilled" ? (perp.value.length > 0 ? "enabled" : "read-only") : "unavailable");
      });
    }
    return () => controller.abort();
  }, [status]);

  const spotExecutionEnabled = tradingStatus?.spot_order_entry_enabled === true;



  return (
    <PageFrame
      title="Choose your trading mode"
      tone="trading"
      action={<Badge variant="outline" className="shrink-0 border-brand-accent/30 bg-brand-accent/10 text-xs text-brand-accent">{t("Pro Portal")}</Badge>}
    >
      {/* 4 Core Trading Product Cards (Institutional Grid) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Spot Card */}
        <Card className="card-lift border-brand-border bg-brand-surface shadow-xl flex flex-col justify-between">
          <CardHeader>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-brand-accent/20 bg-brand-accent/10 text-brand-accent">
              <ChartNoAxesCombined className="h-6 w-6" />
            </div>
            <CardTitle className="text-lg font-bold">{t("Spot")}</CardTitle>
            <CardDescription className="text-xs">{t("Place server-validated limit orders on configured spot pairs with high liquidity.")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-0">
            <Badge data-testid="spot-availability" variant={spotExecutionEnabled ? "outline" : "secondary"} className={spotExecutionEnabled ? "border-brand-success/30 text-brand-success" : ""}>
              {spotExecutionEnabled ? t("Order entry enabled") : t("Unavailable")}
            </Badge>
            <Button asChild size="sm" variant="secondary" className="shrink-0 font-semibold">
              <Link to="/markets">{t("View markets")} <ArrowUpRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </CardContent>
        </Card>

        {/* Perpetual Card */}
        <Card className="card-lift border-brand-border bg-brand-surface shadow-xl flex flex-col justify-between">
          <CardHeader>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-brand-violet/20 bg-brand-violet/10 text-brand-violet">
              <TrendingUp className="h-6 w-6" />
            </div>
            <CardTitle className="text-lg font-bold">{t("Perpetual")}</CardTitle>
            <CardDescription className="text-xs">{t("Trade USDT-margined perpetual contracts with dynamic leverage up to 100x.")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-0">
            <Badge variant={perpAvailability === "enabled" ? "outline" : "secondary"} className={perpAvailability === "enabled" ? "border-brand-success/30 text-brand-success" : ""}>
              {perpAvailability === "enabled" ? t("Live trading") : t("Unavailable")}
            </Badge>
            <Button asChild size="sm" variant="secondary" className="shrink-0 font-semibold">
              <Link to="/contract">{t("Trade")} <ArrowUpRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </CardContent>
        </Card>

        {/* Seconds Card */}
        <Card className="card-lift border-brand-border bg-brand-surface shadow-xl flex flex-col justify-between">
          <CardHeader>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-brand-cyan/20 bg-brand-cyan/10 text-brand-cyan">
              <Zap className="h-6 w-6" />
            </div>
            <CardTitle className="text-lg font-bold">{t("Seconds")}</CardTitle>
            <CardDescription className="text-xs">{t("Place policy-driven positions with independent timers and automated settlement.")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-0">
            <Badge variant={secondsAvailability === "enabled" ? "outline" : "secondary"} className={secondsAvailability === "enabled" ? "border-brand-success/30 text-brand-success" : ""}>
              {secondsAvailability === "enabled" ? t("Order entry enabled") : t("Sign in required")}
            </Badge>
            <Button asChild size="sm" variant="secondary" className="shrink-0 font-semibold">
              <Link to="/seconds">{status === "authenticated" ? t("Open") : t("Sign in to view")} <ArrowUpRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </CardContent>
        </Card>

        {/* Earn Card */}
        <Card className="card-lift border-brand-border bg-brand-surface shadow-xl flex flex-col justify-between">
          <CardHeader>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-brand-success/20 bg-brand-success/10 text-brand-success">
              <Sprout className="h-6 w-6" />
            </div>
            <CardTitle className="text-lg font-bold">{t("Earn")}</CardTitle>
            <CardDescription className="text-xs">{t("Review available Earn products, flexible yields, and manage capital positions.")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-0">
            <Badge variant={earnAvailability === "enabled" ? "outline" : "secondary"} className={earnAvailability === "enabled" ? "border-brand-success/30 text-brand-success" : ""}>
              {earnAvailability === "enabled" ? t("Products available") : t("Sign in required")}
            </Badge>
            <Button asChild size="sm" variant="secondary" className="shrink-0 font-semibold">
              <Link to="/earn">{status === "authenticated" ? t("Open") : t("Sign in to view")} <ArrowUpRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </CardContent>
        </Card>
      </div>



      {/* Spot Markets Quick Catalog Section */}
      <section className="space-y-4 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-border/40 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-brand-accent" />
            <h2 className="type-section-title font-bold">{t("Spot markets")}</h2>
          </div>
          {!pairsLoading && !pairsError ? <span className="text-xs text-brand-text-muted font-mono">{spotPairs.length} {t("pairs available")}</span> : null}
        </div>

        {pairsLoading ? (
          <Card className="border-brand-border bg-brand-surface"><CardContent className="p-6 text-sm text-brand-text-muted text-center" role="status">{t("Loading configured spot markets…")}</CardContent></Card>
        ) : null}

        {pairsError ? (
          <Card className="border-brand-danger/30 bg-brand-surface"><CardContent className="p-6 text-sm text-brand-danger text-center" role="alert">{t(pairsError)}</CardContent></Card>
        ) : null}

        {spotPairs.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {spotPairs.map((pair) => (
              <Card key={pair.base_asset + "/" + pair.quote_asset} className="card-lift border-brand-border bg-brand-surface hover:border-brand-accent/40 transition-all">
                <CardHeader className="py-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold">{pair.base_asset}/{pair.quote_asset}</CardTitle>
                    <Badge variant="outline" className="border-brand-success/30 text-brand-success text-[10px]">{t("Active")}</Badge>
                  </div>
                  <CardDescription className="text-xs mt-1">{t("Instant spot execution pair")}</CardDescription>
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

