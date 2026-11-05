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


## Batch 3 — live market data source and refresh audit — 2026-11-05

### SOURCE OBSERVED
- `frontend/src/lib/api.ts` calls same-origin `GET /api/market` and `GET /api/kline?symbol=BTCUSDT&interval=1h`, validates response shapes and finite positive OHLC values, and rejects malformed/failed responses rather than creating fallback records.
- `backend/api-core.js` implements `GET /api/market` using Coinbase spot `BASE-USDT` products/statistics as primary and Bybit spot USDT tickers as fallback for missing pairs. It returns 503 with an empty markets array if no valid provider rows are available; no fabricated price fallback was observed.
- `backend/api-core.js` implements `GET /api/kline` using Coinbase candles as primary and Bybit spot kline as fallback. Both provider paths validate provider arrays and return 503 with empty klines when unavailable; source comments explicitly prohibit synthetic candles.
- `Dashboard.tsx` previously loaded BTC/USDT 1h candles only once at mount, while market tickers refreshed every 30 seconds. IMPLEMENTED: candle retrieval now refreshes every 60 seconds, shares the component AbortController, clears the timer on unmount, and clears candle data on non-abort request failures so a failed refresh does not leave fabricated values.
- Latest known feature branch head: `0b93b1a5c77aaff5420ab1bbdf2f5c9eec5f88de`. Branch `feat/btcbox-strata-theme-batch-20261105` compares to current `main` `14a8e361fd928626d4e350a03698135f0c49ceea` as 14 commits ahead / 0 behind. Changed files: global theme CSS, shared button/sidebar/bottom nav, dashboard and chart components, and existing no-fake-data dashboard store cleanup.
- GitHub combined status lookup for latest commit returned no status contexts; GitHub Actions lookup returned no PR-triggered workflow runs. Vercel deployment-history query for this branch returned zero deployments. No build/test pass or browser verification is claimed.
- Previous commit `33a6c9348875db926d3d7b42da31cce56a3e4654` had a Vercel status failure whose target URL indicated `build-rate-limit`; it was not a code compilation result.

### NOT VERIFIED / NEXT
- NOT VERIFIED: Coinbase/Bybit live network responses from the deployed environment, actual market freshness, build/typecheck after the changes, chart empty-state visual behavior, and complete color-token usage across every route.
- `frontend/src/features/dashboard/dashboard.data.ts` still contains a static `topTokens` fixture array. The current dashboard uses `LiveMarketsTable` with API-provided markets, but the full repository import graph was not available through the current code search response. Do not delete the fixture until all references are traced.
- Avoid further per-file commits in this batch. The GitHub contents API produced individual commits for each file; next feature batch must use a single tree/commit operation if a reliable base tree can be obtained. Keep the existing Preview pause and do not trigger Vercel deployments.

## BTCBOX credential recovery batch — 2026-11-05

### IMPLEMENTED ON ISOLATED FEATURE BRANCH
- Branch: `feat/btcbox-web3-auth-20261105`.
- Latest inspected head: `3dd22811aa9cb996194569239e614af7091ca984`.
- Compare with current `main` `14a8e361fd928626d4e350a03698135f0c49ceea`: 74 commits ahead / 0 behind. This branch contains the earlier authentication, username/password, visual-token and chart work as well as the current recovery batch; it is not a merge-ready isolated patch.
- Added server-side credential reauthentication and recovery endpoints:
  - `POST /api/account/credentials/reauth` verifies the submitted token against Supabase `/auth/v1/user`, requires the verified Supabase UUID to already belong to the current BTCBOX UID, accepts only the linked Google or supported Web3 identity, and requires a fresh signed JWT `auth_time` within five minutes.
  - When BTCBOX 2FA is enabled, the reauthentication step also requires a valid TOTP code.
  - A successful check stores a short-lived, session-bound recovery marker. `POST /api/account/credentials/recover` consumes that marker once, enforces the password policy and username uniqueness, and uses the existing revision-CAS persistence path.
  - Password recovery revokes the account's other BTCBOX sessions and outstanding login 2FA temporary tokens; the current session remains active.
  - Reauthentication and recovery endpoints have per-account rate limits.
- Added frontend account-security controls for Google/Ethereum/Solana re-verification, TOTP completion, and setting a new BTCBOX password. OAuth callback state is handled without storing the new password in browser storage.
- Added source-level tests for JWT claim parsing, linked-identity requirements, the five-minute window, TOTP checks, one-time marker consumption and session revocation.

### TEST / DEPLOYMENT STATUS
- TEST ADDED: `backend/tests/account-credentials.test.js` now includes credential-recovery coverage.
- NOT VERIFIED: the new Node tests have not been executed; the frontend TypeScript build has not been run; no browser E2E has been performed with Google, MetaMask or Phantom.
- SOURCE OBSERVED: `.github/workflows/backend-ci.yml` includes `workflow_dispatch` and runs the unified build, Node tests and fail-closed preflight. The connected GitHub toolset does not expose a workflow-dispatch action, so no manual CI run was started. The workflow was not altered and no deploy-triggering push was made to its watched branches.
- SOURCE OBSERVED: latest inspected GitHub status context for the feature head is `Vercel – btcboxcdt: failure` with a `build-rate-limit` target. This is a platform quota block, not evidence of a source build failure.
- SOURCE OBSERVED: Vercel deployment lookup for this exact branch and SHA returned zero deployments. No Preview or production deployment was initiated.
- `main` and production data/configuration remain untouched.

### NOT VERIFIED / NEXT
- Verify the exact branch head with a non-deploying build/test run before any merge discussion.
- Review OAuth callback recovery, TOTP completion, token expiry and session revocation in a real browser.
- Mobile wallet sign-in still depends on injected providers; WalletConnect QR / mobile deep-link behavior is not implemented or verified.
- Do not merge or deploy until build/tests and browser QA pass, the full 73-commit branch scope is reconciled, and the user approves release.

## Mobile wallet compatibility audit — 2026-11-05

### CURRENT FRONTEND FINDING
- `frontend/package.json` currently has no dedicated wallet connector dependency.
- Current BTCBOX Web3 sign-in calls Supabase `signInWithWeb3({ chain, statement })` without passing a selected wallet object. This relies on the default `window.ethereum` / `window.solana` provider and does not provide an explicit EIP-6963 wallet chooser.
- Supabase JS already supports an explicit EIP-1193 Ethereum provider and a Solana wallet object; its published types accept `wallet.request` for Ethereum and `publicKey.toBase58()` plus `signMessage()` or `signIn()` for Solana. The official docs demonstrate EIP-6963 provider selection and the Solana Wallet Adapter.

### CONNECTOR / LICENSE REVIEW
- DO NOT add Reown AppKit or the current WalletConnect Ethereum provider as a default dependency without written commercial approval. Reown's July 2026 Terms explicitly list exchanges, brokers, VASPs and related financial businesses among use cases that may be required to enter an Enterprise Agreement; the AppKit/WalletConnect Community Licenses also impose proprietary-network and usage-threshold conditions.
- DO NOT adopt MetaMask Connect blindly. Its current repository `LICENCE` is a custom ConsenSys grant with a 10,000-MAU ceiling in its defined Non-Commercial Use; confirm the commercial license position before using it in a growing exchange product.
- Phantom Connect React SDK is MIT-licensed and advertises mobile deep-link support, but its SDK flow requires a Phantom Portal app ID for the relevant deeplink/embedded providers. Do not introduce a new app ID dependency unless that is the chosen path.
- Anza Solana Wallet Adapter is Apache-2.0 and supports Solana Wallet Standard; its mobile wallet adapter path is a separate capability and must not be assumed to cover every iOS wallet.

### PREFERRED LOW-DEPENDENCY DIRECTION
- Keep Supabase `signInWithWeb3` as the authentication authority. Do not create a custom signature-verification service.
- Ethereum: add EIP-6963 provider discovery/selection, pass the selected EIP-1193 provider through Supabase's `wallet` option, and retain `window.ethereum` as a backward-compatible fallback.
- Solana: explicitly detect supported provider objects such as Phantom's `window.phantom.solana` (rather than assuming every wallet exposes only `window.solana`); use the documented wallet-object interface and preserve the Wallet Standard path for broader wallet coverage.
- Mobile browser handoff: provide explicit, user-clicked official wallet-app links that reopen the BTCBOX sign-in URL inside the wallet's own in-app browser. Phantom documents its `/ul/browse/` universal link; MetaMask and Coinbase document their respective app-browser links. The app browser then exposes the wallet provider for the existing Supabase off-chain sign-in flow.
- Do not request transaction, token-approval, or transfer permissions for login. Only request the message-signing capability required to prove wallet ownership.
- Test iOS Safari -> wallet app -> BTCBOX callback and return, Android Chrome, desktop multi-wallet discovery, cancellation, provider switch, and touch target sizes before acceptance.

### REFERENCES REVIEWED
- Supabase Web3 auth: https://supabase.com/docs/guides/auth/auth-web3
- Supabase JS wallet types: https://github.com/supabase/auth-js/blob/master/src/lib/types.ts
- Reown Terms: https://reown.com/terms-of-service
- WalletConnect Ethereum provider license: https://github.com/WalletConnect/walletconnect-monorepo/blob/v2.0/providers/ethereum-provider/LICENSE.md
- MetaMask Connect license/repository: https://github.com/MetaMask/connect-monorepo/blob/main/LICENCE
- Phantom mobile browse link: https://docs.phantom.com/phantom-deeplinks/other-methods/browse
- Coinbase Wallet SDK: https://github.com/coinbase/coinbase-wallet-sdk
- Solana Wallet Adapter: https://github.com/anza-xyz/wallet-adapter

### STATUS
- No wallet SDK/dependency was installed in this audit.
- No wallet connection UI or production configuration was changed in this audit.
- Next implementation batch should follow the low-dependency direction above, then run non-deploying build/tests and real-device wallet QA.

## Wallet discovery and mobile handoff implementation — 2026-11-05

### IMPLEMENTED ON FEATURE BRANCH
- Feature branch: `feat/btcbox-web3-auth-20261105`.
- Latest inspected feature SHA: `8051911660efded4913a7baf8668417d189fac4e`.
- Compared with `main` `14a8e361fd928626d4e350a03698135f0c49ceea`: 76 commits ahead / 0 behind. The branch contains the previously recorded authentication and UI/theme/chart work; do not treat this large branch as a narrow merge-ready wallet patch.
- `frontend/src/lib/auth.tsx` now listens for EIP-6963 `eip6963:announceProvider`, requests announcements via `eip6963:requestProvider`, deduplicates providers by UUID, and passes the explicitly selected EIP-1193 provider to Supabase `signInWithWeb3`.
- Ethereum sign-in UI shows a wallet chooser when multiple EIP-6963 providers are discovered. If none are announced, the existing Supabase injected `window.ethereum` fallback remains.
- Solana wallet detection now explicitly checks `window.phantom.solana`, `window.braveSolana`, then `window.solana`, and passes a compatible `signIn` / `signMessage` wallet object to Supabase.
- Account security linking and password re-verification also allow selection of an announced Ethereum provider when multiple are present.
- Mobile sign-in help now provides user-clicked Phantom Browse and Coinbase Wallet Dapp universal links, and explains how to open BTCBOX in MetaMask's Explore browser. No automatic redirect or transaction request is used.
- Added source assertions for EIP-6963 discovery, Solana provider detection, Ethereum wallet selection, and mobile deep-link construction.

### SOURCE REFERENCES
- Supabase Web3 Auth guide (updated 2026-10-22): https://supabase.com/docs/guides/auth/auth-web3
- Supabase JS `signInWithWeb3`: https://supabase.com/docs/reference/javascript/auth-signinwithweb3
- EIP-6963 specification: https://eips.ethereum.org/EIPS/eip-6963
- Phantom Browse deeplink: https://docs.phantom.com/phantom-deeplinks/other-methods/browse
- Coinbase Wallet mobile deeplink: https://docs.cdp.coinbase.com/coinbase-wallet/developer-guidance/mobile-dapp-integration
- MetaMask mobile browser guidance: https://support.metamask.io/configure/wallet/how-to-use-the-metamask-mobile-browser

### VALIDATION / DEPLOYMENT
- Source changes and branch ref were re-read after commit; feature head is `8051911660efded4913a7baf8668417d189fac4e`.
- GitHub combined status currently reports `Vercel – btcboxcdt: success`, but Vercel deployment history lookup for the exact feature branch/SHA returned zero records and direct lookup of the status target returned 404. Therefore no deployment URL or completed build artifact is verified from this check.
- GitHub Actions workflow lookup returned no workflow runs for this SHA. The frontend TypeScript build and Node test suite have not been executed in a non-deploying environment; the added source assertions are not a test pass.
- No browser or real-device tests have been performed with MetaMask, Phantom, Coinbase Wallet, iOS Safari or Android Chrome.
- No Vercel deployment was created by the operator; no production merge or deployment occurred.

### NEXT
- Obtain a safe non-deploying environment to run `npm run build` and the backend Node tests. Do not use Vercel Preview merely to obtain test evidence while quota is constrained.
- Test EIP-6963 multi-wallet selection, legacy `window.ethereum` fallback, Phantom Solana injection, wallet cancellation, and mobile handoff on actual iOS and Android devices.
- Verify that the Supabase Auth project's Redirect URLs include the deployed BTCBOX login and registration routes with the required trailing-slash behavior noted in Supabase's guide.
- Keep `main`, production auth configuration, and all funds-related flows untouched until full validation and explicit release approval.

## Web3 redirect and configuration audit — 2026-11-05

### SOURCE OBSERVED
- Supabase project metadata lookup returned project `zlozsutefnmgwwzrlipt`, status `ACTIVE_HEALTHY`, region `us-east-1`. This confirms project metadata only; it does not expose Auth URL Configuration or provider/rate-limit settings.
- The current React route registry maps `/login` and `/register` to the authentication page, `/settings` to account security, and `/auth/react-callback` to the OAuth callback.
- The current Web3 calls invoke `signInWithWeb3({ chain, statement, wallet? })` without overriding `options.url`; Supabase Auth JS therefore uses the current browser URL for the SIWE/SIWS message. Web3 signing can occur on `/login`, `/register`, and `/settings`.
- Google OAuth explicitly redirects to `/auth/react-callback`; that callback must also be permitted in Supabase's redirect URL allowlist.
- Solana provider detection passes `window.phantom.solana`, `window.braveSolana`, or `window.solana` when they expose `signIn` or `signMessage`. Supabase Auth JS's current Solana wallet interface supports these methods; no custom signature-verification code or wallet SDK was added.
- The Supabase documentation currently requires the Web3 signing page's URL to be registered in Redirect URLs and gives the trailing slash as significant (e.g. `/sign-in/`). It also recommends rate limiting and CAPTCHA to reduce automated wallet-account creation.
- Supabase CLI v3 was released on 2026-11-02 and changes hosted/local command defaults; no CLI command was run in this audit.

### NOT VERIFIED / BLOCKERS
- The Supabase MCP project tools available in this session expose project metadata, database operations, and docs search, but not the project's Auth URL Configuration or Web3 rate-limit/CAPTCHA settings. Therefore the allowlist, Site URL, enabled providers, rate limits, and CAPTCHA state have NOT been verified or changed.
- The canonical deployed host for this React route set is still not established from the current source/hosting evidence. Do not guess a production hostname or add broad wildcard redirect rules.
- No browser/device wallet flow or build/test was executed in this audit.

### REQUIRED DASHBOARD CHECK
In Supabase Dashboard → Authentication → URL Configuration, confirm the exact deployed host and allowlist the following paths for that host, using the documented trailing-slash form for Web3 signing:
- `https://<actual-app-host>/login/`
- `https://<actual-app-host>/register/`
- `https://<actual-app-host>/settings/`
- `https://<actual-app-host>/auth/react-callback` (Google OAuth callback)

Also verify the Site URL and inspect Authentication → Rate Limits / CAPTCHA for Web3 abuse controls. Use the exact live app host; keep preview wildcards out of production unless separately required and narrowly scoped.

### NEXT
- Obtain a screenshot or read-only confirmation of the actual Supabase URL Configuration and Web3 provider/rate-limit/CAPTCHA settings before declaring wallet login ready.
- Keep the project configuration unchanged until the actual frontend host and required paths are confirmed.
- Continue source-level security review and seek a non-deploying build/test environment; do not use Vercel Preview for test evidence while build quota is constrained.

## Authentication touch-target refinement — 2026-11-05

- SOURCE OBSERVED: shared button variants already provide 44px minimum height for default buttons and 48px for large buttons. A focused source review found several inline authentication controls did not inherit those dimensions.
- IMPLEMENTED on `feat/btcbox-web3-auth-20261105`: expanded the password-visibility control, error-dismiss control, Phantom/Coinbase mobile handoff links, and Back to BTCBOX link to at least 44px minimum height / touch area in `frontend/src/features/auth/AuthPages.tsx`.
- Feature commit: `8182397a4066d0ac8811e5e992eae175c64c8f4e` (`fix(mobile): enlarge authentication touch targets`).
- Compared with `main` `14a8e361fd928626d4e350a03698135f0c49ceea`, the feature branch is now 77 commits ahead / 0 behind. This remains a large integration branch, not merge-ready.
- NOT VERIFIED: rendered hit-box dimensions, iOS/Android interaction, keyboard focus, or visual regressions; no build/test/browser/device run was performed. This is a source-level class refinement only.
- No Vercel deployment, production configuration change, merge, or financial operation was performed.

## CI trigger coverage review — 2026-11-05

