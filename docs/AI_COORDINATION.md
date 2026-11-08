# BTCBOX AI Coordination — Single Source of Truth

Last verified: 2026-11-08
Repository: `avali9308-code/btcboxcdt`

## 1. Operating rule

This file is the **only active coordination and task-status document**. Do not create parallel task lists, duplicate AI workstreams, or restart completed tasks from older notes. Historical evidence is retained in `docs/archive/AI_COORDINATION_HISTORY_2026-11-08.md`; it is reference-only and must not be treated as a live task queue.

One repository execution path is active at a time. Re-read this file before starting a batch and update this file only when the active state or verified evidence changes.

## 2. Current integration candidate

- **Active candidate:** PR #67
- **Branch:** `integration/btcbox-mainline-consolidation-20261108`
- **Current candidate head:** `3d7f96352b214b386be410ab619b043898fef6c2`
- **Base:** `main` at `2a3810da1aef2c0c7c58df0cfdb059a212eeb0d6`
- **State:** Draft / open / not merged
- **Exact-current-head CI:** PASS on `3d7f96352b214b386be410ab619b043898fef6c2`.
  - Backend: `42456223737` — PASS.
  - PostgreSQL schema: `42456223768` — PASS.
  - Frontend: `42456223776` — PASS; responsive screenshot artifact `13607642852` was downloaded and inspected.
  - Earlier CI runs on `54d9b552...`, `df6cf43...`, and `1594084...` are historical and are not current-head evidence.

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
- Missing functions include `private.bootstrap_super_admin_v1`, public admin membership wrappers, `public.admin_set_seconds_policy_v1`, and `public.admin_read_seconds_open_positions_v1`.
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


Coordination document correction — 2026-11-08:
- Updated the top-level candidate SHA and exact-head CI block to `724d871c9f9f5e3a4df0ce2b7ea78e46164f7082` and its three passing workflow runs. The older `159408...` evidence remains historical only.
- A source inspection found that `backend/tests/rpc-source-contract.test.js` lacked parameter/signature parity and request-hash normalization assertions for admin membership, Seconds policy, Seconds order, and matching cancellation. This coverage gap was resolved in commit `df6cf43d28194911a4dbebcdcdb1989c9ccf6ded`; exact-head Backend, PostgreSQL schema, and Frontend CI all passed. This was a test-coverage improvement, not a confirmed runtime defect.


RPC source-contract regression coverage — 2026-11-08:
- Added regression tests in `backend/tests/rpc-source-contract.test.js` for Admin membership wrapper parameter parity, normalized permission ordering and private request-hash replay; Seconds order RPC parameter parity and request-hash replay ordering; Seconds policy canonical sorting/hash construction; and Spot cancellation request identity, order binding, mismatch rejection, and exact replay response.
- Two test-only assertion corrections were made after CI exposed overly broad SQL-file search scope and an incorrect matcher for the PL/pgSQL `SELECT p.* INTO v_policy` form. No backend business implementation or hosted database was changed.
- Final test-source commit: `df6cf43d28194911a4dbebcdcdb1989c9ccf6ded`.
- Exact-head Backend CI `42453532346`, PostgreSQL schema CI `42453532347`, and Frontend CI `42453532383` all completed successfully.
- PR #67 remains Draft / open / not merged. The owner's merge authorization is noted, but the documented release gate remains unmet: hosted schema reconciliation and authenticated Email/Google staging verification are NOT VERIFIED. Do not merge until those prerequisites are completed or the owner explicitly revises the release gate after reviewing the risk.


