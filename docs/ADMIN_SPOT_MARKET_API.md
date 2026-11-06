# Admin Spot Market API

This is the backend contract used by the Admin Console's Spot Markets panel.

## Authorization

- `GET /api/admin/spot-markets` requires `system_config.read`.
- `POST /api/admin/spot-markets` requires `system_config.write`.
- The backend derives the actor UUID from the verified Supabase Auth session. Never accept an actor/admin ID from the request body.
- PostgreSQL independently checks the actor's active admin membership and `system_config.write` permission before changing a market.

## Read

`GET /api/admin/spot-markets` returns:

```json
{
  "ok": true,
  "markets": [
    {
      "base_asset": "BTC",
      "quote_asset": "USDT",
      "enabled": false,
      "price_tick": "1",
      "quantity_step": "0.001",
      "min_quantity": "0.001",
      "min_notional": "1",
      "min_limit_price": null,
      "max_limit_price": null,
      "maker_fee_rate": "0",
      "taker_fee_rate": "0"
    }
  ]
}
```

An empty array means no market pair has been configured yet.

## User-facing market catalogue

- Public `GET /api/market/pairs` returns only enabled pairs from the same PostgreSQL catalogue. The Trade Hub builds its spot links from this response; it no longer assumes BTC/USDT is always enabled.
- Only supported ledger base assets quoted in USDT are currently allowed. Other quote currencies remain unavailable until matching market-data providers and user-facing valuation are implemented.
- Public ticker, candle and depth routes are gated by the same enabled-pair catalogue. A disabled or unconfigured pair returns `SPOT_MARKET_DISABLED`; an empty configured catalogue returns an empty market list rather than invented symbols.

## Update one market

`POST /api/admin/spot-markets` accepts:

```json
{
  "base_asset": "BTC",
  "quote_asset": "USDT",
  "enabled": true,
  "price_tick": "1",
  "quantity_step": "0.001",
  "min_quantity": "0.001",
  "min_notional": "1",
  "min_limit_price": null,
  "max_limit_price": null,
  "reason": "Enable BTC/USDT after market review",
  "request_id": "spot-market-config-request-0001"
}
```

Rules:
- Assets must be selected from the supported BTCBOX ledger catalogue (`USDT`, `USDC`, `BTC`, `ETH`, `SOL`, `BNB`, `XRP`, `DOGE`, `ADA`, `AVAX`, `LINK`, `DOT`, `TRX`, `LTC`, `BCH`, `NEAR`, `UNI`, `ATOM`, `ETC`) and must differ.
- Decimal fields support up to 20 integer digits and 18 fractional digits, matching the database numeric precision.
- Tick, quantity step and minimum quantity must be positive; minimum notional may be zero.
- Optional absolute minimum/maximum limit prices must be positive and minimum cannot exceed maximum.
- `reason` is required (1–500 characters); `request_id` is required and stable across retries (16–100 safe characters).
- The same actor + request ID + payload replays the stored response. Reusing the request ID with a different payload is rejected.
- Every successful change appends a `financial_audit_log` entry with before/after snapshots.
- Order submission and admin rule changes share a per-market PostgreSQL advisory lock. Exact order retries replay before current market-state checks.
- Precision, minimum-size/notional and absolute price-bound changes are rejected while open or partially filled orders remain. Cancel resting orders first; pausing a market is still allowed.
- Maker/taker fees remain fixed at zero until fee charging/crediting is implemented atomically. The API intentionally does not expose fee editing.

## Current execution boundary

- Spot order submission remains limit-order-only and database-matched.
- Market orders remain fail-closed.
- Market enablement does not fabricate prices or provide a live reference-price feed. Dynamic price bands require a trusted feed and a separate verified rule.
- The Admin Console includes a Spot Markets tab for reading, adding, editing and enabling/disabling supported pairs. The form persists an ambiguous request ID and locks the payload until the exact request is retried. The UI does not expose fee editing.
