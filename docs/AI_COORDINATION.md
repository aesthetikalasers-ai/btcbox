# BTCBOX AI Coordination — Single Source of Truth

Last verified: 2026-11-08
Repository: `avali9308-code/btcboxcdt`

## 1. Operating rule

This file is the **only active coordination and task-status document**. Do not create parallel task lists, duplicate AI workstreams, or restart completed tasks from older notes. Historical evidence is retained in `docs/archive/AI_COORDINATION_HISTORY_2026-11-08.md`; it is reference-only and must not be treated as a live task queue.

One repository execution path is active at a time. Re-read this file before starting a batch and update this file only when the active state or verified evidence changes.

## 2. Current integration candidate

- **Active candidate:** PR #67
- **Branch:** `integration/btcbox-mainline-consolidation-20261108`
- **Current candidate head:** `bcf160ef911d59f9a054d6f105873529f27ec4ed`
- **Base:** `main` at `2a3810da1aef2c0c7c58df0cfdb059a212eeb0d6`
- **State:** Draft / open / not merged
- **Latest exact-current-head CI:** all three workflows were IN PROGRESS at last check for `bcf160ef911d59f9a054d6f105873529f27ec4ed`: Backend `42482471023`, PostgreSQL schema `42482471026`, Frontend `42482470948`. Prior head `48a2f90a...` confirmed PostgreSQL schema PASS (`42482389538`), while Backend failed only because the 0035 regression assertion was accidentally changed to expect the 0036 MAINTAIN statement; the assertion was corrected in the current head.

The previous fully green source head `8b54cf128ccd4861eedd1fae602846c92849f835` also passed Backend `42436694163`, PostgreSQL schema `42436693919`, and Frontend `42436694030`. Current head adds a documentation-only correction to the owner bootstrap guide; the full exact-head CI has now passed.

Final-review corrections now included:
- Removed two out-of-scope production inventory/readiness SQL diagnostics and aligned the SQL guide with the empty-database direction.
- Corrected the market E2E timestamp fixture and Earn route selector.
- Fixed first-request initialization for an empty `btcbox_state` table through the revision-0 atomic CAS RPC; concurrent first requests re-read the winner, while malformed schema/RPC failures remain fail-closed.
- Cleared stale spot candles when periodic chart refresh fails; the chart no longer presents the last old snapshot as current.
- Corrected the mobile topbar wordmark clipping at narrow widths.
- Made Trade Hub Spot, Seconds and Earn states reflect backend market, execution, policy and catalog availability; retained the explicitly unavailable Futures card.
- Preserved the locked spot trading-page layout.

Human visual review covered representative 390px mobile and 1440px desktop screenshots, including home, markets, spot trade and Trade Hub. The responsive artifact is retained by CI for seven days. Hosted authenticated staging is now schema-installed in the isolated free Staging project; actual Email/Google Auth and authenticated API flows remain NOT VERIFIED.

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

1. PR #67 remains the sole integration candidate. Latest head `60e7a697cf1b1b5a0f24e0d6d065203e88e7b575`; exact-head Backend, PostgreSQL schema and Frontend CI are in progress. Do not alter the locked trading-page layout.
2. Isolated Supabase Staging project `gnwsygxshqceunihguwe` is created at $0/month in `us-east-1`; the fresh schema has 27 registered migrations installed successfully. See section 19 for exact verification and remaining limits.
3. Real Email/Google provider configuration and authenticated end-to-end flows remain NOT VERIFIED. Admin bootstrap is not run because no Auth user exists; it requires the intended owner-controlled Auth identity.
4. Financial cutover flags remain fail-closed. No real spot orders, Seconds positions, Earn subscriptions/redemptions, deposits, withdrawals or settlement have been executed. Keep PR #67 Draft until Auth, API and financial acceptance gates are independently verified and the owner authorizes release.

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


### PR #65 UI/test reconciliation — batch 3 (2026-11-08)

- Reconfirmed candidate branch HEAD remains `07e0cf66ab5e86a73da10e9972791767d7a2a18f`; PR #67 remains Draft/open/unmerged.
- Compared six shared UI paths against PR #65: `BottomNav.tsx`, `badge.tsx`, `button.tsx`, `card.tsx`, and `input.tsx` have identical blob SHAs on both branches. No duplicate code transplant was needed. `BrandLogo.tsx` differs: candidate retains the newer `hideNameBelow` responsive behavior absent from PR #65; keep candidate implementation.
- Rechecked `AppLayout.tsx`: previously verified identical blob SHA on both branches. Its current structure is not a PR #65-only contribution.
- Compared E2E test names in `frontend/e2e/auth-routes.spec.ts`: PR #65 has 37 tests, candidate has 38. Candidate uniquely contains the newer Supabase email/password login, email registration, mailbox confirmation and recovery tests. PR #65-only tests include older assertions that email registration is absent and login uses username/password + wallet-only identity; these conflict with the current approved Supabase Email/Google auth direction and must NOT be copied. Candidate also already contains newer versions of market responsiveness, public preview and supported trade chooser coverage.
- This batch intentionally makes no runtime code commit because the inspected PR #65-only code was either already identical, superseded by candidate behavior, or incompatible with the current auth contract. Avoid creating no-op commits or regressing auth coverage.
- PR #65's remaining meaningful differences still require focused review: Topbar (candidate's unavailable-notifications behavior retained), Pages.tsx and business-heavy feature pages, account/auth/admin/assets/dashboard/orders pages, i18n and chart components. Preserve candidate contracts; inspect each logical change before any transplant.
- No tests were run. This is source-diff analysis only, not validation. Full audit remains deferred until consolidation is assembled.
- No merge, deploy, Vercel change, hosted Supabase write, financial operation, or locked Spot layout change.


### PR #65 feature-page reconciliation — batch 4 (2026-11-08)

- Candidate remains `07e0cf66ab5e86a73da10e9972791767d7a2a18f`; PR #67 remains Draft/open/unmerged.
- Reviewed `AssetsPage.tsx`: PR #65 preserves last confirmed balances on transient refresh failure and has more responsive two-column mobile layout; candidate adds request sequencing to prevent stale responses from overwriting newer account state and uses exact decimal-string formatting. Do not overwrite candidate with PR #65. A future surgical improvement may preserve the last confirmed snapshot only when the same authenticated identity remains active; do not expose previous-account balances after identity/session changes.
- Reviewed `OrdersPage.tsx`: PR #65 adds accessible named scroll region, sticky table header, richer status variants and responsive layout, but preserves last confirmed orders on refresh errors. Candidate has request sequencing and clears stale orders; retain candidate data-isolation behavior. Consider porting only accessibility/status styling in a later isolated patch after exact component-level review.
- Reviewed `LiveMarketsTable.tsx` and `Dashboard.tsx`: candidate implements a 90-second stale-snapshot cutoff, hides stale quotes, distinguishes unavailable/stale states, and preserves route links; PR #65 retains stale quotes with a warning. Retain candidate fail-closed market behavior. Do not reintroduce stale market display.
- Reviewed `AuthPages.tsx`: PR #65 has wallet/Google-only onboarding; candidate adds Supabase Email login/registration, password reset and recovery. Current approved auth contract requires Email and Google, so retain candidate.
- Reviewed `AdminPage.tsx`: PR #65 adds a review-dialog focus trap and status variants, but its older permission name `system_config.read` conflicts with candidate's current `deposits.read`; candidate adds payout/action locks, request sequencing, stale-queue clearing and removes hard-coded withdrawal fee defaults. No wholesale copy; potential focus-trap enhancement requires a small, conflict-aware transplant preserving all current action locks and permission contracts.
- `AccountSecurityPage.tsx` blob SHA is identical on both branches.
- No code commit in this batch: inspected differences either conflict with newer security/data contracts or require a carefully isolated accessibility transplant that cannot be validated through content-only review. No source code was blindly replaced.
- Template submodules remain pinned source references only; no runtime migration yet. This means the user's full Strata Pro + Shadcn Fintech frontend migration is still outstanding and consolidation is not complete.
- No tests were run. Comprehensive audit remains deferred until consolidation is assembled.
- No merge, deploy, Vercel change, hosted Supabase write, financial operation, or locked Spot layout change.


### Candidate baseline and business integration reconnaissance — 2026-11-08 15:43 +08

- Re-read this coordination document before the batch and rechecked GitHub PR #67 and its branch metadata. The live branch and PR head are both `07e0cf66ab5e86a73da10e9972791767d7a2a18f`; the earlier top-level SHA `3d7f963...` was stale and is corrected above. PR #67 remains Draft/open/unmerged; base `main` remains `2a3810da1aef2c0c7c58df0cfdb059a212eeb0d6`.
- Exact-head workflow runs for `07e0cf66...`: Backend `42457650357` PASS; PostgreSQL schema `42457650540` PASS; Frontend `42457650430` PASS. This confirms CI only, not hosted staging or visual owner acceptance.
- Business/API reconnaissance on the candidate: `frontend/src/lib/api.ts` exposes real BTCBOX service calls for markets, candles, order book, spot order submit/cancel, authenticated account/assets, Earn catalog/actions, orders, Seconds policy/positions/orders, KYC, support, deposit addresses, withdrawal configuration/submission, and admin operations. The customer route page source calls these service methods rather than embedding sample business records in the reviewed sections.
- A targeted source scan of `frontend/src/features/pages/Pages.tsx` and `frontend/src/lib/api.ts` found no TODO/FIXME/mock/demo/fake/sample-data markers in the scanned lines. The only explicit “Coming soon” result was the Futures card, which correctly labels the service unavailable because no supported Futures backend is registered. This is a targeted scan, not the deferred comprehensive audit.
- The app remains a Vite/React runtime with React Router. The pinned Strata Pro and Shadcn Fintech gitlinks are still source inputs, not evidence of runtime page/component migration. Full template porting remains outstanding and belongs to Visual Team for page/layout/component ownership; Business Team continues to own API/auth/session/data contracts and will validate the team's integration against the real service surface.
- No runtime source code was changed in this reconnaissance batch because the inspected customer-page calls already target the real API layer and no safe, isolated business defect was established from the targeted scan. Do not create a speculative/no-op code commit. Next: continue the 3号 contract review across account, deposits/withdrawals, Earn, Seconds, support, and admin API implementations; record only reproducible contract defects, while visual runtime migration proceeds under its owning team.
- No merge, production deployment, Vercel configuration change, hosted Supabase write, financial operation, or locked Spot layout change was performed.


### Business contract review — batch 5 (2026-11-08)

