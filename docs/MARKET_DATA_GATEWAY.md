# Public Market Data Gateway

The trade page renders **real public market data**. No prices, candles or order
book levels are ever synthesised.

## Architecture

```
browser ──► same-origin /api/*  ──►  gateway  ──►  public exchange REST
                                        │
                        normalised JSON (one shape)
```

The frontend calls only `/api/market`, `/api/kline`, `/api/depth` and parses a
single JSON shape. **All provider logic lives in the gateway**, so changing the
upstream exchange (or the whole region) requires no frontend change.

This also keeps the Vercel Content-Security-Policy tight: the browser never talks
to an exchange directly, so `connect-src 'self'` stays sufficient.

## Files

| File | Role |
|---|---|
| `backend/market-gateway.js` | Providers, normalisation, validation, caching, fallback |
| `backend/market-server.js` | Local HTTP server exposing `/api/market`, `/api/kline`, `/api/depth` |
| `backend/tests/market-gateway.test.js` | Contract tests (stubbed network, offline-safe) |

## Provider selection

Ordered by `MARKET_PROVIDER_ORDER` (comma-separated). Each request walks the list
and uses the first provider that answers with valid data.

| Provider id | Host | Serves |
|---|---|---|
| `binance-vision` | `data-api.binance.vision` | market, kline, depth |
| `binance-us` | `api.binance.us` | market, kline, depth |
| `coinbase` | `api.exchange.coinbase.com` | market only |

`coinbase` has no public REST depth/kline in this shape, so those endpoints skip
it and fall through to the next capable host.

### Local development

Only `data-api.binance.vision` is reachable from the current dev network, and it
serves `/api/v3/ticker/24hr`, `/api/v3/klines` and `/api/v3/depth` publicly with
no API key.

```bash
node backend/market-server.js 8080

# frontend/.env.local
VITE_API_BASE_URL=http://127.0.0.1:8080/api
```

Leave `VITE_FORCE_DEMO` **unset or 0**: with it set, the app boots the offline
demo fixture and never calls the gateway.

### Vercel production (North America)

The international `api.binance.com` frequently answers **451** for US egress, so
US-friendly hosts must be tried first:

```
MARKET_PROVIDER_ORDER=binance-us,coinbase,binance-vision
```

- `binance-us` — US-regulated, no geo block.
- `coinbase` — ticker fallback.
- `binance-vision` — last resort; kept for redundancy, may be geo-blocked.

Deploy the gateway as a Vercel function (or a small Node service) behind `/api/*`
so the browser keeps calling the same origin.

## Response contract

Every endpoint returns `ok: false` with a `code` when no provider answers. The UI
shows its honest error state; it never receives fabricated values.

### `GET /api/market[?symbols=BTC,ETH]`

```json
{
  "ok": true,
  "source": "binance-vision",
  "markets": [
    { "sym": "BTC", "price": 64200.1, "chg": -1.02,
      "high": 65447, "low": 63336, "vol": "1286341428.69",
      "source": "binance-vision" }
  ],
  "data": {
    "BTC": { "price": 64200.1, "chg": -1.02, "high": 65447, "low": 63336,
             "vol": 1286341428.69, "ts": 1763500000,
             "providerTs": 1763500000, "source": "binance-vision" }
  }
}
```

`vol` is a **string** in `markets` (rendered as text) and a number in `data`
(used for charts). `ts` is the server snapshot time; `providerTs` is the
exchange's own timestamp.

### `GET /api/kline?symbol=BTCUSDT&interval=1h&limit=300`

```json
{ "ok": true, "source": "binance-vision",
  "klines": [ { "time": 1763500000000, "open": 64000, "high": 64200,
                "low": 63900, "close": 64100, "volume": 12.5 } ] }
```

`time` is **milliseconds**. Candles whose OHLC range is impossible
(`high < max(open, close, low)` or `low > min(...)`) are dropped, matching the
frontend's own validation.

Allowed intervals: `1m 5m 15m 1h 4h 1d 1w`. Anything else falls back to `1h`
rather than being passed through.

### `GET /api/depth?symbol=BTCUSDT&limit=100`

```json
{ "ok": true, "source": "binance-vision",
  "bids": [["64199.99","0.5"]], "asks": [["64200.01","0.4"]],
  "snapshotTs": 1763500000 }
```

Price and size stay **strings** so no precision is lost to floating point.
Zero-price/zero-size levels are dropped; a half-empty book returns
`DEPTH_UNAVAILABLE` instead of a partial view.

## Guarantees

- **No fabrication.** Every failure path returns `ok: false` + `code`.
- **Sanity filtering.** Impossible candles, zero-price levels and non-finite
  tickers are dropped before they reach the UI.
- **Bounded caching.** 1.5 s market / 1 s depth / 5 s kline, so a busy UI cannot
  exhaust provider rate limits. Failures are never cached.
- **Trading stays closed.** `/api/trading/status` reports
  `spot_order_entry_enabled: false`; the gateway serves data only and cannot
  execute orders.

## Tests

```bash
node --test backend/tests/market-gateway.test.js
```

Nine contract tests with a stubbed network: normalisation shape, NaN rejection,
provider fallback, unavailable handling, OHLC filtering, interval coercion,
depth string pairs, half-empty book rejection, provider capability declaration.