- SOURCE OBSERVED: `.github/workflows/frontend-ci.yml` runs on pull requests touching frontend paths, but its push branch allowlist currently contains only `main`, `feature/btcbox-react-frontend-20261104`, and `feat/btcbox-react-google-auth-20261105`. The active branch `feat/btcbox-web3-auth-20261105` is not included.
- SOURCE OBSERVED: `.github/workflows/backend-ci.yml` push and pull-request branch allowlists likewise omit `feat/btcbox-web3-auth-20261105`; it includes a manual `workflow_dispatch` trigger, but no workflow-dispatch action is available in the current GitHub connector.
- RESULT: current feature branch pushes do not trigger these CI workflows by their configured branch filters. The previous absence of workflow runs is therefore consistent with the workflow configuration and is not evidence that the tests passed.
- No workflow files were changed and no workflow or deployment was triggered, because pushing workflow changes could also trigger Vercel automation and deployment automation has not been independently confirmed paused.
- NEXT: once deployment automation is confirmed paused or an isolated CI-only path is approved, add the active feature branch to both workflow filters and run the frontend lint/build plus backend build/test/preflight jobs. Keep all financial flags disabled and use dummy CI-only values only.


## Supabase redirect allowlist update — 2026-11-05

### USER CONFIRMATION
- User confirmed the four additional URLs have now been added in Supabase Authentication → URL Configuration.
- Production app host supplied by the user: `https://btcboxcdt.vercel.app`.
- Added URLs as instructed:
  - `https://btcboxcdt.vercel.app/login/`
  - `https://btcboxcdt.vercel.app/register/`
  - `https://btcboxcdt.vercel.app/settings/`
  - `https://btcboxcdt.vercel.app/auth/react-callback`
- The three Web3 signing page URLs intentionally retain trailing slashes, as required by the current Supabase Web3 guidance.
- This is USER-CONFIRMED, not independently read back from the Supabase Dashboard; the available Supabase project tools do not expose Auth URL Configuration.

### OAUTH CALLBACK DISTINCTION
- Supabase project API URL read through the project tool: `https://zlozsutefnmgwwzrlipt.supabase.co`.
- Therefore the Google Cloud OAuth client's Authorized redirect URI for the Supabase-managed Google provider should be:
  `https://zlozsutefnmgwwzrlipt.supabase.co/auth/v1/callback`
- This Google Cloud URI is different from the app's post-auth redirect `https://btcboxcdt.vercel.app/auth/react-callback`, which belongs in Supabase Redirect URLs.
- NOT VERIFIED: Google Cloud Console's actual Authorized redirect URI, Supabase Site URL, Google provider enablement/credentials, Web3 provider state, Web3 rate limits, and CAPTCHA settings. Do not change these settings without inspecting the dashboard and confirming the current values.

### NEXT
- Inspect Supabase URL Configuration screenshot/read-only confirmation for Site URL; expected production default is `https://btcboxcdt.vercel.app` (with no path), unless a deliberate alternative is configured.
- Inspect Google provider status and Google Cloud Authorized redirect URI; if the Google Cloud URI differs from the Supabase callback above, correct it in Google Cloud Console.
- Inspect Web3 rate limits and CAPTCHA before calling wallet registration launch-ready.
- No repository application code, production auth settings, database, deployment, or financial operations were changed in this update.

## Google Cloud OAuth redirect confirmation — 2026-11-05

### USER CONFIRMATION
- User confirmed the Google Cloud OAuth client's Authorized redirect URI has been added:
  `https://zlozsutefnmgwwzrlipt.supabase.co/auth/v1/callback`.
- User also showed the Authorized JavaScript origins list containing:
  - `https://btcboxcdt.vercel.app` (the selected canonical app host)
  - `http://localhost:3000` (local development)
  - `https://btcboxcdt-pi.vercel.app` (additional Google browser origin only; user decided the finished site will continue using the former `btcboxcdt.vercel.app` domain).
- Do not treat the additional `btcboxcdt-pi.vercel.app` JavaScript origin as a production-host switch. Keep the existing BTCBOX host as canonical.
- This is USER-CONFIRMED based on the user's dashboard confirmation, not independently read back from Google Cloud.

### STILL NOT VERIFIED
- Supabase Authentication → Providers → Google enabled state and configured client ID/secret.
- Supabase Authentication → URL Configuration → Site URL. Expected canonical value remains `https://btcboxcdt.vercel.app` without a path.
- Actual end-to-end Google OAuth login and callback in a browser.
- No Supabase Auth settings, repository application code, database, deployment, or financial operation was changed in this update.


## Google provider and Site URL confirmation — 2026-11-05

### USER CONFIRMATION
- User explicitly confirmed Supabase Authentication → Providers → Google is enabled.
- User explicitly confirmed Supabase Authentication → URL Configuration → Site URL is `https://btcboxcdt.vercel.app` (canonical production host, root URL with no path).
- Together with the earlier user confirmations above, the Google OAuth dashboard setup checklist is user-confirmed complete: Google JavaScript origins, Google Cloud Supabase callback URI, Supabase app Redirect URLs, Google provider enabled, and canonical Site URL.
- These are user confirmations, not independent read-back from the provider dashboard. Do not describe the OAuth flow itself as tested.

### NEXT VALIDATION
- Perform a real browser Google sign-in and verify callback, new-user account setup, and existing-user routing. This requires the user to operate the browser/account; no credentials or one-time codes should be requested in chat.
- Before any merge/release decision, obtain non-deploying frontend build and backend test evidence, then real-device/browser QA.
- Preserve the canonical host `https://btcboxcdt.vercel.app`; the additional `btcboxcdt-pi.vercel.app` origin is not a production-host change.
- No repository application code, Supabase configuration, database, deployment, or financial operation was changed by this confirmation.


## Follow-up auth source audit — 2026-11-05

### SOURCE OBSERVED
- Rechecked `feat/btcbox-web3-auth-20261105` against `main`: 77 commits ahead / 0 behind; compare reports 23 changed files. The inspected auth-related file blobs are:
  - `frontend/src/lib/auth.tsx`: `9930e21f76e18123454ebd1504c9997bfb6c704e`
  - `frontend/src/features/auth/AuthPages.tsx`: `cf3cd1045957716a6e3db6eb161228473c8bfca8`
  - `frontend/src/App.tsx`: `cb12ddb582f86905c458a785026fc5706c2db90f`
  - `frontend/src/features/auth/AccountSetupPage.tsx`: `af61c861c052e4bb73d59a8158113ff7afbc6172`
- Source inspection confirms Google OAuth uses `/auth/react-callback`, PKCE flow, explicit code exchange, then BTCBOX session exchange and account hydration. Authenticated users with missing BTCBOX credentials are routed to `/account-setup`; users with credentials are routed to `/home`.
- Source inspection confirms the wallet sign-in path requests an off-chain ownership signature and passes the selected provider to Supabase `signInWithWeb3`; no transaction authorization is requested in the statement.
- GitHub Actions workflow-run lookup for feature SHA `8182397a4066d0ac8811e5e992eae175c64c8f4e` returned no runs. The GitHub combined status endpoint returned a Vercel success context, but this status alone is not a substitute for a reproducible build, a confirmed deployment artifact, or browser QA.
- No source files were modified in this audit.

### NOT VERIFIED
- Google callback success against the live Supabase/Google client, new-vs-existing user routing, actual backend session exchange, and account hydration.
- Wallet signing across real providers/devices.
- TypeScript build, frontend tests, backend tests, or real-device visual/touch behavior.
- Whether the Vercel success context points to a currently accessible artifact for this exact branch/SHA.

### NEXT
- User-operated browser test is still required for Google OAuth. Do not request passwords, OAuth codes, or wallet seed phrases.
- Obtain a non-deploying test runner for build/unit tests; do not create a Vercel Preview while quota is constrained.
- Keep this 77-commit feature branch unmerged until full diff scope, tests, and independent browser QA are reviewed.


## Vercel Preview failure and deployment pause — 2026-11-05

### USER DIRECTION
- User explicitly instructed: the deployment failed; finish other work first and only resume deployment later.
- Treat this as a pause on ALL Vercel deployments (Preview and Production). Do not call deployment creation, promote, alias, or production deployment actions again until the user explicitly re-authorizes deployment.
- Continue source review, offline-safe fixes, documentation, and non-deploying checks only. Do not change production domain routing or Supabase production settings.

