import Decimal from "decimal.js";

// 全局配置：保留 20 位有效数字精度，防止中间运算过程丢失微小数位
Decimal.set({ precision: 20, rounding: Decimal.ROUND_DOWN });

/**
 * 安全转换任意输入为 Decimal 实例（防空字符串、NaN、undefined 报错）
 */
export function toDec(val: string | number | undefined | null): Decimal {
  if (val === undefined || val === null || val === '' || val === '-') {
    return new Decimal(0);
  }
  try {
    const cleanVal = String(val).replace(/,/g, '').trim();
    return new Decimal(cleanVal || 0);
  } catch {
    return new Decimal(0);
  }
}

/**
 * 1. 金融级向下截断格式化（核心铁律：宁少勿多，防止下单/提现时资金超支）
 * @param val 原始数值
 * @param decimals 保留小数位数 (如 BTC 数量保留 4 位，USDT 金额保留 2 位)
 * @param stripTrailingZeros 是否去除末尾多余的 0 (如 "1.2500" -> "1.25")
 */
export function formatFloor(
  val: string | number,
  decimals: number,
  stripTrailingZeros = false
): string {
  const d = toDec(val);
  const fixed = d.toFixed(decimals, Decimal.ROUND_DOWN);
  if (stripTrailingZeros && fixed.includes('.')) {
    return fixed.replace(/\.?0+$/, '');
  }
  return fixed;
}

/**
 * 2. 步长对齐（TickSize / LotSize 规则校验与自动修正）
 * 例如：某币种最小价格变动步长 tickSize = "0.5"，用户输入 "92450.7" -> 自动向下对齐为 "92450.5"
 */
export function alignToStep(val: string | number, stepSize: string | number): string {
  const dVal = toDec(val);
  const dStep = toDec(stepSize);
  if (dStep.lte(0)) return dVal.toString();

  // 公式：Math.floor(val / step) * step
  const steps = dVal.div(dStep).floor();
  const aligned = steps.mul(dStep);
  
  // 根据 stepSize 的小数位数格式化输出，避免科学计数法
  const stepDecimals = getDecimalPlaces(stepSize);
  return aligned.toFixed(stepDecimals, Decimal.ROUND_DOWN);
}

/**
 * 获取步长的小数位数（支持处理 "1e-8" 科学计数法）
 */
export function getDecimalPlaces(stepSize: string | number): number {
  const d = toDec(stepSize);
  return d.decimalPlaces();
}

/**
 * 3. 输入框合法性实时过滤器（绑定在 input 的 onChange 上）
 * 限制只能输入数字和一个小数点，且自动截断超出 maxDecimals 的小数位
 */
export function sanitizeNumericInput(rawInput: string, maxDecimals: number): string {
  // 1. 剔除所有非数字和非小数点字符
  let cleaned = rawInput.replace(/[^0-9.]/g, '');
  
  // 2. 只保留第一个小数点
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    cleaned = parts[0] + '.' + parts.slice(1).join('');
  }

  // 3. 限制小数点后最大位数
  if (parts.length === 2 && maxDecimals >= 0) {
    if (maxDecimals === 0) {
      cleaned = parts[0];
    } else if (parts[1].length > maxDecimals) {
      cleaned = `${parts[0]}.${parts[1].slice(0, maxDecimals)}`;
    }
  }
  return cleaned;
}

/**
 * 4. 现货下单联动计算器（价格 × 数量 = 成交额）
 */
export const SpotCalc = {
  // 计算成交总额 (USDT)
  calcTotal(price: string, amount: string, quoteDecimals = 2): string {
    const p = toDec(price);
    const a = toDec(amount);
    if (p.lte(0) || a.lte(0)) return '0';
    return p.mul(a).toFixed(quoteDecimals, Decimal.ROUND_DOWN);
  },

  // 根据可用余额与百分比 (0~100)，计算最大可买/可卖数量
  calcAmountByPercent(params: {
    side: 'buy' | 'sell';
    percent: number;          // 25, 50, 75, 100
    availableBalance: string; // 买入时为 USDT 余额，卖出时为 BTC 余额
    price: string;            // 委托价格
    lotSize: string;          // 数量最小步长，如 "0.0001"
    feeRate?: string;         // 预留手续费率（如 "0.001" 千分之一，防止全仓买入时因扣手续费导致余额不足）
  }): string {
    const { side, percent, availableBalance, price, lotSize, feeRate = '0.001' } = params;
    const balance = toDec(availableBalance);
    const pct = toDec(percent).div(100);

    if (balance.lte(0) || pct.lte(0)) return '0';

    if (side === 'buy') {
      const px = toDec(price);
      if (px.lte(0)) return '0';
      // 扣除预留手续费后的实际可用资金：balance / (1 + feeRate)
      const effectiveBalance = balance.div(new Decimal(1).plus(toDec(feeRate)));
      const rawAmount = effectiveBalance.mul(pct).div(px);
      return alignToStep(rawAmount.toString(), lotSize);
    } else {
      // 卖出时直接按可用币数乘以百分比
      const rawAmount = balance.mul(pct);
      return alignToStep(rawAmount.toString(), lotSize);
    }
  },
};

/**
 * 5. 合约交易风控预估计算器（起始保证金 + 预估强平价计算）
 */
export const FuturesCalc = {
  // 计算开仓所需起始保证金
  calcInitialMargin(price: string, amount: string, leverage: number, decimals = 2): string {
    const notionalValue = toDec(price).mul(toDec(amount));
    if (notionalValue.lte(0) || leverage <= 0) return '0.00';
    return notionalValue.div(leverage).toFixed(decimals, Decimal.ROUND_UP); // 保证金向上取整更安全
  },

  // 计算逐仓模式下的预估强平价格（简化版标准公式）
  // 做多强平价 = 开仓价 * (1 - 1/杠杆 + 维持保证金率)
  // 做空强平价 = 开仓价 * (1 + 1/杠杆 - 维持保证金率)
  calcEstLiquidationPrice(params: {
    side: 'long' | 'short';
    entryPrice: string;
    leverage: number;
    mmr?: string;       // 维持保证金率 (Maintenance Margin Rate)，默认 "0.005" (0.5%)
    tickSize: string;   // 价格步长，如 "0.1"
  }): string {
    const { side, entryPrice, leverage, mmr = '0.005', tickSize } = params;
    const entry = toDec(entryPrice);
    if (entry.lte(0) || leverage <= 0) return '--';

    const invLev = new Decimal(1).div(leverage);
    const maintRate = toDec(mmr);

    let liqPrice: Decimal;
    if (side === 'long') {
      liqPrice = entry.mul(new Decimal(1).minus(invLev).plus(maintRate));
    } else {
      liqPrice = entry.mul(new Decimal(1).plus(invLev).minus(maintRate));
    }

    if (liqPrice.lte(0)) return '0';
    return alignToStep(liqPrice.toString(), tickSize);
  }
}
