# BTCBOX backend launch-readiness audit — 2026-11-04

## Scope and evidence
Read-only review of the restored BTCBOX backend source, the current `btcboxcdt` Vercel project configuration/deployments, and the connected Supabase project. No production API was invoked, no financial operation was submitted, no SQL was changed or applied, and no Vercel setting/environment variable was modified.

- Repository: `avali9308-code/btcboxcdt`
- Audited main SHA: `0b68853eac5c4655db1112b30a7489fd16154c4c`
- Backend source: `backend/`
- Vercel project: `btcboxcdt`, latest production deployment `dpl_B34KdrkjN4pj8xfCmCzC2pXN1P2D`
- Supabase project: `zlozsutefnmgwwzrlipt`

## P0 — Production financial feature flags are all enabled
The four Production environment values were read individually (no secrets were read):
- `FINANCIAL_POSTGRES_RPC_ENABLED=1`
- `FINANCIAL_POSTGRES_FULL_CUTOVER_APPROVED=1`
- `FINANCIAL_POSTGRES_READS_ENABLED=1`
- `FINANCIAL_MATCHING_ENGINE_ENABLED=1`

This conflicts with `backend/.env.example`, `backend/scripts/deployment-preflight.js`, and the backend deployment guide, all of which require the flags to be explicitly `0` until staging migrations, reconciliation, idempotency, precision, and end-to-end acceptance are complete. The current Preflight would fail against these Production values. The server-side Supabase credential is configured in Production; therefore the flags are not merely inert placeholders if the backend is deployed with the current code.

**Required:** disable all four Production flags before exposing the restored backend to real traffic, then keep them disabled until a separately approved full-cutover acceptance. This audit did not change them.

## P0 — Current Vercel production deployment is failing before the backend is served
Latest Production deployment for `btcboxcdt` is `ERROR` at SHA `0b68853eac5c4655db1112b30a7489fd16154c4c`, with `STATIC_BUILD_NO_OUT_DIR`: Vercel ran the root React template (`react-scripts build`, output `build/`) while the project expected `dist/`. Build logs show entrypoint `.`. The backend's own Vercel config and build script are under `backend/`.

**Required:** set the Vercel project's Root Directory to `backend` (and confirm the resulting Build Command is `npm run build && npm test`, Output Directory `dist`, Node 22). Do not point the project at the unrelated root React template. No Vercel setting was changed in this audit.

## P1 — Withdrawal creation RPC contract does not match the live database
The backend route sends `p_require_admin_review` as a tenth named argument to `create_withdrawal_atomic` (`backend/api-core.js`). The live Supabase function currently has only nine arguments and uses numeric `p_amount`/`p_fee`; it has no `p_require_admin_review` argument. The live database has `public.withdrawal_requests` and does not have `public.withdrawals`.

The repository migration `0022_withdrawal_admin_review_status_v1.sql` creates a different overload with text amount/fee parameters and a boolean, but its body reads/writes the nonexistent `public.withdrawals` table. It does not alter the actual `withdrawal_requests` status constraint. Applying this file will not correctly upgrade the live withdrawal RPC and can leave PostgREST overload resolution ambiguous or failing.

**Required:** do not apply migration 0022. Reconcile the function signature and status transition against the actual `withdrawal_requests` schema in staging, then replace this migration with a reviewed, idempotent migration.

## P1 — Admin audit migration is incompatible with the live audit table
The live `public.financial_audit_log` columns are `id, actor_id, subject_user_id, action, object_type, object_id, reason, metadata, created_at`. Migration `0021_admin_audit_log_append_only_v1.sql` assumes columns `uid, by, detail, meta`, creates an index on `uid`, and inserts into those absent columns. The live database also has no `append_admin_audit_log` RPC. The current Node admin code calls that RPC fire-and-forget and only logs a warning on failure, falling back to the mutable `btcbox_state` JSON audit list.

**Required:** rewrite migration 0021 for the actual schema (or explicitly migrate the table shape), create and privilege the append-only RPC, and make the admin operation report/monitor durable audit failures. Do not apply the current 0021 file to the live schema.

