'use strict';
/**
 * Minimal local market API server.
 *
 * Serves exactly the three public-market routes the frontend calls, with the
 * same normalised JSON the Vercel functions return. Used for local development
 * so the UI can run against real public market data instead of the demo fixture.
 *
 * Run:  node backend/market-server.js [port]
 */
const http = require('node:http');
const { getMarket, getKlines, getDepth, getUsdtUsd } = require('./market-gateway');
const {
  DEPTH_INTERVAL_MS,
  TRADES_INTERVAL_MS,
  PING_INTERVAL_MS,
  MAX_STREAM_MS,
  SYMBOL_RE,
  writeFrame,
  writeComment,
  readOrderBook,
  readRecentTrades,
} = require('./stream-core');

const PORT = Number(process.argv[2] || process.env.MARKET_API_PORT || 8080);

/**
 * Browser origins allowed to call this dev server.
 *
 * Vite silently picks the next free port when the requested one is taken
 * (`Port 4173 is in use, trying another one...`), so a hard-coded port list
 * breaks with an opaque `blocked by CORS policy` error on every endpoint —
 * which surfaces in the UI as an empty chart and an empty order book.
 * Any loopback origin is therefore accepted; a dev-only server that already
 * listens on 127.0.0.1 adds no exposure by allowing other loopback ports.
 */
const LOOPBACK_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/** Extra explicit origins (kept for proxied setups that are not loopback). */
const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
]);

function resolveOrigin(req) {
  const origin = req.headers.origin || '';
  if (!origin) return null;
  if (LOOPBACK_ORIGIN_RE.test(origin)) return origin;
  return ALLOWED_ORIGINS.has(origin) ? origin : null;
}

