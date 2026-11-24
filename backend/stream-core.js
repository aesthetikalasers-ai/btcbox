'use strict';
/**
 * Server-Sent Events transport for live market streams.
 *
 * Why SSE and not WebSocket:
 *   - The deployment target is Vercel Functions, which cannot hold a WebSocket
 *     upgrade for the lifetime of a market session.
 *   - The data is strictly server -> client (order book snapshots, trades), so
 *     the duplex capability of WebSocket buys nothing.
 *   - SSE reconnects automatically via EventSource, and survives proxies that
 *     buffer WebSocket upgrades.
 *
 * Streaming contract:
 *   - `event: snapshot` is the first frame and can be as large as we like.
 *   - `event: update` frames follow on a fixed interval.
 *   - `event: error` carries a machine-readable `code` and keeps the connection
 *     open so the client can show a degraded state without spinning.
 *   - `: ping` comment frames keep intermediaries from closing an idle socket.
 *
 * Everything is fail-closed: if the upstream provider is unavailable we emit an
 * `error` frame and never synthesise book levels.
 */

/** Interval between order-book snapshots. 2s balances freshness against provider rate limits. */
const DEPTH_INTERVAL_MS = 2000;
/** Interval between aggressive-trade polls (Bybit only exposes recent trades). */
const TRADES_INTERVAL_MS = 3000;
/** Ping cadence so proxies do not treat the connection as idle. */
const PING_INTERVAL_MS = 15000;
/** Hard cap on stream lifetime; EventSource reconnects seamlessly afterwards. */
// Stay below the Vercel Function's 300s hard timeout so cleanup can close
// the response cleanly and EventSource can reconnect without a platform kill.
const MAX_STREAM_MS = 4 * 60 * 1000;
/**
 * Upstream request timeout. Must stay below the emit interval so a slow provider
 * cannot make requests overlap; the `inFlight` guard in the handler is a second
 * line of defence, not a licence to stack polls.
 */
const UPSTREAM_TIMEOUT_MS = 1800;

const SYMBOL_RE = /^[A-Z0-9]{5,20}$/;

function writeFrame(res, event, data) {
  if (res.writableEnded || res.destroyed) return false;
  try {
    if (event) res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    return true;
  } catch {
    return false;
  }
}

function writeComment(res, text) {
  if (res.writableEnded || res.destroyed) return;
  try { res.write(`: ${text}\n\n`); } catch { /* peer already gone */ }
}

async function fetchJson(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`upstream HTTP ${res.status}`);
  return res.json();
}

const normalizeLevels = (rows) => (Array.isArray(rows) ? rows : [])
  .filter((row) => Array.isArray(row) && row.length >= 2
    && Number.isFinite(Number(row[0])) && Number(row[0]) > 0
    && Number.isFinite(Number(row[1])) && Number(row[1]) > 0)
  .map((row) => [String(row[0]), String(row[1])]);

/**
 * Binance REST depth for a full pair symbol (e.g. `BTCUSDT`).
 *
 * Tried first: it is the provider that already answers `/api/depth` for this
 * deployment (`market-gateway`). Coinbase does not quote arbitrary `*-USDT`
 * products and Bybit's spot host is geo-restricted on some networks, so those
 * two providers alone left the depth stream permanently on
 * `DEPTH_DATA_UNAVAILABLE` while the polled endpoint right above it was live.
 */
async function readOrderBookFromBinance(symbol, limit = 20) {
  try {
    const payload = await fetchJson(
      `https://data-api.binance.vision/api/v3/depth?symbol=${encodeURIComponent(symbol)}&limit=${limit}`,
    );
    const bids = normalizeLevels(payload && payload.bids).sort((l, r) => Number(r[0]) - Number(l[0])).slice(0, 20);
    const asks = normalizeLevels(payload && payload.asks).sort((l, r) => Number(l[0]) - Number(r[0])).slice(0, 20);
    if (!bids.length || !asks.length) return null;
    return { source: 'binance-vision', bids, asks, providerTs: null };
  } catch {
    return null;
  }
}

/**
 * Reads the live order book using the same provider chain as GET /api/depth so
 * the stream and the polled endpoint can never disagree about where data comes
 * from.
 *
 * Returns `null` when no provider supplies a usable book — the caller emits an
 * error frame rather than fabricating levels.
 */
