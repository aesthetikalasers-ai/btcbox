import React, { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  HistogramData,
  UTCTimestamp,
} from "lightweight-charts";

// 统一的标准 K 线数据结构
export interface KlineItem {
  time: number;   // 秒级 Unix 时间戳 (注意：Lightweight Charts 必须传秒，如果是毫秒需除以 1000)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradingChartRef {
  // 初始化或切换周期时，灌入全量历史 K 线
  setInitialData: (data: KlineItem[]) => void;
  // WebSocket 收到实时推流时，动态跳动最新一根蜡烛或追加新蜡烛
  updateRealtimeTick: (tick: KlineItem) => void;
  // 在图表上画一条水平价格线（如持仓成本线、强平预警线）
  addPriceLine: (price: number, title: string, color?: string) => void;
}

interface TradingChartProps {
  className?: string;
}

export const TradingChart = forwardRef<TradingChartRef, TradingChartProps>(
  ({ className = "w-full h-full" }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

    useEffect(() => {
      if (!containerRef.current) return;

      // 1. 创建图表实例并配置交易所暗黑视觉规范
      const chart = createChart(containerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: "#181A20" },
          textColor: "#848E9C",
          fontFamily: "'DIN Pro', 'Inter', sans-serif",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: "rgba(255, 255, 255, 0.04)" },
          horzLines: { color: "rgba(255, 255, 255, 0.04)" },
        },
        crosshair: {
          mode: CrosshairMode.Normal, // 自由十字准星（不强制吸附蜡烛高低点，看盘更顺滑）
          vertLine: {
            color: "#5E6673",
            width: 1,
            style: 2, // 虚线
            labelBackgroundColor: "#2B3139",
          },
          horzLine: {
            color: "#5E6673",
            width: 1,
            style: 2,
            labelBackgroundColor: "#2B3139",
          },
        },
        rightPriceScale: {
          borderColor: "rgba(255, 255, 255, 0.08)",
          scaleMargins: {
            top: 0.1,    // 顶部留出 10% 呼吸空间
            bottom: 0.25,// 底部留出 25% 空间给成交量副图，防止 K 线和成交量重叠
          },
        },
        timeScale: {
          borderColor: "rgba(255, 255, 255, 0.08)",
          timeVisible: true,   // 显示时:分
          secondsVisible: false,
          rightOffset: 6,      // 右侧留出 6 根蜡烛的空白缓冲区，方便看最新价标签
        },
      });

      // 2. 添加主图：蜡烛图系列 (Candlestick)
      const candleSeries = chart.addCandlestickSeries({
        upColor: "#0ECB81",         // 阳线实体绿
        downColor: "#F6465D",       // 阴线实体红
        borderVisible: false,       // 关闭边框让蜡烛更锐利
        wickUpColor: "#0ECB81",     // 阳线上下影线
        wickDownColor: "#F6465D",   // 阴线上下影线
      });

      // 3. 添加副图：成交量柱状图 (Volume Histogram)
      const volumeSeries = chart.addHistogramSeries({
        priceFormat: { type: "volume" },
        priceScaleId: "", // 独立价格坐标系，不干扰右侧主图价格刻度
      });

      volumeSeries.priceScale().applyOptions({
        scaleMargins: {
          top: 0.8,    // 成交量只占画布最底部 20% 高度
          bottom: 0,
        },
      });

      chartRef.current = chart;
      candleSeriesRef.current = candleSeries;
      volumeSeriesRef.current = volumeSeries;

      // 4. 响应式容器监听：浏览器缩放或手机端展开抽屉时自动重算宽高
      const resizeObserver = new ResizeObserver((entries) => {
        if (entries.length === 0 || !containerRef.current) return;
        const { width, height } = entries[0].contentRect;
        if (width > 0 && height > 0) {
          chart.applyOptions({ width, height });
        }
      });

      resizeObserver.observe(containerRef.current);

      return () => {
        resizeObserver.disconnect();
        chart.remove();
      };
    }, []);

    // 暴露给外部父组件的操控方法
    useImperativeHandle(ref, () => ({
      setInitialData(data: KlineItem[]) {
        if (!candleSeriesRef.current || !volumeSeriesRef.current) return;

        // 转换蜡烛数据
        const candles: CandlestickData[] = data.map((item) => ({
          time: item.time as UTCTimestamp,
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
        }));

        // 转换成交量数据（根据涨跌自动赋予半透明红绿）
        const volumes: HistogramData[] = data.map((item) => ({
          time: item.time as UTCTimestamp,
          value: item.volume,
          color:
            item.close >= item.open
              ? "rgba(14, 203, 129, 0.35)"
              : "rgba(246, 70, 93, 0.35)",
        }));

        candleSeriesRef.current.setData(candles);
        volumeSeriesRef.current.setData(volumes);
        chartRef.current?.timeScale().scrollToRealTime();
      },

      updateRealtimeTick(tick: KlineItem) {
        if (!candleSeriesRef.current || !volumeSeriesRef.current) return;

        // Lightweight Charts 的 update() 会自动判断：
        // 如果时间戳等于最后一根蜡烛，就原地跳动更新；如果时间戳更大，就自动追加一根新蜡烛！
        candleSeriesRef.current.update({
          time: tick.time as UTCTimestamp,
          open: tick.open,
          high: tick.high,
          low: tick.low,
          close: tick.close,
        });

        volumeSeriesRef.current.update({
          time: tick.time as UTCTimestamp,
          value: tick.volume,
          color:
            tick.close >= tick.open
              ? "rgba(14, 203, 129, 0.35)"
              : "rgba(246, 70, 93, 0.35)",
        });
      },

      addPriceLine(price: number, title: string, color = "#F0B90B") {
        candleSeriesRef.current?.createPriceLine({
          price,
          color,
          lineWidth: 1,
          lineStyle: 2, // 虚线
          axisLabelVisible: true,
          title,
        });
      },
    }));

    return <div ref={containerRef} className={className} />;
  }
);