Hosted schema diagnostic coverage correction — 2026-11-08:
- Source inspection found the documented Seconds administrator queue function name was wrong: canonical SQL `0030_seconds_admin_open_positions_read_v1.sql` and `backend/api-core.js` both use `admin_read_seconds_open_positions_v1`, not `admin_list_seconds_open_positions_v1`.
- Expanded `backend/supabase/diagnostics/hosted-schema-contract-readonly.sql` in PR #67 commit `54d9b552a83eccfabc9fdf4a155ac9f2e072caae` to check the private RBAC helper functions, private Seconds/Spot transition functions, public Seconds queue and Spot admin/read wrappers, and `private.spot_market_request_idempotency`.
- The added Spot market idempotency table and wrapper functions were absent from the earlier diagnostic inventory. The expanded diagnostic was subsequently executed against hosted Supabase; see the later “Expanded hosted schema diagnostic execution” record below.
- PR #67 head is now `54d9b552a83eccfabc9fdf4a155ac9f2e072caae`. No GitHub Actions workflow runs were returned for this exact commit at the time of this update; the combined commit status only reports the Vercel check as failure due to its build-rate-limit target. Per owner instruction, Vercel is not part of this work. Do not carry forward the previous exact-head CI PASS as evidence for this newer commit.
- No hosted SQL was executed, no DDL/data/Auth changes were made, and PR #67 remains Draft / unmerged.


Expanded hosted schema diagnostic execution — 2026-11-08:
- Executed the expanded SELECT-only diagnostic from PR #67 commit `54d9b552a83eccfabc9fdf4a155ac9f2e072caae` against hosted Supabase project `zlozsutefnmgwwzrlipt`. No DDL, DML, Auth changes, or financial operations were performed.
- Confirmed all previously identified private admin RBAC tables, Seconds policy tables, `financial_matching_cancel_requests`, and the newly added `private.spot_market_request_idempotency` table are MISSING.
- Confirmed private admin helpers and transition functions are MISSING: `admin_get_membership_v1`, `admin_list_memberships_v1`, `admin_manage_membership_v1`, `bootstrap_super_admin_v1`, `admin_set_seconds_policy_v1`, `admin_read_seconds_open_positions_v1`, and `admin_set_spot_market_v1`.
- Confirmed public admin wrappers/read functions are MISSING: `admin_get_membership_v1`, `admin_list_memberships_v1`, `admin_manage_membership_v1`, `admin_set_seconds_policy_v1`, `admin_read_seconds_open_positions_v1`, `admin_set_spot_market_v1`, and `read_spot_market_snapshot_v1`. The prior diagnostic's `admin_list_seconds_open_positions_v1` label was corrected to the actual API/SQL function name `admin_read_seconds_open_positions_v1`.
- Existing public `submit_limit_order_matching_v1`, `cancel_limit_order_matching_v1`, and `submit_seconds_order_v1` remain PRESENT. Their observed security mode is SECURITY INVOKER, empty search_path, EXECUTE only for service_role; anon/authenticated EXECUTE remains false. Legacy `execute_spot_trade_atomic` remains service-role-only and is not used by current PR backend source.
- Aggregate state was unchanged: Auth users 0; state singleton 1 row at revision 29; active Earn products 7; enabled Spot markets 0; backup tables contain 3 Auth-test backup rows and 1 state backup row. Both private backup tables still have RLS disabled, but no private schema USAGE or SELECT grants for anon/authenticated were found.
- The legacy Seconds duration CHECK remains `duration_sec = ANY (ARRAY[30,60,300,900])`.
- PR #67 candidate head remains `54d9b552a83eccfabc9fdf4a155ac9f2e072caae`. The GitHub Actions workflow-run lookup returned no PR-triggered runs for this exact commit; combined commit status only surfaced the Vercel build-rate-limit failure. Vercel is explicitly out of scope. The previous CI PASS at `df6cf43...` is historical and must not be attributed to this newer head.
- This diagnostic confirms more hosted contract drift; it does not provide a safe upgrade path. The existing hosted project remains non-empty and the canonical scripts remain fresh-database bootstrap files, not incremental migrations. Do not apply them to hosted production.


