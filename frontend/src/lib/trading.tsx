import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "./auth";
import { DEMO_PREVIEW_ACTIVE } from "./demoPreview";

/** 纸面交易账户存储在 localStorage 中的结构。 */
export interface PaperLedger {
  balances: Record<string, { free: number; frozen: number }>;
  orders: PaperOrder[];
  secondsTrades: PaperSecondsTrade[];
  withdrawals: PaperWithdrawal[];
  perpPositions: PaperPerpPosition[];
  walletHistory: PaperWalletHistory[];
}

export interface PaperWithdrawal {
  id: string;
  coin: string;
  network: string;
  address: string;
  amount: number;
  fee: number;
  net: number;
  status: string;
  created_at: string;
}

export interface PaperPerpPosition {
  id: string;
  symbol: string;
  base: string;
  side: "long" | "short";
  leverage: number;
  margin: number;
  entry_price: number;
  quantity: number;
  margin_mode: "cross" | "isolated";
  opened_at: string;
}


export interface PaperOrder {
  order_id: string;
  symbol: string;
  base: string;
  side: "buy" | "sell";
  type: "market" | "limit";
  price: number;
  quantity: number;
  total: number;
  status: string;
  created_at: string;
}

export interface PaperSecondsTrade {
  id: string;
  symbol: string;
  direction: "up" | "down";
  duration_sec: number;
  amount: number;
  entry_price: number;
  settle_price?: number;
  payout?: number;
  status: "open" | "won" | "lost" | "tie";
  ends_at: number;
  created_at: string;
}

export interface PaperWalletHistory {
  id: string;
  type: "充值" | "提现";
  coin: string;
  network?: string;
  address?: string;
  amount: number;
  fee?: number;
  status: string;
  created_at: string;
}

const STORAGE_KEY = "btcbox-paper-trading";
const DEMO_INITIAL_USDT = 10000;
const PAPER_TRADING_ENABLED = import.meta.env.DEV && DEMO_PREVIEW_ACTIVE;

