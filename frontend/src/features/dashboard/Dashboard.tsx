import { useEffect, useState } from "react";
import { LiquidityChart } from "./components/LiquidityChart";
import { VolumeChart } from "./components/VolumeChart";
import { LiveMarketsTable } from "./components/LiveMarketsTable";
import { Badge } from "../../components/ui/badge";
import { getKlines, getMarkets, type MarketCandle, type MarketTicker } from "../../lib/api";
import { useI18n } from "../../lib/i18n";

export function Dashboard() {
  const {t}=useI18n();
  const [markets,setMarkets]=useState<MarketTicker[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [candles,setCandles]=useState<MarketCandle[]>([]);
  useEffect(()=>{
    const controller=new AbortController();
    getKlines("BTCUSDT","1h",controller.signal).then(setCandles).catch(()=>setCandles([]));
    const loadMarkets=()=>{
      getMarkets(controller.signal).then((rows)=>{setMarkets(rows);setError("");}).catch((reason:unknown)=>{
        if(reason instanceof Error&&reason.name==="AbortError")return;
        setError(reason instanceof Error?reason.message:"Market data is unavailable.");
      }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    };
    loadMarkets();const refreshId=window.setInterval(loadMarkets,30000);
    return()=>{window.clearInterval(refreshId);controller.abort();};
  },[]);
  return <div className="mx-auto flex w-full max-w-[1600px] min-w-0 flex-col gap-5 p-3 sm:gap-6 sm:p-5 lg:p-7">
    <div className="flex flex-wrap items-end justify-between gap-3"><div className="min-w-0"><p className="mb-1 text-xs font-bold uppercase tracking-[.18em] text-sky-300">{t("BTCBOX / MARKETS")}</p><h1 className="text-[26px] font-extrabold tracking-tight text-brand-text sm:text-3xl">{t("Market overview")}</h1><p className="mt-1.5 text-[15px] text-brand-text-secondary">{t("Live spot prices and 24-hour market movement.")}</p></div><Badge variant="outline" className="border-brand-accent/30 bg-brand-accent/10 px-3 py-1 text-brand-text-secondary">{loading?t("Connecting"):error?t("Feed unavailable"):t("Live market feed")}</Badge></div>
    <LiveMarketsTable markets={markets} loading={loading} error={error}/>
    <div className="flex items-center justify-between gap-3 px-1 pt-1"><div><h2 className="text-base font-bold text-brand-text">{t("Market analytics")}</h2><p className="mt-1 text-sm text-brand-text-muted">{t("Historical chart integration is still in progress.")}</p></div><Badge variant="outline" className="shrink-0 border-brand-border bg-brand-surface">{candles.length?"BTC/USDT · 1h":"Chart preview"}</Badge></div>
    <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-5"><LiquidityChart candles={candles}/><VolumeChart candles={candles}/></div>
  </div>;
}