### FAILED PREVIEW EVIDENCE
- Preview deployment ID: `dpl_F6w3xwSebuqX7YncUtRietkk9mPJ`
- Preview URL: `btcboxcdt-k6rbp0wq2-box-2753.vercel.app`
- Branch: `feat/btcbox-web3-auth-20261105`
- Source SHA: `8182397a4066d0ac8811e5e992eae175c64c8f4e`
- Vercel final state: `ERROR`; error code `lint_or_type_error`; command `npm run build && npm test` exited with 1.
- Build reached frontend TypeScript compilation. The emitted diagnostics repeatedly report missing identifiers in `frontend/src/features/auth/AuthPages.tsx`, including `useAuth`, React hooks/types (`useState`, `useEffect`, `FormEvent`), router hook `useNavigate`, UI components (`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `Button`, `Input`), Lucide icons (`ShieldCheck`, `Eye`, `EyeOff`, `Wallet`, `Chrome`) and `Link`.
- Source inspection confirms the current file begins directly with `export function AuthPage...` and has no imports. This is a concrete root-cause candidate for the compiler errors; fix must be made on the feature branch under the correct file ownership and then reviewed without triggering deployment.
- No Production deployment or production alias change occurred.

### NEXT WORK WHILE DEPLOYMENTS ARE PAUSED
- Review the ownership boundary for `frontend/src/features/auth/AuthPages.tsx` before editing; do not cross another team's file ownership.
- Prepare the minimal import repair and inspect the rest of the auth page for any additional missing imports/type errors.
- Review auth/backend security and identity-linking flows, and prepare a reproducible non-deploying test path.
- Do not call Vercel deployment APIs until the user explicitly re-authorizes.


## Auth page compile-error source repair — 2026-11-05

- SOURCE OBSERVED: the failed Vercel Preview TypeScript diagnostics all pointed to unresolved names in `frontend/src/features/auth/AuthPages.tsx`; source inspection found that the file began with the component declaration and had no imports.
- FIX COMMITTED (not build-verified): restored imports for React hooks/FormEvent, React Router Link/useNavigate, the Lucide icons actually referenced, shared Button/Card/Input components, and `useAuth`.
- Feature branch: `feat/btcbox-web3-auth-20261105`.
- Repair commit: `a69f9c661262dc2eee765038c9ba004b6543ee86`.
- Resulting file blob: `ad9c6de76dd2966925625c296ba29292ff639da6`.
- This source edit is not evidence that the TypeScript build now passes; other diagnostics may appear after the first set is resolved.
- Deployment pause remains in force: no Vercel deployment was triggered by this source repair. Continue with source audit and non-deploying checks only until the user explicitly re-authorizes deployment.


## Authentication backend and account-flow audit — 2026-11-05

### SOURCE OBSERVED
- Feature branch feat/btcbox-web3-auth-20261105 is at a69f9c661262dc2eee765038c9ba004b6543ee86 after the AuthPages import repair.
- Compared with main at 14a8e361fd928626d4e350a03698135f0c49ceea, the feature branch is 78 commits ahead / 0 behind; compare reports 23 changed files. This is a large, multi-area change set and is not merge-ready merely because it is based on main.
- Backend username/password login normalizes usernames, applies per-IP and per-username counters, uses a dummy PBKDF2 derivation for unknown usernames, compares derived hashes with crypto.timingSafeEqual, returns a generic invalid-credentials response, and preserves 2FA through a temporary token.
- New BTCBOX credentials require a normalized 3–24 character username and a 12–128 character password. New hashes use PBKDF2-HMAC-SHA256 with 600,000 iterations and per-account salt.
- Supabase login verifies the supplied access token through Supabase /auth/v1/user, checks the server-side provider metadata and identity list, validates Web3 chain/address claims, rejects conflicting wallet ownership, and requires Google provider availability for Google identities.
- Password recovery re-verifies the Supabase token with /auth/v1/user, checks the signed token auth_time and sub, requires the identity to be explicitly linked to the current BTCBOX account, enforces a five-minute freshness window, preserves the account's 2FA requirement, consumes the recovery marker, and revokes other BTCBOX sessions and outstanding temporary 2FA tokens.
- The account setup page enforces matching password confirmation and a 12-character minimum in the UI; the backend independently validates the password policy.
- The AuthPages missing imports repair is present in the current feature branch. This is source inspection only, not a successful TypeScript build.

### FINDING — IDENTITY-LINK SESSION FRESHNESS
- SOURCE OBSERVED: POST /api/auth/link-identity requires the existing BTCBOX session created_at to be no more than five minutes old.
- SOURCE OBSERVED: the frontend Google/Web3 link flow authenticates the identity being added, then sends that second identity's access token to the link endpoint. The callback does not renew the existing BTCBOX session before the backend freshness check.
- IMPACT: linking another identity can fail with REAUTH_REQUIRED when the user has been signed into BTCBOX for more than five minutes, even if the newly added Google/wallet identity was just verified. Signing out and signing back into the existing BTCBOX account immediately before linking is a workaround, but the flow is unnecessarily fragile.
- STATUS: issue identified; no code change made in this batch. Before changing the contract, decide whether to require a fresh proof of the current identity as well as the new identity, or to introduce a narrowly scoped server-side reauthentication marker. Do not weaken the five-minute security requirement by merely extending the session age.

### TEST EVIDENCE AND LIMITATIONS
- SOURCE OBSERVED: backend/tests/account-credentials.test.js exercises username normalization/validation, password policy, identity-ID membership, JWT auth_time parsing, and source assertions for credential recovery, identity linking, revision-CAS persistence, and generic login failures.
- SOURCE OBSERVED: backend/tests/google-only-identity.test.js exercises single-provider acceptance/rejection, email validation, UUID shape, and Ethereum/Solana address-claim validation.
- LIMITATION: these tests include source-text assertions and isolated helper extraction; they do not by themselves prove full HTTP route behavior, Supabase token verification, concurrent database behavior, or browser end-to-end flows.
- NOT VERIFIED: no non-deploying full backend test run or frontend TypeScript build was executed in this batch. The import repair remains unbuild-verified.
- NOT VERIFIED: live Google OAuth, real Ethereum/Solana wallet providers, 2FA recovery, multi-session revocation, and the identity-link freshness edge case have not been exercised end to end.

### DEPLOYMENT AND RELEASE BOUNDARY
- The user-directed pause on all Vercel Preview and Production deployments remains in force.
- No deployment, merge, production configuration change, database mutation, or financial operation was performed in this audit.
- Next audit batch: inspect route-level session/cookie behavior and the complete auth callback state machine; then prepare a minimal, security-preserving fix for the identity-link freshness mismatch and expand behavioral tests before any deployment is reconsidered.

## Session and rate-limit follow-up — 2026-11-05

### SOURCE OBSERVED
- BTCBOX session cookies are HttpOnly, SameSite=Lax, Secure outside development, and scoped to Path=/; server-side sessions expire after seven days based on created_at.
- The five-minute identity-link check uses the same original BTCBOX session created_at timestamp; successful OAuth/Web3 verification of the identity being added does not refresh that timestamp. This confirms the previously recorded identity-link freshness mismatch.
- The backend rateCheck helper stores counters only in the module-local _rateBuckets Map. The credential reauthentication route, credential recovery route, and login 2FA route use this helper. In a serverless deployment, module memory is not a durable cross-instance rate-limit store and may reset on cold starts or differ between instances.
- Username/password login and Supabase login use separate security_counters stored in btcbox_state, but the rateCheck-protected routes do not use that same persistent counter mechanism in the inspected paths.

### SECURITY FOLLOW-UP
- Finding: per-user throttles on credential reauthentication, credential recovery, and TOTP verification are process-local rather than shared across serverless instances.
- Risk: request distribution across instances or instance restarts can weaken the intended per-account attempt ceiling. This is a defense-in-depth gap; it does not establish that an account was compromised.
- Recommendation: move these sensitive throttles to an atomic, shared counter/lock implementation (for example, a Supabase RPC with a transaction/unique key) and fail closed when the limiter cannot be updated. Do not replace this with a non-atomic read/modify/write of the whole JSON state row.
- STATUS: finding documented; no code or database changes made. Requires a reviewed atomic persistence design and isolated tests before implementation.

### VALIDATION STATUS
- SOURCE OBSERVED only. No HTTP integration tests, serverless multi-instance simulation, frontend build, or live authentication tests were run.
- All Vercel deployments remain paused at the user's direction.

## Google provider status fail-closed UI alignment — 2026-11-05

- SOURCE OBSERVED: /api/auth-client-config can return google_enabled as null when Supabase Auth settings cannot be determined. The backend Supabase login and identity-link routes already reject Google sign-in unless provider status is exactly true.
- FINDING: the frontend previously treated every value other than false as enabled, so a null/unknown provider status still displayed the Google button even though the backend would reject the exchange.
- FIX COMMITTED on feat/btcbox-web3-auth-20261105: set Google UI availability only when config.google_enabled === true.
- Commit: e9bfd4d1749180b3776d3243d96c08f822f5d497. File: frontend/src/lib/auth.tsx. New blob: 8d0a67974522b113781a7c7bcf4bb2611cbe64cf.
- STATUS: source change committed and verified by read-back in the next check; frontend build and browser behavior remain NOT VERIFIED.
- Deployment pause remains in force; no Vercel build/deployment was triggered.

## Password recovery UI policy alignment — 2026-11-05

- SOURCE OBSERVED: backend validateBtcboxLoginPassword and POST /api/account/credentials/recover require 12–128 characters and reject control characters.
- FINDING: the OAuth password-recovery page in frontend/src/features/auth/AuthPages.tsx previously advertised minLength=8 and enabled submit for 8–11 characters. The server correctly rejected those values, creating a confusing client/server policy mismatch.
- FIX COMMITTED on feat/btcbox-web3-auth-20261105: recovery password and confirmation inputs now specify minLength=12 and maxLength=128; submit is disabled below 12 or above 128 characters.
- Commit: 96ceef0189353d22ee974be920807ed281e8c090. File blob: 75d899646079bce4f857afec644739effa67588d.
- SOURCE READ-BACK: verified both recovery inputs have minLength=12/maxLength=128 and the submit condition enforces the same length bounds.
- NOT VERIFIED: no frontend build, unit test run, or browser password-recovery test was performed. Backend policy remains unchanged.
- No deployment, merge, database write, or production configuration change was performed; Vercel deployment pause remains active.
## Identity-link and shared rate-limit design audit — 2026-11-05

### SOURCE OBSERVED — identity linking
- Current feature head re-read from Git refs: `feat/btcbox-web3-auth-20261105` at `96ceef0189353d22ee974be920807ed281e8c090`.
- `backend/api-core.js` blob `b99eabff46f1bfce8b6e919b2783fe81633ccbf2`, lines 1281 onward: `POST /api/auth/link-identity` requires the existing BTCBOX session's `created_at` to be within five minutes, then verifies only the Supabase access token for the identity being added.
- `frontend/src/lib/auth.tsx` blob `8d0a67974522b113781a7c7bcf4bb2611cbe64cf`: Google and Web3 link flows authenticate the new identity and pass its access token to `linkSupabaseIdentity`; they do not first prove recent control of an identity already linked to the current BTCBOX account.
- `frontend/src/features/account/AccountSecurityPage.tsx` blob `d1efa23e9c0d495c4fa32ee0c7b41749f25542ee`: UI copy says linking requires recent sign-in and proof of new identity; fallback instructs users to sign out and sign back in if the session is no longer recent.
- Confirmed UX/contract mismatch: after five minutes, freshly verifying the new identity cannot satisfy the backend age check on the existing BTCBOX session. Signing out and signing back in is only a workaround, not a robust two-proof link flow.

### IDENTITY-LINK FIX DESIGN — NOT IMPLEMENTED
- Preserve the five-minute security window; do not extend the BTCBOX session age.
- Add a narrowly scoped, session-bound server-side `identity_link_reauth` marker minted only after a fresh Supabase token for an identity already linked to the current BTCBOX UID has been verified by `/auth/v1/user`, its signed `auth_time` and `sub` match, provider/identity claims are valid, and current-account 2FA is satisfied when enabled.
- The subsequent link request must still verify the new identity token independently, reject identity/wallet/email conflicts as today, require the marker to be no older than five minutes, bind it to the same BTCBOX UID/session and existing identity ID, and consume it on successful link. Failure/expiry must not weaken ownership checks or silently merge accounts.
- Frontend sequence should obtain proof of an existing linked method first, then proof of the new method, preserving pending flow across Google callback or wallet interaction. Never store raw access tokens in local storage or URL parameters. Avoid a generic reusable reauth flag; marker must be purpose-scoped and single-use.
- Before implementation, inspect callback routing and error handling for Google and wallet flows and add route-level tests for wrong-account proof, stale auth_time, expired marker, missing 2FA, replay, conflicting target identity, and successful one-time consumption.

### SOURCE OBSERVED — rate limiting and persistence
- `backend/api-core.js` blob `b99eabff46f1bfce8b6e919b2783fe81633ccbf2`, lines 475–490: `rateCheck` increments a module-local `_rateBuckets = new Map()`; it is not durable or shared across serverless instances.
- The same file uses this helper on credential reauthentication, credential recovery, login 2FA, 2FA setup/password checks, 2FA confirmation, and 2FA disable routes. These counters can reset on cold starts and are not coordinated across instances.
- The file's existing `btcbox_state.security_counters` helper is pure object mutation. It is used by some login/admin/fund-password paths, but persistence occurs through whole-state `saveDB`.
- `saveDB` reads/writes one `btcbox_state` JSON document using `btcbox_save_state(p_expected_revision, p_data)`; `backend/supabase/sql/0001_btcbox_state_cas.sql` atomically checks the whole-row revision and replaces the full JSON document. This protects state writes from silent overwrite but is not a dedicated atomic increment/lock primitive for high-contention rate-limit keys.
- Therefore a non-atomic read/modify/write of `security_counters` is not an acceptable fix. Reusing whole-state CAS without bounded conflict retry and a dedicated limiter contract risks contention with unrelated account/session updates.

### RATE-LIMITER FIX DESIGN — NOT IMPLEMENTED
- Prefer a dedicated table keyed by a deterministic HMAC of the limiter scope/key, with a database-side RPC that atomically creates/resets/increments a window and returns limited/retry-after. Do not persist raw IP addresses, usernames, wallet addresses, or access tokens as limiter keys.
- Define explicit window semantics (fixed window or token bucket), expiry/cleanup, maximum key cardinality, and bounded payload. The database function must enforce the cap atomically under concurrent requests (row lock/upsert semantics), not rely on client read/modify/write.
- Use a separate namespace/purpose per route family so credential recovery cannot consume or reset a 2FA or identity-link budget unexpectedly. Decide whether limits are per account, per IP, per identity, or layered combinations, and document each.
- Fail closed with a safe 503/429 behavior if limiter RPC is unavailable; do not silently fall back to process memory.
- Add SQL migration and isolated PostgreSQL concurrency tests first. Do not apply the migration to the connected production Supabase project without explicit user approval. Then add API tests for concurrent increments, expiry/reset, limit boundary, retry-after, RPC failure, and multi-instance consistency.

### VALIDATION / RELEASE STATUS
- SOURCE OBSERVED only. No code or SQL migration was changed in this audit; no production database was touched.
- No backend tests, frontend build, HTTP integration tests, browser QA, or multi-instance simulation were run.
- Latest feature branch head verified through Git refs: `96ceef0189353d22ee974be920807ed281e8c090`.
- Latest coordination branch head before this entry: `6823487e4fbcf359bda065394986036ac0cca39a`.
- All Vercel Preview and Production deployments remain paused at the user's direction. No merge or deployment was performed.
## Follow-up implementation contract — complete limiter call-site inventory — 2026-11-05

### SOURCE OBSERVED — every process-local rateCheck call site
- `backend/api-core.js` blob `b99eabff46f1bfce8b6e919b2783fe81633ccbf2` contains ten active call sites (excluding the helper definition): line 1055 `login/2fa` (20 / 15 min); 1133 `account/credentials/reauth` (8 / 15 min); 1192 `account/credentials/recover` (5 / 15 min); 1375 `2fa-setup-password` (10 / 15 min); 1388 `2fa-setup-confirm` (10 / 15 min); 1398 `2fa-disable` (10 / 15 min); 1844 `seconds/order` (30 / 5 min); 1877 `seconds/settle` (60 / 5 min); 1945 `settings/password` (10 / 15 min); 1962 `settings/fundpwd` (10 / 15 min).
- The limiter migration must cover all ten call sites as one consistent replacement, not just auth routes. In particular, seconds order/settle are currently fail-closed while financial cutover is disabled, but the local limiter must not silently become the only shared-instance guard if those routes are ever enabled later.
- `seconds/order` and `seconds/settle` already rely on server-side PostgreSQL financial RPCs for ledger safety and idempotency; a durable request throttle is a separate control and must not replace those protections.
- `settings/password` and `settings/fundpwd` have independent credential / 2FA checks; preserve their existing policy and route-specific limits while moving only the counter mechanism.

### RATE-LIMITER IMPLEMENTATION CONTRACT — refined
- Replace all ten call sites through one async helper, e.g. `await rateCheckShared(scope, key, max, windowMs)`. Any RPC error, timeout, malformed response, or missing required HMAC secret must fail closed with a generic 503; a valid over-limit result remains 429 with `Retry-After`.
- The limiter key should be HMAC-SHA256 over a canonical, bounded scope+subject string using a dedicated server secret such as `BTCBOX_RATE_LIMIT_HMAC_SECRET`; never store raw IP, username, account UID, wallet address, session token, or Supabase token in the limiter table. Missing/short secret must disable protected operations rather than falling back to memory.
- Use a dedicated fixed-window table with `(scope, key_hash, window_start)` uniqueness, server-side time/window calculation, atomic upsert/increment, explicit maximum counter bounds, and a returned `allowed`, `retry_after_seconds`, and `remaining` result. The RPC should derive the current window from database time and validate allowed scopes/limits rather than trusting arbitrary client-provided limits.
- Define route scopes explicitly and preserve current limits: `login_2fa` 20/900s; `credential_reauth` 8/900s; `credential_recover` 5/900s; `twofa_setup_password` 10/900s; `twofa_setup_confirm` 10/900s; `twofa_disable` 10/900s; `seconds_order` 30/300s; `seconds_settle` 60/300s; `password_change` 10/900s; `fund_password_change` 10/900s.
- Add bounded retention/cleanup for expired windows and a documented strategy for high-cardinality anonymous IP keys. If using layered per-account and per-IP limits, each layer must have its own deterministic scope and atomic call; do not silently change existing per-user scope semantics in the first migration.
- Tests must include simultaneous requests at the boundary (only max allowed), parallel requests across separate DB connections, same key/scope consistency, scope isolation, window rollover, invalid parameters, missing secret, RPC timeout/failure, malformed RPC response, and 429 Retry-After behavior. Include a serverless-style test using two independent API instances against the same PostgreSQL database.

### IDENTITY-LINK FRONTEND / API SEQUENCE — refined
- The server endpoint that creates the marker must accept only a fresh token for an identity already linked to the current BTCBOX account, verify it against Supabase `/auth/v1/user`, check signed JWT `sub` equals the returned identity ID, require `auth_time` no older than 300 seconds (and not materially in the future), require the provider is supported and linked to the current account, and enforce current account 2FA when enabled.
- Suggested endpoint contract: `POST /api/auth/link-identity/reauth` with `{supabase_access_token, twofa_code?}`; on success store `{purpose:'identity_link', supabase_user_id, auth_time, verified_at}` in the current server-side BTCBOX session. Never return a reusable bearer marker to JavaScript.
- `POST /api/auth/link-identity` must still independently verify the target identity token, reject target identity equal to the reauth identity, run all existing duplicate/conflict checks, require marker purpose/session/account binding and age <=300 seconds, and delete the marker in the same successful `saveDB` write that persists the new identity. Do not consume the marker before a failed target verification or conflict check; it should be consumed on successful link only.
- Frontend must explicitly choose an existing linked identity to reauthenticate (Google or the appropriate wallet), handle 2FA if enabled, then initiate the target identity's Google OAuth or wallet signature. Keep the browser's pending flow only as non-secret intent state; never persist access tokens or marker secrets in localStorage/sessionStorage or URL parameters. Clear pending intent on cancel, callback error, expiry, sign-out, or account change.
- Google callback must distinguish `flow=link-reauth` from `flow=link-target`; never let the target OAuth callback be mistaken for the existing-identity proof. Wallet reauth and wallet target proof should use distinct statements and separate server calls.
- Account security UI must explain the two-step sequence and show which existing method is being reverified. If no existing identity can be reauthenticated, linking must be unavailable rather than bypassing the proof.
- Route-level tests must validate linked-source proof, wrong BTCBOX account, target/source same identity, missing or invalid 2FA, stale/future auth_time, expired marker, wrong purpose, session binding, marker replay, conflict target, storage CAS conflict, and successful one-time marker consumption.

### VALIDATION STATUS
- The ten-call-site inventory is source-read from `backend/api-core.js`; no limiter code or SQL was changed in this follow-up.
- The implementation contract above is a proposal for feature-branch work only. No production Supabase migration was applied, no Vercel build/deployment was run, and no merge occurred.
- Current feature head at time of inventory: `96ceef0189353d22ee974be920807ed281e8c090`. Current coordination head before this update: `68a8ee09ee14dc397f9cd987bf52254145b07cc0`.
## Shared rate-limit migration draft — 2026-11-05

### IMPLEMENTED ON FEATURE BRANCH — SQL DRAFT ONLY
- Added `backend/supabase/sql/0023_btcbox_shared_rate_limit_v1.sql` on `feat/btcbox-web3-auth-20261105`.
- Commit: `451cd4e63f31de9f07f7fa08b8b400c22ac62aad`; SQL blob: `19e8fb925e60cfbeab2de873408df6f762c6d57d`.
- Defines `public.btcbox_rate_limits` with a composite primary key `(scope, key_hash, window_start)`, a 64-character lowercase HMAC key constraint, bounded integer counters, RLS enabled, and direct table grants restricted to `service_role`.
- Defines `btcbox_rate_limit_consume_v1(scope,key_hash)` with an allowlisted ten-scope policy matching the existing limits, database-clock fixed windows, and a single `INSERT ... ON CONFLICT DO UPDATE` increment so concurrent requests serialize on the unique row.
- Defines a bounded cleanup RPC deleting at most 5,000 rows older than 48 hours per invocation; scheduling is not configured by this migration.
- The RPC returns allowed/limit/count/remaining/retry-after/window-start data. The API caller must validate the shape and expected policy before acting.

### IMPORTANT — NOT WIRED OR APPLIED
- This commit adds only the SQL migration draft. `backend/api-core.js` still uses process-local `rateCheck`; no runtime behavior has changed.
- No PostgreSQL parser, isolated database execution, concurrent transaction test, or RPC integration test has been run. The migration is not yet syntax- or behavior-validated against PostgreSQL.
- The new migration has not been applied to staging or production. Production Supabase was not touched.
- Before runtime integration, configure a dedicated server secret `BTCBOX_RATE_LIMIT_HMAC_SECRET` of at least 32 random bytes in the target deployment environment. Missing/invalid secret must fail closed; do not fall back to process memory.
- Next work: add SQL return `window_seconds` (so API can assert the expected policy), validate SQL in disposable PostgreSQL, test concurrent upserts from separate connections, then integrate an async fail-closed helper and migrate all ten call sites in one feature-branch batch.
- Deployment pause remains active. No Vercel build/deployment or merge was triggered.
## Additional identity-link freshness finding — 2026-11-05

### SOURCE OBSERVED
- In `backend/api-core.js` blob `b99eabff46f1bfce8b6e919b2783fe81633ccbf2`, the current `POST /api/auth/link-identity` route checks only the BTCBOX cookie session `created_at` against a five-minute age and verifies the target access token through Supabase `/auth/v1/user`.
- Unlike the credential reauthentication route, the target identity-link route does not parse the verified JWT `auth_time`, compare its `sub` with the returned Supabase user ID, or enforce a five-minute provider authentication freshness window.
- A recently created BTCBOX session therefore does not, by itself, prove that the target Google/Web3 identity was freshly authenticated. This is a separate gap from the previously recorded missing proof of an already-linked source identity.

### REQUIRED FIX
- The eventual two-proof flow must validate freshness independently for both source and target identities: each token must be accepted by Supabase `/auth/v1/user`, each signed JWT subject must equal the returned identity ID, and each auth_time must be within 300 seconds with a bounded future skew.
- Keep account ownership checks separate: source proof must map to an identity already linked to this BTCBOX UID; target proof must be a distinct identity and must pass all current duplicate wallet/email/account conflict checks.
- Do not treat `session.created_at` as a substitute for Supabase provider reauthentication freshness.
- Add tests for stale target auth_time, mismatched target JWT sub, target token accepted by Supabase but authenticated too long ago, and valid source+target proofs.

### STATUS
- Finding is source-observed only. No code change, database change, test run, merge, or deployment was performed.
## Identity-link two-proof backend implementation — 2026-11-05

### IMPLEMENTED ON FEATURE BRANCH — NOT END-TO-END VERIFIED
- Feature branch commit `855a2c06d186a7879e9bcc39ce8c7bf5043e6d0f` adds `POST /api/auth/link-identity/reauth`.
- The new route verifies the source access token through Supabase `/auth/v1/user`, checks JWT subject equality and `auth_time` freshness (300 seconds, 60-second future allowance), validates Google/Web3 provider claims, requires that source identity is already linked to the current BTCBOX account, and enforces account TOTP when enabled.
- On success, the route persists a purpose-scoped `identity_link_reauth` marker in the current server-side session. No marker is returned to the browser.
- `POST /api/auth/link-identity` now requires that marker, checks purpose, current account identity membership, marker age, auth_time age, and source/target inequality. It independently verifies the target Supabase identity and its JWT subject/auth_time freshness, then deletes the marker in the same state save that persists the linked identity.
- Feature branch commit `ed2a7a401402ada87150ade865a2f068c8d5fc22` added independent target token subject/auth_time checks.
- Added source-contract assertions in `backend/tests/account-credentials.test.js`, commit `a2abd34f5cfe97b17f224b10c5f34e62f5a46ce4`.

### IMPORTANT VALIDATION LIMITS
- These are source changes only. The test file was not executed; no full HTTP route harness, Supabase token integration, TOTP integration, concurrent CAS/replay test, frontend build, or browser flow was run.
- The existing frontend link actions have not yet been converted to the new two-step API sequence. Until that is implemented and tested, identity linking is intentionally fail-closed and may return `REAUTH_REQUIRED`; do not describe linking as user-ready.
- The source/target same-identity check currently happens after in-memory account object preparation but before `saveDB`; no persisted account mutation occurs on that rejection. Review this ordering in the next pass for clarity.
- Deployment pause remains active. No merge, production database change, Vercel build, or deployment occurred.

## Shared PostgreSQL rate limiter — runtime integration draft — 2026-11-05

### IMPLEMENTED ON FEATURE BRANCH — NOT VERIFIED
- Replaced all ten process-local `rateCheck` call sites in `backend/api-core.js` with awaited `rateCheckShared(scope, subject)` calls. The local `_rateBuckets` Map and synchronous `rateCheck` helper have been removed.
- Runtime helper uses the dedicated `BTCBOX_RATE_LIMIT_HMAC_SECRET` (minimum 32 UTF-8 bytes) to HMAC-SHA256 the bounded `scope|subject` input. Raw account IDs are not sent to or stored in the limiter table.
- Runtime calls `public.btcbox_rate_limit_consume_v1` using the existing server-only Supabase service-role headers, validates the RPC response against the exact per-scope policy including `window_seconds`, and fails closed with generic 503 on missing configuration, timeout, RPC error, or malformed response. Valid over-limit responses return 429 with `Retry-After`.
- Migrated scopes and preserved limits: `login_2fa` 20/900s; `credential_reauth` 8/900s; `credential_recover` 5/900s; `twofa_setup_password` 10/900s; `twofa_setup_confirm` 10/900s; `twofa_disable` 10/900s; `seconds_order` 30/300s; `seconds_settle` 60/300s; `password_change` 10/900s; `fund_password_change` 10/900s.
- SQL migration now returns `window_seconds` so the API can validate the server-side policy.
- Added `backend/tests/shared-rate-limit.test.js` with source-contract checks for all ten scopes, HMAC/fail-closed behavior, atomic upsert/retention SQL, and identity source-target guard ordering.
- Moved the identity-link same-source/target rejection before in-memory account identity arrays are mutated.

### CURRENT FEATURE BRANCH COMMITS
- `bd2e32c344451d41aef65a94a114ed88045b39e1` — initial shared limiter runtime replacement and ten call-site migration.
- `54e42b38a44fdc850ab113477850b837442157f3` — corrected canonical HMAC key encoding and URL normalization.
- `141e58bb8bd76fa2b72a6b700f23cbf2d4ee3cb3` — SQL RPC returns `window_seconds`.
- `ece4365a82c8641665f04fc8329a4057eadb1371` — reject same source/target before account mutation.
- `6d3cba3c5aa0a663725dba1783a83eef945ca5e9` — add static contract tests.
- Latest feature branch commit recorded at this update: `6d3cba3c5aa0a663725dba1783a83eef945ca5e9`.

### IMPORTANT VALIDATION / CONFIGURATION LIMITS
- These are source-level changes only. The test suite was not executed; no Node syntax check, PostgreSQL migration execution, isolated DB concurrency test, multi-instance simulation, HTTP route integration test, frontend build, or browser E2E was run.
- The SQL migration remains unapplied. No production or staging Supabase database was changed.
- Vercel environment-variable names/values were not read or changed in this batch, so whether `BTCBOX_RATE_LIMIT_HMAC_SECRET` is already configured remains unverified. Until the migration is applied in an approved isolated environment and a valid secret (minimum 32 UTF-8 bytes) is confirmed in the target runtime, every route using the shared limiter will deliberately fail closed with 503. Do not deploy this feature branch as-is.
- Next: review the SQL/function permissions and response contract in an isolated PostgreSQL database; execute the new tests and concurrency tests; then implement the frontend two-proof identity-link sequence. The existing frontend still starts the target identity flow directly and has not yet been converted to source reauthentication followed by target verification.
- No merge, production DB change, Vercel Preview/Production build, or deployment was performed. Deployment pause remains active.


## Identity-link frontend two-proof flow — 2026-11-05

### IMPLEMENTED ON FEATURE BRANCH — SOURCE REVIEW ONLY
- Added frontend API helper `reauthenticateIdentityForLink(accessToken, twoFactorCode)` for `POST /api/auth/link-identity/reauth`.
- Replaced the old direct target-first flow with two explicit steps in `AccountSecurityPage.tsx`: freshly verify an already-connected Google/Web3 identity first, then verify a distinct new Google/Web3 identity.
- Google source proof uses OAuth callback `flow=link-reauth`; Web3 source proof uses a distinct wallet-signature statement and calls the source reauth endpoint directly.
- Google target proof uses callback `flow=link-target`; Web3 target proof calls the existing target identity endpoint only after source verification.
- Added Google source TOTP handling: if the backend returns `TWO_FACTOR_REQUIRED`, the short-lived source access token remains only in AuthProvider React memory while the user enters the account authenticator code. No token or reauth marker is written to URL, localStorage, or sessionStorage.
- After successful target linking, the frontend clears its local source-verification state and the backend consumes the server-side marker during the account save.
- Added `backend/tests/identity-link-frontend-contract.test.js` source-contract checks for two-step flow, TOTP handling, endpoint wiring, and no URL/storage token handling.

### FEATURE BRANCH COMMITS
- `3818f38884fafff77184b1928d6641ae06dc0b50` — add source identity reauthentication API client.
- `e6a9a743c2960f6947a2f37878a11abb57667ff7` — add two-proof identity linking to AuthProvider.
- `97431df46c5b8804b7a44fc61afdcdb37de79c02` — add Google source-proof TOTP challenge.
- `c940bc4d8b13c6b84ae370f80007420b57b56a57` — add two-step source/target UI.
- `e09856b9ce1e144209b2fb3002d1b9b2d17cab18` — clear state after successful link and stabilize context dependencies.
- `661aaf8ac233ef851ccf2cb8e4fa66c9586a2404` — keep BTCBOX authenticated while Google source TOTP is pending.
- `8567048ce10d39f4cfd32b3b9c010e5dc8839bef` — add frontend identity-link source-contract tests.
- Feature branch latest commit at this update: `8567048ce10d39f4cfd32b3b9c010e5dc8839bef`.

### VALIDATION LIMITS / FOLLOW-UP
- Source files were fetched back from GitHub and reviewed for the expected endpoint, callbacks, UI steps, and TOTP state wiring. The new test file was not executed; no TypeScript build, lint, unit test, browser OAuth round-trip, wallet signature, account TOTP, stale marker, marker replay, or CAS concurrency test was run.
- The Google TOTP path intentionally keeps the access token in volatile React memory only while the callback page remains mounted. A full page reload during this challenge discards it and requires starting verification again; this is fail-safe.
- The current UI supports source proof only for linked providers surfaced by the account snapshot and wallets available through the injected provider APIs. A linked wallet not currently accessible in the browser cannot be reverified from this device.
- The new frontend path must be exercised against the backend before describing identity linking as user-ready.
- The separate shared rate-limiter SQL migration remains unapplied; no production/staging DB changes, no Vercel env changes, no merge, and no deployment were performed. Deployment pause remains active.


## Identity-link reauthentication rate-limit hardening — 2026-11-05

### SOURCE OBSERVED
- The new `POST /api/auth/link-identity/reauth` endpoint verified fresh linked Google/Web3 proof and optional account TOTP, but it did not consume the shared database-backed rate limiter. The ten-scope shared limiter policy therefore left this sensitive endpoint without its own cross-instance request budget.
- The feature branch already contains the source/target two-proof flow and the shared PostgreSQL limiter migration draft; the migration is still unapplied.

### IMPLEMENTED ON FEATURE BRANCH — NOT TESTED
- Added `identity_link_reauth` shared rate-limit scope: 8 requests per 900 seconds, keyed by HMAC of the BTCBOX UID through the existing shared limiter.
- The endpoint now fails closed with the standard 503 response if the shared limiter is unavailable and returns the standard 429/Retry-After response when limited.
- Added the matching fixed policy to migration `0023_btcbox_shared_rate_limit_v1.sql` and source-contract assertions in `shared-rate-limit.test.js` and `account-credentials.test.js`.
- Feature branch commit: `458991da846dc18be929c88150ed652468686e6f`.
- Changed file blob SHAs: `backend/api-core.js` `ca142b47d45527a30e69a1a148408dd8359e3965`; migration `1017b1a790ea5ee0358196bb8591d85688e17f10`; shared limiter test `fac45a2074e673641cbd2427ee99b77d9aca3a4b`; account credentials test `4e24f05f31a43b70b5b9dcaad1a18523fc8e5d38`.

### VALIDATION LIMITS
- GitHub source read-back confirms the API policy, endpoint call site, SQL scope, and both test assertions are present.
- Tests were not executed; no Node syntax check, HTTP route integration, Postgres migration execution, concurrency/replay test, frontend build, or browser OAuth/wallet/TOTP test was run.
- The migration remains unapplied and the Vercel HMAC secret remains unverified. Because the route fails closed through the shared limiter, it will return 503 until the approved database migration and runtime secret configuration are in place.
- No production/staging database was changed; no merge or Vercel build/deployment was triggered. Deployment pause remains active.


## Latest source audit — 2026-11-05

Feature branch `feat/btcbox-web3-auth-20261105` at `48d82c0877dd945d7a4f4115f3cfa56b8a5f71a6` now includes a twelve-scope shared request guard. Source read-back confirms each scope appears in the API policy and call site, migration CHECK and RPC CASE, and the source-contract test. The target route uses the shared guard and consistent Auth URL fallback. Tests and database execution remain pending. No database changes, merge, or deployment; release pause remains active.


## CI coverage for active auth feature branch — 2026-11-05

The backend CI branch filters were pointing at an older auth branch. Updated both push and pull-request filters to include `feat/btcbox-web3-auth-20261105`. This CI workflow runs the unified build, backend test suite, and fail-closed preflight; it contains no Vercel deployment step. GitHub Actions run `42052460527` was created for feature SHA `86af1338b21d9576e334070c826c554a1f85d14d` and was observed in progress at the time of this note. Do not treat the run as passed until its completed conclusion and logs are inspected. The Vercel deployment pause remains unchanged.


## CI validation and identity-link cleanup — 2026-11-05

- Removed the obsolete direct identity-link callback from the React AuthContext. The supported UI flow now exposes the explicit source-proof then target-proof actions; backend session marker validation remains authoritative.
- First backend CI run identified two stale source assertions: one expected an untyped Web3 provider call, and one compared source positions across the entire API file instead of the identity-link route. Updated both tests to match the typed call and scope the ordering assertion to that route.
- Updated frontend CI branch coverage for `feat/btcbox-web3-auth-20261105`; frontend CI run `42052761320` completed successfully at SHA `d49aafe0ab4386a9c6af1be91667f7ddc05b34b3`.
- Updated backend CI path coverage so changes to the auth provider and frontend CI workflow run the unified build and backend tests. Backend CI run `42052795499` completed successfully at SHA `cbe90673585f8a7916b41b235ce4ec584b9097fd`: unified build succeeded; 109 tests passed, 0 failed; fail-closed preflight succeeded; preserved-entrypoint checks succeeded.
- CI logs show a Vite chunk-size warning and Node/action deprecation warnings; neither failed the run. The workflow contains no Vercel deployment step.
- Latest feature branch SHA at this note: `cbe90673585f8a7916b41b235ce4ec584b9097fd`. These CI results apply to that SHA, not to any later commits.
- The PostgreSQL migration remains unapplied; live database role/RLS/atomicity checks, browser OAuth, wallet, and TOTP end-to-end checks remain outstanding. No production database change, merge, or Vercel deployment was performed; deployment pause remains active.

## Credential recovery marker hardening — 2026-11-05

- Feature branch feat/btcbox-web3-auth-20261105 commit 13d6c2144eead13c97a4bae5bc2ed02f4aede92a adds an explicit purpose: credential_recovery to the server-side reauthentication marker and requires that exact purpose before password recovery.
- Recovery now rechecks that the stored Supabase auth_time is not more than 60 seconds in the future and is no older than five minutes at consumption time. The marker remains scoped to the authenticated server session, is deleted in the same revision-CAS save as the password update, and other sessions/temporary 2FA tokens are revoked in that save.
- Added source-contract assertions in backend/tests/account-credentials.test.js for marker purpose, future-skew rejection, one-time marker deletion, and retention of the current session. Follow-up test-boundary correction is commit f78e6668ca287f8244ff7ef2dbbca6339bbee5d7.
- Latest feature branch SHA at this note: f78e6668ca287f8244ff7ef2dbbca6339bbee5d7.
- Backend CI run 42053670582 completed successfully for latest feature SHA f78e6668ca287f8244ff7ef2dbbca6339bbee5d7: unified frontend/backend build, 109 tests passed / 0 failed, and fail-closed preflight succeeded. Workflow contains no Vercel deployment step.
- NOT VERIFIED: full HTTP route integration, concurrent recovery replay, real session-cookie binding, Supabase auth token integration, and browser E2E. No production/staging DB changes, migration execution, merge, or Vercel deployment occurred. Deployment pause remains active.
- SOURCE OBSERVED: getSessionRecord resolves the session by the exact HttpOnly session-cookie token and returns that token with its session record; both recovery and identity-link markers are stored inside that session object. The credential recovery marker is consumed before the same revision-CAS save that updates the password. This supports session scoping at source level, but does not replace a route-level replay/concurrency test.

## Identity-link marker and CAS contract test hardening — 2026-11-05

- Audited the identity-link source/target routes and the React settings flow. Source proof is restricted to a Supabase identity already linked to the current BTCBOX account; account TOTP is required when enabled. Target proof checks a fresh Supabase auth_time, rejects the same source/target identity, checks identity/email/wallet conflicts against other BTCBOX accounts, and consumes the session marker in the same revision-CAS save as the identity update.
- Added route-scoped source-contract assertions in backend/tests/account-credentials.test.js for source purpose and 2FA ordering, target marker purpose, linked-source ownership, target token subject, same-identity rejection, conflict handling, marker consumption before saveDB, and both past/future auth_time bounds.
- Feature commit: 2cd536965cacd62621a29514f95c50d62f27cf66. Backend CI run 42054044235 completed successfully for this SHA: unified build passed, 109 tests passed / 0 failed, fail-closed preflight passed, and preserved-entrypoint checks passed. No Vercel deployment step ran.
- Latest feature head observed: 2cd536965cacd62621a29514f95c50d62f27cf66.
- SOURCE OBSERVED, NOT ROUTE-INTEGRATION VERIFIED: Supabase state writes use expected_revision CAS; the handler's in-process request queue is explicitly not a cross-instance lock. Cross-instance one-time behavior therefore depends on the database RPC CAS contract and still needs a live/staging integration test with concurrent requests.
- NOT VERIFIED: replay and concurrency against a running HTTP handler plus real Supabase persistence, Google OAuth, MetaMask/Phantom/Coinbase wallet, TOTP, and browser E2E. No database migration execution, production DB change, merge, or Vercel deployment. Deployment pause remains active.

## Database-side state CAS contract coverage — 2026-11-05

- Added a source-contract test for the Supabase state CAS adapter and migration `backend/supabase/sql/0001_btcbox_state_cas.sql`.
- Test verifies that `saveDB` sends the loaded expected revision, only increments the local revision after a literal `true` RPC result, and propagates a write conflict; SQL must perform a conditional `UPDATE ... WHERE revision = p_expected_revision`, increment the revision atomically, and return success only for one affected row. It also verifies the initial revision-0 insert is conflict-safe and function execution is restricted to service_role.
- Feature commit: 7aba5d2298621e0a900f8a844cf9d3ed75766dec. Backend CI run 42054424697 completed successfully: unified build passed, 110 tests passed / 0 failed, fail-closed preflight passed, and preserved-entrypoint checks passed. No Vercel deployment step ran.
- Latest feature head observed: 7aba5d2298621e0a900f8a844cf9d3ed75766dec.
- IMPORTANT LIMIT: this is static source-contract coverage, not a live PostgreSQL concurrency test. The SQL migration `0001` and shared rate-limit migration `0023` have not been applied or exercised against staging/production. Real two-client concurrent CAS, RPC permissions, and marker replay still require a disposable/staging Supabase project.
- No migration execution, production DB change, merge, or Vercel deployment. Deployment pause remains active.

## Security-counter and admin-audit hardening — 2026-11-06

### IMPLEMENTED ON FEATURE BRANCH — SOURCE READ-BACK VERIFIED; TEST EXECUTION PENDING
- Feature branch: `feat/btcbox-web3-auth-20261105`.
- Latest feature commit at this update: `984c2f8b5747743e72fe7f4f3acd70c0f1392589`.
- `backend/api-core.js` now returns a generic `503 SECURITY_STATE_UNAVAILABLE` when the Supabase-login IP counter cannot be persisted, rather than continuing authentication with an unrecorded attempt.
- Withdrawal fund-password failure-counter writes and successful-password counter resets now fail closed with `503` if `saveDB` fails, before the financial cutover check or any withdrawal RPC.
- Administrator auth now returns an explicit persistence-unavailable sentinel when failed-attempt counter writes or successful-auth counter resets fail. The admin route maps that sentinel to `503`, rather than treating the failure as an ordinary 401 or granting access.
- General admin audit append is now awaited. When Supabase storage is configured, the handler requires the PostgreSQL `append_admin_audit_log` RPC to return an HTTP success before saving and confirming the associated admin state mutation. All seven existing `auditAdmin` call sites now await it. When Supabase storage is not configured, the existing JSON state audit-log path remains the compatibility path.
- Added `backend/tests/security-counter-persistence.test.js` and `backend/tests/admin-audit-persistence.test.js` with source-contract assertions for fail-closed counter persistence and awaited audit append ordering.

### VALIDATION / LIMITS
- SOURCE READ-BACK VERIFIED: updated API source and both test files were fetched back from the feature branch; source-level checks confirmed all intended fail-closed branches, all seven awaited audit call sites, and both test files exist.
- NOT VERIFIED: Node test execution, unified build, PostgreSQL RPC permissions/runtime behavior, audit append response behavior against a live database, and HTTP/browser integration.
- The latest commit status endpoint only exposes a failing Vercel status context pointing to the `fuyao999` build-rate-limit page. The GitHub workflow-run lookup returned no PR-triggered runs for this SHA; therefore no green CI claim is made.
- No Supabase migration was applied, no database or production records were changed, no secrets were read or modified, no merge occurred, and no new Vercel build/deployment was initiated. Keep deployment paused.
- Review the audit append semantics for possible orphan audit rows if PostgreSQL append succeeds but the subsequent JSON state CAS fails; this is preferable to silently reporting success without a durable audit record, but it is not a single transaction for non-financial admin mutations.

## Withdrawal status constraint migration hardening — 2026-11-06

### IMPLEMENTED ON FEATURE BRANCH — SOURCE READ-BACK VERIFIED; TEST EXECUTION PENDING
- Updated `backend/supabase/sql/0022_withdrawal_admin_review_status_v1.sql` to drop only the canonical PostgreSQL-generated `withdrawal_requests_status_check` created by migration `0002_financial_ledger_v1.sql`.
- Removed the prior catalog loop that dropped every CHECK constraint whose definition happened to contain the word `status`. This prevents unrelated status-related constraints from being removed during migration.
- Extended `backend/tests/withdrawal-audit-contract.test.js` to assert the exact named drop and reject the broad catalog-based deletion pattern.
- Latest feature branch commit at this update: `7fa2e79f438897cc2b880ce4f0614f9131ed3b37`.

### VALIDATION / LIMITS
- SOURCE READ-BACK VERIFIED: migration SQL and test source were fetched from the feature branch; the exact named drop is present and the broad loop is absent.
- NOT VERIFIED: Node test execution, migration execution against PostgreSQL, existing-schema drift, constraint dependency behavior, and transaction/rollback behavior.
- No database migration was applied, no production data/schema was changed, no merge occurred, and no Vercel build/deployment was initiated. The Vercel status remains a failure pointing to the `fuyao999` build-rate-limit page; no green CI claim is made.


## TOTP replay and withdrawal concurrency hardening — 2026-11-06

### IMPLEMENTED ON FEATURE BRANCH — SOURCE READ-BACK VERIFIED; TEST EXECUTION PENDING
- Feature branch: `feat/btcbox-web3-auth-20261105`.
- Latest feature branch commit at this update: `f6cb10ea8b5017ac44412bbb1602b3355e7ff708`.
- Added `totpMatchStep`, which returns the exact matching 30-second TOTP counter rather than only a boolean. All protected TOTP paths now use `consumeTotpStep`, which rejects a counter at or below the user's persisted `twofa_last_used_step`.
- If a six-digit value happens to collide across more than one adjacent accepted time-step, the matcher selects the newest matching step before replay comparison; this avoids consuming the older match and leaving the newer colliding step reusable.
- The consumed counter is saved in the same revision-CAS state write as the associated login session, reauthentication marker, credential change, or 2FA state change. The withdrawal route persists the consumed counter before the financial cutover check or any financial RPC; persistence failure fails closed with 503.
- New TOTP enrollment clears a prior counter when creating a fresh secret; disabling 2FA clears the counter together with the secret.
- Added `backend/tests/totp-replay-protection.test.js` with source-contract assertions for matched-step validation, replay rejection, protected-route consumption, withdrawal persistence ordering, and enrollment/disable reset behavior.
- Added a transaction-scoped PostgreSQL advisory lock on `hashtextextended(p_request_id, 0)` before the initial `withdrawal_requests` lookup in `0022_withdrawal_admin_review_status_v1.sql`. This closes the absent-row race where two simultaneous first-use retries could both observe no row; the unique request_id and financial-operation idempotency key already prevented double financial posting, but the losing request could previously end in a uniqueness error instead of returning the original withdrawal.
- Extended `backend/tests/withdrawal-audit-contract.test.js` to assert the advisory lock precedes the request lookup. Existing review logic continues to lock the withdrawal row with `FOR UPDATE`, apply the ledger operation and audit row in the same SQL transaction, and return the terminal status for a repeated review; the API maps a conflicting decision to HTTP 409.

### VALIDATION / LIMITS
- SOURCE READ-BACK VERIFIED: fetched the feature-branch API, TOTP test, withdrawal migration, and withdrawal contract test after the edits. Static checks confirmed the six-digit TOTP regex, no protected route still calls the boolean verifier, all protected routes use the one-time-step consumer, withdrawal persists the counter before the financial gate, and the advisory lock is placed before the absent-row lookup.
- NOT VERIFIED: Node test execution, unified build, live concurrent TOTP requests across separate serverless instances, PostgreSQL advisory-lock behavior on the target schema, migration execution, and HTTP/browser end-to-end behavior.
- GitHub workflow lookup returned no PR-triggered workflow runs for the latest feature SHA. The only combined status currently exposed is the Vercel `build-rate-limit` failure; this is not a GitHub Actions test result.
- Admin audit remains awaited before the JSON state save but is not one transaction across PostgreSQL audit append and JSON-state CAS. If the append succeeds and the later CAS fails, an orphan audit row can remain; do not describe this cross-store workflow as atomic.
- No database migration was applied, no production records or schema were changed, no secrets were read or modified, no merge occurred, and no Vercel build/deployment was initiated. Deployment pause remains active.


## Administrator audit outbox and idempotent delivery — 2026-11-06

### IMPLEMENTED ON FEATURE BRANCH — SOURCE READ-BACK VERIFIED; TEST EXECUTION AND DATABASE MIGRATION PENDING
- Feature branch: `feat/btcbox-web3-auth-20261105`.
- Latest feature branch commit at this update: `b18778a06e629713f5efa000791372d608b1ebf4`.
- Replaced the previous PostgreSQL-first dual-write order for non-financial admin mutations. `auditAdmin` now stages a uniquely identified event in `db.audit_logs`; the route saves the business mutation and pending audit event together through the existing revision-CAS state write before attempting PostgreSQL delivery.
- Added `flushAdminAuditOutbox`. It retries pending events on subsequent authenticated admin requests and immediately after each audited mutation. A PostgreSQL append is considered delivered only when the RPC returns HTTP success and the literal JSON boolean `true`. Successful deliveries are marked `synced` and saved back to the CAS state document. If the marker save fails after PostgreSQL accepted the event, the same event ID is retried later.
- API responses for the covered non-financial admin mutations now include `audit_sync_pending`, so a completed state mutation can be distinguished from a PostgreSQL audit delivery that still needs retry.
- Updated `backend/supabase/sql/0021_admin_audit_log_append_only_v1.sql`: adds nullable `financial_audit_log.event_id`, a partial unique index, replaces the legacy five-argument append RPC with a six-argument event-ID contract, and treats an identical event retry as success while rejecting reuse of an event ID with a different payload. The migration also sends `NOTIFY pgrst, 'reload schema'` after changing the RPC signature so PostgREST refreshes its function cache.
- Extended the outbox coverage to admin support replies and address-book management, which previously saved state/audit data without using the shared PostgreSQL append path. The support reply route now also initializes a missing support-message array safely.
- Existing financial mutations remain outside this outbox path: their audit entries are expected to be written in the same PostgreSQL transaction as their financial ledger operation. Do not route financial writes through this JSON-state outbox.

### VALIDATION / LIMITS
- SOURCE READ-BACK VERIFIED: re-fetched `backend/api-core.js`, `backend/supabase/sql/0021_admin_audit_log_append_only_v1.sql`, and `backend/tests/admin-audit-persistence.test.js`. Static checks confirmed 9 non-financial admin audit call sites, 9 post-state-save outbox flushes, a retry flush on authenticated admin requests, stable event IDs, unique-index idempotency, and duplicate-payload conflict checks.
- Added/updated source-contract assertions for state-before-delivery ordering, outbox retry semantics, the 9 covered routes, and the SQL event-ID contract. These tests have NOT been executed in Node in this session.
- NOT VERIFIED: PostgreSQL migration syntax/runtime, RPC signature replacement against an existing database, unique-index creation against live rows, real HTTP/PostgREST behavior, cross-instance retry behavior, and browser/admin UI handling of `audit_sync_pending`.
- Outbox retries are request-driven: pending events retry on later authenticated admin requests; no cron/worker was added. The local CAS document is the durable queue until PostgreSQL delivery succeeds.
- The SQL migration has not been applied to any database. No production data/schema was changed, no secrets were read or modified, no merge occurred, and no Vercel build/deployment was initiated. Keep deployment paused.
- The only combined status observed for the latest feature commit is the Vercel `build-rate-limit` failure. The workflow-run lookup returned no PR-triggered GitHub Actions run for that SHA; do not claim CI passed or failed based on the Vercel status.


## Admin console source reconciliation and audit-feedback gap — 2026-11-06

### CURRENT FEATURE BRANCH FINDINGS — SOURCE OBSERVED
- Audited feature branch `feat/btcbox-web3-auth-20261105` at SHA `b18778a06e629713f5efa000791372d608b1ebf4`. Compared with `f6cb10ea8b5017ac44412bbb1602b3355e7ff708`, the feature branch is 7 commits ahead / 0 behind; the compare reports the current admin-outbox files as the changed scope.
- Correction to the earlier Admin readiness audit above: its statement that no loaded `VIEWS.admin` implementation exists described the older `main` snapshot. On the current feature branch, `backend/admin.html` loads `assets/js/views-account.js`; that file defines `VIEWS.admin` and `VIEWS.admin.afterRender`. The SPA route registry in `app-core.js` starts with a placeholder, but the loaded `views-account.js` replaces it. Therefore the current feature branch has a **partial legacy admin console**, not a missing admin page.
- The implemented console currently exposes four tabs: users, deposits, withdrawals, and KYC. The same API client also exposes support, address, order, config, and audit-log operations, but this admin view does not expose those workflows. The Vite React app under `frontend/src/App.tsx` still has no admin route; the existing admin console belongs to the legacy static app assembled by the backend build.
- **P1 — withdrawal review queue hides admin-review items:** `backend/api-core.js` and migration `0012_financial_admin_read_api_v1.sql` include `pending_admin_review` in the admin withdrawal snapshot/count. However, `backend/assets/js/views-account.js` filters the visible list using only `w.status === 'pending'` (around line 578). Requests deliberately placed in `pending_admin_review` are therefore omitted from the console even though the backend returns them. The Interaction/UI owner should include both pending statuses and visually distinguish the admin-review state without changing the locked trading layout.
- **P1 — audit delivery warning is not surfaced:** the backend now returns `audit_sync_pending` for the nine non-financial audited mutations. The shared `runAdminAction` handler in `views-account.js` treats every `result.ok` as a normal success and does not inspect `audit_sync_pending`. It can therefore display a success toast while PostgreSQL audit delivery remains pending. The UI owner should show a warning that the business mutation was saved but audit delivery is pending/retrying; do not ask the operator to repeat the business action.
- The current admin view does not expose an audit-log tab or a visible outbox synchronization status. `backend/tests/admin-entry.test.js` checks the route shell and Basic Auth wiring only; it does not assert the actual admin view, pending-review queue coverage, or audit-pending feedback.
- Withdrawal review conflict handling was rechecked: SQL locks the withdrawal row with `FOR UPDATE` and returns the stored terminal status for a repeated review; the API approve/reject handlers compare the returned status to the requested decision and return HTTP 409 for the opposite terminal decision. The previously suspected opposite-decision gap is **not reproduced at source level**. Same-decision retries remain idempotent and do not execute a second financial posting.

### VALIDATION / LIMITS
- SOURCE OBSERVED: loaded legacy script order, `VIEWS.admin` implementation, four visible tabs, the pending-only UI filter, generic success handling, backend pending-review status/count, and API 409 checks were read from the feature branch.
- NOT VERIFIED: Node test execution, browser rendering, admin Basic Auth against a running deployment, real outbox delivery, PostgreSQL migration/RPC behavior, or live concurrent review requests.
- The combined status for `b18778a06e629713f5efa000791372d608b1ebf4` exposes only the Vercel `build-rate-limit` failure; the commit workflow lookup returned no PR-triggered run. This is not a GitHub Actions test result and does not establish CI pass/fail.
- No application source file was changed in this reconciliation batch. No database migration, production data/configuration change, merge, or Vercel deployment was performed. Deployment pause remains active.
- Next: route the two UI fixes and corresponding regression tests to the Interaction/UI file owner; keep the business API and financial SQL unchanged unless a separate backend defect is reproduced.


### ADDITIONAL ADMIN DATA-HYDRATION AND FINANCIAL-AUDIT CHECKS
- **P1 — admin list data is not hydrated:** on the current feature branch, `state.admin` is initialized with empty `users`, `deposits`, `withdrawals`, and `kycs` arrays. The only API method called by `VIEWS.admin.afterRender` is `apiAdapter.adminStats()`. A repository-wide read of all eight scripts loaded by `backend/admin.html` found no assignments populating `state.admin.*`, and no call sites for `adminUsers()`, `adminWithdrawals()`, `adminAddresses()`, `adminOrders()`, `adminSupportMessages()`, or `adminConfig()` outside their API-client declarations. Consequently the four table tabs read empty arrays and show their empty-state UI; the current console is a rendered shell with stats, not an operationally hydrated management console. Before exposing any mutation buttons, the UI integration must load the corresponding server data, validate response shapes, handle 401/503, and refresh affected data after a successful mutation.
- **FINANCIAL AUDIT SOURCE CHECK:** `admin_adjustment_atomic` in migration `0004_financial_admin_adjustment_v1.sql` calls `apply_financial_operation` and inserts `financial_audit_log` in the same PostgreSQL function transaction. `admin_manual_deposit_atomic` in migration `0007_financial_admin_manual_deposit_v1.sql` likewise performs the ledger credit, deposit status update, and audit insert in one function transaction. The withdrawal review function in `0022` similarly locks the row and performs ledger update plus audit insert in one transaction. The API routes fail closed when the required financial cutover is not enabled and do not fall back to JSON state writes. These are source-contract observations only; no SQL was executed against PostgreSQL.
- **UI implementation scope:** the two previously recorded P1 items (include `pending_admin_review` in the review list; surface `audit_sync_pending` as a warning) are necessary but not sufficient. The admin view also needs explicit data hydration, error/loading/empty states, post-mutation refresh, and a deliberate audit-log view before the console can be treated as operational. Keep all financial actions disabled unless the separately approved cutover conditions are met.


## CI failure triage and admin console follow-up — 2026-11-06

### FEATURE BRANCH — SOURCE OBSERVED
- Reconfirmed feature branch head before remediation: `b18778a06e629713f5efa000791372d608b1ebf4`.
- Retrieved GitHub Actions run `42077859560` (run #72, push event) for that exact SHA. Unified build passed; backend tests failed: 124 tests, 114 passed, 10 failed. This is a real GitHub Actions result, distinct from the Vercel `build-rate-limit` status.
- Root cause found in `backend/api-core.js`: malformed trailing-slash regex in `flushAdminAuditOutbox` caused a JavaScript SyntaxError at module load, cascading into route/security tests.
- Two independent contract-test mismatches were also confirmed: the security-counter test expected exactly two fail-closed sentinels although the route contains a third valid TOTP persistence fail-closed branch; the withdrawal/audit test still expected the removed five-argument RPC permission signature instead of the current six-argument event-ID signature.

### REMEDIATION PUSHED — FINAL HEAD AWAITING CI
- Corrected the outbox URL normalization regex in `backend/api-core.js`.
- Relaxed the security-counter source assertion to require the fund-password failure/reset protections while allowing the additional TOTP fail-closed branch.
- Updated the audit SQL contract test to assert removal of the legacy five-argument RPC and permission revocation for the current six-argument signature.
- Resulting feature branch head observed: `4d4d587fdfd5239e311180e2e219fefb5f210aa2`.
- GitHub Actions runs `42080814549` (SHA `58e1129580f0929770ac9a8e1dc2bdb2af72cbf1`) and `42080821601` (SHA `df433220f83684391710703c66e67666d3d245f8`) were both in progress when inspected. These are intermediate commits; no CI result is yet available for final head `4d4d587...`.

### ADMIN CONSOLE SOURCE RECONFIRMATION
- The legacy console remains under `backend/assets/js/views-account.js`; its `afterRender` still calls only `adminStats()`, while tab renderers read `state.admin.users/deposits/withdrawals/kycs`.
- The API client exposes `adminUsers`, `adminWithdrawals`, and other read methods, but the current console does not invoke those loaders. No `adminDeposits()` read method was found in the inspected API client excerpt; the deposits tab must not be populated from invented or synthetic data.
- Withdrawal list renderer still filters only `status === 'pending'`; it hides `pending_admin_review` returned by the backend.
- `runAdminAction` still treats any `result.ok` as ordinary success and does not inspect `audit_sync_pending`.
- Do not enable financial mutation controls as part of data hydration. First map which read endpoints actually exist and define safe loading/error states. Preserve the locked trading layout.

### VALIDATION / LIMITS
- SOURCE OBSERVED: failing CI run and log, malformed regex, two stale test assertions, current admin UI/API client read wiring.
- NOT VERIFIED: final-head CI, browser admin behavior, Postgres migration/RPC behavior, and production/staging database state.
- No database migration, production data/configuration change, merge, or Vercel deployment was performed. Deployment pause remains active.


## Admin API/read-contract reconciliation and final CI candidate — 2026-11-06

### ADDITIONAL SOURCE OBSERVATIONS
- The current legacy admin UI user renderer expects `u.kyc` and `u.balances.USDT`, while the actual `GET /api/admin/users` response emits `kyc_status` and `total_usdt`. This is a concrete frontend/backend shape mismatch; merely calling `adminUsers()` will not make the existing table correct.
- The deposits tab expects `state.admin.deposits`, but no `GET /api/admin/deposits` handler or `adminDeposits()` API client method exists in the inspected feature source. Do not populate it from invented data or expose a manual-credit action without a real, audited read contract.
- The KYC tab expects submitted `name` and `id_type`, but the inspected users list response only provides `kyc_status`; no dedicated KYC queue read endpoint was found in the inspected admin route block. Current customer KYC UI also states that document photo upload is not required, so evidence review is incomplete.
- The current API's admin withdrawals response includes `pending_admin_review`, but the UI still filters only `pending`.
- The current admin action handler still ignores `audit_sync_pending`. Successful business mutation with delayed audit delivery must be shown as a warning, not a plain success toast.

### TEST FIX STATUS
- A follow-up CI run on SHA `df433220f83684391710703c66e67666d3d245f8` reached 140 tests: 139 passed, 1 failed. The remaining failure was the stale five-argument audit RPC permission assertion.
- The test was then corrected to assert dropping the legacy five-argument signature and revoking browser-role execution on the six-argument event-ID signature.
- Current feature branch head observed after that test correction: `5ac6209f54bbe01e6905ed2221773663f2c226a6`.
- GitHub Actions run `42080961892` was observed in progress for that exact head. Final result must be checked before claiming the batch is green.
- The earlier CI runs `42080814549` and `42080821601` are intermediate SHAs and are not final-head acceptance evidence.

### NEXT IMPLEMENTATION ORDER
1. Verify CI run `42080961892` for SHA `5ac6209f54bbe01e6905ed2221773663f2c226a6`; if green, record exact run and test totals.
2. Build an explicit admin API contract matrix before UI edits: users, deposits, withdrawals, KYC, audit logs. Identify missing read routes and exact response fields.
3. Add only read-only queue endpoints needed for the console, with sensitive-field minimization and Postgres/legacy source semantics made explicit. Do not expose document numbers or other PII unless necessary and approved.
4. Hydrate each tab with loading/error/empty states and refresh after successful actions. Include both pending withdrawal statuses and distinguish admin review.
5. Surface `audit_sync_pending` as a warning that the business mutation is saved but audit delivery is pending; do not instruct the operator to repeat it.
6. Add admin view/API contract tests. Keep deposit credit, withdrawal review, balance changes, and all other financial writes fail-closed.
- No database migration, production data/configuration change, merge, or Vercel deployment. Deployment pause remains active.


## Final-head CI verification — 2026-11-06

- Feature branch head verified: `5ac6209f54bbe01e6905ed2221773663f2c226a6`.
- GitHub Actions run `42080961892` for that exact SHA completed with conclusion `success`.
- Unified frontend/backend build: passed; generated the unified public build with Strata customer app plus legacy admin/OAuth assets.
- Backend automated tests: 140 passed / 0 failed.
- Fail-closed deployment preflight: passed with CI-only dummy configuration and all financial cutover flags set to `0`.
- Preserved-entrypoint checks: passed (`index.html`, `legacy-index.html`, `admin.html`, frontend assets, API functions and OAuth assets).
- This verifies the GitHub Actions pipeline at this exact commit. It does NOT verify PostgreSQL migration/RPC runtime, Supabase environment readiness, browser admin workflows, real auth, financial settlement, or production behavior.
- Vercel's separate `build-rate-limit` status is not a failure of this GitHub Actions run. No Vercel deployment was initiated.
- Admin console API/data-shape gaps documented above remain open and must be addressed before calling the admin console operational.
- No merge to `main`, no database migration, and no production deployment. Deployment pause remains active.


## Admin console batch 2026-11-06
- Feature branch HEAD: `9b45d8a0f24b83114bf4cfc32bdba2e680b8b8e3`.
- `backend/assets/js/views-account.js` now loads supported admin user and withdrawal read APIs, maps `kyc_status`/`total_usdt` into the existing user table shape, includes `pending_admin_review`, and refreshes supported lists after successful admin actions.
- Admin action success checks `audit_sync_pending` and warns that the business operation is saved while audit delivery is pending; operators are told not to repeat it.
- Deposits and KYC tabs now state that the required complete read APIs are unavailable and do not expose their prior review controls. No fabricated queue data is used.
- `backend/tests/admin-entry.test.js` adds coverage for hydration, response mapping, pending-review visibility, unavailable queues, and audit-pending feedback.
- GitHub Actions run `42081382847` for this exact SHA succeeded: unified build passed, backend tests 143/143 passed, fail-closed preflight passed, preserved-entrypoint checks passed.
- Browser admin/Basic Auth and live database behavior remain unverified. No migration, merge, or Vercel deployment.


## Admin queue retry resilience — 2026-11-06

- Feature branch current head: `d457e3edc516c8acd154a4bd3a1a4664fda7f322`.
- Follow-up finding: the admin queue error message advised switching tabs to retry, but the tab handler only re-rendered and never retried the API reads. Added a retry path on tab selection whenever either supported queue has a read error.
- Added an in-flight guard to prevent duplicate parallel queue reads, with loading state initialized so the first request is not blocked.
- Added source-contract test coverage for retry behavior and duplicate-load guard.
- Intermediate commit `a00e1715d1c0f9bd82f254cf07ee55fa0dc4fcd9` run `42081688954` and final commit `d457e3edc516c8acd154a4bd3a1a4664fda7f322` run `42081696844` were both still in progress when recorded. Do not claim final CI green until the latter exact-SHA run completes successfully.
- Further read-only audit: legacy deposit records live under each user's `user.deposits`, but there is no dedicated admin deposits GET route. A new route must not be added until it is clear whether Postgres financial read cutover is enabled and how to read the canonical deposit ledger without mixing sources. KYC submissions are stored on user records, but a queue endpoint must return only the minimum necessary fields and must not expose document numbers or credentials.
- No database migration, production data/configuration change, merge, or Vercel deployment. Deployment pause remains active.


## Admin retry hardening final CI — 2026-11-06

- Final feature head `d457e3edc516c8acd154a4bd3a1a4664fda7f322` verified.
- GitHub Actions run `42081696844` for this exact SHA completed successfully.
- Unified build passed; backend tests: 144 passed / 0 failed; fail-closed deployment preflight passed; preserved-entrypoint checks passed.
- The earlier implementation commit `a00e1715d1c0f9bd82f254cf07ee55fa0dc4fcd9` also passed its own CI run `42081688954` (143/143 tests); final-head evidence is run `42081696844`.
- This confirms the source/build/test pipeline only. Admin browser flows, Basic Auth against a live environment, Supabase/Postgres runtime, and real data correctness remain unverified.
- Current coordination document commit: this entry appended after the prior coordination SHA; verify branch ref before further edits.
- No database migration, production data/configuration change, merge, or Vercel deployment. Deployment pause remains active.


## Redacted KYC admin read queue — 2026-11-06

- Feature branch final head: `93a15f8acf3621042b71605ed4625e5e89f3da9a`.
- Added read-only `GET /api/admin/kyc` behind the existing admin Basic Auth route. It returns only pending application UID, email, applicant name, ID type, status, and submission timestamp; it does not return identity number, password hashes, TOTP secrets, recovery codes, or raw user records.
- Added `apiAdapter.adminKyc()`; admin console now hydrates the KYC queue with user and withdrawal reads, and renders the existing approval/rejection controls only for records returned by this pending-only endpoint.
- Kept the deposits tab disabled: user-facing deposit submission currently rejects user-entered deposit claims and no canonical deposit-read contract for the financial ledger has been verified. Do not manufacture a queue from unsupported legacy assumptions or enable manual credit.
- Added admin-entry contract coverage for KYC redaction, API adapter, queue hydration, and preserving the disabled deposits queue.
- GitHub Actions run `42082114633` for exact SHA `93a15f8acf3621042b71605ed4625e5e89f3da9a` completed successfully: unified build passed, backend tests 145/145 passed, fail-closed preflight passed, preserved-entrypoint checks passed.
- An earlier intermediate test run `42082080232` failed one stale hydration assertion; it was corrected before the final-head run. Another intermediate run `42082030837` failed due to an invalid regex in the first test draft; final test uses literal source assertions and is green.
- No PostgreSQL migration, production data/configuration change, merge, or Vercel deployment. Deployment pause remains active. Live admin browser and real Basic Auth remain unverified.


## Admin audit viewer and deposit ledger boundary — 2026-11-06

- Feature branch exact HEAD: `1d3008a985a75fdcc8283bea9fd4989d59accd2e`.
- Added a read-only, paginated admin audit-log tab using existing `GET /api/admin/audit-logs` and the new `adminAuditLogs` adapter. Supports 50-row pages, action and UID filters, refresh, and load-more.
- API response is field-allowlisted (id/action/uid/actor/time/detail/sync status), caps the page size at 200, redacts password/token/secret/recovery/identity-number fields, email addresses, and common EVM/TRON wallet-address forms, and rejects stale pagination cursors with HTTP 400.
- UI escapes all rendered record values and labels the source honestly: current `btcbox_state` audit document with retention-limited completeness. This is NOT the full PostgreSQL `financial_audit_log` history and must not be represented as canonical complete financial audit history.
- GitHub Actions run `42083244113` for exact SHA `1d3008a985a75fdcc8283bea9fd4989d59accd2e` completed successfully: unified build passed, backend tests 146/146 passed, fail-closed deployment preflight passed, preserved-entrypoint checks passed.
- Deposit ledger review: SQL `0002` defines canonical `public.deposit_records` with pending/confirmed/rejected status, user/asset/network/amount/txid and confirmation metadata; `0016` only credits through trusted chain-verification RPC after a pending row already exists and blocks manual confirmation. SQL `0007` adds an admin manual-credit RPC, but the API remains fail-closed behind financial cutover. No admin deposit snapshot/read API exists in `0012`; `0010` exposes account/withdrawal snapshots only. User POST `/api/deposit` rejects user-supplied credit requests and only serves deposit addresses for non-positive amount queries.
- Therefore deposit review remains disabled. Before adding an admin read route, establish the trusted chain-verifier's pending-row creation/ingestion path, confirm whether canonical financial read cutover is enabled, and add a service-role-only read snapshot over `deposit_records` with explicit pagination and no mixing of legacy `user.deposits`. Do not enable manual credit or execute migrations.
- No production database changes, merge, or Vercel deployment. Deployment pause remains active. Browser Admin/Basic Auth and live Postgres data remain unverified.


## Admin audit redaction and deposit/KYC follow-up — 2026-11-06

### FEATURE BRANCH — SOURCE OBSERVED
- Feature branch exact HEAD: `bf996caffdee2d67c9d3ced4f48efd439e1a9559` (verified by comparing the branch ref to the prior exact HEAD `1d3008a985a75fdcc8283bea9fd4989d59accd2e`; 8 commits ahead, 0 behind).
- The previous audit detail sanitizer used over-escaped whitespace and email-dot patterns in regex literals. A direct behavior probe showed JSON values such as `{"password":"Super Secret Phrase","token":"abc123"}` were returned unchanged. This is a reproduced source-level defect, not merely a style concern.
- Replaced the inline sanitizer with `redactAdminAuditDetail()`, using correctly escaped patterns and handling quoted JSON values, unquoted key/value secrets, emails, EVM addresses, and TRON addresses.
- Added behavioral tests in `backend/tests/admin-entry.test.js` for quoted JSON secrets, identity-number fields, emails, EVM/TRON addresses, private keys, recovery codes, escaped quotes inside secret values, plural recovery-code fields, and API keys. Updated the audit-viewer source-contract assertions to follow the extracted sanitizer helper.
- A direct isolated JavaScript probe of the helper's equivalent patterns produced the expected redacted output, including a JSON secret containing escaped quotes. The full repository test suite and GitHub Actions result for the exact new HEAD are **PENDING**; do not mark this batch CI-green until an exact-SHA run is verified.
- The backend workflow is configured to trigger on pushes to `feat/btcbox-web3-auth-20261105` for changes under `backend/**`. The available workflow-run lookup only returns PR-triggered runs; combined commit status currently exposes no check records for this push SHA. This is an evidence-access limitation, not a pass.

### DEPOSIT LEDGER BOUNDARY — SOURCE OBSERVED
- `0002_financial_ledger_v1.sql` creates canonical `public.deposit_records` with pending/confirmed/rejected status and service-role-only table access.
- `0007_financial_admin_manual_deposit_v1.sql` implements `admin_manual_deposit_atomic`; the RPC itself creates a pending manual-deposit row and, in the same database transaction, performs the ledger credit, confirms the row, and appends the financial audit event. This is the documented manual-review path in the migration-order guide.
- `0016_financial_deposit_chain_verification_v3.sql` implements the optional chain-verifier RPC but requires a pre-existing pending deposit row. The inspected backend `api-core.js` contains no call to `verify_and_credit_deposit_atomic` and no insert into `deposit_records`; an external verifier/ingestion service is therefore **NOT VERIFIED** from this repository path.
- User `POST /api/deposit` is an address-query flow and rejects positive user-submitted deposit claims. Admin manual credit remains fail-closed behind the complete financial cutover flags. No deposit-read endpoint exists, so the admin deposits tab remains disabled and must not be populated from legacy `user.deposits` as if it were the canonical ledger.
- No database query or migration was executed.
- The inspected `api-core.js` has no direct insert into `deposit_records` and no call to `verify_and_credit_deposit_atomic`; the manual atomic RPC is a separate, fail-closed path. This does not rule out an external verifier outside the inspected repository.


### KYC REVIEW EVIDENCE — SOURCE OBSERVED
- `GET /api/admin/kyc` returns a pending-only, minimized list (UID, email, applicant name, ID type, status, submission time) and omits identity number and credential secrets.
- The current customer submission path does not provide document-image evidence; the admin view nevertheless exposes approve/reject controls based on name and ID type alone. This is an evidence sufficiency risk. Do not claim KYC review is operationally complete.
- The approve route requires pending status unless an explicit admin override with a reason is supplied. The reject route currently allows setting rejected status without a pending submission; preserve this documented behavior until the business owner approves a rule change. No KYC business rule was changed in this batch.

### SHARED SECURITY RATE LIMIT / IDENTITY FRESHNESS — SOURCE OBSERVED
- `0023_btcbox_shared_rate_limit_v1.sql` defines an atomic fixed-window limiter with a unique `(scope,key_hash,window_start)` key, HMAC-derived subject hashes, service-role-only RPC access, and bounded cleanup.
- The feature API declares twelve explicit shared policies and awaits the shared RPC for login 2FA, identity-link reauthentication/target proof, credential reauthentication/recovery, 2FA setup/disable, password/fund-password changes, and Seconds order/settlement routes. Missing secret, database configuration, RPC errors, or malformed RPC responses fail closed with HTTP 503.
- Identity linking checks a server-saved source reauthentication marker and signed Supabase `auth_time`; both source and target proofs must be within five minutes, and future timestamps beyond the small clock-skew allowance are rejected. The identity-link and credential-recovery markers are single-use and bounded to five minutes.
- Added tests in `backend/tests/auth-security-routes.test.js` for stale/future source proofs, stale target proofs, expired signed auth timestamps even when the server marker timestamp itself is fresh, missing HMAC secret, unavailable limiter RPC, and over-limit rejection.
- Migration `0023` remains a prepared migration. The production migration inventory previously inspected did not show it as applied; until the RPC exists and the HMAC secret is configured, these protected routes intentionally fail closed. Live environment readiness is **NOT VERIFIED**. No migration was run.
- The migration defines `btcbox_rate_limit_cleanup_v1()` with a 48-hour retention threshold and 5,000-row batch cap, but no invocation was found in the inspected `backend/api-core.js`, `backend/vercel.json`, migration SQL, or migration-order guide. A trusted scheduled invocation may exist outside this repository, but it is **NOT VERIFIED**. Without cleanup, the rate-limit table can grow over time; do not add an unauthenticated public cleanup route.



### AUDIT HISTORY LIMIT
- The admin audit viewer still reads the retention-limited `btcbox_state` audit document. It is not the canonical complete PostgreSQL `financial_audit_log` reader.
- Outbox delivery uses stable event IDs and the SQL RPC's idempotent append contract. If PostgreSQL append succeeds but state CAS fails, the event remains pending and can be retried by a later admin request; duplicate insertion is prevented by the event-ID unique index and payload consistency check.
- No production database change, merge to `main`, or Vercel deployment. Deployment pause remains active.

### VALIDATION / NEXT ACTION
1. Verify the exact-head GitHub Actions run for `bf996caffdee2d67c9d3ced4f48efd439e1a9559`; full CI remains pending.
2. Continue locating/confirming any external chain-verifier service and its trusted creation path for pending chain deposits; do not infer it from SQL alone.
3. Decide, with explicit business approval, whether KYC approve/reject controls must remain disabled until document evidence is collected.
4. Design a service-role-only, paginated canonical PostgreSQL deposit read snapshot only after the financial read cutover and data source are proven.
5. Keep production financial writes disabled; no migration, merge, or deployment.


## KYC business-owner decision and current review boundary — 2026-11-06

- The business owner explicitly decided: keep KYC approve/reject controls open so users can use the KYC workflow. Do not disable or make these controls read-only solely because the current submission flow does not collect document images.
- Preserve the existing business rules: direct approval requires a pending application; an admin exception requires a reason; rejection requires a reason and currently can set the rejected state even without a pending submission. Do not change these rules without a separate business approval.
- Source inspection at feature branch `feat/btcbox-web3-auth-20261105` confirms the pending-only KYC read endpoint returns UID, email, applicant name, ID type, status, and submission timestamp; it omits identity number and credential secrets. Approval and rejection both stage an admin audit event, save the state, and report pending audit delivery.
- Evidence limitation remains: the current submission flow does not provide document-image evidence. The UI and operator guidance must not claim that an image/document authenticity check was completed. This is a disclosure limitation, not a reason to block the controls.
- The latest feature branch comparison against the previously verified audit-viewer head `1d3008a985a75fdcc8283bea9fd4989d59accd2e` reports 8 commits ahead / 0 behind. The current branch source includes the audit redaction helper and behavior tests, plus auth-security route tests. Exact-head GitHub Actions evidence for the current branch head is still not available from the workflow/status lookup; do not claim CI passed.
- No merge, deployment, production database migration, or financial write was performed. Deployment pause remains active.


## Exact-head CI result correction — 2026-11-06

- The prior workflow/status wrapper did not expose push-triggered runs, but a direct read-only Actions runs listing for branch `feat/btcbox-web3-auth-20261105` found run `42084534759` for exact SHA `bf996caffdee2d67c9d3ced4f48efd439e1a9559`.
- Run conclusion: `success`. Its single job completed successfully: backend dependency install, unified frontend/backend build, backend tests, fail-closed deployment preflight, and preserved-entrypoint checks all passed.
- Job log confirms backend tests: 153 passed / 0 failed.
- This is source/build/automated-test evidence only. It does not verify live Supabase RPC/migration readiness, browser KYC/admin workflows, external chain-verifier ingestion, or production behavior.
- This supersedes the earlier statement that exact-head CI was pending. No new Vercel deployment, merge, database migration, or production write was performed.



## KYC rejection-reason interaction repair — 2026-11-06

- Feature branch `feat/btcbox-web3-auth-20261105`: replaced the hardcoded KYC rejection reason “Document unclear” with an operator-entered required reason in the existing admin modal. The prompt is bounded to 300 characters; cancel/empty input stops the action; the submitted reason is passed to the existing API and audit path. Approve/reject controls remain available; no backend business rule changed.
- Added a source-contract test in `backend/tests/admin-entry.test.js` and updated the sensitive-action UI contract in `backend/tests/frontend_security.test.js` to recognize the dedicated reason prompt for KYC rejection. GitHub Actions first exposed the expected stale assertion (the number of generic confirmation calls decreased by one); that assertion was corrected to verify the explicit KYC reason prompt and empty-input guard.
- Latest feature commit at time of this note: `ff21de2432d6066db8c3f566bc27465d0307ec9e`. Exact-head CI run `42086414280` was in progress when recorded; do not claim this head passed until the run concludes successfully.
- Current KYC customer submission UI explicitly says document-photo upload is not required in this version. Admin review must therefore not imply document-image verification. The admin list currently has the submitted timestamp and email in the API payload but does not display both; this is a usability follow-up, not a reason to disable review.
- Repository tree audit confirms no chain-verifier/indexer/webhook/cron implementation files; the checked-in chain verification RPC is present in migration `0016`, but no in-repo caller or pending-record ingestion worker was found. This is limited to the inspected branch tree; external services remain unverified.
- Migration `0023` defines service-role-only bounded cleanup but only instructs invocation by a trusted scheduled job/maintenance task. No in-repo scheduler was found in the checked `vercel.json` or repository tree. Do not add an unauthenticated public cleanup endpoint.
- No merge, deployment, production database migration, or financial write was performed.


## KYC admin queue context and evidence disclosure — 2026-11-06

- On feature branch `feat/btcbox-web3-auth-20261105`, the admin KYC pending queue now displays the API-provided email and submission timestamp alongside UID, applicant name, and ID type. All user-controlled values remain escaped before HTML rendering.
- Added an explicit operator-facing notice: this version does not collect document photos; the queue data does not establish that document-image or identity-authenticity verification was completed. This is a disclosure only and does not disable either approval or rejection controls or change existing KYC business rules.
- Added source-contract assertions for the new fields, evidence notice, and continued presence of both action controls.
- Feature commits: `59ca01cef8a60646da1da7714f14694534e21cd1` (UI), `8df5e74d3b7d30bc2a014b9eec0647f4c1341e69` (new KYC UI contract tests), and `cecb81afa39f2b2371165aed341236fe2e84fb94` (security test assertion alignment). Run `42088289773` for `8df5e74d3b7d30bc2a014b9eec0647f4c1341e69` failed only because the pre-existing frontend security test still expected the old literal `escapeHtml(k.name)`/`escapeHtml(k.uid)` expressions; the UI now safely uses fallback expressions. The test was updated to assert the new exact escaped expressions plus email/submission-time escaping. The follow-up exact-head run `42088439272` for `cecb81afa39f2b2371165aed341236fe2e84fb94` completed successfully: unified build, 154 backend tests (154 passed / 0 failed), fail-closed preflight shape, and preserved entrypoint checks all passed. This remains automated source/build evidence only, not browser or live Supabase verification.
- Both modified feature files were fetched back from GitHub and their new source assertions were confirmed present. No browser interaction test has been performed.
- No merge to `main`, Vercel deployment, production database migration, or financial write was performed. Deployment pause remains active.


## Canonical PostgreSQL administrator audit reader — 2026-11-06

- Feature branch `feat/btcbox-web3-auth-20261105` now has an opt-in read path for the canonical `public.financial_audit_log` table. Enable only with `ADMIN_AUDIT_POSTGRES_READS_ENABLED=1`; it also requires the existing Supabase service-role storage configuration.
- The reader selects only `id, actor_id, subject_user_id, action, reason, created_at`; it deliberately does not expose raw `metadata`. The reason is passed through the existing audit-detail redactor. Pagination is keyset-based on descending identity `id`, with validated numeric cursor and bounded page size (1–200); action and UID filters are restricted to safe character sets before building PostgREST filters.
- When the opt-in flag is enabled but canonical storage/read fails, the API returns 503 and does not silently fall back to the incomplete state-document audit list. When the flag is off, existing `btcbox_state` behavior remains and the UI continues to disclose retention-limited completeness. The UI now labels the source based on the returned completeness field.
- No schema migration is required for this read path: it uses columns from the canonical ledger table created by migration `0002`. This is not live database verification; actual service-role SELECT availability, migration state, and response shape remain unverified. The feature flag must remain off until a read-only live check confirms the existing production schema and privileges.
- Feature commits in this batch: `222bdb7a69966e0c59b8326a4a4b2543ee67f211` (reader), `a00cf87c0d5d1728dd9e84fb0466fb5b0a98ecfb` (base URL normalization), `9c4884080309b48aa75e8fae2f065c89e4046a04` (contract tests; CI exposed a test-regex typo), `539e15c01bbae111111b6d822fe2fb68b10b0da7` (UI source disclosure), `cd9e5b5ee9908575bbe44bb5282731e6785f2841` (numeric cursor correction), `f5ee983bac2872b802e9556a206f31d7400739aa` (test assertion correction), `bc8008ce49bcb3e199af347c23a453f17f377792` (filter validation), and `4a17d37b5c651ebf87478e3c2755b379b1200bf9` (filter validation tests).
- Exact-head GitHub Actions run `42089217150` for `4a17d37b5c651ebf87478e3c2755b379b1200bf9` completed successfully. The unified frontend/backend build, 155 backend tests (155 passed / 0 failed), fail-closed preflight shape, and preserved-entrypoint checks all passed. The earlier failures in this sequence were caused by a source-contract test expecting an incorrectly escaped ordering literal; the assertion was corrected. This remains automated build/test evidence only, not live Supabase or browser verification.
- Chain deposit integration remains blocked by the absence of an in-repository verifier/indexer/webhook and pending-record ingestion worker. Migration `0016` provides the atomic verifier RPC but assumes a pending deposit row already exists. No caller or ingestion implementation was found in the complete feature-branch tree. External services remain unverified.
- No merge, Vercel deployment, production database migration, or financial write was performed. Deployment pause remains active.


## Production read-only audit readiness check — 2026-11-06

- Read-only Supabase inspection on project `zlozsutefnmgwwzrlipt` confirmed `public.financial_audit_log` exists with the base columns `id, actor_id, subject_user_id, action, object_type, object_id, reason, metadata, created_at`; RLS is enabled and `service_role` has SELECT privilege.
- The live table currently contains 0 rows. The production `btcbox_state` row also reports 0 audit-log entries, 0 pending outbox entries, 0 synced outbox entries, and 0 local-only entries. No audit content was read.
- Critical readiness gap: the live table does not have the `event_id` column, and `public.append_admin_audit_log(text,text,text,text,text,jsonb)` does not exist. Supabase migration inventory currently lists only `20261102133555` and `20261103062716`; migration `0021_admin_audit_log_append_only_v1.sql` is not recorded as applied.
- Therefore keep `ADMIN_AUDIT_POSTGRES_READS_ENABLED` OFF. The new reader is source/build-tested but must not be enabled against the current empty table; it would otherwise show an empty canonical list while the durable append RPC is unavailable. No migration was applied and no database writes were performed.
- Before enabling canonical history, separately approve and stage migration `0021`, verify the append RPC and idempotency behavior in an isolated environment, decide whether any legacy history needs a controlled backfill, then perform read-only production schema/privilege checks and a controlled end-to-end audit append/read test under explicit authorization.


## Live deposit-schema clarification — 2026-11-06

- A follow-up read-only production query corrected the earlier inference based solely on the migration ledger: the exact `public.verify_and_credit_deposit_atomic(text,text,text,text,text,numeric,integer,integer,text,text)` RPC exists, and `deposit_records` includes `credit_operation_id`, `request_hash`, `source`, `reference`, `note`, `chain_observed_amount`, `chain_confirmations`, `chain_verified_at`, and `chain_verifier_id`. The legacy `confirm_deposit_atomic(text,text)` RPC also exists.
- However, `deposit_records` currently contains 0 rows (0 pending, 0 confirmed, 0 rejected). The verifier RPC locks and verifies a pre-existing pending row; it does not create the pending row. No in-repository chain-verifier caller, indexer, webhook, or pending-intent ingestion worker was found in the feature branch tree. The user-facing deposit API still only returns configured addresses for zero-amount lookup and rejects user-supplied positive-amount credit requests.
- The migration inventory still lists only two versions, despite the live chain-verifier schema/RPC being present. Treat this as migration-history drift: do not blindly reapply migration `0016`; reconcile schema state and migration history in an isolated environment first.
- Production audit readiness remains blocked as described above: the canonical audit table exists but is empty; `event_id` and `append_admin_audit_log` are absent. Keep the canonical audit reader feature flag off.
- These were read-only metadata/aggregate checks only. No rows were read, no SQL writes or migrations were executed, and no deposit or financial operation was performed.


## Live shared-rate-limit readiness check — 2026-11-06

- Read-only production catalog checks against project `zlozsutefnmgwwzrlipt` confirm `public.btcbox_rate_limits`, `public.btcbox_rate_limit_consume_v1(text,text)`, and `public.btcbox_rate_limit_cleanup_v1()` are all absent.
- This confirms migration `0023_btcbox_shared_rate_limit_v1.sql` is not present in the live schema, regardless of the repository implementation. The 12 protected API policies therefore cannot use the shared Postgres limiter yet; the application is designed to fail closed with HTTP 503 when the required RPC/configuration is unavailable. Do not weaken this to an in-memory or local fallback.
- The cleanup scheduler must not be implemented or enabled against production before the table and cleanup RPC exist. After explicit approval to stage/apply migration `0023`, use a trusted scheduled invocation authenticated by a server-side secret; never expose an unauthenticated cleanup endpoint. No SQL writes or migrations were performed.


## KYC reviewer audit trail contract check — 2026-11-06

- Added a focused source-contract test confirming both KYC approve and reject routes persist `reviewed_by='admin'`, `reviewed_at`, decision reason, and stage an audit event before saving state and flushing the audit outbox. Both responses expose `audit_sync_pending` so the UI can warn operators when delivery is pending.
- No KYC business rule was changed: approval remains pending-only unless the existing reason-required exception flow is used; rejection remains available under the existing route behavior and requires a non-empty operator reason.
- Feature commit: `6a532279e81303d431fc49b35d1fbba138a8de62`. Exact-head GitHub Actions run `42090589549` succeeded: unified build, 156 backend tests (156 passed / 0 failed), fail-closed preflight shape, and preserved entrypoint checks all passed.
- A fresh read-only production catalog query reconfirmed `financial_audit_log` base columns exist but `event_id` and `append_admin_audit_log(text,text,text,text,text,jsonb)` are absent; `btcbox_rate_limits`, `btcbox_rate_limit_consume_v1`, and `btcbox_rate_limit_cleanup_v1` are also absent. Therefore the canonical audit read flag stays OFF and shared-rate-limit protected routes remain fail-closed. No schema writes, migrations, or financial writes were performed.
- No browser test, merge, Vercel deployment, or production migration was performed. Deployment pause remains active.


## KYC rejection reason adapter hardening — 2026-11-06

- Removed the generic `Rejected by admin` fallback from `apiAdapter.adminRejectKyc`. The adapter now passes only the operator-supplied reason; if it is absent/blank, the existing backend validation rejects the request rather than manufacturing an audit reason.
- Added a regression assertion to ensure the adapter never invents a rejection reason. The existing UI prompt still requires a non-empty reason and backend still enforces it.
- Feature commits: `1e8d3121ed573a9fe18d9d2c280dfada750cba10` (adapter fix) and `9bef7472df7b585032a5410a591b3adf8dca502e` (test). Exact-head GitHub Actions run `42090819188` succeeded: unified build, 157 backend tests (157 passed / 0 failed), fail-closed preflight shape, and preserved entrypoint checks all passed.
- Files were fetched back from GitHub and the adapter/test assertions were confirmed present. No browser test was performed.
- No merge, Vercel deployment, production migration, or financial write was performed. Deployment pause remains active.


## Migration status checker fail-closed correction — 2026-11-06

- Source audit found `backend/scripts/check_migration_status.py` could return exit code 0 when `DATABASE_URL` was absent, `psycopg2` was unavailable, or the migration ledger query failed. It also compared four-digit repository migration filenames directly with Supabase timestamp-style migration versions, which are different namespaces.
- Updated the checker to distinguish `STATIC_ONLY`, `DATABASE_UNAVAILABLE`, `VERSION_MAPPING_REQUIRED`, `MIGRATIONS_MISSING`, and `SCHEMA_LEDGER_MATCHED`. Only an explicitly requested `--offline` filename-only check may return success without database verification. Missing DB configuration/dependency, connection/query failures, and incompatible version namespaces now exit non-zero.
- Added Node regression tests for explicit offline labeling and missing-`DATABASE_URL` fail-closed behavior.
- Feature commits: `203444889d5c18a5e0b8eb8205f5826a7709e021` (checker) and `46f6482feff1e32c1aaeeb953339058af1202f17` (tests). Exact-head CI run `42093273024` and prior checker-only run `42093244767` were still in progress at documentation time; do not treat this batch as CI-verified until the final-head run completes.
- No production database connection, migration, schema write, financial write, merge, or deployment was performed.


### Migration checker CI correction follow-up

- The first exact-head run with the new regression tests, `42093273024` for `46f6482feff1e32c1aaeeb953339058af1202f17`, failed because the Python filename regex was double-escaped and therefore matched no SQL migration files. This was a test-discovered implementation defect, not a database result.
- Corrected the regex and committed `5a21fbd1286f0798d6cdc9bb496fb74b4a75acc6`. Exact-head CI run `42093472292` was in progress when this note was written. The earlier checker-only run `42093244767` passed but predates the regression-test file and is not final-head evidence.
- Keep this batch pending until run `42093472292` completes; if it fails, inspect the job log and repair before proceeding.


## PostgreSQL audit bigint cursor precision correction — 2026-11-06

- Source audit found `financial_audit_log.id` is PostgreSQL `bigint`, but the canonical reader parsed the PostgREST JSON numeric ID through JavaScript `Number.isSafeInteger`. Values above JS safe integer precision could be rounded, corrupting keyset pagination cursors.
- Reader now requests `id::text` from PostgREST and validates a positive decimal string before using it as the cursor; it does not convert the bigint cursor to Number.
- Added source-contract assertions for text casting and decimal-string validation.
- Feature commits: `cd12e15ac7409eab6c4aa90df979af52885644f1` (reader), `946017e2813f338a89f793868832a0a4e408c9d7` (initial test assertion), `bd59b9fc249a0fd65e646fb261194dfd3e81279f` (test assertion correction).
- Reader-only CI run `42093709361` passed; exact-head test run `42093773921` was queued/in progress at documentation time. Do not mark this batch fully verified until exact-head CI completes.
- Canonical audit read remains opt-in and fail-closed. Do not enable until the corresponding migration is verified on the target database; no production DB access or migration was performed.


### Bigint cursor validator follow-up — CI failures and correction

- Exact-head run `42093773921` failed because the new source-contract test used an over-escaped regex assertion. The first assertion-only correction did not match the file line and therefore did not remove the failure.
- Further inspection of the actual API source also found the reader's validation still used `Number.isSafeInteger(Number(row.id))`; the earlier attempted replacement had changed only the PostgREST select expression, not the validator. This is now corrected to require a positive decimal-string ID and avoid numeric coercion.
- Follow-up commits: `e751122ddb7b2b051acc560393f5fd830d6e4b89`, `dcac0282a6c1b7fcf91af4b3a1aa784a6f0bc5da`, `15e5a7eb88f9cb550b44cccd48988c04ff332910`, and final regex correction `5a8daf847e16d486220238ad58211ef85920054a`.
- The exact-head CI run for `5a8daf847e16d486220238ad58211ef85920054a` is pending at the time of this update. Do not mark bigint cursor work complete until the final run passes and source is re-read.


### Final audit cursor validation status

- The corrected implementation at `5a8daf847e16d486220238ad58211ef85920054a` passed CI run `42094067086`.
- Subsequent test-only cleanup commits `83a27e5204128aa6c518f7f9483928e2dfe6d3a5` and `6306d2527f8d333f312f55a55dccf42d97626538` simplify the brittle source assertion to literal substring checks and explicitly assert that unsafe Number coercion is absent.
- Exact latest-head CI run `42094224016` for `6306d2527f8d333f312f55a55dccf42d97626538` is still in progress. Until it finishes, use the implementation-level passing run as evidence for the cursor correction, but do not mark the current exact branch head fully CI-verified.
- No database read toggle enabled, no production migration, no merge, and no deployment.


## Audit bigint cursor exact-head verification — 2026-11-06

- Latest feature HEAD before the deposit guard batch: `6306d2527f8d333f312f55a55dccf42d97626538`.
- Exact-head CI run `42094224016` completed successfully: `159 passed, 0 failed`; unified build and fail-closed preflight job passed.
- Bigint cursor work is verified at that SHA. Reader selects `id::text`, validates a positive decimal string, and uses the string cursor without Number coercion.

## Deposit ingestion boundary guard

- Repository tree audit at `6306d2527f8d333f312f55a55dccf42d97626538` found only the chain-verification migration and no in-repo chain indexer, webhook, ingestion worker, cron, or verifier implementation.
- `verify_and_credit_deposit_atomic` in migration `0016` assumes an existing pending `deposit_records` row; it is service-role-only and checks exact amount, asset/network, txid, confirmations, request hash, idempotency/duplicate state, and writes ledger/audit in the transaction.
- Current `POST /api/deposit` in `backend/api-core.js` only returns a configured deposit address for zero/empty amount requests and rejects user-declared positive amounts with HTTP 403. It has no pending-record insertion or verifier RPC call.
- Added a source-contract regression test in `backend/tests/backend_security.test.js` to keep user-declared deposit amounts from being credited or routed into the chain verifier before a trusted ingestion service is implemented.
- Test commits: `db627894bb268cfdc1cf0dab358b9247a46e93a8` (initial test), `9da24057a9c81c7c6c7612a6ff22cd56dfac45ae` (corrected route-boundary assertions).
- The new exact-head CI run must pass before this guard is considered verified. No deposit row, ledger balance, or production DB was modified.
- Rate-limit cleanup remains a service-role-only bounded SQL helper (48-hour retention, 5,000-row batch). There is no in-repo trusted scheduler; do not add an unauthenticated public cleanup route. Scheduler choice awaits deployment-plan/secret ownership review.


### Deposit guard and rate-limit cleanup privilege regression tests — follow-up

- Exact-head CI run `42103526187` for `9da24057a9c81c7c6c7612a6ff22cd56dfac45ae` passed. The added deposit source-contract guard is verified at that SHA.
- Added a further regression guard in `backend/tests/shared-rate-limit.test.js` to assert the cleanup RPC explicitly revokes PUBLIC/anon/authenticated and grants execution only to service_role, and that API core does not expose the cleanup RPC.
- Latest feature commit: `01f5e1f1e6d0d04717b84d1c9ea0457f560986c4`; exact-head CI run `42103611209` is in progress.
- Cleanup remains unscheduled until a trusted scheduler, secret handling, and hosting-plan constraints are confirmed. No public endpoint, cron configuration, or deployment was added.


## Chain-deposit verifier contract regression tests and ingestion design — 2026-11-06

- Latest source/test commit: `322c3f826cc369131e7448886133171001f62590`. Added five source-contract regression tests over migration `0016_financial_deposit_chain_verification_v3.sql`: confirmation/hash validation, existing pending-row lock and exact asset/network/amount match, atomic financial operation + confirmed state + audit event, same-observation idempotent replay, and service_role-only execution with legacy manual-confirmation bypass blocked.
- Exact-head CI run `42104362259` completed successfully. Unified build passed; backend tests: **165 passed / 0 failed**; fail-closed preflight configuration-shape check passed; unified output and preserved entrypoint checks passed.
- Added `docs/DEPOSIT_CHAIN_INGESTION_CONTRACT.md` in documentation-only commit `d8f5e695332c4f995aba86aa9bd2cdb9d01b9747`. It documents the current user-facing 403 guard, the verifier RPC's dependency on an existing pending intent, the missing in-repository ingestion/worker path, required trust boundaries, idempotency, chain finality/reorg handling, operational controls, acceptance gates, and unresolved provider/asset/address/scheduler decisions.
- Current feature branch HEAD is `d8f5e695332c4f995aba86aa9bd2cdb9d01b9747`. The latest code/test commit has exact-head CI evidence above; the subsequent commit changes documentation only and did not alter executable source.
- This is source-contract/build evidence, not proof of live chain-provider integration, a working pending-intent creator, production RPC privileges, or an end-to-end deposit credit. Keep positive-amount user deposit requests fail-closed. No production rows, balances, schema, or secrets were changed.
- No merge, Vercel deployment, production migration, or financial write was performed. Deployment pause remains active.


## Security and database-readiness batch — 2026-11-06 (UTC+8)

- SOURCE OBSERVED: feature branch `feat/btcbox-web3-auth-20261105` advanced to `ed15357f4cbfbcf8539b0a893c9cd192be93ad79`.
- TEST PASSED: migration-checker regression fixture at `0f27798aaee2ebcfceaced37268bb53ff2c1e822`; CI run `42108055357` completed successfully. It verifies a timestamp-form migration ledger is not compared to repository four-digit SQL filenames and is reported as `VERSION_MAPPING_REQUIRED`.
- SOURCE OBSERVED: shared rate-limit RPC response validation now requires explicit `ok: true`, exact `remaining = max(0, limit - count)`, and a `window_start` aligned to the configured fixed window. Invalid payloads continue to fail closed as `RATE_LIMIT_UNAVAILABLE` (HTTP 503).
- SOURCE OBSERVED: regression coverage was added in `backend/tests/shared-rate-limit.test.js`; the auth route fixture was updated to return the full RPC success contract and aligned window start in `backend/tests/auth-security-routes.test.js`.
- NOT VERIFIED: CI for `ed15357f4cbfbcf8539b0a893c9cd192be93ad79` is still running as workflow `42108400377`; earlier attempts failed because the auth test's mocked RPC response omitted `ok: true` and used an unaligned `window_start`. The fixture was corrected; do not treat the new CI as passed until its exact-head result is green.
- SOURCE OBSERVED: canonical admin audit reader remains opt-in via `ADMIN_AUDIT_POSTGRES_READS_ENABLED=1`, uses `id::text`, string keyset cursors and fail-closed 503 behavior; no production PostgREST execution or schema verification was performed.
- SAFETY: no production database writes/migrations, no real financial actions, no merge to `main`, and no Vercel deployment.


## Follow-up verification — 2026-11-06 (UTC+8)

- CORRECTION / TEST PASSED: shared rate-limit strict RPC response contract and corrected auth test fixtures passed exact-head CI run `42108563079` at feature SHA `203ed17db13992834e4a9f143d1f7b3618a73746`. This supersedes the earlier `NOT VERIFIED` status recorded above for the corrected fixture batch.
- PostgREST bigint cast compatibility checked against the official PostgREST Tables and Views documentation: `select=id::text,...` is a documented supported column-casting form. Source: https://docs.postgrest.org/en/stable/references/api/tables_views.html
- AUDIT CURSOR HARDENING: added `isPositivePostgresBigintString` to reject non-decimal, zero/negative, >19-digit, and >9223372036854775807 cursors without JavaScript Number coercion. Applied to both incoming `before` cursors and returned row IDs. The cursor continues to be sent as a decimal string in the `id=lt.<cursor>` filter; bigint ordering remains database-side.
- Added source-contract regression coverage in `backend/tests/admin-audit-persistence.test.js` for the signed PostgreSQL bigint upper bound and absence of Number coercion.
- Latest feature branch HEAD: `0d6bdb7efda22a2d3abc22c0763ac555266316fe`. Exact-head CI run `42108921107` is in progress; do not mark the audit cursor change accepted until this exact-head run succeeds.
- Intermediate commits `187dbbe4a62431b688507f81b4f872a7cfced014` and `2b4b8f24a3ce1a2cd9bb9061af798e631d3e877f` also have CI runs in progress; exact-head run `42108921107` is the acceptance gate.
- No production PostgREST request was executed, no production schema/rows/secrets were changed, and the canonical admin audit reader remains opt-in. No merge, deployment, or financial write was performed.


### CI failure analysis and correction — 2026-11-06 (UTC+8)

- Exact-head run `42108921107` at `0d6bdb7efda22a2d3abc22c0763ac555266316fe` FAILED in backend tests. Build passed; test runner reported 16 failures because an overly broad automated line replacement unintentionally changed three adjacent identity validators (`validateBtcboxUsername`, `validateBtcboxLoginPassword`, `isSupabaseUserId`) and introduced an invalid regular-expression assertion in the new audit test.
- This was a source-edit regression, not an application runtime observation. It has been corrected: the three identity validators were restored to their original contracts; bigint cursor assertions now use literal string checks instead of an invalid regex literal.
- Corrective commits: `b78e41a5ae80bd6c8dfd67946dcf39879a7214d8` (restore validators) and `754debb8a541ce810e9a2cd7b7035ea32d1d7a62` (repair test assertions).
- Current feature HEAD: `754debb8a541ce810e9a2cd7b7035ea32d1d7a62`. Exact-head CI run `42109483650` is queued/in progress. Do not accept the batch until this exact SHA passes all jobs.
- No production DB access or writes, merge, deployment, or financial operation occurred.


- ADDITIONAL CORRECTION: review of the corrective diff found one more adjacent helper affected by the same broad replacement: `isValidAuthEmail`. Restored its original email-format contract in `a2d4c067eee5f839b715c287fd228aa6129d13e7`.
- Diff audit from the last known-good feature SHA `203ed17db13992834e4a9f143d1f7b3618a73746` now shows exactly two changed files: `backend/api-core.js` and `backend/tests/admin-audit-persistence.test.js`. No other files are in this audit-cursor patch series.
- Latest feature HEAD: `a2d4c067eee5f839b715c287fd228aa6129d13e7`; exact-head CI run `42109618999` is in progress. Prior runs for intermediate corrective commits failed and are superseded by this latest exact-head run.


- FOLLOW-UP TEST FINDINGS: exact-head run `42109618999` still failed after the initial restoration because the email/password regular-expression backslashes had been double-escaped in source, and one audit-reader assertion used an over-escaped regex. Both were corrected using exact source regex semantics and literal assertion text.
- Corrective commits: `678cd1235f0e507ee07a334c97032faf26fc9727` (restore email/password regex semantics) and `9f999c03025f92ececa4bd67a5e369d3b506ca60` (audit assertion).
- Latest feature SHA `9f999c03025f92ececa4bd67a5e369d3b506ca60`; exact-head CI run `42109785313` queued/in progress. Previous failures remain failures and must not be represented as passing. Acceptance depends only on the latest exact-head run.
- Diff audit against known-good SHA `203ed17db13992834e4a9f143d1f7b3618a73746` confirms only `backend/api-core.js` and `backend/tests/admin-audit-persistence.test.js` changed in this patch series.


## Admin audit hardening follow-up — 2026-11-06 (UTC+8)

- TEST PASSED: exact-head CI run `42112511644` completed successfully for feature SHA `b99086bc8cef86fa23f65e57ebb54ab5c2102ff9`. The unified build, backend tests, fail-closed deployment configuration preflight, and unified output/entrypoint verification all passed.
- TEST PASSED: audit-detail redaction regression coverage now includes password/token/API key/recovery code/email/EVM/TRON address masking, case-insensitive key-value matching, and a final 300-character output cap after substitutions.
- SOURCE OBSERVED: review of the state-document audit pagination path found that it emitted a next-page cursor whenever a page contained exactly `limit` rows, without checking whether another row existed. This can cause a spurious empty-page request.
- SOURCE OBSERVED: action and uid filter values were sliced to 100 characters before validation, so an overlong input could be silently accepted as a truncated filter.
- NEXT ACTION: change fallback pagination to read `limit + 1` rows for has-more detection and reject overlong raw action/uid filters before applying the existing allowlist regex. Add source-contract regression tests and require exact-head CI.
- SAFETY: no production PostgREST read, production DB write/migration, merge, Vercel deployment, or financial operation was performed. Canonical PostgreSQL audit reads remain opt-in and fail closed.


### Audit pagination, filter, and outbox privacy patch — pending exact-head CI

- SOURCE OBSERVED / PATCHED: feature commit `a2026ea81fc8d6567b7d8886b8f7fc7be6e5f181` changes state-document pagination to compute `hasMore` from the filtered result count before returning a cursor. A full final page no longer advertises a phantom next page.
- SOURCE OBSERVED / PATCHED: action and uid filters are no longer truncated before validation; raw trimmed values longer than 100 characters are rejected with the existing 400 validation codes.
- SOURCE OBSERVED / PATCHED: feature commit `3e983a0a85b346a8e314e03a21434136fc449df0` applies `redactAdminAuditDetail` before an audit event is staged in the durable state-document outbox. The PostgreSQL delivery path therefore receives the already-redacted stored detail, rather than raw input.
- Regression tests added in `backend/tests/admin-audit-persistence.test.js` cover truthful pagination continuation, overlong action/uid rejection, and redaction before durable outbox persistence.
- Latest feature HEAD: `d324fdbb458ed58d6a6c1f0610ef847717da157a`. Exact-head CI run `42112984087` is in progress; do not mark these fixes accepted until this exact run completes successfully.
- Intermediate exact-head runs `42112907989` and `42112924121` were started for earlier commits in this patch series; they are superseded by `42112984087`.
- No production DB write/read, migration, merge, Vercel deployment, or financial operation was performed.


### Legacy outbox redaction retry hardening — 2026-11-06 (UTC+8)

- FOLLOW-UP SOURCE REVIEW: moving redaction to event creation protects new outbox rows, but previously queued `pending` rows could still contain pre-fix raw detail. The retry worker therefore also normalizes each pending entry with `redactAdminAuditDetail` before sending it to the PostgreSQL RPC and persists the sanitized value together with any sync-state change.
- Code commit: `ee7a81fe650f4446c91d961b48fd5aa818b1b608`.
- Regression test commit: `21e5c87c0bd44f29ca8ded53ab3ec3f0eb0db387`, asserting legacy pending rows are redacted and the RPC receives only the sanitized detail.
- Earlier patch commits have passed their own exact-head CI: pagination implementation `a2026ea81fc8d6567b7d8886b8f7fc7be6e5f181` / run `42112907989`; pagination/filter tests `118554d0e837ab2ff40724bf150a28771c3967b6` / run `42112924121`; new-event outbox redaction and regression test `d324fdbb458ed58d6a6c1f0610ef847717da157a` / run `42112984087`.
- Latest exact-head CI run `42113080692` for `21e5c87c0bd44f29ca8ded53ab3ec3f0eb0db387` is in progress. The code-only run `42113066862` for `ee7a81fe650f4446c91d961b48fd5aa818b1b608` is also in progress. Do not mark the legacy-retry hardening accepted until the latest exact-head run passes.
- IMPORTANT LIMIT: this patch only sanitizes local pending outbox rows before future retries. It does not rewrite or delete any already-committed PostgreSQL audit rows; historical canonical rows remain append-only and require a separately approved, evidence-based remediation if exposure is established.
- No production DB read/write, schema change, merge, deployment, or financial operation was performed.


### Audit outbox redaction-upgrade idempotency — 2026-11-06 (UTC+8)

- SOURCE FINDING: the append-only SQL RPC used the stable `event_id` for deduplication but also required the persisted `reason` text to equal the retry payload. When a pending legacy event is sanitized before retry, the reason can legitimately differ from the already-inserted historical row, causing a permanent idempotency conflict and a stuck outbox.
- PATCH: prepared SQL contract `backend/supabase/sql/0021_admin_audit_log_append_only_v1.sql` now keeps strict event identity checks for actor, subject, action, object type/id, and metadata, while allowing reason text to differ across retries after a redaction-policy upgrade. The canonical row remains append-only; this does not rewrite its historical reason.
- Regression test: `backend/tests/admin-audit-persistence.test.js` verifies stable identity checks remain and reason-only mismatch is tolerated.
- Code/SQL commit: `407cf44a349e3240ec4765667978228b03c21109`; regression-test commit: `e4cd543e8bb4c406d24579b5cfb35c0f477f5cf6`.
- Latest exact-head CI: run `42113367770` for `e4cd543e8bb4c406d24579b5cfb35c0f477f5cf6` is in progress. Do not mark this SQL contract change accepted until the exact-head CI passes.
- Migration remains prepared only. It has not been applied to production or staging. No DB reads/writes, merges, deployments, or financial operations were performed.


### Bounded admin audit outbox retry — 2026-11-06 (UTC+8)

- SOURCE REVIEW: the previous retry loop attempted every pending audit event sequentially with no per-request network timeout. A large backlog could make an admin request spend unbounded time draining the queue.
- PATCH: each invocation now processes at most 10 pending entries concurrently; each PostgREST RPC has a 4-second timeout. Unprocessed and failed entries remain pending for later retries; successful results are persisted together.
- Code commit: `495aa6f47c8457fb12f1d787c33c8a69762f9461`; regression test commit: `f254cb216982239dea13a5fcedced850f57c24d6`.
- Exact-head CI run `42113504711` for `f254cb216982239dea13a5fcedced850f57c24d6` is in progress. Code-only run `42113489305` is also in progress. Do not mark bounded retry accepted until exact-head CI passes.
- Prior redaction-safe idempotency SQL/test commits `407cf44a349e3240ec4765667978228b03c21109` and `e4cd543e8bb4c406d24579b5cfb35c0f477f5cf6` passed exact-head CI runs `42113353008` and `42113367770` respectively.
- Outbox delivery remains request-triggered; no trusted scheduler/cron was added. The shared rate-limit cleanup scheduler gap also remains. No production or staging migration/database operation, merge, deployment, or financial operation was performed.
