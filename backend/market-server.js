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
const { getMarket, getKlines, getDepth } = require('./market-gateway');

const PORT = Number(process.argv[2] || process.env.MARKET_API_PORT || 8080);

/** Only the local dev origins may call this server. */
const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:4175',
  'http://127.0.0.1:4175',
]);

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
  const origin = ALLOWED_ORIGINS.has(req.headers.origin || '') ? req.headers.origin : null;

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

    if (url.pathname === '/api/healthz' || url.pathname === '/healthz') {
      return send(res, 200, { ok: true, service: 'btcbox-market-gateway' }, origin);
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

    return send(res, 404, { ok: false, msg: 'Not found.' }, origin);
  } catch (error) {
    return send(res, 503, { ok: false, msg: String(error && error.message || error) }, origin);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[market-gateway] listening on http://127.0.0.1:${PORT}`);
  console.log('[market-gateway] routes: /api/market /api/kline /api/depth /api/healthz');
});