function send(res, statusCode, payload, origin) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
    // The frontend calls with `credentials: "include"`, so a credentialed CORS
    // response must echo the concrete origin and allow credentials explicitly.
    ...(origin
      ? {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Credentials': 'true',
          Vary: 'Origin',
        }
      : {}),
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const origin = resolveOrigin(req);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      ...(origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Accept, Content-Type',
      ...(origin ? { 'Access-Control-Allow-Credentials': 'true' } : {}),
    });
    return res.end();
  }

  let url;
  try {
    url = new URL(req.url, 'http://localhost');
  } catch {
    return send(res, 400, { ok: false, msg: 'Bad request.' }, origin);
  }

  const q = url.searchParams;

  try {
    if (url.pathname === '/api/market') {
      const symbols = q.get('symbols');
      const payload = await getMarket(symbols ? { symbols: symbols.split(',') } : {});
      return send(res, payload.ok ? 200 : 503, payload, origin);
    }

    // Spot catalogue. Derived from the live market snapshot so the trade page
    // gets a real, currently-tradable pair list instead of a 404. Only pairs the
    // provider actually quotes are listed; nothing is invented.
    if (url.pathname === '/api/market/pairs') {
      const snapshot = await getMarket();
      if (!snapshot.ok) {
        return send(res, 503, { ok: false, msg: snapshot.msg, code: snapshot.code }, origin);
      }
      const markets = snapshot.markets.map((row) => ({
        base_asset: row.sym,
        quote_asset: 'USDT',
        enabled: true,
        price_tick: '0.01',
        quantity_step: '0.00000001',
        min_quantity: '0.00000001',
        min_notional: '1',
        min_limit_price: null,
        max_limit_price: null,
      }));
      return send(res, 200, { ok: true, markets, source: snapshot.source }, origin);
    }

    if (url.pathname === '/api/kline') {
      const payload = await getKlines({
        symbol: q.get('symbol') || 'BTCUSDT',
        interval: q.get('interval') || '1h',
        limit: Number(q.get('limit') || 300),
      });
      return send(res, payload.ok ? 200 : 503, payload, origin);
    }

    if (url.pathname === '/api/depth') {
      const payload = await getDepth({
        symbol: q.get('symbol') || 'BTCUSDT',
        limit: Number(q.get('limit') || 100),
      });
      return send(res, payload.ok ? 200 : 503, payload, origin);
    }

    if (url.pathname === '/api/fx/usdt-usd') {
      const payload = await getUsdtUsd();
      return send(res, 200, payload, origin);
    }

    if (url.pathname === '/api/healthz' || url.pathname === '/healthz') {
      return send(res, 200, { ok: true, service: 'btcbox-market-gateway' }, origin);
    }

    // Live SSE channels. Mounted here so a local dev server needs one process:
    // without them the terminal's `EventSource` connections fail and the order
    // book / recent trades fall back to polling (or stay empty).
    if (url.pathname.startsWith('/api/stream/')) {
      const channel = url.pathname.split('/').filter(Boolean).pop().toLowerCase();
      if (channel !== 'depth' && channel !== 'trades') {
        return send(res, 404, { ok: false, code: 'UNKNOWN_STREAM', msg: 'Unknown stream channel.' }, origin);
      }
      const rawSymbol = String(q.get('symbol') || 'BTCUSDT').toUpperCase();
      if (!SYMBOL_RE.test(rawSymbol) || !rawSymbol.endsWith('USDT') || rawSymbol.length <= 4) {
        return send(res, 400, { ok: false, code: 'INVALID_SYMBOL', msg: 'Invalid USDT symbol.' }, origin);
      }
      const base = rawSymbol.slice(0, -4);

      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
        ...(origin
          ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', Vary: 'Origin' }
          : {}),
      });
      if (typeof res.flushHeaders === 'function') res.flushHeaders();

      let closed = false;
      let inFlight = false;
      let tick = null;
      let ping = null;
      let deadline = null;

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (tick) clearInterval(tick);
        if (ping) clearInterval(ping);
        if (deadline) clearTimeout(deadline);
        try { res.end(); } catch { /* already closed */ }
      };
      // Track the response lifecycle, not request-body completion. The
      // IncomingMessage close event may fire while the SSE response is healthy.
      req.on('error', cleanup);
      res.on('close', cleanup);
      res.on('error', cleanup);

      writeComment(res, 'stream open');
      writeFrame(res, 'hello', {
        channel,
        symbol: rawSymbol,
        intervalMs: channel === 'depth' ? DEPTH_INTERVAL_MS : TRADES_INTERVAL_MS,
      });

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
        } catch {
          writeFrame(res, 'stream-error', { code: 'UPSTREAM_ERROR', msg: 'Upstream market data error.' });
        } finally {
          inFlight = false;
        }
      };

      await emit();
      if (closed) return;

      tick = setInterval(emit, channel === 'depth' ? DEPTH_INTERVAL_MS : TRADES_INTERVAL_MS);
      ping = setInterval(() => writeComment(res, 'ping'), PING_INTERVAL_MS);
      deadline = setTimeout(cleanup, MAX_STREAM_MS);
      return;
    }

    // Read-only trading status for the public-data preview. Order entry stays
    // disabled: this gateway serves market data only and cannot execute trades.
    if (url.pathname === '/api/trading/status') {
      return send(
        res,
        200,
        {
          ok: true,
          spot_order_entry_enabled: false,
          spot_cancel_enabled: false,
          supported_order_types: ['limit'],
        },
        origin,
      );
    }

    // Anonymous reads. A public gateway has no session, so account-scoped reads
    // answer with empty, well-formed payloads. Returning 404 here surfaced as a
    // misleading "Not found." banner on the trade page.
    if (url.pathname === '/api/orders') {
      return send(res, 200, { ok: true, orders: [] }, origin);
    }
    if (url.pathname === '/api/account') {
      return send(
        res,
        401,
        { ok: false, code: 'AUTH_REQUIRED', msg: 'Sign in to view account balances.' },
        origin,
      );
    }

    // Perpetual contract catalogue. Derived from the live spot snapshot (the
    // same provider chain as /api/market), so the contract page gets a real,
    // currently-quoted symbol list instead of a 404 that disabled its market
    // picker. Leverage tiers are configuration, not market data.
    if (url.pathname === '/api/perpetual/markets') {
      const snapshot = await getMarket();
      if (!snapshot.ok) {
        return send(res, 503, { ok: false, code: snapshot.code, msg: snapshot.msg }, origin);
      }
      const markets = snapshot.markets.map((row) => ({
        symbol: `${row.sym}USDT`,
        base_asset: row.sym,
        quote_asset: 'USDT',
        status: 'trading',
        max_leverage: row.sym === 'BTC' ? 100 : row.sym === 'ETH' ? 75 : 50,
        price_tick: row.price >= 1000 ? '0.01' : row.price >= 1 ? '0.0001' : '0.00000001',
        quantity_step: '0.0001',
        min_quantity: '0.0001',
        funding_interval_sec: 28800,
        funding_rate_cap: 0.0075,
        next_funding_at: null,
        // Mark/index are the live spot price; nothing is invented here.
        mark_price: row.price,
        index_price: row.price,
      }));
      return send(res, 200, { ok: true, markets, source: snapshot.source }, origin);
    }

    // Account / product endpoints this gateway cannot serve.
    //
    // The local gateway is public market data only: no session, no financial
    // database, no policy table, no Earn catalogue. A 404 for these paths looked
    // like "the feature does not exist" and polluted the console on Earn,
    // Deposit, Withdraw, Address book, Fees and Support. Each now answers with a
    // well-formed `ok:false` payload (HTTP 200, same convention as
    // `/api/auth-client-config`) naming the reason, so the page renders its own
    // honest unavailable state. No write route exists here, so nothing can be
    // submitted from the preview.
    const UNSERVED_READS = {
      '/api/earn/products': ['EARN_DATA_UNAVAILABLE', 'The Earn catalogue is not served by the local market gateway.'],
      '/api/withdrawal/config': ['WITHDRAWAL_CONFIG_UNAVAILABLE', 'Withdrawal configuration is not served by the local market gateway.'],
      '/api/addresses': ['ADDRESS_BOOK_UNAVAILABLE', 'The address book is not served by the local market gateway.'],
      '/api/support/faq': ['SUPPORT_FAQ_UNAVAILABLE', 'The support knowledge base is not served by the local market gateway.'],
      '/api/deposit': ['DEPOSIT_UNAVAILABLE', 'Deposit addresses are not served by the local market gateway.'],
    };
    const unserved = UNSERVED_READS[url.pathname];
    if (unserved) {
      return send(res, 200, { ok: false, code: unserved[0], msg: unserved[1] }, origin);
    }

    // Short-term ("seconds") contract reads. This gateway is a public market data
    // service: it has no session, no financial database, and no policy table, so
    // it can never answer an account-scoped seconds read truthfully. It answers
    // with a well-formed `ok:false` payload at HTTP 200 (the same convention as
    // `/api/auth-client-config`) instead of a 404: the 404 showed up as a console
    // error and, worse, read like "this product does not exist" rather than
    // "this backend cannot serve it". Order entry stays impossible — there is no
    // POST route, and `actions_enabled` is always false.
    if (url.pathname === '/api/seconds/policy' || url.pathname === '/api/seconds/positions') {
      return send(
        res,
        200,
        {
          ok: false,
          code: 'SECONDS_DATA_UNAVAILABLE',
          msg: 'Short-term contract data is not served by the local market gateway.',
        },
        origin,
      );
    }

    // Auth client configuration. This gateway serves public market data only and
    // never reads credentials from a session, so when Supabase is not configured
    // in the environment it answers with an explicit "not configured" payload
    // (HTTP 200) instead of a 404. The 404 surfaced as console noise and made the
    // client report a misleading initialization failure on the preview.
    if (url.pathname === '/api/auth-client-config') {
      const authUrl = String(process.env.SUPABASE_AUTH_URL || process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
      const publishableKey = String(
        process.env.SUPABASE_AUTH_PUBLISHABLE_KEY || process.env.SUPABASE_AUTH_ANON_KEY || '',
      ).trim();
      let validAuthUrl = false;
      try {
        const parsed = new URL(authUrl);
        validAuthUrl = parsed.protocol === 'https:' && parsed.hostname.endsWith('.supabase.co');
      } catch { validAuthUrl = false; }
      if (!validAuthUrl || !publishableKey) {
        return send(
          res,
          200,
          {
            ok: false,
            code: 'AUTH_CLIENT_CONFIG_UNAVAILABLE',
            msg: 'Authentication is not configured for the local market gateway.',
          },
          origin,
        );
      }
      // Google/Web3 provider detection needs the auth server, which this gateway
      // does not proxy: report them as disabled rather than guessing.
      return send(
        res,
        200,
        {
          ok: true,
          supabase_url: authUrl,
          publishable_key: publishableKey,
          google_enabled: false,
          wallet_enabled: false,
        },
        origin,
      );
    }

    return send(res, 404, { ok: false, msg: 'Not found.' }, origin);
  } catch (error) {
    return send(res, 503, { ok: false, msg: String(error && error.message || error) }, origin);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[market-gateway] listening on http://127.0.0.1:${PORT}`);
  console.log('[market-gateway] routes: /api/market /api/kline /api/depth /api/stream/* /api/perpetual/markets /api/seconds/policy /api/seconds/positions /api/auth-client-config /api/healthz');
});
