# BTCBOX v33 coordination update — 2026-11-06

## Migration 0021 audit-log reconciliation

- Source branch: `fix/manual-withdrawal-rpc-compat-20261106`.
- Issue #4: https://github.com/avali9308-code/btcbox-v33/issues/4
- SOURCE OBSERVED: migration 0002 creates the canonical `public.financial_audit_log` using `actor_id, subject_user_id, action, object_type, object_id, reason, metadata, created_at`. The previous 0021 migration assumed an incompatible `uid/by/detail/meta` shape and attempted to index `uid`.
- SOURCE OBSERVED: the previous `append_admin_audit_log` SECURITY DEFINER RPC revoked EXECUTE from anon/authenticated but not PUBLIC.
- IMPLEMENTED IN SOURCE: migration 0021 now validates and extends the canonical 0002 table; preserves the existing Node `auditAdmin()` arguments while mapping to canonical columns; uses SECURITY INVOKER and an empty search_path; explicitly revokes PUBLIC/anon/authenticated and grants EXECUTE only to service_role.
- IMPLEMENTED IN SOURCE: RLS enabled, service_role SELECT/INSERT only, UPDATE/DELETE/TRUNCATE revoked and append-only triggers installed.
- Added six source-contract tests in `backend/tests/audit-log-migration-contract.test.js`. Static integration audit passed 13/13 assertions.
- NOT VERIFIED: Node test suite, build and full numbered PostgreSQL migration chain. No production DB writes, migration application, financial flag changes, merge or deployment.