PR metadata and staging-environment status — 2026-11-08:
- Updated PR #67 description to identify current head `54d9b552a83eccfabc9fdf4a155ac9f2e072caae`, distinguish historical CI PASS evidence at `df6cf43...`, and record current-head CI as NOT VERIFIED. PR remains Draft/open/unmerged.
- The PR description now includes the expanded hosted schema drift evidence and explicitly retains the no-bootstrap/no-production-write gate.
- Supabase development branch inventory for hosted project `zlozsutefnmgwwzrlipt` currently returns no branches. No independent Supabase staging project/branch was identified in this check. Do not create a branch/project without first establishing its cost and owner approval.
- The available GitHub integration exposes workflow-run inspection but no workflow-dispatch action. Current head has no returned GitHub Actions PR workflow runs; do not claim current-head CI passed. A repository owner may need to dispatch the applicable Backend, PostgreSQL schema, and Frontend workflows manually, or authorize another CI trigger path.
- Next safe prerequisite: establish a separately isolated staging database/project and confirm its cost/ownership before applying the 26-file canonical fresh-schema bootstrap there. Do not use the connected non-empty hosted project as that target.



Exact-current-head CI re-verification — 2026-11-08:
- Fetched PR #67 metadata directly: head branch `integration/btcbox-mainline-consolidation-20261108`, head SHA `54d9b552a83eccfabc9fdf4a155ac9f2e072caae`, base `main` at `2a3810da1aef2c0c7c58df0cfdb059a212eeb0d6`; PR is open, Draft, not merged, mergeable.
- Fetched workflow runs associated with exact head `54d9b552a83eccfabc9fdf4a155ac9f2e072caae`: Backend `42453956475`, PostgreSQL schema `42453956455`, Frontend `42453956535`; all completed successfully.
- Inspected job steps: backend build/tests/preflight/output verification all passed; canonical SQL applied successfully to disposable PostgreSQL; frontend lint/build/Chromium desktop+mobile route smoke tests/responsive screenshot upload all passed.
- This closes the current-head automated CI gap. It does not close hosted schema drift, isolated hosted staging, actual Email/Google provider and OAuth redirect verification, or live market configuration.
- PR description was stale and stated that no current-head GitHub Actions runs existed; it is being corrected to match these exact-head results. PR remains Draft and unmerged. No production deployment or hosted Supabase writes were performed.

## Visual acceptance correction — 2026-11-08

The owner rejected the previously surfaced CI screenshot artifact as not representing the intended current BTCBOX appearance. Reinspection against the approved Strata Pro + shadcn-fintech direction found a concrete regression in the integration candidate: `frontend/src/index.css` had flattened all route accents to neutral gray, and `PageFrame` in `frontend/src/features/pages/Pages.tsx` no longer applied page-tone classes at all. This contradicted the earlier visual baseline in PR #65, which used restrained semantic accents over shared dark surfaces.

Applied a selective visual-only correction to the sole candidate branch (no trading layout, API, auth, data, or financial behavior changes):
- Restored the semantic route accent tokens from PR #65: market cyan, trading violet, assets teal, orders blue, Earn amber, support indigo, admin purple.
- Added a dedicated account blue tone.
- Restored page-tone mapping and accent eyebrow treatment in `PageFrame` for Spot/Seconds, Earn, Assets, Orders, Support, Account/KYC, and market pages.
- Applied the market tone to the dashboard/markets root.
- Shared dark surfaces, restrained borders, and the locked Spot trading-page structure remain unchanged.

Commits on PR #67: `d8ac516cfbae19c56cb3447bac107dac0e1e8153` (tokens), `5b3faa3fbca8748845d8335ff6fa19208e9f5da7` (page tone mapping), `3d7f96352b214b386be410ab619b043898fef6c2` (dashboard market tone). Verified all three changes are present on the current candidate head `3d7f96352b214b386be410ab619b043898fef6c2`.

Exact-head CI is running: Backend `42456223737`, PostgreSQL schema `42456223768`, Frontend `42456223776`. Do not mark the visual correction accepted until the exact-head frontend CI completes and a fresh responsive screenshot artifact is inspected. PR #67 remains Draft / unmerged; no deployment or hosted Supabase writes were performed.

