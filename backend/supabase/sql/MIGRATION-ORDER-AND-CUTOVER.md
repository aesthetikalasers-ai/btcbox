# BTCBOX fresh database bootstrap and SQL reference

Status: source-only SQL inventory and bootstrap instructions. The files are not proof of a hosted database installation. The connected hosted project has pre-existing BTCBOX state/data; this empty-schema bootstrap must not be run against it. Any hosted migration requires a separately reviewed, data-preserving reconciliation plan and explicit owner approval.

## Canonical fresh-schema bootstrap

Use `backend/scripts/bootstrap-empty-database.sh` only against a verified empty BTCBOX schema. The Docker first-init hook (`backend/scripts/docker-init-migrations.sh`) must apply the same exact canonical filename allowlist. Both are fresh-database bootstraps, not upgrade paths. The script:
- requires `DATABASE_URL` and `BTCBOX_BOOTSTRAP_CONFIRM=YES`;
- parses the URL hostname and refuses remote targets unless `BTCBOX_ALLOW_REMOTE_BOOTSTRAP=YES` is explicitly supplied;
- checks that no BTCBOX-owned tables already exist before applying SQL;
- applies the 26 canonical SQL files explicitly allowlisted in `backend/scripts/bootstrap-empty-database.sh`; excluded legacy/optional files and read-only diagnostics are not applied;
- stops on the first SQL error and never prints the database URL.

The scripts do not clear or overwrite an existing schema. They are not incremental migration runners: Docker's init hook only runs for a new empty data directory, and `run_migrations.sh` is a compatibility alias for the guarded empty-database bootstrap. A persisted Docker volume is not upgraded automatically. Do not run either bootstrap against a production database or an existing data volume; a separate versioned, data-preserving upgrade process is required.

## Exact source SQL order

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
23. `0030_seconds_admin_open_positions_read_v1.sql`
24. `0031_seconds_policy_duration_alignment_v1.sql`
25. `0032_admin_audit_log_filter_indexes_v1.sql`
26. `0033_withdrawal_legacy_rpc_cleanup_v1.sql`

The legacy `0008_financial_spot_trade_v3.sql` direct-fill RPC was removed because it bypassed the order book and was not called by the API. The durable matching engine now occupies `0008_financial_matching_engine_v1.sql` and is the only supported spot write path. Sequence `0009` is retired and intentionally omitted; the offline migration checker explicitly recognizes retired slots `0009` and `0015`–`0020`. The bootstrap allowlist contains only live numbered SQL files and is tested against the actual source inventory.

## Intentionally excluded legacy/optional material

The old `0015` single-open-position restriction is not part of the current business rule; multiple unfinished Seconds positions are allowed unless the active policy sets an explicit per-user count limit. The old `0016` automated chain-verification path and `0017`–`0019` staging/import/reconciliation scripts were removed from the canonical source tree. The read-only `0020` ledger diagnostic is maintained separately under `backend/supabase/diagnostics/financial-ledger-integrity.sql` and is not a migration.

Manual deposits follow the chosen half-manual workflow: staff verifies the transfer and invokes the audited manual-credit operation. No user-created pending deposit or automatic chain watcher is required.

## Key dependency and behavior notes

