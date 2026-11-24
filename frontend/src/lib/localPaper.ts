import { getDemoMarkets, getDemoPerpMarkets } from "./demoPreview";
import type {
  OrderRecord,
  PerpOrder,
  PerpOrderInput,
  PerpPosition,
  PerpTrade,
  SpotOrderInput,
  SpotOrderResult,
} from "./api";

/**
 * Local-only paper ledger for demo/preview mode.
 *
 * The production backend requires Supabase for every persistence and trading
 * path (see backend/api-core.js loadDB/saveDB and the FINANCIAL_* gates), so a
 * fully local checkout without Supabase credentials cannot place real orders.
 * To let developers exercise the trade screens end-to-end offline, this module
 * keeps a self-contained paper account in localStorage. It is ONLY reached from
 * the `DEMO_PREVIEW_ACTIVE` branches in api.ts, so it never runs in production.
 *
 * Kept on its own storage key so it never fights with the React paper-trading
 * context (`lib/trading.tsx`, key `btcbox-paper-trading`).
 */
const LEDGER_KEY = "btcbox-demo-paper-v1";
const INITIAL_USDT = 100000;

interface PaperSpotOrder {
  order_id: string;
  symbol: string;
  base: string;
  side: "buy" | "sell";
  type: "limit";
  price: number;
  quantity: number;
  status: string;
  created_at: string;
}

interface PaperPerpPosition {
  position_id: string;
  symbol: string;
  side: "long" | "short";
  quantity: number;
  entry_price: number;
  leverage: number;
  isolated_margin: number;
  created_at: string;
}

interface PaperPerpOrder {
  order_id: string;
  symbol: string;
  type: "market" | "limit";
  side: "buy" | "sell";
  price: number;
  quantity: number;
  status: string;
  leverage: number;
  reduce_only: boolean;
  close_position: boolean;
  created_at: string;
}