Visual correction CI refresh — 2026-11-08:
- Exact-head Backend CI `42456223737`: PASS.
- Exact-head PostgreSQL schema CI `42456223768`: PASS.
- Exact-head Frontend CI `42456223776`: install, lint, production build, and Chromium installation PASS; desktop/mobile route smoke tests were still running at this refresh. Responsive screenshot upload is pending.
- Current candidate head remains `3d7f96352b214b386be410ab619b043898fef6c2`. Do not mark visual acceptance complete until the frontend workflow passes and the new screenshot artifact is inspected.


Exact-head visual QA follow-through — 2026-11-08:
- Re-fetched PR #67 and confirmed current head `3d7f96352b214b386be410ab619b043898fef6c2`, Draft/open/unmerged.
- Exact-head workflows all completed successfully: Backend `42456223737`, PostgreSQL schema `42456223768`, Frontend `42456223776`.
- Downloaded responsive visual artifact `13607642852` from Frontend run `42456223776` (artifact SHA-256 reported by GitHub: `7316d0b676bdc1eecc814029df371b4dbe655e4ec6afc88055151e1de9fb21c5`). Inspected desktop 1440px and mobile 390px screenshots for home, markets, assets, orders, support, Trade Hub, and Spot.
- Verified page identity accents now render (market cyan, trading violet, assets teal, orders blue, support indigo); mobile route screenshots remain within viewport and the locked Spot page structure is preserved. This is screenshot inspection, not owner visual acceptance.
- Remaining visual gap: semantic color is still concentrated in page eyebrow/title accents and a few icon/status treatments; Assets and Orders content surfaces remain predominantly neutral. The Strata Pro dark surface system is present, but the full Shadcn Fintech semantic component treatment is not yet complete. Record this as a bounded Interaction Team follow-up; coordinator must not take over Interaction-owned component files. Next visual task should apply restrained page-accent surfaces to relevant summary cards, section markers, and empty states, without changing page geometry, trading layout, APIs, or financial behavior.
- No hosted Supabase writes, production deployment, Vercel changes, or merge were performed. PR #67 remains Draft.


## Owner direction correction — complete source-template migration is the active visual requirement (2026-11-08)

This section supersedes the earlier “bounded Interaction Team follow-up” at the end of this document that proposed only adding accent surfaces to summary cards, section markers, and empty states. That narrow task is NOT the owner's requested deliverable and must not be used as the active visual scope.

The owner has explicitly confirmed **three rounds of direction**, not one:
1. First approval: bring the complete Strata Pro and shadcn-fintech source experiences into BTCBOX rather than continuing piecemeal repairs to the old frontend.
2. Second approval: assemble those complete source experiences into a coherent new BTCBOX frontend that connects to BTCBOX's real backend, auth, APIs, and business logic; remove template demo/mock behavior.
3. Third follow-up (2026-11-07): use the source templates' own complete visual system across ALL remaining pages, including their full color/semantic system, typography, component treatments, interaction feedback, and responsive/mobile details—not merely borrow a palette or add isolated accent treatments.

Required intended scope:
- Strata Pro is the complete reference/source experience for trading and market-facing pages.
- shadcn-fintech is the complete reference/source experience for account, authentication, assets, security, settings, and other applicable workspace/admin surfaces.
- Port/adapt full page structures, navigation, reusable components, typography, surfaces, semantic colors, form states, feedback states, and responsive behavior. This is a source-template migration/adaptation, not a token-only redesign.
- Remove all template demo data, mock market data, seeded balances, simulated transactions, and template auth/business behavior. Connect real BTCBOX Supabase Auth, APIs, and business contracts.
- Preserve BTCBOX's existing backend/business rules and the locked Spot trading-page layout and its existing interfaces. Do not change that layout without explicit owner approval.
- Verify desktop/tablet/mobile behavior and meaningful loading/empty/error/success states. CI screenshots alone do not constitute owner visual acceptance.