## P1 — Withdrawal approval is not an on-chain completion
The admin API response itself says approval has deducted the frozen amount but has not broadcast to the chain. The reviewed database/admin read contract has no evidenced broadcaster claim, txid persistence, retry state, confirmation tracking, or terminal completion transition. The admin withdrawal snapshot returns pending rows only, so an approved item can disappear from the pending queue.

**Required:** block real withdrawals until a durable outbox/broadcaster lifecycle and reconciliation are implemented and tested. Admin approval must not be presented as a completed transfer.

## P1 — Deposit administration has no complete pending-order workflow
The backend README states that the user-facing deposit route returns address details but does not create a pending deposit order. The admin manual-credit route is gated behind the full financial cutover. Therefore the restored admin interface's pending-deposit review/credit path is not proven end-to-end.

**Required:** implement and test a trusted deposit-observation/pending-record flow, idempotent confirmation, ledger credit, and user history before enabling deposit crediting.

## P1 — Supabase migration history and source migrations are out of sync
Supabase migration history currently lists only two versions, while the restored source contains 22 numbered migration files. The live database does contain several financial tables and RPCs, so this is not proof that the schema is empty; it is proof that the repository migration history does not provide a reliable, auditable mapping of the current live schema to the restored migration set. Live function signatures also differ from the source's migration 0022 contract.

**Required:** produce a schema/function inventory and reconcile migration history in a staging clone before applying any numbered migration to Production. Do not run the historical `supabase-migration-runner.sql`; it is a stale concatenated script.

## P1 — No active CI workflow currently runs the backend tests
The existing workflow is stored at `backend/.github/workflows/baseline.yml`, but GitHub only discovers workflows under repository-root `.github/workflows/`. The audited main commit has no associated workflow runs. This means the restored backend's build/tests are not currently enforced by GitHub Actions.

**Action in this branch:** add a root-level backend CI workflow that runs `npm ci`, `npm test`, `npm run build`, and a dummy-credential Preflight shape check without using Production secrets.

## P1 — Preview environment is not provisioned for backend acceptance
The `btcboxcdt` Vercel project has backend/Supabase/admin environment variables configured for Production, but not for Preview. Preview currently lacks the corresponding Supabase URL/service credential, Auth public config, admin credentials, deposit-address settings, and financial flags. Therefore a backend Preview cannot be treated as a valid staging environment. Production credentials must not be copied into Preview; configure a dedicated staging Supabase project and dedicated test admin credentials.

## P2 — Supabase advisor findings
- 14 public tables have RLS enabled and no policies. Current table grants show no `anon` or `authenticated` table privileges for the reviewed financial/state tables; access appears service-role-only, so the advisor's INFO finding is not by itself evidence of public table access. Preserve that privilege boundary.
- Supabase Auth leaked-password protection is disabled (WARN).
- Five foreign keys lack covering indexes (performance INFO); review after realistic staging load rather than blindly adding indexes.
- Eight indexes are currently unused (performance INFO); this may reflect low/no traffic and is not a launch blocker by itself.

## Additional known risk
The existing account read path and frontend use JavaScript `Number` for high-precision financial balances. The earlier business review documents possible rounding for PostgreSQL `numeric(38,18)`. Keep this as a P1 financial correctness item before enabling real balances/trading.

## What this audit changed
- Added a root-level backend CI workflow in this branch.
- Marked the stale combined Supabase migration runner as archived/do-not-execute.
- Added the Vercel Root Directory requirement to the deployment guide.
- No runtime API, financial logic, database, production env vars, Vercel settings, or production deployment was changed.

## Validation status
The local container could not resolve GitHub for a clone. GitHub Actions run #1 (`41836188117`) successfully completed `npm ci`, `npm test`, `npm run build`, and the dummy-credential Preflight. Its final artifact assertion failed because the workflow incorrectly expected Vercel function source files to be copied into the static `dist/` directory; Vercel functions remain under `backend/api/`. The workflow assertion has been corrected to check API source files separately from static output; rerun is pending. The latest Production deployment is confirmed `ERROR`; no successful backend Preview or browser acceptance is claimed.
