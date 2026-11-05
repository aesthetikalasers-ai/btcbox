import { useEffect, useRef } from 'react';
import { createChart, ColorType, CandlestickSeries, HistogramSeries } from 'lightweight-charts';
import { chartData, useDashboardStore } from '../dashboard.data';
import type { MarketCandle } from '../../../lib/api';
import { Card, CardHeader } from './Card';
import { cn } from '../../../lib/utils';

const RANGES = ['1h', '24h', '6h', '7d', '30d'];

export function LiquidityChart({ candles = [] }: { candles?: MarketCandle[] }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const activeRange = useDashboardStore(s => s.liquidityRange);
  const setRange = useDashboardStore(s => s.setLiquidityRange);
  const latestCandle = candles[candles.length - 1];
  const firstCandle = candles[0];
  const changePct = firstCandle && latestCandle ? ((latestCandle.close - firstCandle.open) / firstCandle.open) * 100 : 0;

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgba(255, 255, 255, 0.46)',
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
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.05)',
      },
      autoSize: true,
    });

    const series = chart.addSeries(CandlestickSeries, {
        upColor: '#22C55E',
        downColor: '#EF4444',
        borderUpColor: '#4ADE80',
        borderDownColor: '#F87171',
        borderVisible: true,
        wickUpColor: '#4ADE80',
        wickDownColor: '#F87171',
    });

    series.setData(candles.length ? candles.map(c => ({ time: Math.floor(c.time / 1000) as import('lightweight-charts').UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close })) : chartData.liquidity);
    
    const volumeSeries = chart.addSeries(HistogramSeries, {
        color: 'rgba(255, 255, 255, 0.1)',
        priceFormat: { type: 'volume' },
        priceScaleId: '', // set as an overlay
        lastValueVisible: false,
        priceLineVisible: false,
    });
    
    chart.priceScale('').applyOptions({
        scaleMargins: {
            top: 0.8,
            bottom: 0,
        },
    });
    
    volumeSeries.setData(candles.length ? candles.map(c => ({ time: Math.floor(c.time / 1000) as import('lightweight-charts').UTCTimestamp, value: c.volume, color: c.close >= c.open ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)' })) : chartData.liquidityVolume);
    
    const bars = { '1h': 1, '6h': 6, '24h': 24, '7d': 168, '30d': 720 }[activeRange] || 24;
    const totalBars = candles.length || chartData.liquidity.length;
    chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, totalBars - bars), to: totalBars });

    return () => {
      chart.remove();
    };
  }, [candles, activeRange]);

  return (
    <Card className="flex h-[320px] min-w-0 flex-col sm:h-[340px] md:h-[400px]">
      <CardHeader title="BTC/USDT price history">
        <div className="flex bg-[#121316] rounded-lg p-0.5 border border-brand-border-subtle shadow-[inset_0_1px_1px_rgba(0,0,0,0.3)]">
          {RANGES.map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "min-h-9 px-2 py-1 text-[12px] font-medium rounded-md transition-all duration-200 cursor-pointer active:scale-[0.95] sm:px-2.5",
                activeRange === r 
                  ? "bg-brand-surface-2 text-brand-text shadow-[0_1px_2px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.02)]" 
                  : "text-brand-text-muted hover:text-brand-text-secondary hover:bg-brand-surface-hover"
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </CardHeader>
      
      <div className="mb-4 flex min-w-0 shrink-0 flex-wrap items-baseline gap-x-3 gap-y-2">
        <span className="text-2xl font-semibold leading-none tracking-tight sm:text-[32px]">{latestCandle ? latestCandle.close.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "Sample series"}</span>
        <div className={cn("min-w-0 break-words text-[12px] font-medium", latestCandle ? (changePct >= 0 ? "text-profit" : "text-loss") : "text-brand-text-muted")}>
          {latestCandle ? `${changePct >= 0 ? "▲" : "▼"} ${Math.abs(changePct).toFixed(2)}% across loaded candles` : "Illustrative data"}
        </div>
      </div>
      
      {/* Historical BTC/USDT candles when available; preview series otherwise. */}
      <div className="relative flex-1 min-h-0 w-full" ref={chartContainerRef} />
    </Card>
  );
}