Verified repository evidence at this correction:
- Branch `feat/btcbox-unified-template-migration-20261105` EXISTS. Its recursive Git tree is `6af0210b6b2716cf5d0310fa3b7384d33bf8e808` and contains `docs/COMPLETE_UI_TEMPLATE_SOURCES.md`, `docs/FRONTEND_TEMPLATE_MIGRATION.md`, `frontend/vendor/shadcn-fintech`, and `frontend/vendor/strata-pro`. This establishes that vendor paths exist on that branch; the contents, provenance/license terms, completeness, and actual integration status still need inspection before claiming the templates have been fully migrated.
- PR #65 is Draft/open on branch `fix/hide-lightweight-chart-attribution-20261107`, based on `work/btcbox-unified-20261104`, head `52615eead3b232be9ad37abe3e4b3a01ed264d80`. Its description describes visual-system reuse and responsive polish, and is not evidence that the complete template source experiences were integrated.
- PR #67 remains the sole integration candidate, Draft/open/unmerged, head `3d7f96352b214b386be410ab619b043898fef6c2`. Its latest recorded CI/screenshot inspection is technical verification only, not completion or owner visual acceptance of the three-round migration requirement.
- Earlier PR #65 visual commits, including baseline `9b9662bed509517dd9b89f8e288bebfc099661d7`, and subsequent selective absorption into PR #67 must be treated as partial historical work. Do not count them as full template migration.

Execution order (mandatory before further visual implementation):
1. Inspect and record the actual contents, git modes/submodule status, source provenance, and license notes for both vendor directories on `feat/btcbox-unified-template-migration-20261105`; read both migration/source docs.
2. Compare that branch against PR #67 and current frontend route/component inventory. Produce one page-by-page source-to-BTCBOX migration matrix that distinguishes PRESENT / PARTIAL / MISSING / BLOCKED, with exact paths and commits.
3. Identify which team owns each target file. The coordinator records gaps and routes implementation to the owning team; do not overwrite another team's files.
4. Continue implementation in the single active integration path only after the matrix and ownership are recorded. Do not create another parallel visual branch.
5. Remove demo/mock dependencies and wire BTCBOX real services while preserving backend contracts and locked trading layout.
6. Run exact-head lint/build/tests and responsive route screenshots; inspect screenshots against the actual source references. Mark owner visual acceptance as NOT VERIFIED until the owner has reviewed/accepted it.

Process guardrail: before every new batch, read this coordination file and the current candidate/branch metadata; after every batch, update this file with exact branch, SHA, paths, evidence, ownership, status, blockers, and next action. Never start implementation from conversational memory alone. Do not report a task complete based only on a prior PR description, a branch name, or a CI PASS.

No merge, production deployment, Vercel changes, hosted Supabase writes, financial operations, or locked Spot layout changes are authorized by this correction.


### Template-source audit — first evidence batch (2026-11-08)

Inspected both migration documents on `feat/btcbox-unified-template-migration-20261105` and the recursive Git tree:
- `frontend/vendor/strata-pro` is a Git submodule (mode `160000`), pinned to upstream `bymilon/strata-pro-crypto-ui` commit `a3f79d0237c68faddc877f8c1b00afece2fbbae8`, declared MIT.
- `frontend/vendor/shadcn-fintech` is a Git submodule (mode `160000`), pinned to upstream `abderrahimghazali/shadcn-fintech` commit `a905058c75a840896d27a16991f2e7cc1ca06f3f`, declared MIT.
- `docs/COMPLETE_UI_TEMPLATE_SOURCES.md` explicitly says the full upstream repositories are pinned as submodules and are NOT yet merged into the BTCBOX runtime.
- `docs/FRONTEND_TEMPLATE_MIGRATION.md` status is “migration branch initialized; source audit in progress.” It records the intended page map and says BTCBOX's current Vite/React app is the runtime target; Shadcn Fintech's Next.js routes/components must be ported, not imported as a second app.
- The vendor paths appearing in the recursive tree are gitlinks, not evidence that upstream source files have already been copied into or integrated with the BTCBOX runtime.
- These documents establish the pinned source identities and intended architecture, but do not yet establish page-by-page migration completion. The actual upstream submodule trees and current BTCBOX route/component implementations still require comparison.

