import { useEffect, useRef, useState } from 'react';
import { KlineItem, TradingChart, TradingChartRef } from '../components/TradingChart';
import { marketWS } from '../services/wsChart';

const INTERVALS = ['1m', '15m', '1H', '4H', '1D'] as const;
type IntervalType = (typeof INTERVALS)[number];

export function ChartSection() {
  const chartRef = useRef<TradingChartRef>(null);
  const [interval, setInterval] = useState<IntervalType>('1m');

  useEffect(() => {
    let isMounted = true;

    // 1. 拉取 OKX V5 公开历史 K 线
    fetch(`https://www.okx.com/api/v5/market/candles?instId=BTC-USDT&bar=${interval}&limit=300`)
      .then((res) => res.json())
      .then((json) => {
        if (!isMounted || !json?.data) return;

        // OKX 返回数据为倒序（最新在前），Lightweight Charts 需按时间正序排列
        const formattedHistory: KlineItem[] = [...json.data]
          .reverse()
          .map((row: string[]) => ({
            time: Math.floor(Number(row[0]) / 1000),
            open: parseFloat(row[1]),
            high: parseFloat(row[2]),
            low: parseFloat(row[3]),
            close: parseFloat(row[4]),
            volume: parseFloat(row[5]),
          }));

        chartRef.current?.setInitialData(formattedHistory);
        chartRef.current?.addPriceLine(91200, '持仓均价', '#0ECB81');
      })
      .catch((err) => {
        if (isMounted) console.error('K线历史数据拉取失败:', err);
      });

    // 2. 订阅 WebSocket 实时 K 线频道
    const unsub = marketWS.subscribe(
      { channel: `candle${interval}`, instId: 'BTC-USDT' },
      (res: any) => {
        if (!isMounted) return;
        const raw = res.data?.[0];
        if (!raw) return;

        chartRef.current?.updateRealtimeTick({
          time: Math.floor(Number(raw[0]) / 1000),
          open: parseFloat(raw[1]),
          high: parseFloat(raw[2]),
          low: parseFloat(raw[3]),
          close: parseFloat(raw[4]),
          volume: parseFloat(raw[5]),
        });
      }
    );

    return () => {
      isMounted = false;
      unsub();
    };
  }, [interval]);

  return (
    <div className="flex flex-col h-full bg-[#181A20]">
      {/* 顶部周期切换工具栏 */}
      <div className="h-9 px-3 border-b border-white/5 flex items-center gap-3 text-xs">
        {INTERVALS.map((item) => (
          <button
            key={item}
            onClick={() => setInterval(item)}
            className={`px-2 py-1 rounded transition-colors ${interval === item
                ? 'bg-[#2B3139] text-[#F0B90B] font-bold'
                : 'text-[#848E9C] hover:text-[#EAECEF]'
              }`}
          >
            {item}
          </button>
        ))}
      </div>

      {/* 图表本体容器 */}
      <div className="flex-1 min-h-0">
        <TradingChart ref={chartRef} />
      </div>
    </div>
  );
}
