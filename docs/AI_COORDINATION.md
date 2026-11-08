# BTCBOX AI Coordination — Single Source of Truth

Last verified: 2026-11-08
Repository: `avali9308-code/btcboxcdt`

## 1. Operating rule

This file is the **only active coordination and task-status document**. Do not create parallel task lists, duplicate AI workstreams, or restart completed tasks from older notes. Historical evidence is retained in `docs/archive/AI_COORDINATION_HISTORY_2026-11-08.md`; it is reference-only and must not be treated as a live task queue.

One repository execution path is active at a time. Re-read this file before starting a batch and update this file only when the active state or verified evidence changes.

## 2. Current integration candidate

- **Active candidate:** PR #67
- **Branch:** `integration/btcbox-mainline-consolidation-20261108`
- **Current candidate head:** `1594084189befe103c978b2d7ce6dc65eaf5a451`
- **Base:** `main` at `2a3810da1aef2c0c7c58df0cfdb059a212eeb0d6`
- **State:** Draft / open / not merged
- **Exact-current-head CI:** PASS on `1594084189befe103c978b2d7ce6dc65eaf5a451`.
  - Backend: `42449102047` — PASS.
  - PostgreSQL schema: `42449102051` — PASS.
  - Frontend: `42449102014` — PASS; lint/build, Chromium setup, desktop/mobile route smoke tests, and responsive screenshot artifact upload completed successfully.

The previous fully green source head `8b54cf128ccd4861eedd1fae602846c92849f835` also passed Backend `42436694163`, PostgreSQL schema `42436693919`, and Frontend `42436694030`. Current head adds a documentation-only correction to the owner bootstrap guide; the full exact-head CI has now passed.

Final-review corrections now included:
- Removed two out-of-scope production inventory/readiness SQL diagnostics and aligned the SQL guide with the empty-database direction.
- Corrected the market E2E timestamp fixture and Earn route selector.
- Fixed first-request initialization for an empty `btcbox_state` table through the revision-0 atomic CAS RPC; concurrent first requests re-read the winner, while malformed schema/RPC failures remain fail-closed.
- Cleared stale spot candles when periodic chart refresh fails; the chart no longer presents the last old snapshot as current.
- Corrected the mobile topbar wordmark clipping at narrow widths.
- Made Trade Hub Spot, Seconds and Earn states reflect backend market, execution, policy and catalog availability; retained the explicitly unavailable Futures card.
- Preserved the locked spot trading-page layout.

Human visual review covered representative 390px mobile and 1440px desktop screenshots, including home, markets, spot trade and Trade Hub. The responsive artifact is retained by CI for seven days. Hosted authenticated staging remains NOT VERIFIED.

## 3. A2 disposition — absorbed, not a separate active lane

A2 branch `work/ai2-integration-batch-20261107` was checked at `d8460345e1ecb00777fa317120b0e24e0d07fbf0`.

**Disposition: A2's verified code and regression coverage are already present in PR #67. Do not cherry-pick or merge A2 again.**

Verified overlap in PR #67 includes:
- Public market provider timestamp/source/age provenance and its regression test.
- Admin tab-load request sequencing so stale responses cannot overwrite a newer tab/search result, with regression coverage.
- Registration and signed-out market-preview responsive viewport coverage.
- KYC secure-document-preview fail-closed approval assertion.
- Backend CI trigger/test isolation corrections and their related tests.

A2's earlier exact-head CI evidence:
- Frontend `42357960746`: 68/68 desktop/mobile Playwright tests passed.
- Backend `42357960745`: passed.

PR #67 supersedes the A2 branch versions where later integration changes exist. Preserve PR #67's newer fail-closed market behavior, clickable market navigation, and merged admin logic; never replace whole files with older A2 copies.

## 4. Other open branches — reference only, not parallel execution

