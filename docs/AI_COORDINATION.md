# BTCBOX AI Coordination — Single Source of Truth

Last verified: 2026-11-08
Repository: `avali9308-code/btcboxcdt`

## 1. Operating rule

This file is the **only active coordination and task-status document**. Do not create parallel task lists, duplicate AI workstreams, or restart completed tasks from older notes. Historical evidence is retained in `docs/archive/AI_COORDINATION_HISTORY_2026-11-08.md`; it is reference-only and must not be treated as a live task queue.

One repository execution path is active at a time. Re-read this file before starting a batch and update this file only when the active state or verified evidence changes.

## 2. Current integration candidate

- **Active candidate:** PR #67
- **Branch:** `integration/btcbox-mainline-consolidation-20261108`
- **Verified head:** `8b54cf128ccd4861eedd1fae602846c92849f835`
- **Base:** `main` at `2a3810da1aef2c0c7c58df0cfdb059a212eeb0d6`
- **State:** Draft / open / not merged
- **Exact-head CI:** PASS
  - Backend: `42436694163`
  - PostgreSQL schema: `42436693919`
  - Frontend: `42436694030`

Exact-head evidence on `8b54cf128ccd4861eedd1fae602846c92849f835`:
- Backend `42436694163`: PASS — all 464 backend tests passed; deployment preflight passed with all financial cutover flags explicitly disabled. Preflight checks configuration shape only; it does not connect to hosted Supabase.
- PostgreSQL schema `42436693919`: PASS — canonical empty-database SQL applied successfully to disposable PostgreSQL.
- Frontend `42436694030`: PASS — lint/build and 87 desktop/mobile Playwright tests passed. The workflow generated 72 responsive screenshots across 320/360/375/390/430/768/1024/1440px and nine customer routes; automated horizontal-overflow checks passed.

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

## 6. Release and safety boundary

- Do not merge to `main`, trigger a production deployment, or resume automatic production deployment without the owner's explicit approval.
- Vercel automatically completed the current PR preview deployment; it is a preview only, not a production release. Do not use preview success as visual acceptance.
- Do not write to hosted/production Supabase, reset databases, or run destructive SQL.
- Do not perform real deposits, withdrawals, trades, settlement, KYC decisions, or financial ledger writes.
- The current database is treated as empty per the owner's latest direction; do not spend time on legacy-user migration or historical production-inventory claims.
- Preserve the locked trading-page layout and all existing API, authentication, permission, and financial contracts.
- Mark evidence accurately: SOURCE OBSERVED, REPRODUCED, TEST PASSED, or NOT VERIFIED. Never describe automated route tests as independent visual QA.

## 7. Completion rule

A task is complete only when its code is in PR #67, exact-head tests pass, and any required independent verification is recorded. Once absorbed, mark the source branch as historical and do not repeat its task list.

---
Historical coordination notes were moved unchanged to `docs/archive/AI_COORDINATION_HISTORY_2026-11-08.md`. They are retained for traceability only; this file overrides all older task/status statements.
