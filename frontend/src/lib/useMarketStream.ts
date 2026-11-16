import { useSyncExternalStore } from "react";
import { liveMarketEngine } from "./marketData";
import type { MarketTicker } from "./api";

export type MarketStreamStatus = import("./marketData").MarketStatus;

// 稳定的模块级函数引用：useSyncExternalStore 的 subscribe 若每次渲染都新建闭包，
// React 会反复退订/重订，并可能触发额外的重渲染。
const EMPTY_TICKERS: MarketTicker[] = [];
const subscribeToEngine = (onStoreChange: () => void) => liveMarketEngine.subscribe(onStoreChange);
// 未请求行情时使用的空订阅：返回一个不注册任何监听的清理函数。
const subscribeNoop = () => () => {};
const getServerSnapshotStatus = () => "unavailable" as MarketStreamStatus;
const getServerSnapshotTickers = () => EMPTY_TICKERS;

/**
 * 统一行情 Hook：订阅后端的行情引擎（数据来自本交易所自己的 /api/market），
 * 并暴露数据新鲜度。
 *
 * - 引擎只从同源 /api/market 取价，**不会**再向浏览器里制造或臆测任何价格：
 *   拉取失败时保留最后已知价格并标记为 stale，从未取到数据则标记 unavailable。
 * - 浏览器不直连第三方交易所：那条路径被部署的 CSP 拦截，且在部分区域不可用。
 * - `tickers` 只在价格真正变化时更换引用，因此不会每 1.8 秒触发整树重渲染。
 */
export function useMarketStream(options: { tickers?: boolean } = {}) {
  const wantsTickers = options.tickers ?? false;

  // status 是原始字符串，引用天然稳定，任何时候读取都是安全的。
  const status = useSyncExternalStore<MarketStreamStatus>(
    subscribeToEngine,
    () => liveMarketEngine.getStatus(),
    getServerSnapshotStatus,
  );

  // getAllTickers() 返回引擎缓存的数组引用，仅在数据变化时才更换引用，
  // 满足 getSnapshot 必须可缓存的契约（否则会触发无限循环）。
  // 不需要行情的页面用空数组快照替代，从而完全跳过订阅。
  const tickers = useSyncExternalStore<MarketTicker[]>(
    wantsTickers ? subscribeToEngine : subscribeNoop,
    wantsTickers ? () => liveMarketEngine.getAllTickers() : getServerSnapshotTickers,
    getServerSnapshotTickers,
  );

  return {
    status,
    isLive: status === "live",
    tickers,
    getTicker: (sym: string) => liveMarketEngine.getTicker(sym),
    getKlines: (symbol: string, interval = "1h") => liveMarketEngine.getKlines(symbol, interval),
  };
}
