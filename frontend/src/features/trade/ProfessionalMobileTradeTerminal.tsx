import { useEffect, useMemo, useState } from "react";
import { getMarkets, getOrderBook, type OrderBookSnapshot } from "../../lib/api";
import { ChartDrawer } from "./ChartDrawer";

type ActionSide = "long" | "short";
type OrderType = "limit" | "market";

const SYMBOL = "BTCUSDT";
const PAIR_LABEL = "BTC/USDT";
const LEVERAGE_OPTIONS = [10, 20, 50, 100] as const;
const RATIO_OPTIONS = [25, 50, 75, 100] as const;
const AVAILABLE_USDT = 12450; // 演示可用余额

/**
 * BTCBOX 移动端永续合约交易终端（Binance 风格参考原型）。
 * 专业分段控件 / 杠杆选择器 / 仓位比例滑块联动数量 / 紧凑盘口。
 */
export default function ProfessionalMobileTradeTerminal() {
  const [actionSide, setActionSide] = useState<ActionSide>("long");
  const [orderType, setOrderType] = useState<OrderType>("limit");
  const [leverage, setLeverage] = useState<number>(20);
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [ratio, setRatio] = useState<number>(0); // 仓位比例 0-100

  const [book, setBook] = useState<OrderBookSnapshot | null>(null);
  const [markPrice, setMarkPrice] = useState<number | null>(null);
  const [changePct, setChangePct] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const loadMarket = () => {
      getMarkets(controller.signal)
        .then((rows) => {
          if (cancelled) return;
          const found = rows.find((m) => m.sym.toUpperCase() === "BTC") || null;
          if (found) { setMarkPrice(found.price); setChangePct(found.chg); }
        })
        .catch(() => {});
    };
    const loadBook = () => {
      getOrderBook(SYMBOL, controller.signal)
        .then((rows) => { if (!cancelled && rows) setBook(rows); })
        .catch(() => {});
    };
    loadMarket();
    loadBook();
    const timer = window.setInterval(() => { loadMarket(); loadBook(); }, 5000);
    return () => { cancelled = true; controller.abort(); window.clearInterval(timer); };
  }, []);

  const asks = useMemo(() => (book ? book.asks.slice(0, 6).reverse() : []), [book]);
  const bids = useMemo(() => (book ? book.bids.slice(0, 6) : []), [book]);
  const lastPrice = markPrice ?? (book ? Number(book.asks[0]?.[0] ?? book.bids[0]?.[0]) || null : null);

  // 盘口深度条：相对最大量的宽度比例
  const maxSize = useMemo(() => {
    let m = 0;
    for (const [, q] of [...asks, ...bids]) { const n = Number(q); if (n > m) m = n; }
    return m;
  }, [asks, bids]);

  // 滑块联动数量：按比例计算可用余额能买的数量
  const applyRatio = (pct: number) => {
    setRatio(pct);
    if (pct <= 0) { setQuantity(""); return; }
    const px = orderType === "limit" ? Number(price || lastPrice || 0) : Number(lastPrice || 0);
    if (!Number.isFinite(px) || px <= 0) return;
    const notional = (AVAILABLE_USDT * pct) / 100;
    const qty = (notional / px).toFixed(4).replace(/\.?0+$/, "");
    setQuantity(qty);
  };

  const fmtPrice = (v: number | null | undefined) => v === null || v === undefined ? "—" : v.toLocaleString("en-US", { maximumFractionDigits: 8 });
  const fmtQty = (v: string | number | undefined) => v === undefined || v === "" ? "—" : v;

  return (
    <div className="relative bg-[#0b0e11] text-white w-full min-h-screen flex flex-col font-sans pb-16 select-none overflow-x-hidden">
      {/* ==================== 1. 顶部 ==================== */}
      <div className="bg-[#161a1e] sticky top-0 z-30">
        <div className="px-3 py-1 text-[10px] text-gray-300 bg-[#1c2127] border-b border-white/5 truncate">
          📢 BTCBOX 永续合约交易已开启 · 敬请关注风险提示
        </div>
        <div className="px-3 py-2 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-base font-black tracking-wide">{PAIR_LABEL}</span>
            <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-bold">永续</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold tabular-nums ${changePct >= 0 ? "bg-[#0ecb81]/20 text-[#0ecb81]" : "bg-[#f6465d]/20 text-[#f6465d]"}`}>
              {changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%
            </span>
          </div>
          {/* 全屏图表入口 */}
          <button type="button" className="text-gray-300 text-xs hover:text-white transition-colors flex items-center gap-1">
            <span className="text-sm">⛶</span>全屏图表
          </button>
        </div>
        <div className="px-3 py-1 bg-black/40 text-[10px] text-gray-400 flex justify-between tabular-nums border-t border-white/5">
          <span>最新: <strong className="text-[#0ecb81]">{fmtPrice(lastPrice)}</strong></span>
          <span>资金费率: <strong className="text-[#0ecb81]">+0.0100%</strong></span>
          <span>倒计时: <strong className="text-gray-200">00:35:37</strong></span>
        </div>
      </div>

      {/* ==================== 2. 统一通栏背景：下单 + 盘口 ==================== */}
      <div className="bg-[#161a1e] border-b border-white/10">
        <div className="px-3 pt-2 pb-2 grid grid-cols-12 gap-2">
          {/* ============ 左侧：下单面板 ============ */}
          <div className="col-span-7 space-y-1.5 flex flex-col">
            <div className="grid grid-cols-2 gap-1 bg-black/40 p-0.5 rounded-lg text-[11px] font-bold">
              <button type="button" className="py-1 rounded-md bg-[#2b3139] text-white">开仓</button>
              <button type="button" className="py-1 rounded-md text-gray-400">平仓</button>
            </div>

            {/* 杠杆设置组件 */}
            <div className="rounded-lg border border-white/10 bg-black/30 p-1.5">
              <div className="flex items-center justify-between text-[10px] text-gray-400 px-0.5">
                <span>杠杆</span>
                <span className="text-[#0ecb81] font-bold tabular-nums">{leverage}x</span>
              </div>
              <div className="mt-1 grid grid-cols-4 gap-1">
                {LEVERAGE_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setLeverage(n)}
                    className={`py-1 rounded text-[11px] font-bold transition-colors ${leverage === n ? "bg-[#0ecb81]/15 text-[#0ecb81]" : "text-gray-400 hover:text-white"}`}
                  >
                    {n}x
                  </button>
                ))}
              </div>
            </div>

            {/* 限价 / 市价 分段切换 */}
            <div className="grid grid-cols-2 gap-1 bg-black/40 p-0.5 rounded-lg text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setOrderType("limit")}
                className={`py-1 rounded-md transition-all ${orderType === "limit" ? "bg-[#2b3139] text-white" : "text-gray-400"}`}
              >
                限价
              </button>
              <button
                type="button"
                onClick={() => setOrderType("market")}
                className={`py-1 rounded-md transition-all ${orderType === "market" ? "bg-[#2b3139] text-white" : "text-gray-400"}`}
              >
                市价
              </button>
            </div>

            {orderType === "limit" && (
              <div className="bg-black/40 border border-white/10 rounded-lg px-2 py-1">
                <div className="text-[9px] text-gray-400">委托价格 (USDT)</div>
                <input
                  type="text" inputMode="decimal" value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder={fmtPrice(lastPrice)}
                  className="w-full bg-transparent text-xs font-bold tabular-nums text-white outline-none"
                />
              </div>
            )}

            <div className="bg-black/40 border border-white/10 rounded-lg px-2 py-1">
              <div className="text-[9px] text-gray-400">数量 (BTC)</div>
              <input
                type="text" inputMode="decimal" value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0.00"
                className="w-full bg-transparent text-xs font-bold tabular-nums text-white outline-none"
              />
            </div>

            {/* 仓位比例滑块 + 快捷选项 */}
            <div className="pt-0.5">
              <input
                type="range" min={0} max={100} step={25} value={ratio}
                onChange={(e) => applyRatio(Number(e.target.value))}
                className="w-full h-1 accent-[#0ecb81]"
                aria-label="仓位比例"
              />
              <div className="mt-1 grid grid-cols-4 gap-1">
                {RATIO_OPTIONS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => applyRatio(p)}
                    className={`py-0.5 rounded border text-[10px] font-semibold tabular-nums transition-colors ${ratio === p ? "border-[#0ecb81]/40 text-[#0ecb81]" : "border-white/10 text-gray-400 hover:text-white"}`}
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between text-[10px] text-gray-400 tabular-nums px-0.5">
              <span>可用</span>
              <span className="text-white font-semibold">12,450.00 USDT</span>
            </div>
          </div>

          {/* ============ 右侧：紧凑盘口（grid 双列 + 深度条） ============ */}
          <div className="col-span-5 flex flex-col text-[10px] tabular-nums">
            <div className="grid grid-cols-[1.1fr_0.9fr] pb-1 border-b border-white/5 font-semibold text-[9px] text-gray-400">
              <span>价格</span>
              <span className="text-right">数量</span>
            </div>

            {/* 卖盘（价格左对齐、数量右对齐，深度条覆盖） */}
            <div className="flex flex-col">
              {asks.map((row, idx) => {
                const depth = maxSize ? (Number(row[1]) / maxSize) * 100 : 0;
                return (
                  <div key={`a${idx}`} className="relative grid grid-cols-[1.1fr_0.9fr] h-[18px] leading-[18px]">
                    <span className="absolute inset-y-0 right-0 bg-[#f6465d]/10" style={{ width: `${depth}%` }} />
                    <span className="relative text-left text-[#f6465d]">{fmtPrice(Number(row[0]))}</span>
                    <span className="relative text-right text-gray-300">{fmtQty(row[1])}</span>
                  </div>
                );
              })}
            </div>

            {/* 中间最新价（独立突出） */}
            <div className="py-1.5 my-1 text-center">
              <span className="text-sm font-black text-[#0ecb81]">{fmtPrice(lastPrice)}</span>
            </div>

            {/* 买盘 */}
            <div className="flex flex-col">
              {bids.map((row, idx) => {
                const depth = maxSize ? (Number(row[1]) / maxSize) * 100 : 0;
                return (
                  <div key={`b${idx}`} className="relative grid grid-cols-[1.1fr_0.9fr] h-[18px] leading-[18px]">
                    <span className="absolute inset-y-0 right-0 bg-[#0ecb81]/10" style={{ width: `${depth}%` }} />
                    <span className="relative text-left text-[#0ecb81]">{fmtPrice(Number(row[0]))}</span>
                    <span className="relative text-right text-gray-300">{fmtQty(row[1])}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ==================== 3. 做多/做空按钮（大尺寸，仅此两键突出） ==================== */}
      <div className="px-3 pt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setActionSide("long")}
          className={`py-3 rounded-xl font-black text-xs tracking-wider transition-all active:scale-[0.98] ${
            actionSide === "long"
              ? "bg-gradient-to-r from-[#0ecb81] to-[#0ab371] text-gray-950 shadow-[0_4px_20px_rgba(14,203,129,0.45)]"
              : "bg-[#0ecb81]/20 text-[#0ecb81] border border-[#0ecb81]/40"
          }`}
        >
          多仓
        </button>
        <button
          type="button"
          onClick={() => setActionSide("short")}
          className={`py-3 rounded-xl font-black text-xs tracking-wider transition-all active:scale-[0.98] ${
            actionSide === "short"
              ? "bg-gradient-to-r from-[#f6465d] to-[#d9384f] text-white shadow-[0_4px_20px_rgba(246,70,93,0.45)]"
              : "bg-[#f6465d]/20 text-[#f6465d] border border-[#f6465d]/40"
          }`}
        >
          空仓
        </button>
      </div>

      {/* ==================== 4. 持仓 / 委托标签（全出血通栏） ==================== */}
      <div className="px-3 pt-2">
        <div className="flex space-x-6 text-xs font-bold border-b border-white/10 pb-2">
          <span className="text-[#0ecb81] border-b-2 border-[#0ecb81] pb-2">当前持仓 (0)</span>
          <span className="text-gray-400">当前委托 (0)</span>
        </div>
      </div>

      {/* ==================== 5. 底部 K 线抽屉 ==================== */}
      <ChartDrawer symbol={PAIR_LABEL} />

      {/* ==================== 6. 底部固定导航栏 ==================== */}
      <div className="bg-[#161a1e] border-t border-white/10 px-4 py-2 flex justify-between items-center text-xs fixed bottom-0 left-0 right-0 z-40">
        <button type="button" className="text-gray-400">首页</button>
        <button type="button" className="text-gray-400">行情</button>
        <button type="button" className="text-[#0ecb81] font-bold relative">
          <span>交易</span>
          <div className="absolute -top-2 w-5 h-1 bg-[#0ecb81] rounded-full shadow-[0_0_8px_rgba(14,203,129,0.8)]" />
        </button>
        <button type="button" className="text-gray-400">资产</button>
        <button type="button" className="text-gray-400">我的</button>
      </div>
    </div>
  );
}