interface DemoLedger {
  balances: Record<string, { free: number; frozen: number }>;
  spotOrders: PaperSpotOrder[];
  perpPositions: PaperPerpPosition[];
  perpOrders: PaperPerpOrder[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 100000)}`;
}

function readLedger(): DemoLedger {
  try {
    const raw = window.localStorage.getItem(LEDGER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DemoLedger> | null;
      if (parsed && typeof parsed === "object") {
        return {
          balances: parsed.balances && typeof parsed.balances === "object" ? parsed.balances : { USDT: { free: INITIAL_USDT, frozen: 0 } },
          spotOrders: Array.isArray(parsed.spotOrders) ? parsed.spotOrders : [],
          perpPositions: Array.isArray(parsed.perpPositions) ? parsed.perpPositions : [],
          perpOrders: Array.isArray(parsed.perpOrders) ? parsed.perpOrders : [],
        };
      }
    }
  } catch {
    /* storage unavailable — fall through to a fresh in-memory ledger */
  }
  return {
    balances: { USDT: { free: INITIAL_USDT, frozen: 0 } },
    spotOrders: [],
    perpPositions: [],
    perpOrders: [],
  };
}

function writeLedger(ledger: DemoLedger): void {
  try {
    window.localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger));
  } catch {
    /* storage unavailable — state stays in memory for this session only */
  }
}

/** Resolve a best-effort market price for a symbol like "BTCUSDT". */
function demoPriceFor(symbol: string): number {
  const base = symbol.toUpperCase().replace(/USDT$/, "");
  try {
    const perp = getDemoPerpMarkets().find((m) => m.symbol.toUpperCase() === symbol.toUpperCase());
    const perpPrice = perp ? Number(perp.mark_price ?? perp.index_price ?? NaN) : NaN;
    if (Number.isFinite(perpPrice) && perpPrice > 0) return perpPrice;
    const spot = getDemoMarkets().find((m) => m.sym.toUpperCase() === base);
    const spotPrice = spot ? Number(spot.price) : NaN;
    if (Number.isFinite(spotPrice) && spotPrice > 0) return spotPrice;
  } catch {
    /* ignore */
  }
  return 0;
}

export function demoLedgerSpotOrders(): OrderRecord[] {
  const ledger = readLedger();
  return ledger.spotOrders.map((o) => ({
    order_id: o.order_id,
    id: o.order_id,
    symbol: o.symbol,
    side: o.side,
    type: o.type,
    price: o.price,
    quantity: o.quantity,
    remaining_quantity: o.status === "filled" ? 0 : o.quantity,
    status: o.status,
    created_at: o.created_at,
  }));
}

export function demoLedgerPerpPositions(): PerpPosition[] {
  const ledger = readLedger();
  return ledger.perpPositions.map((p) => ({
    position_id: p.position_id,
    symbol: p.symbol,
    side: p.side,
    quantity: p.quantity,
    entry_price: p.entry_price,
    mark_price: p.entry_price,
    liquidation_price: null,
    isolated_margin: p.isolated_margin,
    leverage: p.leverage,
    unrealized_pnl: 0,
    realized_pnl: 0,
    created_at: p.created_at,
  }));
}

export function demoLedgerPerpOpenOrders(): PerpOrder[] {
  const ledger = readLedger();
  return ledger.perpOrders
    .filter((o) => o.status === "new" || o.status === "partially_filled")
    .map((o) => ({
      order_id: o.order_id,
      symbol: o.symbol,
      type: o.type,
      side: o.side,
      price: o.price,
      quantity: o.quantity,
      filled_quantity: 0,
      status: o.status,
      leverage: o.leverage,
      reduce_only: o.reduce_only,
      close_position: o.close_position,
      created_at: o.created_at,
    }));
}

export function demoLedgerPerpOrderHistory(): PerpOrder[] {
  const ledger = readLedger();
  return ledger.perpOrders.map((o) => ({
    order_id: o.order_id,
    symbol: o.symbol,
    type: o.type,
    side: o.side,
    price: o.price,
    quantity: o.quantity,
    filled_quantity: o.status === "filled" ? o.quantity : 0,
    status: o.status,
    leverage: o.leverage,
    reduce_only: o.reduce_only,
    close_position: o.close_position,
    created_at: o.created_at,
  }));
}

export function demoLedgerPerpTrades(): PerpTrade[] {
  const ledger = readLedger();
  return ledger.perpOrders
    .filter((o) => o.status === "filled")
    .map((o) => ({
      trade_id: o.order_id,
      symbol: o.symbol,
      side: o.side,
      price: o.price,
      quantity: o.quantity,
      fee: 0,
      role: "taker" as const,
      created_at: o.created_at,
    }));
}

export function demoPlaceSpotOrder(input: SpotOrderInput): SpotOrderResult {
  const ledger = readLedger();
  const price = Number(input.price);
  const quantity = Number(input.qty);
  const base = input.symbol.toUpperCase().replace(/USDT$/, "");
  const usdt = ledger.balances.USDT ?? { free: INITIAL_USDT, frozen: 0 };
  if (input.side === "buy") {
    const cost = price * quantity;
    if (!Number.isFinite(cost) || cost <= 0) throw new Error("Enter a valid limit price and quantity.");
    if (cost > usdt.free) throw new Error("Insufficient available USDT balance.");
    ledger.balances.USDT = { ...usdt, free: usdt.free - cost };
    const holding = ledger.balances[base] ?? { free: 0, frozen: 0 };
    ledger.balances[base] = { ...holding, free: holding.free + quantity };
  } else {
    const holding = ledger.balances[base] ?? { free: 0, frozen: 0 };
    if (quantity > holding.free) throw new Error(`Insufficient available ${base} balance.`);
    ledger.balances[base] = { ...holding, free: holding.free - quantity };
    ledger.balances.USDT = { ...usdt, free: usdt.free + price * quantity };
  }
  const order: PaperSpotOrder = {
    order_id: makeId("P"),
    symbol: input.symbol.toUpperCase(),
    base,
    side: input.side,
    type: "limit",
    price,
    quantity,
    status: "filled",
    created_at: nowIso(),
  };
  ledger.spotOrders = [order, ...ledger.spotOrders].slice(0, 200);
  writeLedger(ledger);
  return {
    order_id: order.order_id,
    status: order.status,
    price: order.price,
    quantity: order.quantity,
    remaining_quantity: 0,
    duplicate: false,
  };
}

export function demoPlacePerpOrder(input: PerpOrderInput): { order_id: string; status: string; duplicate?: boolean } {
  const ledger = readLedger();
  const quantity = Number(input.quantity);
  const leverage = Number(input.leverage) || 1;
  const entryPrice = input.type === "limit" && input.price ? Number(input.price) : demoPriceFor(input.symbol);
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Enter a valid quantity.");
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) throw new Error("A valid market price is required.");

  const side: "long" | "short" = input.side === "buy" ? "long" : "short";
  const order: PaperPerpOrder = {
    order_id: makeId("PO"),
    symbol: input.symbol.toUpperCase(),
    type: input.type,
    side: input.side,
    price: entryPrice,
    quantity,
    status: "filled",
    leverage,
    reduce_only: input.reduceOnly === true,
    close_position: input.closePosition === true,
    created_at: nowIso(),
  };

  if (input.closePosition === true || input.reduceOnly === true) {
    // Close/reduce: drop any open position for this symbol on the opposite side.
    ledger.perpPositions = ledger.perpPositions.filter(
      (p) => !(p.symbol === input.symbol.toUpperCase() && p.side !== side),
    );
  } else {
    const margin = (quantity * entryPrice) / leverage;
    ledger.perpPositions = [
      {
        position_id: makeId("FP"),
        symbol: input.symbol.toUpperCase(),
        side,
        quantity,
        entry_price: entryPrice,
        leverage,
        isolated_margin: margin,
        created_at: nowIso(),
      },
      ...ledger.perpPositions,
    ];
  }

  ledger.perpOrders = [order, ...ledger.perpOrders].slice(0, 200);
  writeLedger(ledger);
  return { order_id: order.order_id, status: "filled", duplicate: false };
}

export function demoCancelPerpOrder(orderId: string): { order_id: string; status: string; duplicate?: boolean } {
  const ledger = readLedger();
  const order = ledger.perpOrders.find((o) => o.order_id === orderId);
  if (order && (order.status === "new" || order.status === "partially_filled")) order.status = "canceled";
  writeLedger(ledger);
  return { order_id: orderId, status: "canceled", duplicate: false };
}

export function demoClosePerpPosition(symbol: string): { order_id: string; status: string; duplicate?: boolean } {
  const ledger = readLedger();
  ledger.perpPositions = ledger.perpPositions.filter((p) => p.symbol !== symbol.toUpperCase());
  writeLedger(ledger);
  return { order_id: makeId("PC"), status: "filled", duplicate: false };
}


