# Existing-schema upgrade: perpetual contracts and market taxonomy

This upgrade is for the already-populated BTCBOX Supabase project. It is **not**
the fresh-database bootstrap.

## Canonical SQL sources

- Perpetual schema and RPCs: `backend/supabase/sql/0041_perpetual_contract_v1.sql`
- Support read-state foundation: `backend/supabase/sql/0042_support_read_state_v1.sql`
- Support read cursor: `backend/supabase/sql/0043_support_read_cursor_v1.sql`
- Withdrawal operation-type compatibility: `backend/supabase/sql/0044_withdrawal_operation_type_compatibility_v1.sql`
- Market taxonomy: `backend/supabase/sql/0045_market_asset_categories_v1.sql`
- Atomic funding settlement and clearing: `backend/supabase/sql/0046_perpetual_funding_atomic_clearing_v1.sql`
- Liquidation accounting closure: `backend/supabase/sql/0047_perpetual_liquidation_accounting_closure_v1.sql`
- Fixed funding-rate formula and snapshot producer: `backend/supabase/sql/0048_perpetual_funding_rate_producer_v1.sql`

The numbered SQL files are the canonical source. Do not hand-maintain a second
copy of any migration in this directory.

## Production preflight (read-only)

Before applying any DDL, verify against the exact production project:

1. `public.financial_accounts`, `public.financial_operations`, and
   `public.financial_ledger` already exist and retain their current primary,
   unique and non-negative balance constraints.
2. `public.btcbox_assets` already exists with `asset_code` as its primary key.
   Verify ADA, AVAX, BNB, BTC, DOGE, ETH, SOL, USDT and XRP exist before 0041.
   If any are missing, stop and reconcile separately; production retains a legacy
   asset-insert trigger that may create zero-balance wallet rows for new assets.
3. Capture every existing `financial_operations_operation_type_check` value
   and compare the full existing union with 0041 and 0044. Never replace this
   constraint from a stale schema snapshot.
4. Verify `financial_ledger.operation_id` references
   `financial_operations.id`, and the unique key is
   `(operation_id,user_id,asset)`.
5. Capture row counts and per-user/per-asset available/frozen totals for all
   three financial tables. Preserve this read-only baseline for post-check.
6. Confirm no perpetual tables/RPCs or partial 0041/0046/0047 objects exist.
   If any exist in an incompatible shape, stop and reconcile; `IF NOT EXISTS`
   is not a schema-reconciliation mechanism.
7. Confirm PITR/backup recoverability, a lock/statement timeout plan and an
   operator-approved maintenance window. Do not run a fresh-schema bootstrap.
8. Review 0048's additive columns, producer RPC and financial-operation guard;
   do not apply it until 0041, 0046 and 0047 are present and reconciled.

## Apply sequence for the populated production database

Apply each file as its own tracked Supabase migration, in this exact order:

1. **0041** — installs the additive perpetual schema and service-role RPCs,
   extends the operation-type constraint with the complete legacy + perpetual
   union, and seeds only missing canonical asset rows. Markets remain disabled.
2. **0042** — installs the additive support read-state foundation. Preserve the
   existing support messages and read markers.
3. **0043** — adds the support read cursor RPC after 0042; it does not rewrite
   message history.
4. **0044** — reapplies the current withdrawal-compatible operation-type union
   and the generic `apply_financial_operation` implementation. Its RPC remains
   deliberately limited to generic single-account movements; perpetual matching,
   funding, liquidation and multi-account settlement stay in their dedicated
   atomic RPCs. Do not broaden this generic RPC to `perp_*` types.
5. **0045** — adds the four category definitions and an empty asset assignment
   table. It depends on the canonical asset registry installed/preserved by 0041.
6. **0046** — adds funding clearing entries and the market-wide atomic funding
   boundary RPC. It requires the perpetual tables/RPCs from 0041.
7. **0047** — replaces the liquidation RPC, adds a separate insurance-cover
   operation and a balanced liquidation risk journal. It requires the
   liquidation tables and operation types from 0041.
8. **0048** — adds formula-versioned funding snapshot fields, the database-side
   funding-rate calculation RPC, and a guard that rejects any `perp_funding`
   financial operation unless it references a fresh `btcbox-funding-v1` snapshot.
   It does not settle positions or move funds.

For every file, let the Supabase migration mechanism record its real migration
version/name. Do not manually invent timestamps or insert migration-ledger rows.
Do not combine the files into an untracked SQL editor batch.

## Post-migration invariants

- No pre-existing customer balance or ledger row changes as a side effect of
  schema installation. The only expected new account row from 0041 is the
  zero-balance platform insurance account `__perp_insurance__/USDT`.
- The customer account remains non-negative. Liquidation consumes at most the
  position's isolated collateral; unused collateral and that symbol's open-order
  reserves are released.
- `financial_ledger` records only real `financial_accounts` movements:
  customer liquidation release/loss and the separate insurance-fund debit.
  Bad debt is not a customer debit and must not create a fabricated zero-delta
  customer ledger entry.
- The `perpetual_liquidation_journal` balances each liquidation:
  debit `perp_liquidation_loss`; credits are `user_isolated_margin`,
  `insurance_fund` and `platform_risk_absorption`. The sum of credits must
  equal the actual loss; the database RPC checks this before commit.
- A `perp_bad_debt` operation is owned by `__perp_platform__`; the affected
  customer is retained in the bad-debt event metadata. No negative customer
  balance or automatic customer receivable is created.
- A `perp_insurance_cover` operation is owned by the insurance account and has
  its own negative available delta in `financial_ledger`.
- Funding clearing entries are equal-and-opposite and the market boundary moves
  only after all open positions settle in the same transaction.
- Reconcile the preflight balance totals and ledger counts after each migration.
  If any unexpected row or balance changes, stop before proceeding to the next
  migration and investigate; do not attempt a blind rollback on a populated DB.

## Recovery and compensation

DDL migrations are forward-only in production. Do not drop tables, delete ledger
rows, reset migration history, or restore an old schema over live users.
If a migration fails, its transaction must roll back and the migration must
remain unrecorded; fix the SQL and rerun that migration only. If a committed
migration has a logical defect, ship a new numbered compensating migration that
preserves all existing rows and operation IDs. For any erroneous financial
movement, use a new, separately keyed, auditable compensating operation; never
edit or delete historical financial_ledger rows.

## Runtime readiness (separate from schema migration)

The perpetual worker files are currently one-pass Node scripts, not an active
scheduler. The repository's Vercel configuration does not register a cron or
long-running worker process for them. Therefore the engine must remain disabled.

- Mark-price worker: discovers enabled perpetual markets from Supabase and
  aggregates Binance + OKX, with a third CoinGecko source mapped for the registered
  BTCBOX assets ADA, AVAX, BNB, BTC, DOGE, ETH, SOL and XRP. Other symbols can add
  a trusted CoinGecko ID through `PERP_COINGECKO_IDS`. At least two fresh, distinct
  providers are required; three agreeing sources are needed for an `ok` feed status.
- Funding-rate producer: `perp-funding-rate-worker.js` samples the best five
  distinct executable limit-order levels on each side and submits the two
  quantity-weighted VWAPs. The database calculates and persists the approved
  formula; the producer does not settle positions or move funds. The formula's
  Impact Bid/Ask inputs are this explicitly defined depth-weighted proxy, not a
  fixed-quote-notional exchange impact-price calculation.
- Funding settlement worker: `perp-funding-worker.js` calls the atomic market RPC
  only. Run the producer frequently (recommended 5 seconds) so the snapshot stays
  within the database's 2-minute freshness guard before a due boundary.
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
