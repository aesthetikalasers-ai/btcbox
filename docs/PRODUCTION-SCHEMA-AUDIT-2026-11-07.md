# BTCBOX production schema audit — 2026-11-07

## Scope and safety

- Diagnostic source blob: `backend/supabase/diagnostics/production-schema-readiness.sql` (blob `6c258b3824c102ec5c9b6d9312be6b70a5675ffb`).

- Role: 2号 AI (Web App + Admin Panel / production-readiness cross-check).
- Target inspected: connected BTCBOX Supabase project, using catalog-only `SELECT` queries.
- No DDL, DML, grants, revokes, migration, bootstrap, financial flag change, or production deployment was executed.
- The diagnostic is stored at `backend/supabase/diagnostics/production-schema-readiness.sql` and was executed successfully against the connected project. It contains SELECT statements only.

## Confirmed RPC inventory

The inventory now covers all 26 literal PostgREST RPC dependencies found in the active backend request handlers (`backend/api-core.js` and `backend/admin-auth.js`), including both dynamic matching-engine call sites. The diagnostic checks function presence, expected argument count, and role EXECUTE grants. It prints installed identity argument signatures for review; matching arity is not a substitute for reviewing argument names/types and response semantics.

| RPC | Live catalog result |
|---|---|
| `admin_adjustment_atomic` | PRESENT — expected arity 8; service_role only |
| `admin_get_membership_v1` | MISSING |
| `admin_list_memberships_v1` | MISSING |
| `admin_manage_membership_v1` | MISSING |
| `admin_manual_deposit_atomic` | PRESENT — expected arity 9; service_role only |
| `admin_read_seconds_open_positions_v1` | MISSING |
| `admin_set_seconds_policy_v1` | MISSING |
| `admin_set_spot_market_v1` | MISSING |
| `append_admin_audit_log` | MISSING |
| `btcbox_rate_limit_consume_v1` | MISSING |
| `btcbox_save_state` | PRESENT — expected arity 2; service_role only |
| `cancel_limit_order_matching_v1` | PRESENT — expected arity 3; service_role only |
| `create_withdrawal_atomic` | <strong> SIGNATURE MISMATCH — production has 9 args; current API/migration require 11 </strong> |
| `mark_withdrawal_paid_atomic` | MISSING |
| `read_active_seconds_policy_v1` | MISSING |
| `read_admin_account_balances_v1` | PRESENT — expected arity 1; service_role only |
| `read_admin_withdrawal_snapshot_v1` | PRESENT — expected arity 0; service_role only |
| `read_financial_account_snapshot_v1` | PRESENT — expected arity 1; service_role only |
| `read_seconds_positions_v1` | PRESENT — expected arity 1; service_role only |
| `read_spot_market_snapshot_v1` | MISSING |
| `redeem_earn_atomic` | PRESENT — expected arity 4; service_role only |
| `review_withdrawal_atomic` | PRESENT — expected arity 4; service_role only |
| `settle_seconds_position_v1` | PRESENT — expected arity 8; service_role only |
| `submit_limit_order_matching_v1` | PRESENT — expected arity 8; service_role only |
| `submit_seconds_order_v1` | PRESENT — expected arity 9; service_role only |
| `subscribe_earn_atomic` | PRESENT — expected arity 7; service_role only |

Result: 11 of 26 required RPCs are missing, one exists with an incompatible signature, and 14 have the expected argument count with service_role-only EXECUTE. The latest table inventory has 13 required tables present with RLS enabled and no anon/authenticated SELECT grants, and 11 required tables missing (including the admin, Seconds policy, shared rate-limit and policy-idempotency tables). In particular, the live `create_withdrawal_atomic` is the older 9-argument version, while the current API sends the fee snapshot contract introduced by migration `0029` (11 arguments including `p_require_admin_review` and `p_expected_fee`). The route remains fail-closed while financial cutover flags are disabled, but the RPC mismatch must be reconciled before any withdrawal cutover.


## Confirmed table/schema inventory