- Re-read the latest coordination document before this batch. Candidate branch reviewed: `integration/btcbox-mainline-consolidation-20261108`, head still `07e0cf66ab5e86a73da10e9972791767d7a2a18f`; no candidate code change was made.
- Cross-checked frontend API contracts in `frontend/src/lib/api.ts` against backend route handlers in `backend/api-core.js` for account snapshots, saved/selected withdrawal addresses, deposit-address lookup, withdrawal configuration/submission, Earn catalog/actions, Seconds policy/order/positions/settlement, support messages, KYC and order history. The reviewed route paths, request field names and principal success response shapes align. No reproducible client/server mismatch was established in this pass.
- Financial safety behavior is fail-closed in the inspected backend: deposit POST only returns a configured deposit address for zero-amount lookup and rejects user-supplied deposit credits; withdrawal/Earn/Seconds operations are guarded by server-side checks and atomic PostgreSQL RPC paths; Seconds positions explicitly report cutover incomplete with empty positions when financial writes are disabled. This is a source-level review, not a live service test.
- Account reads use PostgreSQL financial snapshots when the corresponding read flag is enabled and return an explicit 503 on snapshot failure rather than silently falling back. When that read flag is disabled, the legacy user snapshot path remains in use; this must be explicitly accounted for in the final cutover checklist.
- Support messages and saved addresses are still persisted in the legacy account-state document in the inspected handlers. This is not a frontend mock, but it is a backend storage migration boundary that must be resolved/documented before claiming all customer data is fully PostgreSQL-backed.
- Supabase Email/Google auth flows are implemented in `frontend/src/lib/auth.tsx` and auth pages call them. This source review does not verify provider enablement, callback allowlists, OAuth secrets, email delivery, or a real sign-in; those require controlled staging configuration and end-to-end tests.
- No safe 3号-owned code change was justified by the reviewed evidence. Avoid speculative modifications. Visual runtime migration remains outstanding and is owned by Visual Team; pinned upstream gitlinks are not runtime integration. The business team will validate the actual component-to-service bindings after visual pages are ported.
- No tests were run in this source-only review batch. No merge, deployment, Vercel change, hosted Supabase write, financial operation, or locked Spot layout change occurred.


### Database cutover and withdrawal lifecycle review — batch 6 (2026-11-08)

- Re-read the current coordination document before this batch. Candidate PR #67 branch remains at `07e0cf66ab5e86a73da10e9972791767d7a2a18f`; no runtime candidate code was changed.
- Reviewed `backend/supabase/sql/MIGRATION-ORDER-AND-CUTOVER.md`, `backend/scripts/check_migration_status.py`, `backend/scripts/run_migrations.sh`, and bootstrap instructions. Confirmed the canonical 26-file SQL set is an explicitly guarded fresh-empty-database bootstrap only. `run_migrations.sh` is merely an alias for that bootstrap; it is not an upgrade runner. The checker explicitly returns `VERSION_MAPPING_REQUIRED` when the hosted Supabase migration ledger uses timestamp versions. The connected hosted project was previously verified non-empty (legacy `btcbox_state`, catalog and private backup records), so applying the canonical set to it is prohibited. A separately designed, reviewed and tested incremental upgrade/reconciliation plan is a P0 release gate; do not execute a bootstrap or DDL against hosted Supabase.
- Re-reviewed withdrawal lifecycle after later SQL additions. Migration `0027` now extends the withdrawal status constraint to include `completed`, changes `read_admin_withdrawal_snapshot_v1` to include `pending`, `pending_admin_review` and `approved`, and adds `mark_withdrawal_paid_atomic`. The API requires a payout reference and routes completion through the service-role RPC; the RPC only completes an already approved withdrawal and records the actor/reference/audit event. This resolves the older BUS-WD-009 concern that approved withdrawals disappear from the admin queue with no manual completion action, within the current manual-payout workflow. Update the historical review as superseded rather than continuing to label that exact gap open; do not imply on-chain broadcast/confirmation exists. Current model is staff manually sends externally, then records TxID/reference; it is not an automated broadcaster/outbox.
- `0022` review RPC atomically changes pending to approved/rejected and adjusts available/frozen balances; the API response clearly states approval is not a chain broadcast. `0027` manual completion is status/audit confirmation only and does not broadcast or debit again. Keep this distinction visible in admin UX and release docs.
- CI source checks do not apply DDL to PostgreSQL. Before release, create a disposable empty PostgreSQL/Supabase environment, apply the exact 26 SQL files in order, verify final grants/RLS/function signatures and run concurrency/replay tests. Separately design a non-destructive upgrade path for the existing hosted environment, with owner approval and backup/rollback evidence.
- No tests run in this source-only review batch. No merge, deploy, Vercel configuration change, hosted Supabase write, financial operation, or locked Spot layout change.


### Business data persistence boundary review — batch 7 (2026-11-08)

- Re-read the current coordination document and rechecked the sole candidate PR #67. Candidate branch remains `integration/btcbox-mainline-consolidation-20261108` at `07e0cf66ab5e86a73da10e9972791767d7a2a18f`; PR #67 remains Draft/open/unmerged. Exact-head Backend `42457650357`, PostgreSQL schema `42457650540`, and Frontend `42457650430` runs are completed successfully. These are the latest verified candidate CI runs; this batch did not change candidate code.
- Inspected the customer `/api/support/chat` and `/api/support/messages` handlers and admin support reply/list handlers. Customer messages, read timestamps and staff replies are stored inside each user's `support_messages` array in the `btcbox_state` JSON singleton and persisted through the revision-CAS state writer. Client message retries are idempotent when a request ID is supplied; staff replies require a request ID and reject same-ID/different-content replay.
- Inspected `/api/addresses`, `/api/addresses/select`, the account snapshot, and admin address management/list handlers. Saved crypto and bank withdrawal addresses, address flags/unbind state and address audit entries are also stored in the per-user `btcbox_state` JSON record. User list/account responses mask crypto addresses and bank account/routing numbers; the full crypto address is returned only through the authenticated owner-scoped select route, while the admin view is permission-gated. End-user edit/delete remains intentionally blocked and support/admin owns changes.
- These are confirmed backend persistence boundaries, not frontend demo data and not a reproduced API request/response mismatch. They remain legacy JSON-state storage rather than normalized PostgreSQL customer-data tables. Any future migration must define ownership/FK mapping to the Supabase Auth identity, encryption/retention and access policy for bank/crypto PII, support-message ordering/pagination and idempotency uniqueness, admin audit semantics, and a no-loss cutover/rollback plan. Do not add speculative schema or dual-write logic before that design is approved.
- No candidate runtime code was changed and no tests were run in this source-only review batch. No hosted Supabase writes/DDL, financial operations, Vercel changes, merge/deploy, or locked Spot layout changes occurred.
- Next 3号 work: continue source-level review of remaining account/session and admin data paths for legacy JSON persistence versus normalized PostgreSQL cutover, and record only reproducible contract/security defects. Visual Team's full Strata Pro + Shadcn Fintech runtime port remains an outstanding ownership handoff; the existing vendor gitlinks are source pins only, not runtime migration. Once the full consolidation is assembled, perform the one comprehensive audit requested by the owner rather than repeating partial audits.


### Supabase identity and BTCBOX session revocation review — batch 8 (2026-11-08)

- Reviewed backend `POST /api/supabase-login`, `getSessionRecord`, `POST /api/logout`, `POST /api/login/2fa`, and frontend auth initialization/sign-out.
- Source-observed behavior: Supabase access tokens are verified against Supabase Auth when exchanging a login, after which BTCBOX issues a separate opaque `session_token` HttpOnly cookie and stores its session record in the `btcbox_state` JSON singleton. Subsequent API requests authenticate that BTCBOX cookie only; `getSessionRecord` checks record existence, creation timestamp and a seven-day maximum age, but does not revalidate the Supabase access token or current Supabase user status.
- Frontend initialization first calls `getAccount()` using the existing BTCBOX cookie and returns authenticated if it succeeds; only if that fails does it recover/exchange a persisted Supabase Auth session. Normal sign-out calls the BTCBOX logout endpoint and then Supabase `signOut()`.
- Therefore revoking/expiring a Supabase Auth session or disabling the Supabase Auth identity does not, by itself, invalidate an already-issued BTCBOX cookie. The BTCBOX cookie can remain usable until explicit BTCBOX session revocation or its seven-day age limit. Existing account freeze and credential/2FA change paths can revoke BTCBOX sessions, but the reviewed code does not establish automatic revocation on Supabase identity disable/password reset from outside BTCBOX.
- This is a confirmed separation of session authorities and a security-policy gap to resolve before production, not proof of an unauthenticated access path. The product owner must choose and document the intended revocation contract: (a) BTCBOX sessions are intentionally independent and remain valid up to seven days, with an explicit “revoke all BTCBOX sessions” path for Supabase account disable/recovery; or (b) Supabase identity status/revocation must be checked or propagated into BTCBOX session revocation. Any implementation must preserve username/password legacy login where still supported, 2FA, identity linking and logout behavior.
- Existing `backend/tests/auth-security-routes.test.js` covers timestamp skew, identity-link replay, credential/2FA session revocation and related guards, but the inspected tests do not cover Supabase identity disable/revocation invalidating an existing BTCBOX cookie. Add a regression test after the revocation contract is selected; do not make an unapproved behavior change in this review-only batch.
- Candidate code remains unchanged at `07e0cf66ab5e86a73da10e9972791767d7a2a18f`; PR #67 remains Draft/open/unmerged. No tests were run in this source-only review. No hosted Supabase writes/DDL, financial operations, Vercel changes, merge/deploy, or locked Spot layout changes occurred.


### Admin KYC dashboard count consistency fix — batch 9 (2026-11-08)

- Re-read the latest coordination doc and rechecked PR #67 before the change. Candidate head was `07e0cf66ab5e86a73da10e9972791767d7a2a18f`; PR #67 was Draft/open/unmerged.
- Reproduced a real backend inconsistency: `GET /api/admin/kyc` deliberately includes all review statuses recognized by `isKycInReview` (`pending`, `processing`, `under_review`), but `GET /api/admin/stats` counted only exact `pending`. Imported legacy records in `processing` or `under_review` therefore appeared in the review queue but were omitted from the dashboard pending-KYC count.
- Fixed the business-owned backend stats projection to use the shared `isKycInReview(u.kyc.status)` predicate. Added a backend admin API contract regression test that asserts the dashboard stats route uses the same predicate and the canonical three-status set. Changed only `backend/api-core.js` and `backend/tests/admin-api-contract.test.js`; no visual/interaction-owned files changed.
- Candidate commit: `90839a7f4f9fc47a712eb0ac53f1b144c9b755e2`, parent `07e0cf66ab5e86a73da10e9972791767d7a2a18f`. GitHub ref update succeeded with expected parent SHA and force=false. PR #67 head was rechecked and matches the new commit; it remains Draft/open/unmerged.
- A PR-triggered Frontend CI run `42461171715` was observed queued at the time of this note; it is not a pass. No backend/schema CI completion or local test execution has been verified for this new SHA yet. Do not describe this fix as tested until exact-head checks complete.
- Further source review confirmed other account/admin cutover boundaries: KYC submission metadata and review status remain in `btcbox_state` while uploaded evidence is in private storage; admin KYC queue and pending-KYC stats read that legacy user document. Admin support inbox/replies also use that document. Admin audit writes are staged in the state document and asynchronously flushed to the PostgreSQL audit sink; canonical audit reads fail closed when the read flag is enabled, otherwise expose an explicitly retention-limited state-document page. Admin orders and withdrawals switch to PostgreSQL when their read flags/cutovers are enabled and otherwise expose legacy-state results. Admin users and user detail remain sourced from legacy user records for identity/profile/KYC and legacy metadata, while financial snapshots switch to PostgreSQL under the financial read flag and fail closed on error. These boundaries must be explicit in final cutover readiness; do not claim full account/admin data normalization.
- Next: verify all CI for exact SHA `90839a7f4f9fc47a712eb0ac53f1b144c9b755e2`; continue 3号-owned source audit of account/admin storage cutover; preserve the single full audit until the requested integration is assembled. Visual runtime migration (Strata Pro trading/market UI and Shadcn Fintech account/auth/assets/security/settings adapted to Vite, with demo data removed and BTCBOX service bindings retained) remains an outstanding Visual Team deliverable. Vendor gitlinks alone do not satisfy it.
- No hosted Supabase writes/DDL, financial operations, Vercel changes, merge/deploy, or locked Spot layout changes occurred.