Current interpretation: full source acquisition was prepared correctly as pinned MIT submodules, but the migration branch's own docs explicitly characterize runtime migration as not yet complete. Do not state that either full template has already been integrated. Next action is a page/component-level audit of both pinned upstream trees against the current PR #67 frontend, then a file-ownership-aware implementation matrix.


## Owner-approved execution order change — consolidate first, comprehensive audit second (2026-11-08)

The owner has clarified that the preferred sequence is to **integrate the existing work first, then perform one comprehensive end-to-end audit**, rather than repeatedly auditing and patching isolated batches. This supersedes the previous “audit both vendor trees and produce a matrix before any implementation” as the overall sequencing rule. A small amount of source/branch reconnaissance is allowed to prevent unsafe overwrites; the comprehensive page-by-page verification is deferred until the consolidation pass is assembled.

Consolidation target remains the existing sole candidate branch `integration/btcbox-mainline-consolidation-20261108` / PR #67. Do not create another parallel candidate. “Integrate first” means consolidate code into this candidate, NOT merge PR #67 into `main`, deploy, or write to hosted Supabase.

Initial branch comparison evidence (GitHub compare API, 2026-11-08):
- PR #65 head branch `fix/hide-lightweight-chart-attribution-20261107` vs PR #67: diverged; PR #65 side is 86 commits ahead and PR #67 side is 127 commits ahead of the common base. The comparison reports 26 changed frontend/README files on the PR #65-only side. Therefore do not merge PR #65 wholesale or replace whole files: it is based on an older unified branch and overlaps newer PR #67 business/auth changes. Its unique work must be selectively reconciled into the current candidate while preserving newer contracts.
- Template migration branch `feat/btcbox-unified-template-migration-20261105` vs PR #67: diverged; migration branch side is 24 commits ahead and PR #67 side is 1,329 commits ahead of the common base. The migration branch's unique diff includes `.gitmodules`, two vendor submodule gitlinks, source/migration docs, notices and some branding/build files. The two vendor paths are gitlinks pinned to upstream commits, not ordinary copied source directories.
- PR #67 remains the current candidate at `3d7f96352b214b386be410ab619b043898fef6c2`; it remains Draft/open/unmerged.

Consolidation sequence:
1. Freeze the current PR #67 head as the base of the consolidation batch and retain all exact SHA evidence.
2. Reconcile the unique PR #65 work into PR #67 selectively, file by file or logical change group. For overlapping files, preserve PR #67's newer API/auth/business/fail-closed logic and transplant only compatible visual/accessibility/mobile improvements. Do not merge the old PR branch wholesale.
3. Bring the pinned template source references and required notices/docs from the migration branch into the candidate. Preserve the two immutable upstream pins and license notices. Confirm submodule gitlinks resolve in a recursive checkout; do not mistake gitlinks for integrated runtime components.
4. Consolidate the prior completed A2 work and any other verified non-duplicate changes only if absent from PR #67. A2 is already documented as absorbed; no blind cherry-pick.
5. Once the candidate represents the consolidated code set, run ONE comprehensive audit across all routes/pages/components and backend/auth/API/data contracts, followed by one consolidated defect list and batch repair. Responsive checks must cover the documented widths, and screenshots must be compared against both source templates.
6. Run exact-head Backend, PostgreSQL schema, Frontend lint/build, desktop/mobile E2E and responsive screenshot checks on the final consolidated SHA. Record owner visual acceptance separately as NOT VERIFIED until the owner reviews it.