Present with RLS enabled and no anon/authenticated SELECT grant in the checked set:
- `public.btcbox_state`
- `public.deposit_records`
- `public.financial_accounts`
- `public.financial_ledger`
- `public.financial_operations`
- `public.financial_audit_log`
- `public.financial_matching_markets`
- `public.financial_matching_orders`
- `public.financial_matching_trades`
- `public.seconds_contract_positions`
- `public.withdrawal_requests`
- `public.earn_positions`
- `public.earn_product_catalog`

Missing in the checked set:
- `public.btcbox_rate_limits`
- `public.seconds_contract_policies`
- `public.seconds_contract_policy_active`
- `public.seconds_contract_policy_audit`
- `private.admin_permission_catalog`
- `private.admin_memberships`
- `private.admin_permission_events`
- `private.admin_security_audit`
- `private.admin_request_idempotency`
- `private.seconds_policy_request_idempotency`
- `private.spot_market_request_idempotency`

The `private` schema exists, but service_role does not currently have USAGE. anon and authenticated also do not have USAGE. Do not grant access as an ad hoc patch: apply the reviewed private-schema migration and narrow grants in their intended order after staging validation.

Two private backup tables were also previously found without RLS. The current catalog check confirms anon/authenticated do not have SELECT privileges on them; the private schema is not usable by those roles. Keep them private and do not expose the schema. Review whether those backup tables are still needed and retain them until an owner-approved retention/cleanup decision.

## Additional live column, constraint and index drift — verified 2026-11-07

The expanded read-only diagnostic now checks exact columns, constraints and indexes in addition to RPCs/tables/roles. The latest run against the connected hosted project returned:

| Required object | Live result | Why it matters |
|---|---|---|
| `withdrawal_requests.require_admin_review boolean` | MISSING | The current 11-argument withdrawal RPC reads/writes the review-mode snapshot and returns it on idempotent replay. |
| `withdrawal_requests.request_hash text` | MISSING | The current withdrawal RPC verifies replay payload identity against the stored hash. |
| `seconds_contract_positions.policy_id uuid` | MISSING | New Seconds positions must reference the immutable policy version. |
| `seconds_contract_positions.policy_version bigint` | MISSING | Position history must retain the policy version active at entry. |
| `seconds_contract_positions.payout_bps_snapshot integer` | MISSING | Settlement must use the payout snapshot attached to the position. |
| `seconds_contract_positions.policy_snapshot jsonb` | MISSING | Position terms must remain auditable and immutable. |
| `seconds_contract_positions_duration_sec_positive` | MISSING | New schema expects policy-driven durations with a positive-only table constraint. |
| Legacy `seconds_contract_positions_duration_sec_check` | PRESENT | Still hard-limits durations to 30/60/300/900 seconds. |
| `financial_audit_action_id_desc_idx` | MISSING | Admin audit action-filter path from migration 0032 is absent. |
| `financial_audit_subject_id_desc_idx` | MISSING | Admin audit subject-filter path from migration 0032 is absent. |

This is direct catalog evidence. It means the production Seconds database is still on the pre-policy schema even though the active SQL source has immutable policy snapshots and policy-driven duration validation. Do not broaden duration rules or enable Seconds cutover until the policy tables, immutable snapshot columns, policy read/write RPCs and associated constraints are migrated and tested together.

The 0029 source migration defines the 11-argument withdrawal RPC but its cleanup clause drops the 10-argument overload, not the observed legacy 9-argument overload. A future migration should explicitly reconcile the old 9-argument signature and install the 11-argument contract in a single reviewed change. Do not edit an already-applied migration in place or simply drop the production function ad hoc: first establish migration history, dependency checks and staging behavior.

The 0032 audit indexes are performance support, not a financial correctness blocker by themselves; their absence should be fixed before the admin audit page is expected to scale, but must not be conflated with the missing security/RBAC dependencies.

## Release impact

