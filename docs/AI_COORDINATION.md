# BTCBOX AI Coordination

Last refreshed: 2026-11-05 (UTC+8)
Repository: `avali9308-code/btcboxcdt`
Coordination branch: `chore/shared-ai-coordination`
Observed baseline: `main` at/including merge commit `93a236e4a3ed6c9edd2003ac1068a89161015511` (PR #20, read-only account/orders API).

## Roles and boundaries

- Single-owner execution: ChatGPT is the sole active operator for repository audit, implementation, integration, testing, and coordination. Do not create parallel AI/team workstreams or wait for external AI handoffs.
- The user is the final approver for merges to `main`, production deployment, destructive operations, and material business-rule changes.

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


## Admin readiness audit — 2026-11-05

Audit scope: read-only source inspection of `btcboxcdt` main at `93a236e4a3ed6c9edd2003ac1068a89161015511`. No code, database, secrets, environment variables, production records, or deployment settings were changed.

### SOURCE OBSERVED

- The admin entry shell exists at `backend/admin.html` (blob `1347b4c32ef2c11f9f47f867a509c486ad716114`). `backend/vercel.json` rewrites `/admin` to `/admin.html`.
- The shell loads the shared SPA scripts, including `assets/js/app-core.js`, `views-account.js`, `views-missing.js`, and `boot.js`; it is not a separate admin application.
- The current SPA route registry in `backend/assets/js/app-core.js` defines `admin` only as the placeholder `Admin view loading…`. A repository search found no `VIEWS.admin` implementation in the loaded view files. The admin route therefore exists, but the actual admin management UI is NOT IMPLEMENTED in this source snapshot.
- `backend/assets/js/app-core.js` contains admin API client methods and a Basic Auth prompt. It sends an HTTP Basic Authorization header for admin API calls.
- `backend/api-core.js` authenticates every `admin/` route against server-side `ADMIN_USER` / `ADMIN_PASS`, compares credentials using `crypto.timingSafeEqual`, and persists failed-attempt counters (5 failures / 15-minute lockout).
- Backend admin endpoints are present for stats, users, user detail, addresses, withdrawals, orders, support messages, config, account freeze/unfreeze, password/email reset, manual deposit credit, withdrawal review, KYC approve/reject, announcements/push messages, address management, and audit logs.
- `backend/tests/admin-entry.test.js` checks the dedicated /admin route and Basic Auth request wiring. It does not test an implemented admin dashboard, because the route currently resolves to the placeholder.
- SQL migration files are present under `backend/supabase/sql/`, including admin adjustment and manual deposit RPC migrations. Their presence in Git does NOT prove they have been applied to the connected Supabase project.
- The old branch `integration/restore-btcbox-admin-20261104` is 79 commits behind current main and has 0 unique commits relative to main; do not merge or use it as a current integration source.

### ADMIN FUNCTIONAL GAPS / RISKS

1. **P0 — Admin UI missing:** the /admin route currently renders a placeholder; API client methods are not wired into an actual admin console view.
2. **P1 — KYC evidence incomplete:** the customer KYC view explicitly says document photo upload is not required in this version. An admin cannot perform a reliable document review from the current submitted fields alone.
3. **P1 — Withdrawal settlement incomplete:** the approve endpoint explicitly performs manual review only and does not broadcast a transaction to a blockchain. It reports approved/not yet broadcast. No end-to-end withdrawal settlement/tx-hash/confirmation workflow is established by this source inspection.
4. **Financial writes are intentionally fail-closed:** balance adjustment, manual deposit credit, and withdrawal review return `FINANCIAL_CUTOVER_INCOMPLETE` unless the full financial cutover flags are enabled. Preserve this state during audit; never enable flags or execute real financial operations as a test.
5. **Supabase-managed identity operations:** local admin password/email reset endpoints explicitly reject users managed by Supabase Auth (`SUPABASE_AUTH_MANAGED`). Any future admin user-management workflow must use a trusted server-side Supabase Auth Admin API integration, not local password hashes or client-side service credentials.
6. **NOT VERIFIED:** actual admin login against deployed environment, server-side credential configuration/rotation, applied Supabase migrations/RLS/grants, UI/API end-to-end behavior, and runtime persistence.

### NEXT ADMIN BATCH

- Build an admin page/API coverage matrix before implementation; do not redesign or alter the public frontend branding task.
- Implement the missing admin view in an isolated feature branch only after confirming ownership and the canonical runtime root.
- Cover overview, user lookup/detail, account status, deposits, withdrawals, KYC queue, orders, support, system configuration, and audit logs; visibly distinguish read-only, disabled, and actionable controls.
- Keep financial mutation controls disabled unless a separately approved staging cutover and independent QA evidence exist.
- Add tests proving admin UI rendering, API auth boundaries, role separation, route coverage, safe failure states, and no unauthenticated data leakage.
- Require exact branch SHA, tests, and independent QA before asking the user to approve merge. Do not merge or deploy.

### Evidence classification

- SOURCE OBSERVED: backend admin shell, API routes, Basic Auth implementation, admin SQL migration files, and admin route placeholder.
- SOURCE OBSERVED: legacy admin restore branch is behind main with no unique commits.
- NOT VERIFIED: working admin dashboard, live admin authentication, Supabase migration state, deployed API behavior, or real withdrawal settlement.

## Batch A follow-up — 2026-11-05

### SOURCE OBSERVED
- The active migration branch `feat/btcbox-unified-template-migration-20261105` still compares against `main` as 24 commits ahead / 49 behind. It remains isolated and must not be merged or force-updated as part of this audit.
- Vercel project `btcboxcdt` is project ID `prj_rmwOE9q0XyZ3BikpxX2FzDt2VjKK`, framework metadata `create-react-app`, `live:false`. Project metadata does not expose the `previewDeploymentsDisabled` setting in the response used for this audit.
- The latest inspected deployment is Preview/source branch `feat/btcbox-unified-template-migration-20261105`, commit `6af0210b6b2716cf5d0310fa3b7384d33bf8e808`, deployment `dpl_4miXoT3jqbzemkdgSsYXLMG5TPzZ`, state `READY`, target `null`. This confirms a READY preview artifact exists; it does not prove the latest source has been visually or functionally accepted.
- Commit `6af0210b6b2716cf5d0310fa3b7384d33bf8e808` has one reported Vercel status context marked success. GitHub Actions workflow lookup returned no PR-triggered workflow runs for this commit; do not describe this as a full CI pass.
- Open PR #19 (`fix(production): remove fake market charts and repair live page controls`) and PR #15 (`fix(market): remove fabricated chart fallback and localize page states`) have no submitted review records in the inspected review endpoint.
- Compared with `main`, PR #19's branch is 16 ahead / 54 behind; PR #15's branch is 6 ahead / 21 behind. Pairwise comparison reports PR #19's branch as 17 ahead / 40 behind PR #15's branch. Both touch overlapping chart/dashboard/i18n files; PR #19 additionally touches the shell, navigation, button hierarchy and audit document. These are divergent branches, not merge-ready independent changes.
- The latest inspected migration deployment still reports framework `create-react-app`, while the intended app source is under `frontend/` (Vite). The canonical Vercel root/build relationship remains unresolved; do not change project build settings until the intended runtime and backend routing are proven.

### COORDINATION DECISION
- Keep `main` and production untouched. Keep all work isolated from production.
- Do not merge PR #15 and PR #19 separately. AI 1 should identify a single consolidated implementation head (or rebase one owned branch onto the agreed current base), preserving the no-fake-market-data and mobile/i18n fixes without duplicate overlapping commits. AI 2 must review the exact resulting head SHA and run the relevant checks before any merge is proposed.
- AI 3 continues source-of-truth, dependency, branch and release coordination only; no direct edits to AI 1/AI 2 owned feature files.
- Continue Batch A by resolving the Vercel root/build source of truth and deployment automation state using read-only evidence. Do not trigger a deployment.

### Evidence classification
- SOURCE OBSERVED: branch divergence counts, open PR scopes, no submitted PR review records, latest preview deployment metadata, and reported Vercel commit status.
- NOT VERIFIED: Vercel preview auto-deployment disable flag, exact project root/build settings, full CI result, route-by-route runtime behavior, mobile visual acceptance, and real API end-to-end connectivity.

## Batch A build-root and deployment-cost evidence — 2026-11-05

### SOURCE OBSERVED
- Vercel deployment build events for `dpl_4miXoT3jqbzemkdgSsYXLMG5TPzZ` show entrypoint `.`, package script `btcbox-vercel@1.0.0 build`, and command `npm --prefix ../frontend install --no-audit --no-fund && npm --prefix ../frontend run build && node scripts/build-site.js`. This is the backend orchestrated build path: it builds the Vite app from `frontend/`, then assembles the customer app with legacy admin/OAuth resources.
- The same deployment logs show `tsc -b && vite build`, 1,718 modules transformed, and successful output to `dist/` plus `frontend-assets/`; `build-site.js` reports the unified public build was created.
- The same deployment's Node test run completed with `# tests 87`, `# pass 87`, `# fail 0`, `# skipped 0`; Vercel reported `Build Completed` and `Deployment completed`. This is a verified build/test result for SHA `6af0210b6b2716cf5d0310fa3b7384d33bf8e808`, not a visual or API end-to-end acceptance.
- The deployment event entrypoint is `.` and the executed package is `btcbox-vercel`, matching the inspected `backend/package.json` build script and `backend/vercel.json`. This is strong evidence the active deployment uses the backend orchestrator; the Vercel project metadata's `create-react-app` framework label is stale/inconsistent with the observed build command.
- A five-deployment history query returned three READY and two CANCELED deployments for the same migration branch within a short interval, covering successive commits `4042358`, `b728ec7`, `fe20b7d`, `4d87be0`, and `6af0210`. This confirms repeated preview builds occurred during the recent batch and supports batching commits before the next preview.
- The project update call to set `previewDeploymentsDisabled:true` returned without an API error. The subsequent `get_project` response does not expose this setting, so the flag itself remains NOT VERIFIED by readback. No new deployment was created by the setting update call.

### COORDINATION DECISION
- Treat `backend/package.json` + `backend/vercel.json` + `backend/scripts/build-site.js` as the currently evidenced deployment orchestrator. Do not delete or rewrite the root CRA package/README as cleanup until the repository owners reconcile legacy documentation and ownership.
- The actual customer runtime is the Vite app under `frontend/`; backend build orchestration keeps legacy admin/OAuth assets and API functions in the same output. Continue mapping route/API coverage before replacing pages.
- Preserve the approved Preview pause. Batch future feature changes and use local/CI checks first; request one consolidated Preview only after the implementation batch is ready.
- Do not alter Vercel framework/root/build settings based only on the stale `create-react-app` label; retain current configuration until a separately reviewed change is approved.

### Evidence classification
- TEST PASSED: build and 87/87 Node tests on `6af0210b6b2716cf5d0310fa3b7384d33bf8e808`.
- SOURCE OBSERVED: backend build orchestration, Vite output, unified dist assembly, recent deployment burst, and Vercel project framework metadata.
- NOT VERIFIED: preview-disable flag readback, canonical Vercel rootDirectory setting as a directly returned project field, browser-visible responsive behavior, actual Supabase/API runtime connectivity, and admin UI completeness.

## Batch B initial visual/data integrity audit — 2026-11-05

### SOURCE OBSERVED
- The pinned Strata Pro upstream theme uses near-black surfaces: background `#090909`, sidebar `#0B0B0C`, surface `#101113`, surface-2 `#141518`, subtle white borders around 5%, text `#F4F4F5`, secondary white at 62%, muted white at 38%, profit `#22C55E`, loss `#EF4444`, gold `#F59E0B`, and Inter.
- BTCBOX's current `frontend/src/index.css` instead defines a blue-navy palette (`#080d18`, `#0b1220`, `#101b2c`, `#17263b`), blue-tinted borders, and bright blue primary accent `#38a5ff`. The button primary variant adds a prominent blue shadow. This is a material visual divergence from the selected Strata Pro base.
- BTCBOX's current font stack adds Noto Sans JP, SC and Khmer plus JetBrains Mono. Preserve multilingual fallback coverage and monospaced numeric display where useful; do not blindly replace these with upstream Inter-only declarations.
- On the active migration branch, `dashboard.data.ts` still creates random sample candle and volume series; `LiquidityChart.tsx` and `VolumeChart.tsx` still fall back to those series when the API returns no candles. The volume card visibly labels this as `Sample series` / `Illustrative data`. The current migration deployment therefore still contains a synthetic chart fallback path.
- Both PR #15 and PR #19 branches contain chart implementations that set data only from API-provided candles and use empty/waiting states when none are returned. PR #19 also changes mobile navigation, button text wrapping, and locale coverage. Its chart file has a stale comment saying preview series are used otherwise, although the inspected implementation passes only API candles; clean up that comment during consolidation.
- The current migration branch's route registry still maps `/trade/*`, `/seconds`, `/orders`, `/deposit`, `/withdraw`, `/earn`, `/login`, `/register`, `/kyc`, `/support`, and `/settings` to generic `SectionPage` placeholders. The Assets and My pages are also explanatory shells rather than connected account views.
- The current branch's `getMarkets` and `getKlines` API adapters exist, but their presence does not establish live endpoint connectivity. Account and orders read adapters exist in `frontend/src/lib/api.ts`, but the route audit above shows they are not yet hydrated into the corresponding page views.

### COORDINATION DECISION
- For the visual system, use Strata Pro's actual theme tokens as the baseline rather than inventing new hex values. Keep BTCBOX brand identity restrained; retain locale-specific font fallbacks and mono numerals as compatibility needs. Avoid applying a second unrelated blue-heavy theme.
- For chart integrity, the migration branch's random fallback is a release-blocking data-integrity defect. AI 1 should port the no-fabricated-candles behavior from the existing chart-fix work into the consolidated current implementation; AI 2 should verify both chart components and dashboard store contain no random/demo fallback path.
- PR #19 is the broader source of the chart + mobile + locale fixes, while PR #15 overlaps on chart + locale. Do not merge either stale branch as-is. Rebase/port the required changes onto one current consolidated implementation head, then obtain independent review.
- Treat the current page placeholders as integration gaps, not finished features. Prioritize the mature page composition from Shadcn Fintech while keeping BTCBOX API/auth and all financial write boundaries authoritative.

### Evidence classification
- SOURCE OBSERVED: upstream and BTCBOX theme token values, current chart random fallback implementation, the two fix branches' no-fallback chart implementations, and current placeholder route registry.
- NOT VERIFIED: browser-rendered color/contrast quality, exact responsive behavior at the target viewport matrix, API freshness/connectivity, account hydration, and completed route integrations.


## Single-owner execution update — 2026-11-05

### Operating decision
- The user explicitly selected a single-operator workflow because parallel AI/team work created coordination noise. ChatGPT is now the only active operator; historical AI1/AI2/AI3 role references below are retained as historical evidence, not active assignments.
- Work in one isolated branch per coherent batch. Prefer one atomic commit per batch; avoid unnecessary Git pushes and Vercel builds.
- Preserve all prior safety boundaries: no production data writes, no real financial operations, no merge to main, and no production deployment without the user's approval.

### Batch 1 — remove synthetic chart fallback
- SOURCE OBSERVED: current `main` is now `14a8e361fd928626d4e350a03698135f0c49ceea`, which merged PR #21 after the previous audit baseline. The older template migration branch remains 24 ahead / 49 behind and is not a safe continuation point.
- SOURCE OBSERVED: current `main` still generated random candle/volume data in `frontend/src/features/dashboard/dashboard.data.ts`; both chart components used that data when the API returned no candles.
- IMPLEMENTED ON ISOLATED BRANCH: `fix/btcbox-no-fake-market-data-20261105`, based directly on current `main`. Three files changed: `dashboard.data.ts`, `LiquidityChart.tsx`, and `VolumeChart.tsx`. The random chart generators and fallback imports/calls were removed; chart series now use only the supplied API candles, and empty data no longer sets a fabricated logical range.
- Latest known commit on the batch branch: `39c1a970bec240cd2f1c77aa063fff0c7c130ce2`. The branch compares to current main as 3 commits ahead / 0 behind.
- SOURCE CHECK PASSED: re-fetched all three files from the branch and verified no `Math.random`, `generateCandleData`, `generateVolumeData`, or `chartData` remain in the dashboard data module; both chart components no longer contain chartData fallbacks, use mapped supplied candles, and guard empty logical ranges.
- SOURCE OBSERVED: GitHub commit status context `Vercel – btcboxcdt` reports success for the latest commit. A Vercel deployment-history query for this branch returned zero deployments. This status context alone is not a build log or a deployment; no build/test result is claimed.
- NOT VERIFIED: frontend TypeScript/build, browser-rendered empty state, live market API freshness, and all other dashboard hard-coded sample data paths.
- NEXT: inspect the remaining dashboard market data sources and page integration gaps, then apply the approved Strata visual tokens in a separate batched change after confirming all usages and shared component impact.


## Batch 2 — Strata visual token alignment — 2026-11-05

### SOURCE OBSERVED
- The pinned upstream Strata Pro repository `bymilon/strata-pro-crypto-ui` was inspected directly at `main`. Its `src/index.css` confirms the actual palette: background `#090909`, sidebar `#0B0B0C`, surface `#101113`, surface-2 `#141518`, hover white at 2.5%, border white at 5%, subtle border white at 3%, primary text `#F4F4F5`, secondary white at 62%, muted white at 38%, profit `#22C55E`, loss `#EF4444`, gold `#F59E0B`. The upstream CSS does not define a blue primary/accent token.
- BTCBOX retains Inter first plus Noto Sans JP/SC/Khmer fallbacks and JetBrains Mono. This intentionally preserves locale coverage and numeric typography rather than copying the upstream Inter-only font stack.
- IMPLEMENTED on isolated branch `feat/btcbox-strata-theme-batch-20261105`, based on current `main` `14a8e361fd928626d4e350a03698135f0c49ceea` and including Batch 1 no-fake-chart changes. Branch compare: 13 commits ahead / 0 behind. Latest known branch commit: `33a6c9348875db926d3d7b42da31cce56a3e4654`.
- Updated global theme tokens in `frontend/src/index.css` to Strata's actual surface/text/border/profit/loss/gold values. For BTCBOX's existing semantic `primary` and `brand-accent` usages, neutral white/near-black was chosen because the upstream stylesheet defines no blue primary; gold is exposed as a separate semantic token and is not spread across every control.
- Removed the legacy blue glow from shared Button default variant; changed BTCBOX sidebar brand accents to neutral silver; removed remaining sky-blue accents from dashboard eyebrow, shared page icon/link accents, and active mobile bottom navigation.
- Updated chart card controls to use the surface token, chart axis text to Strata muted opacity, and candle border/wick colors to Strata profit/loss values. Empty chart labels now say `No market data` / `Waiting for market data`; removed stale comment claiming a preview series fallback.
- Source re-fetch confirms the changed files contain the intended new values and no old sky-blue classes in the changed Sidebar, BottomNav, Dashboard, or Pages files.

### TEST / DEPLOYMENT STATUS
- GitHub combined status for latest known commit `33a6c9348875db926d3d7b42da31cce56a3e4654` reports `Vercel – btcboxcdt` failure with target URL indicating `build-rate-limit`. This is a rate-limit failure, not a TypeScript/build/test result.
- GitHub Actions workflow lookup returned no PR-triggered workflow runs for that commit.
- No Vercel deployment was initiated by the operator. The branch has no verified browser preview or visual acceptance.
- NOT VERIFIED: frontend typecheck/build after theme changes, full-page color contrast, all route/component blue utility occurrences outside the inspected shared files, actual market API freshness, and visual behavior at mobile/tablet/desktop viewports.

### NEXT
- Stop creating per-file commits. Future changes should be grouped into one atomic commit per batch, using a single tree/commit update where available; avoid any Preview build until a full batch is ready and the user authorizes it.
- Audit the remaining dashboard data module for unused hard-coded token fixtures and trace their imports before removal. Do not delete fixtures until their usage is confirmed.
- Run the canonical backend-orchestrated frontend build and Node tests locally or in non-deploying CI when a safe execution path is available. Do not use Vercel Preview as a routine test loop.
- Continue with page/API integration inventory only after the visual token batch has build evidence; preserve placeholders where API contracts are not yet verified.