### Admin customer payout-address permission boundary — batch 10 (2026-11-08)

- Re-read the current coordination document and verified the candidate branch/PR #67. Candidate remains `90839a7f4f9fc47a712eb0ac53f1b144c9b755e2`; PR #67 remains Draft/open/unmerged.
- Exact-head CI status at review time: Backend `42461171850` PASS; PostgreSQL schema `42461171704` PASS; Frontend `42461171715` still in progress. Do not call the full candidate CI green until Frontend completes.
- Confirmed permission-scope mismatch in `backend/api-core.js`: `GET /api/admin/addresses` is mapped to `deposits.read` (permission resolver around line 2918), but the handler returns full customer-saved crypto withdrawal addresses and bank account/routing details (handler around lines 3606-3611). The frontend labels the associated module as deposit-address administration, while this endpoint's records are customer payout destinations.
- Confirmed the corresponding `POST /api/admin/address/manage` is mapped to `system_config.write` (resolver around line 2919), although it changes/flags/blocks/unbinds/deletes customer payout destination records. `system_config.write` also controls global deposit address, fee and announcement configuration. This combines distinct authority domains.
- This is a least-privilege design defect, not merely a naming issue: a delegated admin granted `deposits.read` can receive full customer payout PII through the address-list endpoint; a delegated admin granted `system_config.write` can manage customer payout destinations. Do not hot-swap to `withdrawals.read` without product/security review because full bank PII may warrant its own restricted permission.
- Required remediation: define dedicated narrowly scoped permissions (at minimum `payout_addresses.read_sensitive` and `payout_addresses.manage`, or an explicitly approved equivalent), add them to the closed backend permission catalogue and private SQL seed/migration, update route mapping, frontend tab/controls and role editor, and add regression tests proving `deposits.read`/`system_config.write` alone cannot access or mutate customer payout addresses. Keep full PII out of general user projections and retain audited reasoned mutations. Because this crosses API, RBAC schema and frontend-owned files, coordinate the change across 1/2/3 rather than making a partial backend-only patch.
- No code change was made in this batch: a partial permission change would risk locking out legitimate staff or leaving the schema/UI inconsistent. No tests were run locally, no hosted Supabase DDL/writes, no financial operations, no Vercel changes, no merge/deploy, and no Spot layout changes occurred.
- Continue next with the exact-head Frontend CI result, then address the payout-address permission contract through coordinated ownership. Keep the one comprehensive final audit after the requested template/runtime integration is assembled; the Strata Pro + Shadcn Fintech runtime port remains outstanding and vendor gitlinks are not completion evidence.

### Exact-head CI completion and payout-address RBAC follow-through — 2026-11-08

- Rechecked PR #67 metadata: head branch `integration/btcbox-mainline-consolidation-20261108`, exact head `90839a7f4f9fc47a712eb0ac53f1b144c9b755e2`, base `main`; PR remains Draft/open/unmerged.
- Rechecked PR-triggered workflows for that exact SHA: Backend `42461171850` completed/success; PostgreSQL schema `42461171704` completed/success; Frontend `42461171715` completed/success. All three exact-head CI workflows are now green.
- Re-read the candidate's closed backend permission catalogue, private SQL permission seed, route permission map, Admin tab permission declarations, and admin API contract tests. The payout-address gap recorded in batch 10 remains present and is cross-layer: `addresses GET` still maps to `deposits.read`; `address/manage POST` still maps to `system_config.write`; neither `payout_addresses.read_sensitive` nor `payout_addresses.manage` exists in the backend catalogue, SQL seed, or Admin role editor. No partial backend-only permission patch was made.
- Required coordinated change remains: 3号 owns the business/API permission contract and route enforcement; 1号 owns the closed permission catalogue plus private SQL seed/schema/test alignment; 2号 owns Admin role-editor options, tab/action visibility and UI regression coverage. All three permissions layers must land together on PR #67, with tests proving the old broad permissions alone cannot read or mutate customer payout destinations.
- Candidate code was not changed in this review batch. No local test execution, hosted Supabase DDL/writes, financial operations, Vercel changes, merge/deploy, or locked Spot layout changes occurred. Keep the final comprehensive audit after the requested template/runtime integration is assembled.


### Single-operator execution and payout-address permission remediation — 2026-11-08

- Owner instruction: BTCBOX work is to be executed by one ChatGPT operator, not described as parallel work by separate 1号/2号/3号 agents. Historical ownership boundaries are not a reason to wait for another agent. The single operator is responsible for coordinating and implementing visual, interaction, business, API, security and integration changes while preserving the stated production/merge/deploy restrictions.
- Candidate PR #67 advanced from `90839a7f4f9fc47a712eb0ac53f1b144c9b755e2` to `bd258b3ec5da983e708d211c64bc6f8f064d6ed5`.
- Implemented a coordinated least-privilege correction across backend closed permission catalogue, API route authorization, private SQL permission seed, delegated-admin role editor, and regression tests:
  - `GET /api/admin/addresses` now requires `payout_addresses.read_sensitive`.
  - `POST /api/admin/address/manage` now requires `payout_addresses.manage`.
  - Neither `deposits.read` nor `system_config.write` alone grants either sensitive payout-address action.
  - Admin role editor exposes the two separate permissions.
  - Global Deposit addresses configuration tab now uses `system_config.read`, matching the `GET /api/admin/config` route it actually loads.
  - Added runtime RBAC assertions and API/UI/SQL contract assertions.
- Changed files: `backend/admin-rbac.js`, `backend/api-core.js`, `backend/supabase/sql/0026_admin_rbac_private_store_v1.sql`, `backend/tests/admin-api-contract.test.js`, `backend/tests/admin-rbac.test.js`, `frontend/src/features/admin/AdminPage.tsx`.
- Exact-head CI for `bd258b3ec5da983e708d211c64bc6f8f064d6ed5` was triggered: Backend run `42461929437`, PostgreSQL schema run `42461929390`, Frontend run `42461929462`. All were in progress at the time this note was written; do not claim a pass until each completes successfully.
- This change updates source SQL only. It does not apply DDL to the hosted Supabase project. Existing hosted environments require a separately reviewed additive upgrade migration; do not assume editing bootstrap SQL upgrades an already-created permission catalogue.
- PR #67 remains Draft/open/unmerged. No production deployment, hosted database writes/DDL, financial operation, or Spot layout change was performed.
- Next batch: verify exact-head CI, then continue one-operator implementation of full Strata Pro + Shadcn Fintech runtime page/component migration. The pinned submodules remain source references only; they are not runtime migration evidence. Keep the comprehensive whole-project audit until the requested integration is assembled.


### Payout RBAC regression correction — 2026-11-08

- The first permission-remediation commit `bd258b3ec5da983e708d211c64bc6f8f064d6ed5` correctly changed the route mapping and catalogue, but its Backend CI exposed one remaining legacy assertion in `backend/tests/admin-route-permissions.test.js` that still expected the old `deposits.read` / `system_config.write` mappings. Backend run `42461929437` therefore failed at that assertion (469/470 tests passed); this was a test-contract mismatch caused by the intentional least-privilege change, not a runtime failure.
- Updated that route-permission test to expect `payout_addresses.read_sensitive` for GET and `payout_addresses.manage` for POST, and explicitly assert that the old broad mappings are absent.
- New exact candidate head: `f46073860a5412bd0d70a2119d27568a2faadfe0`. PR #67 remains Draft/open/unmerged.
- Exact-head checks for `f46073860a5412bd0d70a2119d27568a2faadfe0` were visible as in progress: unified Backend/build/test run `42462027466`, PostgreSQL bootstrap run `42462027505`, and frontend build run `42462027577`. No pass is claimed until they complete.
- The earlier `bd258b3` Backend failure is superseded by the corrected test commit; do not treat its result as evidence for the current head.


### Corrected payout RBAC CI update — 2026-11-08

- Rechecked exact candidate SHA `f46073860a5412bd0d70a2119d27568a2faadfe0`.
- Unified Backend/build/test workflow `42462027466`: completed successfully.
- Empty PostgreSQL bootstrap workflow `42462027505`: completed successfully.
- Frontend build workflow `42462027577`: still in progress at this check.
- The prior backend failure on `bd258b3` was resolved by updating the route-permission contract test; current-head backend suite is green. Frontend is the only remaining CI check for this commit.


### Fintech account-card layout port — BTCBOX Assets page — 2026-11-08

- Applied a structural visual adaptation from the Shadcn Fintech Accounts page to BTCBOX `frontend/src/features/assets/AssetsPage.tsx`: responsive three-metric summary row and responsive asset-card grid with asset icon, dedicated Available/Frozen value panels, subtle left accent and card hover treatment.
- All displayed values remain sourced from the authenticated BTCBOX `getAccount()` snapshot. The summary uses the real valuation-complete flag, real balance-row count and actual unpriced-asset count. Each asset card displays only the returned free/frozen values. No template seed data, fake balances, fake account actions, or invented change/last-activity figures were ported.
- Deposit/Withdraw actions continue to use the existing BTCBOX routes; loading, auth-required, API-error, empty and unpriced-asset states remain truthful.
- Candidate commit sequence: `6955cf053ace1190766ddf10a02c0c024d159e99` (layout) followed by `e8353298b88da84b3699c8c97ecca84933360299` (import cleanup). Current PR #67 head is `e8353298b88da84b3699c8c97ecca84933360299`.
- Exact-head checks for the current commit were triggered and observed in progress: empty PostgreSQL bootstrap, frontend build, and unified backend/build/test/fail-closed workflow. Do not claim completion until all three conclude successfully.
- Previous permission-remediation-only head `f46073860a5412bd0d70a2119d27568a2faadfe0` passed all three checks, but that is not current-head CI evidence after the Assets page change.
- No hosted Supabase DDL/writes, production deployment, merge, financial operation, or locked Spot layout change.


### Fintech-style responsive order-history cards — 2026-11-08

