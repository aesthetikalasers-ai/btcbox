import { useSyncExternalStore } from "react";
import { liveMarketEngine } from "./marketData";
import type { MarketTicker } from "./api";

export type MarketStreamStatus = "live" | "simulated";

// 稳定的模块级函数引用：useSyncExternalStore 的 subscribe 若每次渲染都新建闭包，
// React 会反复退订/重订，并可能触发额外的重渲染。
const EMPTY_TICKERS: MarketTicker[] = [];
const subscribeToEngine = (onStoreChange: () => void) => liveMarketEngine.subscribe(onStoreChange);
// 未请求行情时使用的空订阅：返回一个不注册任何监听的清理函数。
const subscribeNoop = () => () => {};
const getServerSnapshotStatus = () => "simulated" as MarketStreamStatus;
const getServerSnapshotTickers = () => EMPTY_TICKERS;

/**
 * 统一实时行情 Hook：订阅 Binance 公共行情引擎，并暴露数据源连接状态。
 *
 * - 引擎内部已实现 3 秒连接超时与离线自动降级，任何网络阻断都会无缝切换到
 *   高保真模拟 tick 生成器，绝不向用户弹出错误提示。
 * - `status` 为 "live"（Binance 直连）或 "simulated"（模拟行情模式）。
 * - `tickers` 会随行情刷新触发重渲染（每 1.8 秒）。若页面只需要 `status`
 *   或按需读取 `getTicker()`，请传 `{ tickers: false }` 避免无谓的整树重渲染。
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
