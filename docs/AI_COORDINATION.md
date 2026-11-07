# BTCBOX AI Coordination — Single Source of Truth

Last verified: 2026-11-08
Repository: `avali9308-code/btcboxcdt`

## 1. Operating rule

This file is the **only active coordination and task-status document**. Do not create parallel task lists, duplicate AI workstreams, or restart completed tasks from older notes. Historical evidence is retained in `docs/archive/AI_COORDINATION_HISTORY_2026-11-08.md`; it is reference-only and must not be treated as a live task queue.

One repository execution path is active at a time. Re-read this file before starting a batch and update this file only when the active state or verified evidence changes.

## 2. Current integration candidate

- **Active candidate:** PR #67
- **Branch:** `integration/btcbox-mainline-consolidation-20261108`
- **Verified head:** `bde68fdb102916d18571f94840f1c5fc8489bcbf`
- **Base:** `main` at `2a3810da1aef2c0c7c58df0cfdb059a212eeb0d6`
- **State:** Draft / open / not merged
- **Exact-head CI:** PASS
  - Backend: `42416545729`
  - PostgreSQL schema: `42416545771`
  - Frontend: `42416545736`

The three CI workflows above completed successfully on the exact PR #67 head. Frontend CI passed lint/build and 80 desktop/mobile Playwright tests. A previous frontend run exposed a stale fixed timestamp in the live-market E2E fixture; the fixture now uses the current timestamp and the exact current head passes.

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

1. Continue final PR #67 diff review against `main`; the first pass removed two out-of-scope production diagnostics, aligned the SQL guide with the empty-database direction, and corrected a stale live-market E2E timestamp. Continue checking for omissions, duplicate behavior, and frontend/backend contract regressions.
2. Run independent browser visual QA at 320/360/375/390/430px, tablet, and desktop. Automated route smoke tests do not count as screenshot-based visual acceptance.
3. Verify hosted Supabase configuration and authenticated staging behavior only when authorized test credentials/environment are available. Do not write to production.
4. Record final exact SHA, test evidence, and unresolved findings here. Keep PR #67 Draft until all required verification is complete.

No new A2 work is pending. No new visual palette batch, generic page restyling, or already-green CI rerun should be opened as a separate task without a reproduced defect.

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