- Adapted the Shadcn Fintech transaction-list presentation pattern to BTCBOX `frontend/src/features/orders/OrdersPage.tsx` without importing the template's seed transactions, fake merchants, selection/export actions or mock behaviors.
- On narrow viewports, authenticated BTCBOX orders now render as compact responsive cards showing the actual pair, side, order ID, status, price, quantity and creation time. The existing desktop table remains intact at medium and larger widths.
- No order API, cancellation, placement, financial or Spot layout behavior changed. Loading, sign-in-required, error and no-orders states remain unchanged.
- Candidate head advanced to `65a64ecf78de23f7e6b3ef517fcf9ac1d6124111`; PR #67 remains Draft/open/unmerged.
- Exact-head checks for `65a64ecf78de23f7e6b3ef517fcf9ac1d6124111` were queued when checked: frontend build, empty PostgreSQL bootstrap, and unified backend/build/test/fail-closed workflow. Do not claim these as passed until completion.
- The previous Assets-page commit `e8353298b88da84b3699c8c97ecca84933360299` had empty PostgreSQL bootstrap and unified backend/build/test workflows pass; its frontend build/route smoke check was still in progress at the last check. This is not current-head CI evidence.
- No hosted Supabase DDL/writes, production deployment, merge, financial operation, or locked Spot layout change.


### Current-head CI checkpoint — 2026-11-08

- Reverified PR #67 exact head: `65a64ecf78de23f7e6b3ef517fcf9ac1d6124111`; PR remains Draft/open/unmerged.
- Current exact-head unified Backend/build/test/fail-closed workflow `42462391538`: PASS.
- Current exact-head empty PostgreSQL bootstrap workflow `42462391527`: PASS.
- Current exact-head Frontend build workflow `42462391537`: npm install, lint, production build and Chromium installation passed; desktop/mobile route smoke tests were still in progress. Responsive visual screenshot upload had not started. Do not claim full Frontend CI pass until the route smoke test and workflow complete.
- Shared coordination document now records single-operator ownership and both visual adaptation batches. Candidate branch and shared coordination branch remain separate; do not confuse their SHAs.


### Single-operator visual migration batch — account, KYC and wallet pages — 2026-11-08

- Current PR #67 candidate: `4d84a3d0faecaac1adc9b85a5f05e5d6609e02bf` (Draft/open/unmerged).
- Continued actual runtime migration of Shadcn Fintech page composition into the existing Vite/React application; no Next.js router, Clerk, seed data or template fake financial actions were introduced.
- `frontend/src/features/account/AccountSecurityPage.tsx`: added a responsive security overview showing live account identity-link count, BTCBOX 2FA state and password state; refined account-center hero and card surfaces. Existing identity-link/re-authentication/recovery handlers and form conditions remain unchanged.
- `frontend/src/features/pages/Pages.tsx`:
  - My account page now has live KYC/2FA/linked-provider metric cards, a structured account profile card and descriptive service action cards.
  - KYC page now uses a status-led responsive verification summary, keeps document numbers masked, preserves rejection notes, and restyles the submission form without changing its validation, image compression or authenticated submit call.
  - Withdrawal balances now use responsive asset cards with the existing free/frozen figures from the authenticated account snapshot; no values are synthesized.
  - Deposit address and deposit history cards received consistent fintech surface and responsive input styling; address/network selection and manual-credit warning remain unchanged.
- Previous desktop/mobile order-history smoke test failure on SHA `65a64ecf78de23f7e6b3ef517fcf9ac1d6124111` was a Playwright strict-locator collision: mobile card and desktop table intentionally share the same row data, including the hidden responsive counterpart. Updated the E2E assertions to filter visible elements on SHA `6d22ef579a346ec17f31256594889b7f8b4187bc`; later page changes are based on that fix.
- Latest candidate SHA `4d84a3d0faecaac1adc9b85a5f05e5d6609e02bf`; exact-head checks observed at checkpoint: empty-postgres-bootstrap: in_progress; Unified frontend/backend build, tests, and fail-closed preflight: in_progress; build: in_progress.
- No production deployment, PR merge, hosted Supabase DDL/write, financial operation, or Spot layout/API change.


### Live market summary cards — 2026-11-08

