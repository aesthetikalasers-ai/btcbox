# Admin Spot Market API

This is the backend contract for the Admin UI's future Spot Markets panel.

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
- Assets must be uppercase alphanumeric identifiers, 2–16 characters, and must differ.
- Decimal fields support up to 20 integer digits and 18 fractional digits, matching the database numeric precision.
- Tick, quantity step and minimum quantity must be positive; minimum notional may be zero.
- Optional absolute minimum/maximum limit prices must be positive and minimum cannot exceed maximum.
- `reason` is required (1–500 characters); `request_id` is required and stable across retries (16–100 safe characters).
- The same actor + request ID + payload replays the stored response. Reusing the request ID with a different payload is rejected.
- Every successful change appends a `financial_audit_log` entry with before/after snapshots.
- Maker/taker fees remain fixed at zero until fee charging/crediting is implemented atomically. The API intentionally does not expose fee editing.

## Current execution boundary

- Spot order submission remains limit-order-only and database-matched.
- Market orders remain fail-closed.
- Market enablement does not fabricate prices or provide a live reference-price feed. Dynamic price bands require a trusted feed and a separate verified rule.
- The backend API and SQL RPC are implemented; the Admin UI panel and its form/reload/retry interactions are still pending the Interaction Team's file scope.
