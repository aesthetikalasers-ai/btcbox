# BTCBOX recovered code integration — 2026-11-06

## Purpose

This branch is the consolidated recovery workspace for the BTCBOX work recovered from the existing BTCBOX repositories and feature branches. It is based on the current `main` commit, not V33. It must preserve the current BTCBOX React/Vite runtime and selectively port the proven business behavior from V33.

## Target and source repositories

- Target: `avali9308-code/btcboxcdt`
- Target base at branch creation: `0506ba04015018e5c283e96b0ae6fc9a362ce390`
- Recovery branch: `integration/btcbox-complete-recovered-20261106`
- Business source: `avali9308-code/btcbox-v33`
- V33 source branch: `fix/manual-withdrawal-rpc-compat-20261106`
- V33 source head observed: `d2702086ce217fa365f8a77fe4e55b5766ebbe62`
- V33 main observed: `18a354a9e8e1d0365e240c7c44eda4a18d62ce07`
- V33 feature branch is 77 commits ahead of V33 main. It is a source of business changes, not a replacement runtime.

## Recovered work inventory

### BTCBOX target repository changes already merged to main

- React 19 + Vite frontend workspace and routing.
- Strata Pro and Shadcn Fintech source pins and licensing/attribution records.
- BTCBOX visual refresh, responsive layouts, navigation and mobile improvements.
- Seven-locale i18n work and subsequent dictionary fixes.
- Removal of generated chart candles and random chart fallback.
- Read-only authenticated account/order API client.
- Recovery of the current target repository source and runtime-integration mapping.
- Orders and Assets React pages using authenticated account/order APIs.

These are recorded as code history, not as end-to-end acceptance. No claim of full product completion follows from a merged PR.

### Unmerged/recovered target branches requiring selective port or verification