- Candidate head advanced to `7a846b7e7136cce52f6c110761ddb2d9801de81b` (PR #67 remains Draft/open/unmerged).
- `frontend/src/features/dashboard/Dashboard.tsx` now includes responsive BTC/USDT summary cards for the last price, 24-hour percentage change and 24-hour volume. Values are derived only from the actual BTC ticker returned by `getMarkets()`; while loading or when BTC quote is unavailable, the page displays an em dash rather than seeded values. No trade controls, chart source, market API, or Spot page layout was changed.
- Exact-head checks at this checkpoint: empty-postgres-bootstrap: in_progress; build: in_progress; Unified frontend/backend build, tests, and fail-closed preflight: in_progress.
- Current candidate includes the responsive order card test selector fix, account/security/KYC/wallet visual adaptation and the live market summary cards. Full acceptance remains pending exact-head CI and final responsive review.


### Wallet and market visual adaptation continuation — 2026-11-08

- Current PR #67 head: `811cf2a5b0965b71cdca88b33a65c06ec101c147`; PR remains Draft/open/unmerged.
- `frontend/src/features/pages/Pages.tsx`:
  - Withdrawal available balances are presented as responsive asset cards with TokenIcon and actual free/frozen amounts from the BTCBOX account snapshot.
  - Withdrawal form, selected destination, fee summary, pending request messaging, history and saved-address panels received consistent card/input styling. Existing request ID retry semantics, staff-review notice, fee-change handling, fund-password and 2FA checks are unchanged.
  - Deposit address selection, address display/copy affordance and staff-verified deposit history received consistent fintech styling. The manual-credit warning remains visible; no automatic credit or deposit-order behavior was added.
- `frontend/src/features/dashboard/Dashboard.tsx` adds BTC/USDT price, 24h change and 24h volume summary cards using only the live BTC ticker returned by `getMarkets()`; unavailable/loading values remain blank placeholders, not sample figures.
- Latest candidate SHA `811cf2a5b0965b71cdca88b33a65c06ec101c147`. Exact-head CI at checkpoint: build: in_progress; empty-postgres-bootstrap: in_progress; Unified frontend/backend build, tests, and fail-closed preflight: in_progress.
- A checkout cleanup warning references two pre-existing gitlinks under `references/` without matching entries in `.gitmodules`; both gitlinks also exist on `main`. They were not removed or rewritten because they are existing reference archives, not runtime dependencies for this UI batch.
- No merge, deployment, hosted Supabase DDL/write, financial operation, or locked Spot layout/API change.


### Earn page visual adaptation — 2026-11-08

- Candidate head: `c7e279febe3725388a580fcbac051bdac366c03b` (PR #67 Draft/open/unmerged).
- `frontend/src/features/pages/Pages.tsx` Earn catalog now presents live backend products as responsive fintech cards with asset identity, flexible/fixed term, catalog APY, term and early-redemption fee. The subscribe panel has matching card/input treatment.
- All product/rate/term values remain sourced from `getEarnCatalog()`; positions and interest remain sourced from the authenticated account snapshot. No mock products, invented APY, synthetic balances or changed subscribe/redeem behavior were added. Existing backend action enablement and request-id idempotency remain intact.
- Exact-head CI checkpoint: empty-postgres-bootstrap: in_progress; build: in_progress; Unified frontend/backend build, tests, and fail-closed preflight: in_progress.
- Visual migration remains in progress; no merge, deployment, hosted Supabase writes, financial operation, or Spot page layout/API change.


### Support conversation visual adaptation — 2026-11-08

- Candidate head: `91e489364bf1d89a4d11f56d0563df8c63054d07`; PR #67 remains Draft/open/unmerged.
- `frontend/src/features/pages/Pages.tsx` Support page conversation and composer now use the fintech card surface hierarchy, clearer sender-specific message bubbles, improved responsive padding and a full-width mobile send action.
- The existing authenticated message fetch, message content, newest-50 display, request-ID idempotency on send, safe error handling and prohibition on sending passwords/2FA/recovery phrases are unchanged. No demo messages were added.
- Exact-head checks at checkpoint: Unified frontend/backend build, tests, and fail-closed preflight: in_progress; build: in_progress; empty-postgres-bootstrap: in_progress.


### Admin control-center visual adaptation — 2026-11-08

- Candidate head: `3466962e5d8683e0be883d97302b120724accf79`; PR #67 remains Draft/open/unmerged.
- `frontend/src/features/admin/AdminPage.tsx` now uses the shared admin tone, responsive control-center hero, scrollable tab navigation for narrow screens, more legible KPI cards with semantic accent strips, and consistent search-field focus styling.
- This batch changes presentation only; admin session validation, RBAC checks, finance review flows, and endpoint contracts are unchanged.
- Current exact-head checks: build: in_progress; empty-postgres-bootstrap: in_progress; Unified frontend/backend build, tests, and fail-closed preflight: in_progress.


### Account/security responsive QA expansion and semantic page accents — 2026-11-08

- Single-operator continuation; no handoff to separate AI agents.
- Reconciled the supplied SHA `f475cfa6fddb15957645b9a8ae6bffa055eeab95` against GitHub: it is an ancestor of the PR #67 candidate, not the current PR head. At the start of this batch PR #67 head was `3466962e5d8683e0be883d97302b120724accf79`, nine commits ahead of the supplied SHA. All three CI workflows passed on that exact head.
- Inspected the current runtime routes and confirmed `/me` already renders the Shadcn Fintech-style live account profile and overview; `/settings` is backed by `AccountSecurityPage`, which already includes live security metrics, identity linking and credential recovery. The account/security migration is implemented; independent desktop/mobile visual coverage was missing from the screenshot matrix.
- Added `/me` and `/settings` to `frontend/e2e/responsive-visual-qa.spec.ts`, preserving the existing eight viewport widths (320, 360, 375, 390, 430, 768, 1024, 1440). Commit: `32dd6c72b54410cff48ba3388c1e89bc53de74f1`.
- Inspected the exact-head `3466962` screenshot artifact for Assets (desktop 1440/mobile 390), Home (desktop 1440) and Spot (mobile 390). The Spot layout remains unchanged. The Assets/Orders pages were missing their already-defined `tone-assets`/`tone-orders` root classes, causing the page identity accents and title markers to be absent; AccountSecurityPage was incorrectly using the Support tone.
- Restored the existing semantic tone system on Assets and Orders, applied the page accent to summary/section/empty-state elements, and changed AccountSecurityPage to the account-blue tone. No API, account data, auth, RBAC, order or financial behavior changed. Commit: `d875faed3ed93e8ec0d0f69847b0e4a9fee32397`.
- PR #67 remains Draft/open/unmerged. Exact-head Backend, PostgreSQL schema and Frontend CI for `d875faed3ed93e8ec0d0f69847b0e4a9fee32397` are running: Backend `42468033093`, PostgreSQL schema `42468033064`, Frontend `42468033071`. Do not claim a pass until all complete; Frontend route smoke tests and screenshot upload must complete before responsive QA evidence is accepted.
- Prior `32dd6c7` frontend route-matrix run `42467899230` is still in progress at this checkpoint. Its screenshots do not include the new semantic accent commit and cannot be used as final visual evidence.
- No merge, production deployment, Vercel configuration change, hosted Supabase DDL/DML, financial operation, or Spot trading-page layout change.


## 8. Single-operator continuation — 2026-11-08

- One assistant execution path owns the entire integration batch. Historical team labels are work categories only; do not assume separate agents or parallel branches.
- Candidate PR #67 advanced from `d875faed3ed93e8ec0d0f69847b0e4a9fee32397` to `99269ee580006a54446e35920ec945257f1d2c72`.
- Batch added Strata-inspired semantic accent surfaces to the BTC/USDT last-price, 24h-change, and 24h-volume summary cards in `frontend/src/features/dashboard/Dashboard.tsx`; values remain sourced exclusively from BTCBOX live market responses. `docs/FRONTEND_TEMPLATE_MIGRATION.md` now records this as a partial runtime port and explicitly lists remaining template migration work.
- No business/API/auth behavior or Spot layout changed. No demo/mock values introduced.
- Exact-head CI for `99269ee...` was still running at this note: Frontend build `128693567469`, unified frontend/backend/preflight `128693567207`, PostgreSQL bootstrap `128693567157`. Do not mark this head green until all required checks complete successfully.
- PR #67 remains Draft/open/unmerged. No production deployment, Vercel configuration change, hosted Supabase write, or financial operation was initiated.

- Follow-up UI batch advanced candidate to `e2a70744668614bdb63b1259f26d931406ff2a88`: My Account quick links now carry separate semantic tones for verification, orders, support, and settings. The route targets and account data flow are unchanged. Exact-head CI pending.


## 9. Navigation, wallet and account-security visual continuation — 2026-11-08

- Candidate PR #67 advanced to `e75d39a3408348a7d2171b7494e86b3fa4b88706`; PR remains Draft/open/unmerged.
- Desktop Sidebar navigation now uses distinct semantic active states and icon tiles for market, trade, assets, account, orders, Earn and support routes. Mobile BottomNav mirrors the cyan/violet/teal/blue route identity while retaining existing routes, keyboard focus treatment, touch target sizing and responsive shell geometry.
- Assets page now has three real-data summary cards (estimated account value, number of returned assets, valuation completeness). Asset rows include the existing TokenIcon and restrained semantic edge accents. No synthetic total is calculated when valuation is incomplete; unpriced assets remain disclosed.
- Account Security overview cards now use separate semantic surfaces for linked sign-in methods, 2FA and BTCBOX password status. Account snapshot and all auth/identity-link/recovery actions are unchanged.
- Migration ledger updated. These are presentation refinements; they do not constitute full upstream template migration. The Spot trading layout and API contract remain untouched; no demo/mock financial values introduced.
- Exact-head CI for `e75d39a...`: no PR-triggered check-runs/workflow-runs were visible at the immediate post-push query. Do not mark green until GitHub Actions reports completed results. Latest preceding SHA `84cee8afffbe2d980a8652f5c55ea262b4d7c797` also had no visible PR-triggered checks at query time; prior earlier-head checks are historical only.
- No merge, production deployment, Vercel setting changes, hosted Supabase writes, or financial operations.


### CI failure and immediate JSX correction — 2026-11-08

- Exact head `e75d39a3408348a7d2171b7494e86b3fa4b88706` exposed a JSX syntax error in `frontend/src/components/layout/Sidebar.tsx` (extra closing brace after the secondary navigation map). Frontend lint and unified build both failed at TypeScript line 61; PostgreSQL bootstrap passed. This failure was caused by the sidebar patch and is not hidden or treated as a pass.
- Corrected the extra brace in commit `62231c8ee8cc52a5d7d01da252441fc8965f945c`. The corrected head must rerun lint/build/browser smoke tests before acceptance. No other code or business behavior was changed in the fix.
- Exact-head CI for `62231c8...` had no check-runs visible at the immediate post-push query. Keep CI pending until new PR checks are reported. Prior `e75d39a...` failures remain historical and must not be mistaken for corrected-head results.

- Follow-up CI on `62231c8...` found two additional TypeScript errors: child JSX attempted to reference `isActive` outside the `NavLink` className render callback in Sidebar and BottomNav. Fixed by moving active-state indication to a parent active class and removing the out-of-scope variable from child nodes. Fix commit: `05cc95e7e8587669d30776f5c0c721a8ca1205cd`.
- Exact-head CI for `05cc95e...` was not yet visible in GitHub Actions at the immediate post-push query. The navigation batch remains unaccepted until lint, unified build, PostgreSQL bootstrap, desktop/mobile smoke tests and screenshot artifact complete on this exact SHA.

- Corrected-head CI progress for `05cc95e7...`: unified frontend/backend build, backend tests, fail-closed preflight and output checks PASS (`42469014294`). Frontend install, lint and production build PASS; Chromium install/browser smoke tests/screenshot artifact still running (`42469014466`). PostgreSQL disposable bootstrap still running (`42469014293`). This is partial success, not full CI acceptance.


## 10. Deposit, withdrawal and support visual batches — 2026-11-08

- Candidate PR #67 advanced from `05cc95e7e8587669d30776f5c0c721a8ca1205cd` to `a23c5b8b18c19bd2e3243462beb6e3784e007ae6` (Deposit/Withdraw), then `44d9e5009f752687d7857d455ab4834669205248` (Support). PR remains Draft/open/unmerged.
- Deposit UI: clearer asset/network destination presentation, teal/cyan address surface, warning hierarchy and history heading. No deposit request or account credit logic introduced.
- Withdrawal UI: distinct wallet balance and submission surfaces, consistent 48px inputs/focus treatment, stronger submit action. Existing saved destination selection, exact fee confirmation, fund-password/2FA, local pending-intent request ID, idempotent retry, backend action gates and staff review are preserved. No withdrawal submitted.
- Support UI: public help, private message conversation and composer now have indigo/cyan semantic surfaces and improved message/input hierarchy. Auth gating, private account messages and request-id retry behavior remain unchanged. No support message sent.
- Exact-head CI for `a23c5b8...`: Backend unified tests/preflight PASS (`42469275344`); disposable PostgreSQL bootstrap PASS (`42469275353`); frontend install/lint/build/Chromium installation PASS, desktop/mobile route smoke tests and screenshot upload still in progress (`42469275354`).
- Support follow-up head `44d9e500...` was pushed after the `a23c5b8...` workflow began, so its own exact-head CI is not yet visible. Do not transfer the preceding SHA's green checks to this newer head.
- Navigation correction head `05cc95e7...` completed desktop/mobile route smoke tests and responsive screenshot upload successfully; its backend, frontend build and PostgreSQL checks all completed successfully.
- No merge, deployment, Vercel changes, hosted Supabase writes, financial operations, or Spot layout/API changes.


## 11. Earn, Orders and account-setup visual batches — 2026-11-08

- Candidate PR #67 advanced from `44d9e5009f752687d7857d455ab4834669205248` to `7cfcfc4931e5cccc39641448b04dfa6ea82d0e18` (Earn), then `030a6136acf99a05e9e61a4ee6331f0e6eb1cb10` (Orders and account setup). PR remains Draft/open/unmerged.
- Earn page: live catalog, returned position and active position summary counts; product/APY cards; subscription panel; consistent 48px form controls; improved position metric surfaces. Counts only use backend-returned catalog and authenticated account records. Subscribe/redeem action behavior, amount precision checks, request IDs and backend action gate unchanged. No transaction submitted.
- Orders page: strengthened history header, table heading hierarchy and mobile-card hover treatment. Existing API, status mapping, responsive table/card split, and loading/error/empty states unchanged.
- Account setup: shares branded secure-access shell and cyan identity verification treatment with AuthPage; username/password validation, credential API and auth routing unchanged.
- Exact-head CI for `7cfcfc49...`: Backend unified build/tests/preflight and PostgreSQL disposable bootstrap PASS (`42469505445`, `42469505453`). Frontend build/lint/Chromium passed and desktop/mobile route smoke tests were still running at last check (`42469505466`); screenshot upload pending.
- Exact-head CI for latest `030a6136...`: frontend run `42469610355` and backend run `42469610320` started/queued; install and unified build were still running. PostgreSQL exact-head check was queued at last check. Do not inherit prior-head checks as acceptance.
- No merge, deployment, Vercel changes, hosted Supabase writes, financial actions, or Spot layout/API contract changes.


## 12. Auth and recovery UI finishing batch — 2026-11-08

- Candidate PR #67 advanced from `030a6136acf99a05e9e61a4ee6331f0e6eb1cb10` to `d0c4b473a8882f4ec62b4907d608f9afebe217ad`. PR remains Draft/open/unmerged.
- Login/register and password-recovery cards now share a branded cyan/indigo/success accent system, stronger card hierarchy and consistent 48px input/provider-action targets. Existing username/email/Google/wallet/2FA/password-recovery providers, Supabase auth/session flow, validation and navigation are unchanged; no Clerk/demo identity flow added.
- Exact-head CI for `030a6136...`: Backend unified build/tests/preflight PASS (`42469610320`); frontend desktop/mobile route smoke test still running (`42469610355`) at last check. Exact-head PostgreSQL status had been queued at last check; do not infer completion.
- Exact-head CI for latest `d0c4b473...`: frontend `42469719151`, backend `42469719199`, PostgreSQL `42469719249` all started and were in progress at last check. No latest-head CI acceptance yet.
- No merge, deployment, Vercel changes, hosted Supabase writes, financial actions, or Spot layout/API contract changes.


## 13. Follow-up CI status refresh — 2026-11-08

- Exact head `7cfcfc4931e5cccc39641448b04dfa6ea82d0e18`: frontend CI `42469505466` completed successfully, including desktop/mobile route smoke tests and responsive screenshot upload. Backend `42469505445` and disposable PostgreSQL `42469505453` also passed.
- Exact head `030a6136acf99a05e9e61a4ee6331f0e6eb1cb10`: backend `42469610320` and disposable PostgreSQL bootstrap `42469610363` completed successfully; frontend `42469610355` remains in desktop/mobile route smoke tests at last refresh. Do not treat as fully accepted until frontend screenshot artifact completes.
- Latest head `d0c4b473a8882f4ec62b4907d608f9afebe217ad`: backend unified build/tests, frontend install/lint/build and PostgreSQL bootstrap are in progress; latest run IDs `42469719199`, `42469719151`, `42469719249` respectively. No exact-head acceptance yet.

- Latest exact-head refresh for `d0c4b473...`: backend unified build/tests/preflight PASS (`42469719199`); disposable PostgreSQL bootstrap PASS (`42469719249`); frontend install, lint, production build and Chromium install PASS, desktop/mobile route smoke tests still running and screenshot upload pending (`42469719151`). This is partial success, not complete frontend acceptance.


## 14. Dashboard source-port and Japanese-first localization audit — 2026-11-08

- Candidate PR #67 exact head advanced to `d9c681392501c444e070eaa25b3144231e420d1f`; PR remains Draft/open/unmerged.
- Strata Pro dashboard source was compared at pinned upstream commit `a3f79d0237c68faddc877f8c1b00afece2fbbae8`. Its static top-token fixture and inert 24-hour selector were deliberately not copied because BTCBOX already has a live provider-backed market table, real API candles, search, stale-data handling and explicit empty/error states.
- Ported the Strata Pro dashboard Card surface treatment (16px/20px radius, subtle border/inset highlight and layered shadow) into `frontend/src/features/dashboard/components/Card.tsx`; only dashboard/market shared cards are affected. Spot trading layout/API contract unchanged.
- Japanese-first audit: shared i18n already supports seven languages, a language selector and persisted preference; first-visit default is currently English. Japanese dictionary coverage is partial, `Pages.tsx` has hundreds of translated call sites, and `AuthPages.tsx` does not yet use the shared translation function. Missing keys fall back to English, so switching default now would create mixed-language UI.
- Localization must be completed and coverage-tested before changing the default to Japanese; retain English as a selectable language. Audit recorded in `docs/FRONTEND_TEMPLATE_MIGRATION.md`. No default-language switch has been made.
- Exact-head CI for `d9c681392501c444e070eaa25b3144231e420d1f` started: Frontend `42470197271`, Backend `42470197262`, PostgreSQL `42470197272`. All three were in progress at this update; no PASS claim until each exact-head run completes.
- No merge, deployment, Vercel changes, hosted Supabase writes, financial actions, or Spot layout/API changes.


- CI status refresh for exact candidate `d9c681392501c444e070eaa25b3144231e420d1f`: Backend `42470197262` PASS; PostgreSQL disposable-schema bootstrap `42470197272` PASS. Frontend `42470197271`: install, lint, production build and Chromium install PASS; desktop/mobile route smoke tests remain in progress and screenshot upload is pending. Candidate remains unaccepted until the frontend run completes successfully.


- Product localization rule confirmed by owner: every locale must use its own complete, natural, internally consistent language and terminology system; no mixed-language sentences or awkward literal translation. Recognized financial terms may remain in industry-standard form where appropriate (e.g. Spot, Limit Order, Maker/Taker, API, BTC/USDT), while surrounding explanations are localized. Maintain reviewed per-locale glossaries, completeness checks, consistent risk/error/status copy and preserve all financial semantics/API contracts.
- Candidate migration standard updated in commit `ba7d431d8d0ca27311f2f3540d27cab2a8fd8e24`. Japanese-first remains gated on complete Japanese coverage and UI review; English remains selectable. No language default has been switched.


## 15. Locale infrastructure and dashboard localization batch — 2026-11-08

- Candidate PR #67 head: `1a610fd17241aca5bd7b2b17ecb3c4db50b2cbde`; PR remains Draft/open/unmerged.
- Commits since the prior coordination update:
  - `e86a59364b275e141e60aeb626ec560c56801299`: centralized locale tags, set `document.documentElement.lang` on initial provider mount and language changes, and made Top tokens price formatting follow the selected locale.
  - `d73e759e96b4b97966cc2beaef833a4dd82cc4d5`: added Playwright regression coverage for Japanese selection, localized navigation and persistence after reload.
  - `d1dfa752cddc83f434897d3d2ca637cb9595ca8e`: translated dashboard Top tokens and server/provider snapshot metadata across all seven supported locales.
  - `1a610fd17241aca5bd7b2b17ecb3c4db50b2cbde`: translated stale-market-snapshot warning and loading accessible label across all seven locales; 90-second fail-closed behavior unchanged.
- No default-language switch yet. Existing fallback behavior and broad auth/admin/business-page coverage still need systematic completion before Japanese-first is safe.
- Exact-head CI started: Frontend `42470781531`, Backend `42470781493`, PostgreSQL `42470781521`. At this update all three were in progress; frontend dependency installation, backend unified build and PostgreSQL container initialization were underway. No PASS claim yet.
- Spot layout/API contract, API contracts, financial precision, authentication behavior and business flows unchanged. No merge, deployment, hosted Supabase writes or financial operations.


- Follow-up syntax correction: the English dictionary's final pre-existing `Live product catalog` entry lacked a trailing comma before the newly added locale keys. Exact-head CI at `1a610fd17241aca5bd7b2b17ecb3c4db50b2cbde` caught this with TypeScript TS1005 at `i18n.tsx:24`; the comma has been corrected in candidate commit `da837d720d44db67995d0d9f446ec7b71fab65b1`. The failing run is not accepted. Fresh CI for the corrected exact head is pending.


## 16. Japanese Trade Hub and active-page coverage audit — 2026-11-08

- Candidate PR #67 head: `2ed0e1e253419256a90def6ed7fb1b9da66e3275`.
- Japanese Trade Hub status/availability copy now covers all 43 unique `t()` keys in `TradeHubPage`; this includes Spot, Seconds, Earn and Futures availability, fail-closed order-entry messages and login gates.
- Active standalone `AssetsPage.tsx`, `OrdersPage.tsx` and `Dashboard.tsx` now have zero missing Japanese dictionary keys among their static `t()` calls. All seven locale dictionaries received the dashboard/assets/orders copy batch.
- Coverage scan of `Pages.tsx` shows major remaining active-page gaps: MyPage 14; SpotTradingPage 36; SecondsPage 46; KycPage 28; SupportPage 15; DepositPage 14; EarnPage 36; WithdrawPage 31; generic SectionPage 1. Some duplicate legacy Assets/Orders components in Pages.tsx are not the active route imports; active standalone files are translated.
- `AuthPages.tsx` still does not use shared i18n; account security and admin surfaces also need a deliberate locale audit. No Japanese-first default until active route and dynamic copy coverage is complete.
- Exact-head CI for `2ed0e1e253419256a90def6ed7fb1b9da66e3275`: Backend `42471156823` PASS; PostgreSQL bootstrap `42471156837` PASS; Frontend `42471156838` has install, lint, production build and Chromium install PASS; desktop/mobile route smoke tests still in progress, screenshot upload pending.
- The earlier syntax failure on `1a610fd...` was fixed in `da837d7...`; the corrected subsequent exact-head run is the one being tracked here.
- No merge, deployment, hosted Supabase writes, financial operations or Spot layout/API changes.


- Candidate advanced to `be692e11d334bba0e62055f2e25047270f65c9df`: added 42 Japanese strings for My Account profile/security and KYC identity-verification instructions/statuses. Translation-only; no auth, KYC submission, document handling or account API behavior changed.
- Updated Japanese static-key scan across `Pages.tsx`: TradeHubPage 0 missing; MyPage 0; KycPage 0; generic SectionPage 0. Remaining active-page gaps: SpotTradingPage 35, SecondsPage 45, SupportPage 14, DepositPage 13, EarnPage 34, WithdrawPage 29. Duplicate legacy Assets/Orders components remain in Pages.tsx but active standalone AssetsPage/OrdersPage and Dashboard have zero missing keys for their current static translation calls.
- Exact-head CI for `be692e11d334bba0e62055f2e25047270f65c9df` started: Frontend `42471376969`, Backend `42471376859`, PostgreSQL `42471376761`; all in progress at this update. Do not reuse prior-head results as final acceptance.


- Candidate advanced to `172a30c3aaf699fef2326de2096b5398c154fb25`: translated all 35 missing Japanese static strings for the locked SpotTradingPage (stale market/order-book warnings, chart/provider labels, open orders, limit-order controls and fail-closed order messaging). Copy-only; Spot page layout and API contract remain untouched.
- Japanese static-key scan now shows TradeHubPage, MyPage, KycPage, SpotTradingPage and generic SectionPage fully covered for their current `t()` calls. Remaining active gaps: SecondsPage 45; SupportPage 14; DepositPage 13; EarnPage 34; WithdrawPage 29. AuthPages still has no shared i18n integration.
- Exact-head CI for `172a30c3aaf699fef2326de2096b5398c154fb25` has been queued: Frontend, Backend and PostgreSQL bootstrap. No acceptance claim until all exact-head checks finish.


- Candidate advanced to `4d9d315d6d002ec3742f105b2cbe58a471dad743` with Japanese translations for Support, Deposit, Earn and Withdraw pages (private-message safety, deposit network/risk notices, APY/principal/maturity/subscribe/redeem terminology, withdrawal fee/2FA/manual payout lifecycle). No financial behavior changed.
- Japanese static-key coverage scan now reports zero missing keys for active page components in `Pages.tsx` (TradeHub, MyPage, SpotTrading, Seconds, KYC, Support, Deposit, Earn, Withdraw and generic service page). Duplicate legacy Assets/Orders components in that file are not the active imports; standalone Assets, Orders and Dashboard files also have zero missing static translation keys.
- Remaining Japanese localization blockers: `AuthPages.tsx` does not yet use shared i18n (login/register/OAuth/recovery copy), and `AccountSecurityPage` plus `AdminPage` still require localization. Dynamic auth/backend error strings also need controlled locale mapping; no mixed-language default switch yet.
- Exact-head CI for `4d9d315d6d002ec3742f105b2cbe58a471dad743`: Backend `42471644368` PASS; PostgreSQL `42471644417` PASS; Frontend `42471644419` has install, lint, production build and Chromium install PASS, while desktop/mobile route smoke tests remain in progress and screenshot upload is pending.


- Exact-head CI completion for candidate `4d9d315d6d002ec3742f105b2cbe58a471dad743`: Frontend `42471644419` PASS, including install, lint, production build, Chromium install, desktop/mobile route smoke tests and responsive visual QA screenshot upload; Backend `42471644368` PASS; PostgreSQL empty-schema bootstrap `42471644417` PASS. This is exact-head validation only; PR #67 remains Draft/open/unmerged.


- Candidate advanced to `6358d17052da4466e13533c1fab14a6a07012b78`: `AuthPage` and `AuthCallbackPage` now route static login, registration, Google/wallet, 2FA and password-recovery copy through shared i18n. Japanese dictionary covers all 68 static auth `t()` keys, plus common known auth outcome messages; a compact language selector is available on the standalone auth card. Supabase/BTCBOX auth calls, validation, session transitions and redirects unchanged.
- Added Playwright regression coverage for switching the login screen to Japanese, verifying localized labels/disabled Google state and persistence after reload.
- Remaining localization gap: unknown dynamic provider/backend error text cannot be translated reliably until source error codes are normalized; `AccountSecurityPage`, `AccountSetupPage` and `AdminPage` still require a full locale pass. Other locales' auth dictionary copy must also be completed before enabling all locale selectors as production-complete.
- Exact-head CI for `6358d17052da4466e13533c1fab14a6a07012b78` started: Frontend `42472204533`, Backend `42472204529`, PostgreSQL `42472204614`; all were in progress at this update.


- Candidate advanced to `7715398ae5d60a19dbf3d812371e8e3a90dfb54e`: Account Setup and Account Security screens now use shared Japanese i18n for credential onboarding, 2FA state, linked Google/Ethereum/Solana identity management, reauthentication steps and password recovery. Existing credential policies, identity proof sequence, session/auth behavior and security controls unchanged.
- Static Japanese translation-key audit is clear for active customer-facing Dashboard, Assets, Orders, Trade Hub, Spot, Seconds, My Account, KYC, Support, Deposit, Earn, Withdraw, Account Setup, Auth and Account Security components. The 23 remaining `Pages.tsx` key misses are in legacy duplicate Assets/Orders components not imported by active routes.
- Remaining blockers before Japanese-first: Admin console locale coverage; unknown dynamic backend/provider error strings need code-to-locale mapping; all seven supported locales need equivalent full-page coverage and native terminology review. No default locale switch yet.
- Exact-head CI for `7715398ae5d60a19dbf3d812371e8e3a90dfb54e` has been queued; frontend, backend and PostgreSQL checks not yet complete.


- Candidate advanced to `58ca4cb4cdc1c5c9c5cec42b4b2c1b213089da32`. Account Security static copy and identity-linking/password-recovery steps are now Japanese-localized; the final missing `BTCBOX password` key was added. Account Setup is also localized.
- Japanese static translation audit across active customer-facing components now covers 448/448 unique `t()` keys: active Pages routes, AuthPages, AccountSetup, AccountSecurity, Assets, Orders and Dashboard. The remaining 23 missing keys seen in the combined Pages.tsx scan belong only to legacy duplicate Assets/Orders components that are not imported by active routes.
- Known auth-provider outcomes and wallet-signature consent copy are mapped through Japanese dictionaries. The signature copy explicitly states that signing proves wallet ownership and does not authorize blockchain transactions.
- Non-Japanese locales remain incomplete outside the Dashboard/Assets/Orders batches; AuthPages is still English-fallback for some of those locales. AdminPage has not yet been localized. Japanese-first remains gated on other locale coverage, admin coverage, dynamic third-party error handling and native UI review.
- Exact-head CI for `58ca4cb4cdc1c5c9c5cec42b4b2c1b213089da32`: Backend `42472682108` PASS; PostgreSQL `42472682094` PASS; Frontend `42472682126` is still running desktop/mobile route smoke tests after install, lint, production build and Chromium install passed.



## 17. Auth provider entry layout and hosted release recheck — 2026-11-08

- Current PR #67 integration candidate was re-read at exact head `58ca4cb4cdc1c5c9c5cec42b4b2c1b213089da32`; exact-head Backend CI `42472682108`, PostgreSQL bootstrap CI `42472682094`, and Frontend CI `42472682126` are all completed / success.
- Auth provider entry layout is isolated in Draft PR #70, branch `verify2/auth-provider-entry-layout-20261108`, exact head `17348509bac3f861f948c56e43729da9dc0cd5a5`, based on the PR #67 integration branch. Only `frontend/src/features/auth/AuthPages.tsx` and `frontend/e2e/auth-routes.spec.ts` are changed. Google/Wallet buttons are equal-sized, Google left and Wallet right, directly under the primary login/register form; wallet providers remain behind the Wallet chooser; responsive test covers 320/360/375/390/768/1440px.
- PR #70 exact-head Frontend CI runs `42476520782` and `42476504102` both completed / success, including install, lint, build, Chromium, desktop/mobile route smoke tests and responsive screenshot upload. PR remains Draft/unmerged because the language keys `Google` and `Wallet` are not yet present in the shared locale dictionary at PR #67 head. Language owner was explicitly asked to add both keys to all seven locales. Do not merge until dictionary coverage and integration-head CI are rechecked.
- Hosted Supabase recheck: migration registry lists only `20261102133555` and `20261103062716`; Edge Functions list is empty. This is not a canonical migration ledger for the existing financial schema. Keep fresh-bootstrap SQL off the connected non-empty project.
- Read-only catalog confirms existing public financial RPCs (including legacy direct-fill `execute_spot_trade_atomic`) have SECURITY INVOKER, empty search_path, EXECUTE for service_role only, and no anon/authenticated EXECUTE. Current backend source does not use the legacy direct-fill RPC. Hosted canonical admin membership wrappers and versioned Seconds policy objects remain absent; admin membership therefore cannot be verified against the hosted project and must remain unavailable/fail-closed. Spot snapshot RPC is missing and enabled market count is zero.
- Security Advisor's backup-table RLS finding remains Critical in its detailed table inventory. A separate direct privilege check currently reports no private schema USAGE and no SELECT/INSERT grants to anon, authenticated, or service_role for either backup table. Treat the advisor/catalog discrepancy as unresolved; do not describe it as confirmed browser-readable exposure and do not auto-apply RLS remediation. If owner approves RLS enablement, use the advisor SQL only after confirming backup access requirements.
- No hosted DDL/data writes, Auth changes, financial actions, merge, or deployment performed. Release readiness remains blocked by hosted schema/RPC parity, real Email/Google Auth staging verification, admin bootstrap, and financial operation acceptance. Keep financial cutover flags fail-closed.

## 18. Seconds hosted-function body mismatch and runtime guard — 2026-11-08

- Read-only pg_get_functiondef inspection of the connected hosted project confirms public.submit_seconds_order_v1 has the same nine named arguments as the current API call, but its BODY is legacy: it enforces p_duration_sec IN (30,60,300,900), does not read seconds_contract_policy_active, and does not snapshot policy_version / payout_bps_snapshot. This corrects any earlier broad statement that the API argument names themselves were mismatched: the confirmed issue is the hosted function implementation/schema version, not the current request argument list.
- Canonical 0025_seconds_policy_versioning_v1.sql seeds an initial versioned policy and replaces the RPC with dynamic active-policy validation plus immutable policy snapshots. The connected hosted project lacks seconds_contract_policies and seconds_contract_policy_active, so do not enable Seconds financial cutover against it.
- Added Draft PR #71, branch fix/seconds-policy-runtime-readiness-guard-20261108, head 72b89d7ac2736995933a4634e4c80d2884b3c7f8, based on exact PR #67 head 58ca4cb4cdc1c5c9c5cec42b4b2c1b213089da32. API now checks for a valid active versioned policy and matching policy row before Seconds order creation and settlement; missing schema, empty/malformed policy or network errors fail closed with 503 before the financial RPC. Added five Node tests; isolated execution passed 5/5.
- GitHub Actions did not auto-queue PR #71 because its base is the integration branch and the existing backend/frontend workflow pull_request branch filters do not include that base. The isolated unit test result is not a substitute for exact-head full CI. Keep PR draft until a valid CI path runs.
- No hosted database writes, no financial environment flags changed, no merge or deployment.

## 19. Free hosted Staging bootstrap and schema verification — 2026-11-08

- Created a separate Supabase project `btcbox-staging` (`gnwsygxshqceunihguwe`) in `us-east-1`. The project quote was `$0/month`; no paid project or branch was created. Formal project `zlozsutefnmgwwzrlipt` was not modified.
- Verified the new project was empty before installation: zero registered migrations and zero tables in `public`/`private`.
- Applied the exact 26-file canonical SQL inventory from the integration candidate in the documented order. All 26 `apply_migration` calls returned success. A live Security/Performance Advisor review exposed one identical duplicate financial-audit index between migrations `0002` and `0021`; added canonical migration `0034_financial_audit_duplicate_index_cleanup_v1.sql`, added it to both fresh-bootstrap allowlists and the migration-order test/doc, then applied it successfully. Staging migration registry now contains 27 entries, all successful.
- Staging post-install catalog: 25 BTCBOX tables, all 25 have RLS enabled. `anon` and `authenticated` have zero direct table grants across these tables; neither role has `private` schema USAGE. `service_role` has the intended private schema/table access. Public operational RPC wrappers are SECURITY INVOKER with empty `search_path` and EXECUTE granted only to `service_role`; private admin implementation functions are SECURITY DEFINER with restricted `service_role` EXECUTE only.
- Data-state check: `auth.users` 0; `btcbox_state` 0; financial accounts/operations/ledger 0; deposits 0; withdrawals 0; Earn positions 0; enabled Spot markets 0. The canonical schema intentionally seeds seven active Earn catalog products and one initial Seconds policy version (version 1; BTC/ETH/SOL/BNB; durations 30/60/300/900) with one active pointer; these are configuration/catalog rows, not demo users, balances or transaction history.
- Security Advisor reports 25 INFO-level `rls_enabled_no_policy` notices. This matches the service-role-only design: direct grant inspection confirmed no browser-role table privileges. Do not add permissive RLS policies merely to silence these notices.
- Performance Advisor now reports no duplicate index; migration `0034` removed the redundant `financial_audit_subject_created_idx`, retaining the equivalent original `financial_audit_subject_time_idx`. Remaining INFO notices: nine unindexed foreign keys and 18 currently unused indexes on an empty/no-traffic database. Review against actual query paths before adding/removing indexes; no speculative index changes made.
- Owner-only admin bootstrap was inspected: `private.bootstrap_super_admin_v1` is SECURITY DEFINER with a restricted `search_path`; EXECUTE is granted to `postgres` only (not service_role, anon or authenticated). It was not invoked. There are zero admin memberships. No Auth provider settings, OAuth secrets, or service-role runtime credentials were exposed by the management connector. Real Email/Google sign-in, API-level authenticated financial route tests, Super Admin bootstrap and real financial flows remain NOT VERIFIED. Do not seed fake users or execute financial transactions to simulate readiness.
- PR #67 candidate includes the new migration/bootstrap/test/doc changes and the backend workflow filter update. Latest exact-head CI is pending/in progress as recorded above. PR #71's Seconds policy readiness guard and regression tests were absorbed into PR #67; PR #71 was closed unmerged as superseded, with a traceable comment. The guard now checks active policy readiness before both order and settlement RPCs. PR #67 exact-head CI is running on the absorbed code.
- No production database write, production Auth change, financial operation, merge or deployment was performed.


## 20. Staging verification refresh and Seconds CI harness fix — 2026-11-08

- Rechecked free Staging project `gnwsygxshqceunihguwe`: migration registry contains all 27 expected migrations (26 canonical files plus `0034_financial_audit_duplicate_index_cleanup_v1`); catalog contains 25 tables across public/private and all 25 have RLS enabled.
- SELECT-only data-state verification: Auth users 0; BTCBOX state rows 0; active Earn catalog products 7; Earn positions 0; financial accounts/operations/ledger 0; deposits 0; withdrawals 0; enabled Spot markets 0; Seconds policy rows 1 and active policy pointer 1. No demo users, balances or financial records were created.
- SELECT-only RPC privilege check: public Seconds/admin/Spot wrappers use SECURITY INVOKER with empty search_path and are executable only by service_role; private admin implementation functions use SECURITY DEFINER with restricted search_path and service_role execution. `private.bootstrap_super_admin_v1` currently reports service_role EXECUTE=false; this is a specific staging bootstrap-contract item to inspect before first-admin setup, not authorization to grant it broadly.
- PR #67 exact head `60e7a697cf1b1b5a0f24e0d6d065203e88e7b575`: Backend CI run 1158 PASS, PostgreSQL schema CI run 485 PASS, Frontend CI run 1197 PASS.
- PR #71 exact head `5f13802dadd8f023ebc1df04e26728a0786e7eba` CI run 1149 failed in backend tests. Logs show the isolated auth route test harness's `testRequire` did not map the new `./seconds-policy-readiness` module, causing MODULE_NOT_FOUND in auth-security-routes tests; build succeeded. Fixed the harness mapping and committed `aec7cdf64561475bbfbd7553706e699ec8d00e1a`. PR #71 was found closed without merge and reopened as Draft; exact-head CI for the fix has not yet appeared. Do not mark PR #71 verified until fresh backend CI passes.
- No production project writes, Auth provider changes, financial operations, merges, or deployments performed.


## 21. Reconciled integration status — 2026-11-08

- Re-read PR #67 directly. Its actual current head is `c2065d39afc42dbf0c2bf2f7223a7453af8ae8e0` (the earlier section-20 head `60e7a697...` is historical, not current).
- Exact-current-head CI for `c2065d39afc42dbf0c2bf2f7223a7453af8ae8e0` is now fully green: Backend run `42479320273` (run 1165), PostgreSQL schema run `42479320338` (run 488), and Frontend run `42479320367` (run 1200), all completed / success.
- PR #67 changed-file inventory confirms `backend/seconds-policy-readiness.js`, its tests, and the auth route harness mapping are included in the sole integration candidate. PR #71 is therefore superseded; do not treat its separate branch as an active lane or require its independent CI. Close it unmerged after this reconciliation.
- The integration-branch locale dictionary now contains both `Google` and `Wallet` keys. This confirms those strings exist in the dictionary source, but does not by itself establish complete seven-locale coverage or make PR #70 independently mergeable. Recheck each locale's actual values and whether PR #70's visual changes are already represented in PR #67 before changing PR #70 state.
- Clarification: Staging `private.bootstrap_super_admin_v1` is intentionally owner-controlled. Its function body rejects callers unless `session_user = 'postgres'`; EXECUTE being false for `service_role`, `anon`, and `authenticated` is expected and must not be loosened. First-admin bootstrap must use the database-owner path after the intended Auth identity exists.
- PR #67 remains Draft/open/unmerged. Green CI validates this exact source SHA only; it does not close hosted-schema drift, real Email/Google OAuth verification, admin bootstrap, or financial acceptance. No merge, production deployment, hosted database write, or financial action was performed.


## 22. Auth-entry localization and PR #70 correction — 2026-11-08

- A stricter dictionary-key check corrected section 21: the integration-branch `i18n.tsx` contains the words “Google” and “Wallet” inside other translated phrases, but does NOT currently define standalone translation keys `"Google"` and `"Wallet"`. Seven-locale coverage for these two button labels is therefore NOT VERIFIED / still missing.
- PR #70's equal-width Google/Wallet side-by-side entry buttons and responsive 320–1440px tests are NOT yet present in PR #67. Direct source comparison shows the PR #70 AuthPages implementation contains the new two-button row and wallet chooser; PR #67 still has the previous stacked Google and wallet controls. Keep PR #70 Draft and do not merge it against its stale base (`58ca4cb...`) until the language owner adds both exact keys in all seven locales and the changes are rebased/replayed onto the current PR #67 head with fresh exact-head Frontend CI.
- PR #71 is now closed unmerged as superseded; its Seconds readiness guard and regression coverage are already in PR #67. No independent PR #71 CI is required.


## 23. Staging API/RPC inventory and privilege cross-check — 2026-11-08

- Re-read the current integration source `backend/api-core.js` and `backend/admin-auth.js`. Extracted 26 distinct PostgREST RPC names used by active API call sites, including the matching-engine dynamic RPC helper.
- Ran SELECT-only catalog checks against isolated free Staging project `gnwsygxshqceunihguwe`. All 26 expected RPC names resolve in the public/private schemas. The checked signatures include the 11-argument `create_withdrawal_atomic` fee-snapshot contract, Seconds order/settlement, Earn subscribe/redeem, Spot submit/cancel, manual deposit, withdrawal review/payout, state CAS, rate-limit, and admin RBAC/policy calls.
- For every resolved API RPC name in this inventory, `service_role` has EXECUTE and both `anon` and `authenticated` have EXECUTE=false. No browser-role function grants were introduced. Public wrappers are SECURITY INVOKER with empty search_path; private RBAC implementation routines retain their SECURITY DEFINER boundary and restricted search_path. Admin wrapper names appear in both public/private namespaces by design; the two namespace implementations are not treated as duplicate overloads in one schema.
- This was a catalog/signature inventory only. It did not invoke RPCs, create users, modify Staging data, or perform financial writes. It does not prove end-to-end authenticated behavior, request replay behavior under concurrent traffic, or hosted production schema parity.
- Staging currently has no Auth users, no normalized financial accounts/operations/ledger, no deposits/withdrawals/Earn positions, and no enabled Spot markets; the active Earn catalogue has seven products and the Seconds policy/active pointer exist. Therefore real authenticated financial execution remains NOT VERIFIED and must remain gated.
- Language-team completion was deliberately bypassed for this batch so non-language API/database/security work can continue independently. PR #70 remains Draft and is not included in PR #67; its exact `Google`/`Wallet` locale keys and responsive auth-entry changes remain a separate pending integration item.
- PR #67 remains Draft/open/unmerged. No production database write, merge, deployment, Auth-provider mutation, or financial operation was performed.

## 24. Service-role privilege minimization — 2026-11-08

- A SELECT-only Staging privilege audit found Supabase default table ACLs had granted service_role DELETE, TRUNCATE, REFERENCES, and TRIGGER on multiple public tables, despite the API's financial writes being routed through RPCs. No anon or authenticated table grants were present.
- Scanned all public/private PL/pgSQL function definitions for direct DELETE/TRUNCATE. The only current delete statement is the bounded expired-row cleanup in public.btcbox_rate_limit_cleanup_v1; no function uses TRUNCATE.
- Added canonical migration 0035_service_role_privilege_minimization_v1.sql to PR #67. It revokes DELETE, TRUNCATE, REFERENCES, and TRIGGER from service_role on all public tables, then grants DELETE only on public.btcbox_rate_limits. Existing SELECT/INSERT/UPDATE privileges remain unchanged because current SECURITY INVOKER RPCs require them. The migration also narrows those default privileges for future postgres-owned public tables.
- Applied migration 0035 successfully to isolated free Staging. Post-apply SELECT-only verification shows the only remaining one of those four privilege types is DELETE on public.btcbox_rate_limits; the cleanup RPC remains executable by service_role. No financial data, Auth users, or demo records were written.
- Updated both guarded fresh-database bootstrap allowlists, the migration-order guide, and migration inventory regression coverage to include 0035. Backend CI for candidate head 3924f4f3f0b7e190bb1f09a9ad904f50fc69286f passed (42481952409); PostgreSQL and Frontend exact-head workflows were still running at last check.
- Remaining ACL note: Staging also reports a separate supabase_admin default table ACL with broad default grants. The current migration intentionally changes only the postgres-owned custom-migration default ACL; whether platform-owned future tables can be created by supabase_admin must be assessed separately before changing that role's defaults.
- Staging Security Advisor reports 25 tables with RLS enabled and no policies at INFO level. Direct privilege inspection shows no browser-role table grants; this service-role-only model must not be weakened by adding broad policies just to silence the advisory. Performance Advisor reports nine unindexed foreign keys and 18 unused indexes in this fresh, near-empty Staging environment; review actual query paths and production-like load before adding or removing indexes.
- PR #67 remains Draft/open/unmerged. No production DB write, merge, deployment, or financial operation was performed.

## 25. Expanded financial API source-contract coverage — 2026-11-08

- Extended backend/tests/rpc-source-contract.test.js with API-to-canonical-SQL signature and payload assertions for Earn subscribe/redeem, administrator manual deposit, and Seconds settlement.
- The new assertions verify the exact named RPC arguments, request-hash payload normalization, Earn request replay binding, manual-credit idempotency key and hash construction, and settlement price source/timestamp/maturity checks.
- This supplements the existing withdrawal fee-snapshot, admin membership, Seconds order/policy, and Spot cancellation source-contract tests. It remains static source-contract coverage, not live financial execution.
- New candidate head: 532f556968c505c0b1f63cab72c1ff6dbb03295b. Exact-head Backend, PostgreSQL schema, and Frontend CI were running at last check; do not mark the added tests verified until all three complete successfully.
- PR #67 remains Draft/open/unmerged. No hosted financial RPC was invoked, no production DB write or deployment was performed.
## 26. PostgreSQL 17 MAINTAIN privilege follow-up — 2026-11-08

- A follow-up ACL query found PostgreSQL 17's MAINTAIN table privilege was still granted to service_role after migration 0035 (the earlier role_table_grants view did not surface it).
- Added migration 0036_service_role_maintain_privilege_revoke_v1.sql to revoke MAINTAIN from service_role on all public tables and from future postgres-owned public tables. Applied it successfully to isolated Staging.
- Post-apply SELECT-only verification confirms MAINTAIN=false on financial_accounts, financial_ledger, btcbox_state, and btcbox_rate_limits; DELETE remains true only on btcbox_rate_limits and false on financial_accounts. The 0035/0036 combined result therefore leaves only the single required rate-limit cleanup DELETE among the reviewed elevated privileges.
- Added 0036 to both fresh-database bootstrap allowlists, migration-order documentation, and migration inventory tests. Staging migration registry now contains 29 entries (26 canonical baseline SQL files plus 0034, 0035, 0036).
- Current PR #67 head `876dc5bc6767f2a3b6af6a0b7e98235023e50815` includes this follow-up and the expanded API contract tests. Backend, PostgreSQL schema, and Frontend exact-head CI were running at last check (`42482298700`, `42482298619`, `42482298627`).
- Supabase `supabase_admin` default ACL remains separately broad; current hardening covers postgres-owned custom migration objects. Assess platform-owned object creation separately; do not claim all possible future object owners are covered.
- No production database write, merge, deployment, or financial operation was performed.
## 27. PostgreSQL 16/17 migration compatibility correction — 2026-11-08

- Exact-head PostgreSQL schema CI on 876dc5bc... exposed that disposable CI uses PostgreSQL 16 while Staging uses PostgreSQL 17. PostgreSQL 16 rejects the MAINTAIN privilege token even though Staging PostgreSQL 17 supports it.
- Updated migration 0036 to execute the MAINTAIN revokes dynamically only when server_version_num >= 170000. PostgreSQL 16 therefore skips the unsupported privilege operation; PostgreSQL 17 applies it. Staging was already successfully hardened by the equivalent direct statements before this portability correction.
- Updated the migration regression test to assert the version guard and default-privilege revocation. Candidate head 48a2f90a4bdab4a98daa2950d3e09856bb147b90 has Backend `42482389501`, PostgreSQL schema `42482389538`, and Frontend `42482389508` running; do not mark the migration fully verified until all complete successfully.
- PR #67 remains Draft/open/unmerged; no production writes, financial operations, merge, or deployment.
## 28. Migration regression assertion correction — 2026-11-08

- Backend CI on head 48a2f90a... exposed a test-only mismatch: the 0035 test incorrectly expected the MAINTAIN default-ACL statement, which belongs to 0036. Restored the 0035 assertion to check its DELETE/TRUNCATE/REFERENCES/TRIGGER revokes; the separate 0036 test checks the version-gated MAINTAIN revoke.
- PostgreSQL schema CI on 48a2f90a... passed, confirming the version-gated 0036 migration bootstraps successfully on PostgreSQL 16.
- Corrected candidate head is bcf160ef911d59f9a054d6f105873529f27ec4ed. Exact-head Backend `42482471023`, PostgreSQL schema `42482471026`, and Frontend `42482470948` are running; wait for all three before marking this batch green.
- No business implementation changed in this correction. PR #67 remains Draft/open/unmerged; no production writes or deployment.