- Current Vercel preflight validates environment configuration and financial flags; it does not prove that the hosted schema/RPC dependencies exist.
- A green build or preflight therefore must not be interpreted as a green production readiness check.
- Do not enable financial writes, normalized financial reads, matching, Seconds order/settlement, or admin RBAC-dependent flows against this schema state.
- The empty-database bootstrap is not applicable: the connected project has existing BTCBOX tables and data. Never run `bootstrap-empty-database.sh` against it.
- A data-preserving migration/reconciliation plan must be produced from the exact source migrations, validated on a disposable staging copy, and reviewed before any production write.

## Next actions

1. Compare every current API RPC call with the SQL function identity arguments and privilege grants; reconcile the full list, not only function names.
2. Build a migration plan that preserves existing `btcbox_state`, financial ledger, deposits, withdrawals, orders, and positions.
3. Apply the complete canonical migration set to an isolated staging database first; test migration order, function signatures, RLS, service_role-only execution, admin bootstrap, and business invariants.
4. Re-run the read-only diagnostic after staging migration and compare exact expected objects.
5. Obtain explicit owner approval, backup/restore proof, and a maintenance window before any production migration.

## CI snapshot for PR #64

At the latest observed PR head before this audit note:
- Backend unified build/tests/preflight/output verification: PASS.
- PostgreSQL schema source CI: PASS.
- Frontend lint/build and desktop/mobile route smoke tests: PASS.
- PR #64 remains open and unmerged. New commits must be validated on the exact latest head before merge.

## Migration bootstrap consistency finding — 2026-11-07

The local Docker first-init hook was independently maintaining a stale SQL allowlist. Before this batch it referenced the retired `0008_financial_spot_trade_v3.sql` and `0009_financial_matching_engine_v1.sql` names and stopped at `0028`, omitting canonical `0029`–`0032`. This meant Docker first-init could not reproduce the canonical schema used by the guarded empty-database bootstrap.

Fixed in PR #64:
- `backend/scripts/docker-init-migrations.sh` now uses the same 25-file allowlist as `bootstrap-empty-database.sh`, with per-file existence checks and stop-on-error behavior.
- `backend/docker-compose.yml` now accurately states that initialization happens only for a new empty Docker data volume. Existing volumes are not upgraded automatically.
- `backend/tests/migration-status-script.test.js` compares both allowlists byte-for-byte by filename against the actual numbered SQL inventory and runs shell syntax checks.
- `backend/tests/rpc-source-contract.test.js` ensures active backend RPC call sites have canonical SQL definitions and checks the 11-argument withdrawal fee-snapshot contract.

The migration commands remain fresh-database bootstraps, not safe hosted upgrade runners. A persistent Docker volume and the hosted Supabase project still require a separate versioned, data-preserving migration plan.

## Current validation snapshot

- Backend CI on code commit `90c3b5b724944291286924202b1a64ffbce6ef2f`: PASS (unified build, full backend test suite, fail-closed preflight).
- PostgreSQL schema CI run `42378617945` and frontend CI run `42378617992` subsequently completed successfully. Backend CI run `42378617958` also completed successfully. These checks include the Docker/bootstrap parity test and active RPC source-contract test at code commit `90c3b5b724944291286924202b1a64ffbce6ef2f`; later commits changed only the read-only diagnostic SQL and documentation, and the latest diagnostic SQL was executed successfully against the connected project.
- The Vercel status check reports the existing `build-rate-limit` / plan deployment cap. No Vercel deployment was requested or triggered by this batch.


## Migration ledger evidence

A fresh read-only query of `supabase_migrations.schema_migrations` returned only:
- `20261102133555`
- `20261103062716`

These are timestamp-form versions and do not map directly to the repository's four-digit migration filenames. No source-to-ledger mapping has been established. The hosted database must not be assumed to have applied any numbered SQL file solely from these two timestamps.


Further read-only checks of the withdrawal and audit contracts confirmed:
- `withdrawal_requests.payout_reference`, `payout_note`, `paid_by`, and `paid_at` are also absent. The production status CHECK remains the legacy set `pending/approved/rejected/broadcast/failed`, omitting `pending_admin_review` and `completed`.
- `financial_audit_log.event_id` is absent, so the append-only idempotent audit outbox contract from migration 0021 is not installed.
- Together with the missing `require_admin_review` and `request_hash`, this means the current manual payout completion and fee-quote replay workflow cannot be safely enabled against the live withdrawal table.
- The diagnostic was expanded to report all these exact columns and the withdrawal status constraint; it was re-executed successfully as read-only SQL after the update.