- `fix/production-launch-page-audit-20261105` (PR #19, reopened for recovery review): 13 changed files; includes market search/filter, localized loading states, mobile navigation and chart presentation refinements. It is based on the earlier production commit and is not directly mergeable to current main without reconciliation.
- `feat/btcbox-react-google-auth-20261105`: Google authentication flow, auth pages, API methods and tests; 14 changed files.
- `feat/btcbox-unified-template-migration-20261105`: template source pins, build-site adjustments, attribution and assets; 43 changed files. Must not replace the React runtime or duplicate the vanilla-JS SPA.
- `feat/btcbox-web3-auth-20261105`: large divergent branch containing authentication, RBAC, seconds-policy, financial API and SQL changes. Must be reviewed file-by-file; do not merge wholesale.
- `fix/btcbox-live-chart-no-fake-data-20261105`: six changed files; portions overlap later main commits.
- Other mature UI, i18n, mobile, admin and launch-readiness branches are retained as historical evidence; several are already represented in main.

### V33 business behavior to port selectively

- Manual deposit address configuration and staff-confirmed manual credit.
- Manual withdrawal review and staff-paid completion requiring a non-empty TxID/reference.
- Seconds positions, multiple open orders, idempotent settlement and per-order policy snapshots.
- Admin policy editing and queue visibility.
- Related API contracts, SQL/RPC definitions and regression tests.

Do not copy V33's vanilla-JS SPA as a second customer runtime. Reconcile its business logic with the target React/Vite API and target database schema.

## Product rules to preserve

- Deposit: show configured address/network; staff verifies receipt and manually credits. No user-created pending deposit order, chain watcher or automatic credit.
- Withdrawal: staff review and manual transfer; staff records TxID/reference to mark paid. No automatic chain broadcast.
- Seconds: multiple unfinished orders are allowed; each order keeps its own policy snapshot and settlement time; policy bounds and payout are admin-configurable. 85% is a floor, not a fixed payout.
- Do not enable real financial writes or change production cutover flags during integration.
- Preserve the established trading-page layout.
- No production database writes, destructive resets, production deployment, or deletion of V33 as part of recovery.

## External tool access boundaries observed

- Figma authenticated account reports a View seat on the available team plan. No Figma file key or editable file URL has been recovered from repository search, so design-file edits/imports cannot yet be performed.
- No OpenAI Platform connector/tool is exposed in this ChatGPT session. Platform settings, API keys, projects, or deployments have not been changed.

## Acceptance status

The source recovery inventory is established. Feature integration and verification remain in progress.

Required before calling this a complete integrated release:
1. Frontend typecheck/build and backend test suite on the consolidated branch.
2. PostgreSQL migrations executed against an isolated fresh database, not production.
3. API contract tests for auth, seconds, manual deposit credit and manual withdrawal payout.
4. Browser checks of desktop/mobile UI, route behavior, locale switching and real API loading/error/empty states.
5. Explicit confirmation that production financial flags remain disabled.
6. Exact final commit SHA and reproducible evidence for each passing check.

Until all checks pass, do not describe the product as fully integrated or ready for release, and do not delete the V33 source repository.


## Actual integration commits added to this recovery branch

The following source code has now been copied or reconciled into this target branch (not merely referenced):

- Restored the authenticated customer API client: account, orders, seconds positions, support, deposit-address lookup, saved addresses, Earn catalog/actions, Supabase session exchange, username credentials, identity linking and 2FA.
- Restored the React authentication provider, email sign-in/registration/password reset UI, Google sign-in, account setup, linked-identity security page and authenticated route guards.
- Restored customer service pages for seconds positions/history, deposit-address lookup, saved withdrawal addresses/balances, Earn, KYC and support. The seconds page remains read-only; the deposit page follows manual staff credit.
- Restored backend auth/business API additions, admin helper modules, shared rate limiting, seconds settlement idempotency, versioned seconds policy and admin RBAC source schema.
- Restored associated Node regression tests and migration-status checks.
- Added a target-numbered migration `0027_withdrawal_manual_payout_completion_v1.sql` because target migrations 0023–0026 already have different meanings from V33. The new RPC requires a non-empty payout reference, permits completion only after approval, is idempotent for the same reference, rejects a different reference, and records status/audit only.
- Added `POST /api/admin/withdraw/mark-paid` with cutover fail-closed checks and the required TxID/reference validation.
- Recovered market search/filter behavior and removed the unused hard-coded demo market rows.

## Current integration branch and review

- Draft PR: [#26 — Integrate recovered BTCBOX frontend, authentication and business contracts](https://github.com/avali9308-code/btcboxcdt/pull/26)
- The PR is mergeable at the last check, but it is intentionally draft and must not be merged yet.
- GitHub Actions backend and frontend workflows were triggered and were still running at the last check.
- Vercel reported `build-rate-limit`; this is a platform rate limit, not a passing or failing source test.
- No local build, PostgreSQL migration execution or browser QA has been performed in this recovery session.

## Important unfinished integration work

- The admin API still authenticates with the legacy Basic Auth middleware. The Supabase Auth verifier and RBAC helpers/schema have been recovered but are not wired into the admin request path. Do not call the independent admin identity system complete.
- The modern React admin console and the user-facing withdrawal request form remain unfinished. The restored withdrawal page is read-only; the backend submission path remains fail-closed until the ledger cutover is verified.
- The spot order-entry page remains a scaffold; the Seconds customer page is read-only and does not submit or settle positions.
- The new 0027 migration has not been applied or executed in PostgreSQL. The full 0001–0027 chain must be run in an isolated database; production remains untouched.
- The manual deposit confirmation endpoint remains gated by the financial cutover flags. The user-facing deposit page only reads configured addresses; it does not create a pending deposit order.
- `frontend/vendor/strata-pro` and `frontend/vendor/shadcn-fintech` are Git submodule pins to full upstream repositories, not vendored copies inside the BTCBOX runtime. Their design language has been adapted into BTCBOX components, but upstream app pages have not all been copied into the runtime.
