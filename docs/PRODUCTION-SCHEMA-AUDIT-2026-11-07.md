# BTCBOX production schema audit — 2026-11-07

## Scope and safety

- Diagnostic source blob: `backend/supabase/diagnostics/production-schema-readiness.sql` (blob `6c258b3824c102ec5c9b6d9312be6b70a5675ffb`).

- Role: 2号 AI (Web App + Admin Panel / production-readiness cross-check).
- Target inspected: connected BTCBOX Supabase project, using catalog-only `SELECT` queries.
- No DDL, DML, grants, revokes, migration, bootstrap, financial flag change, or production deployment was executed.
- The diagnostic is stored at `backend/supabase/diagnostics/production-schema-readiness.sql` and was executed successfully against the connected project. It contains SELECT statements only.

## Confirmed RPC inventory

The inventory was expanded after tracing every literal `/rest/v1/rpc/` call plus both dynamic `matchingRpc(...)` call sites in the active API handler and the administrator-auth module. This supersedes the initial 12-name sample.

The diagnostic checks all 26 literal PostgREST RPC dependencies found in the active backend request handlers (`backend/api-core.js` and `backend/admin-auth.js`), including both matching-engine calls.

| RPC | Live catalog result |
|---|---|
| `admin_get_membership_v1` | MISSING |
| `admin_list_memberships_v1` | MISSING |
| `admin_manage_membership_v1` | MISSING |
| `admin_read_seconds_open_positions_v1` | MISSING |
| `admin_set_seconds_policy_v1` | MISSING |
| `admin_set_spot_market_v1` | MISSING |
| `append_admin_audit_log` | MISSING |
| `btcbox_rate_limit_consume_v1` | MISSING |
| `mark_withdrawal_paid_atomic` | MISSING |
| `read_active_seconds_policy_v1` | MISSING |
| `read_spot_market_snapshot_v1` | MISSING |
| `review_withdrawal_atomic` | PRESENT — `public.review_withdrawal_atomic(text,text,boolean,text)`, executable by service_role only |

Result: the complete live catalog result is recorded in the table above. This is a confirmed catalog observation, not an inference from migration filenames. The earlier 12-function subset was incomplete and is superseded by this 26-function inventory.

## Confirmed table/schema inventory

Present with RLS enabled and no anon/authenticated SELECT grant in the checked set:
- `public.btcbox_state`
- `public.deposit_records`
- `public.financial_accounts`
- `public.financial_ledger`
- `public.financial_audit_log`
- `public.financial_matching_markets`
- `public.financial_matching_orders`
- `public.financial_matching_trades`
- `public.seconds_contract_positions`
- `public.withdrawal_requests`

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

The `private` schema exists, but service_role does not currently have USAGE. anon and authenticated also do not have USAGE. Do not grant access as an ad hoc patch: apply the reviewed private-schema migration and narrow grants in their intended order after staging validation.

Two private backup tables were also previously found without RLS. The current catalog check confirms anon/authenticated do not have SELECT privileges on them; the private schema is not usable by those roles. Keep them private and do not expose the schema. Review whether those backup tables are still needed and retain them until an owner-approved retention/cleanup decision.

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