- `0001`–`0007` establish the state/CAS, financial ledger and lifecycle RPCs, admin adjustment and manual credit; `0008` is the sole canonical spot limit-order matching engine; `0010`–`0014` establish financial read APIs and the Seconds base schema.
- `0021` extends the canonical financial audit contract; it must not create a second competing audit-log schema.
- `0022` extends the existing withdrawal review/request contract.
- `0023` adds shared server-side rate limiting before routes that consume its RPC.
- `0037` extends the shared limiter's scope constraint and server policy for withdrawal creation, Spot order/cancel, and Earn subscribe/redeem; each route fails closed if the shared limiter is unavailable.
- `0038` makes PostgreSQL authoritative for first-successful-withdrawal manual review. The database ORs the API's large-value/unknown-price flag with its own prior successful withdrawal history, so stale legacy `btcbox_state` cannot bypass the first-withdrawal review requirement.
- `0024` adds Seconds settlement request-hash idempotency and depends on the Seconds base schema in `0014`.
- `0025` adds immutable Seconds policy versions, active pointer, policy audit and per-position payout/policy snapshots. New orders validate the active policy and snapshot it in the same transaction as the reserve.
- `0026` adds the private admin membership/permission store, Super Admin bootstrap and delegated-admin lifecycle.
- `0027` adds staff-paid completion for an already approved withdrawal; it records the payout reference and status/audit transition without broadcasting or debiting a second time.
- `0028` adds service-role-only PostgREST wrappers for admin membership and atomic Seconds policy version activation. The final public wrappers must remain `SECURITY INVOKER` with an empty `search_path`, EXECUTE revoked from `PUBLIC`/`anon`/`authenticated` and granted only to `service_role`; the private schema grants `service_role` USAGE but no direct table DML. Migration `0026` contains intermediate compatibility wrappers, so verify the post-`0028` effective definitions rather than judging the final state from `0026` alone.
- `0029` makes withdrawal fee quotes replay-safe: existing requests retain their stored fee and review snapshot, while new requests must match the current server quote.
- `0030` adds a bounded, read-only administrator queue for open Seconds positions. It rechecks active `seconds_policy.read` membership inside PostgreSQL, returns at most 100 operational rows plus aggregate exposure/overdue counts, and cannot mutate positions or financial balances.
- `0031` removes the obsolete fixed Seconds position-duration allowlist; positive duration values are now governed by the active immutable policy, matching the admin policy RPC.
- `0032` adds two non-destructive indexes on `public.financial_audit_log` — `(action, id desc)` and `(subject_user_id, id desc)` — matching the admin audit-logs query access paths (filtered by action or subject, ordered by id desc). Safe to re-run via `IF NOT EXISTS`.
- `0033` removes any lingering 9- or 10-argument `create_withdrawal_atomic` overload after `0029`, then asserts that exactly one 11-argument service-role-only function remains. It does not alter withdrawal rows or balances.

## Admin bootstrap and financial safety

The initial Super Admin is not seeded automatically. First, the intended administrator must register through the configured Supabase Auth provider. The project owner then verifies the exact Auth UUID and invokes the owner-only `private.bootstrap_super_admin_v1` operation with a reason and change reference from a PostgreSQL owner session. The function requires `session_user = postgres`, checks the Auth user exists and refuses if a Super Admin already exists.

Do not put a service-role key in the browser. Private tables remain unavailable to browser roles; the backend uses narrow RPC wrappers after validating Supabase Auth.

All financial writes and matching remain fail-closed during source QA. Applying SQL does not itself authorize enabling deposits, withdrawals, spot matching, Seconds orders or settlement.

## Read-only hosted schema diagnostic

`backend/supabase/diagnostics/hosted-schema-contract-readonly.sql` is a SELECT-only diagnostic for comparing critical PR #67 tables/functions and the current state counts with the connected hosted database. It does not mutate schema or data and deliberately reports missing objects instead of attempting to bootstrap them. Run it only for inspection; a missing-object result is a release blocker, not permission to run the fresh-schema bootstrap against a non-empty project.

## Validation and release gates

Source CI verifies migration inventory, shell syntax, bootstrap safety gates and source-level RPC contracts. It does not execute PostgreSQL DDL. Before any hosted install:
- create or use a disposable empty PostgreSQL/Supabase environment;
- apply all 26 files in the exact order above and stop on any error;
- verify function signatures, RLS, grants, service-role-only execution and private schema exposure;
- bootstrap the intended Super Admin and test delegated admin permissions;
- test manual credit, withdrawal approval/payout completion, spot order idempotency and Seconds order/settlement concurrency/replay without enabling production financial cutover;
- preserve evidence and the exact SQL/source SHA.

Never infer live migration state by comparing timestamp registry versions with four-digit source filenames. `backend/scripts/check_migration_status.py` intentionally refuses that unsafe comparison without an explicit reviewed mapping.

## Read-only migration reconciliation evidence

Before preparing a staging upgrade, capture a schema-only evidence report from an isolated clone:

```bash
python3 scripts/audit_migration_mapping.py --source-only > migration-source-manifest.json
STAGING_DATABASE_URL='postgresql://…' python3 scripts/audit_migration_mapping.py > staging-schema-evidence.json
```

Install `requirements-postgres-staging.txt` in the isolated audit environment first. The database mode opens a read-only transaction and records the timestamp ledger, canonical source SHA-256 hashes, table/column/constraint/index inventory, function signatures/security settings, and schema/function privilege facts. It does not return application rows, user identifiers, balances, credential values, session data, or secrets. It refuses the known production project reference and ignores `DATABASE_URL`; only `STAGING_DATABASE_URL` is accepted.

The output deliberately remains `MANUAL_REVIEW_REQUIRED`. It is evidence for a human-reviewed migration mapping, not an automatic timestamp-to-four-digit mapping algorithm, migration runner, backup tool, or production authorization. Preserve the JSON reports with the staging change record and review source SHA, ledger versions, and catalog differences together before selecting any pending SQL.