async function readOrderBook(symbol, base) {
  const binance = await readOrderBookFromBinance(symbol);
  if (binance) return binance;

  try {
    const book = await fetchJson(`https://api.exchange.coinbase.com/products/${encodeURIComponent(base + '-USDT')}/book?level=2`);
    const bids = normalizeLevels(book.bids).sort((l, r) => Number(r[0]) - Number(l[0])).slice(0, 20);
    const asks = normalizeLevels(book.asks).sort((l, r) => Number(l[0]) - Number(r[0])).slice(0, 20);
    if (bids.length && asks.length) {
      return { source: 'coinbase', bids, asks, providerTs: null };
    }
  } catch { /* fall through to the next provider */ }

  try {
    const payload = await fetchJson(`https://api.bybit.com/v5/market/orderbook?category=spot&symbol=${encodeURIComponent(symbol)}&limit=20`);
    const book = payload && payload.result;
    const bids = normalizeLevels(book && book.b).sort((l, r) => Number(r[0]) - Number(l[0])).slice(0, 20);
    const asks = normalizeLevels(book && book.a).sort((l, r) => Number(l[0]) - Number(r[0])).slice(0, 20);
    if (bids.length && asks.length) {
      const providerMs = Number(payload.time);
      return { source: 'bybit', bids, asks, providerTs: Number.isFinite(providerMs) && providerMs > 0 ? Math.floor(providerMs / 1000) : null };
    }
  } catch { /* unavailable */ }

  return null;
}

/** Recent aggressive trades. Only Bybit exposes this on a public endpoint. */
async function readTrades(symbol) {
  try {
    const payload = await fetchJson(`https://api.bybit.com/v5/market/recent-trade?category=spot&symbol=${encodeURIComponent(symbol)}&limit=30`);
    const rows = payload && payload.result && payload.result.list;
    if (!Array.isArray(rows)) return null;
    const trades = rows
      .filter((row) => row && Number.isFinite(Number(row.price)) && Number.isFinite(Number(row.size)))
      .map((row) => ({
        price: String(row.price),
        size: String(row.size),
        side: row.side === 'Buy' ? 'buy' : 'sell',
        ts: Number(row.time) || Date.now(),
      }));
    return trades.length ? trades : null;
  } catch {
    return null;
  }
}

/**
 * Recent trades for the depth stream's providers.
 *
 * Bybit is unreachable from some networks (its spot host is geo-restricted and
 * is not covered by the local gateway's provider order), which left the
 * terminal's "Recent trades" panel permanently degraded while the order book
 * right above it was live. Binance's public `aggTrades` endpoint is reachable
 * wherever the kline/depth providers already are, so it is used as a fallback.
 * The response shape is normalised to the same `{price, size, side, ts}` rows;
 * nothing is synthesised — an unavailable provider still returns `null`.
 */
async function readTradesFromBinance(symbol, limit = 30) {
  try {
    const payload = await fetchJson(
      `https://data-api.binance.vision/api/v3/aggTrades?symbol=${encodeURIComponent(symbol)}&limit=${limit}`,
    );
    if (!Array.isArray(payload)) return null;
    const trades = payload
      .filter((row) => row && Number.isFinite(Number(row.p)) && Number.isFinite(Number(row.q)))
      .map((row) => ({
        price: String(row.p),
        size: String(row.q),
        // `m` is true when the buyer was the maker, i.e. the aggressor sold.
        side: row.m === true ? 'sell' : 'buy',
        ts: Number(row.T) || Date.now(),
      }));
    return trades.length ? trades : null;
  } catch {
    return null;
  }
}

/**
 * Reads recent trades with provider fallback.
 *
 * Binance is tried first: it is the same host that already serves
 * `/api/kline` and `/api/depth` for this deployment, so it is reachable
 * wherever the order book is. Bybit is attempted only as a fallback — from
 * geo-restricted networks its host stalls until the upstream timeout, which
 * delayed the first frame of the stream by ~6 s.
 */
async function readRecentTrades(symbol) {
  const binance = await readTradesFromBinance(symbol);
  if (binance) return { trades: binance, source: 'binance-vision' };
  const bybit = await readTrades(symbol);
  if (bybit) return { trades: bybit, source: 'bybit' };
  return null;
}

module.exports = {
  DEPTH_INTERVAL_MS,
  TRADES_INTERVAL_MS,
  PING_INTERVAL_MS,
  MAX_STREAM_MS,
  UPSTREAM_TIMEOUT_MS,
  SYMBOL_RE,
  writeFrame,
  writeComment,
  normalizeLevels,
  readOrderBook,
  readTrades,
  readTradesFromBinance,
  readRecentTrades,
};
