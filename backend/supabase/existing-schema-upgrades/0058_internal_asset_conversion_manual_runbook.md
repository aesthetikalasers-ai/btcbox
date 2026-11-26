# BTCBOX internal asset conversion — manual existing-schema upgrade

**Status: prepared for review only. Not executed. Do not enable the feature flag as part of applying this SQL.**

## Safety boundary

- This is an additive upgrade to an already-existing BTCBOX Supabase schema.
- Do not create a database, reset a project, run the empty-database bootstrap, or run the Docker initialization script.
- The SQL creates one quote-claim table, extends the existing financial-operation type check using its live PostgreSQL expression, adding only `asset_conversion` and preserving every currently permitted operation type, and adds one service-role-only RPC.
- It does not backfill, recalculate, transfer, freeze, or otherwise update existing user balances or historical ledger rows.
- Applying the SQL does not enable customer conversions. The API requires `FINANCIAL_INTERNAL_CONVERSION_ENABLED=1`, in addition to the existing financial-write and Supabase storage gates. Keep it unset/off until a separate operational approval and end-to-end verification.

## Before manual execution

1. Take and verify a current Supabase backup. Confirm restore access.
2. Confirm this is the intended existing BTCBOX project and that the current application commit is the reviewed PR head.
3. Read the current live operation-type constraint and compare it with the migration preflight. The migration deliberately aborts if the expected existing constraint is missing; it reads and preserves the exact live allowlist rather than relying on a copied list.
4. Confirm `public.financial_accounts`, `public.financial_operations`, `public.financial_ledger`, and `public.btcbox_assets` already exist.
5. Do not proceed if there are schema differences, pending financial incidents, or any uncertainty about the backup.

Useful read-only preflight:

```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.financial_operations'::regclass
  AND conname = 'financial_operations_operation_type_check';

SELECT to_regclass('public.financial_accounts') AS financial_accounts,
       to_regclass('public.financial_operations') AS financial_operations,
       to_regclass('public.financial_ledger') AS financial_ledger,
       to_regclass('public.btcbox_assets') AS btcbox_assets;

SELECT asset_code, decimals, active
FROM public.btcbox_assets
ORDER BY asset_code;
```

## Applying the change

Only after review and explicit operational approval, execute **this single file only** using the Supabase SQL editor or the approved database change process:

`0058_internal_asset_conversion_atomic_v1.sql`

Do not add it to bootstrap/init inventories. The file has a transaction, short lock/statement timeouts, preflight checks, and a PostgREST schema reload notification. If it fails, the transaction rolls back; do not remove safety checks or retry blindly.

## Read-only post-checks

```sql
SELECT to_regclass('public.financial_conversion_quotes') AS conversion_quote_table;

SELECT proname, pg_get_function_identity_arguments(oid) AS arguments,
       has_function_privilege('service_role', oid, 'EXECUTE') AS service_role_can_execute
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname = 'apply_internal_conversion_atomic';

SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.financial_operations'::regclass
  AND conname = 'financial_operations_operation_type_check';

SELECT count(*) AS quote_claim_rows
FROM public.financial_conversion_quotes;
```

The quote-claim table should be empty immediately after applying the schema change. Do not create real user conversions as a smoke test. Keep `FINANCIAL_INTERNAL_CONVERSION_ENABLED` off until a separately approved test plan verifies success, insufficient balance, expired quote, quote reuse, same-request replay, opposite-direction concurrency, and rollback behavior using isolated test balances.

## Rollback

Do not drop the new table/function or revert the operation-type constraint automatically. Once a conversion has occurred, these objects are part of the audit trail. Any rollback must first reconcile quote claims, operations, and both ledger entries, and must be separately reviewed.