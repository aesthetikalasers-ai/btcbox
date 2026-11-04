# BTCBOX AI Coordination

Last refreshed: 2026-11-05 (UTC+8)
Repository: `avali9308-code/btcboxcdt`
Coordination branch: `chore/shared-ai-coordination`
Observed baseline: `main` at/including merge commit `93a236e4a3ed6c9edd2003ac1068a89161015511` (PR #20, read-only account/orders API).

## Roles and boundaries

- AI 1 — Implementation: owns implementation work on its assigned feature/fix branches and opens PRs.
- AI 2 — Independent QA: reviews diffs, tests, responsive behavior, API contracts, and reports evidence; does not silently take over implementation ownership.
- AI 3 — Integration and coordination: maintains this document, audits repository/PR/CI state, maps dependencies and risks, coordinates batches, and does not modify other teams' owned code without explicit approval.
- The user is the final approver for merges, production deployment, destructive operations, and material business-rule changes.

## Mandatory operating rules

1. Read this file before each work batch and update it when decisions or evidence change.
2. Work on dedicated branches; do not push directly to `main`.
3. Do not merge or deploy based only on a green-looking UI or an AI assertion. Record exact head SHA, diff scope, CI/test evidence, and independent QA result.
4. Preserve existing production data, database schema/configuration, secrets, and financial records. No database reset, bulk deletion, or production write tests.
5. No real deposits, withdrawals, order placement, matching, or financial posting during QA. Use read-only paths or isolated test fixtures.
6. Keep frontend/backend API contracts explicit. Never fabricate market prices, balances, order history, or chart candles.
7. Reuse mature, license-compatible components and assets where practical; retain required license/attribution notices.
8. Prioritize mobile usability and accessible touch targets, but do not change core trading behavior or layout without explicit approval.
9. Keep deployment automation paused until the user authorizes release readiness. Do not trigger deployments during audit.
10. Classify findings as SOURCE OBSERVED, REPRODUCED, TEST PASSED, or NOT VERIFIED.

## Repository observations at refresh

- The previously designated coordination branch was absent from the branch listing; this branch was recreated from `main` and the entry point restored in commit `b792ab74c93947e7b2325d51d3a9bd07ae2e3b66`.
- Latest main commit found: `93a236e4a3ed6c9edd2003ac1068a89161015511`, merge of PR #20 (`feat/read-only-account-orders-20261105`).
- PR #20 adds authenticated read-only account/orders functions in `frontend/src/lib/api.ts`; the diff alone does not prove live API connectivity or end-to-end account hydration.
- Root `README.md` describes an English-only, mock-data CRA frontend. Root `package.json` is also CRA.
- `frontend/package.json` defines a separate Vite + React + TypeScript app with Tailwind, lightweight-charts, Radix UI and Zustand. Therefore two frontend build roots coexist. Vercel project `btcboxcdt` reports framework `create-react-app`; the deployed root and intended canonical frontend must be explicitly reconciled before code cleanup or deployment.
- Vercel project `btcboxcdt` reports `live:false`; latest deployment `dpl_5ddHpmH8cVkyYyPxEfSTwbjDzfNG` is `BLOCKED`, associated with coordination commit `b792ab74c93947e7b2325d51d3a9bd07ae2e3b66`. Vercel's returned error link points to team configuration. This is a source-observed block, not proof that automatic deployments are disabled.
- The latest ten deployments inspected for this project were all `BLOCKED`, including commits from account/orders, i18n and UI branches. No production deployment was initiated in this audit.
- Workflow lookup for merge commit `93a236e4a3ed6c9edd2003ac1068a89161015511` returned no PR-triggered workflow runs; this does not establish that all CI checks are passing or that no other workflow ran.
- Several active fix branches are heavily overlapping and have diverged from main. Compared with main, `fix/btcbox-button-hierarchy-mobile-20261105` is 43 commits ahead / 6 behind; `fix/btcbox-i18n-completeness-20261105` 33 ahead / 6 behind; `fix/btcbox-live-chart-no-fake-data-20261105` 40 ahead / 6 behind; `fix/i18n-remove-duplicate-dictionary-keys-20261105` 45 ahead / 6 behind; `fix/mobile-sidebar-close-touch-target-20261105` 45 ahead / 6 behind; `fix/production-launch-page-audit-20261105` 16 ahead / 5 behind. These counts indicate shared history/divergence, not independent merge-ready PRs.
- Pairwise comparison shows `fix/btcbox-i18n-completeness-20261105` contains the `fix/i18n-remove-duplicate-dictionary-keys-20261105` branch history plus 12 commits; the chart/no-fake-data branch and button-hierarchy branch diverge with overlapping changes; the production page audit branch also overlaps chart, topbar, mobile shell and i18n files. Do not merge these branches separately without rebasing/consolidating and re-reviewing.
- Legacy integration branches `integration/repo-reconciliation-20261104`, `integration/frontend-market-api-20261104`, and `audit/admin-launch-readiness-20261104` are behind main by 81, 53, and 77 commits respectively, with no unique commits in the compare result; treat as historical unless new evidence shows otherwise.
- Branch inventory observed: `audit/admin-launch-readiness-20261104`, `feat/btcbox-brand-assets-20261104`, `feat/btcbox-mature-ui-foundation-20261105`, `feat/btcbox-ui-i18n-mobile-20261105`, `feat/read-only-account-orders-20261105`, `feature/btcbox-react-frontend-20261104`, `fix/backend-launch-readiness-20261104`, `fix/btcbox-button-hierarchy-mobile-20261105`, `fix/btcbox-i18n-completeness-20261105`, `fix/btcbox-live-chart-no-fake-data-20261105`, `fix/i18n-remove-duplicate-dictionary-keys-20261105`, `fix/mobile-sidebar-close-touch-target-20261105`, `fix/production-launch-page-audit-20261105`, `integration/admin-fixes-on-strata-20261104`, `integration/frontend-backend-contract-map-20261104`, `integration/frontend-market-api-20261104`, `integration/repo-reconciliation-20261104`, `integration/restore-btcbox-admin-20261104`, `integration/strata-unified-build-20261104`, `main`.

## Separate Vercel production project discovered

- Vercel also has project `btcbox-v33` (project ID `prj_qMPK5OmY87BbvMPjIfaTElNuKo4i`), connected by deployment metadata to the separate repository `avali9308-code/btcbox-v33`.
- Its latest deployment `dpl_FVkD98o4uDr6a1AwdKPwUj6w9NxC` is `READY`, target `production`, alias `btcbox-v33.vercel.app`, source `main` at `18a354a9e8e1d0365e240c7c44eda4a18d62ce07`.
- This repository's current main has a minimal root README and no root package.json; its active app/backend files are under `backend/`. `backend/package.json` defines `node scripts/build-site.js`, `npm test`, and `npm run preflight`. `backend/vercel.json` builds to `dist`, deploys a catch-all `api/[...path].js` function plus `api/healthz.js`, and rewrites static pages. Treat the Vercel framework label `vite` as metadata only until build/root settings are confirmed.
- `backend/index.html` loads a static HTML/CSS/JS app with ECharts, QR generator and Supabase JS; `backend/assets/js/app-core.js` is the monolithic vanilla-JS app and documents 46 API contract endpoints plus admin endpoints. This is materially different from the Vite React app under `btcboxcdt/frontend/`.
- `backend/assets/js/app-core.js` uses same-origin `/api`, states that market/kline/depth are live and not synthesized, initializes account balances as empty until `GET /api/account`, and handles network/session failures. These are source claims, not runtime verification.
- `backend/api/[...path].js` delegates to `backend/api-adapter.js`; `backend/api-core.js` documents Supabase-backed persistent state and financial operations failing closed until transactional database cutover. `backend/scripts/deployment-preflight.js` requires Supabase URL/server credential/auth key/admin credentials and all four financial cutover flags explicitly set to `0`.
- Vercel env metadata for `btcbox-v33` confirms all four financial flags are plain `0` for both production and preview. No secret values were requested or read.
- `backend/vercel.json` has a branch-specific `git.deploymentEnabled.feature/uiux-upgrade=false`; this is not evidence that automatic deployments are globally disabled.
- The production-page audit in `btcboxcdt` PR #19 is open and targets an older deployment commit `05951f701b5a53f73089ab8e157ab310a700750d`. It records several React routes as placeholders/pending and requires CI plus browser QA. Do not assume those page statuses describe the separate `btcbox-v33` static app.

## Batch execution queue

### Batch A — establish source of truth (current)
- Resolve canonical app root: inspect Vercel root/build settings and compare the production hostname with the intended `frontend/` Vite app.
- Reconcile root README, root CRA package, `frontend/` Vite package, routes and backend contract; do not delete either app until ownership and deployment entry are proven.
- Inspect all open PRs, exact head SHAs, checks and review states; identify one consolidated UI fix candidate instead of merging overlapping branches.
- Resolve Vercel team configuration block and confirm deployment automation remains paused; do not change access or deploy without user approval.

### Batch B — mobile and visual system
- Audit shared shell, navigation, typography, spacing, cards, button hierarchy, loading/error/empty states at 320/360/375/390/430px and tablet/desktop breakpoints.
- Validate keyboard/focus, accessible labels, and minimum touch targets.
- Keep trading workflows stable unless explicit approval is recorded.

### Batch C — data and business integration
- Verify market ticker/candles are real API responses with freshness/error handling; never show fabricated fallback data as live.
- Verify auth/session, account balances, read-only orders, deposits/withdrawals UI boundaries, and admin routes against backend contracts.
- Keep all financial write paths disabled in QA.

### Batch D — localization and release readiness
- Check all visible routes for complete locale coverage, language persistence, duplicate keys, and typography.
- Run the canonical app's install/build/lint/unit/integration checks and report exact results.
- Independent QA must review each consolidated PR head SHA before any merge request is approved.

## Evidence ledger

- SOURCE OBSERVED: coordination branch was absent before restoration; current coordination commit is `b792ab74c93947e7b2325d51d3a9bd07ae2e3b66`.
- SOURCE OBSERVED: main baseline commit `93a236e4a3ed6c9edd2003ac1068a89161015511` contains read-only account/orders client functions.
- SOURCE OBSERVED: root CRA and `frontend/` Vite manifests both exist; Vercel project framework is CRA.
- SOURCE OBSERVED: Vercel project is `live:false`; latest inspected deployment is `BLOCKED` with team-configuration error link; ten most recent deployments inspected were blocked.
- SOURCE OBSERVED: listed UI fix branches overlap and diverge from main; legacy integration branches are behind main.
- NOT VERIFIED: canonical production app root, actual live API connectivity, account/order end-to-end behavior, mobile visual correctness, complete localization, complete CI status, and the reason the Vercel team configuration blocks deployments.


## UI template migration evidence — 2026-11-05

- SOURCE OBSERVED: migration branch `feat/btcbox-unified-template-migration-20261105` pins complete upstream repositories as submodules: Strata Pro at `a3f79d0237c68faddc877f8c1b00afece2fbbae8` and Shadcn Fintech at `a905058c75a840896d27a16991f2e7cc1ca06f3f`. The migration documentation explicitly states these sources are not yet part of the BTCBOX runtime.
- SOURCE OBSERVED: Strata Pro uses React 19, Vite 6, TypeScript, Tailwind CSS 4, Lightweight Charts, TanStack Table and Zustand. Its README identifies its market data as mock/demo data and excludes live trading, authentication and backend integrations.
- SOURCE OBSERVED: Shadcn Fintech uses Next.js 16 App Router, React 19, Tailwind CSS 4, Recharts, Motion, dnd-kit and Clerk. Its README describes seeded/demo financial data and simulated transfers/ticker updates. It has 11 dashboard/account-oriented pages plus sign-in/sign-up.
- SOURCE OBSERVED: the official Shadcn Fintech README warns against a malicious third-party re-upload named `Weebapp003/shadcn-fintech-template`, citing suspicious `oscar-redis` and `oracle-redis` dependencies. Only the official `abderrahimghazali/shadcn-fintech` upstream is approved for this migration.
- INTEGRATION GUIDANCE: reuse visual components and page structures selectively; do not import either template's demo market data, seeded balances/transactions, simulated transfers, Clerk auth, or mock ticker into BTCBOX. Keep BTCBOX Supabase auth/session and backend API contracts authoritative.
- NOT VERIFIED: recursive submodule clone, local install/build, route-by-route responsive behavior, and any runtime integration of either template.
- NEXT ACTION: create a page/component/dependency inventory for both pinned sources, map each candidate screen to BTCBOX routes, then settle canonical app root and dependency compatibility before implementation.
