import React, { useCallback } from "react";

export interface ActionGuardOptions {
  isAuthenticated: boolean;
  onRequireAuth: () => void;
}

/**
 * 公开预览模式下允许浏览；仅在执行账户/资金操作时触发登录引导
 * - 未登录时不展行情/盘口/秒合约/理财“阻断”横幅，仅在用户点击下单/买卖/申购/赎回/查看持仓时拦截
 */
export function useActionAuthGate({ isAuthenticated, onRequireAuth }: ActionGuardOptions) {
  const runGuardedAction = useCallback(
    (action?: () => void | Promise<void>) => {
      if (!isAuthenticated) {
        onRequireAuth();
        return false;
      }
      if (action) {
        void action();
      }
      return true;
    },
    [isAuthenticated, onRequireAuth]
  );

  return { runGuardedAction };
}

/**
 * 公开行情兜底生成器：当网关未启动或接口异常时，生成自然随机游走的示例 K 线，
 * 避免明显规律的正弦/锯齿波，也不在界面展示“行情不可用/TRANSPORT_ERROR”阻断条。
 * 返回的 candle 数据可直接传给 chart 组件的 setData / fitContent。
 */
export function buildFallbackKlines(
  basePrice = 68420.55,
  count = 48,
  intervalMs = 60_000
) {
  const now = Date.now();
  let current = basePrice;
  const candles: Array<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
  }> = [];

  for (let i = count - 1; i >= 0; i -= 1) {
    const time = now - i * intervalMs;
    // 自然随机游走 + 轻微均值回归，避免周期性波浪形
    const drift = (Math.random() - 0.495) * (basePrice * 0.0022);
    const meanRevert = (basePrice - current) * 0.04;
    const open = Number(current.toFixed(2));
    const close = Number(Math.max(1, current + drift + meanRevert).toFixed(2));
    const spread = Math.abs(drift) + basePrice * (0.0006 + Math.random() * 0.0014);
    const high = Number((Math.max(open, close) + spread * (0.4 + Math.random() * 0.6)).toFixed(2));
    const low = Number((Math.min(open, close) - spread * (0.4 + Math.random() * 0.6)).toFixed(2));
    candles.push({ time, open, high, low, close });
    current = close;
  }

  return candles;
}