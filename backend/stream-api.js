'use strict';
/**
 * `/api/stream/:channel` — Server-Sent Events endpoints.
 *
 * Channels:
 *   depth    order book snapshots (bids/asks, 20 levels)
 *   trades   recent aggressive trades
 *
 * Deliberately mounted OUTSIDE the buffered `api-adapter.js` path: that adapter
 * awaits the whole handler result before calling `res.end()`, which is
 * incompatible with streaming. Vercel rewrites `/api/stream/*` to this function
 * and forwards the captured channel as a query parameter.
 *
 * Security posture:
 *   - Public market data only. No account data, no balances, no order status.
 *   - Symbol is validated with the same regex as GET /api/depth.
 *   - Connections are hard-capped in lifetime and cleaned up on close.
 */
const {
  DEPTH_INTERVAL_MS,
  TRADES_INTERVAL_MS,
  PING_INTERVAL_MS,
  MAX_STREAM_MS,
  SYMBOL_RE,
  writeFrame,
  writeComment,
  readOrderBook,
  readTrades,
  readRecentTrades,
} = require('./stream-core.js');

// Fail-closed default: production origins must be supplied via CORS_ALLOWED_ORIGINS.
const ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);

function resolveCorsOrigin(req) {
  const origin = (req.headers && (req.headers.origin || req.headers.Origin)) || '';
  if (!origin) return null;
  const allowed = new Set(ALLOWED_ORIGINS);
  if (process.env.CONTEXT === 'dev') {
    ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:4175'].forEach((o) => allowed.add(o));
  }
  return allowed.has(origin) ? origin : null;
}

function resolveChannel(url) {
  return String(url.searchParams.get('channel') || url.pathname.split('/').filter(Boolean).pop() || '').toLowerCase();
}

module.exports = async function streamHandler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, code: 'METHOD_NOT_ALLOWED', msg: 'Use GET for an event stream.' }));
    return;
  }

  const url = new URL(req.url || '/', 'https://vercel.invalid');
  const channel = resolveChannel(url);
  if (channel !== 'depth' && channel !== 'trades') {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, code: 'UNKNOWN_STREAM', msg: 'Unknown stream channel.' }));
    return;
  }

  const rawSymbol = String(url.searchParams.get('symbol') || 'BTCUSDT').toUpperCase();
  if (!SYMBOL_RE.test(rawSymbol) || !rawSymbol.endsWith('USDT') || rawSymbol.length <= 4) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, code: 'INVALID_SYMBOL', msg: 'Invalid USDT symbol.' }));
    return;
  }
  const base = rawSymbol.slice(0, -4);

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  // `no-transform` + `X-Accel-Buffering` stop proxies from coalescing frames.
  res.setHeader('X-Accel-Buffering', 'no');
  const corsOrigin = resolveCorsOrigin(req);
  if (corsOrigin) {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Vary', 'Origin');
  }
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  writeComment(res, 'stream open');
  writeFrame(res, 'hello', { channel, symbol: rawSymbol, intervalMs: channel === 'depth' ? DEPTH_INTERVAL_MS : TRADES_INTERVAL_MS });

  let closed = false;
  let timer = null;
  let pingTimer = null;
  let deadline = null;
  // Guards against overlapping upstream polls when a provider is slow: without
  // this a 4s timeout on a 2s interval would stack requests indefinitely.
  let inFlight = false;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (timer) clearInterval(timer);
    if (pingTimer) clearInterval(pingTimer);
    if (deadline) clearTimeout(deadline);
    try { res.end(); } catch { /* already closed */ }
  };

  const emit = async () => {
    if (closed || inFlight) return;
    inFlight = true;
    try {
      if (channel === 'depth') {
        const book = await readOrderBook(rawSymbol, base);
        if (closed) return;
        if (!book) {
          writeFrame(res, 'stream-error', { code: 'DEPTH_DATA_UNAVAILABLE', msg: 'Order book data unavailable.' });
        } else {
          writeFrame(res, 'update', {
            ok: true,
            source: book.source,
            snapshotTs: Math.floor(Date.now() / 1000),
            providerTs: book.providerTs,
            bids: book.bids,
            asks: book.asks,
          });
        }
      } else {
        const recent = await readRecentTrades(rawSymbol);
        if (closed) return;
        if (!recent) {
          writeFrame(res, 'stream-error', { code: 'TRADES_DATA_UNAVAILABLE', msg: 'Recent trades unavailable.' });
        } else {
          writeFrame(res, 'update', { ok: true, source: recent.source, trades: recent.trades });
        }
      }
    } finally {
      inFlight = false;
    }
  };

  // First frame is emitted immediately so the UI never sits on an empty panel.
  await emit();
  if (closed) return;

  timer = setInterval(() => { void emit(); }, channel === 'depth' ? DEPTH_INTERVAL_MS : TRADES_INTERVAL_MS);
  pingTimer = setInterval(() => writeComment(res, 'ping'), PING_INTERVAL_MS);
  deadline = setTimeout(() => {
    writeFrame(res, 'bye', { reason: 'max_lifetime' });
    cleanup();
  }, MAX_STREAM_MS);

  // IncomingMessage "close" can fire as soon as the GET request itself has
  // been fully read; that is not the lifetime of the SSE response. Closing the
  // stream from req.close can therefore terminate a healthy subscription before
  // its first update. Track the response/socket lifecycle instead.
  req.on('error', cleanup);
  res.on('close', cleanup);
  res.on('error', cleanup);
};
module.exports.resolveChannel = resolveChannel;