- PR #65: visual/accessibility/error-safety work; Draft/open against the older unified branch. Its changes have been selectively incorporated into PR #67. Do not merge PR #65 independently.
- PR #66: market/admin follow-up against the older unified branch. Its overlapping changes have been reviewed against PR #67. Do not merge independently.
- Older duplicate/overlapping PRs (#42, #44, #45, #19) are not active work queues. Do not revive them or merge them independently.

PR #67 is the sole integration candidate. New fixes discovered during final review must be applied to this candidate, not developed on another parallel integration branch.

## 5. Remaining active work — one ordered queue

1. PR #67 source consolidation and automated regression work for the current batch is complete at the verified head above. Do not restart the completed fixes or alter the locked trading-page layout.
2. Hosted Supabase configuration, actual empty-project bootstrap, Email/Google authenticated staging, and live market-catalog configuration remain NOT VERIFIED because no authorized hosted staging credentials/environment were supplied. The CI preflight is configuration-shape validation only.
3. Financial cutover flags remain explicitly disabled. Real spot orders, Seconds positions, Earn subscriptions/redemptions, deposits, withdrawals and settlement must remain unavailable until the hosted schema and transaction paths are independently verified and explicitly approved.
4. Keep PR #67 Draft until hosted staging verification is available and the owner authorizes any release action.

No new A2 work is pending. Do not open another visual redesign batch or rerun already-green exact-head CI without a reproduced defect.

## 5A. Hosted Supabase read-only verification — 2026-11-08

Authorized Supabase management/read-only SQL access is now connected for project `zlozsutefnmgwwzrlipt` (US East 1, PostgreSQL 17). This is management/read-only verification only; no hosted database writes, DDL, Auth changes, or financial operations were performed.

Observed live state:
- `auth.users`: 0 rows.
- `public.btcbox_state`: 1 singleton row, revision 29; its JSON state contains 3 legacy `users` entries and 3 `sessions` entries. This is distinct from Supabase Auth users. Do not disclose or inspect individual records, and do not delete/reset them without separate approval.
- Financial accounts, operations, ledger, spot orders, Seconds positions, deposits, and withdrawals: 0 rows.
- Earn catalog: 7 active products.
- Enabled matching markets: 0.
- Two private test-backup tables remain: one state backup row and three Auth-test-user backup rows.
- Supabase migration registry currently lists only two migration records; Edge Functions list is empty.

Hosted schema does NOT currently match the canonical 26-file fresh-schema source inventory in this PR:
- Missing tables include `private.admin_permission_catalog`, `private.admin_memberships`, `private.admin_permission_events`, `private.admin_security_audit`, `private.admin_request_idempotency`, `private.seconds_policy_request_idempotency`, `public.seconds_contract_policies`, `public.seconds_contract_policy_active`, `public.seconds_contract_policy_audit`, and `public.financial_matching_cancel_requests`.
- Missing functions include `private.bootstrap_super_admin_v1`, public admin membership wrappers, `public.admin_set_seconds_policy_v1`, and `public.admin_list_seconds_open_positions_v1`.
- Existing matching-engine submit/cancel RPCs are present, but the missing policy/admin schema means the current hosted project cannot satisfy the full PR #67 backend contract.
- Do NOT run the canonical empty-database bootstrap against this project: it is not empty. Validate the full SQL inventory on disposable PostgreSQL / isolated staging first, then plan a separately approved hosted installation.

Security observations:
- Supabase Security Advisor reports 14 public tables with RLS enabled but no policies. Direct privilege inspection found no table grants to `anon` or `authenticated`; service-role-only table grants were observed on the public financial tables.
- The two private backup tables have RLS disabled. Direct inspection found no `private` schema USAGE for `anon`, `authenticated`, or `service_role`, and no table grants to browser roles. The advisor warning must still be tracked; do not assume exposure from the advisor text alone or auto-apply changes.
- If the owner elects to enable RLS on the backup tables, the advisor-provided SQL is:
  `ALTER TABLE private.btcbox_state_pre_test_cleanup_backup ENABLE ROW LEVEL SECURITY;`
  `ALTER TABLE private.btcbox_auth_test_users_backup ENABLE ROW LEVEL SECURITY;`
  Enabling RLS without policies blocks access; do not execute automatically.
- Performance Advisor reports five unindexed foreign keys; review against query paths before adding indexes. No index changes have been made.

Authentication and release verification:
- Current PR #67 frontend source exposes Email and Google auth flows; Supabase project has active publishable/anon keys. The management connector does not expose the Auth provider toggle / Google OAuth client configuration, so actual Email/Google provider enablement, redirect URLs, and a real authenticated staging login remain NOT VERIFIED.
- No Supabase Auth log source was present in the last-24-hour unified-log source summary; this is not proof that providers are disabled.
- Hosted runtime environment variables and financial cutover flags were not inspected. CI/preflight evidence only confirms the PR's test configuration with financial flags explicitly disabled.
- The PR's Super Admin bootstrap doc is owner-controlled and requires an existing Auth UUID. Do not run it; there is currently no Auth user and the required private RBAC schema/function is absent.
- Current hosted market state has zero enabled Spot markets; Earn catalog has seven active rows, but Seconds policy schema is absent. Do not advertise real execution as available.


Further RPC/source cross-checks against the hosted project:
- The live `public.submit_seconds_order_v1` definition does not reference the versioned Seconds policy tables, and `public.seconds_contract_positions` still has the legacy fixed-duration CHECK constraint `duration_sec = ANY (ARRAY[30,60,300,900])`. This differs from canonical SQL `0025`/`0031`; policy-versioned Seconds execution is NOT VERIFIED.
- The live `public.cancel_limit_order_matching_v1` accepts `p_client_cancel_id` but does not use the canonical `financial_matching_cancel_requests` table. The expected table is absent; the current function uses a derived `financial_operations.idempotency_key`, which does not implement the full canonical request-hash replay contract.
- The live project still contains legacy `public.execute_spot_trade_atomic` (service_role EXECUTE only; no anon/authenticated EXECUTE). Current PR backend source does not reference this direct-fill RPC; the canonical SQL inventory intentionally removed it. Do not invoke or delete it during read-only review. Keep all financial cutover flags disabled.
- Current backend source gates financial writes/matching on exact `'1'` values for the required flags plus Supabase storage configuration. Hosted runtime flag values were not inspected, so live state remains NOT VERIFIED.
- Supabase development branch listing is empty; no existing hosted staging branch is available. Do not create a paid branch or new project without explicit owner approval.

Repeatable diagnostic and documentation correction — 2026-11-08:
- Added `backend/supabase/diagnostics/hosted-schema-contract-readonly.sql` to PR #67. It contains SELECT-only object-existence, aggregate state-count, and private-backup RLS/grant checks; no INSERT/UPDATE/DELETE/DDL statements.
- Executed each diagnostic query against hosted project `zlozsutefnmgwwzrlipt`. It reproduced the missing admin/Seconds/cancel-idempotency objects, confirmed the three expected Spot RPCs are present, and returned the same aggregate state counts without reading individual user/session records.
- Corrected `backend/supabase/sql/MIGRATION-ORDER-AND-CUTOVER.md`: the product/schema target remains fresh with no customer accounts, but the connected hosted project is non-empty and explicitly ineligible for the fresh bootstrap.
- Corrected this coordination document's release boundary to distinguish fresh-schema design from the actual hosted database. No hosted DDL or data writes were made.
- Current PR #67 head after diagnostic/docs additions: `da4125424270ab5231a363a5627487ee3db5253b`. Backend CI `42450389952` passed; PostgreSQL schema CI `42450389963` and Frontend CI `42450389966` were still running at last check.

RPC security/legacy-contract diagnostic — 2026-11-08:
- Extended the read-only SQL diagnostic to report RPC signatures, SECURITY DEFINER state, function settings, and EXECUTE grants, plus the live Seconds duration constraint.
- Executed those checks on hosted Supabase. The three existing Spot/Seconds RPCs are SECURITY INVOKER, use an empty `search_path`, and grant EXECUTE only to `service_role`; anon/authenticated EXECUTE is false. The legacy direct-fill `execute_spot_trade_atomic` RPC is also service-role-only and remains unused by current PR backend source.
- The live Seconds position table still enforces `duration_sec = ANY (ARRAY[30,60,300,900])`, confirming that source SQL `0031` has not been applied to the hosted database. No hosted writes were performed.
- Diagnostic extension commit on PR #67: `724d871c9f9f5e3a4df0ce2b7ea78e46164f7082`. Backend, PostgreSQL and Frontend CI started for this exact head; results pending at last check.

This read-only verification supersedes the earlier statement that no Supabase management access was available. It does NOT change the no-hosted-writes/no-merge/no-production-deploy boundary.

## 6. Release and safety boundary

- Do not merge to `main`, trigger a production deployment, or resume automatic production deployment without the owner's explicit approval.
- Vercel automatically completed the current PR preview deployment; it is a preview only, not a production release. Do not use preview success as visual acceptance.
- Do not write to hosted/production Supabase, reset databases, or run destructive SQL.
- Do not perform real deposits, withdrawals, trades, settlement, KYC decisions, or financial ledger writes.
- The product/schema design target is a fresh database with no customer accounts; do not spend time on legacy-user migration. This does NOT mean the connected hosted Supabase project is empty: read-only inspection found a state singleton at revision 29 (three legacy state users and three sessions), seven active Earn catalog rows, and two private test-backup tables. Supabase Auth has zero users. Do not bootstrap, reset, or clear the hosted project on the assumption that it is empty.
- Preserve the locked trading-page layout and all existing API, authentication, permission, and financial contracts.
- Mark evidence accurately: SOURCE OBSERVED, REPRODUCED, TEST PASSED, or NOT VERIFIED. Never describe automated route tests as independent visual QA.

## 7. Completion rule

A task is complete only when its code is in PR #67, exact-head tests pass, and any required independent verification is recorded. Once absorbed, mark the source branch as historical and do not repeat its task list.

---
Historical coordination notes were moved unchanged to `docs/archive/AI_COORDINATION_HISTORY_2026-11-08.md`. They are retained for traceability only; this file overrides all older task/status statements.


Exact-head CI completion — 2026-11-08:
- Rechecked all three workflow runs for PR #67 head `724d871c9f9f5e3a4df0ce2b7ea78e46164f7082`.
- Backend CI `42450472668`: completed / success.
- PostgreSQL schema CI `42450472665`: completed / success.
- Frontend CI `42450472705`: completed / success; the `build` job completed successfully with no failed steps.
- These are exact-head automated CI results only. They do not validate hosted Auth provider settings, hosted schema parity, production flags, live financial execution, or independent visual acceptance.
- PR #67 remains a draft integration candidate. No merge, production deployment, hosted database write, or trading-page layout change was performed.


API-to-SQL source contract cross-check — 2026-11-08:
- Inspected `backend/api-core.js` against source SQL `0026_admin_rbac_private_store_v1.sql`, `0028_admin_rbac_service_rpc_wrappers_v1.sql`, `0025_seconds_policy_versioning_v1.sql`, `0031_seconds_policy_duration_alignment_v1.sql`, and `0008_financial_matching_engine_v1.sql` on the integration branch.
- Admin membership API computes a SHA-256 request hash from the normalized target user, expected revision, action, sorted permission snapshot, and reason, then forwards the same request ID/hash to `admin_manage_membership_v1`; SQL persists the pair under `(actor_user_id, request_id)` and rejects a same-key/different-hash replay.
- Seconds policy API normalizes/sorts symbols and durations and hashes the expected version, policy values, limits, and reason before calling `admin_set_seconds_policy_v1`; SQL uses the actor/request ID pair for replay and rejects hash mismatch.
- Seconds order API supplies a deterministic request ID, request hash, and positive reference price to `submit_seconds_order_v1`; the canonical SQL performs replay lookup before requiring a current reference price, then resolves the active immutable policy for new orders.
- Spot cancel API forwards `client_cancel_id`; canonical SQL `0008` persists cancellation identity in `financial_matching_cancel_requests` keyed by `(user_id, client_cancel_id)`, checks order ID and request hash on replay, and returns the stored response for an exact retry. The live hosted function still lacks this canonical table, as already recorded above.
- This was a source inspection only. It does not close hosted schema drift or prove live RPC behavior. No code or hosted database was changed in this cross-check.
- The exact-head CI results recorded above remain the latest verified results for PR #67 SHA `724d871c9f9f5e3a4df0ce2b7ea78e46164f7082`.
