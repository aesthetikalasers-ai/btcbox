# BTCBOX fresh database bootstrap and SQL reference

Status: source-only SQL inventory and bootstrap instructions. The files are not proof of a hosted database installation. The user has confirmed the project database is empty; this workflow creates a fresh BTCBOX schema and is not a legacy-data migration.

## Canonical fresh-schema bootstrap

Use `backend/scripts/bootstrap-empty-database.sh` only against a verified empty BTCBOX schema. The script:
- requires `DATABASE_URL` and `BTCBOX_BOOTSTRAP_CONFIRM=YES`;
- parses the URL hostname and refuses remote targets unless `BTCBOX_ALLOW_REMOTE_BOOTSTRAP=YES` is explicitly supplied;
- checks that no BTCBOX-owned tables already exist before applying SQL;
- applies every numbered SQL file currently present in `backend/supabase/sql` in the allowlisted order;
- stops on the first SQL error and never prints the database URL.

The script does not clear or overwrite an existing schema. It is not idempotent by design: a second run sees the installed BTCBOX tables and refuses. Do not run it against a production database without a separately approved maintenance operation.

## Exact source migration order

The current canonical source inventory is:

1. `0001_btcbox_state_cas.sql`
2. `0002_financial_ledger_v1.sql`
3. `0003_financial_lifecycle_v2.sql`
4. `0004_financial_admin_adjustment_v1.sql`
5. `0005_financial_earn_redemption_idempotency_v4.sql`
6. `0006_financial_earn_policy_v5.sql`
7. `0007_financial_admin_manual_deposit_v1.sql`
8. `0008_financial_matching_engine_v1.sql`
9. `0010_financial_read_api_v1.sql`
10. `0011_financial_read_api_earn_v1.sql`
11. `0012_financial_admin_read_api_v1.sql`
12. `0013_financial_admin_account_read_api_v1.sql`
13. `0014_financial_seconds_contracts_v1.sql`
14. `0021_admin_audit_log_append_only_v1.sql`
15. `0022_withdrawal_admin_review_status_v1.sql`
16. `0023_btcbox_shared_rate_limit_v1.sql`
17. `0024_seconds_settlement_idempotency_v1.sql`
18. `0025_seconds_policy_versioning_v1.sql`
19. `0026_admin_rbac_private_store_v1.sql`
20. `0027_withdrawal_manual_payout_completion_v1.sql`
21. `0028_admin_rbac_service_rpc_wrappers_v1.sql`
22. `0029_withdrawal_fee_quote_idempotency_v1.sql`

The retired `0008_financial_spot_trade_v3.sql` direct-fill RPC was removed: it bypassed the order book and was not called by the API. `0009_financial_matching_engine_v1.sql` is the only supported spot write path. The bootstrap test compares the allowlist to the actual numbered SQL files so a newly added migration cannot silently be omitted.

## Intentionally excluded legacy/optional material

The old `0015` single-open-position restriction is not part of the current business rule; multiple unfinished Seconds positions are allowed unless the active policy sets an explicit per-user count limit. The old `0016` automated chain-verification path and `0017`–`0019` staging/import/reconciliation scripts were removed from the canonical source tree. The read-only `0020` ledger diagnostic is maintained separately under `backend/supabase/diagnostics/financial-ledger-integrity.sql` and is not a migration.

Manual deposits follow the chosen half-manual workflow: staff verifies the transfer and invokes the audited manual-credit operation. No user-created pending deposit or automatic chain watcher is required.

## Key dependency and behavior notes

- `0001`–`0007` establish the state/CAS, financial ledger and lifecycle RPCs, admin adjustment and manual credit; `0008` is the sole canonical spot limit-order matching engine; `0010`–`0014` establish financial read APIs and the Seconds base schema.
- `0021` extends the canonical financial audit contract; it must not create a second competing audit-log schema.
- `0022` extends the existing withdrawal review/request contract.
- `0023` adds shared server-side rate limiting before routes that consume its RPC.
- `0024` adds Seconds settlement request-hash idempotency and depends on the Seconds base schema in `0014`.
- `0025` adds immutable Seconds policy versions, active pointer, policy audit and per-position payout/policy snapshots. New orders validate the active policy and snapshot it in the same transaction as the reserve.
- `0026` adds the private admin membership/permission store, Super Admin bootstrap and delegated-admin lifecycle.
- `0027` adds staff-paid completion for an already approved withdrawal; it records the payout reference and status/audit transition without broadcasting or debiting a second time.
- `0028` adds service-role-only PostgREST wrappers for admin membership and atomic Seconds policy version activation.
- `0029` makes withdrawal fee quotes replay-safe: existing requests retain their stored fee and review snapshot, while new requests must match the current server quote.

## Admin bootstrap and financial safety

The initial Super Admin is not seeded automatically. First, the intended administrator must register through the configured Supabase Auth provider. The project owner then verifies the exact Auth UUID and invokes the owner-only `private.bootstrap_super_admin_v1` operation with a reason and change reference from a PostgreSQL owner session. The function requires `session_user = postgres`, checks the Auth user exists and refuses if a Super Admin already exists.

Do not put a service-role key in the browser. Private tables remain unavailable to browser roles; the backend uses narrow RPC wrappers after validating Supabase Auth.

All financial writes and matching remain fail-closed during source QA. Applying SQL does not itself authorize enabling deposits, withdrawals, spot matching, Seconds orders or settlement.

## Validation and release gates

Source CI verifies migration inventory, shell syntax, bootstrap safety gates and source-level RPC contracts. It does not execute PostgreSQL DDL. Before any hosted install:
- create or use a disposable empty PostgreSQL/Supabase environment;
- apply all 22 files in the exact order above and stop on any error;
- verify function signatures, RLS, grants, service-role-only execution and private schema exposure;
- bootstrap the intended Super Admin and test delegated admin permissions;
- test manual credit, withdrawal approval/payout completion, spot order idempotency and Seconds order/settlement concurrency/replay without enabling production financial cutover;
- preserve evidence and the exact SQL/source SHA.

Never infer live migration state by comparing timestamp registry versions with four-digit source filenames. `backend/scripts/check_migration_status.py` intentionally refuses that unsafe comparison without an explicit reviewed mapping.