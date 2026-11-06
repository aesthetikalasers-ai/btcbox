import { useEffect, useRef } from 'react';
import { createChart, ColorType, HistogramSeries } from 'lightweight-charts';
import { useDashboardStore } from '../dashboard.data';
import type { MarketCandle } from '../../../lib/api';
import { Card, CardHeader } from './Card';
import { cn } from '../../../lib/utils';

const RANGES = ['1d', '7d', '30d'];

export function VolumeChart({ candles = [] }: { candles?: MarketCandle[] }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const activeRange = useDashboardStore(s => s.volumeRange);
  const setRange = useDashboardStore(s => s.setVolumeRange);
  const latestCandle = candles[candles.length - 1];

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgba(255, 255, 255, 0.38)',
        fontSize: 11,
        fontFamily: 'Inter',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.02)', style: 4 },
        horzLines: { color: 'rgba(255, 255, 255, 0.02)', style: 4 }, 
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: 'rgba(255, 255, 255, 0.15)',
          width: 1,
          style: 3,
          labelBackgroundColor: '#101113',
        },
        horzLine: {
          color: 'rgba(255, 255, 255, 0.15)',
          width: 1,
          style: 3,
          labelBackgroundColor: '#101113',
        },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.05)',
        timeVisible: false,
      },
      handleScroll: { vertTouchDrag: false, horzTouchDrag: true },
      handleScale: { pinch: true },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.05)',
      },
      autoSize: true,
    });

    const series = chart.addSeries(HistogramSeries, {
      color: '#22C55E',
      base: 0,
      priceFormat: {
        type: 'volume',
      },
    });

    series.setData(candles.map(c => ({ time: Math.floor(c.time / 1000) as import('lightweight-charts').UTCTimestamp, value: c.volume, color: c.close >= c.open ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)' })));
    
    const bars = { '1d': 288, '7d': 168, '30d': 30 }[activeRange] || 288;
    const totalBars = candles.length;
    if (totalBars > 0) chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, totalBars - bars), to: totalBars });

    return () => {
      chart.remove();
    };
  }, [candles, activeRange]);

  return (
    <Card className="flex h-[320px] min-w-0 flex-col sm:h-[340px] md:h-[400px]">
      <CardHeader title="BTC/USDT trading volume">
        <div className="flex max-w-full gap-0.5 overflow-x-auto rounded-lg border border-brand-border-subtle bg-brand-surface-2 p-0.5 shadow-[inset_0_1px_1px_rgba(0,0,0,0.3)] custom-scrollbar">
          {RANGES.map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "min-h-11 min-w-11 shrink-0 whitespace-nowrap rounded-md px-2 py-1 text-[12px] font-medium transition-all duration-200 cursor-pointer touch-manipulation active:scale-[0.97] sm:px-2.5",
                activeRange === r 
                  ? "bg-brand-surface-2 text-brand-text shadow-[0_1px_2px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.02)] border border-brand-border-subtle" 
                  : "text-brand-text-muted hover:text-brand-text-secondary hover:bg-brand-surface-hover"
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </CardHeader>
      
      <div className="mb-4 flex min-w-0 shrink-0 flex-wrap items-baseline gap-x-3 gap-y-2">
        <span className="text-2xl font-semibold leading-none tracking-tight sm:text-[32px]">{latestCandle ? latestCandle.volume.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "No market data"}</span>
        <div className="min-w-0 break-words text-[12px] font-medium text-brand-text-muted">
          {latestCandle ? "Latest candle · selected range" : "Waiting for market data"}
        </div>
      </div>
      
      <div className="relative flex-1 min-h-0 w-full" ref={chartContainerRef} />
    </Card>
  );
}
