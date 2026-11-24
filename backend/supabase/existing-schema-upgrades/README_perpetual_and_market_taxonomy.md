# Existing-schema upgrade: perpetual contracts and market taxonomy

This upgrade is for the already-populated BTCBOX Supabase project. It is **not**
the fresh-database bootstrap.

## Canonical SQL sources

- Perpetual contract schema and RPCs: `backend/supabase/sql/0041_perpetual_contract_v1.sql`
- Market taxonomy foundation: `backend/supabase/sql/0045_market_asset_categories_v1.sql`

The numbered SQL files are the canonical source. Do not hand-maintain a second
copy of either migration in this directory.

## Production preflight (read-only)

Before an operator applies either migration, verify all of the following against
the exact target project:

1. `public.financial_accounts`, `public.financial_operations`, and
   `public.financial_ledger` already exist.
2. `financial_ledger.operation_id` references `financial_operations.id`, and
   its unique key is `(operation_id, user_id, asset)`.
3. Existing `financial_operations_operation_type_check` values are captured
   and compared with the replacement list in 0041. Never replace this constraint
   from a stale schema snapshot.
4. The three financial tables' row counts and account balances are captured for
   post-migration comparison.
5. No perpetual tables or RPCs exist in a partially installed, incompatible
   shape. If any do, stop and reconcile rather than relying on `IF NOT EXISTS`.
6. Confirm a recoverable Supabase backup/PITR window and a maintenance window
   before applying DDL.

## Apply sequence

1. Apply `0041_perpetual_contract_v1.sql` through the Supabase migration
   mechanism so the hosted `supabase_migrations.schema_migrations` ledger
   records the generated timestamp/name. Do not manually invent a timestamp
   or insert a migration-ledger row.
2. Verify the 11 perpetual tables, RPC signatures, RLS, and service-role-only
   grants. Confirm all markets remain `enabled=false` and `status='paused'`.
3. Apply `0045_market_asset_categories_v1.sql` as a separate migration.
4. Verify the four category definitions and empty asset assignments.
   `0045` reuses the existing `public.btcbox_assets` registry through a foreign
   key; new asset codes must first be registered there. Do not infer
   classifications from tickers or write assignments without verified metadata.
5. Compare financial account balances and existing ledger rows to the preflight
   snapshot. The only expected new financial account row from 0041 is the
   zero-balance platform insurance account `__perp_insurance__ / USDT`; existing
   user balances and existing ledger rows must remain unchanged.

## Runtime readiness (separate from schema migration)

The perpetual worker files are currently one-pass Node scripts, not an active
scheduler. The repository's Vercel configuration does not register a cron or
long-running worker process for them. Therefore the engine must remain disabled.

- Mark-price worker: discovers enabled perpetual markets from Supabase and
  includes built-in Binance/CoinGecko mappings for the registered BTCBOX assets
  ADA, AVAX, BNB, BTC, DOGE, ETH, SOL and XRP. Other symbols require an explicit
  trusted CoinGecko ID in `PERP_COINGECKO_IDS`; every market still requires two
  successful sources before a mark is recorded.
- Funding worker: v1 deliberately records a zero funding rate until a validated
  premium-index calculation is implemented. It is not yet a live funding-rate engine.
- Liquidation worker: must run continuously at the intended 2–5 second cadence;
  a once-per-minute schedule is not equivalent.

The API now also requires `FINANCIAL_PERPETUAL_WORKERS_READY=1` in addition to
`FINANCIAL_PERPETUAL_ENGINE_ENABLED=1` and the existing financial-write gate.
Do not set the worker-readiness flag until the mark, funding and liquidation
workers are actually deployed, scheduled, monitored and tested. Schema migration
alone never sets these environment variables.

## Prohibited path

Do not run `bootstrap-empty-database.sh`, `run_migrations.sh`, or
`docker-init-migrations.sh` against this populated project. Those scripts are
fresh-schema initializers and deliberately refuse existing BTCBOX tables.
Do not enable `FINANCIAL_PERPETUAL_ENGINE_ENABLED` as part of schema migration.
Do not deploy or enable markets as a side effect of applying these migrations.

## Current authorization state

This document records the safe procedure only. It does not authorize or claim
that either migration has been applied to production.
