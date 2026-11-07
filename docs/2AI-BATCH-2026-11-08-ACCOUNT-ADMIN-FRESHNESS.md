# 2号 AI batch — account and Admin freshness — 2026-11-08

## Scope
Web App and Admin Panel only. No Core financial API or database contract changes.

## Fixes
- KYC approve/reject follow-up refresh now preserves a confirmed-action notice if the queue read fails; generic manual refresh failures still show a read error. Queue rows remain cleared on failure.
- Admin manual credit keeps its confirmed result visible while the selected user's balance/ledger detail reloads. If the detail read fails, the UI says the credit was confirmed and asks staff to reload user details before another action.
- Deposit history clears its prior snapshot while refreshing and reloads when the page becomes visible.
- Withdraw reloads account balances, saved-address metadata and withdrawal configuration when the page becomes visible; prior account snapshot is cleared while pending.

## Files
- `frontend/src/features/admin/AdminPage.tsx`
- `frontend/src/features/pages/Pages.tsx`
- `backend/tests/kyc-flow.test.js`
- `backend/tests/admin-api-contract.test.js`
- `backend/tests/account-page-freshness.test.js`
- `docs/AI_COORDINATION.md`

## Verification
- Prior exact-head backend CI exposed one stale KYC test assertion: 413/414 passed; frontend build passed. The implementation was then corrected to preserve confirmed review feedback, and the test now checks the guarded helper.
- Backend CI on the follow-up code before the latest account freshness changes passed: run `42413195414`.
- Latest exact HEAD: `6b51ed30fc3a15c426bedf90a35d07eb31bd1ddc`.
- Latest exact-head backend run `42413457662` and frontend run `42413457769` are running; do not mark verified until both finish. Frontend route smoke tests are part of the workflow.

## Not performed
No real KYC decision, manual credit, withdrawal, payout, order, production database write, merge or deployment.


## Test correction
- Backend run `42413457662` caught malformed regex syntax in the new test file. Replaced the regex with literal source assertions; application code was not implicated.
- Corrected test commit: `feede10fb984272f3ed49ad657d9ed23bcc5e1ff`.
- Exact-head CI: backend `42413548546`, frontend `42413548554`; both running at note update.

- Exact-head verification after the assertion correction: backend run `42413624133` PASSED unified build, all backend tests, fail-closed preflight and output/entrypoint checks. Frontend run `42413624143`: npm install, lint, production build and Chromium installation PASSED; desktop/mobile route smoke tests are still running.