## New source-side correction — withdrawal RPC overload cleanup

The migration chain revealed why a live catalog can retain the original 9-argument `create_withdrawal_atomic` even though the current source expects 11 arguments:
- `0003_financial_lifecycle_v2.sql` creates the original 9-argument function.
- `0022_withdrawal_admin_review_status_v1.sql` removes that 9-argument overload and installs a 10-argument function.
- `0029_withdrawal_fee_quote_idempotency_v1.sql` removes the 10-argument function and installs the 11-argument fee-snapshot function, but does not independently remove a lingering 9-argument overload if the earlier migration was skipped or the hosted history is inconsistent.

Added canonical migration `0033_withdrawal_legacy_rpc_cleanup_v1.sql`:
- Explicitly removes both legacy 9- and 10-argument overloads.
- Fails closed unless the 11-argument canonical function already exists.
- Asserts exactly one `create_withdrawal_atomic` overload remains.
- Asserts EXECUTE is granted to `service_role` and not to `anon` or `authenticated`.
- Does not update or delete withdrawal rows, financial accounts, ledger entries, or balances.
- Included in both guarded empty-database and Docker first-init allowlists; migration-order documentation and regression tests were updated accordingly.

This is a source-chain correction only. It has not been run against the hosted production database. It must be applied only after the complete prerequisite chain has been mapped and rehearsed on a data-preserving staging copy.


## Diagnostic hardening follow-up

The production readiness query was executed again after adding overload-count detection. The current live result is unchanged: `create_withdrawal_atomic` is still the old 9-argument function and is reported as `SIGNATURE_MISMATCH`. The diagnostic now also emits `LEGACY_OVERLOAD_PRESENT` if a future database has the expected function but retains any additional overload, rather than treating a matching arity as sufficient. This query remains SELECT-only and has again completed successfully against the connected project.


## Production data preservation baseline — verified by count-only SQL

A second privacy-safe diagnostic was added at `backend/supabase/diagnostics/production-data-inventory.sql`. It returns table counts, top-level JSON key/type/count metadata and aggregate user setup counts only; it does not return user IDs, balances, addresses, tokens, sessions, or row payloads. It was executed successfully against the connected project.

Observed baseline:
- `btcbox_state`: one row, revision 29; 3 internal users, 8 configured deposit-address entries, 3 sessions, 0 temporary tokens, 0 embedded audit rows.
- `earn_product_catalog`: 7 rows.
- Normalized financial tables checked (accounts, operations, ledger, audit, deposits, withdrawals, Earn positions, matching markets/orders/trades, Seconds positions): all currently 0 rows.
- The three state users have 18 asset balance slots (six assets each); every free/frozen amount is zero. Their embedded deposits, withdrawals, orders, Earn records, support messages, addresses and address-audit arrays are all empty.
- 2 of 3 users have Supabase identity links; 0 have a BTCBOX username, username-login credential, or linked wallet. The third user remains an unlinked account requiring owner-reviewed identity reconciliation; never auto-merge it by email or metadata.
- The state JSON contains credential/security-related fields; no values were read. Encrypted backup handling and strict staging access controls remain mandatory.

Important: normalized finance tables being empty does not make the state document disposable. Preserve the complete `btcbox_state` row/revision, all three user records, provider mappings, deposit-address configuration, UID counter, announcement, and the 7 existing Earn products. Do not seed fake ledger balances. Migration `0006` uses `ON CONFLICT (product_id) DO NOTHING` for the seven Earn catalog IDs, but compare existing product definitions before staging upgrade.

The detailed preservation and staging sequence is recorded in `docs/PRODUCTION-DATA-PRESERVING-MIGRATION-PLAN-2026-11-07.md`.