/** 生成一个可读的订单号。 */
function makeOrderId(): string {
  return `P${Date.now()}${Math.floor(Math.random() * 10000)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function emptyLedger(): PaperLedger {
  return { balances: {}, orders: [], secondsTrades: [], withdrawals: [], perpPositions: [], walletHistory: [] };
}

function loadLedger(): PaperLedger {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PaperLedger>;
      if (parsed && typeof parsed === "object") {
        return {
          balances: parsed.balances ?? {},
          orders: Array.isArray(parsed.orders) ? parsed.orders : [],
          secondsTrades: Array.isArray(parsed.secondsTrades) ? parsed.secondsTrades : [],
          withdrawals: Array.isArray(parsed.withdrawals) ? parsed.withdrawals : [],
          perpPositions: Array.isArray(parsed.perpPositions) ? parsed.perpPositions : [],
          walletHistory: Array.isArray(parsed.walletHistory) ? parsed.walletHistory : [],
        };
      }
    }
  } catch {
    /* 存储不可用时回退到内存态 */
  }
  return emptyLedger();
}

function saveLedger(ledger: PaperLedger): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ledger));
  } catch {
    /* 存储不可用时仅保留内存态 */
  }
}

function initialLedger(): PaperLedger {
  return {
    balances: { USDT: { free: DEMO_INITIAL_USDT, frozen: 0 } },
    orders: [],
    secondsTrades: [],
    withdrawals: [],
    perpPositions: [],
    walletHistory: [],
  };
}
export interface PlaceSpotInput {
  symbol: string;
  base: string;
  side: "buy" | "sell";
  type: "market" | "limit";
  price: number;
  quantity: number;
}

export interface PlaceSecondsInput {
  symbol: string;
  direction: "up" | "down";
  duration_sec: number;
  amount: number;
  entry_price: number;
  yield_rate: number;
}

export interface TradingContextValue {
  initialized: boolean;
  balances: Record<string, { free: number; frozen: number }>;
  orders: PaperOrder[];
  secondsTrades: PaperSecondsTrade[];
  withdrawals: PaperWithdrawal[];
  perpPositions: PaperPerpPosition[];
  walletHistory: PaperWalletHistory[];
  openSecondsTrade: PaperSecondsTrade | null;
  lastSettleResult: { id: string; outcome: "won" | "lost" | "tie"; payout: number; amount: number } | null;
  initializeDemoWallet: () => void;
  resetDemo: () => void;
  placeSpotOrder: (input: PlaceSpotInput) => { ok: boolean; reason?: string; order?: PaperOrder };
  placeSecondsOrder: (input: PlaceSecondsInput) => { ok: boolean; reason?: string; trade?: PaperSecondsTrade };
  settleSecondsTrade: (id: string, settlePrice: number) => void;
  dismissSettleResult: () => void;
  deposit: (coin: string, amount: number) => void;
  withdraw: (coin: string, network: string, address: string, amount: number, fee: number) => { ok: boolean; reason?: string };
  openPerpPosition: (input: { symbol: string; base: string; side: "long" | "short"; leverage: number; margin: number; entry_price: number; quantity: number; margin_mode: "cross" | "isolated" }) => { ok: boolean; reason?: string; position?: PaperPerpPosition };
  closePaperPosition: (id: string, exitPrice: number) => void;
}

const TradingContext = createContext<TradingContextValue | null>(null);

export function TradingProvider({ children }: { children: ReactNode }) {
  const [ledger, setLedger] = useState<PaperLedger>(() => PAPER_TRADING_ENABLED ? loadLedger() : emptyLedger());
  const [lastSettleResult, setLastSettleResult] = useState<TradingContextValue["lastSettleResult"]>(null);

  const ledgerRef = useRef(ledger);
  useEffect(() => { ledgerRef.current = ledger; }, [ledger]);

  const commit = useCallback((next: PaperLedger) => {
    ledgerRef.current = next;
    saveLedger(next);
    setLedger(next);
  }, []);

  const initializeDemoWallet = useCallback(() => {
    if (!PAPER_TRADING_ENABLED) return;
    const current = ledgerRef.current;
    if (Object.keys(current.balances).length === 0) {
      commit(initialLedger());
    }
  }, [commit]);

  const resetDemo = useCallback(() => {
    if (!PAPER_TRADING_ENABLED) return;
    commit(initialLedger());
    setLastSettleResult(null);
  }, [commit]);

  const placeSpotOrder = useCallback((input: PlaceSpotInput) => {
    if (!PAPER_TRADING_ENABLED) return { ok: false as const, reason: "Local paper trading is disabled outside development." };
    const current = ledgerRef.current;
    const balances = { ...current.balances };
    const total = input.price * input.quantity;
    if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(input.quantity) || input.quantity <= 0) {
      return { ok: false as const, reason: "请输入有效的价格与数量" };
    }

    if (input.side === "buy") {
      const usdt = balances.USDT?.free ?? 0;
      if (usdt < total) return { ok: false as const, reason: "可用 USDT 余额不足" };
      balances.USDT = { ...(balances.USDT ?? { frozen: 0 }), free: usdt - total };
      const baseFree = balances[input.base]?.free ?? 0;
      balances[input.base] = { ...(balances[input.base] ?? { frozen: 0 }), free: baseFree + input.quantity };
    } else {
      const baseFree = balances[input.base]?.free ?? 0;
      if (baseFree < input.quantity) return { ok: false as const, reason: `可用 ${input.base} 余额不足` };
      balances[input.base] = { ...(balances[input.base] ?? { frozen: 0 }), free: baseFree - input.quantity };
      const usdt = balances.USDT?.free ?? 0;
      balances.USDT = { ...(balances.USDT ?? { frozen: 0 }), free: usdt + total };
    }

    const order: PaperOrder = {
      order_id: makeOrderId(),
      symbol: input.symbol,
      base: input.base,
      side: input.side,
      type: input.type,
      price: input.price,
      quantity: input.quantity,
      total,
      status: "filled",
      created_at: nowIso(),
    };

    commit({ ...current, balances, orders: [order, ...current.orders].slice(0, 200) });
    return { ok: true as const, order };
  }, [commit]);

  const placeSecondsOrder = useCallback((input: PlaceSecondsInput) => {
    if (!PAPER_TRADING_ENABLED) return { ok: false as const, reason: "Local paper trading is disabled outside development." };
    const current = ledgerRef.current;
    const balances = { ...current.balances };
    const usdt = balances.USDT?.free ?? 0;
    if (input.amount <= 0 || !Number.isFinite(input.amount)) {
      return { ok: false as const, reason: "请输入有效的投资金额" };
    }
    if (usdt < input.amount) return { ok: false as const, reason: "可用 USDT 余额不足" };

    balances.USDT = { ...(balances.USDT ?? { frozen: 0 }), free: usdt - input.amount };
    const trade: PaperSecondsTrade = {
      id: `S${Date.now()}${Math.floor(Math.random() * 10000)}`,
      symbol: input.symbol,
      direction: input.direction,
      duration_sec: input.duration_sec,
      amount: input.amount,
      entry_price: input.entry_price,
      status: "open",
      ends_at: Date.now() + input.duration_sec * 1000,
      created_at: nowIso(),
    };

    commit({ ...current, balances, secondsTrades: [trade, ...current.secondsTrades].slice(0, 200) });
    return { ok: true as const, trade };
  }, [commit]);

  const settleSecondsTrade = useCallback((id: string, settlePrice: number) => {
    if (!PAPER_TRADING_ENABLED) return;
    const current = ledgerRef.current;
    const trade = current.secondsTrades.find((t) => t.id === id);
    if (!trade || trade.status !== "open") return;

    const movedUp = settlePrice > trade.entry_price;
    const movedDown = settlePrice < trade.entry_price;
    let outcome: "won" | "lost" | "tie" = "tie";
    if (movedUp && trade.direction === "up") outcome = "won";
    else if (movedDown && trade.direction === "down") outcome = "won";
    else if (movedUp || movedDown) outcome = "lost";

    const payout = outcome === "won" ? trade.amount * 2 : outcome === "tie" ? trade.amount : 0;

    const balances = { ...current.balances };
    const usdtFree = balances.USDT?.free ?? 0;
    balances.USDT = { ...(balances.USDT ?? { frozen: 0 }), free: usdtFree + payout };

    const updated = {
      ...current,
      balances,
      secondsTrades: current.secondsTrades.map((t) =>
        t.id === id ? { ...t, status: outcome, settle_price: settlePrice, payout } : t,
      ),
    };
    commit(updated);
    setLastSettleResult({ id, outcome, payout, amount: trade.amount });
  }, [commit]);

  const dismissSettleResult = useCallback(() => setLastSettleResult(null), []);

  const deposit = useCallback((coin: string, amount: number, network: string = "") => {
    if (!PAPER_TRADING_ENABLED) return;
    const current = ledgerRef.current;
    if (!Number.isFinite(amount) || amount <= 0) return;
    const balances = { ...current.balances };
    const free = balances[coin]?.free ?? 0;
    balances[coin] = { ...(balances[coin] ?? { frozen: 0 }), free: free + amount };
    // 记录充值历史
    const history: PaperWalletHistory = {
      id: `D${Date.now()}${Math.floor(Math.random() * 10000)}`,
      type: "充值",
      coin,
      network,
      amount,
      status: "已完成",
      created_at: nowIso(),
    };
    const next = { ...current, balances, walletHistory: [...current.walletHistory, history] };
    commit(next);
  }, [commit, nowIso]);

  const withdraw = useCallback((coin: string, network: string, address: string, amount: number, fee: number) => {
    if (!PAPER_TRADING_ENABLED) return { ok: false as const, reason: "Local paper trading is disabled outside development." };
    const current = ledgerRef.current;
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false as const, reason: "Enter a valid withdrawal amount" };
    const free = current.balances[coin]?.free ?? 0;
    if (free < amount) return { ok: false as const, reason: "Insufficient available balance" };
    const balances = { ...current.balances };
    balances[coin] = { ...(balances[coin] ?? { frozen: 0 }), free: free - amount };
    // 记录提现历史
    const history: PaperWalletHistory = {
      id: `W${Date.now()}${Math.floor(Math.random() * 10000)}`,
      type: "提现",
      coin,
      network,
      address,
      amount,
      fee,
      status: "已完成",
      created_at: nowIso(),
    };
    const next = {
      ...current,
      balances,
      withdrawals: [...current.withdrawals, { ...history, net: amount - fee } as PaperWithdrawal],
      walletHistory: [...current.walletHistory, history],
    };
    commit(next);
    return { ok: true as const };
  }, [commit, nowIso]);
  const openPerpPosition = useCallback((input: { symbol: string; base: string; side: "long" | "short"; leverage: number; margin: number; entry_price: number; quantity: number; margin_mode: "cross" | "isolated" }) => {
    if (!PAPER_TRADING_ENABLED) return { ok: false as const, reason: "Local paper trading is disabled outside development." };
    const current = ledgerRef.current;
    if (!Number.isFinite(input.margin) || input.margin <= 0) return { ok: false as const, reason: "请输入有效的保证金" };
    const usdtFree = current.balances.USDT?.free ?? 0;
    if (usdtFree < input.margin) return { ok: false as const, reason: "可用 USDT 余额不足" };
    const balances = { ...current.balances };
    balances.USDT = { ...(balances.USDT ?? { frozen: 0 }), free: usdtFree - input.margin };
    const position: PaperPerpPosition = {
      id: `F${Date.now()}${Math.floor(Math.random() * 10000)}`,
      symbol: input.symbol,
      base: input.base,
      side: input.side,
      leverage: input.leverage,
      margin: input.margin,
      entry_price: input.entry_price,
      quantity: input.quantity,
      margin_mode: input.margin_mode,
      opened_at: nowIso(),
    };
    commit({ ...current, balances, perpPositions: [position, ...current.perpPositions] });
    return { ok: true as const, position };
  }, [commit]);

  const closePaperPosition = useCallback((id: string, exitPrice: number) => {
    if (!PAPER_TRADING_ENABLED) return;
    const current = ledgerRef.current;
    const position = current.perpPositions.find((p) => p.id === id);
    if (!position) return;
    const size = position.quantity * position.entry_price;
    const pnl = position.side === "long"
      ? (exitPrice - position.entry_price) / position.entry_price * size
      : (position.entry_price - exitPrice) / position.entry_price * size;
    const balances = { ...current.balances };
    const usdtFree = balances.USDT?.free ?? 0;
    balances.USDT = { ...(balances.USDT ?? { frozen: 0 }), free: usdtFree + position.margin + pnl };
    commit({ ...current, balances, perpPositions: current.perpPositions.filter((p) => p.id !== id) });
  }, [commit]);

  const openSecondsTrade = useMemo(() => {
    return ledger.secondsTrades.find((t) => t.status === "open") ?? null;
  }, [ledger.secondsTrades]);

  const value = useMemo<TradingContextValue>(() => ({
    initialized: Object.keys(ledger.balances).length > 0,
    balances: ledger.balances,
    orders: ledger.orders,
    secondsTrades: ledger.secondsTrades,
    withdrawals: ledger.withdrawals,
    perpPositions: ledger.perpPositions,
    walletHistory: ledger.walletHistory,
    openSecondsTrade,
    lastSettleResult,
    initializeDemoWallet,
    resetDemo,
    placeSpotOrder,
    placeSecondsOrder,
    settleSecondsTrade,
    dismissSettleResult,
    deposit,
    withdraw,
    openPerpPosition,
    closePaperPosition,
  }), [ledger, openSecondsTrade, lastSettleResult, initializeDemoWallet, resetDemo, placeSpotOrder, placeSecondsOrder, settleSecondsTrade, dismissSettleResult, deposit, withdraw, openPerpPosition, closePaperPosition]);

  return <TradingContext.Provider value={value}>{children}</TradingContext.Provider>;
}

export function useTrading(): TradingContextValue {
  const ctx = useContext(TradingContext);
  if (!ctx) throw new Error("useTrading must be used within TradingProvider");
  return ctx;
}

/**
 * 监听登录状态，登录/注册后自动初始化 10,000 USDT 演示钱包。
 * 需要挂载在 AuthProvider 内部。
 */
export function TradingInitializer() {
  const { status } = useAuth();
  const { initializeDemoWallet } = useTrading();
  useEffect(() => {
    if (PAPER_TRADING_ENABLED && status === "authenticated") initializeDemoWallet();
  }, [status, initializeDemoWallet]);
  return null;
}