Safety/ownership:
- The GitHub connector exposes read/compare and Git object/ref primitives, but no safe native cherry-pick/merge-branch operation. Do not synthesize a broad merge tree or move the PR head without inspecting every affected path and preserving conflict-sensitive business logic. If a required operation cannot be performed safely with the available interface, report the precise blocker and use a repository workspace/authorized implementation agent rather than pretending integration happened.
- Continue using one candidate only. Do not merge PR #65 independently or close historical branches until all verified unique changes are accounted for.
- Preserve locked Spot layout, BTCBOX backend/auth/business contracts, no demo data, no production deployment, no hosted Supabase writes, no Vercel changes, and no real financial operations.


### First consolidation commit — source inputs added to sole candidate (2026-11-08)

- PR #67 candidate branch advanced from `3d7f96352b214b386be410ab619b043898fef6c2` to `a15cc242001eeaf9cc2d8e47cd54cd4e888619fd`.
- Commit `a15cc242001eeaf9cc2d8e47cd54cd4e888619fd` adds `.gitmodules`, both pinned template submodule gitlinks, `docs/COMPLETE_UI_TEMPLATE_SOURCES.md`, `docs/FRONTEND_TEMPLATE_MIGRATION.md`, and the existing Lightweight Charts notices. The submodule pins are Strata Pro `a3f79d0237c68faddc877f8c1b00afece2fbbae8` and shadcn-fintech `a905058c75a840896d27a16991f2e7cc1ca06f3f`.
- This is a source-input consolidation step only. It makes both immutable upstream source references available from the integration candidate and records the migration contract; it does NOT port their pages/components into BTCBOX runtime and does NOT count as full template migration.
- PR #67 is still Draft/open/unmerged. No production deployment, Vercel change, hosted Supabase write, financial operation, or locked Spot layout change occurred.
- Next consolidation work: selectively reconcile PR #65's unique compatible visual/accessibility/mobile changes into current PR #67 without overwriting newer business/auth logic. Then complete runtime template porting and BTCBOX real-service wiring. Comprehensive end-to-end audit remains scheduled AFTER consolidation.


### Selective PR #65 reconciliation — batch 2 (2026-11-08)

- Candidate branch advanced from `a15cc242001eeaf9cc2d8e47cd54cd4e888619fd` to `07e0cf66ab5e86a73da10e9972791767d7a2a18f`.
- Commit `07e0cf66ab5e86a73da10e9972791767d7a2a18f` selectively reconciles the PR #65 Sidebar accessibility improvements into the newer PR #67 Sidebar: explicit focus-visible keyboard rings, consistent 44px minimum touch targets, wrapped navigation labels, and close-button type semantics. It retains PR #67's more visible semantic active-route accent treatment and current navigation structure.
- PR #65's Sidebar was NOT copied wholesale. This is a deliberate compatible transplant of interaction/accessibility behavior.
- Reviewed PR #65 differences in `Topbar.tsx` and `index.css`: retained PR #67's current disabled/unavailable notification affordance and compact BrandLogo behavior, plus the account page tone token. Do not overwrite these newer candidate choices with older PR #65 snapshots.
- Current compare of PR #65 branch `fix/hide-lightweight-chart-attribution-20261107` against candidate reports divergence (PR #65 86 commits ahead, candidate 129 commits ahead) and 26 changed paths. Remaining unique areas include E2E auth-route coverage, BottomNav/AppLayout, UI primitives, account/auth/admin/assets/dashboard/orders pages, i18n, charts, and README/license notice. These require selective review against current contracts; no wholesale merge or file replacement.
- No runtime template page migration has been performed in this batch. Pinned template source inputs remain available in candidate.
- No tests have been run for this commit; exact-head CI is required before treating the change as validated. Comprehensive audit remains deferred until consolidation is assembled.
- No merge, deploy, Vercel change, hosted Supabase write, financial operation, or locked Spot layout change.
