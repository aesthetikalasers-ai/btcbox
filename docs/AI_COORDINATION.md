# BTCBOX AI Coordination

Last refreshed: 2026-11-07 (UTC+8)
Repository: `avali9308-code/btcboxcdt`
Active integration branch: `work/btcbox-unified-20261104`
Coordination record: this document is historical baseline plus appended current-batch evidence; do not treat the 2026-11-05 branch inventory as current.
Observed baseline: `main` at/including merge commit `93a236e4a3ed6c9edd2003ac1068a89161015511` (PR #20, read-only account/orders API).

## Roles and boundaries

- Current assignment: ChatGPT is 2号 AI, responsible for Web App + Admin Panel implementation, integration, responsive UX and independent cross-checks. 1号 AI owns Core backend; 3号 AI owns architecture, API contracts and cross-module integration. Read the latest unified-branch handoff before acting; do not overwrite another owner's work.
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


### Bounded outbox retry CI correction — 2026-11-06 (UTC+8)

- Initial code/test CI runs `42113489305` and `42113504711` failed because the generated URL trailing-slash regex in the new function had an extra escape, producing a JavaScript syntax error. This was a patch-generation defect, not a test or runtime dependency failure.
- Corrected in commit `5f4b6a94156f812661207c27bcf83bc7fc6a2d68`; source now uses the same valid `replace(/\\/+$/, '')` URL normalization semantics as the existing code.
- Exact-head CI run `42113645330` for `5f4b6a94156f812661207c27bcf83bc7fc6a2d68` is in progress. Do not accept bounded retry until this run completes successfully.


## Admin audit outbox bounded retry and backlog protection — 2026-11-06 (UTC+8)

- TEST PASSED: bounded outbox retry exact-head CI run `42113645330` completed successfully at feature SHA `5f4b6a94156f812661207c27bcf83bc7fc6a2d68`. All workflow steps passed, including unified build, backend tests, fail-closed configuration preflight, and output/entrypoint verification.
- SOURCE REVIEW: the outbox intentionally preserves every unsynced event. If PostgreSQL delivery remains unavailable for a prolonged period, pending entries could otherwise grow the shared state document without a bound.
- PATCHED: `auditAdmin` now counts pending entries before appending a new event. At 5,000 pending events it throws a typed `ADMIN_AUDIT_OUTBOX_FULL` error before the caller reaches `saveDB`; the outer handler returns HTTP 503 and explicitly states no change was saved. Existing pending events are never discarded. Read-only admin routes remain available.
- Code commit: `cd8afac2b65d63845054b6a1cabd37aca8c7b507`; regression test commit: `263aa4cf826b1341caba94ee456d118005bec17e`.
- Exact-head CI run `42114215138` for `263aa4cf826b1341caba94ee456d118005bec17e` is in progress. Do not mark backlog protection accepted until this exact-head run completes successfully.
- Shared rate-limit cleanup SQL is already indexed on `updated_at`, deletes only rows older than 48 hours, and is capped at 5,000 rows per invocation. Repository tree review found no trusted scheduler/worker or Vercel cron configuration. Do not add a public cleanup route; scheduler ownership and hosting-plan constraints remain unresolved.
- Admin mutation source-contract tests already verify audit staging precedes state save and PostgreSQL delivery follows the durable save for all nine legacy non-financial admin mutation routes. The new test covers the pending-outbox ceiling and explicit fail-closed response.
- SAFETY: no production/staging DB operations, production migrations, financial writes, merge, or Vercel deployment occurred. Positive-amount user deposits remain rejected until a trusted ingestion worker and pending-intent creator are implemented and independently verified.


### Audit outbox zero-capacity retention edge — 2026-11-06 (UTC+8)

- TEST PASSED: pending-outbox ceiling patch at exact feature SHA `263aa4cf826b1341caba94ee456d118005bec17e`, CI run `42114215138` completed successfully.
- FOLLOW-UP SOURCE FINDING: the existing history-retention expression used `slice(-Math.max(0, 5000 - pending.length))`. In JavaScript, `slice(-0)` is `slice(0)`, so when pending entries occupy all 5,000 slots the expression retains every non-pending historical entry instead of retaining zero.
- PATCHED: compute `retainedLimit` explicitly and branch: only call `slice(-retainedLimit)` when the limit is greater than zero; otherwise retain an empty non-pending list. Pending events remain untouched.
- Code commit: `0b9887fc19558f59f5043ada6c5e8ac92bb5b867`; regression test commit: `753de438e72a73344c125749a16d8d1762dbeb3a`.
- Exact-head CI run `42114754980` for `753de438e72a73344c125749a16d8d1762dbeb3a` is in progress. The preceding code-only run `42114738313` is also in progress. Do not accept this edge-case fix until the latest exact-head run completes successfully.
- No production/staging DB access, schema migration, financial write, merge, or Vercel deployment occurred.


### Audit retention and auth-secret redaction follow-up — 2026-11-06 (UTC+8)

- TEST PASSED: the `slice(-0)` retention edge correction passed exact-head CI run `42114754980` at `753de438e72a73344c125749a16d8d1762dbeb3a`; code-only run `42114738313` for `0b9887fc19558f59f5043ada6c5e8ac92bb5b867` also completed successfully.
- SOURCE FINDING: audit detail redaction covered generic token/secret fields but missed common compound names such as `access_token`, `refresh_token`, `supabase_service_role_key`, and `client_secret`. Those values can be embedded in a free-form detail string and would otherwise remain in the persisted audit outbox.
- PATCHED: extend key-value redaction to common access/refresh/auth/session token names, authorization/bearer fields, client secrets, service-role/API/private keys, OTP and TOTP secret names. Regression fixture now includes these cases.
- Code commit: `abb9869b7d1babd5a9b0b23b55b3775de2882c05`; test commit: `732a53f035dd1a854e0f136f1b978c830b71c20c`.
- Exact-head CI run `42114900352` for `732a53f035dd1a854e0f136f1b978c830b71c20c` is in progress; code-only run `42114875225` is also in progress. Do not accept this redaction extension until exact-head CI passes.
- No production/staging DB access, schema migration, financial write, merge, or Vercel deployment occurred.


### Seconds settlement request-hash validation hardening — 2026-11-06 (UTC+8)

- SOURCE OBSERVED: prepared migration `0024_seconds_settlement_idempotency_v1.sql` previously validated `p_request_hash` by length only. A 64-character non-hex string could pass the SQL argument guard even though the API constructs SHA-256 hexadecimal hashes.
- PATCHED: the SQL guard now requires exactly 64 lowercase hexadecimal characters via `coalesce(p_request_hash,'') !~ '^[0-9a-f]{64}$'`. This aligns the database contract with the API's SHA-256 digest format and rejects NULL, malformed, or non-hex request hashes.
- REGRESSION TEST: `backend/tests/seconds-persistent-order-guard.test.js` now asserts the strict SHA-256 hex validation contract.
- SQL commit: `62a94971e9226d7a76a8f4814f8ad09a75b2358e`. Initial test commit `2c69cf6b63d71a688af1c7009067191fbc364091` failed CI run `42117132815` because the newly added regex assertion was syntactically malformed (166/167 tests passed; test file failed to parse).
- PATCHED: replaced the fragile regex assertion with a literal SQL-contract assertion. Corrected test commit / current feature HEAD: `e88b0df202fda20224daee1aeb2f829a55500222`. Its exact-head CI is pending; do not mark this patch TEST PASSED until the new run completes successfully. Code-only SQL run `42117120706` completed successfully.
- SAFETY: migration remains prepared only. No production/staging DB migration, DB write, merge, Vercel deployment, or financial operation was performed.


### Seconds settlement hash-guard regression-test repair — 2026-11-06 (UTC+8)

- CI DIAGNOSIS: exact-head run `42117271378` for `e88b0df202fda20224daee1aeb2f829a55500222` failed in backend tests; unified build passed, but `backend/tests/seconds-persistent-order-guard.test.js` contained an orphaned tail from the prior malformed regex assertion. GitHub Actions log identifies a SyntaxError at line 191 (166/167 tests passed).
- PATCHED: removed only the orphaned fragment; retained the literal strict SHA-256 SQL assertion and the existing security-invoker, row-lock, ledger, and service-role contract assertions already covered in the intended test block.
- Repair commit: `b58db3a6a6171d4749e08070c5914dd15ac11cc8`. Exact-head CI has been triggered by the commit; pending verification.
- Migration `0024` remains prepared only. No production/staging DB operation, merge, deployment, or financial operation occurred.


### Seconds settlement migration structural repair — 2026-11-06 (UTC+8)

- CI RESULT: exact-head run `42117812367` for `b58db3a6a6171d4749e08070c5914dd15ac11cc8` completed `failure`. Unified build passed; backend tests failed at `backend/tests/seconds-persistent-order-guard.test.js:76` because the strict hash-guard assertion did not match the migration source.
- ROOT CAUSE (SOURCE OBSERVED): migration `0024_seconds_settlement_idempotency_v1.sql` had been structurally corrupted by the earlier edit: the request-ID regex lost its closing quote/anchor, the new request-hash guard and fragments of the function body were appended after the grants, and duplicated SQL fragments followed the canonical function. This is a migration source defect, not a test-only defect.
- PATCHED: reconstructed the migration from its first complete function body, retained exactly one `create or replace function`, one revoke, and one service_role grant; restored the request ID guard as `^[A-Za-z0-9_-]{16,100}$`; placed the strict request hash guard `coalesce(p_request_hash,'') !~ '^[0-9a-f]{64}$'` inside the function's initial argument-validation block. Ledger/financial operations, row lock, duplicate replay logic, and grants preserved from the canonical function body.
- Repair commit / current feature head at time of note: `1a3bbb625e98351a20d2b21812f858b50e12ff91`. Exact-head CI run `42118084457` is queued; not yet accepted.
- SAFETY: migration remains source-only and unapplied. No production/staging DB operations, financial writes, merge, or Vercel deployment occurred.


### Authentication session timestamp boundary hardening — 2026-11-06 (UTC+8)

- SOURCE OBSERVED: `getSessionRecord` rejected missing, non-positive, and expired `created_at` values, but accepted timestamps arbitrarily far in the future because `Date.now() - createdAt` becomes negative. This affects every route relying on the canonical BTCBOX session validator, including first-time credential setup and identity-link flows.
- PATCHED: reject session timestamps more than 60 seconds ahead of server time, allowing a small clock-skew tolerance while preventing future-dated sessions from satisfying fresh-session checks.
- Code commit: `a009834e302e32e190b5d8fa1c6fc4ccc953c689`; regression-test commit: `80f4893d9ba6f39936589cfd34b32f462cc498c1`. An initial source-test regex assertion was replaced with a literal assertion before final verification.
- Exact-head CI for the latest test commit is pending; do not mark this guard accepted until its exact SHA run passes.
- SAFETY: no production DB operation, migration, merge, deployment, or financial action occurred.


### Authentication session and identity-link review — 2026-11-06 (UTC+8)

- TEST PASSED: future-dated session timestamp guard and its regression coverage passed exact-head CI run `42118224555` at feature SHA `80f4893d9ba6f39936589cfd34b32f462cc498c1`. Unified build, backend tests, fail-closed deployment configuration preflight, and output/entrypoint verification all completed successfully.
- SOURCE REVIEW: re-read the server-verified Supabase provider resolver, Google/Web3 identity exchange, source and target reauthentication, identity-link marker consumption, account identity conflict checks, wallet uniqueness checks, and frontend callback flow.
- SOURCE OBSERVED: identity linking requires a fresh source proof and a separate fresh target proof; source/target tokens are checked against Supabase `/auth/v1/user`, JWT subject and auth_time, provider allowlist, wallet address validation, optional account TOTP, shared rate limits, and revision-CAS persistence. Marker replay and concurrent CAS conflict tests are present.
- TEST COVERAGE OBSERVED: `backend/tests/auth-security-routes.test.js` includes source/target stale or future auth_time rejection, expired signed auth_time, wrong-purpose/expired marker rejection, replay prevention, one-winner CAS, credential-recovery marker consumption, and fail-closed rate-limit behavior. `backend/tests/google-only-identity.test.js` covers provider/identity agreement and EVM/Solana address validation. `backend/tests/identity-link-frontend-contract.test.js` covers the two-step client flow and cookie-bound API calls.
- REVIEW RESULT: no additional reproducible defect was established in the reviewed identity-link flow; no speculative code change was made.
- NEXT BATCH: inspect account profile/security settings read and write contracts, including username setup/change, credential updates, session invalidation, and 2FA lifecycle. Preserve existing trading page layout and keep financial actions disabled.
- SAFETY: no production/staging DB access or writes, migration, merge, Vercel deployment, or financial operation occurred.


### Account credential and 2FA session invalidation hardening — 2026-11-06 (UTC+8)

- SOURCE OBSERVED: `POST /api/account/credentials` verified the current password when changing an existing BTCBOX credential, but did not invalidate other active sessions after the credential changed. This allowed previously issued sessions to remain usable after a password change.
- PATCHED: the route now explicitly resolves and verifies the current session record, preserves that request's session, and removes every other session belonging to the same user before the CAS-backed save. First-time credential setup still requires a session no older than five minutes; existing-password changes still require the current BTCBOX password.
- SOURCE OBSERVED: `POST /api/2fa/disable` verified a fresh TOTP step but retained other active sessions after removal of the second factor.
- PATCHED: after a valid, one-time TOTP verification, the route preserves the current verified session and invalidates the user's other active sessions before persistence.
- DEFENSIVE FIX: account snapshot `kyc_level` previously dereferenced `user.kyc.status` without guarding the KYC object, despite the adjacent fields already handling absent legacy KYC data. It now safely reports level 0 when the object is absent.
- REGRESSION COVERAGE ADDED: account credential tests assert current-session preservation and other-session revocation; auth-security route tests assert the same for 2FA disable; account snapshot test covers legacy users without a KYC object.
- Commits in the feature branch: `3c2ddacf1b7881896716a58dac34ea6cfbcddb58`, `16bb80df3e532a01e7a96fc808acd21ecb712bde`, `24d998bdf12a73cc9bd56bf1956fe86a467b99d3`, `f785cc190f0aaa5a70ebbd59963696ecd3bf498b`, latest exact feature HEAD `de70001529974c5741a9f5ba6fef2848d12d2054`.
- Exact-head CI runs `42118729189`, `42118737250`, `42118780556`, and `42118789024` completed successfully for their respective commits. Latest combined account-hardening HEAD `de70001529974c5741a9f5ba6fef2848d12d2054` passed exact-head CI run `42118796890`; all unified build, backend tests, fail-closed deployment configuration preflight, and entrypoint verification steps succeeded.
- SAFETY: no production/staging database writes or migrations, merge, Vercel deployment, or financial operations occurred.


### 2FA enrollment session invalidation — 2026-11-06 (UTC+8)

- TEST PASSED (previous account batch): latest combined account-hardening SHA `de70001529974c5741a9f5ba6fef2848d12d2054` passed exact-head CI run `42118796890`, including unified build, backend tests, fail-closed deployment configuration preflight, and entrypoint verification.
- SOURCE OBSERVED: enabling TOTP at `POST /api/2fa/confirm` previously set `twofa_enabled=true` after checking the one-time TOTP code, but did not revoke sessions or pending 2FA login challenges issued before enrollment. Older sessions could therefore remain active without having completed the newly enabled second factor.
- PATCHED: require a valid current BTCBOX session; after consuming a valid one-time TOTP step, preserve that current session while revoking every other session for the account and deleting the account's pending `temp_tokens` before CAS persistence.
- REGRESSION COVERAGE ADDED: auth security route contract asserts current-session validation, current-session preservation, revocation of other sessions, deletion of pending login challenges, and persistence ordering.
- Feature commits: `fae0b09f154b2b2c72735ac3a356576265b432b2` (API) and `3a986fe2488bb3822323d7265a78f377dd0b92b3` (test); latest feature HEAD `3a986fe2488bb3822323d7265a78f377dd0b92b3`.
- Exact-head CI run `42119004524` passed for API commit `fae0b09f154b2b2c72735ac3a356576265b432b2`; latest 2FA enrollment SHA `3a986fe2488bb3822323d7265a78f377dd0b92b3` passed exact-head CI run `42119012415`, including unified build, backend tests, fail-closed deployment configuration preflight, and entrypoint verification.
- SAFETY: no production/staging DB writes or migrations, merge, Vercel deployment, or financial operations occurred.


### 2FA challenge lifecycle hardening — 2026-11-06 (UTC+8)

- TEST PASSED (2FA enrollment): exact-head CI run `42119012415` passed for `3a986fe2488bb3822323d7265a78f377dd0b92b3`.
- SOURCE OBSERVED: disabling 2FA revoked older sessions but left pending `temp_tokens`; a pending second-step challenge could outlive the account's factor state. The `POST /api/login/2fa` route also treated a missing/non-finite expiry differently from an expired one and did not re-check that TOTP remained enabled when consuming the challenge.
- PATCHED: disabling 2FA now deletes all pending login challenges for that user before persistence. The 2FA login route now requires a finite expiry strictly later than current time, deletes expired/malformed challenge records, and rejects/deletes a challenge if the user no longer has an enabled TOTP secret.
- REGRESSION COVERAGE ADDED: route-contract tests assert pending challenge invalidation on disable, finite strict expiry, and current enabled-factor checks.
- Feature commits: `d5a40e32f19503c7f9ac5287847cd64ef29165cd` (API) and `9a06a8c38f0c5aeb987dc8a44fcd818b0d20f401` (tests); latest feature HEAD `9a06a8c38f0c5aeb987dc8a44fcd818b0d20f401`.
- Exact-head CI run `42119180401` completed successfully for latest challenge lifecycle SHA `9a06a8c38f0c5aeb987dc8a44fcd818b0d20f401`; API commit run `42119171670` also completed successfully.
- SAFETY: no production/staging DB writes or migrations, merge, Vercel deployment, or financial operations occurred.


### Frontend 2FA expiry and account-state cleanup — 2026-11-06 (UTC+8)

- TEST PASSED (previous backend challenge batch): latest SHA `9a06a8c38f0c5aeb987dc8a44fcd818b0d20f401` passed exact-head CI run `42119180401`; API-only commit run `42119171670` also passed.
- SOURCE OBSERVED: frontend `verifyTwoFactor` retained an expired/revoked challenge token and kept the auth provider in `two-factor` state after terminal challenge errors, leaving the user on a verification flow that could not succeed. Sign-out also left identity-link transient proof state in memory, allowing stale account-scoped UI state to survive account exit.
- PATCHED: terminal 2FA challenge errors (`TWOFA_CHALLENGE_EXPIRED`, `TWOFA_NOT_ENABLED`, `USER_NOT_FOUND`, `ACCOUNT_FROZEN`) now clear the pending challenge and return the auth provider to anonymous state; invalid TOTP codes remain retryable. Sign-out now clears identity-link source proof, pending target token, identity-link 2FA flag, credential recovery state, and notices in addition to the previous auth state.
- REGRESSION COVERAGE ADDED: frontend contract test in `backend/tests/identity-link-frontend-contract.test.js` checks terminal challenge cleanup and account-scoped transient-state reset.
- Feature commits: `a359e6bdcd339a8fc5f9637d88a72101713b3c44` (frontend) and `36ba7cb9a6afd65caae0d6dccf86bc49396d873b` (contract test); latest feature HEAD `36ba7cb9a6afd65caae0d6dccf86bc49396d873b`.
- Exact-head CI run `42119401407` completed successfully for frontend challenge/sign-out cleanup SHA `36ba7cb9a6afd65caae0d6dccf86bc49396d873b`.
- SAFETY: no production/staging DB writes or migrations, merge, Vercel deployment, or financial operations occurred.


### Account reauthentication challenge terminal-state cleanup — 2026-11-06 (UTC+8)

- TEST PASSED (prior frontend batch): exact-head CI run `42119401407` completed successfully for `36ba7cb9a6afd65caae0d6dccf86bc49396d873b`.
- SOURCE OBSERVED: identity-link and credential-recovery second-factor handlers retained pending Supabase identity tokens after terminal errors (expired/invalid reauth proof, identity not linked, invalid Supabase identity, or frozen account), leaving stale account reauthentication state available for repeated submissions. Invalid TOTP and transient service/rate-limit failures must remain retryable.
- PATCHED: both handlers now clear pending identity tokens and their 2FA-needed flags for terminal errors only; retryable TOTP/service/rate-limit failures are not included in the terminal error set.
- REGRESSION COVERAGE ADDED: frontend contract test asserts the terminal cleanup behavior for both flows and exact terminal-code allowlist.
- Feature commits: `ef67f9c3c5ad81bdefa2117089217872e037cd6c` (frontend), `65dbee4d4828c101825baa868ac7323892603d58` (test), `17b945ce54713e973c536d4490d6696b93cd7da6` (test assertion cleanup); latest feature HEAD `17b945ce54713e973c536d4490d6696b93cd7da6`.
- Exact-head CI run `42119663440` completed successfully for latest SHA `17b945ce54713e973c536d4490d6696b93cd7da6`.
- SAFETY: no production/staging DB writes or migrations, merge, Vercel deployment, or financial operations occurred.


### OAuth callback and credential-change reauthentication cleanup — 2026-11-06 (UTC+8)

- TEST PASSED (prior batch): exact-head CI run `42119663440` completed successfully for `17b945ce54713e973c536d4490d6696b93cd7da6`.
- SOURCE OBSERVED: OAuth credential-recovery and identity-link reauthentication callbacks could leave stale pending tokens/flags from an earlier attempt when a fresh callback succeeded, entered the 2FA branch, or failed terminally. Credential reset/update also preserved the current session but left other account-scoped reauthentication proofs attached to that session.
- PATCHED frontend: successful OAuth reauthentication replaces/clears old pending state; entering a 2FA challenge clears incompatible ready/source-verified flags; failed reauth callbacks clear their corresponding pending tokens and state while preserving existing retry behavior for the dedicated 2FA challenge handlers.
- PATCHED backend: successful credential reset and credential setup/update now clear both `credential_reauth` and `identity_link_reauth` markers from the preserved current session before persistence. Other sessions continue to be revoked as before.
- REGRESSION COVERAGE ADDED: frontend OAuth callback state transitions and backend marker invalidation are asserted by contract tests.
- Feature commits: `1b5b2a43db11347d824104f2027b3dda136f5acd` (frontend), `f6f25c065fc7d857a2130902801f40f4c645797d` (frontend test), `6bb6b10090ec995ec7253c1d9eafb09a5d91c9dc` (API), `7c20187b016b3d8c6a3678b4aebebd251c6e85d6` (API test); latest feature HEAD pending final CI.
- TEST PASSED: exact-head CI run `42119925291` completed successfully for `7c20187b016b3d8c6a3678b4aebebd251c6e85d6`.
- SAFETY: no production/staging DB writes or migrations, merge, Vercel deployment, or financial operations occurred.


### 2FA challenge atomicity and logout persistence regression checks — 2026-11-06 (UTC+8)

- TEST PASSED (previous batch): exact-head CI run `42119925291` completed successfully for `7c20187b016b3d8c6a3678b4aebebd251c6e85d6`.
- SOURCE OBSERVED: 2FA login currently validates expiry/enabled factor/frozen state, consumes the one-time TOTP step, deletes the temporary challenge, creates the session, and persists the combined state through the database revision-CAS before returning success. This preserves single-winner semantics; no speculative production logic change was made.
- SOURCE OBSERVED: logout deletes only the presented cookie session, persists state, then returns the clearing cookie. A persistence failure must not be treated as a successful logout.
- REGRESSION COVERAGE ADDED: tests assert 2FA challenge/TOTP/session write ordering and terminal guards; logout success removes only the current session, preserves unrelated sessions, and increments persisted revision; failed CAS must not report success or pretend the server session was revoked.
- Feature test commit: `623bdefda65ac99c498987d3b7ebfca540bcfa22`; latest feature HEAD pending exact-head CI.
- TEST PASSED: exact-head CI run `42120141576` completed successfully for `623bdefda65ac99c498987d3b7ebfca540bcfa22` (unified build, backend tests, fail-closed config preflight, and unified output verification all succeeded).
- SAFETY: no production/staging DB writes or migrations, merge, Vercel deployment, or financial operations occurred.


### Identity-link one-time proof local-state ordering — 2026-11-06 (UTC+8)

- SOURCE OBSERVED: after the server successfully consumes the one-time identity-link source proof, Google OAuth and Web3 UI previously waited for Supabase client sign-out before clearing the local source-verified flag. If provider cleanup failed after the server-side link had committed, the UI could still display the source as verified even though the server proof was already consumed.
- PATCHED frontend: after successful server link response, clear source-verified, pending identity token, and 2FA-needed state immediately, before attempting Supabase sign-out and account refresh. Failed link requests still retain retryable source proof state.
- REGRESSION COVERAGE ADDED: asserts the successful server call precedes local proof clearing and that local clearing precedes provider sign-out for both Google callback and Web3 linking.
- Feature commits: `c481a2d98a96b1e58f38c4a4df8ed688100f0282` (frontend), `5bd578d237811a36631a9fddeb3ef11a57a35c77` (test); latest feature HEAD pending exact-head CI.
- SAFETY: no production/staging DB writes or migrations, merge, Vercel deployment, or financial operations occurred.



### Identity-link proof consumption ordering and session lifecycle regression checks — 2026-11-06 (UTC+8)

- TEST PASSED: exact-head unified build/backend/preflight run `42119925291` completed successfully for `7c20187b016b3d8c6a3678b4aebebd251c6e85d6`.
- SOURCE OBSERVED: the 2FA login challenge is consumed only after current challenge/factor/frozen-account checks and TOTP-step validation; session creation and challenge deletion are persisted together through revision-CAS. Logout removes only the presented cookie session and does not clear client state when server persistence fails.
- REGRESSION COVERAGE ADDED: test commit `623bdefda65ac99c498987d3b7ebfca540bcfa22` asserts 2FA challenge/TOTP/session write ordering and logout current-session-only removal, revision increment, and fail-closed CAS behavior. Exact-head CI run `42120141576` completed successfully for that SHA.
- SOURCE OBSERVED: Google OAuth and Web3 identity-link success paths now clear the consumed local source proof, pending target token, and 2FA-needed state immediately after the server confirms the link, before attempting Supabase client sign-out. This avoids retaining a locally verified proof after the server has consumed it.
- REGRESSION COVERAGE ADDED: test commit `5bd578d237811a36631a9fddeb3ef11a57a35c77` checks both Google and Web3 ordering. Exact-head backend CI run `42120292911` completed successfully for the current feature branch HEAD `5bd578d237811a36631a9fddeb3ef11a57a35c77`.
- REVIEW RESULT: source/target identity proof validation, server-side one-time marker consumption, conflict checks, CAS winner semantics, and local proof clearing were re-reviewed. No additional reproducible defect was established; no speculative auth behavior change was made.
- NOT VERIFIED: live Google OAuth and wallet provider behavior in a deployed environment; Vercel deployment remains paused and no end-to-end live authentication was performed.
- SAFETY: no production/staging DB access or writes, migration, merge, Vercel deployment, or financial operation occurred.


### Wallet identity canonicalization across Ethereum and Solana — 2026-11-06 (UTC+8)

- SOURCE OBSERVED: server-verified Ethereum wallet addresses are normalized to lowercase when parsed from Supabase claims, but legacy wallet_identities and legacy primary wallet_address records may retain EIP-55 checksum casing. Three uniqueness paths (initial Supabase login, identity-link conflict detection, and same-account wallet duplicate detection) previously compared address strings exactly. The same EVM address with different letter casing could therefore evade a conflict/duplicate check.
- PATCHED: added strict chain-aware wallet normalization and equality helpers. Ethereum addresses are validated and compared case-insensitively; Solana addresses remain case-sensitive; malformed stored addresses and cross-chain comparisons never match. Applied consistently to login ownership checks, identity-link conflict checks, and existing-account duplicate prevention.
- REGRESSION COVERAGE ADDED: backend/tests/google-only-identity.test.js checks EVM checksum-case equivalence, Solana case sensitivity, malformed address rejection, and chain separation.
- Feature commits: API dba3382938fff77326a54cf49a05b260131d59af; tests 07a1fa266f7fa847d3c162372d73da21b8aeb897. Latest feature HEAD: 07a1fa266f7fa847d3c162372d73da21b8aeb897.
- CI PENDING at note time: API commit run 42120773368 and exact latest-head run 42120779237 both in progress. Do not mark this batch accepted until latest-head CI completes successfully.
- REVIEW RESULT: no other source-proven defect was established in the inspected provider allowlist, Supabase identity-ID ownership checks, and wallet claim validation. Live provider behavior remains NOT VERIFIED.
- SAFETY: no DB writes/migrations, merge, deployment, or financial operations occurred.


### Identity-link wallet record deduplication and legacy-field compatibility — 2026-11-06 (UTC+8)

- TEST PASSED: previous exact-head wallet canonicalization CI run 42120779237 completed successfully for 07a1fa266f7fa847d3c162372d73da21b8aeb897.
- SOURCE OBSERVED: the identity-link route correctly rejected wallets already owned by another BTCBOX account, but after passing that conflict check it unconditionally appended a wallet record. Linking a second Supabase identity representing the same wallet to the same BTCBOX account could therefore create duplicate wallet_identities entries. The same-account check also needed to recognize the legacy primary wallet_chain/wallet_address fields.
- PATCHED: identity linking now checks the normalized wallet_identities list and legacy primary wallet fields before appending a wallet record. It still records the distinct Supabase auth identity in auth_identities; it only deduplicates the wallet record itself.
- REGRESSION COVERAGE ADDED: backend/tests/google-only-identity.test.js asserts both normalized and legacy wallet duplicate checks and confirms the linked auth identity is still appended.
- Feature commits: API f682106791dac858a3d2f91d3097239ff2fd51a0; tests affe1573f696b47528a6bf008a914390590c5657. Latest feature HEAD affe1573f696b47528a6bf008a914390590c5657.
- CI PENDING: API run 42121004690 and exact latest-head run 42121010913 were in progress when recorded. This batch is not accepted until exact latest-head CI succeeds.
- NOT VERIFIED: no live provider login/link test; no wallet unlink endpoint was found in the inspected route section, and no unlink behavior was changed.
- SAFETY: no production/staging DB writes or migrations, merge, Vercel deployment, or financial operations occurred.


### Legacy Supabase identity ownership compatibility — 2026-11-06 (UTC+8)

- TEST PASSED: exact latest-head CI run 42121010913 completed successfully for feature HEAD affe1573f696b47528a6bf008a914390590c5657, validating wallet record deduplication.
- SOURCE OBSERVED: isSupabaseIdentityLinked previously recognized only the primary supabase_user_id and supabase_user_ids array. It did not recognize an identity present only in a legacy auth_identities record. Ownership checks that rely on this helper (including login mismatch and identity-link conflict checks) could therefore fail to recognize that legacy-linked Supabase identity.
- PATCHED: isSupabaseIdentityLinked now checks the primary ID, the ID array, and auth_identities entries; empty requested IDs fail closed.
- REGRESSION COVERAGE ADDED: tests cover primary, array, legacy auth_identities-only, unrelated, and empty-ID cases.
- Feature commits: API 04687d7fc890578d0b84a4b46949ef91ae24eba5; tests 6ee725cdb87c79d0d547dbc62137252b2c558580. Latest feature HEAD 6ee725cdb87c79d0d547dbc62137252b2c558580.
- CI PENDING: API run 42121255258 and exact latest-head run 42121260377. Do not accept this batch until exact latest-head CI succeeds.
- SAFETY: no production/staging DB writes or migrations, merge, Vercel deployment, or financial operations occurred.


### Scope correction and first-time account creation coverage — 2026-11-06 (UTC+8)

- USER CONFIRMED: BTCBOX currently has no legacy users. Do not treat legacy account migration or backward-compatibility as an active product requirement unless explicitly requested.
- SCOPE CORRECTION: reverted the speculative auth_identities-only fallback in isSupabaseIdentityLinked; ownership matching remains based on the active primary Supabase ID and explicit supabase_user_ids list. Removed the legacy-only regression assertion. This intentionally avoids expanding production logic for a non-existent user cohort.
- SOURCE REVIEW: first-time Supabase sign-in creates one internal BTCBOX user from the server-verified Supabase UUID; Google requires a confirmed valid email, Web3 requires a validated wallet identity and does not synthesize an email. The creation record initializes the provider identity, wallet identity (when Web3), empty balances, and account collections; the session is then created and persisted with the user in the same saveDB operation.
- REGRESSION COVERAGE ADDED: test asserts first-time account creation identity fields, wallet/provider initialization, empty balance initialization, and session persistence through the same save operation.
- Feature commits: scope rollback API 80ce76e35ffc53b1100d47b193455ffd2e73ac84; legacy-only test removal 2cd43761c3afe433962d6f1928d5d7e7d32947cc; first-time account test e7248b720679e32d3450bc8c8e20c6e173c8ca24. Latest feature HEAD e7248b720679e32d3450bc8c8e20c6e173c8ca24.
- CI PENDING: exact latest-head run 42121479935. The earlier run for the intermediate scope rollback is not a substitute for exact latest HEAD.
- NOT VERIFIED: live Google/Web3 provider callbacks, actual first-time sign-in in deployed environment, and persistence behavior against production storage.
- SAFETY: no production/staging DB writes or migrations, merge, Vercel deployment, or financial operations occurred.


### First-time credential setup guard review — 2026-11-06 (UTC+8)

- TEST PASSED: exact latest-head CI run 42121479935 completed successfully for feature HEAD e7248b720679e32d3450bc8c8e20c6e173c8ca24, including first-time Supabase account creation coverage.
- SOURCE OBSERVED: POST /api/account/credentials requires a valid current BTCBOX session, validates username and password, requires a current password when credentials already exist, and limits initial credential setup to a session created within the previous five minutes. Duplicate normalized usernames are rejected before credential mutation. Passwords are stored with PBKDF2-SHA256 at 600,000 iterations. Other account sessions and stale reauthentication markers are invalidated before revision-CAS persistence; the current session is preserved.
- REGRESSION COVERAGE ADDED: backend/tests/account-credentials.test.js now asserts the fresh-session gate, existing-password verification, validation and duplicate-check ordering before mutation, normalized username uniqueness, configured password hash algorithm, and persistence failure handling.
- Feature test commit: bc1cb0484b06cd6eeebb3ccaee0351588ca1099c. Latest feature HEAD bc1cb0484b06cd6eeebb3ccaee0351588ca1099c.
- CI PENDING: exact latest-head run 42121694108. Do not accept this test-only batch until exact latest-head CI succeeds.
- NOT VERIFIED: live browser setup flow, real Supabase session timing, and production persistence behavior. No backend behavior change was made in this batch.
- SAFETY: no production/staging DB writes or migrations, merge, Vercel deployment, or financial operations occurred.


### Username login and 2FA persistence hardening — 2026-11-06 (UTC+8)

- TEST PASSED: preceding exact feature HEAD `bc1cb0484b06cd6eeebb3ccaee0351588ca1099c` completed CI run `42121694108` successfully.
- SOURCE OBSERVED: username/password login persists its 2FA temporary challenge before returning it; 2FA verification validates challenge expiry, account existence, 2FA state and frozen status, applies shared rate limiting, consumes a TOTP step, removes the temporary challenge, and creates the authenticated session in one state save.
- FIXED: all persistence paths for 2FA challenge creation, invalid-challenge cleanup, and final 2FA session creation now return explicit `PERSISTENCE_UNAVAILABLE` 503 responses on write failure. The final session cookie is emitted only after the session/challenge transition is saved. Successful 2FA sessions now record `auth_method: username_password_2fa`.
- REGRESSION COVERAGE ADDED: `backend/tests/auth-security-routes.test.js` asserts challenge persistence precedes returning the temporary token and that the final cookie response follows successful persistence, including frozen/expired/disabled challenge branches.
- Feature API commit `caf51a3a5c49df801f05ab71d04291c531af12bd`; test commit `ad31716bcfd7a0bff2e5927ea6f70a1afc5ace47`.
- Exact feature HEAD at coordination update: ad31716bcfd7a0bff2e5927ea6f70a1afc5ace47. CI for this exact HEAD must complete successfully before acceptance.
- NOT VERIFIED: live Supabase/Google browser flow, production persistence fault injection, and external authenticator behavior. No production DB writes/migrations, merge, deployment, or financial operations occurred.


### Google/Web3 login persistence parity — 2026-11-06 (UTC+8)

- TEST PASSED: preceding exact feature HEAD `ad31716bcfd7a0bff2e5927ea6f70a1afc5ace47` completed CI run `42122722478` successfully.
- SOURCE OBSERVED: Supabase login verifies the bearer token through `/auth/v1/user`, validates a single allowed provider, requires confirmed email for Google or validated wallet identity for Web3, resolves an internal account, checks identity/wallet ownership and frozen state before issuing a login challenge or session.
- FIXED: Supabase Google/Web3 2FA challenge creation now fails closed with `PERSISTENCE_UNAVAILABLE` when state persistence fails. Final authenticated session persistence is also guarded; no success cookie is returned unless save succeeds. Sessions now record explicit `supabase_google` or `supabase_web3` auth method.
- REGRESSION COVERAGE ADDED: `backend/tests/google-only-identity.test.js` verifies frozen-account gating precedes challenge/account creation, 2FA challenge persistence precedes challenge response, final session persistence precedes success cookie, and auth-method attribution.
- Feature API commit `5ea329384167522d81333d0a69daddc199c6506c`; test commit `ef225e3f7f44e05ec5f306f8b24dc2d9d1cd0046`.
- Exact feature HEAD: ef225e3f7f44e05ec5f306f8b24dc2d9d1cd0046. CI must pass for this exact HEAD before acceptance.
- NOT VERIFIED: live Google OAuth and wallet browser callbacks, real provider state, production DB fault injection. No production writes/migrations, merge, deployment, or financial operations occurred.


### Shared 2FA provider attribution follow-up — 2026-11-06 (UTC+8)

- FOLLOW-UP FIX: Google/Web3 and username/password login share `/api/login/2fa`; temporary challenges now retain their originating `auth_method`, and the final session copies that value. This prevents a Google or wallet 2FA completion from being mislabeled as username/password authentication.
- REGRESSION COVERAGE ADDED: `backend/tests/google-only-identity.test.js` checks provider-specific challenge attribution and propagation into the final session.
- Feature API commit `f6378d05f1880843b70c8f1e933b16d6fe96028c`; test commit `b927139c042505a7fa5477cebb0604e824008657`.
- Exact feature HEAD: b927139c042505a7fa5477cebb0604e824008657. Exact-head CI required; prior run results do not certify this new HEAD.


### CI regression correction — 2026-11-06 (UTC+8)

- CI runs `42122937012` (API commit `5ea329384167522d81333d0a69daddc199c6506c`) and `42122960265` (test commit `ef225e3f7f44e05ec5f306f8b24dc2d9d1cd0046`) failed in backend tests, not build. Both failures identify the same stale source assertion in `google-only-identity.test.js`: it expected the pre-hardening session object without `auth_method`. This was a test expectation mismatch introduced by the intentional provider-attribution change, not a runtime test failure.
- FIXED: updated the assertion to require explicit provider-specific `supabase_google` / `supabase_web3` attribution. Test commit `53c5ac8f1402807ff7840b454ade7b9cbe701eb7`.
- The following exact HEAD must pass CI before this batch is accepted: 53c5ac8f1402807ff7840b454ade7b9cbe701eb7.


### Auth provider attribution, persistence assertions, and session lifecycle regression — 2026-11-06 (UTC+8)

- CI FAILURE REVIEW: exact feature HEAD `53c5ac8f1402807ff7840b454ade7b9cbe701eb7` failed run `42123159803` because two test assertions lagged behind intentional code changes: username 2FA temporary challenges now include `auth_method`, and first-time Supabase session persistence is wrapped in fail-closed try/catch. The runtime build succeeded; backend test stage failed and downstream preflight stages were skipped.
- FIXED TESTS: updated the username 2FA challenge assertion to include `username_password_2fa`; updated first-time Supabase account creation test to assert guarded persistence rather than a direct unguarded save. Intermediate exact HEAD `0a53ae6bbee3746cf0851250fe183bc8372691d7` passed CI run `42123726358`.
- SESSION REVIEW: `getSessionRecord` rejects missing/invalid/non-positive creation timestamps, timestamps more than 60 seconds in the future, and sessions older than `SESSION_MAX_AGE_MS` (7 days). Protected handlers derive their user through this validator.
- LOGOUT REVIEW: logout deletes only the presented session token, persists the state change, and emits the clearing cookie only after persistence succeeds. A persistence failure is surfaced by the outer handler as an error and does not return a success cookie.
- REGRESSION COVERAGE ADDED: expired sessions cannot access protected identity reauthentication; after logout, the old cookie receives 401 while a separate device session for the same account remains usable. Existing logout tests also assert current-session-only revocation and fail-closed persistence.
- TEST PASSED: exact feature HEAD `febacca709ebb90f2f4a2071ce7cd69a31ce69ec` completed unified build, backend tests, fail-closed deployment configuration preflight, and unified output/entrypoint verification in CI run `42123833236`.
- ACCEPTANCE: auth provider attribution and session lifecycle regression batch accepted for feature-branch QA only. This does not authorize merge to `main`, Vercel deployment, production DB writes/migrations, or real financial operations.
- NOT VERIFIED: live browser logout behavior, real multi-device provider sessions, and production persistence fault injection. No live OAuth or wallet sign-in was performed.


### Credential rotation and 2FA lifecycle fail-closed hardening — 2026-11-06 (UTC+8)

- SOURCE OBSERVED: `POST /api/account/credentials` preserved the current authenticated session and revoked all other BTCBOX sessions, and cleared current-session credential/identity reauthentication markers. It did not revoke outstanding `db.temp_tokens` for the account, leaving pre-change 2FA login challenges usable until expiry.
- FIXED: credential updates now remove all pending temporary login challenges for the same account before the same revision-CAS persistence. Other accounts' challenges are not touched. The current session remains preserved; other sessions remain revoked.
- SOURCE OBSERVED: `POST /api/2fa/enable`, `POST /api/2fa/confirm`, and `POST /api/2fa/disable` performed direct `saveDB` calls without route-specific handling for revision conflicts or storage outages.
- FIXED: all three 2FA state transitions now return `ACCOUNT_UPDATE_CONFLICT` (409) on revision-CAS conflict and `PERSISTENCE_UNAVAILABLE` (503) on other persistence errors. Success responses occur only after persistence succeeds.
- REGRESSION COVERAGE: credential update tests assert pending account-scoped 2FA challenges are revoked before persistence. Auth route tests assert guarded persistence for setup/enable/disable and assert other sessions plus pending challenges are removed before the guarded write.
- Feature commits: API `a9fb8a70ea461331b90587a35fa52797287f34ab`; credential test `749df4ab7d1bf38ab33664c542a040aab8b714c7`; 2FA tests `741c709d818cb10145620e2e0ba84891736d64de`.
- TEST PASSED: exact feature HEAD `741c709d818cb10145620e2e0ba84891736d64de`, CI run `42124394817`, unified build, backend tests, fail-closed deployment configuration validation, and unified output/entrypoint checks all succeeded.
- REVIEW RESULT: password change and 2FA enrollment/removal revoke account-scoped old sessions/challenges while preserving the verified current session. The state changes remain atomic under database revision-CAS; conflict or persistence failure does not return success.
- NOT VERIFIED: live browser flows, authenticator-app behavior, actual multi-device sessions against deployed storage, and production persistence fault injection. No live OAuth/Web3 sign-in was performed.
- ACCEPTANCE: accepted for feature-branch QA only. No merge to `main`, Vercel deployment, production database writes/migrations, or real financial operations authorized or performed.


### React account-security surface audit — 2026-11-06 (UTC+8)

- SOURCE OBSERVED: `frontend/src/features/account/AccountSecurityPage.tsx` exposes linked sign-in methods and BTCBOX password recovery, but does not expose 2FA enrollment, confirmation, disablement, or authenticator recovery controls.
- SOURCE OBSERVED: `frontend/src/lib/api.ts` contains login 2FA completion but no client wrappers for `/api/2fa/enable`, `/api/2fa/confirm`, or `/api/2fa/disable`. The backend routes exist and have fail-closed persistence handling.
- SOURCE OBSERVED: `frontend/src/lib/auth.tsx` clears the local BTCBOX auth state only after the logout API succeeds; failed server logout preserves the signed-in UI state and reports the error. It also clears pending credential/identity reauthentication state on successful sign-out.
- SCOPE GUARD: the coordination baseline still records both root CRA and `frontend/` Vite applications and has not established which is canonical for the intended production hostname. Therefore no React security UI was added in this batch; implementing 2FA controls before canonical-root resolution risks building functionality into the non-deployed app.
- NOT VERIFIED: the active production app's 2FA settings UI, browser behavior after cross-device session revocation, and live provider/session synchronization.
- NEXT ACTION: resolve canonical app root and deployment entrypoint, then implement/test a complete 2FA management flow only in the confirmed active frontend. Preserve the locked trading page layout.


## Template migration reconciliation — 2026-11-06 (UTC+8)

### SOURCE OBSERVED
- Re-read this coordination document at blob 38245d759510afe77c204b3db2c0e4fce5c74f72 before this batch.
- Migration branch HEAD: `6af0210b6b2716cf5d0310fa3b7384d33bf8e808`; its tree contains Git submodule entries (mode `160000`) for the pinned template repositories, not expanded vendor source files.
- Pinned upstream snapshots: Strata Pro `a3f79d0237c68faddc877f8c1b00afece2fbbae8`; Shadcn Fintech `a905058c75a840896d27a16991f2e7cc1ca06f3f`. The upstream trees inspected contain 32 and 198 file blobs respectively. These counts confirm upstream source trees, not recursive clone/download into BTCBOX.
- Current auth feature branch HEAD: `741c709d818cb10145620e2e0ba84891736d64de`; its tree has no `frontend/vendor` directory. Its CI run `42124394817` passed unified build, backend tests, fail-closed deployment preflight, and unified output/entrypoint checks as previously recorded.
- The two branches are diverged. Compare reports migration branch as base and auth branch as head: 372 commits ahead / 24 behind, common ancestor `93a236e4a3ed6c9edd2003ac1068a89161015511`. This is not a safe direct-merge instruction; inspect unique commits and file overlap before any integration.
- Coordination branch remains the authoritative work entrypoint. No code, submodule, deployment, environment, or database changes were made in this batch.

### CONCLUSION / CLASSIFICATION
- SOURCE OBSERVED: both template versions are pinned as submodule references on the migration branch; neither template is expanded as ordinary files in the current auth branch.
- NOT VERIFIED: recursive submodule checkout/download, local dependency install/build of either upstream, actual page/component reuse in the canonical runtime, and visual/functional integration.
- SOURCE OBSERVED: the migration guide says these are design/component sources only; mock data, seeded balances, simulated transfers, Clerk auth, and fake ticker behavior must not be imported into BTCBOX.

### NEXT BATCH — SAFE EXECUTION
1. Build a source inventory from the exact pinned upstream trees: page routes, component entrypoints, package dependencies, licenses/attributions, and external service assumptions.
2. Build a BTCBOX route-to-template mapping without copying files yet; mark reuse, adapt, retain-native, or reject.
3. Resolve canonical app root and Vercel build configuration before changing frontend ownership or removing legacy assets.
4. Prepare a dedicated integration branch from the current approved development base only after inventory and compatibility review. Do not merge either divergent branch wholesale.
5. Preserve the locked trading layout and all existing auth backend behavior. No merge to main, deployment, production DB writes/migrations, or financial operations without user approval.


## Follow-up API contract audit — 2026-11-06

Application branch inspected: `feat/btcbox-web3-auth-20261105` at `741c709d818cb10145620e2e0ba84891736d64de`.

- SOURCE OBSERVED: backend exposes market ticker, candles and depth; spot limit submit/cancel routes; seconds order/settle/positions routes; account and order reads; deposit-address query; withdrawal validation/review flow; KYC and support submission.
- SOURCE OBSERVED: spot matching uses `submit_limit_order_matching_v1` / `cancel_limit_order_matching_v1` and is blocked unless the matching-engine cutover gate passes. Market orders are explicitly rejected.
- SOURCE OBSERVED: seconds trading uses server-side reference prices and atomic SQL RPCs with idempotency protections; it is distinct from perpetual futures and is blocked unless the financial-write cutover gate passes.
- SOURCE OBSERVED: `0008_financial_spot_trade_v3.sql` explicitly states it is not a matching engine; do not treat it as the active order book implementation. Separate `0009_financial_matching_engine_v1.sql` is present.
- SOURCE OBSERVED: current Vite `frontend/src/lib/api.ts` exposes market/kline, account read and order-history read, but not spot submit/cancel or seconds order/settle/positions methods. Current React routes for spot, seconds, orders, assets, deposit and withdrawal remain placeholders or are not connected.
- SOURCE OBSERVED: the legacy vanilla-JS customer UI has some trading interaction code, but it is not automatically connected to the new Vite React app.
- NOT VERIFIED: financial migrations/RPCs have been applied to the target Supabase project, matching or financial cutover flags are enabled, or any live financial lifecycle is end-to-end ready.
- NOT FOUND IN INSPECTED SOURCE: a perpetual futures engine/API; do not relabel seconds contracts as futures.
- Updated detail: see `docs/BTCBOX-FRONTEND-BACKEND-INTEGRATION-MATRIX.md` for the complete route/API matrix and safe connection sequence.


## Derivatives template source audit — 2026-11-06

### SOURCE OBSERVED

- The pinned Strata Pro source at `bymilon/strata-pro-crypto-ui` commit `a3f79d0237c68faddc877f8c1b00afece2fbbae8` contains 42 tree entries. Its tracked source is a dashboard starter: app shell, sidebar/topbar, token icon, dashboard cards/charts/table and static dashboard data. No futures, perpetual, derivatives, leverage, margin, position, or contract-specific source paths were found.
- Strata Pro README explicitly describes the project as frontend-only, using mock market data, and excluding live trading, auth, and backend integration.
- The pinned Shadcn Fintech source at `abderrahimghazali/shadcn-fintech` commit `a905058c75a840896d27a16991f2e7cc1ca06f3f` contains Crypto, Investments, Accounts, Transactions and Transfers pages, but no futures/perpetual/derivatives/margin/position source paths.
- Shadcn Fintech `src/components/crypto/trade-form.tsx` is a spot-style conversion/buy/sell form. Its `handleTrade()` uses local timers to display a successful trade without calling a backend. `crypto-page-client.tsx` seeds prices from static data and simulates price drift every three seconds. These are demo interactions, not an exchange order flow.

### INTEGRATION DECISION

- Do not treat either downloaded template as an existing perpetual-contract implementation.
- Reuse Strata Pro's market-terminal visual components and Shadcn Fintech's account/portfolio UI selectively; replace all demo prices, seeded balances and simulated trade success with BTCBOX APIs.
- Perpetual contracts remain a separate backend/frontend product gap: require explicit contract specs, isolated/cross margin policy, leverage limits, position accounting, funding, risk checks, liquidation and settlement before implementation. Do not relabel the existing seconds-contract product as perpetual.
- This audit is source-only. It does not prove runtime behavior or any external database deployment.


## Seconds-contract implementation coverage audit — 2026-11-06

### SOURCE OBSERVED

- Existing seconds-contract backend is materially implemented in `backend/api-core.js`: authenticated `POST /api/seconds/order`, `POST /api/seconds/settle`, and `GET /api/seconds/positions`; reference prices are sampled server-side from Coinbase with Bybit fallback. All three routes fail closed when `financialWritesEnabled()` is false.
- SQL migrations `0014_financial_seconds_contracts_v1.sql`, `0015_financial_seconds_one_open_position_v1.sql`, and `0024_seconds_settlement_idempotency_v1.sql` define atomic reserve/settlement ledger movements, one-open-position-per-user enforcement, and settlement idempotency. Migration files in Git do not prove they were applied to any Supabase environment.
- Legacy vanilla-JS UI `backend/assets/js/views-trading.js` includes a Seconds Contracts screen, open/history positions, countdown/settlement actions, durable pending-order intent and reconciliation. The source is not the current React/Vite route implementation.
- Existing tests in `backend/tests/seconds-persistent-order-guard.test.js` and `backend/tests/seconds-one-open-position-migration.test.js` cover durable idempotency intent, unknown outcomes, settlement request replay/conflicts, server-canonical settlement timestamps, and the database one-open-position guard. These are source-level automated tests; no test run was performed in this documentation-only batch.
- Current React/Vite `frontend/src/features/pages/Pages.tsx` still renders trade/seconds as integration-pending placeholders; `frontend/src/lib/api.ts` has no seconds API client methods. Thus existing seconds capability is not yet integrated into the new React UI.
- The inspected backend tree contains no perpetual/futures order, margin, leverage, funding, liquidation, or futures position engine. Seconds contracts are a distinct fixed-duration UP/DOWN product, not perpetual futures.

### NEXT SAFE WORK

- Reuse the existing seconds backend contract; do not create a second seconds ledger or duplicate order/settlement endpoints.
- Before wiring the React UI, add typed client methods matching the exact request/response contracts and tests for API parsing/error handling; keep all write actions disabled while the financial cutover gate is incomplete.
- Perpetual futures remain a separate product requiring approved risk/business rules and a dedicated engine. No leverage, margin, funding, liquidation, or settlement policy is inferred from the seconds product.
- No database migration was applied, no financial write was performed, and no deployment was initiated during this audit.


## Admin configuration UI follow-up — 2026-11-06

### SOURCE OBSERVED
- Re-read this coordination file at commit 430a99fbf29f92c28dc686d0595e10be5bf9fca4 before the batch.
- Corrected branch-specific admin finding: the earlier note that the admin route was only a placeholder describes the inspected main snapshot at 93a236e4a3ed6c9edd2003ac1068a89161015511. On the current development branch `feat/btcbox-web3-auth-20261105`, `backend/assets/js/views-account.js` already implements a partial `VIEWS.admin` console with user, withdrawal, KYC and audit tabs. The feature branch is not equivalent to the main snapshot.
- The feature branch already exposes `apiAdapter.adminConfig()` and the backend `GET/POST /api/admin/config` routes. The POST validates a fixed allowlist of deposit networks and address formats, supports announcement text up to 2,000 characters, and appends an admin audit event.

### IMPLEMENTED
- Feature commit `dbac594be78ecf158d8f3a3c8976e50e92d71a3a` adds a System Configuration tab to the existing admin console. It reads the existing config API, renders escaped deposit-address values and announcement text, and saves through the existing authenticated admin API. Blank address inputs are omitted from updates so they do not erase existing values. Uncertain save outcomes are surfaced as requiring verification rather than encouraging blind retries.
- Feature commit `2e7fd1c16e413be670ed5364a9817f896f4604e4` adds regression assertions for the config UI, API adapter and backend allowlist/validation contract.
- Exact current feature HEAD: `2e7fd1c16e413be670ed5364a9817f896f4604e4`.
- GitHub Actions run `42130071772` was observed as `queued` for this exact HEAD. Do not classify tests as passed until the run completes successfully.

### SAFETY / NOT VERIFIED
- No deposit address or announcement value was changed in a live environment; the code adds only the operator UI.
- No Supabase migration, production database write, financial transaction, merge to `main`, or Vercel deployment was performed.
- Runtime admin authentication, actual browser form behavior, live config persistence, and exact-head CI outcome remain NOT VERIFIED pending CI and staging QA.
- The older main-snapshot admin-placeholder statement remains valid for that snapshot only; do not generalize it to the feature branch.


## Admin read-only tabs — 2026-11-06
- Feature commit `34ba5e5ef159828aa1983beb166970bab49ba55e` adds admin read-only order and customer-support message tabs using existing authenticated API adapters. Order source is displayed; `legacy_state` is explicitly distinguished from PostgreSQL matching-engine data. Support is read-only and shows the API's latest 100 user messages.
- Regression tests are in `f55caad847f912888471dae9f3890f27c1b3dd0f`. Exact-head CI run `42130318767` completed successfully: unified build, backend tests, fail-closed preflight, and output verification passed.
- No merge, deployment, production configuration change, or financial operation was performed.


## React seconds positions read-only integration — 2026-11-06

### SOURCE OBSERVED / IMPLEMENTED
- Re-read this coordination document at current HEAD before this batch; the feature branch baseline was `f55caad847f912888471dae9f3890f27c1b3dd0f`.
- Commit `5703623a3224d66299baaac3f1fb7f88d05d98ec` adds a typed `getSecondsPositions()` client using the existing authenticated, no-store GET helper. It validates position IDs, supported symbols/directions/durations, positive amount/prices, epoch timestamps, and settlement-history fields.
- The React `/seconds` route is now protected by `ProtectedAccountRoute` and renders actual open positions and up to the API-provided history records in read-only cards. The UI does not call the order or settle endpoints.
- `cutover_incomplete: true` is rendered as a dedicated unavailable state and is explicitly not interpreted as an empty account. Network/API failures are shown separately. No countdown-based settlement action is offered.
- Commit `ad63253e9e40529b8f4faca29ddbf4086bda52c6` adds source-level regression tests for response validation, route authentication, read-only boundaries, and backend fail-closed gates, plus Simplified Chinese labels.

### TEST PASSED
- Exact-head frontend CI run `42131019355`: `npm install`, `npm run lint`, and `npm run build` all passed.
- Exact-head backend CI run `42131019361`: unified site build, complete backend test suite, fail-closed deployment preflight, and output/entrypoint verification all passed.
- Exact feature HEAD at time of verification: `ad63253e9e40529b8f4faca29ddbf4086bda52c6`.

### SAFETY / NOT VERIFIED
- This batch is read-only UI integration only. It does not enable or call `POST /api/seconds/order` or `POST /api/seconds/settle`.
- No Supabase migration was applied and no production database, balances, positions, or financial records were changed.
- The financial cutover gate remains closed. The CI pass proves build and source-level tests, not that migrations are applied, RPCs work in staging, reference feeds are operational, or real user positions can be loaded from a deployed environment.
- CSRF/request nonce/idempotency behavior for future React write actions remains to be verified before any trading action is exposed.
- No merge to `main`, Vercel deployment, or production financial operation was performed.


## Seconds backend-authoritative policy audit — 2026-11-06

### SOURCE OBSERVED
- Re-read the coordination entrypoint at `chore/shared-ai-coordination` HEAD `d27a6cade283dcb476ef63bd028a5d3eb2c0ebfa` before this batch. The feature branch baseline was `ad63253e9e40529b8f4faca29ddbf4086bda52c6`.
- `backend/api-core.js` currently owns the seconds order request boundary: symbols BTC/ETH/SOL/BNB, durations 30/60/300/900 seconds, positive amount with a hard-coded upper bound of 1,000,000,000,000, direction up/down, and mandatory request id. The handler does not accept client payout/profit-rate fields and passes only server-validated order fields to `submit_seconds_order_v1`.
- The SQL RPC independently checks symbol, direction, duration, positive amount and server-only execution grants. The order RPC accepts no payout parameter.
- The settlement handler samples the reference price on the server and passes that value to the SQL RPC; it does not use a client-supplied settlement price.
- `0014_financial_seconds_contracts_v1.sql` and `0024_seconds_settlement_idempotency_v1.sql` calculate winning profit as `round(amount * 0.85, 18)`. This is a fixed database rule in the current source, not an admin-editable setting.
- The inspected admin config UI/API is scoped to deposit addresses and announcement text; no seconds policy/config endpoint, configuration table, payout setting, minimum-stake setting, or versioned policy model was found in the inspected source.
- Existing SQL positions persist the order symbol, direction, amount, duration and prices, but do not persist a policy/config version or payout-rate snapshot.

### IMPLEMENTED
- Feature commit `0e18748eba11e6cddf78f0f24431ae1481cd1c51` adds `backend/tests/seconds-server-authoritative-rules.test.js`.
- The regression suite asserts backend-owned symbol/duration/amount limits, no client payout override, database-side rule checks and service-role-only RPC execution, server-sampled settlement price, fixed database payout rule, and the financial cutover gate.
- Exact feature HEAD verified after push: `0e18748eba11e6cddf78f0f24431ae1481cd1c51`; test file blob `169554e97d8449ae1291be6c72159c583a161fad`.

### TEST / STATUS
- SOURCE TEST ADDED: the new regression file is present at the exact feature HEAD.
- NOT VERIFIED: this new commit has no PR-triggered GitHub Actions workflow run in the workflow lookup. The combined status currently reports only `Vercel – btcboxcdt` failure with target `upgradeToPro=build-rate-limit`; this is a Vercel build-rate-limit status, not a reported Node test result. Do not claim the new test suite passed.
- Existing previously recorded CI passes apply to the earlier exact feature HEAD `ad63253e9e40529b8f4faca29ddbf4086bda52c6`, not this new commit.

### NEXT SAFE DESIGN
- Keep the policy authoritative on the server/database; never trust frontend-calculated limits, payout, open price, settlement price, or outcome.
- Before exposing admin-editable seconds policy, design a versioned policy record with active/effective windows, explicit symbol/duration allowlists, min/max stake, payout basis points, per-user exposure limits, admin authorization, append-only audit history, optimistic version checks and effective-time rules.
- Snapshot the policy version and payout terms onto each newly opened position so later policy edits cannot rewrite an existing position's settlement terms or history.
- Do not invent or silently change commercial values. Current 85% payout and amount ceiling remain source constants until separately approved business policy and isolated staging verification exist.
- No policy table, migration, admin write endpoint/UI, production database change, financial write, merge, or deployment was made in this batch.


## Seconds policy versioning design — 2026-11-06

### IMPLEMENTED (documentation only)
- Re-read the coordination entrypoint at branch HEAD `242795398059f2c6bed42da6d9a76dbcb92080e0`.
- Re-read the feature branch baseline `bb08e2b6c70ab2794fb02fba91e34f71ebf2c1b6`, including the current server-authoritative policy regression test and SQL migrations `0014` / `0024`.
- Feature commit `e87a77871c221d4ea67c6457e7c64a831147c9f5` adds `docs/SECONDS_POLICY_VERSIONING.md`, a non-executable design specification for immutable policy versions, effective windows, per-user exposure, admin audit, optimistic concurrency, and per-position payout snapshots.
- The design preserves the source-observed baseline (BTC/ETH/SOL/BNB; 30/60/300/900 seconds; current API ceiling; 85% winning profit) without changing runtime behavior.
- It specifies legacy NULL-snapshot settlement compatibility and requires order RPC policy resolution/snapshotting to be atomic before any admin editor is exposed.

### NOT IMPLEMENTED / NOT VERIFIED
- No migration, policy table, policy RPC, admin API, or policy UI was created in this batch.
- No migration was applied; no production/staging database, financial record, balance, position, or order was modified.
- No financial write gate was opened; no merge or deployment was performed.
- CI/runtime verification for the documentation-only commit is not yet recorded. This batch is not a runtime feature acceptance.

### NEXT
- Convert the approved specification into an additive migration and RPC changes on the feature branch, retaining legacy position behavior and current policy values.
- Before adding administrator write routes, verify the existing admin identity/role contract and implement append-only audit, nonce/idempotency, optimistic concurrency, and isolated staging tests.


## Seconds policy schema and RPC implementation — 2026-11-06

### IMPLEMENTED (source only; staging not applied)
- Re-read coordination branch HEAD `a1ea5cc3351d00c0f11d952ada05f3799e638b6b` and feature branch HEAD `e87a77871c221d4ea67c6457e7c64a831147c9f5`.
- Feature commit `c9393e4a35be714a838e9785a184f2648b9a7ab8` adds:
  - `backend/supabase/sql/0025_seconds_policy_versioning_v1.sql`
  - `backend/tests/seconds-policy-versioning.test.js`
- Migration is additive: immutable versioned policy table, separate active-policy pointer, append-only audit table, nullable per-position policy/version/payout/snapshot fields, immutable policy and position snapshot triggers.
- Version 1 seed records only source-observed baseline: BTC/ETH/SOL/BNB; 30/60/300/900 sec; positive minimum at numeric(38,18) precision; API-observed maximum 1e12; 8500 payout basis points. Exposure cap remains NULL (not invented).
- Replaced order RPC resolves and locks active policy, validates product/stake/exposure inside the same transaction as reserve, and stores immutable policy snapshot. It keeps idempotent replay before policy lookup and preserves the one-open-position DB guard.
- Replaced settlement RPC uses position payout snapshot; legacy NULL-snapshot positions retain 8500 bps fallback. Existing settlement maturity, ownership, idempotency, source and ledger logic retained.
- No client policy/payout parameters or admin mutation endpoint/UI added. Tables remain inaccessible to anon/authenticated; service_role receives read-only policy table access, and no policy writes are granted to service_role in this migration.

### VALIDATION / NOT VERIFIED
- Re-fetched exact feature HEAD `c9393e4a35be714a838e9785a184f2648b9a7ab8`; both files and blob SHAs verified.
- PR-triggered workflow lookup returned no runs for this commit. Node tests, SQL parsing, live RPC behavior, concurrency, and financial ledger invariants are NOT verified in this environment. Do not mark accepted.
- Migration has NOT been applied to staging or production. No balances, positions, orders, financial records or cutover flags were changed. No merge or deployment.

### REVIEW FLAGS BEFORE STAGING
- Independently review PostgreSQL trigger/locking behavior and the SQL function replacement against the deployed migration history.
- Add isolated staging tests for migration application, active-policy resolution, policy boundary rejects, concurrent same-user reserve, historical NULL-snapshot settlement, payout snapshot immutability, and ledger invariants.
- Admin policy authoring/activation remains intentionally unavailable until admin identity/permission contract, nonce/idempotency, optimistic concurrency and audit transaction are implemented.


## Seconds policy privilege and audit hardening — 2026-11-06

### IMPLEMENTED (source only)
- Re-read coordination HEAD `34d1e7b743f2b22d9b8eea319add73f3011f2a48` and feature baseline `c9393e4a35be714a838e9785a184f2648b9a7ab8`.
- Review found the policy resolver used `SELECT ... FOR SHARE` while `service_role` had only SELECT on policy tables. PostgreSQL row-locking SELECT can require UPDATE privilege, so the order RPC could fail despite the intended read-only grants.
- Feature commits `1fab9a3d5bab544e5cfbea618fd39704e3308e2f` and `a7871a870f2f4837322c5a86885f4906464da066` remove that row-lock privilege dependency; immutable policy rows and non-writable active pointer are read through MVCC.
- Added a database trigger that rejects UPDATE/DELETE on the policy audit table.
- Updated source-level regression assertions to require no row-lock clause and require append-only audit protection.
- Latest feature head after these changes: `fde1e6f7e9d272b41bacfd69b6e9e0cfbe77274f`.

### ADMIN AUTHORITY FINDING
- Current `api-core.js` admin authorization is a single shared `ADMIN_USER` / `ADMIN_PASS` Basic Auth credential, not an identified multi-admin subject with granular roles or policy-specific approval permission.
- Therefore no seconds policy draft/approve/activate API or UI is added in this batch. A shared Basic Auth identity is insufficient to produce trustworthy actor-level approval/audit records.
- Before policy writes, introduce an attributable admin identity/role contract and separate draft vs approval permission; preserve the existing admin auth path until a reviewed migration and compatibility plan exists.

### VALIDATION / NOT VERIFIED
- Re-fetched feature branch and changed files. Source checks are present; workflow lookup for the latest feature commit returned no runs. Node test execution and PostgreSQL parsing/application are not verified.
- No database migration was applied to staging or production. No balances, positions, orders or ledger rows changed; financial cutover remains closed. No merge or deployment.
- Next: obtain an actual PostgreSQL staging validation path; review admin identity/RBAC design; only then add read/write policy management endpoints.


## Seconds policy and settlement regression coverage — 2026-11-06

### IMPLEMENTED (source only)
- Re-read coordination HEAD `edd309b06dd946bc7a05a9aca1b196fe39e7c8a3` and feature HEAD `fde1e6f7e9d272b41bacfd69b6e9e0cfbe77274f`.
- Compared `0025_seconds_policy_versioning_v1.sql` settlement RPC against the historical `0024_seconds_settlement_idempotency_v1.sql` implementation and confirmed the revised function retains owner-scoped position locking, maturity checks, settlement-price timestamp checks, request-hash idempotency, frozen-balance invariant, financial operation, account update, ledger append, and final position update. The new function additionally calculates payout from the position snapshot and retains 8500 bps fallback for legacy NULL snapshots.
- Confirmed the order RPC resolves idempotent replay before active-policy lookup, preserving replay semantics if the active policy later changes.
- Added source-level assertions for replay ordering, settlement/ledger invariants, service-role-only RPC execution, and non-client-writable policy tables.
- Feature commit: `048d3c224baf089751cecc9d7a98d39c5d329c1c`; changed test blob: `51f5f922050531233ff6e66341ea71cb9f813d24`.

### DATABASE / VALIDATION OBSERVATIONS
- Supabase project inventory identifies project ref `zlozsutefnmgwwzrlipt`; read-only migration history returned only versions `20261102133555` and `20261103062716`. This list does not establish that the application SQL files `0014` through `0025` have been applied; their status remains unverified.
- No production SQL query or DDL was executed. No staging branch was created. No migration applied.
- Workflow lookup for feature commit `048d3c224baf089751cecc9d7a98d39c5d329c1c` returned no runs. Tests are source assertions only; Node execution and PostgreSQL runtime verification remain NOT VERIFIED.

### NEXT
- Secure a separately identified staging database or approved Supabase development branch before attempting SQL execution.
- Verify migration prerequisites `financial_ledger_v1`, `0014`, `0015`, and `0024` in that isolated environment; the repository file list and current migration registry are not sufficient proof of schema state.
- Resolve the actual business minimum stake from the approved product configuration before treating the numeric precision floor as the commercial minimum.
- Continue admin actor/RBAC design before any policy draft/activation write route or editor is added.
- Keep financial cutover closed; no merge/deploy until the exact migration chain, RPC invariants, and CI evidence are independently verified.


## Seconds stake-boundary source verification — 2026-11-06

### IMPLEMENTED (source only)
- Re-read coordination HEAD `d8e42b4f112a83f6277f4a788a48ad13283edfc3` and feature HEAD `048d3c224baf089751cecc9d7a98d39c5d329c1c`.
- Inspected the live source order handler, decimal parser, authoritative-rules test and historical `0014` / `0015` migrations.
- Confirmed the existing API has no separate commercial minimum stake: it rejects null/non-positive amounts, caps at 1,000,000,000,000, accepts up to 18 fractional decimal places, and keeps money as decimal strings / BigInt comparisons rather than IEEE-754.
- Therefore the seeded policy minimum `0.000000000000000001` represents the smallest positive amount representable by the current `numeric(38,18)` schema and API parser; it is not evidence of a commercial minimum chosen by product management.
- Added source-level regression coverage for this boundary and the seeded max/payout baseline.
- Feature commit: `5594e7450977a76423bc4cd7398c0f2beaed10b4`; test blob: `dcda51dea6833c6bebc8435242a0710460df7176`.

### NOT VERIFIED / NEXT
- No Node test run or CI workflow result is available for the new commit; source assertions remain unexecuted.
- Supabase currently reports no database branches for project `zlozsutefnmgwwzrlipt`; no isolated staging branch was available in the read-only branch inventory. Do not run migrations against the production project as a substitute.
- Next batch: obtain a separately provisioned staging database or approved development branch; validate the complete prerequisite chain and execute SQL tests there. Continue admin identity/RBAC design separately; do not create write endpoints using the shared Basic Auth actor.
- No production schema/data changed, no financial cutover, merge or deployment.


## Seconds payout floor and configurability — 2026-11-06

### IMPLEMENTED (source only)
- Re-read coordination HEAD `a2f28764f593c0f4c4fa003409b2d02dcedd1745` and feature HEAD `5594e7450977a76423bc4cd7398c0f2beaed10b4`.
- Clarified the user's product requirement: 85% is a minimum, not the only payout value; backend policy versions must be able to configure a higher winning-profit rate.
- Tightened the new policy schema payout constraint from 0–10000 bps to 8500–10000 bps, and the per-position snapshot constraint to the same range. This prevents any future policy writer from setting a rate below 85%, while allowing values through 100%.
- Updated the policy design specification to reflect 85%–100% configurable payout, per-version authority, and immutable per-position snapshots.
- Added source-level regression assertions for the minimum/maximum bounds, policy-sourced order snapshot, and settlement consumption of the snapshot.

### NOT IMPLEMENTED / NOT VERIFIED
- No administrator policy editor or write endpoint is exposed. The current shared `ADMIN_USER` / `ADMIN_PASS` Basic Auth does not identify individual actors or support safe role separation; actor-specific RBAC and draft/approve/activate audit flow remain prerequisites.
- The 85% floor is enforced in the new migration source only; migration `0025` has not been applied to any database.
- No Node test execution, CI run, PostgreSQL staging execution, or runtime verification is recorded.
- No production database changes, financial writes, cutover enablement, merge, or deployment.

### NEXT
- Design attributable administrator identity and explicit seconds-policy permissions, with separate author/reviewer/activator roles and atomic audit/idempotency/revision checks.
- Then add authenticated read/preview and draft/approve/activate endpoints and admin UI against the versioned policy model; validate only in isolated staging before any release.


## Seconds policy administrator identity and RBAC contract — 2026-11-06

### IMPLEMENTED (design and source guard only)
- Re-read coordination HEAD `bc63a59e4bee8bbb7969685f0fb8f0d6017e0adb` and feature HEAD `c1a65c40683c7305d55d972407580aeab9a27bc3`.
- Added `docs/SECONDS_POLICY_ADMIN_RBAC.md`: proposed dedicated Supabase Auth subject validation, private server-side permission lookup, explicit policy permissions, three-distinct-actor author/reviewer/activator separation, immutable draft/review/activate lifecycle, idempotency/revision/atomic audit contract, and UI/API rollout gates.
- Updated `docs/SECONDS_POLICY_VERSIONING.md` to point to the administrator identity and separation-of-duties contract.
- Added `backend/tests/seconds-policy-admin-rbac-design.test.js` source guard tests. They assert the current shared Basic Auth gate remains the only admin identity path and no seconds-policy write route is exposed before the RBAC implementation is ready.

### NOT IMPLEMENTED / NOT VERIFIED
- This batch is a proposed security contract, not runtime RBAC. No Supabase Auth admin enrollment, role table, policy endpoint, or admin UI was created.
- No Node tests or CI were run; no PostgreSQL staging environment was available/used.
- No SQL migration, database mutation, financial write, cutover change, merge, or deployment was performed.

### NEXT
- Review/approve administrator enrollment and the three-distinct-actor separation model.
- After approval, implement the identity/permission data model and private transition RPCs additively, then validate in isolated staging before exposing API/UI.


## Seconds policy source-contract reconciliation — 2026-11-06 (UTC+8)

- SOURCE OBSERVED: re-read feature branch `feat/btcbox-web3-auth-20261105` at `23ddb41c2866a6ae8c0ec557eb427b94b77ca30b`, coordination branch at `19719fe0ffdd9fc39cc162bb7962970fa46403b4`, migration `0025_seconds_policy_versioning_v1.sql`, and the policy/RBAC specifications.
- FINDING: `docs/SECONDS_POLICY_VERSIONING.md` still claimed current SQL positions did not carry policy version/payout snapshots, although migration 0025 source adds those nullable columns and the order/settlement RPCs write/read the snapshot. The document also blurred target governance design with the narrower migration 0025 implementation.
- PATCHED: corrected the versioning specification to distinguish source-only migration behavior from live database state, list the actual policy/active-pointer/audit tables and grants, describe order/settlement snapshot behavior, and explicitly enumerate the missing administrator membership, review/activation, write-RPC, idempotency, and UI layers.
- ADDED: `backend/tests/seconds-policy-versioning-doc-consistency.test.js` guards the documentation against contradicting migration 0025 and asserts the current service-role read-only/browser-role-denied privilege contract.
- TEST STATUS: regression tests are committed as source but have not been executed locally in this tool session. Exact-head GitHub Actions evidence must be checked before calling the batch CI-verified.
- SAFETY: no Supabase SQL was executed, no migration was applied, no admin roles/users were provisioned, no financial writes, merge, or Vercel deployment occurred. Deployment pause and financial fail-closed state remain unchanged.

## Seconds policy administrator provisioning and recovery contract — 2026-11-06 (UTC+8)

### IMPLEMENTED (design and source guard only)
- Feature commit: `904547a8dfbbb842a58be71ae3d7910f10f23c90`; changed blobs: RBAC `9503fcadb210ee5ae9f9e60a0f0b5228e44bb145`, versioning `38cc5487e5261401e437101d5bdb0a437b65cd01`, tests `5a261788da845e08c3e88b552ab3830480d17d95`. Coordination entry records source HEADs `5fd90c1646d9b7cdcf0b46e58c6cbaec86a590bd` / `98c06349596812306b0374de1c664a63554a3ff5`; the feature branch had advanced beyond the previously recorded RBAC batch, so this change is based on the current branch tip.
- Extended `docs/SECONDS_POLICY_ADMIN_RBAC.md` §11 with explicit enrollment/bootstrap, least-privilege grant and immediate revocation, suspension, emergency recovery, and private-schema/Data API requirements.
- Updated `docs/SECONDS_POLICY_VERSIONING.md` to point to the provisioning and recovery contract.
- Added four source-guard tests for non-self-service enrollment, two-person bootstrap, immediate revocation, break-glass limits, and browser/Data API isolation.
- Reviewed the current Supabase breaking-change index: as of 2026-10-30, new public tables are no longer automatically exposed to the Data API by default. This does not replace explicit verification that the proposed private schema is not in the project's exposed schemas and that grants/RLS are restrictive.

### NOT IMPLEMENTED / NOT VERIFIED
- This is still a design/specification and source-test change. No administrator identities, permission tables, bootstrap function, recovery credential, API route, UI, or runtime RBAC were created.
- The new Node source tests were not executed in this tool session; no PostgreSQL staging validation or CI run is claimed.
- No Supabase SQL was executed, no migration applied, no project settings/secrets changed, and no financial write/cutover, merge, or deployment occurred.

### NEXT
- Before runtime implementation, obtain an isolated staging database and approve the initial administrator enrollment procedure, exact permission grantors, and recovery operators.
- Inspect existing schema privileges/exposed schemas and the complete prerequisite migration chain in that isolated environment; then create the governance migration through the supported Supabase CLI workflow.
- Keep shared Basic Auth admin behavior unchanged and do not expose seconds-policy writes until verified identity, permission lookup, transition RPCs, and audit atomicity pass isolated tests.

## Seconds policy migration SQL syntax correction — 2026-11-06 (UTC+8)

### IMPLEMENTED (source only)
- Re-read feature HEAD `904547a8dfbbb842a58be71ae3d7910f10f23c90` and coordination HEAD `1966033fc61a211f86c2645aeb860a6f6fe8070f`; inspected migration `0025_seconds_policy_versioning_v1.sql` and its existing Node source tests.
- Found a missing statement terminator after the active-policy SELECT in `submit_seconds_order_v1`. The PL/pgSQL `IF NOT FOUND` branch followed the SELECT without a semicolon, making the migration source syntactically invalid.
- Added the missing semicolon without changing policy lookup semantics, transaction ordering, financial ledger behavior, or policy snapshot logic.
- Added a regression source assertion that the active-policy SELECT terminates before the `IF NOT FOUND` branch.

### NOT VERIFIED
- This is a static source correction. No PostgreSQL parser, isolated staging database, Node test run, or CI workflow result is available in this turn; therefore SQL runtime validity is NOT VERIFIED.
- No migration was applied, no production or staging database was modified, no financial write/cutover, merge, or deployment occurred.

### NEXT
- Obtain an isolated Supabase development branch or separately provisioned staging project before executing any migration.
- Inspect the exact prerequisite migration chain and validate migration 0025 with PostgreSQL, then test order/settlement and ledger invariants. Do not use production as a substitute for staging.

## Supabase live database and migration-order audit — 2026-11-06 (UTC+8)

### READ-ONLY LIVE OBSERVATIONS
- Queried Supabase project `zlozsutefnmgwwzrlipt` through read-only project inventory tools. Migration registry currently returns only timestamp versions `20261102133555` and `20261103062716`; development branch inventory is empty.
- Live `public.seconds_contract_positions` does not contain the migration-0025 policy snapshot columns (`policy_id`, `policy_version`, `payout_bps_snapshot`, `policy_snapshot`). The versioned policy tables are not present in the table inventory. Therefore migration 0025 is NOT installed in the observed live schema.
- This project records timestamp migration versions, while repository SQL uses four-digit filenames. Existing `backend/tests/migration-status-script.test.js` explicitly rejects direct timestamp-to-four-digit comparisons. Do not map these registries by string ordering or claim that source files 0001–0025 are installed.
- The live Seconds schema includes the base position table and current legacy columns. Repository source dependencies are: 0014 creates Seconds lifecycle; 0015 adds the one-open-position guard; 0024 replaces settlement with request-hash idempotency; 0025 adds policy versioning/snapshots. These prepared source migrations require isolated validation before application.
- Supabase table inventory reports RLS enabled on 14 public tables but no policies for those tables in Security Advisor. A read-only privilege query showed `anon` and `authenticated` have no SELECT/INSERT privileges on those public tables; `service_role` has the expected server-side table privileges (mostly DML, catalog read-only). This is not evidence of browser access, but RLS-without-policies remains an incomplete access-policy posture that must be reviewed before any direct client grants.
- Security Advisor reports RLS disabled on `private.btcbox_state_pre_test_cleanup_backup` and `private.btcbox_auth_test_users_backup`. A read-only privilege check found `private` schema USAGE and table privileges are false for `anon`, `authenticated`, and `service_role`; current API-role access was not observed. Keep these backups inaccessible; decide with the owner whether to enable RLS with no client policies or retain them under an explicitly verified owner-only access model. Do not auto-apply the advisor's suggested RLS-only SQL because it may change intended owner workflows.
- Security Advisor also reports Supabase Auth leaked-password protection disabled. This is a project setting requiring owner review, not changed in this batch.

### SOURCE DOCUMENTATION UPDATED
- Updated `backend/supabase/sql/MIGRATION-ORDER-AND-CUTOVER.md` to include prepared migrations 0023 (shared rate limiter), 0024 (Seconds settlement idempotency), and 0025 (Seconds policy versioning), their dependencies, and the timestamp-registry mapping warning.
- Added a source test guarding the documented ordering and dependency notes.
- No SQL was executed except read-only catalog SELECTs. No database DDL/DML, migration application, settings changes, secret reads, financial writes, cutover, merge, or deployment occurred.

### VALIDATION STATUS
- Live database observations are read-only evidence from 2026-11-06; they are not proof of every migration's historical application path.
- New Node test source was added but not executed. No CI run or PostgreSQL staging validation is claimed.
- The two private backup tables' RLS finding remains open; the 14 public no-policy findings remain a review item, with anon/authenticated table privileges confirmed absent in the observed query.

### NEXT
- Do not apply migration 0025 to production. Obtain an isolated staging project, map timestamp migration history to actual schema, apply the reviewed ordered chain there, and validate SQL/RPC/ledger invariants.
- Review the two private backup tables' retention and owner-only access model; separately review the 14 public RLS tables before granting any browser-role access.
- Review and enable leaked-password protection through the owner-approved Auth settings workflow.

## Supabase least-privilege follow-up — 2026-11-06 (UTC+8)

### Additional READ-ONLY privilege evidence
- Expanded catalog checks across all 14 observed `public` tables and both `private` backup tables. For every returned table, effective `PUBLIC`, `anon`, and `authenticated` privileges were false for SELECT, INSERT, UPDATE, and DELETE.
- Both private backup tables are owned by `postgres`, have RLS disabled and FORCE RLS disabled, but `private` schema USAGE and all four table privileges remain false for `PUBLIC`/API roles. This establishes current API-role inaccessibility, not an absence of defense-in-depth risk.
- Enumerated `SECURITY DEFINER` functions in `public`: only `rls_auto_enable()` was returned. It has fixed `search_path=pg_catalog`, owner `postgres`, and effective EXECUTE is false for `PUBLIC`, `anon`, and `authenticated`.
- These are point-in-time catalog observations; they do not prove all future default privileges or external connection roles. No SQL writes were made.

### Source guard added
- Added `backend/tests/supabase-privilege-contract.test.js` to assert the intended server-only privilege model in prepared migrations 0023 and 0025: RLS enabled, browser-role revokes, service-role-only RPC execution, and no direct policy-table DML grants to service_role.
- The source test is a static contract guard only; it does not execute SQL or prove live database state.

### Supabase CLI v3 compatibility note
- Supabase changelog announced CLI v3 as a breaking change on 2026-11-04: database commands default to local; hosted operations require explicit `--remote`, and unattended hosted changes require `--yes`. Current repository CI workflows do not invoke Supabase CLI, so no current workflow change was made. Any future staging scripts must pin the intended CLI major and explicitly select the staging target; never target production by default.


## Vercel build and CI trigger investigation — 2026-11-06 (UTC+8)

### READ-ONLY VERCEL EVIDENCE
- Queried the linked BOX team using its current team ID `team_tnwJkMYPnWK2BjBGf3Q2n3FB`. The team plan returned by Vercel is `hobby`; the linked project is `btcboxcdt` (`prj_rmwOE9q0XyZ3BikpxX2FzDt2VjKK`).
- The latest 30 deployment records include repeated builds across several branches, with READY, ERROR, CANCELED, and BLOCKED states. This confirms substantial deployment churn in the inspected window, but does not establish the exact quota accounting or prove that concurrency alone caused the build-rate-limit status.
- The latest READY deployment in the returned page was commit `d44d8d693ed026a4479b6fdc3d05bcbef2827a58` on `feat/btcbox-web3-auth-20261105`.
- The current feature source commit `80dde835ec58b8f0ca62fab51c4d4f545de73376` has no matching Vercel deployment record in the exact-SHA query. Its GitHub combined status still reports Vercel context `Vercel – btcboxcdt` as failure with target `https://vercel.com/fuyao999?upgradeToPro=build-rate-limit`.
- A previous deployment for commit `8182397a4066d0ac8811e5e992eae175c64c8f4e` failed during TypeScript compilation in `frontend/src/features/auth/AuthPages.tsx` because imports/identifiers such as `useAuth`, React hooks, router components, UI components and icons were unresolved in that historical source snapshot.
- The current feature branch version of `AuthPages.tsx` (blob `75d899646079bce4f857afec644739effa67588d`) contains explicit imports for those identifiers. Therefore the observed TypeScript failure is historical and is not evidence that the current branch file still has that exact defect. The subsequent READY deployment is consistent with a later build succeeding, but does not prove the exact current commit was built.

### CI WORKFLOW SCOPE
- The current feature branch's `.github/workflows/frontend-ci.yml` includes `feat/btcbox-web3-auth-20261105` in its push branch filter and runs frontend lint/build.
- The current feature branch's `.github/workflows/backend-ci.yml` also includes this branch in push and pull_request filters and covers `backend/**`, including the new source-contract test.
- The available commit-workflow lookup returns only pull-request-triggered runs. Its empty result is therefore not evidence that push-triggered runs did not execute. No successful CI run is claimed from this lookup.
- No workflow file change was necessary based on the inspected current feature branch contents.

### NEXT / SAFETY
- Keep the Hobby plan and Vercel project/team settings unchanged; do not upgrade, transfer projects, cancel deployments, or create another deployment without the user's explicit approval.
- Avoid unnecessary pushes that trigger repeated Vercel builds. First obtain the exact current GitHub Actions push-run result through a workflow-runs listing capability, then reconcile the Vercel build-rate-limit status with the plan's actual usage/limit information.
- Do not merge, deploy, modify production settings, or change financial cutover flags. The TypeScript failure above is historical evidence; the exact current commit remains without a matching Vercel deployment in the inspected history.


## CI recovery and exact-commit verification — 2026-11-06 (UTC+8)

### Failure evidence from prior feature commit
- Retrieved GitHub Actions push run `42137012101` for feature commit `80dde835ec58b8f0ca62fab51c4d4f545de73376`. The unified build succeeded; backend tests failed (238 total, 233 passed, 5 failed), causing later fail-closed checks to be skipped.
- The five failures were test-contract defects, not a demonstrated runtime regression:
  1. RBAC design test resolved `../../docs` outside the repository checkout; corrected to `../docs`.
  2. Policy doc-consistency test had the same incorrect docs path for both specifications.
  3. Policy versioning test prohibited every `FOR UPDATE` in the order RPC, including the intentional idempotent replay lock. Narrowed the assertion to the active-policy lookup only; replay locking remains separately asserted.
  4. Minimum-stake test's broad negative regex also matched the valid maximum-stake check. Narrowed it to reject only a hard-coded numeric-floor comparison in the API handler.
  5. Server-authoritative settlement test used a market-route delimiter that appears before the settlement handler. Corrected the section boundary to the next seconds-positions route.
- No financial SQL, API business logic, payout rules, cutover flags, or production database objects were changed in this repair.

### Repair and successful verification
- Feature commit: `c351c9de1671a93004d7ddda0021df5441672bee`, parent `80dde835ec58b8f0ca62fab51c4d4f545de73376`.
- Changed only four backend test files: `seconds-policy-admin-rbac-design.test.js`, `seconds-policy-versioning-doc-consistency.test.js`, `seconds-policy-versioning.test.js`, and `seconds-server-authoritative-rules.test.js`.
- Exact GitHub Actions push run `42138365542` for that SHA completed with conclusion `success` at `2026-11-06T00:39:34Z`. All steps succeeded: dependency install, unified site build, backend tests, fail-closed deployment configuration validation, unified output verification, and preserved entrypoint verification.
- Exact commit's GitHub combined status reports `Vercel – btcboxcdt` = `success`, target `https://vercel.com/fuyao999/btcboxcdt/5cXWxiFrTSTiehvjZ3NdhK6QEUhq`. This supersedes the earlier build-rate-limit failure status on commit `80dde...`; no plan upgrade or project transfer was made.
- This is source/CI verification only. No Supabase migration was applied, no staging database was created, and no merge or production cutover/deployment was performed.

### Next
- Continue from feature SHA `c351c9de1671a93004d7ddda0021df5441672bee`.
- With build and test gates green, proceed to the next backend integration review and identify any remaining source-only vs live-staging gaps. Keep financial writes and policy activation disabled until isolated staging and explicit approval.

## Seconds order idempotent response consistency — 2026-11-06 (UTC+8)

### SOURCE REVIEW / PATCH
- Re-read coordination HEAD `bbd15940d1bfdd64c0db37ab198ea67249f15100` and feature HEAD `c351c9de1671a93004d7ddda0021df5441672bee`.
- Found that `submit_seconds_order_v1` returned only the position ID/status/settlement time for an idempotent replay, while `/api/seconds/order` returned the newly fetched market sample as `open_price`. A replay could therefore display a price different from the persisted opening price.
- Updated migration 0025 source so both new-order and duplicate RPC responses include the authoritative persisted/opening price. Updated the API to require and display that database-confirmed value; duplicate responses label the source as `stored_reference`.
- Added `backend/tests/seconds-order-idempotency-response.test.js` to guard both RPC response paths and API response selection.
- Feature commits: `879e4c799ac00a0cb170d4c735cdcc6489d57db8` (implementation) and `a72330711f632830d2756f0fdfce5b343010774d` (test regex correction). Current feature HEAD is `a72330711f632830d2756f0fdfce5b343010774d`.

### VALIDATION / RELEASE BOUNDARY
- SOURCE OBSERVED: exact feature branch head points to `a72330711f632830d2756f0fdfce5b343010774d`; commit diff contains only `backend/api-core.js`, `backend/supabase/sql/0025_seconds_policy_versioning_v1.sql`, and the new source test.
- NOT VERIFIED: Node test execution, PostgreSQL parsing, migration execution, and staging behavior. GitHub Actions workflow-runs lookup for the exact SHA returned zero runs; no passing CI is claimed.
- Vercel combined status for the exact SHA reports `Vercel – btcboxcdt` failure with the build-rate-limit upgrade target. No plan upgrade or project-setting change was made.
- No migration was applied, no database or financial writes, no policy activation, no merge to main, and no production deployment.

### REMAINING FOLLOW-UP
- Idempotent replay still fetches a live reference price before calling the RPC. If all reference feeds are unavailable, the API can fail before the database gets a chance to replay an already-created order. A follow-up should allow a replay lookup without accepting a missing price for a genuinely new order, with a regression test.
- Continue to keep seconds policy write APIs/UI disabled until attributable administrator identity, permissions, approval transitions, and isolated staging validation exist.


## Seconds order replay during market-feed outage — 2026-11-06 (UTC+8)

### IMPLEMENTED (feature source)
- Re-read coordination entry point on chore/shared-ai-coordination and feature branch head a72330711f632830d2756f0fdfce5b343010774d before editing.
- Fixed the retry path for an already-created Seconds order when both market reference feeds are unavailable: the API now attempts the idempotent database RPC even when it cannot fetch a fresh reference price.
- Reordered the SQL RPC checks so it first locks and checks the existing open_request_id; a matching request returns the persisted position/open price/settlement time without needing a new feed sample.
- For a genuinely new request, the RPC now rejects NULL/non-positive opening prices with REFERENCE_PRICE_REQUIRED. The API maps that response to REFERENCE_PRICE_UNAVAILABLE; no new order is created without a valid server reference.
- Preserved the existing request-hash/user ownership conflict check, active policy lookup, balance row lock, atomic ledger writes, and immutable policy snapshot behavior.
- Added source-contract assertions covering replay-before-price-validation and the API's nullable feed-price replay attempt.
- Feature commit: 6ef4a5344fedfea667fec4226093bb0a247c02ed (parent a72330711f632830d2756f0fdfce5b343010774d); changed only backend/api-core.js, backend/supabase/sql/0025_seconds_policy_versioning_v1.sql, and backend/tests/seconds-order-idempotency-response.test.js.

### VALIDATION / RELEASE BOUNDARY
- SOURCE OBSERVED: exact feature branch ref advanced to 6ef4a5344fedfea667fec4226093bb0a247c02ed; commit diff reviewed and limited to the three files above.
- CI: GitHub Actions backend workflow run 42139779249 was observed in progress at 2026-11-06T00:51:03Z; no passing result is claimed until the run completes.
- Vercel combined status for the exact SHA reports Vercel – btcboxcdt failure with the Hobby build-rate-limit upgrade target. No plan upgrade or project setting change was made.
- NOT VERIFIED: Node test execution result until CI completion, PostgreSQL parsing/runtime behavior, live feed-outage replay, migration application, and isolated staging behavior.
- No database writes, migration application, financial test transaction, policy activation, merge to main, or production deployment occurred.

### NEXT
- Retrieve the final status and job logs for backend workflow run 42139779249; repair any failing source guard before moving on.
- Obtain isolated Supabase staging before applying migration 0025 or testing the financial RPC. Keep policy write APIs/UI and all financial cutover flags disabled.


## Seconds policy RBAC implementation-readiness review — 2026-11-06 (UTC+8)

### REVIEWED SOURCE / EXISTING SECURITY PERIMETER
- Re-read shared coordination branch and current feature head 6ef4a5344fedfea667fec4226093bb0a247c02ed.
- Reviewed docs/SECONDS_POLICY_ADMIN_RBAC.md, backend/tests/seconds-policy-admin-rbac-design.test.js, backend/tests/supabase-privilege-contract.test.js, backend/tests/seconds-policy-versioning.test.js, backend/api-core.js, and migration 0025.
- Current adminAuth() accepts one shared ADMIN_USER / ADMIN_PASS Basic Auth identity. It is not attributable to separate human administrators. Existing admin audit records using the configured username or generic admin cannot satisfy three-person policy approval.
- Existing 0025 policy tables are in public but RLS-enabled and revoked from PUBLIC/anon/authenticated; service_role has SELECT on policy and active-pointer tables but no direct INSERT/UPDATE/DELETE. Order/settlement RPCs are service-role-only. This is the current source contract, not proof of the live database catalog.
- Existing policy audit action enum covers seed/draft_created/activated/retired only. It is not a complete administrator membership, permission grant/revocation, review/rejection, idempotency, or security-event ledger.
- The active pointer has no approved administrator transition API/RPC. Do not use service_role direct table writes as a substitute for reviewed policy transitions.
- The current source test explicitly prevents seconds-policy routes from being added under the shared Basic Auth perimeter. Keep that guard.

### REQUIRED ADDITIVE DATA MODEL BEFORE RUNTIME POLICY ADMIN
- Dedicated private, non-Data-API schema objects are required for administrator membership, permission grants, policy review decisions, transition idempotency, and administrator security audit. Keep existing public policy rows inaccessible to browser roles.
- Membership must key to validated Supabase Auth UUID, have an explicit lifecycle state and monotonically increasing revision. Permission grants must use a strict allowlist and retain grantor UUID, reason, ticket/change reference, timestamps, and optional expiry. No email, metadata, caller-supplied role, or shared Basic Auth username may be the authority key.
- Policy review must bind the reviewer to the exact immutable policy ID/version and canonical content hash. Any edit creates a new immutable version and invalidates earlier review.
- Transition requests must bind actor UUID, action, target policy/version, expected membership/policy revision, request ID, and canonical request hash. Identical retries replay the original result; mismatched retries conflict.
- A private transition function must revalidate live membership and the exact permission inside the same transaction as state transition and append-only audit. It must enforce distinct author/reviewer/activator UUIDs, revision checks, effective-window conflict checks, and atomic rollback on audit failure.
- Do not create a public SECURITY DEFINER endpoint. If SECURITY DEFINER is genuinely required for a private transition, pin search_path, qualify every object, revoke PUBLIC/anon/authenticated execution, grant only to the trusted server role, and independently review owner/bypass-RLS behavior.
- Administrator enrollment/bootstrap is separate from policy lifecycle. No public bootstrap route; first provisioning is owner-controlled and two-person approved, then bootstrap is disabled. Recovery grants are temporary, audited, and cannot activate policies or open financial cutover.
- The frontend remains read-only until the complete authenticated API exists; it must not write policy tables or receive service credentials.

### IMPLEMENTATION GATE / NEXT WORK
- This pass is a source review and implementation-readiness contract only. No SQL migration, API route, admin UI, administrator membership, permission grant, or production setting was created or changed.
- The repo's only connected Supabase project has no isolated staging branch/environment available in the reviewed state. Do not apply migration 0025 or build privileged transition functions against production.
- Next safe implementation step is to obtain an isolated Supabase staging project, then create and validate a dedicated private-schema RBAC migration and transition RPCs there. Until then, keep the policy write surface absent and financial cutover closed.


## Seconds policy RBAC concrete schema contract — 2026-11-06 (UTC+8)

### IMPLEMENTED (documentation + source guard only)
- Re-read coordination HEAD ecf7df7dc2e2155985f6c7cc99ebb90f6dee4814 and feature HEAD 6ef4a5344fedfea667fec4226093bb0a247c02ed before editing.
- Extended docs/SECONDS_POLICY_ADMIN_RBAC.md with the concrete isolated-staging data contract: Auth-UUID membership, append-only permission grant events, immutable exact-version review decisions, actor/action/object/revision-bound idempotency, and append-only administrator security audit.
- Specified membership/policy revision checks, live permission revalidation, distinct author/reviewer/activator, atomic activation plus audit, and retirement behavior that preserves open-position snapshots.
- Clarified a PostgREST boundary: private schema remains non-exposed; because current backend uses REST RPC, a private RPC cannot be assumed callable. If REST is retained, only a tightly permissioned SECURITY INVOKER public wrapper is allowed, with no direct service-role table DML and no public SECURITY DEFINER wrapper. Otherwise use a separately authenticated direct DB connection.
- Extended backend/tests/seconds-policy-admin-rbac-design.test.js with source-contract assertions for the schema model and invocation boundary.
- Feature commit: 4bc5dc34ea8b45096183cdf7216324401a2369d0 (parent 6ef4a5344fedfea667fec4226093bb0a247c02ed); changed only docs/SECONDS_POLICY_ADMIN_RBAC.md and backend/tests/seconds-policy-admin-rbac-design.test.js.

### VERIFICATION / RELEASE BOUNDARY
- Exact GitHub Actions push run 42140415210 completed with conclusion success. All steps succeeded: backend dependency install, unified site build, backend tests, fail-closed deployment configuration validation, and unified output/preserved-entrypoint checks.
- Exact SHA combined status still reports Vercel – btcboxcdt failure with Hobby build-rate-limit upgrade target. No plan upgrade or project setting change was made.
- This is a design/source-guard contract only. No executable RBAC migration, administrator identity endpoint, policy write route, UI, membership, permission grant, Supabase database write, or staging database was created.
- No merge to main, production deployment, policy activation, or financial cutover occurred.

### NEXT
- Isolated Supabase staging is still a hard prerequisite. Before implementation, validate the actual Data API exposed-schema setting and PostgREST role behavior; then generate a migration through the pinned Supabase CLI workflow and run catalog/adversarial tests against staging.
- Keep seconds policy write surface absent and all financial cutover flags closed until the full runtime identity, RBAC, separation-of-duties, and atomic audit path is proven.


## Super Admin / delegated Admin model — implementation contract updated 2026-11-06 (UTC+8)

- User clarified the intended admin model: one Super Admin has all permissions and can create ordinary Admins and configure their permissions. The former mandatory three-person author/reviewer/activator workflow is not part of the product requirement.
- Feature commit `d22d964e0d4864d24dd6bd3eedc300970c641f23` updates `docs/SECONDS_POLICY_ADMIN_RBAC.md` and `backend/tests/seconds-policy-admin-rbac-design.test.js`. It records the Super Admin as the only administrator-provisioning authority, ordinary Admins as explicit least-privilege permission holders, protected Super Admin authority, live Auth/permission validation, and append-only audit.
- A follow-up source correction removes stale three-person assertions and contradictory author/reviewer bullets. The policy versioning, reasons, idempotency, revision checks, immutable open-position snapshots, and fail-closed behavior remain.
- Scope is documentation and static source-guard only. Runtime administrator APIs, administrator UI, RBAC migration, initial Super Admin provisioning, and permission grants are NOT IMPLEMENTED. No Supabase writes or migration, merge, or production deployment occurred.
- GitHub Actions push run for the exact final SHA is being checked; no pass is claimed until completed. Isolated Supabase staging remains unavailable.


## Super Admin model source-guard CI repair — 2026-11-06 (UTC+8)

- The first CI run for the initial Super Admin contract commit `b694f74b7cc3da5a7d9783ae7af589f85846b2e0` exposed two stale source assertions: one expected the older three-distinct-actor model, and another expected a wording variant for ordinary-admin provisioning.
- Follow-up commit `d22d964e0d4864d24dd6bd3eedc300970c641f23` removed stale three-person assertion strings and outdated author/reviewer restrictions, but CI run `42140915024` still failed two documentation-contract assertions (254/256 tests passed). The unified site build succeeded; backend tests failed, so later fail-closed/output checks were skipped.
- Corrective commit `10186811d10fe9737a348f34ff6b33de9dd66fde` aligns the policy-versioning documentation consistency test with the Super Admin/delegated Admin contract and uses the explicit ordinary-admin provisioning restriction wording.
- Final exact-SHA backend CI run is pending. No test pass is claimed yet.
- No runtime RBAC code, SQL migration, admin UI, Supabase write, financial cutover, merge, or deployment occurred.


### FINAL EXACT-SHA CI RESULT
- Feature SHA `10186811d10fe9737a348f34ff6b33de9dd66fde` — GitHub Actions backend CI run `42141050137` completed `success` at `2026-11-06T01:02:37Z`.
- All job steps succeeded: dependency install, unified site build, backend tests, fail-closed deployment configuration validation, and unified output/preserved entrypoint verification.
- Earlier failed run `42140915024` on `d22d964e0d4864d24dd6bd3eedc300970c641f23` was corrected; it had 254/256 tests passing and failed only stale doc-contract assertions. The final exact SHA above is the passing result.
- This verifies source/build/test contracts only, not runtime Supabase RBAC behavior. No isolated staging, migration, administrator account, role grant, financial operation, merge, or deployment was performed.


## Delegated administrator permission catalogue — 2026-11-06 (UTC+8)

- Added an initial closed permission-key catalogue to `docs/SECONDS_POLICY_ADMIN_RBAC.md` for dashboard, users, KYC, deposits, withdrawals, orders, support, announcements, system configuration, seconds policy, financial audit, and reviewed balance-adjustment requests.
- Added static assertions for the allowlisted module permissions and the rule that administrator provisioning/permission assignment is reserved exclusively to the Super Admin.
- Feature commit: `6dfd82cfb69b1a39e7acc2666366309219733398`. This remains a design/source-contract milestone only; no runtime authorization code, admin UI, database schema, migration, membership, or grant has been implemented.
- Financial permissions do not bypass existing backend cutover flags, transaction RPCs, balance invariants, idempotency, security checks, or audit.
- Exact-SHA backend CI is pending; no result is claimed until completion. No Supabase writes, merge, or production deployment.


## Runtime RBAC policy-helper foundation — 2026-11-06 (UTC+8)

### Product authority model (supersedes earlier contradictory notes)
- One owner-controlled Super Admin has all backend admin permissions and is the only authority allowed to provision ordinary Admin accounts and grant/change/suspend/revoke their permissions.
- Ordinary Admins receive explicit permissions from the closed allowlist only. They cannot manage administrators or change Super Admin authority.
- Super Admin can complete seconds-policy management without a mandatory three-person author/reviewer/activator process.
- Any older notes in this document requiring two-person bootstrap, three-person policy approval, or requiring all RBAC work to wait for staging are superseded as product requirements. Staging remains mandatory before database migrations, live administrator provisioning, or runtime activation against Supabase.

### Implemented source in feature branch
- Feature commit: `dd009a154a4dca8cdc2093f78e8bcd366a17d1e3`.
- Added `backend/admin-rbac.js` with a closed permission catalogue, strict normalization (unknown, wildcard, malformed, duplicate values rejected), active-membership checks, Super Admin full permission behavior, and exclusive administrator-management capability.
- Added `backend/tests/admin-rbac.test.js` covering allowlist integrity, grant normalization, Super Admin access, least-privilege Admin access, suspended/revoked fail-closed behavior, and resistance to request-shaped role fields.
- The module is intentionally a pure policy-helper layer. It does NOT authenticate tokens, load membership from a protected database, expose routes, provision users, persist grants, or replace the legacy shared Basic Auth admin login. It must only be called with membership data obtained from a trusted server-side source after trusted Auth validation.
- Existing admin routes are unchanged in this batch. No financial permissions bypass transaction/cutover controls.

### Validation / release boundary
- Exact-SHA GitHub Actions run lookup currently returns zero runs for `dd009a154a4dca8cdc2093f78e8bcd366a17d1e3`; tests have not been executed in CI yet. No pass claimed.
- No Supabase database writes, migration, live admin account, permission grants, merge to main, or production deployment.


### Exact-SHA CI and tree-integrity verification — 2026-11-06 (UTC+8)
- A first helper commit was found to have been constructed from the wrong base tree. Before proceeding, the feature branch was repaired by rebuilding from the exact tree of parent feature commit `6dfd82cfb69b1a39e7acc2666366309219733398`. Compare API confirms the repaired feature commit changes exactly two files relative to that parent: `backend/admin-rbac.js` and `backend/tests/admin-rbac.test.js`; no existing files or layouts are removed or rewritten.
- Repaired feature commit: `b4471ac6462194e2c1bfc4a695754fec17729698`.
- Exact backend CI run `42141737708` completed with conclusion `success`: unified build, backend tests, fail-closed deployment configuration, and output/entrypoint checks all passed.
- Exact frontend CI run `42141737685` completed with conclusion `success`: lint and build passed.
- The policy-helper module is still not runtime-connected to the legacy admin routes. It does not yet authenticate the Supabase token or load membership/grants from a protected store. Do not describe RBAC as live/active.
- No Supabase migration/write, admin provisioning, permission grant, merge to main, or production deployment.


## Supabase Auth token verification foundation — 2026-11-06 (UTC+8)

- Re-read coordination HEAD `f4130b0a822becd65f1b92c3acf8877509496a78` and feature HEAD `b4471ac6462194e2c1bfc4a695754fec17729698` before this batch.
- Added `backend/admin-auth.js`: strict bounded Bearer parsing; HTTPS-only Supabase Auth configuration; server-side GET to `/auth/v1/user` with the configured publishable/anon key and caller access token; canonical UUID validation; anonymous Auth users rejected; upstream failures fail closed as 503. It does not decode JWT claims for identity or roles and returns only the Auth user UUID.
- Added `backend/tests/admin-auth.test.js` covering token parsing, config validation, canonical identity from Auth response, rejection of request/user_metadata role claims, missing credentials, anonymous/non-UUID identities, Auth 401/403, upstream failures and network errors.
- Supabase docs were checked for JWT verification. For HS256/shared-secret projects, Supabase documents verifying the access token directly against Auth `/auth/v1/user`; JWT payload decoding alone is not a trust decision. Relevant doc: https://supabase.com/docs/guides/auth/jwts.
- Feature commit: `5e8d008e43887d8228e1962157e0c048e5ad9006` (parent `b4471ac6462194e2c1bfc4a695754fec17729698`). Compare API confirms exactly two added files: `backend/admin-auth.js` and `backend/tests/admin-auth.test.js`.
- Exact-SHA GitHub Actions backend run `42142544961` completed `success`; unified site build, backend tests, fail-closed deployment configuration validation, preserved output/entrypoint checks, and cleanup all passed.
- Exact-SHA Vercel combined status: `success` (preview check). No production deployment was requested or initiated.
- This is still an isolated identity-verification helper only. It is NOT wired into admin routes, does not load protected membership/grants, does not create the private admin store or bootstrap Super Admin, and does not replace legacy Basic Auth. No SQL migration, Supabase database write, live admin provisioning, permission grant, merge to main, or production deployment occurred.
- Next safe batch: design and test the protected private-schema membership/grant storage contract and Super Admin owner-controlled bootstrap; keep it source-only until an isolated staging database exists. Then connect verified Auth UUID -> live membership lookup -> closed permission helper in a parallel admin API surface, without breaking current Basic Auth until migration is tested.


## Private delegated-admin storage source — 2026-11-06 (UTC+8)

### Implemented on feature branch
- Re-read coordination HEAD `2fc3e43126452276972a8b3be3a1eba468bcef5a` and feature HEAD `5e8d008e43887d8228e1962157e0c048e5ad9006` before this batch.
- Added source-only SQL `backend/supabase/sql/0026_admin_rbac_private_store_v1.sql`:
  - non-exposed `private` schema; membership keyed by Supabase Auth UUID; one-Super-Admin partial unique index;
  - closed permission catalogue matching `backend/admin-rbac.js`;
  - append-only permission grant/revoke events and security audit;
  - revisioned memberships, expected-revision checks, request-hash idempotency and transaction-scoped duplicate-request serialization;
  - owner-only one-time `postgres` SQL bootstrap (no default user or HTTP bootstrap route);
  - trusted-server-only membership lookup and Super-Admin-only provision/set-permissions/suspend/reactivate/revoke transition functions;
  - RLS enabled, PUBLIC/anon/authenticated/service_role table DML revoked; service_role receives only private schema USAGE and narrowly scoped function EXECUTE.
- Updated `docs/SECONDS_POLICY_ADMIN_RBAC.md` to record the schema, invocation boundary, optimistic revision requirement and product-owner bootstrap model. Updated stale source guard wording that contradicted the one-owner Super Admin decision.
- Added `backend/tests/admin-rbac-schema.test.js` for private schema/RLS/privilege boundaries, closed permission catalogue, bootstrap protection, append-only audit, revision checks, idempotency, Super Admin-only management and source-only rollout.
- Feature commit: `fbfb96ee26ff8bce6637f2ca11cbf21f0644c928`. Compare API against prior feature HEAD `5e8d008e43887d8228e1962157e0c048e5ad9006` confirms exactly four paths changed: the new SQL source, new schema source tests, RBAC design doc, and the existing RBAC design test.
- Exact-SHA backend CI run `42144478167` completed `success`: unified site build, all backend tests, fail-closed configuration validation, preserved output/entrypoint checks and cleanup passed.
- Exact-SHA Vercel combined status: `failure` with the known Hobby build-rate-limit upgrade target. This is not a GitHub CI failure; no plan or project setting was changed.

### Hard rollout boundary / not yet validated
- The SQL migration was NOT applied to any Supabase database. No isolated staging database was available; SQL parser/runtime/catalog/role behavior and concurrency have NOT been validated against PostgreSQL.
- No Super Admin or ordinary Admin was provisioned; no permission was granted; no existing Basic Auth route was changed; no API route or admin UI was connected.
- The private schema is intentionally not exposed to PostgREST. The service-role function grants alone do not make private RPCs callable through REST. Before integration, choose and test a trusted invocation path (dedicated direct DB connection or a narrowly reviewed SECURITY INVOKER public wrapper) without exposing private schema or granting direct table DML.
- The trusted backend must validate Supabase Auth first and derive actor UUID from the Auth response; never trust a caller-supplied actor ID. The SQL transition functions rely on that trusted-server boundary.
- Do not apply `0026` to production. Next step is isolated-staging SQL/catalog/adversarial validation, then a parallel API integration and tests; preserve legacy Basic Auth until that new path is proven. No merge to main or production deployment.

## Current user decisions — authoritative correction (2026-11-06 UTC+8)

### Professional trading terminal layout
- The current approved professional trading terminal baseline is **V211**. V161 is historical context only and must not be treated as the current layout baseline.
- Future trading-page work must preserve V211's approved structure and visual direction. Do not revert to V161 or to the older simplified page.
- The user has authorized necessary, carefully scoped trading-page layout/interaction refinements; make one bounded change at a time and inspect it before proceeding. Do not infer permission for a wholesale redesign or changes to trading/financial business logic.
- Before any trading-page edit, inspect the actual V211 source/snapshot and record the exact path/commit evidence. If V211 cannot be positively identified in the repository, stop and report the missing source rather than guessing what V211 contains.

### Administrator authority model
- The authoritative product model is one owner-controlled **Super Admin** with all backend administrator permissions.
- Super Admin alone may create, configure, suspend, reactivate, and revoke ordinary Admin accounts and their explicit allowlisted permissions. Ordinary Admins cannot manage administrators or elevate their own permissions.
- Do **not** require three distinct people as author, reviewer, and activator. Mandatory three-person/separation-of-duties approval is superseded and is not a product requirement.
- Preserve technical safeguards: validated Supabase Auth identity, live server-side membership/permission checks, immutable policy versions/snapshots where relevant, revision checks, idempotency, transactional audit, and fail-closed financial controls. These safeguards do not reintroduce a multi-person approval requirement.
- Staging remains mandatory before applying database migrations, provisioning live administrators, or activating runtime RBAC against Supabase. No production database experiments.

### Conflict resolution
- This section supersedes any older coordination text that describes V161 as the current terminal baseline or mandates three-person seconds-policy approval. When older notes conflict, follow V211 and the single-Super-Admin model above.


## Integration reconciliation refresh — 2026-11-06

- Detailed current source/branch/route/build/CI reconciliation recorded in `docs/INTEGRATION_RECONCILIATION_2026-11-06.md`.
- Audit report commit: `2f94d4f8e1a2a4aa1cb5a5ff715d5a4ff8d468a0` on `chore/shared-ai-coordination`.
- Current main observed at `14a8e361fd928626d4e350a03698135f0c49ceea`; coordination HEAD before this report was `06e1b635724cbbcd4ff44e14814e3ee868f1cb98`.
- Current comprehensive implementation candidate: `feat/btcbox-web3-auth-20261105` at `fbfb96ee26ff8bce6637f2ca11cbf21f0644c928`; GitHub compare reports 374 ahead / 0 behind main. Exact-SHA GitHub Actions run `42144478167` passed; Vercel status failed only due deployment rate limiting. This candidate is not merge-ready and has not been independently browser-QA'd.
- No open PRs were returned by GitHub at refresh. Do not create a broad merge until candidate diff and route-level QA are complete.
- V211 source path remains unverified; no trading page edits are authorized until the exact approved source/snapshot is identified.
- User reports all test Auth users cleared; Supabase was not queried during this audit. Do not delete business schema/configuration or migration history.
- No main merge, production deployment, Supabase write, or destructive operation occurred.


## Candidate ancestry and page audit follow-up — 2026-11-06

- Updated reconciliation report: `docs/INTEGRATION_RECONCILIATION_2026-11-06.md`, latest report commit `e7158b06f6095fb032672230e6f2e0a2a4dae641`.
- Pairwise compare confirms candidate `fbfb96ee26ff8bce6637f2ca11cbf21f0644c928` descends from React Google Auth, Strata theme batch, no-fake-market-data fix and UI i18n/mobile branch histories. The old template migration branch remains diverged and its pinned vendor submodules are not in the candidate tree.
- Candidate SecondsPage is read-only positions/history with safe loading/error/cutover states; order placement/settlement are disabled. Candidate React routes for spot entry, orders, deposit, withdrawal, Earn, KYC and support remain placeholders. Admin UI remains absent and Basic Auth remains the active legacy route. No V211 source has been positively identified.
- No source implementation, database write, merge, or deployment was performed in this audit batch; the durable work is the current evidence ledger and branch/route disposition.


## Implementation batch — authenticated assets and orders — 2026-11-06

- Reconciliation detail updated in `docs/INTEGRATION_RECONCILIATION_2026-11-06.md`, commit `388805544cda4c984502ea147591f225b55e43b3`.
- On `feat/btcbox-web3-auth-20261105`, added authenticated, read-only Orders and Assets pages backed by existing `getOrders` and `getAccount` clients; protected the orders route; implemented loading/error/retry/empty states and accurate valuation-completeness display.
- Candidate head at report time: `403fc12d679b11590e5eaf5c8e8aaae15f33d99a`. CI run `42149902764` was still in progress; prior CI caught and identified a literal escaped newline syntax issue in App.tsx, corrected in this head. Await final CI result before claiming validation.
- No merge, PR, deployment, Supabase write, or financial transaction.


## Implementation batch — authenticated My Account profile — 2026-11-06 (UTC+8)

- Continued on `feat/btcbox-web3-auth-20261105`, starting from candidate `403fc12d679b11590e5eaf5c8e8aaae15f33d99a`.
- Implemented the `/me` account overview in `frontend/src/features/pages/Pages.tsx` using the existing authenticated `getAccount(signal)` client and `useAuth()` session state.
- Authenticated users now see the backend-returned username/email, KYC status, 2FA status, linked sign-in providers, and a partially masked BTCBOX UID. Unauthenticated users retain sign-in/register links. Loading, request error/retry, and abort cleanup are included.
- No new endpoint, mock profile, balance mutation, financial write, or trading-page change was introduced. The V211 trading terminal was not touched.
- Commits: `645c2221ea01afe566daa92973403d5bb8cb79f2` (profile implementation), `32a14b6a27a5da259fd61f3e8d483776016963d0` (session-hook import correction).
- Exact candidate head after this batch: `32a14b6a27a5da259fd61f3e8d483776016963d0`; GitHub compare against `403fc12d679b11590e5eaf5c8e8aaae15f33d99a` reports 3 commits ahead / 0 behind and exactly one changed path: `frontend/src/features/pages/Pages.tsx` (37 additions, 3 deletions).
- Source re-fetch at the exact head confirms the auth hook import and profile implementation are present. No GitHub Actions run was returned by the PR-run-only lookup; combined status reports only Vercel failure due the existing Hobby build-rate-limit target. Therefore this batch is SOURCE OBSERVED, not TEST PASSED. TypeScript/build and browser behavior remain NOT VERIFIED.
- No merge, PR, production deployment, Supabase write, or financial transaction occurred.


## Follow-up UI truthfulness fix — Seconds capability label — 2026-11-06 (UTC+8)

- On the same implementation branch, corrected the Trade Hub Seconds card to state that real open-position/settled-history viewing is available while new order entry remains disabled. This removes the misleading blanket `API integration pending` label.
- Commit: `ed115174b193dd71132195ff148f9afd5bfd22c5`.
- Exact-head source re-fetch confirms the updated copy. Compare from `403fc12d679b11590e5eaf5c8e8aaae15f33d99a`: 4 commits ahead / 0 behind, one path changed (`frontend/src/features/pages/Pages.tsx`).
- Combined status still reports only the existing Vercel Hobby build-rate-limit failure. No GitHub Actions test result is available for this exact SHA; build/test/browser validation remains NOT VERIFIED.
- No trade-order functionality or V211 layout was changed; no financial writes, merge, or deployment.


## Implementation batch — authenticated KYC status view — 2026-11-06 (UTC+8)

- On `feat/btcbox-web3-auth-20261105`, added `KycPage` using the existing authenticated `getAccount(signal)` response; protected the `/kyc` route with `ProtectedAccountRoute`.
- The page presents backend-returned KYC status, applicant name, document type, and a masked document number; includes loading/error/retry states and a support link. It explicitly says submission is not enabled when no submission exists. No fabricated status, upload flow, or unsupported write endpoint was added.
- Commits: `1790322796ca84e1c3b383569c55e73d878ec766` (KYC status component), `35f77daf6f6a6c2974d4cd0331e88bf6c25f31fa` (protected route).
- Exact SHA source re-fetch: `{"appSha":"d6a5d0e907fbe51f4cb218645ca1b41609f284ba","appRoute":true,"appLazy":true,"pageSha":"f683f3968e21fcb300a284d23cf755154655b152","component":true,"accountData":true}`. Compare from `ed115174b193dd71132195ff148f9afd5bfd22c5`: 2 ahead / 0 behind; files: [{"filename":"frontend/src/App.tsx","status":"modified","additions":2,"deletions":1,"changes":3,"previous_filename":null},{"filename":"frontend/src/features/pages/Pages.tsx","status":"modified","additions":34,"deletions":0,"changes":34,"previous_filename":null}].
- Combined status: [{"context":"Vercel – btcboxcdt","state":"failure","target_url":"https://vercel.com/fuyao999?upgradeToPro=build-rate-limit"}]. No GitHub Actions pass evidence was obtained for this exact SHA; TypeScript/build/browser QA remains NOT VERIFIED. Existing Vercel Hobby build-rate-limit failure is not treated as a code test result.
- No database write, identity-document upload, merge, production deployment, or V211 trading-terminal change.


## Implementation batch — authenticated customer support conversation — 2026-11-06 (UTC+8)

- On `feat/btcbox-web3-auth-20261105`, implemented the customer-facing support conversation using the existing backend routes, not a new or invented endpoint.
- Backend contract verified in `backend/api-core.js`: GET `/api/support/messages` returns the latest 50 account messages and updates the read marker; POST `/api/support/chat` requires authenticated user, validates non-empty content up to 2,000 characters, appends a user message, persists, and returns success. Existing admin reply route writes replies as `from:'admin'`.
- Added validated typed API client functions `getSupportMessages` and `sendSupportMessage`; built the protected SupportPage with real conversation rendering, user/support distinction, loading/error/retry, 2,000-character limit, send state, and warning not to share passwords/2FA/recovery phrases.
- Commits: `a181200457072d20bc20712569770f90728cbd36` (API client), `a859d76a28730540ec90d2396d4421c28a54d02c` (page), `5427529ddd8c8c5cd7d639fd1526ded80c3c21b2` (event type correction), `9e2e2ffb9ad3e713978b970e7bf327118285ea1f` (protected route).
- Exact-head re-fetch verification: `{"apiHasRead":true,"apiHasSend":true,"apiValidatesShape":true,"pageExists":true,"pageUsesRealApis":true,"pageCaps2000":true,"protectedRoute":true,"backendPostExists":true,"backendGetExists":true}`. Compare from `35f77daf6f6a6c2974d4cd0331e88bf6c25f31fa`: 4 commits ahead / 0 behind; files: [{"filename":"frontend/src/App.tsx","status":"modified","additions":2,"deletions":1,"changes":3,"previous_filename":null},{"filename":"frontend/src/features/pages/Pages.tsx","status":"modified","additions":52,"deletions":3,"changes":55,"previous_filename":null},{"filename":"frontend/src/lib/api.ts","status":"modified","additions":39,"deletions":0,"changes":39,"previous_filename":null}].
- Combined status: [{"context":"Vercel – btcboxcdt","state":"failure","target_url":"https://vercel.com/fuyao999?upgradeToPro=build-rate-limit"}]. No GitHub Actions pass result available for this exact SHA; TypeScript/build/browser test remains NOT VERIFIED. Existing Vercel Hobby build-rate-limit status is not a code test result.
- No admin reply code, database schema, Supabase production data, financial write path, V211 trading layout, merge, or deployment was changed.


## Implementation batch — authenticated deposit address and withdrawal review — 2026-11-06 (UTC+8)

- On `feat/btcbox-web3-auth-20261105`, implemented protected `/deposit` and `/withdraw` views backed by existing account endpoints.
- Verified backend contract in `backend/api-core.js`: `POST /api/deposit` with amount zero is address-query-only and returns a configured asset/network address; positive user-supplied amounts are rejected because credit requires on-chain confirmation. `GET /api/addresses` returns the signed-in user's masked saved addresses. `GET /api/account` provides account balances. `POST /api/withdraw` requires an eligible destination, fee, fund password, optional 2FA, idempotency key, and financial ledger cutover; it fails closed with `FINANCIAL_CUTOVER_INCOMPLETE` if the write path is not enabled.
- Added typed readers `getDepositAddress` and `getSavedCryptoAddresses`, supported asset/network validation and response checks. Added deposit page for configured address selection, retry, copy and chain safety warning. Added withdrawal review page showing live balances and masked saved crypto destinations; deliberately no submit action is exposed while financial ledger cutover remains incomplete.
- Commits: `4818b0a350cadccc046a243bb7a438ba2e0a48d7` (API readers), `60d57c6abb1261fd51769aff8b430eabc8e80ff3` (pages), `d0c89b2435161e2805bfd93ef6bda27cfe402cc4` (protected routes), `6ee679080ec3e4f75c14aab8e61bb6ab76b951ff` (legacy address flag compatibility).
- Exact-head source re-fetch checks: `{"depositReader":true,"addressBookReader":true,"depositPage":true,"depositRealEndpoint":true,"withdrawPage":true,"withdrawRealData":true,"withdrawFailClosed":true,"protectedDeposit":true,"protectedWithdraw":true}`. Compare from `9e2e2ffb9ad3e713978b970e7bf327118285ea1f`: 4 ahead / 0 behind; changed files: [{"filename":"frontend/src/App.tsx","status":"modified","additions":4,"deletions":2,"changes":6,"previous_filename":null},{"filename":"frontend/src/features/pages/Pages.tsx","status":"modified","additions":64,"deletions":1,"changes":65,"previous_filename":null},{"filename":"frontend/src/lib/api.ts","status":"modified","additions":37,"deletions":0,"changes":37,"previous_filename":null}].
- Combined status: [{"context":"Vercel – btcboxcdt","state":"failure","target_url":"https://vercel.com/fuyao999?upgradeToPro=build-rate-limit"}]. No PR-associated GitHub Actions workflow run was returned for this SHA; TypeScript/build/browser QA remains NOT VERIFIED. Vercel Hobby build-rate-limit is not a code test result.
- Deposit address lookup is implemented; on-chain deposit detection/history is not implemented in this batch. Withdrawal request submission remains intentionally disabled; no financial write, schema change, Supabase write, merge, deployment, or V211 trading layout change occurred.


## Earn catalog read endpoint batch — 2026-11-06 (UTC+8)

- Re-read this shared coordination document before work. Corrected the earlier incomplete Earn audit: feature source already contains POST /api/earn, atomic subscribe/redeem RPC calls, SQL migrations 0005, 0006, and normalized read migration 0011. Product rates/terms and immutable snapshots are database-defined; fixed early redemption uses the snapshotted early fee. Earn is not a manual-approval workflow in the current SQL contract.
- Added authenticated GET /api/earn/products to backend/api-core.js on feat/btcbox-web3-auth-20261105. It reads only active rows from public.earn_product_catalog using server-side Supabase service credentials, validates shape, and returns actions_enabled from the backend financial-write configuration. Missing table/config or upstream errors fail closed with 503; there is no mock catalog fallback.
- Feature HEAD: 9ad9a3d291be8b0e38ce5f69cc54e96f65115eda. Commits from prior feature HEAD 6ee679080ec3e4f75c14aab8e61bb6ab76b951ff: 2 ahead / 0 behind. Exact compare confirms only backend/api-core.js changed, 25 additions. Commit 7c81554af3b772e4b95e3e7f5938bda12de035c4 added the route; 9ad9a3d291be8b0e38ce5f69cc54e96f65115eda corrected its URL normalization.
- Exact-SHA source re-fetch confirms the route and corrected regular expression. No PR-triggered Actions run was returned; combined status shows only the existing Vercel Hobby build-rate-limit failure. Backend tests/runtime, frontend build, and browser QA remain NOT VERIFIED.
- Frontend API/page wiring is still outstanding. A frontend API write attempt was blocked by the platform safety check and was not retried through another route. No migrations were applied, no Supabase writes or financial operations occurred, and no merge/deployment/trading-layout change occurred.
- The live project migration history previously observed did not include 0006 or 0011. Therefore catalog and normalized earn-position reads are not proven live. Do not apply them to production in this source-only batch. Staging migration validation remains required before financial cutover.
- User's semi-manual operating model is acknowledged. Preserve backend-operated review/exception handling where present (notably withdrawal first-time/large-value manual review); do not invent a manual-approval state for Earn where the current contract has none.


## Earn frontend integration batch — 2026-11-06 (UTC+8)

- Re-read shared coordination document before this batch. Feature branch `feat/btcbox-web3-auth-20261105` now includes a protected `/earn` page, typed Earn catalog/action clients, and account Earn-position typing.
- The page reads the live active product catalog from authenticated `GET /api/earn/products` and the user's position/interest snapshot from authenticated `GET /api/account`. It displays catalog APY, asset, flexible/fixed term, early redemption fee, principal, estimated interest and maturity. No static seed catalog is presented as live data.
- Subscribe and redeem use the existing authenticated `POST /api/earn` backend route and its atomic `subscribe_earn_atomic` / `redeem_earn_atomic` RPCs. Request IDs are retained per operation across an uncertain network result so a user retry reuses the same idempotency key; the UI does not treat an unconfirmed response as success. Client amount precision is checked against catalog amount_scale; the database remains authoritative.
- The page is protected by the authenticated account route. If the financial write switch is false, catalog/position review remains available while subscribe/redeem are disabled with an explicit status. Partial account/catalog reads are handled independently, so a catalog read failure does not hide a successfully returned position snapshot.
- Feature commits in this batch: 412859aa3796f0ae54648a7d5e8548cfb1532fcb (Earn API clients), cc4b8802bc11b74384660744f8417d360e49e791 (account position typing), fed400f8ef68f8acf9302685da341bc646161804 (Earn page), 0ccae477434652170d3da0f6bf7b3de5dd3cc650 (protected route), 66fb2804c1948af12253fd899be8f0c187c1f483 (partial-read handling and stable idempotency retries).
- Feature HEAD: 66fb2804c1948af12253fd899be8f0c187c1f483. Compare from 9ad9a3d291be8b0e38ce5f69cc54e96f65115eda: 5 ahead / 0 behind. Changed files: frontend/src/App.tsx (+2/-1), frontend/src/features/pages/Pages.tsx (+94/-1), frontend/src/lib/api.ts (+72).
- Exact-SHA re-fetch confirmed Earn types, catalog reader, operation client, page export, live catalog call, subscribe/redeem actions, stable idempotency key reuse, protected route, and backend atomic RPC references. One initial source-presence assertion for positions used an outdated expression and returned false; the actual implementation reads `accountResult.value.earn_records` and was confirmed by source re-fetch.
- `frontend/package.json` declares `build: tsc -b && vite build` and `lint: tsc --noEmit`, but neither was executed in this environment. No PR-triggered Actions run was returned for this SHA; combined status reports only the existing Vercel Hobby build-rate-limit failure. TypeScript/build/browser runtime QA remains NOT VERIFIED.
- No migration was applied. Live project migration history previously observed did not include 0006 or 0011; therefore live catalog/position reads may fail closed until the migrations are reviewed and deliberately applied. No Supabase write, financial operation, merge, deployment, or V211 trading layout change occurred.
- The Earn workflow in the current SQL/API is atomic database processing, not a manual-approval queue. Preserve the user's broader semi-manual operating model in the admin-managed workflows that require review (especially withdrawals); do not invent Earn approval states absent from the backend contract.


## User-confirmed simplified semi-manual funds workflow — 2026-11-06

The user explicitly simplified the required business process. Do not expand it into automated chain monitoring, automatic payout, multi-stage settlement orchestration, or unnecessary verification steps.

1. Deposit: administrator configures one receiving address per supported asset/network. The deposit page displays exactly that configured address. The user transfers funds externally and waits. An administrator checks the transfer manually and performs one manual account credit ("上分") in the admin panel. The system records who credited, which user/asset/amount, time, reference/note, and the resulting ledger operation. No automated chain scanner or user-side claim form is required unless later requested.
2. Withdrawal: user submits asset, network, amount and destination address. Admin panel shows the request and its status. Administrator reviews and approves/rejects. After approval, the administrator manually sends the funds externally and records the completed/manual payout result (including transaction reference/hash if available). The user can see pending/reviewed/rejected/paid status. Approval must not be mislabeled as paid.
3. Keep only essential controls: authenticated user/admin, available-balance check and reservation/debit/refund semantics in one authoritative database transaction, idempotent admin credit/payout actions, and an audit trail. Do not create automatic chain broadcast, automatic matching, or a complex approval hierarchy.
4. Existing source has pieces of this workflow but it is not complete: admin deposit address config exists; admin manual credit endpoint `POST /api/admin/deposit/confirm` exists but is gated by financial cutover; user `POST /api/deposit` only returns an address and rejects a positive amount; withdrawal submit endpoint exists but is gated by financial cutover; admin withdrawal approve/reject endpoints exist but approval explicitly does not broadcast funds. The frontend currently has no deposit claim/history workflow and withdrawal submission remains hidden.
5. Next implementation priority: finish the simple manual deposit-credit and withdrawal-request/review/manual-paid workflow end to end. Reuse existing admin endpoints/RPCs where correct; add only the minimum missing record/status operation. Do not turn this into an automated on-chain integration. Preserve V211 layout and do not deploy or perform live balance changes without approval.


## Financial switch instruction and live compatibility audit — 2026-11-06

- User clarified: there are currently no users, so do not treat keeping the financial switch closed as a permanent requirement. Proceed with the financial workflow and prepare to enable the switch; do not delay merely to preserve legacy user balances.
- Read-only Supabase verification for project `zlozsutefnmgwwzrlipt`: Auth users = 0; financial_accounts = 0; withdrawal_requests = 0; earn_product_catalog = 7. Project status ACTIVE_HEALTHY. The current DB has the financial tables and RPCs already present, despite the migration registry showing only two timestamped migration entries. Do not infer migration application from source filenames alone.
- Exact live DB RPC contracts: `create_withdrawal_atomic` is currently the 9-argument signature ending in `p_request_hash text`; `review_withdrawal_atomic`, `admin_manual_deposit_atomic`, `apply_financial_operation`, `read_financial_account_snapshot_v1`, `read_admin_withdrawal_snapshot_v1`, and `read_admin_account_balances_v1` exist. Money-moving RPC ACLs observed grant EXECUTE to `service_role` (and postgres), not anon/authenticated. The live admin read snapshot currently lists `pending` requests; the current withdrawal table does not have `require_admin_review`, `payout_reference`, `paid_by`, or `paid_at` fields.
- The production Vercel app is the separate `btcbox-v33` project/repository, not the Vite frontend in `btcboxcdt`. Vercel environment metadata for `btcbox-v33` confirms `FINANCIAL_POSTGRES_RPC_ENABLED=0`, `FINANCIAL_POSTGRES_FULL_CUTOVER_APPROVED=0`, `FINANCIAL_POSTGRES_READS_ENABLED=0`, and `FINANCIAL_MATCHING_ENGINE_ENABLED=0` for production and preview. Do not enable matching engine for this simplified manual funds workflow.
- Source mismatch found in production repo `avali9308-code/btcbox-v33`: `backend/api-core.js` was calling the 10-argument withdrawal RPC with `p_require_admin_review`, while the live DB exposes only the 9-argument RPC. This would fail if financial writes were enabled. Created branch `fix/manual-withdrawal-rpc-compat-20261106` from main SHA `18a354a9e8e1d0365e240c7c44eda4a18d62ce07`; commits `1d66cdfe43d5974ba921a3573d40b897a58b584c` and `90b887eceb18e613cab22eea66295190e41d1b15` align the API to the live 9-argument RPC, make every withdrawal wait for admin review (simple user-requested flow), and correct deposit/withdrawal UI language to describe manual verification, manual credit and manual payout rather than automatic on-chain confirmation.
- Exact branch head `90b887eceb18e613cab22eea66295190e41d1b15`; compare to production main `18a354a9e8e1d0365e240c7c44eda4a18d62ce07`: 2 ahead / 0 behind; changed only `backend/api-core.js` (+4/-7) and `backend/assets/js/views-assets.js` (+4/-4). Exact-SHA source re-fetch confirmed 9-argument call and manual-review wording. Test script is `node --test tests/*.test.js`; build script is `node scripts/build-site.js`. Neither was run here. Vercel check on the branch is failure; no workflow run was returned. No deploy, environment-variable update, database write, or financial operation occurred.
- The financial switch is not being kept closed as a product requirement. However, it must not be flipped on the current production deployment before the compatibility branch is integrated and the manual payout completion path is available; otherwise the live app can accept withdrawal requests without a reliable end-to-end manual paid status. User has authorized proceeding without waiting for old-user migration; user has not separately authorized a production deployment in this batch.
- Remaining minimum work: add a simple audited manual payout-complete action after approval, expose approved-for-payment items in admin queue, and return the paid status/reference in user withdrawal history. Keep this simple; no chain scanner, auto-broadcast, or multi-stage approval.
- Supabase table listing surfaced a critical RLS advisory for `private.btcbox_state_pre_test_cleanup_backup` and `private.btcbox_auth_test_users_backup`: RLS is disabled on both backup tables. Do not auto-apply without user decision. Suggested lockdown SQL is included in the assistant response; verify schema exposure and intended access before enabling RLS because no policies would intentionally block access.


### Follow-up: legacy JSON user records check
- Additional read-only query found 3 records in `public.btcbox_state.data.users` (legacy JSON store), each with a balances object (18 asset entries total); all 18 entries have zero free/frozen balance. Supabase Auth users remain 0 and normalized financial_accounts remain 0.
- Do not claim the entire user store is empty: Auth is empty, but 3 legacy user/profile records remain. Their balances are zero, so no positive legacy balances require migration. Do not delete these profile records without the user's explicit instruction.


## Manual withdrawal payout completion batch — 2026-11-06

- Production repository remains `avali9308-code/btcbox-v33`, branch `fix/manual-withdrawal-rpc-compat-20261106`; production main baseline `18a354a9e8e1d0365e240c7c44eda4a18d62ce07`.
- Latest feature branch head: `e99502b02426a6773ca7201c5be45c7179110950`, 10 commits ahead / 0 behind main. Files changed: `backend/api-core.js`, `backend/assets/js/app-core.js`, `backend/assets/js/views-account.js`, `backend/assets/js/views-assets.js`, new SQL `backend/supabase/sql/0023_withdrawal_manual_payout_completion_v1.sql`, and `backend/tests/api-routing.test.js`.
- Added an audited manual payout-completion database RPC. It locks the withdrawal row, only accepts status `approved`, sets status `completed`, stores optional payout reference/note, paid admin and timestamp, and appends a financial audit record. It does not move funds again: the existing approval transaction already finalizes the frozen debit. RPC EXECUTE is revoked from PUBLIC/anon/authenticated and granted to service_role only.
- Added admin API `POST /api/admin/withdraw/mark-paid`, user API `GET /api/withdrawals`, and service-role read RPC `read_withdrawal_history_v1`. Admin queue now fetches the authoritative PostgreSQL list, shows both pending and approved-awaiting-manual-payout records, and offers approve/reject or mark-paid as appropriate. User withdrawal page now displays authoritative status, paid time and optional transfer reference. UI wording now accurately states that every withdrawal is manually reviewed and approval is not payment.
- Added route coverage for `/api/withdrawals` and `/api/admin/withdraw/mark-paid`; route list is now 25.
- Vercel build log for intermediate SHA `3c11b11f5bc8ae4dd7b49392becddd42a5ba78f8` exposed a syntax error caused by an incorrectly escaped URL-trim regex in the two newly added API routes. Fixed both occurrences in commit `23e4882758e671ef98df1f6fa88c9d8c9bbb1b3b`; source re-fetch shows the correct `replace(/\\/+$/, '')` expression. Subsequent UI copy and route-test commits bring the latest head to `e99502b02426a6773ca7201c5be45c7179110950`.
- Latest GitHub combined status still reports Vercel failure and no GitHub workflow runs were returned. The earlier build logs identify the syntax error; after the fix, latest build logs could not be retrieved due Vercel team access requiring reauthorization. Do not claim the latest build or tests passed.
- SQL migration `0023_withdrawal_manual_payout_completion_v1.sql` is committed but NOT applied to Supabase. No Vercel environment variables were changed, no production deployment was performed, no live database DDL/write was run, and no funds operation occurred in this batch.
- The switch is not being held off for legacy users. Before enabling the production write flags, integrate/deploy the code, apply migration 0023, verify the RPC grants and status constraint, and pass build/API smoke checks. Keep `FINANCIAL_MATCHING_ENGINE_ENABLED=0`; this manual funds workflow does not need the matching engine.


### Supabase transactional validation for migration 0023
- Executed the committed migration inside a single PostgreSQL transaction, inserted one synthetic approved withdrawal, called `mark_withdrawal_paid_atomic` twice with the same reference (first completion + idempotent retry), and called `read_withdrawal_history_v1`; the transaction completed without SQL/RPC errors and was rolled back.
- Post-rollback verification returned `persisted_test_withdrawals=0` and `persisted_payout_columns=0`. Therefore no migration DDL or test row remains in the live database. This is a transactional smoke test, not migration application or a production financial operation.


## Manual funds workflow follow-up — 2026-11-06 (UTC+8)

- Re-read this coordination entry before work. Production branch remains `fix/manual-withdrawal-rpc-compat-20261106`; production baseline remains `main` at `18a354a9e8e1d0365e240c7c44eda4a18d62ce07`.
- Fixed the stale withdrawal UI test contract by restoring visible guidance for bound withdrawal addresses, the 24-hour new-address cooldown, and first/large withdrawal manual review. The deposit page continues to say the receiving address is configured by the administrator and warns against wrong coin/network transfers; tests were updated to assert this approved manual-address model, not a system-generated address.
- Added a direct admin manual-credit form under the admin deposits tab. It accepts user UID, asset, actual received amount, optional transfer reference and note, confirms that staff checked receipt, and calls the existing audited `POST /api/admin/deposit/confirm` ledger route with an operation request ID. No user-side deposit claim form or chain scanner was added.
- Fixed admin user-list hydration: the page now calls `GET /api/admin/users` and renders the actual response fields `kyc_status` and `total_usdt`, allowing staff to retrieve a UID before manual credit. Added source tests for the manual-credit form, escaping, user-list hydration, and API field contract.
- Two intermediate preview builds surfaced stale UI assertions (first the removed withdrawal hint, then legacy system-generated deposit-address copy / old deposits-table assertions). Those tests were corrected to match the retained business rules and the user's semi-manual workflow; no business control was weakened to make tests pass.
- Latest production-repository branch HEAD: `755ebc51f158eae5d1f104253b4bac97f9abe967`; compare to main: 17 ahead / 0 behind. Changed paths remain limited to `backend/api-core.js`, `backend/assets/js/app-core.js`, `backend/assets/js/views-account.js`, `backend/assets/js/views-assets.js`, migration `0023_withdrawal_manual_payout_completion_v1.sql`, and tests `api-routing.test.js` / `frontend_security.test.js`.
- Vercel Preview deployment `dpl_5hS2oWZoufCFaxMTGKBqscGrdPsv` (`btcbox-v33-eksdw4zcz-box-2753.vercel.app`) is `READY`. Its build log confirms `BTCBOX public build created in dist/`; Node test suite reports 87 tests, 87 passed, 0 failed. This is a Preview artifact only, not a production deployment. No browser end-to-end test was run.
- Migration 0023 remains committed but NOT applied. Its prior transaction/rollback smoke test remains the only database validation; no production DDL, permanent database write, financial operation, environment-variable change, merge, or production deployment occurred. Do not enable the three financial cutover flags yet; keep `FINANCIAL_MATCHING_ENGINE_ENABLED=0`.
- Next: complete authenticated preview smoke checks for admin user lookup/manual credit and withdrawal queue/history using safe non-financial reads; review live admin identity/ADMIN_USER configuration and the three financial flags. Apply migration 0023 and enable cutover only after explicit production change approval and the remaining checks. Preserve the V211 trading layout.


## Admin user-scoped manual credit UX — 2026-11-06

- Reworked the admin user list so each user row has an 账户资产 action. It calls the existing authenticated GET /api/admin/user?uid=... detail endpoint; the selected UID is carried by the selected row and is not manually typed.
- The account panel shows USDT/BTC/ETH/SOL free and frozen balances. Each asset row has its own 人工上分 action; opening its inline form binds both the selected user UID and selected asset automatically. The operator only enters the verified received amount, with optional transfer reference and note.
- The standalone manual-credit tab and manual UID/coin entry form were removed. The existing audited POST /api/admin/deposit/confirm endpoint, confirmation prompt, idempotency key, and ledger operation remain unchanged. The backend still validates the supported asset, amount, request ID, admin actor and financial cutover state.
- Added/updated source tests for selected-user detail loading, automatic UID/asset binding, removal of the standalone UID form, and escaping of the user/asset/amount/reference/note values.
- One preview test run exposed a stale XSS assertion that still expected the removed global UID form; replaced it with assertions for the new account-panel flow. Latest feature branch HEAD: 79c598a038547b973314147f43a81f97b8d697d5, 22 commits ahead / 0 behind production main 18a354a9e8e1d0365e240c7c44eda4a18d62ce07.
- Vercel Preview dpl_BYiXWaDKDzG57MCF7DaHHTNFSxrA is READY at https://btcbox-v33-d14znhjd0-box-2753.vercel.app; build completed and Node test suite reports 87 passed / 0 failed. No browser E2E or authenticated UI interaction was performed.
- No backend API, SQL migration, financial flags, Supabase data, or production deployment was changed in this UX batch. Migration 0023 remains unapplied; no merge or production deployment occurred. Preserve V211 trading layout.


## Seconds-contract unlimited open positions — 2026-11-06

- USER DECISION: each user may hold an unlimited number of simultaneously open Seconds positions. Do not impose a per-user open-position count limit. The admin side must be able to inspect open positions; settlement/end-of-order behavior remains a server-side/admin-configurable business rule, not a hard-coded frontend-only rule.
- SOURCE OBSERVED on Supabase project `zlozsutefnmgwwzrlipt`: `public.seconds_contract_positions_one_open_per_user_idx` currently exists as a partial UNIQUE index on `user_id WHERE status='open'`; this is the direct database blocker to multiple open positions.
- SOURCE OBSERVED: the existing `submit_seconds_order_v1` RPC checks request idempotency, inserts/locks the user's USDT financial account row with `FOR UPDATE`, then performs the available-to-frozen ledger movement and inserts a position in one transaction. This account-row lock serializes concurrent order creation for the same user and is the existing concurrency guard to preserve when removing the per-user open-position index.
- SOURCE OBSERVED: separate uniqueness protections remain on `position_id`, `open_operation_id`, `open_request_id`, and `settle_request_id`; do not remove these. The read RPC `read_seconds_positions_v1` aggregates all open positions for a user without a per-user open-count cap; settled history is separately bounded to the latest 100 rows.
- SOURCE OBSERVED: current `seconds_contract_positions` contains zero rows (no open or settled positions). This supports the clean-database planning assumption, but is not permission to run permanent production DDL or financial writes.
- SOURCE OBSERVED: Supabase migration history currently lists only versions `20261102133555` and `20261103062716`, despite the live schema containing the Seconds RPCs and unique indexes. Treat migration-history drift as a release concern; reconcile the authoritative migration sequence before any permanent apply.
- NOT VERIFIED: PostgreSQL concurrency behavior with multiple simultaneous open positions has not been exercised in an isolated test database. No permanent index removal, migration apply, code commit, merge, financial flag change, or deployment was performed in this audit batch.
- NEXT IMPLEMENTATION: add a forward-only migration that drops only `seconds_contract_positions_one_open_per_user_idx`; retain all request/position/ledger uniqueness guards and the account-row lock. Add regression tests proving unlimited open positions are allowed while duplicate request IDs and duplicate position IDs remain rejected. Then test concurrent submissions and independent settlement for multiple positions using isolated fixtures before considering cutover. Do not change the V211 trading layout.


### Additional Seconds source audit — 2026-11-06

- SOURCE OBSERVED: the current backend `api-core.js` still hard-codes the allowed durations to `30/60/300/900`; the SQL schema repeats the same CHECK constraint. No admin Seconds policy/config endpoint was found in the inspected backend API source.
- SOURCE OBSERVED: the current settlement RPC hard-codes winning PnL to `round(amount * 0.85, 18)`; this is not an admin-configurable payout ratio. It also uses fixed tie/win/loss settlement behavior. The user requirement is that 85% is the minimum payout/profit ratio, not the only fixed value, and order-end handling must be controlled by backend/admin policy.
- SOURCE OBSERVED: `POST /api/seconds/order` currently returns `settle_at` calculated again from API `Date.now() + durationSec` rather than forwarding the authoritative `result.settle_at` returned by PostgreSQL. This must be corrected to return the database value unchanged; retries must preserve the original maturity timestamp.
- SOURCE OBSERVED: `GET /api/seconds/positions` forwards the full `open[]` array from `read_seconds_positions_v1`; that SQL RPC aggregates all open positions for the user without a per-user open-position count limit. Settled history is limited to the latest 100.
- NOT VERIFIED: admin-side global open-position queue, policy editing UI/API, per-symbol/per-duration payout configuration, and actual multiple-position frontend rendering have not been verified.
- Implementation must not introduce outcome manipulation or client-side settlement authority. Admin policy changes must be validated and snapshotted onto each newly opened position (or otherwise versioned) so an in-flight position's settlement terms cannot be retroactively changed. Settlement must remain server-side, atomic, auditable and idempotent.


## Seconds-contract implementation readiness recheck — 2026-11-06

- Re-read the coordination entry and Supabase skill before this batch. Production feature branch remains `fix/manual-withdrawal-rpc-compat-20261106`, confirmed at `79c598a038547b973314147f43a81f97b8d697d5`; compare to `main` `18a354a9e8e1d0365e240c7c44eda4a18d62ce07` remains 22 ahead / 0 behind.
- Re-fetched `backend/api-core.js` from the feature branch (blob `043639d6afd76b17c559a9c4493d8ae7036d2821`). SOURCE OBSERVED: `SECONDS_ALLOWED_DURATIONS` is still `30/60/300/900`; `POST /api/seconds/order` still returns `settle_at = Date.now()/1000 + durationSec` instead of forwarding the database RPC result. This is a confirmed outstanding API defect, not fixed in this batch.
- Re-fetched `backend/supabase/sql/0015_financial_seconds_one_open_position_v1.sql`: it creates the partial unique index and redefines the submit RPC to handle that index conflict. Live read-only catalog query independently confirms the index still exists: `seconds_contract_positions_one_open_per_user_idx ON (user_id) WHERE status='open'`.
- Rechecked live migration history: only `20261102133555` and `20261103062716` are recorded, despite the live Seconds schema/RPCs. This migration-history drift remains unresolved and must be reconciled before permanent DDL.
- Supabase official CLI v3 changelog (2026-11-04) confirms database commands now target local by default and hosted changes require explicit remote targeting/confirmation. Supabase CLI docs confirm `supabase migration new <name>` creates the timestamped migration file locally. The available Vercel sandbox creation endpoint rejected two correctly scoped attempts (400 bad_request); no project terminal or local Supabase CLI was obtained. Per the Supabase skill, no migration file was fabricated through GitHub contents API.
- No source code, tests, SQL migration, live schema, financial flags, merge, or deployment changed in this batch. No code/test claim is made. Next blocker-removal step: obtain a working project terminal/sandbox, run `supabase migration new`, then implement the index-only drop plus the database-authoritative `settle_at` fix and regression tests. Preserve the account-row `FOR UPDATE` lock and all independent idempotency/ledger constraints.


## Seconds API maturity timestamp fix — 2026-11-06

- Implemented on feature branch `fix/manual-withdrawal-rpc-compat-20261106`: `backend/api-core.js` now returns `settle_at: result.settle_at` from `submit_seconds_order_v1`, instead of recalculating maturity using the API process clock. This preserves the database's original maturity timestamp on idempotent retries.
- Added a regression source test in `backend/tests/frontend_security.test.js` asserting the API forwards the RPC value, does not calculate `Date.now()/1000 + durationSec`, and that the SQL RPC returns the persisted timestamp for both duplicate and fresh requests.
- Commits: API fix `d8ae56e55b8c02a033fab2d4d1d088231f6ec40e`; regression test `4710df3a23008c0947912793204fe511661ff633`. Current feature head after these two commits: `4710df3a23008c0947912793204fe511661ff633`, 24 ahead / 0 behind `main`.
- TEST STATUS: NOT RUN. GitHub combined status returned no status checks and commit workflow lookup returned no PR-triggered runs. No project terminal was available to run `npm test`. The test is committed but is not represented as passed.
- Sandbox retry: both Vercel sandbox API v4 and v2 creation attempts returned HTTP 400 bad_request, including a correctly scoped project ID. Stop retrying the same API path; use an independently provisioned local/project terminal or resolve Vercel sandbox permissions before further CLI-dependent work.
- BLOCKED: no Supabase migration was created because the Supabase skill requires `supabase migration new <name>` to generate it. No index removal, migration-history repair, duration/payout policy changes, SQL DDL, production DB write, merge, or deployment occurred.
- Remaining next steps: obtain a working CLI terminal; create and test a forward-only migration that drops only the per-user open-position partial unique index; retain account-row `FOR UPDATE` and all idempotency/ledger unique constraints; then perform isolated concurrent multi-position and independent-settlement tests. Do not use a paid Supabase branch without explicit cost approval. Preserve V211.


## Seconds-contract next-batch environment recheck — 2026-11-06

- Re-read this coordination file from `chore/shared-ai-coordination` before the batch (blob `735434210c54acc06f7c2c66fbbcf58a83cd849e`). Reconfirmed the active production feature branch head via GitHub branch API: `4710df3a23008c0947912793204fe511661ff633`; comparison to production `main` `18a354a9e8e1d0365e240c7c44eda4a18d62ce07` is 24 ahead / 0 behind. Changed-file scope remains seven paths: backend API, two frontend account/assets files, migration 0023, and two test files.
- Re-fetched `backend/supabase/sql/0015_financial_seconds_one_open_position_v1.sql`. SOURCE OBSERVED: migration 0015 creates `seconds_contract_positions_one_open_per_user_idx` and modifies `submit_seconds_order_v1` to map its conflict to `OPEN_POSITION_EXISTS`. It also retains the per-user USDT financial-account row lock `FOR UPDATE`; this lock and all independent request/position/operation/ledger uniqueness constraints must remain.
- Reconfirmed the previous `settle_at` API fix is present in the branch source. The latest source-test commit remains committed, but the Node test suite is still NOT RUN. GitHub combined status is `pending` with zero status contexts; commit workflow lookup returns no PR-triggered runs. No test pass is claimed.
- Vercel project `btcbox-v33` sandbox recheck: `list_sessions` returned zero sessions and `list_named_sandboxes` returned zero named sandboxes. A correctly shaped Vercel v2 sandbox-create request again returned HTTP 400 `bad_request`; no sandbox/terminal was provisioned. Do not state that a sandbox was created. Stop repeating this endpoint without new evidence or a changed access/configuration path.
- Supabase official docs refreshed: CLI v3 database commands target local by default; hosted targets require explicit `--remote`, and hosted mutations require confirmation. Official `supabase migration new <name>` creates the timestamped file under `supabase/migrations`. References: https://supabase.com/changelog/supabase-cli-v3 and https://supabase.com/docs/reference/cli/global-flags. No migration file was generated because no CLI terminal is available; do not fabricate a migration filename or claim the index is removed.
- No source code, test file, SQL migration, live schema, financial flag, production deployment, or merge changed in this batch. The multiple-open-position database restriction remains active and unmodified. No production DDL or financial writes were performed.
- NEXT: obtain a valid non-deploying terminal (not a Vercel deployment build); run the project CLI help/version checks; create the forward-only migration with `supabase migration new`; then implement only the drop of `seconds_contract_positions_one_open_per_user_idx`, preserving the account row lock and all idempotency/ledger protections. Run backend tests and isolated concurrent multi-position/independent-settlement tests before any migration apply or release discussion. Reconcile existing migration-history drift before a permanent hosted apply. Preserve V211.


## Seconds settlement and multi-position database audit — 2026-11-06

- Re-read this coordination document before the batch (blob `126acb29fcb16061f679b62ef794498637d76350`) and re-confirmed feature branch HEAD `4710df3a23008c0947912793204fe511661ff633`.
- Supabase live read-only verification: `seconds_contract_positions` contains 0 rows / 0 open rows. The partial unique index `seconds_contract_positions_one_open_per_user_idx` is still present and is the direct one-open-position restriction. Other independent unique indexes remain present: primary key `position_id`, `open_request_id`, `open_operation_id`, `settle_request_id`, and `settle_operation_id`. No DDL or financial writes were executed.
- Live `submit_seconds_order_v1` definition confirms the account-row `SELECT ... FOR UPDATE` lock is present and ledger debit/frozen credit plus position insert occur in one transaction. It still validates durations as 30/60/300/900 and catches the single-open index violation as `OPEN_POSITION_EXISTS`. Dropping only the partial index removes the per-user open-count cap; the existing row lock and independent unique constraints must remain.
- Live `read_seconds_positions_v1` aggregates every open row for the user without a per-user count limit; settled history is limited to 100.
- CRITICAL SOURCE OBSERVED: live `settle_seconds_position_v1` currently locks the exact `position_id` row and settles that position independently, but its already-settled branch is incorrect. It returns `duplicate:true, settled:true` for any later request ID; it only returns `IDEMPOTENCY_CONFLICT` when the incoming request ID equals the stored request ID but the request hash differs. This violates the previously agreed rule: only the same request ID + same hash may be an idempotent duplicate; a different request ID must return `POSITION_ALREADY_SETTLED`. The API currently forwards `result.duplicate` and does not map a database `POSITION_ALREADY_SETTLED` code. This must be fixed in a forward migration and API regression test before multi-position settlement is considered safe.
- The live settlement function uses the per-position row lock plus the USDT account row `FOR UPDATE`; this is compatible with multiple independent positions provided the already-settled/idempotency branch is corrected. It currently hard-codes winning PnL to 85%; this remains a separate backend policy-config requirement.
- Live migration history still contains only `20261102133555` and `20261103062716`. This does not match the source branch's SQL files 0014/0015/0023 and the live Seconds objects; migration-history reconciliation is a release blocker and must not be guessed or repaired by inserting history rows blindly.
- Environment attempt: Vercel v2 and v3 sandbox creation both returned HTTP 400 `bad_request`; no session or sandbox exists. Stop repeating the same sandbox API without a changed authorization/configuration path. No project terminal was obtained, so the Supabase CLI test suite remains NOT RUN and no migration was generated.
- Supabase CLI changelog refreshed: v3 (released 2026-11-02; changelog entry 2026-11-04) defaults database commands to local, requires explicit `--remote` for hosted targets, and asks for confirmation before hosted mutations. Official migration guide confirms this. References: https://supabase.com/changelog/supabase-cli-v3 and https://supabase.com/docs/guides/local-development/cli/migrating-to-v3.
- No source code, test, migration, production schema, deployment, or merge changed in this batch. The previous `settle_at` API forwarding fix remains in source but its regression test is still NOT RUN. Feature branch remains 24 ahead / 0 behind main.
- NEXT IMPLEMENTATION ORDER: (1) obtain a working local/non-deploying CLI environment; (2) generate a forward migration using `supabase migration new`; (3) in that migration drop only `seconds_contract_positions_one_open_per_user_idx` and replace `settle_seconds_position_v1` so same request ID + same hash returns duplicate, same ID + different hash returns `IDEMPOTENCY_CONFLICT`, and any different request ID on an already-settled position returns `POSITION_ALREADY_SETTLED`; (4) update API error mapping and add tests for all three cases; (5) run Node tests and isolated database concurrency/independent-settlement tests. Keep all account/ledger/idempotency locks and constraints. Reconcile migration history before any hosted apply. Do not merge/deploy or change V211.


## Seconds settlement idempotency and unlimited open-position repair candidate — 2026-11-06

### SOURCE OBSERVED / IMPLEMENTED IN FEATURE BRANCH
- Re-read this coordination entry before implementation. The active BTCBOX feature branch is `fix/manual-withdrawal-rpc-compat-20261106`; its latest remote head after this batch is `40f1d0aaf8bbd8a36be82fa2040fce58f8100fb3`. Compare against main `18a354a9e8e1d0365e240c7c44eda4a18d62ce07`: 30 ahead / 0 behind. No merge or deployment.
- Created the forward migration using Supabase CLI v3 `supabase migration new seconds_unlimited_open_positions_and_settlement_idempotency_v1`; generated timestamp: `20261106041624`. The timestamped migration is in `backend/supabase/migrations/`. An identical numbered mirror `backend/supabase/sql/0024_seconds_unlimited_open_positions_and_settlement_idempotency_v1.sql` keeps the existing local/docker SQL runner sequence continuous.
- The migration drops only `public.seconds_contract_positions_one_open_per_user_idx`. It does not delete or rewrite positions and does not remove the independent position/request/operation/ledger uniqueness constraints.
- The replacement `settle_seconds_position_v1` now returns duplicate success only for the same settled position + same request ID + same request hash; same request ID with a different hash returns `IDEMPOTENCY_CONFLICT`; a different request ID against an already-settled position returns `POSITION_ALREADY_SETTLED`.
- The settlement function retains the position-row `FOR UPDATE` lock, USDT account-row `FOR UPDATE` lock, atomic financial operation/ledger writes, and existing settlement calculation. The 85% calculation remains hard-coded and is explicitly queued for the policy-configuration batch; this migration does not claim to implement configurable payout rates.
- `backend/api-core.js` now preserves settlement business error codes and maps idempotency/already-settled conflicts to HTTP 409 rather than collapsing them into `FINANCIAL_RPC_FAILED`.
- Source audit confirms `GET /api/seconds/positions` returns the full `open[]` result and `assets/js/views-trading.js` renders the open array with `list.map`; no single-open frontend truncation was found.
- Added regression tests for migration semantics, preservation of locks/unique guards, API error mapping, and full open-array rendering.

### TEST EVIDENCE
- Ran `cd backend && npm test` in a non-deploying Vercel sandbox on the edited source: **92 tests passed, 0 failed**.
- Ran the focused Seconds tests: **8 passed, 0 failed**.
- Ran `python3 scripts/check_migration_status.py --offline`: numbered SQL migrations are continuous from 0001 through 0024.
- Ran `git diff --check`: no whitespace errors.
- After the code was committed to the feature branch through GitHub, verified the remote Git blob SHA matches the exact locally tested content for all six implementation/test files:
  - `backend/api-core.js`: `4caa953083a73e715e8257d98698f61466a0e3f4`
  - timestamped migration: `ea1856b7e6c9006de5a6a718373f81d56d2724aa`
  - numbered SQL mirror: `ea1856b7e6c9006de5a6a718373f81d56d2724aa`
  - migration-order doc: `472d839de7f4e2d5ee5a78e5359ae75cedb283c4`
  - migration regression test: `23095feff252fe3e590af452cd709c25610509c6`
  - settlement/API/open-array regression test: `d2717e7ae8f717c6294c64212b6da54376507cda`
- GitHub workflow lookup for latest feature commit returned no PR-triggered workflow runs. Do not describe this as GitHub CI passing.

### NOT VERIFIED / RELEASE BLOCKERS
- Sandbox has no Docker or `psql`; local PostgreSQL execution, PL/pgSQL compilation, isolated concurrent multi-position submissions, concurrent per-position settlement, and balance/ledger invariant tests were NOT RUN.
- Live Supabase project `zlozsutefnmgwwzrlipt` was only queried read-only. No migration was applied, no financial write was run, and no deployment or merge occurred. The live single-open-position partial unique index therefore remains active; multiple open positions are NOT yet enabled in the hosted database.
- Live migration history still contains only `20261102133555` and `20261103062716` while the live schema contains older financial/Seconds objects. Migration-history drift remains unresolved. Do not run hosted `db push`, `apply_migration`, or `migration repair` until each existing SQL migration is reconciled against actual schema effects.
- Supabase CLI v3 defaults database commands to local; hosted targeting requires explicit `--remote` and hosted mutations require confirmation. References: https://supabase.com/changelog/supabase-cli-v3 and https://supabase.com/docs/guides/local-development/cli/migrating-to-v3.

### NEXT BATCH
1. Build the small, backend-authoritative Seconds policy settings surface in admin: enabled state, allowed durations, min/max order amount, and configurable payout/profit ratio with 85% as the minimum. Avoid unnecessary UID/asset/manual fields.
2. Persist policy version and the effective duration/amount/payout terms onto each newly opened position; later admin changes must not alter in-flight positions. No preset outcomes or client-side settlement authority.
3. Add an admin read-only queue for all open Seconds positions; verify pagination/visibility for multiple positions. Existing user-facing open-array rendering is already present.
4. Add isolated PostgreSQL tests for multiple concurrent positions, same/different open request IDs, per-position settlement idempotency, concurrent balance locking, and no duplicate ledger postings.
5. Reconcile migration-history drift before any hosted migration application. No production DDL, real financial writes, merge, or deployment without explicit approval. Preserve V211 trading layout.


## Seconds configurable policy, immutable payout snapshots, and independent multi-position UI — 2026-11-06

### SOURCE OBSERVED / IMPLEMENTED
- This entry supersedes the earlier feature-head reference `40f1d0aaf8bbd8a36be82fa2040fce58f8100fb3`. Current feature branch: `fix/manual-withdrawal-rpc-compat-20261106`, HEAD `3ad91a456f6f5bee3d190efd0bbc66e8637519d9`. Compared with main `18a354a9e8e1d0365e240c7c44eda4a18d62ce07`: 32 ahead / 0 behind. No merge or deployment.
- Generated the next timestamped migration using Supabase CLI `supabase migration new seconds_policy_snapshot_and_admin_queue_v1`: `20261106042714_seconds_policy_snapshot_and_admin_queue_v1.sql`. Added the identical numbered runner copy `0025_seconds_policy_snapshot_and_admin_queue_v1.sql`; migration numbering is now continuous through 0025.
- Added `public.seconds_contract_policy` with administrator-editable enabled state, unique allowed durations, min/max USDT order amount, and payout rate. Defaults are 30/60/300/900 seconds, min 1 USDT, max 1e12 USDT, payout 0.85. The DB/API enforce payout >= 0.85 (85%); no hard-coded upper payout ceiling is imposed beyond the numeric column's precision.
- Replaced the order RPC to lock/read one coherent policy version (`FOR SHARE`), validate enabled/duration/amount server-side, preserve the account `FOR UPDATE` lock and atomic operation/ledger writes, and snapshot `policy_version` + `payout_rate` on each new position. Existing `duration_sec` and `amount` fields preserve the effective terms selected for that position.
- Replaced the settlement RPC to calculate winning PnL from the position's stored `payout_rate`, not the latest administrator setting. A policy change therefore affects new positions only.
- Added server-side policy read/update RPCs, an admin-only policy API, and a read-only paginated admin open-position queue RPC/API. Policy table RLS is enabled; table access and function execution are limited to `service_role`, called only from server-side API routes behind the existing admin authentication gate.
- User seconds UI now fetches backend policy, renders admin-selected durations and amount bounds, and fails closed if policy is unavailable or the global financial-write gate is off. The hard-coded one-open-position UI gate and obsolete one-open rule text were removed. Confirmed open positions can coexist; a single unresolved request ID still blocks duplicate submissions until reconciled.
- Replaced the single countdown with independent per-position countdown labels and per-position settlement locks/attempt tracking. The admin queue shows all open positions with pagination; a failed queue read is explicitly shown as unavailable rather than falsely displaying zero orders.
- Seconds order amount is now carried as a validated decimal string from the UI through the API to the numeric RPC parameter, avoiding JS floating-point serialization changes and allowing the database policy to be authoritative for the max amount.
- No changes to the V211 spot trading page layout.

### TEST / SOURCE EVIDENCE
- Exact tested feature HEAD: `3ad91a456f6f5bee3d190efd0bbc66e8637519d9`.
- `cd backend && npm test`: **101 passed, 0 failed**.
- `npm run build`: passed; public build created in local `dist/` only, generated artifacts restored afterward.
- `node --check` passed for `api-core.js`, `assets/js/app-core.js`, `assets/js/views-account.js`, and `assets/js/views-trading.js`.
- `python3 scripts/check_migration_status.py --offline`: migration numbering continuous through 0025.
- `git diff --check`: passed; working tree clean.
- Remote Git blob IDs match the exact tested local files:
  - `backend/api-core.js`: `91acaf19944642cc3023ff9ea59aa3865ca72ac7`
  - `backend/assets/js/app-core.js`: `c4406077df08029d876e56d5fee1dd8005c22e7d`
  - `backend/assets/js/views-account.js`: `670b8bf6df3ebba715840f9a5b3dd90881771b33`
  - `backend/assets/js/views-trading.js`: `ad63fafcecf5748cc5525d5586405fce7bd56d9c`
  - timestamped migration and numbered mirror: `b071d0f30275d9a4f39605628042020338b21ebe`
  - migration-order document: `dadf667cfe95db41053d5a7a578135fde2bcd5bd`
  - policy regression tests: `9ebd6c0c6af7a097954868807f2e0c757dfed0da`
- GitHub combined status contained no checks and workflow-run lookup returned no runs. Do not describe this as GitHub CI passing.

### LIVE DATABASE / RELEASE BLOCKERS
- Read-only live query on project `zlozsutefnmgwwzrlipt` confirms `seconds_contract_policy` does NOT exist yet, and `seconds_contract_positions_one_open_per_user_idx` still exists. Live migration history still contains only `20261102133555` and `20261103062716`.
- No production DDL, migration application, financial write, merge, or deployment was performed. Multi-position ordering and configurable policy are implemented in the feature branch only; they are NOT active in the hosted database.
- Sandbox still has neither Docker nor `psql`. PostgreSQL compilation, migration execution, concurrent multi-position open/settlement, account/ledger invariants, and live end-to-end tests were NOT run.
- Migration-history drift remains a release blocker. Do not use hosted `db push`, `migration repair`, or `apply_migration` until every pre-existing SQL migration has been reconciled with the actual live schema and the user explicitly approves hosted application.

### NEXT BATCH
1. Obtain a non-production PostgreSQL/Supabase test environment or a working local runtime; execute and compile migrations 0024/0025 in sequence.
2. Add database integration/concurrency tests for multiple simultaneous opens by one user, different request IDs, same request ID retries, concurrent settlement of separate positions, same-position settlement idempotency, and exact available/frozen/ledger invariants.
3. Reconcile the two-row live migration history with existing live schema and repository migration contents without inserting fake history rows.
4. Only after integration evidence and explicit approval, plan the hosted migration cutover. No production DDL, real financial writes, merge, or deployment without approval. Preserve V211.


## Seconds policy / settlement source-to-live reconciliation — 2026-11-06

### SOURCE OBSERVED
- Re-fetched this coordination document before the batch. The feature branch remains `fix/manual-withdrawal-rpc-compat-20261106`, HEAD `3ad91a456f6f5bee3d190efd0bbc66e8637519d9`.
- Re-read migration `20261106042714_seconds_policy_snapshot_and_admin_queue_v1.sql` (blob `b071d0f30275d9a4f39605628042020338b21ebe`). Its `settle_seconds_position_v1` contains the agreed three-way settled-position behavior: same request ID + same hash => duplicate success; same ID + different hash => `IDEMPOTENCY_CONFLICT`; different ID => `POSITION_ALREADY_SETTLED`.
- The same migration's `submit_seconds_order_v1` checks existing `open_request_id`, rejects a hash/user mismatch, returns the original position for an exact retry, locks the policy row `FOR SHARE`, locks the USDT account `FOR UPDATE`, and writes operation/ledger/position in one transaction.
- `backend/api-core.js` (blob `91acaf19944642cc3023ff9ea59aa3865ca72ac7`) maps `POSITION_ALREADY_SETTLED` and `IDEMPOTENCY_CONFLICT` to HTTP 409.
- No new migration is needed for settlement idempotency; do not create a duplicate 0026 patch for behavior already present in 0025.

### LIVE DATABASE — READ ONLY
- Re-read migration history: only `20261102133555` and `20261103062716` are recorded.
- Re-queried live schema: `public.seconds_contract_policy` is absent; `seconds_contract_positions_one_open_per_user_idx` remains present; seconds positions total 0 and open positions 0.
- Fetched the actual live `settle_seconds_position_v1` definition. It still returns `duplicate:true` for every different request ID against an already-settled position, and its win calculation still hard-codes `0.85`. Therefore the 0025 source fix is NOT active in the hosted database.
- No production DDL, financial writes, migration application/repair, merge, or deployment occurred.

### NEXT
1. Obtain a legitimate non-production PostgreSQL execution environment before claiming PL/pgSQL compilation or concurrency verification. Do not create a paid Supabase branch without the required cost approval.
2. Run migration 0024 then 0025 against an isolated database and verify exact retry, hash conflict, different-request conflict, multiple simultaneous opens, independent concurrent settlement, and ledger/account invariants.
3. Reconcile the live two-row migration history against every pre-existing migration's actual schema effects before proposing any hosted cutover. Never fabricate migration history entries.
4. Keep the hosted multi-position feature and configurable payout policy marked NOT ACTIVE until a reviewed, approved migration is applied. Preserve V211; no merge or deployment.


## Further live-schema / migration provenance audit — 2026-11-06

### Environment discovery
- Re-read this coordination file at blob `84b9eab736fa44f8428a04d45755426966b71017` before continuing.
- Supabase account currently lists only production project `zlozsutefnmgwwzrlipt`; `list_branches` returns no development branches. No isolated PostgreSQL test target is currently available. No branch/project was created and no cost was incurred.
- Feature branch remains `fix/manual-withdrawal-rpc-compat-20261106`; no source-code commit was made in this batch.

### Migration provenance
- Current `backend/supabase/migrations/` contains only the timestamped 0024 and 0025 migrations:
  - `20261106041624_seconds_unlimited_open_positions_and_settlement_idempotency_v1.sql`
  - `20261106042714_seconds_policy_snapshot_and_admin_queue_v1.sql`
- The operational baseline `0001`–`0023` exists only in `backend/supabase/sql/` as numbered SQL scripts, not as timestamped CLI migrations in the current migrations directory. The migration order document describes those as ordered operational scripts and separately identifies 0024/0025 as timestamped CLI migrations.
- Live DB has the baseline operational tables/functions/indexes (including seconds contracts and the one-open-position index), which align with the numbered SQL baseline; it has no policy table and still has the pre-0024 index/function behavior.
- Live migration history has two records (`20261102133555`, `20261103062716`) whose timestamped files are not present in the current migrations directory. This is an orphaned/unmatched history situation; the present evidence does NOT establish which historical files were applied or whether their effects are still present. Do not mark them reverted/applied or synthesize missing files until provenance is recovered.
- The numbered SQL scripts 0001–0023 must not be replayed against the live database: their core objects already exist. Their presence explains why schema can exist without corresponding timestamped CLI history; it does not authorize reapplication.

### Live security posture — READ ONLY
- All 15 public base tables inspected have RLS enabled; none has FORCE RLS. The `private` backup tables are not in the exposed public schema.
- `pg_policies` returned no public/private policies. For public tables, the inspected table grants show service_role privileges only; no anon/authenticated table grants were returned. With RLS enabled and no policies, browser roles remain default-denied at the row-policy layer; service_role is the intended server-side access path.
- Two live triggers were observed: confirmed-deposit immutability and earn-position snapshot immutability.
- This was read-only inspection; no grants, policies, triggers, tables, functions, or indexes were changed.

### Next
1. Recover the provenance/content of the two orphaned timestamped history records from Git history or deployment artifacts before any history repair.
2. Keep 0001–0023 as a reviewed baseline, not an instruction to replay on the already-provisioned live database.
3. Find a no-cost isolated PostgreSQL execution path; the account currently has no Supabase dev branch. Do not create a paid branch/project without explicit cost acceptance.
4. Compile and execute 0024 then 0025 only in isolated PostgreSQL, run concurrency/idempotency and ledger invariants, then prepare—but do not execute—a production cutover plan.


### Additional live drift found — manual withdrawal payout completion
- Live `withdrawal_requests` columns currently stop at `review_operation_id`; the `payout_reference`, `payout_note`, `paid_by`, and `paid_at` columns required by numbered SQL 0023 are absent.
- Live function inventory does not contain `mark_withdrawal_paid_atomic`; the 0023 SQL also defines `read_withdrawal_history_v1`, which is absent from the live function inventory.
- Therefore the manually approved-then-record-paid withdrawal completion flow in source SQL 0023 is not active in the hosted DB either. Do not report manual payout completion as production-ready.
- SQL 0023 is a numbered operational script, not a timestamped file in `supabase/migrations/`; no production changes were made.


## Withdrawal migration and admin UI compatibility audit — 2026-11-06

### SOURCE OBSERVED
- Re-fetched the coordination branch before this batch. Its head is `daa3344d68f03ad329017f7c112132a653d9133d`; the feature branch remains `fix/manual-withdrawal-rpc-compat-20261106` at `3ad91a456f6f5bee3d190efd0bbc66e8637519d9`.
- The feature API already contains:
  - `POST /api/admin/withdraw/mark-paid`, which calls `mark_withdrawal_paid_atomic` after the manual transfer and requires the financial-write gate plus configured admin actor;
  - `GET /api/withdrawals`, which calls `read_withdrawal_history_v1`;
  - `GET /api/admin/withdrawals`, which calls `read_admin_withdrawal_snapshot_v1`;
  - `POST /api/admin/withdraw/approve` and `/reject`, which call `review_withdrawal_atomic`.
- The currently loaded BTCBOX SPA still registers `admin` as `Admin view loading…`; its `admin.html` shell has no payout/TxID form. The loaded `app-core.js` has no call to the manual mark-paid route or payout-reference UI. Thus the payout endpoint exists in backend source but is not wired into the active BTCBOX admin UI.
- A separate `admin-panel/` React application exists in the repository, but its withdrawal page is an older independent client using `js-api-client`, legacy statuses (`CREATED/DONE/REJECTED/CANCELED`), and a legacy accept/reject flow. It does not implement the current `approved -> manually transfer -> mark-paid with reference` contract. Do not treat it as integrated or reuse it without an explicit contract port and route/build ownership verification.
- `backend/scripts/run_migrations.sh` applies every numbered `backend/supabase/sql/0001_*.sql` … `0025_*.sql` in lexical order to the supplied DATABASE_URL; it is documented for local/test PostgreSQL only.
- Migration compatibility blocker found in source:
  - `0002_financial_ledger_v1.sql` creates `public.withdrawal_requests`.
  - `0003_financial_lifecycle_v2.sql` extends `public.withdrawal_requests` and defines its lifecycle RPCs.
  - `0022_withdrawal_admin_review_status_v1.sql` instead redefines `create_withdrawal_atomic` against `public.withdrawals` and columns `withdrawal_id/request_hash`, a different schema/contract. The current ordered migration document labels 0022 as part of the sequence but does not reconcile this mismatch.
  - `0023_withdrawal_manual_payout_completion_v1.sql` returns to `public.withdrawal_requests`, adds payout fields, and expects `financial_audit_log`.
- The numbered migration runner therefore cannot be assumed to execute cleanly end-to-end. Do not run it against production or staging until 0022's provenance and compatibility are resolved. Do not silently skip/rename 0022 or invent a replacement migration.
- Existing live read-only evidence from the prior batch remains: production lacks the four payout columns and the three payout/history functions; no live migration was applied in this batch. A new read-only SQL probe attempt was blocked before execution, so no new live state is claimed here.

### NOT VERIFIED / BLOCKERS
- Whether `public.withdrawals` exists in the current hosted database and whether 0022 was ever applied anywhere.
- Whether the 0022 file is an abandoned legacy script, an intended alternate schema, or a wrongly numbered migration.
- PostgreSQL compilation/execution of 0022/0023 and the full 0001–0025 chain; no isolated PostgreSQL runtime is available.
- Actual active admin UI integration, since the SPA admin route remains a placeholder.

### NEXT
1. Recover the origin/commit history of 0022 and compare it with 0002/0003, the current live schema, and the old backup branch. Establish whether 0022 is obsolete or needs a safe forward correction; preserve its history as evidence.
2. Reconcile the migration-order document and runner so there is one explicitly validated, dependency-correct path. Do not replay 0001–0023 on the hosted database.
3. Port the manual payout action into the actual BTCBOX admin SPA only after confirming the permitted file ownership and route contract; show approved withdrawals, destination/asset/amount, manual transfer status, required TxID/reference, note, loading/error/success, and duplicate-safe refresh. Keep imported legacy admin-panel code out of the runtime unless deliberately integrated.
4. Obtain a no-cost isolated PostgreSQL execution path, then execute/compile the relevant migrations and test approve/reject/refund, manual payout completion, same-reference retry, conflicting-reference rejection, and audit-log invariants.
5. Keep production unchanged; no apply_migration, migration repair, db push, financial writes, merge, or deployment without explicit approval.


## Audit correction 2026-11-06
The prior withdrawal UI audit statement claiming the active BTCBOX admin route was only a placeholder was incorrect. On feature branch fix/manual-withdrawal-rpc-compat-20261106, backend/assets/js/views-account.js contains the admin withdrawal queue and a manual paid-completion modal; backend/assets/js/app-core.js calls the mark-paid API and backend/api-core.js calls mark_withdrawal_paid_atomic. The modal currently labels TxID/reference as optional, so it does not yet enforce the user's desired transfer-reference recording. Keep the separate admin-panel React app classified as legacy and not evidence of the active SPA. The database blocker remains: live production was previously observed missing payout columns and payout/history RPCs. No database or deployment change was made in this audit.


## Manual withdrawal TxID requirement — 2026-11-06

### SOURCE OBSERVED / IMPLEMENTED
- Feature branch: `fix/manual-withdrawal-rpc-compat-20261106`; latest commit: `e4c1bdb284a5228b38157e31ea82b698156ffd00`.
- Active BTCBOX SPA manual payout modal now labels TxID/reference as required, prevents blank submission, and keeps the modal open with focus returned to the field when empty.
- `POST /api/admin/withdraw/mark-paid` rejects a blank trimmed reference with `PAYOUT_REFERENCE_REQUIRED`; the existing 160-character limit remains.
- Numbered operational SQL `0023_withdrawal_manual_payout_completion_v1.sql` independently rejects blank references inside `mark_withdrawal_paid_atomic`.
- The existing approved-only completion, exact same-reference duplicate response, conflicting-reference rejection, and audit-log record remain unchanged. This records a staff-completed external transfer; it does not initiate a blockchain transfer or create a second debit.
- Added `backend/tests/withdrawal-manual-payout.test.js` with four source regression checks.

### VERIFICATION / NOT VERIFIED
- SOURCE OBSERVED: all four changed paths are present on the feature branch; the latest commit is the regression-test addition above.
- NOT VERIFIED: Node test suite execution, PostgreSQL compilation/integration, hosted database application, and production UI behavior. GitHub combined status returned no checks and workflow-run lookup returned no runs for the latest commit.
- No production database write, migration application/repair, merge, or deployment occurred. The hosted database still must be treated as missing the payout columns/RPCs until a fresh read-only check proves otherwise.

### NEXT
- Run the backend test suite and syntax checks in an isolated runtime. Then resolve the numbered migration baseline compatibility before planning any hosted database change. Keep the manual workflow simple and preserve V211.


## BTCBOX v33 — simple manual deposit workflow coordination (2026-11-06)

- User-approved behavior is intentionally simple: configure receiving address/network in admin; user transfers; staff verifies receipt manually; staff selects the user and matching asset row and enters the received amount for audited atomic credit.
- No user-created pending deposit order, chain watcher, automated credit, or extra approval stage is requested. UID and coin must be auto-bound from the selected user and asset row.
- Source audit on `avali9308-code/btcbox-v33` branch `fix/manual-withdrawal-rpc-compat-20261106`: backend `GET/POST /api/admin/config` exists and validates configured addresses, but the active Admin Console has no address configuration tab/form. Deposit page supports USDT/BTC/ETH/SOL/BNB/USDC while manual-credit UI/API only support USDT/BTC/ETH/SOL; `safeDepositAddresses()` also omits BNB/USDC.
- Implementation handoff: https://github.com/avali9308-code/btcbox-v33/issues/2
- The existing manual credit atomic RPC/idempotency/audit path must remain the only balance-credit path. Existing financial cutover gate must not be bypassed. No financial flags, DB schema/data, merge, or deployment changed.
- AI 3 updated BTCBOX v33 coordination/task-board docs in commits `0c8a760b4a6032f81c67e116fdae3901f744e7f3` and `5d397664990be07bb0f80e7fd6a4ac523f505db4`. This is a coordination handoff, not implementation or QA acceptance.


## BTCBOX V33 — manual deposit configuration batch — 2026-11-06

- The latest V33 feature branch source HEAD after this batch is `c82c07acad6df6e3bdc83de9f8be2b29bbade790` (subsequent coordination-document commits may advance it). The implementation adds an Admin Console deposit-address tab, uses existing authenticated admin config GET/POST, supports all eight configured network keys, and aligns manual-credit account rows/API validation with six assets (USDT/BTC/ETH/SOL/BNB/USDC).
- Explicit blank address values now clear/deactivate a known network; unknown network keys and malformed nonblank addresses remain rejected. User deposit flow remains manual verification/manual credit; no pending deposit orders or chain automation.
- Manual credit remains behind the financial cutover gate and atomic ledger RPC with idempotency/audit. No production DB writes, migration application, flag changes, merge or deployment.
- Five regression tests were added. A source-level audit passed 10/10 targeted assertions; Node tests/build/browser/isolated PostgreSQL were NOT RUN. GitHub Actions lookup for implementation SHA returned zero runs and no combined status contexts. Issue #2 remains open until executable test and independent review evidence is available.


## BTCBOX V33 — migration chain finding — 2026-11-06

- Issue #3: https://github.com/avali9308-code/btcbox-v33/issues/3. Source inspection found numbered migration 0022 references `public.withdrawals`, while 0002/0003 establish `public.withdrawal_requests` and 0023 uses `public.withdrawal_requests`. The numbered runner executes all these files in order.
- Classification: SOURCE OBSERVED; PostgreSQL runtime failure NOT REPRODUCED. Keep production DB untouched; do not skip/renumber migrations. Resolve against canonical schema and prove the full sequence in isolated PostgreSQL before cutover.


## BTCBOX V33 — withdrawal migration 0022 reconciliation — 2026-11-06

- Issue #3: https://github.com/avali9308-code/btcbox-v33/issues/3. Provenance checked: 0022 first appears in archive-extraction commit `05da31097802d012aa79b2976386ddce5f92757c` and is absent from its parent. No prior file history exists in this repo.
- Source resolution: 0002/0003 establish canonical `withdrawal_requests` and the single pending -> approved/rejected manual review flow. The active API calls the canonical nine-argument RPC; every withdrawal is manually reviewed. 0023 adds manual payout completion on that same table.
- 0022 now acts as an explicit compatibility checkpoint; it verifies the canonical table/status column and does not create a parallel schema, RPC overload, or second review state. It remains in the numbered runner sequence. Regression test file added; static source audit 12/12 passed.
- NOT RUN: Node tests/build or PostgreSQL runtime/full migration chain. No production DB writes, migration apply, financial flag changes, merge or deployment. Keep Issue #3 open until isolated runtime proof is obtained.


## BTCBOX audit migration simplification — 2026-11-06

- SOURCE OBSERVED: `backend/supabase/sql/0002_financial_ledger_v1.sql` is the single canonical creator of `public.financial_audit_log`; `0003`, `0004`, `0005`, `0006`, `0007`, and `0016` write using that canonical column contract.
- SOURCE OBSERVED: `0021_admin_audit_log_append_only_v1.sql` now validates the canonical table and applies RLS, service-role append-only grants, mutation-blocking triggers, and the existing `append_admin_audit_log` RPC contract. No second audit table is needed.
- FIXED IN SOURCE: marked `backend/supabase-migration-runner.sql` as deprecated/historical and explicitly prohibited execution. Its old instructions contradicted the current fail-closed financial flags and its aggregate SQL predates current numbered migration fixes.
- Canonical SQL source remains `backend/supabase/sql/NNNN_*.sql`; the numbered local/test runner is `backend/scripts/run_migrations.sh` and must only use an isolated local/test `DATABASE_URL`.
- NOT VERIFIED: PostgreSQL syntax/runtime, trigger behavior, role grants, complete numbered migration chain, Node tests/build. No hosted DB operation was performed.
- NO production table drop/recreate, production write, financial flag change, merge, or deployment. Preserve production schema and records.


## Migration channel audit — 2026-11-06

- SOURCE OBSERVED: the complete operational schema is in `backend/supabase/sql/NNNN_*.sql`; the local/test runner is `backend/scripts/run_migrations.sh`.
- SOURCE OBSERVED: `backend/supabase/migrations/` currently contains only timestamped 0024 and 0025 mirrors. Both files are byte-for-byte identical to numbered 0024 and 0025; they do not contain the base ledger, account, deposit, withdrawal, or audit schema and are NOT a complete empty-database bootstrap.
- SOURCE OBSERVED (read-only hosted migration-history query): the connected Supabase project reports versions `20261102133555` (`revoke_public_execute_rls_auto_enable`) and `20261103062716` (`create_private_btcbox_test_cleanup_backup`). Their matching timestamped migration files are absent from the current feature branch. This is migration-history drift; it is not permission to repair or replay history.
- DECISION: do not mix the numbered runner and Supabase CLI timestamped path. Do not run `db push`, `migration repair`, `db reset`, or apply SQL to the hosted project. Resolve one canonical bootstrap strategy and map the two hosted history entries before any hosted change.
- Supabase CLI v3 changed database commands to local-by-default and requires explicit remote targeting/confirmation for hosted changes; scripts must be reviewed before use.
- NOT VERIFIED: complete isolated PostgreSQL bootstrap, hosted schema equivalence, whether the two recorded hosted migrations have side effects beyond their names, and any safe repair sequence.
- No hosted database writes, migration apply/repair, reset, financial flag changes, merge, or deployment were performed.


## Operational migration runner boundary — 2026-11-06

- SOURCE OBSERVED: `0017_financial_migration_staging_v5.sql` creates a legacy quarantine table explicitly intended only for a dedicated staging project. `0018`–`0020` are read-only staging/ledger reconciliation diagnostics, not operational schema migrations.
- FIXED IN SOURCE: `backend/scripts/run_migrations.sh` now explicitly skips files 0017–0020 and applies only operational numbered migrations. The SQL files remain in the repository for the separate staging workflow; none were deleted.
- Updated the migration-order guide, Vercel deployment instructions, and pre-release checklist so the staging-only scripts are not represented as routine operational migrations.
- Added `backend/tests/migration-runner-boundaries.test.js` to guard the skip boundary and ensure the diagnostic scripts remain read-only.
- NOT VERIFIED: shell execution against PostgreSQL, full operational migration chain, staging import/reconciliation, Node tests/build. No production DB write, migration repair/apply, financial flag change, merge, or deployment.


## 2026-11-06 integration batch: delegated administrator authentication

- Working branch: `integration/btcbox-next-batch-20261106`, created from the current `main` after PR #26 was merged.
- Source-observed baseline: the React Supabase Auth provider already contains Ethereum/Solana wallet identity and account-linking flows; the web3 branch's auth provider and account security page are byte-identical to current main. Do not copy these again.
- Source-observed gap: `backend/api-core.js` still protects all `/api/admin/*` routes with shared Basic Auth, while `backend/admin-auth.js`, `backend/admin-rbac.js`, and the private membership schema existed but were not wired into the API.
- Implemented on this branch: Supabase Auth token verification followed by server-side membership lookup; route-to-permission enforcement for all current admin endpoints; service-role-only public RPC bridge that keeps the underlying `private` schema unexposed; unit tests for membership verification and fail-closed behavior.
- Legacy Basic Auth remains as a compatibility path until the existing admin console is migrated to Supabase Auth; it does not receive delegated-role permission checks. Remove it after the admin UI migration is complete.
- No database was reset or written, no production deployment was triggered, and no financial operations were executed.
- Validation pending: backend CI and frontend CI on the PR head; independent route-level QA and a fresh-schema dry run remain not verified.


## 2026-11-06 integration batch: remove the obsolete Seconds one-open rule

- Source-observed conflict: the active Seconds policy RPC still mapped a per-user partial unique index to `OPEN_POSITION_EXISTS`, and the repository retained both numbered and duplicate one-open-position SQL artifacts plus a test that required the restriction.
- Removed the obsolete single-open SQL artifacts and their contradictory test; removed the archived concatenated one-shot migration runner to prevent accidental reuse of stale schema instructions.
- Updated the active Seconds policy/order RPC so unique violations are treated only as request/idempotency conflicts; no per-user open-position uniqueness rule remains. The backend policy's optional `per_user_open_exposure` remains the configurable risk boundary, not an order-count limit.
- Updated settlement dependency notes so the Seconds settlement idempotency SQL depends on the core Seconds schema, not the retired single-open rule.
- Added `seconds-unlimited-open-positions.test.js` to guard the intended behavior and the complete open-position array response.
- No database was reset or written. The fresh empty-database schema is still a separate deliverable; do not apply old numbered migrations as a prerequisite.


## CI correction for unlimited Seconds positions batch

- The first PR #29 CI run failed because several existing tests still imported the retired `0015` SQL artifact, the migration checker treated retired sequence 15 as a missing file, and the isolated API harness did not map the new admin helper imports.
- Updated the Seconds server-authoritative test to validate the current policy RPC in `0025`, marked sequence 15 as intentionally retired in the static checker, aligned the settlement prerequisite wording, and synchronized the isolated API test harness with the admin helper imports.
- These are test/validation corrections only; no database operation or production change was performed. CI must rerun on the new exact PR head before merge.


## 2026-11-06 integration batch: React Seconds order entry and server policy read

- Added a service-role-only `read_active_seconds_policy_v1` RPC. The private policy tables remain unavailable to browser roles.
- Added authenticated `GET /api/seconds/policy`, which validates the active symbols, durations, stake bounds, payout floor, and optional exposure limit, and returns the backend financial-cutover state.
- Added typed frontend clients for active policy, order submission, and settlement.
- Replaced the React Seconds read-only placeholder with policy-driven order entry. A request ID and exact payload are persisted per authenticated user; an unresolved request can only be retried with the same ID and payload until the positions endpoint confirms it.
- Each open position displays its own remaining time. At maturity, the client asks the server to settle that specific position with a deterministic idempotency key; the server still samples the trusted reference price and applies the ledger transaction.
- The page renders every open position and settled history row; no per-user order-count cap was introduced. Backend policy may still set an aggregate exposure boundary.
- Financial writes remain disabled unless the existing backend cutover switch is enabled. No database was reset or written and no live financial operation or deployment was executed.
- Validation pending: frontend build, backend tests, and independent browser QA on the exact PR head.


## 2026-11-07 — 2号 AI frontend/admin integration follow-up

- Role: 2号 AI — Web App + Admin Panel owner. This batch is a dependent follow-up to Draft PR #50, not a replacement for it.
- Repository: `avali9308-code/btcboxcdt`.
- The previously mandated branch `work/btcbox-unified-20261104` was absent from the current GitHub branch inventory. It was recreated from the exact integration baseline `73367233a5f4d37e828cb124f03f3eff84a10a2c`, which compares identical to `fix/post-merge-db-bootstrap-seconds-20261106`. No old branch was deleted.
- SOURCE OBSERVED: PR #50 remains Draft and targets `main`; the parent integration branch contains the deposit snapshot/history, manual-credit ledger RPC, admin RBAC, withdrawal lifecycle, KYC/support workflows and the latest three passing CI runs attached to commit `73367233a5f4d37e828cb124f03f3eff84a10a2c`.
- SOURCE OBSERVED: customer `GET /api/orders` and administrator `GET /api/admin/orders` both use `financial_matching_orders` when matching-engine mode is requested, and both fail closed when that requested cutover is unavailable. Legacy state reads are an explicit fallback only when matching-engine mode is not requested.
- GAP FOUND: the admin audit endpoint previously selected canonical PostgreSQL audit reads only from `ADMIN_AUDIT_POSTGRES_READS_ENABLED`. Normalized financial reads could therefore be enabled while the audit UI still read the retention-limited state document, hiding PostgreSQL ledger events from the admin audit view.
- FIXED IN SOURCE: canonical audit reads are now also required whenever `financialPostgresReadsEnabled()` is true. Database audit read failures return 503; the route does not silently fall back to the state document.
- FIXED IN SOURCE: administrator withdrawal rejection and KYC rejection no longer use native `window.prompt`. Both use a centered, accessible in-app modal with a required reason, bounded to 300 characters; approval/rejection request behavior and existing financial cutover guards are unchanged.
- TESTS ADDED: regression coverage for custom rejection dialogs, manual-credit consistency across PostgreSQL ledger/deposit/audit writes and admin balance refresh, and customer/admin spot-order source parity. Existing PostgreSQL lifecycle assertions remain the database-level evidence for deposit history and idempotent retry.
- NOT VERIFIED: new branch CI, exact-head frontend build, Node tests, and independent browser QA are pending. The new changes are source-observed only until exact-head checks complete.
- SAFETY: no hosted database reads/writes were initiated in this batch; no financial operation, merge to `main`, production deployment, secret/config change, or financial cutover flag change was performed.
- NEXT: run Backend, PostgreSQL schema and Frontend CI on the dependent draft PR; review exact-head results; then continue checking whether every audited admin mutation has a matching canonical event and whether the admin/user views expose the same confirmed financial state.


### 2026-11-07 verification addendum — exact-head audit

- Latest tested application-code head: `6b82683a2436ccff6b4a23ebb68bd911fe9de43c`. The subsequent coordination-document commit is documentation-only and does not change tested application code.
- Additional gap found: the canonical audit reader selected only actor/action/reason and omitted `object_type`, `object_id`, and financial `metadata`. The admin UI therefore could not show amount, asset, receipt/TxID, or operation identifiers even when the database held them.
- FIXED IN SOURCE: canonical audit reads now select object identity and metadata, then render only an explicit allowlist (`asset`, `amount`, `fee`, `network`, `reference`, `payout_reference`, `operation_id`, `idempotency_key`, order fields). Raw metadata, wallet destinations, email addresses, and unknown keys are not returned. The audit UI now displays whether the source is PostgreSQL canonical, state-file retention-limited, or unknown.
- FIXED IN SOURCE: wallet redaction now matches an exact 40-hex Ethereum address, not the first 40 characters of a 64-hex transaction hash. Wallet addresses remain masked; full transaction hashes can be displayed as audit references.
- Additional refresh audit found one more false-failure path in delegated administrator membership changes. The membership mutation is now confirmed separately from the subsequent list refresh; refresh failure no longer reports that the membership mutation itself failed.
- EXACT-HEAD BACKEND CI: run `42281250727`, success. Build, 356 Node tests (356 passed / 0 failed), fail-closed preflight, and output/entrypoint checks all passed.
- EXACT-HEAD FRONTEND CI: run `42281250684`, success. Lint, Vite build, Chromium installation, and desktop/mobile route smoke tests all passed.

- Additional integration improvement: the Admin Panel Orders tab now displays whether its rows come from canonical PostgreSQL matching orders or the explicit legacy-state fallback. The customer and administrator order routes are covered by a source-parity regression test.
- POSTGRESQL EMPTY-DATABASE CI: run `42268516996`, success on the parent integration baseline `73367233a5f4d37e828cb124f03f3eff84a10a2c`. This follow-up changes no SQL migration or PostgreSQL bootstrap file, so the schema suite was not duplicated on the child PR.
- Parent PR #50 description still states `21dacf90fac3b48bf461707da1442ca35afbc95f` as its exact head, while its implementation branch currently resolves to `73367233a5f4d37e828cb124f03f3eff84a10a2c` (the base SHA of PR #51). Treat the SHA in PR #50's description as stale until its owner updates it.
- PR #51: Draft, open, based on `fix/post-merge-db-bootstrap-seconds-20261106`; no merge to `main`. PR #50 remains Draft.
- Vercel status on the child PR reports `build-rate-limit` / upgrade-to-Pro. This is a hosting preview/build-rate-limit status, not a GitHub Actions test failure. No production deployment or financial operation was initiated.
- NEXT: independent review of the updated audit metadata allowlist and permissions; confirm runtime configuration uses canonical financial reads before treating the audit list as complete; then continue Web App/Admin Panel integration against the same parent baseline.


### 2026-11-07 — next batch: admin user financial history and adjustment guard

- Role: 2号 AI — Web App + Admin Panel. Dependent follow-up remains Draft PR #51 against parent PR #50's exact implementation head `73367233a5f4d37e828cb124f03f3eff84a10a2c`.
- Additional source audit found the Admin user detail endpoint cloned the legacy user record and only removed credentials/KYC secrets. That broad `users.read` projection could also carry raw deposit, withdrawal, Earn and support-message arrays.
- FIXED IN SOURCE: remove raw `deposits`, `withdrawals`, `earn_records`, and `support_messages` from the generic user-detail projection. When normalized financial reads are enabled, the backend reuses the canonical `read_financial_account_snapshot_v1` RPC for balances and history. Deposit history is projected only when the verified membership also has `deposits.read`; withdrawal history only with `withdrawals.read`. When normalized reads are disabled, permitted histories are explicitly marked `legacy_state_retention_limited`.
- FIXED IN SOURCE: Admin user detail UI displays deposit asset/network, amount, status, TxID/receipt reference and time, with an explicit PostgreSQL versus retention-limited legacy source label. The view is hidden without `deposits.read`.
- FINANCIAL CONTROL GAP: permission `financial_adjustment.request` was mapped to `admin_adjustment_atomic`, which applies an immediate ledger mutation and has no approval queue. This conflicts with the permission's "request" semantics and lacks maker-checker control.
- SAFETY FIX: the direct `POST /api/admin/user/balance` endpoint now fails closed with `FINANCIAL_ADJUSTMENT_APPROVAL_REQUIRED` before any mutation until a dual-approval workflow is implemented. The misleading permission option was removed from the Admin role editor. The existing verified manual-deposit RPC path is unchanged. Do not re-enable this endpoint by changing only a feature flag.
- REGRESSION TESTS: added `backend/tests/admin-user-financial-history.test.js` for permission-scoped projections, legacy-array non-disclosure, UI source labels; extended `manual-deposit-reference.test.js` and `admin-route-permissions.test.js` for snapshot reuse and adjustment guard.
- EXACT-HEAD APPLICATION SHA: `e5f81fc535383b97ad2cea311deeb58c125d01c8`.
- BACKEND CI run `42285954538`: success; 362 tests passed, 0 failed; unified build, fail-closed preflight, output/entrypoint checks passed.
- FRONTEND CI run `42285954504`: success; lint, Vite build, Chromium install and 20/20 desktop/mobile route smoke tests passed.
- PostgreSQL schema CI was not rerun because this batch changes no SQL migration/bootstrap files. Parent baseline `73367233a5f4d37e828cb124f03f3eff84a10a2c` previously passed empty-database PostgreSQL CI run `42268516996`. A fresh database-level rerun remains a release gate after any future SQL changes.
- Vercel check remains `build-rate-limit`; no deployment was initiated. No hosted database operation, real funds operation, financial cutover change, merge, or production deployment occurred.
- NEXT: independently review the new user-detail field projection against every Admin role; verify Super Admin bootstrap and delegated-role provisioning in a disposable Supabase project; test real Supabase Auth/RBAC and private KYC Storage on staging; continue order/ledger reconciliation and complete a full browser workflow with a disposable account before any release decision.


### 2026-11-07 — next batch: live spot refresh and financial permission hardening

- Role: 2号 AI — Web App + Admin Panel. Work remains in Draft PR #51, based on PR #50's exact implementation head `73367233a5f4d37e828cb124f03f3eff84a10a2c`.
- SECURITY HARDENING: manual deposit credit now requires both `deposits.review` and `deposits.read`. The API rejects a credit request with `ADMIN_PERMISSION_DENIED` if the verified membership lacks deposit-history read access; the UI disables the credit action under the same condition. This ensures an operator can inspect existing receipt/ledger history before crediting.
- AUTH DOCUMENTATION: corrected `docs/INITIAL_SUPER_ADMIN_BOOTSTRAP.md` to state Google sign-in only. Email/password and email OTP are not to be enabled or relied on for this project.
- LIVE PRICE GAP FOUND: the React Spot Trading page fetched its ticker/order book only on initial load or manual refresh. The public Dashboard already polled markets every 30 seconds, but the trading workstation did not have an automatic refresh loop.
- FIXED IN SOURCE: Spot Trading now refreshes the ticker and order book every 15 seconds and candles every 60 seconds without reloading order-entry state or overwriting the customer's typed limit price. It displays the last successful update time and a warning when a refresh fails, retaining the last confirmed values instead of silently replacing them.
- REGRESSION TESTS: `backend/tests/spot-trading-live-refresh.test.js` protects polling lifecycle, cancellation cleanup, and the no-price-overwrite rule. `admin-route-permissions.test.js` now protects the dual permission requirement.
- EXACT-HEAD APPLICATION SHA: `8e7b9b8c271906df051a68d01e30c3f07b542e80`.
- BACKEND CI run `42286959099`: success; 366 tests passed, 0 failed; unified build, fail-closed preflight, output/entrypoint checks passed.
- FRONTEND CI run `42286959137`: success; lint, Vite build, Chromium installation and 20/20 desktop/mobile Playwright route smoke tests passed.
- PostgreSQL schema CI was not rerun: this batch changes no SQL migration or bootstrap file. Parent integration baseline `73367233a5f4d37e828cb124f03f3eff84a10a2c` passed empty-database PostgreSQL CI run `42268516996`.
- KYC RELEASE GATE: `docs/KYC_DOCUMENT_STORAGE.md` confirms no automatic deletion after approval/rejection and no retention period. This is intentionally left unresolved pending the owner's explicit privacy/legal retention policy; do not invent a retention duration or enable production KYC storage before it is set.
- Hosting check remains Vercel `build-rate-limit`; no deployment was attempted. No hosted Supabase writes, real funds operations, financial cutover change, merge to `main`, or production deployment occurred.
- NEXT: finish independent review of delegated-role grants and user-detail projection; perform Super Admin bootstrap, delegated-role provisioning, private KYC upload/preview and auth checks only in a disposable/staging Supabase project; get the owner-approved KYC retention/deletion policy; then continue full order/ledger reconciliation. Do not perform production cutover as part of this review.


### 2026-11-07 — next batch: delegated-admin PostgREST bridge repair

- Role: 2号 AI — Web App + Admin Panel. Work remains in the existing Draft PR #51 integration follow-up; no merge or deployment.
- CRITICAL INTEGRATION DEFECT FOUND: Admin Panel delegated-administrator list and mutation handlers call PostgREST endpoints `/rest/v1/rpc/admin_list_memberships_v1` and `/rest/v1/rpc/admin_manage_membership_v1`. Migration `0026_admin_rbac_private_store_v1.sql` previously defined only the corresponding `private.*` functions, and exposed only the `public.admin_get_membership_v1` bridge. As a result, membership session lookup could work while the Admin Panel's list/provision/update/suspend/reactivate/revoke calls would fail because PostgREST cannot invoke functions in the unexposed private schema.
- FIXED IN SOURCE: added `public.admin_list_memberships_v1(uuid)` and `public.admin_manage_membership_v1(uuid,uuid,bigint,text,text[],text,text,text)` SECURITY DEFINER SQL bridges. Both delegate to the private implementations, use a fixed `pg_catalog, private` search path, revoke execution from PUBLIC/anon/authenticated, and grant execution only to `service_role`. The private schema and its tables remain unexposed; the existing backend derives actor UUID from verified Supabase Auth and independently enforces Super Admin authority.
- REGRESSION TESTS: added `backend/tests/admin-rbac-postgrest-bridge.test.js` covering exact RPC names/signatures, private implementation delegation, execute grants, verified actor identity and Super Admin guards.
- CI GAP FOUND: PostgreSQL schema workflow only ran on PRs targeting `main`, while this follow-up PR targets `fix/post-merge-db-bootstrap-seconds-20261106`. SQL changes on this PR therefore would not trigger the empty-database schema suite.
- FIXED IN SOURCE: added the current integration base branch to the PostgreSQL workflow's `pull_request.branches` filter. The SQL migration change now qualifies for the empty-database PostgreSQL workflow on PR #51.
- POSTGRESQL VALIDATION FOUND A REAL SYNTAX ERROR in the first bridge draft: the workflow showed the SQL function body delimiter had been reduced to a single `# BTCBOX AI Coordination

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


### Bounded outbox retry CI correction — 2026-11-06 (UTC+8)

- Initial code/test CI runs `42113489305` and `42113504711` failed because the generated URL trailing-slash regex in the new function had an extra escape, producing a JavaScript syntax error. This was a patch-generation defect, not a test or runtime dependency failure.
- Corrected in commit `5f4b6a94156f812661207c27bcf83bc7fc6a2d68`; source now uses the same valid `replace(/\\/+$/, '')` URL normalization semantics as the existing code.
- Exact-head CI run `42113645330` for `5f4b6a94156f812661207c27bcf83bc7fc6a2d68` is in progress. Do not accept bounded retry until this run completes successfully.


## Admin audit outbox bounded retry and backlog protection — 2026-11-06 (UTC+8)

- TEST PASSED: bounded outbox retry exact-head CI run `42113645330` completed successfully at feature SHA `5f4b6a94156f812661207c27bcf83bc7fc6a2d68`. All workflow steps passed, including unified build, backend tests, fail-closed configuration preflight, and output/entrypoint verification.
- SOURCE REVIEW: the outbox intentionally preserves every unsynced event. If PostgreSQL delivery remains unavailable for a prolonged period, pending entries could otherwise grow the shared state document without a bound.
- PATCHED: `auditAdmin` now counts pending entries before appending a new event. At 5,000 pending events it throws a typed `ADMIN_AUDIT_OUTBOX_FULL` error before the caller reaches `saveDB`; the outer handler returns HTTP 503 and explicitly states no change was saved. Existing pending events are never discarded. Read-only admin routes remain available.
- Code commit: `cd8afac2b65d63845054b6a1cabd37aca8c7b507`; regression test commit: `263aa4cf826b1341caba94ee456d118005bec17e`.
- Exact-head CI run `42114215138` for `263aa4cf826b1341caba94ee456d118005bec17e` is in progress. Do not mark backlog protection accepted until this exact-head run completes successfully.
- Shared rate-limit cleanup SQL is already indexed on `updated_at`, deletes only rows older than 48 hours, and is capped at 5,000 rows per invocation. Repository tree review found no trusted scheduler/worker or Vercel cron configuration. Do not add a public cleanup route; scheduler ownership and hosting-plan constraints remain unresolved.
- Admin mutation source-contract tests already verify audit staging precedes state save and PostgreSQL delivery follows the durable save for all nine legacy non-financial admin mutation routes. The new test covers the pending-outbox ceiling and explicit fail-closed response.
- SAFETY: no production/staging DB operations, production migrations, financial writes, merge, or Vercel deployment occurred. Positive-amount user deposits remain rejected until a trusted ingestion worker and pending-intent creator are implemented and independently verified.


### Audit outbox zero-capacity retention edge — 2026-11-06 (UTC+8)

- TEST PASSED: pending-outbox ceiling patch at exact feature SHA `263aa4cf826b1341caba94ee456d118005bec17e`, CI run `42114215138` completed successfully.
- FOLLOW-UP SOURCE FINDING: the existing history-retention expression used `slice(-Math.max(0, 5000 - pending.length))`. In JavaScript, `slice(-0)` is `slice(0)`, so when pending entries occupy all 5,000 slots the expression retains every non-pending historical entry instead of retaining zero.
- PATCHED: compute `retainedLimit` explicitly and branch: only call `slice(-retainedLimit)` when the limit is greater than zero; otherwise retain an empty non-pending list. Pending events remain untouched.
- Code commit: `0b9887fc19558f59f5043ada6c5e8ac92bb5b867`; regression test commit: `753de438e72a73344c125749a16d8d1762dbeb3a`.
- Exact-head CI run `42114754980` for `753de438e72a73344c125749a16d8d1762dbeb3a` is in progress. The preceding code-only run `42114738313` is also in progress. Do not accept this edge-case fix until the latest exact-head run completes successfully.
- No production/staging DB access, schema migration, financial write, merge, or Vercel deployment occurred.


### Audit retention and auth-secret redaction follow-up — 2026-11-06 (UTC+8)

- TEST PASSED: the `slice(-0)` retention edge correction passed exact-head CI run `42114754980` at `753de438e72a73344c125749a16d8d1762dbeb3a`; code-only run `42114738313` for `0b9887fc19558f59f5043ada6c5e8ac92bb5b867` also completed successfully.
- SOURCE FINDING: audit detail redaction covered generic token/secret fields but missed common compound names such as `access_token`, `refresh_token`, `supabase_service_role_key`, and `client_secret`. Those values can be embedded in a free-form detail string and would otherwise remain in the persisted audit outbox.
- PATCHED: extend key-value redaction to common access/refresh/auth/session token names, authorization/bearer fields, client secrets, service-role/API/private keys, OTP and TOTP secret names. Regression fixture now includes these cases.
- Code commit: `abb9869b7d1babd5a9b0b23b55b3775de2882c05`; test commit: `732a53f035dd1a854e0f136f1b978c830b71c20c`.
- Exact-head CI run `42114900352` for `732a53f035dd1a854e0f136f1b978c830b71c20c` is in progress; code-only run `42114875225` is also in progress. Do not accept this redaction extension until exact-head CI passes.
- No production/staging DB access, schema migration, financial write, merge, or Vercel deployment occurred.


### Seconds settlement request-hash validation hardening — 2026-11-06 (UTC+8)

- SOURCE OBSERVED: prepared migration `0024_seconds_settlement_idempotency_v1.sql` previously validated `p_request_hash` by length only. A 64-character non-hex string could pass the SQL argument guard even though the API constructs SHA-256 hexadecimal hashes.
- PATCHED: the SQL guard now requires exactly 64 lowercase hexadecimal characters via `coalesce(p_request_hash,'') !~ '^[0-9a-f]{64}$'`. This aligns the database contract with the API's SHA-256 digest format and rejects NULL, malformed, or non-hex request hashes.
- REGRESSION TEST: `backend/tests/seconds-persistent-order-guard.test.js` now asserts the strict SHA-256 hex validation contract.
- SQL commit: `62a94971e9226d7a76a8f4814f8ad09a75b2358e`. Initial test commit `2c69cf6b63d71a688af1c7009067191fbc364091` failed CI run `42117132815` because the newly added regex assertion was syntactically malformed (166/167 tests passed; test file failed to parse).
- PATCHED: replaced the fragile regex assertion with a literal SQL-contract assertion. Corrected test commit / current feature HEAD: `e88b0df202fda20224daee1aeb2f829a55500222`. Its exact-head CI is pending; do not mark this patch TEST PASSED until the new run completes successfully. Code-only SQL run `42117120706` completed successfully.
- SAFETY: migration remains prepared only. No production/staging DB migration, DB write, merge, Vercel deployment, or financial operation was performed.


### Seconds settlement hash-guard regression-test repair — 2026-11-06 (UTC+8)

- CI DIAGNOSIS: exact-head run `42117271378` for `e88b0df202fda20224daee1aeb2f829a55500222` failed in backend tests; unified build passed, but `backend/tests/seconds-persistent-order-guard.test.js` contained an orphaned tail from the prior malformed regex assertion. GitHub Actions log identifies a SyntaxError at line 191 (166/167 tests passed).
- PATCHED: removed only the orphaned fragment; retained the literal strict SHA-256 SQL assertion and the existing security-invoker, row-lock, ledger, and service-role contract assertions already covered in the intended test block.
- Repair commit: `b58db3a6a6171d4749e08070c5914dd15ac11cc8`. Exact-head CI has been triggered by the commit; pending verification.
- Migration `0024` remains prepared only. No production/staging DB operation, merge, deployment, or financial operation occurred.


### Seconds settlement migration structural repair — 2026-11-06 (UTC+8)

- CI RESULT: exact-head run `42117812367` for `b58db3a6a6171d4749e08070c5914dd15ac11cc8` completed `failure`. Unified build passed; backend tests failed at `backend/tests/seconds-persistent-order-guard.test.js:76` because the strict hash-guard assertion did not match the migration source.
- ROOT CAUSE (SOURCE OBSERVED): migration `0024_seconds_settlement_idempotency_v1.sql` had been structurally corrupted by the earlier edit: the request-ID regex lost its closing quote/anchor, the new request-hash guard and fragments of the function body were appended after the grants, and duplicated SQL fragments followed the canonical function. This is a migration source defect, not a test-only defect.
- PATCHED: reconstructed the migration from its first complete function body, retained exactly one `create or replace function`, one revoke, and one service_role grant; restored the request ID guard as `^[A-Za-z0-9_-]{16,100}$`; placed the strict request hash guard `coalesce(p_request_hash,'') !~ '^[0-9a-f]{64}$'` inside the function's initial argument-validation block. Ledger/financial operations, row lock, duplicate replay logic, and grants preserved from the canonical function body.
- Repair commit / current feature head at time of note: `1a3bbb625e98351a20d2b21812f858b50e12ff91`. Exact-head CI run `42118084457` is queued; not yet accepted.
- SAFETY: migration remains source-only and unapplied. No production/staging DB operations, financial writes, merge, or Vercel deployment occurred.


### Authentication session timestamp boundary hardening — 2026-11-06 (UTC+8)

- SOURCE OBSERVED: `getSessionRecord` rejected missing, non-positive, and expired `created_at` values, but accepted timestamps arbitrarily far in the future because `Date.now() - createdAt` becomes negative. This affects every route relying on the canonical BTCBOX session validator, including first-time credential setup and identity-link flows.
- PATCHED: reject session timestamps more than 60 seconds ahead of server time, allowing a small clock-skew tolerance while preventing future-dated sessions from satisfying fresh-session checks.
- Code commit: `a009834e302e32e190b5d8fa1c6fc4ccc953c689`; regression-test commit: `80f4893d9ba6f39936589cfd34b32f462cc498c1`. An initial source-test regex assertion was replaced with a literal assertion before final verification.
- Exact-head CI for the latest test commit is pending; do not mark this guard accepted until its exact SHA run passes.
- SAFETY: no production DB operation, migration, merge, deployment, or financial action occurred.


### Authentication session and identity-link review — 2026-11-06 (UTC+8)

- TEST PASSED: future-dated session timestamp guard and its regression coverage passed exact-head CI run `42118224555` at feature SHA `80f4893d9ba6f39936589cfd34b32f462cc498c1`. Unified build, backend tests, fail-closed deployment configuration preflight, and output/entrypoint verification all completed successfully.
- SOURCE REVIEW: re-read the server-verified Supabase provider resolver, Google/Web3 identity exchange, source and target reauthentication, identity-link marker consumption, account identity conflict checks, wallet uniqueness checks, and frontend callback flow.
- SOURCE OBSERVED: identity linking requires a fresh source proof and a separate fresh target proof; source/target tokens are checked against Supabase `/auth/v1/user`, JWT subject and auth_time, provider allowlist, wallet address validation, optional account TOTP, shared rate limits, and revision-CAS persistence. Marker replay and concurrent CAS conflict tests are present.
- TEST COVERAGE OBSERVED: `backend/tests/auth-security-routes.test.js` includes source/target stale or future auth_time rejection, expired signed auth_time, wrong-purpose/expired marker rejection, replay prevention, one-winner CAS, credential-recovery marker consumption, and fail-closed rate-limit behavior. `backend/tests/google-only-identity.test.js` covers provider/identity agreement and EVM/Solana address validation. `backend/tests/identity-link-frontend-contract.test.js` covers the two-step client flow and cookie-bound API calls.
- REVIEW RESULT: no additional reproducible defect was established in the reviewed identity-link flow; no speculative code change was made.
- NEXT BATCH: inspect account profile/security settings read and write contracts, including username setup/change, credential updates, session invalidation, and 2FA lifecycle. Preserve existing trading page layout and keep financial actions disabled.
- SAFETY: no production/staging DB access or writes, migration, merge, Vercel deployment, or financial operation occurred.


### Account credential and 2FA session invalidation hardening — 2026-11-06 (UTC+8)

- SOURCE OBSERVED: `POST /api/account/credentials` verified the current password when changing an existing BTCBOX credential, but did not invalidate other active sessions after the credential changed. This allowed previously issued sessions to remain usable after a password change.
- PATCHED: the route now explicitly resolves and verifies the current session record, preserves that request's session, and removes every other session belonging to the same user before the CAS-backed save. First-time credential setup still requires a session no older than five minutes; existing-password changes still require the current BTCBOX password.
- SOURCE OBSERVED: `POST /api/2fa/disable` verified a fresh TOTP step but retained other active sessions after removal of the second factor.
- PATCHED: after a valid, one-time TOTP verification, the route preserves the current verified session and invalidates the user's other active sessions before persistence.
- DEFENSIVE FIX: account snapshot `kyc_level` previously dereferenced `user.kyc.status` without guarding the KYC object, despite the adjacent fields already handling absent legacy KYC data. It now safely reports level 0 when the object is absent.
- REGRESSION COVERAGE ADDED: account credential tests assert current-session preservation and other-session revocation; auth-security route tests assert the same for 2FA disable; account snapshot test covers legacy users without a KYC object.
- Commits in the feature branch: `3c2ddacf1b7881896716a58dac34ea6cfbcddb58`, `16bb80df3e532a01e7a96fc808acd21ecb712bde`, `24d998bdf12a73cc9bd56bf1956fe86a467b99d3`, `f785cc190f0aaa5a70ebbd59963696ecd3bf498b`, latest exact feature HEAD `de70001529974c5741a9f5ba6fef2848d12d2054`.
- Exact-head CI runs `42118729189`, `42118737250`, `42118780556`, and `42118789024` completed successfully for their respective commits. Latest combined account-hardening HEAD `de70001529974c5741a9f5ba6fef2848d12d2054` passed exact-head CI run `42118796890`; all unified build, backend tests, fail-closed deployment configuration preflight, and entrypoint verification steps succeeded.
- SAFETY: no production/staging database writes or migrations, merge, Vercel deployment, or financial operations occurred.


### 2FA enrollment session invalidation — 2026-11-06 (UTC+8)

- TEST PASSED (previous account batch): latest combined account-hardening SHA `de70001529974c5741a9f5ba6fef2848d12d2054` passed exact-head CI run `42118796890`, including unified build, backend tests, fail-closed deployment configuration preflight, and entrypoint verification.
- SOURCE OBSERVED: enabling TOTP at `POST /api/2fa/confirm` previously set `twofa_enabled=true` after checking the one-time TOTP code, but did not revoke sessions or pending 2FA login challenges issued before enrollment. Older sessions could therefore remain active without having completed the newly enabled second factor.
- PATCHED: require a valid current BTCBOX session; after consuming a valid one-time TOTP step, preserve that current session while revoking every other session for the account and deleting the account's pending `temp_tokens` before CAS persistence.
- REGRESSION COVERAGE ADDED: auth security route contract asserts current-session validation, current-session preservation, revocation of other sessions, deletion of pending login challenges, and persistence ordering.
- Feature commits: `fae0b09f154b2b2c72735ac3a356576265b432b2` (API) and `3a986fe2488bb3822323d7265a78f377dd0b92b3` (test); latest feature HEAD `3a986fe2488bb3822323d7265a78f377dd0b92b3`.
- Exact-head CI run `42119004524` passed for API commit `fae0b09f154b2b2c72735ac3a356576265b432b2`; latest 2FA enrollment SHA `3a986fe2488bb3822323d7265a78f377dd0b92b3` passed exact-head CI run `42119012415`, including unified build, backend tests, fail-closed deployment configuration preflight, and entrypoint verification.
- SAFETY: no production/staging DB writes or migrations, merge, Vercel deployment, or financial operations occurred.


### 2FA challenge lifecycle hardening — 2026-11-06 (UTC+8)

- TEST PASSED (2FA enrollment): exact-head CI run `42119012415` passed for `3a986fe2488bb3822323d7265a78f377dd0b92b3`.
- SOURCE OBSERVED: disabling 2FA revoked older sessions but left pending `temp_tokens`; a pending second-step challenge could outlive the account's factor state. The `POST /api/login/2fa` route also treated a missing/non-finite expiry differently from an expired one and did not re-check that TOTP remained enabled when consuming the challenge.
- PATCHED: disabling 2FA now deletes all pending login challenges for that user before persistence. The 2FA login route now requires a finite expiry strictly later than current time, deletes expired/malformed challenge records, and rejects/deletes a challenge if the user no longer has an enabled TOTP secret.
- REGRESSION COVERAGE ADDED: route-contract tests assert pending challenge invalidation on disable, finite strict expiry, and current enabled-factor checks.
- Feature commits: `d5a40e32f19503c7f9ac5287847cd64ef29165cd` (API) and `9a06a8c38f0c5aeb987dc8a44fcd818b0d20f401` (tests); latest feature HEAD `9a06a8c38f0c5aeb987dc8a44fcd818b0d20f401`.
- Exact-head CI run `42119180401` completed successfully for latest challenge lifecycle SHA `9a06a8c38f0c5aeb987dc8a44fcd818b0d20f401`; API commit run `42119171670` also completed successfully.
- SAFETY: no production/staging DB writes or migrations, merge, Vercel deployment, or financial operations occurred.


### Frontend 2FA expiry and account-state cleanup — 2026-11-06 (UTC+8)

- TEST PASSED (previous backend challenge batch): latest SHA `9a06a8c38f0c5aeb987dc8a44fcd818b0d20f401` passed exact-head CI run `42119180401`; API-only commit run `42119171670` also passed.
- SOURCE OBSERVED: frontend `verifyTwoFactor` retained an expired/revoked challenge token and kept the auth provider in `two-factor` state after terminal challenge errors, leaving the user on a verification flow that could not succeed. Sign-out also left identity-link transient proof state in memory, allowing stale account-scoped UI state to survive account exit.
- PATCHED: terminal 2FA challenge errors (`TWOFA_CHALLENGE_EXPIRED`, `TWOFA_NOT_ENABLED`, `USER_NOT_FOUND`, `ACCOUNT_FROZEN`) now clear the pending challenge and return the auth provider to anonymous state; invalid TOTP codes remain retryable. Sign-out now clears identity-link source proof, pending target token, identity-link 2FA flag, credential recovery state, and notices in addition to the previous auth state.
- REGRESSION COVERAGE ADDED: frontend contract test in `backend/tests/identity-link-frontend-contract.test.js` checks terminal challenge cleanup and account-scoped transient-state reset.
- Feature commits: `a359e6bdcd339a8fc5f9637d88a72101713b3c44` (frontend) and `36ba7cb9a6afd65caae0d6dccf86bc49396d873b` (contract test); latest feature HEAD `36ba7cb9a6afd65caae0d6dccf86bc49396d873b`.
- Exact-head CI run `42119401407` completed successfully for frontend challenge/sign-out cleanup SHA `36ba7cb9a6afd65caae0d6dccf86bc49396d873b`.
- SAFETY: no production/staging DB writes or migrations, merge, Vercel deployment, or financial operations occurred.


### Account reauthentication challenge terminal-state cleanup — 2026-11-06 (UTC+8)

- TEST PASSED (prior frontend batch): exact-head CI run `42119401407` completed successfully for `36ba7cb9a6afd65caae0d6dccf86bc49396d873b`.
- SOURCE OBSERVED: identity-link and credential-recovery second-factor handlers retained pending Supabase identity tokens after terminal errors (expired/invalid reauth proof, identity not linked, invalid Supabase identity, or frozen account), leaving stale account reauthentication state available for repeated submissions. Invalid TOTP and transient service/rate-limit failures must remain retryable.
- PATCHED: both handlers now clear pending identity tokens and their 2FA-needed flags for terminal errors only; retryable TOTP/service/rate-limit failures are not included in the terminal error set.
- REGRESSION COVERAGE ADDED: frontend contract test asserts the terminal cleanup behavior for both flows and exact terminal-code allowlist.
- Feature commits: `ef67f9c3c5ad81bdefa2117089217872e037cd6c` (frontend), `65dbee4d4828c101825baa868ac7323892603d58` (test), `17b945ce54713e973c536d4490d6696b93cd7da6` (test assertion cleanup); latest feature HEAD `17b945ce54713e973c536d4490d6696b93cd7da6`.
- Exact-head CI run `42119663440` completed successfully for latest SHA `17b945ce54713e973c536d4490d6696b93cd7da6`.
- SAFETY: no production/staging DB writes or migrations, merge, Vercel deployment, or financial operations occurred.


### OAuth callback and credential-change reauthentication cleanup — 2026-11-06 (UTC+8)

- TEST PASSED (prior batch): exact-head CI run `42119663440` completed successfully for `17b945ce54713e973c536d4490d6696b93cd7da6`.
- SOURCE OBSERVED: OAuth credential-recovery and identity-link reauthentication callbacks could leave stale pending tokens/flags from an earlier attempt when a fresh callback succeeded, entered the 2FA branch, or failed terminally. Credential reset/update also preserved the current session but left other account-scoped reauthentication proofs attached to that session.
- PATCHED frontend: successful OAuth reauthentication replaces/clears old pending state; entering a 2FA challenge clears incompatible ready/source-verified flags; failed reauth callbacks clear their corresponding pending tokens and state while preserving existing retry behavior for the dedicated 2FA challenge handlers.
- PATCHED backend: successful credential reset and credential setup/update now clear both `credential_reauth` and `identity_link_reauth` markers from the preserved current session before persistence. Other sessions continue to be revoked as before.
- REGRESSION COVERAGE ADDED: frontend OAuth callback state transitions and backend marker invalidation are asserted by contract tests.
- Feature commits: `1b5b2a43db11347d824104f2027b3dda136f5acd` (frontend), `f6f25c065fc7d857a2130902801f40f4c645797d` (frontend test), `6bb6b10090ec995ec7253c1d9eafb09a5d91c9dc` (API), `7c20187b016b3d8c6a3678b4aebebd251c6e85d6` (API test); latest feature HEAD pending final CI.
- TEST PASSED: exact-head CI run `42119925291` completed successfully for `7c20187b016b3d8c6a3678b4aebebd251c6e85d6`.
- SAFETY: no production/staging DB writes or migrations, merge, Vercel deployment, or financial operations occurred.


### 2FA challenge atomicity and logout persistence regression checks — 2026-11-06 (UTC+8)

- TEST PASSED (previous batch): exact-head CI run `42119925291` completed successfully for `7c20187b016b3d8c6a3678b4aebebd251c6e85d6`.
- SOURCE OBSERVED: 2FA login currently validates expiry/enabled factor/frozen state, consumes the one-time TOTP step, deletes the temporary challenge, creates the session, and persists the combined state through the database revision-CAS before returning success. This preserves single-winner semantics; no speculative production logic change was made.
- SOURCE OBSERVED: logout deletes only the presented cookie session, persists state, then returns the clearing cookie. A persistence failure must not be treated as a successful logout.
- REGRESSION COVERAGE ADDED: tests assert 2FA challenge/TOTP/session write ordering and terminal guards; logout success removes only the current session, preserves unrelated sessions, and increments persisted revision; failed CAS must not report success or pretend the server session was revoked.
- Feature test commit: `623bdefda65ac99c498987d3b7ebfca540bcfa22`; latest feature HEAD pending exact-head CI.
- TEST PASSED: exact-head CI run `42120141576` completed successfully for `623bdefda65ac99c498987d3b7ebfca540bcfa22` (unified build, backend tests, fail-closed config preflight, and unified output verification all succeeded).
- SAFETY: no production/staging DB writes or migrations, merge, Vercel deployment, or financial operations occurred.


### Identity-link one-time proof local-state ordering — 2026-11-06 (UTC+8)

- SOURCE OBSERVED: after the server successfully consumes the one-time identity-link source proof, Google OAuth and Web3 UI previously waited for Supabase client sign-out before clearing the local source-verified flag. If provider cleanup failed after the server-side link had committed, the UI could still display the source as verified even though the server proof was already consumed.
- PATCHED frontend: after successful server link response, clear source-verified, pending identity token, and 2FA-needed state immediately, before attempting Supabase sign-out and account refresh. Failed link requests still retain retryable source proof state.
- REGRESSION COVERAGE ADDED: asserts the successful server call precedes local proof clearing and that local clearing precedes provider sign-out for both Google callback and Web3 linking.
- Feature commits: `c481a2d98a96b1e58f38c4a4df8ed688100f0282` (frontend), `5bd578d237811a36631a9fddeb3ef11a57a35c77` (test); latest feature HEAD pending exact-head CI.
- SAFETY: no production/staging DB writes or migrations, merge, Vercel deployment, or financial operations occurred.



### Identity-link proof consumption ordering and session lifecycle regression checks — 2026-11-06 (UTC+8)

- TEST PASSED: exact-head unified build/backend/preflight run `42119925291` completed successfully for `7c20187b016b3d8c6a3678b4aebebd251c6e85d6`.
- SOURCE OBSERVED: the 2FA login challenge is consumed only after current challenge/factor/frozen-account checks and TOTP-step validation; session creation and challenge deletion are persisted together through revision-CAS. Logout removes only the presented cookie session and does not clear client state when server persistence fails.
- REGRESSION COVERAGE ADDED: test commit `623bdefda65ac99c498987d3b7ebfca540bcfa22` asserts 2FA challenge/TOTP/session write ordering and logout current-session-only removal, revision increment, and fail-closed CAS behavior. Exact-head CI run `42120141576` completed successfully for that SHA.
- SOURCE OBSERVED: Google OAuth and Web3 identity-link success paths now clear the consumed local source proof, pending target token, and 2FA-needed state immediately after the server confirms the link, before attempting Supabase client sign-out. This avoids retaining a locally verified proof after the server has consumed it.
- REGRESSION COVERAGE ADDED: test commit `5bd578d237811a36631a9fddeb3ef11a57a35c77` checks both Google and Web3 ordering. Exact-head backend CI run `42120292911` completed successfully for the current feature branch HEAD `5bd578d237811a36631a9fddeb3ef11a57a35c77`.
- REVIEW RESULT: source/target identity proof validation, server-side one-time marker consumption, conflict checks, CAS winner semantics, and local proof clearing were re-reviewed. No additional reproducible defect was established; no speculative auth behavior change was made.
- NOT VERIFIED: live Google OAuth and wallet provider behavior in a deployed environment; Vercel deployment remains paused and no end-to-end live authentication was performed.
- SAFETY: no production/staging DB access or writes, migration, merge, Vercel deployment, or financial operation occurred.


### Wallet identity canonicalization across Ethereum and Solana — 2026-11-06 (UTC+8)

- SOURCE OBSERVED: server-verified Ethereum wallet addresses are normalized to lowercase when parsed from Supabase claims, but legacy wallet_identities and legacy primary wallet_address records may retain EIP-55 checksum casing. Three uniqueness paths (initial Supabase login, identity-link conflict detection, and same-account wallet duplicate detection) previously compared address strings exactly. The same EVM address with different letter casing could therefore evade a conflict/duplicate check.
- PATCHED: added strict chain-aware wallet normalization and equality helpers. Ethereum addresses are validated and compared case-insensitively; Solana addresses remain case-sensitive; malformed stored addresses and cross-chain comparisons never match. Applied consistently to login ownership checks, identity-link conflict checks, and existing-account duplicate prevention.
- REGRESSION COVERAGE ADDED: backend/tests/google-only-identity.test.js checks EVM checksum-case equivalence, Solana case sensitivity, malformed address rejection, and chain separation.
- Feature commits: API dba3382938fff77326a54cf49a05b260131d59af; tests 07a1fa266f7fa847d3c162372d73da21b8aeb897. Latest feature HEAD: 07a1fa266f7fa847d3c162372d73da21b8aeb897.
- CI PENDING at note time: API commit run 42120773368 and exact latest-head run 42120779237 both in progress. Do not mark this batch accepted until latest-head CI completes successfully.
- REVIEW RESULT: no other source-proven defect was established in the inspected provider allowlist, Supabase identity-ID ownership checks, and wallet claim validation. Live provider behavior remains NOT VERIFIED.
- SAFETY: no DB writes/migrations, merge, deployment, or financial operations occurred.


### Identity-link wallet record deduplication and legacy-field compatibility — 2026-11-06 (UTC+8)

- TEST PASSED: previous exact-head wallet canonicalization CI run 42120779237 completed successfully for 07a1fa266f7fa847d3c162372d73da21b8aeb897.
- SOURCE OBSERVED: the identity-link route correctly rejected wallets already owned by another BTCBOX account, but after passing that conflict check it unconditionally appended a wallet record. Linking a second Supabase identity representing the same wallet to the same BTCBOX account could therefore create duplicate wallet_identities entries. The same-account check also needed to recognize the legacy primary wallet_chain/wallet_address fields.
- PATCHED: identity linking now checks the normalized wallet_identities list and legacy primary wallet fields before appending a wallet record. It still records the distinct Supabase auth identity in auth_identities; it only deduplicates the wallet record itself.
- REGRESSION COVERAGE ADDED: backend/tests/google-only-identity.test.js asserts both normalized and legacy wallet duplicate checks and confirms the linked auth identity is still appended.
- Feature commits: API f682106791dac858a3d2f91d3097239ff2fd51a0; tests affe1573f696b47528a6bf008a914390590c5657. Latest feature HEAD affe1573f696b47528a6bf008a914390590c5657.
- CI PENDING: API run 42121004690 and exact latest-head run 42121010913 were in progress when recorded. This batch is not accepted until exact latest-head CI succeeds.
- NOT VERIFIED: no live provider login/link test; no wallet unlink endpoint was found in the inspected route section, and no unlink behavior was changed.
- SAFETY: no production/staging DB writes or migrations, merge, Vercel deployment, or financial operations occurred.


### Legacy Supabase identity ownership compatibility — 2026-11-06 (UTC+8)

- TEST PASSED: exact latest-head CI run 42121010913 completed successfully for feature HEAD affe1573f696b47528a6bf008a914390590c5657, validating wallet record deduplication.
- SOURCE OBSERVED: isSupabaseIdentityLinked previously recognized only the primary supabase_user_id and supabase_user_ids array. It did not recognize an identity present only in a legacy auth_identities record. Ownership checks that rely on this helper (including login mismatch and identity-link conflict checks) could therefore fail to recognize that legacy-linked Supabase identity.
- PATCHED: isSupabaseIdentityLinked now checks the primary ID, the ID array, and auth_identities entries; empty requested IDs fail closed.
- REGRESSION COVERAGE ADDED: tests cover primary, array, legacy auth_identities-only, unrelated, and empty-ID cases.
- Feature commits: API 04687d7fc890578d0b84a4b46949ef91ae24eba5; tests 6ee725cdb87c79d0d547dbc62137252b2c558580. Latest feature HEAD 6ee725cdb87c79d0d547dbc62137252b2c558580.
- CI PENDING: API run 42121255258 and exact latest-head run 42121260377. Do not accept this batch until exact latest-head CI succeeds.
- SAFETY: no production/staging DB writes or migrations, merge, Vercel deployment, or financial operations occurred.


### Scope correction and first-time account creation coverage — 2026-11-06 (UTC+8)

- USER CONFIRMED: BTCBOX currently has no legacy users. Do not treat legacy account migration or backward-compatibility as an active product requirement unless explicitly requested.
- SCOPE CORRECTION: reverted the speculative auth_identities-only fallback in isSupabaseIdentityLinked; ownership matching remains based on the active primary Supabase ID and explicit supabase_user_ids list. Removed the legacy-only regression assertion. This intentionally avoids expanding production logic for a non-existent user cohort.
- SOURCE REVIEW: first-time Supabase sign-in creates one internal BTCBOX user from the server-verified Supabase UUID; Google requires a confirmed valid email, Web3 requires a validated wallet identity and does not synthesize an email. The creation record initializes the provider identity, wallet identity (when Web3), empty balances, and account collections; the session is then created and persisted with the user in the same saveDB operation.
- REGRESSION COVERAGE ADDED: test asserts first-time account creation identity fields, wallet/provider initialization, empty balance initialization, and session persistence through the same save operation.
- Feature commits: scope rollback API 80ce76e35ffc53b1100d47b193455ffd2e73ac84; legacy-only test removal 2cd43761c3afe433962d6f1928d5d7e7d32947cc; first-time account test e7248b720679e32d3450bc8c8e20c6e173c8ca24. Latest feature HEAD e7248b720679e32d3450bc8c8e20c6e173c8ca24.
- CI PENDING: exact latest-head run 42121479935. The earlier run for the intermediate scope rollback is not a substitute for exact latest HEAD.
- NOT VERIFIED: live Google/Web3 provider callbacks, actual first-time sign-in in deployed environment, and persistence behavior against production storage.
- SAFETY: no production/staging DB writes or migrations, merge, Vercel deployment, or financial operations occurred.


### First-time credential setup guard review — 2026-11-06 (UTC+8)

- TEST PASSED: exact latest-head CI run 42121479935 completed successfully for feature HEAD e7248b720679e32d3450bc8c8e20c6e173c8ca24, including first-time Supabase account creation coverage.
- SOURCE OBSERVED: POST /api/account/credentials requires a valid current BTCBOX session, validates username and password, requires a current password when credentials already exist, and limits initial credential setup to a session created within the previous five minutes. Duplicate normalized usernames are rejected before credential mutation. Passwords are stored with PBKDF2-SHA256 at 600,000 iterations. Other account sessions and stale reauthentication markers are invalidated before revision-CAS persistence; the current session is preserved.
- REGRESSION COVERAGE ADDED: backend/tests/account-credentials.test.js now asserts the fresh-session gate, existing-password verification, validation and duplicate-check ordering before mutation, normalized username uniqueness, configured password hash algorithm, and persistence failure handling.
- Feature test commit: bc1cb0484b06cd6eeebb3ccaee0351588ca1099c. Latest feature HEAD bc1cb0484b06cd6eeebb3ccaee0351588ca1099c.
- CI PENDING: exact latest-head run 42121694108. Do not accept this test-only batch until exact latest-head CI succeeds.
- NOT VERIFIED: live browser setup flow, real Supabase session timing, and production persistence behavior. No backend behavior change was made in this batch.
- SAFETY: no production/staging DB writes or migrations, merge, Vercel deployment, or financial operations occurred.


### Username login and 2FA persistence hardening — 2026-11-06 (UTC+8)

- TEST PASSED: preceding exact feature HEAD `bc1cb0484b06cd6eeebb3ccaee0351588ca1099c` completed CI run `42121694108` successfully.
- SOURCE OBSERVED: username/password login persists its 2FA temporary challenge before returning it; 2FA verification validates challenge expiry, account existence, 2FA state and frozen status, applies shared rate limiting, consumes a TOTP step, removes the temporary challenge, and creates the authenticated session in one state save.
- FIXED: all persistence paths for 2FA challenge creation, invalid-challenge cleanup, and final 2FA session creation now return explicit `PERSISTENCE_UNAVAILABLE` 503 responses on write failure. The final session cookie is emitted only after the session/challenge transition is saved. Successful 2FA sessions now record `auth_method: username_password_2fa`.
- REGRESSION COVERAGE ADDED: `backend/tests/auth-security-routes.test.js` asserts challenge persistence precedes returning the temporary token and that the final cookie response follows successful persistence, including frozen/expired/disabled challenge branches.
- Feature API commit `caf51a3a5c49df801f05ab71d04291c531af12bd`; test commit `ad31716bcfd7a0bff2e5927ea6f70a1afc5ace47`.
- Exact feature HEAD at coordination update: ad31716bcfd7a0bff2e5927ea6f70a1afc5ace47. CI for this exact HEAD must complete successfully before acceptance.
- NOT VERIFIED: live Supabase/Google browser flow, production persistence fault injection, and external authenticator behavior. No production DB writes/migrations, merge, deployment, or financial operations occurred.


### Google/Web3 login persistence parity — 2026-11-06 (UTC+8)

- TEST PASSED: preceding exact feature HEAD `ad31716bcfd7a0bff2e5927ea6f70a1afc5ace47` completed CI run `42122722478` successfully.
- SOURCE OBSERVED: Supabase login verifies the bearer token through `/auth/v1/user`, validates a single allowed provider, requires confirmed email for Google or validated wallet identity for Web3, resolves an internal account, checks identity/wallet ownership and frozen state before issuing a login challenge or session.
- FIXED: Supabase Google/Web3 2FA challenge creation now fails closed with `PERSISTENCE_UNAVAILABLE` when state persistence fails. Final authenticated session persistence is also guarded; no success cookie is returned unless save succeeds. Sessions now record explicit `supabase_google` or `supabase_web3` auth method.
- REGRESSION COVERAGE ADDED: `backend/tests/google-only-identity.test.js` verifies frozen-account gating precedes challenge/account creation, 2FA challenge persistence precedes challenge response, final session persistence precedes success cookie, and auth-method attribution.
- Feature API commit `5ea329384167522d81333d0a69daddc199c6506c`; test commit `ef225e3f7f44e05ec5f306f8b24dc2d9d1cd0046`.
- Exact feature HEAD: ef225e3f7f44e05ec5f306f8b24dc2d9d1cd0046. CI must pass for this exact HEAD before acceptance.
- NOT VERIFIED: live Google OAuth and wallet browser callbacks, real provider state, production DB fault injection. No production writes/migrations, merge, deployment, or financial operations occurred.


### Shared 2FA provider attribution follow-up — 2026-11-06 (UTC+8)

- FOLLOW-UP FIX: Google/Web3 and username/password login share `/api/login/2fa`; temporary challenges now retain their originating `auth_method`, and the final session copies that value. This prevents a Google or wallet 2FA completion from being mislabeled as username/password authentication.
- REGRESSION COVERAGE ADDED: `backend/tests/google-only-identity.test.js` checks provider-specific challenge attribution and propagation into the final session.
- Feature API commit `f6378d05f1880843b70c8f1e933b16d6fe96028c`; test commit `b927139c042505a7fa5477cebb0604e824008657`.
- Exact feature HEAD: b927139c042505a7fa5477cebb0604e824008657. Exact-head CI required; prior run results do not certify this new HEAD.


### CI regression correction — 2026-11-06 (UTC+8)

- CI runs `42122937012` (API commit `5ea329384167522d81333d0a69daddc199c6506c`) and `42122960265` (test commit `ef225e3f7f44e05ec5f306f8b24dc2d9d1cd0046`) failed in backend tests, not build. Both failures identify the same stale source assertion in `google-only-identity.test.js`: it expected the pre-hardening session object without `auth_method`. This was a test expectation mismatch introduced by the intentional provider-attribution change, not a runtime test failure.
- FIXED: updated the assertion to require explicit provider-specific `supabase_google` / `supabase_web3` attribution. Test commit `53c5ac8f1402807ff7840b454ade7b9cbe701eb7`.
- The following exact HEAD must pass CI before this batch is accepted: 53c5ac8f1402807ff7840b454ade7b9cbe701eb7.


### Auth provider attribution, persistence assertions, and session lifecycle regression — 2026-11-06 (UTC+8)

- CI FAILURE REVIEW: exact feature HEAD `53c5ac8f1402807ff7840b454ade7b9cbe701eb7` failed run `42123159803` because two test assertions lagged behind intentional code changes: username 2FA temporary challenges now include `auth_method`, and first-time Supabase session persistence is wrapped in fail-closed try/catch. The runtime build succeeded; backend test stage failed and downstream preflight stages were skipped.
- FIXED TESTS: updated the username 2FA challenge assertion to include `username_password_2fa`; updated first-time Supabase account creation test to assert guarded persistence rather than a direct unguarded save. Intermediate exact HEAD `0a53ae6bbee3746cf0851250fe183bc8372691d7` passed CI run `42123726358`.
- SESSION REVIEW: `getSessionRecord` rejects missing/invalid/non-positive creation timestamps, timestamps more than 60 seconds in the future, and sessions older than `SESSION_MAX_AGE_MS` (7 days). Protected handlers derive their user through this validator.
- LOGOUT REVIEW: logout deletes only the presented session token, persists the state change, and emits the clearing cookie only after persistence succeeds. A persistence failure is surfaced by the outer handler as an error and does not return a success cookie.
- REGRESSION COVERAGE ADDED: expired sessions cannot access protected identity reauthentication; after logout, the old cookie receives 401 while a separate device session for the same account remains usable. Existing logout tests also assert current-session-only revocation and fail-closed persistence.
- TEST PASSED: exact feature HEAD `febacca709ebb90f2f4a2071ce7cd69a31ce69ec` completed unified build, backend tests, fail-closed deployment configuration preflight, and unified output/entrypoint verification in CI run `42123833236`.
- ACCEPTANCE: auth provider attribution and session lifecycle regression batch accepted for feature-branch QA only. This does not authorize merge to `main`, Vercel deployment, production DB writes/migrations, or real financial operations.
- NOT VERIFIED: live browser logout behavior, real multi-device provider sessions, and production persistence fault injection. No live OAuth or wallet sign-in was performed.


### Credential rotation and 2FA lifecycle fail-closed hardening — 2026-11-06 (UTC+8)

- SOURCE OBSERVED: `POST /api/account/credentials` preserved the current authenticated session and revoked all other BTCBOX sessions, and cleared current-session credential/identity reauthentication markers. It did not revoke outstanding `db.temp_tokens` for the account, leaving pre-change 2FA login challenges usable until expiry.
- FIXED: credential updates now remove all pending temporary login challenges for the same account before the same revision-CAS persistence. Other accounts' challenges are not touched. The current session remains preserved; other sessions remain revoked.
- SOURCE OBSERVED: `POST /api/2fa/enable`, `POST /api/2fa/confirm`, and `POST /api/2fa/disable` performed direct `saveDB` calls without route-specific handling for revision conflicts or storage outages.
- FIXED: all three 2FA state transitions now return `ACCOUNT_UPDATE_CONFLICT` (409) on revision-CAS conflict and `PERSISTENCE_UNAVAILABLE` (503) on other persistence errors. Success responses occur only after persistence succeeds.
- REGRESSION COVERAGE: credential update tests assert pending account-scoped 2FA challenges are revoked before persistence. Auth route tests assert guarded persistence for setup/enable/disable and assert other sessions plus pending challenges are removed before the guarded write.
- Feature commits: API `a9fb8a70ea461331b90587a35fa52797287f34ab`; credential test `749df4ab7d1bf38ab33664c542a040aab8b714c7`; 2FA tests `741c709d818cb10145620e2e0ba84891736d64de`.
- TEST PASSED: exact feature HEAD `741c709d818cb10145620e2e0ba84891736d64de`, CI run `42124394817`, unified build, backend tests, fail-closed deployment configuration validation, and unified output/entrypoint checks all succeeded.
- REVIEW RESULT: password change and 2FA enrollment/removal revoke account-scoped old sessions/challenges while preserving the verified current session. The state changes remain atomic under database revision-CAS; conflict or persistence failure does not return success.
- NOT VERIFIED: live browser flows, authenticator-app behavior, actual multi-device sessions against deployed storage, and production persistence fault injection. No live OAuth/Web3 sign-in was performed.
- ACCEPTANCE: accepted for feature-branch QA only. No merge to `main`, Vercel deployment, production database writes/migrations, or real financial operations authorized or performed.


### React account-security surface audit — 2026-11-06 (UTC+8)

- SOURCE OBSERVED: `frontend/src/features/account/AccountSecurityPage.tsx` exposes linked sign-in methods and BTCBOX password recovery, but does not expose 2FA enrollment, confirmation, disablement, or authenticator recovery controls.
- SOURCE OBSERVED: `frontend/src/lib/api.ts` contains login 2FA completion but no client wrappers for `/api/2fa/enable`, `/api/2fa/confirm`, or `/api/2fa/disable`. The backend routes exist and have fail-closed persistence handling.
- SOURCE OBSERVED: `frontend/src/lib/auth.tsx` clears the local BTCBOX auth state only after the logout API succeeds; failed server logout preserves the signed-in UI state and reports the error. It also clears pending credential/identity reauthentication state on successful sign-out.
- SCOPE GUARD: the coordination baseline still records both root CRA and `frontend/` Vite applications and has not established which is canonical for the intended production hostname. Therefore no React security UI was added in this batch; implementing 2FA controls before canonical-root resolution risks building functionality into the non-deployed app.
- NOT VERIFIED: the active production app's 2FA settings UI, browser behavior after cross-device session revocation, and live provider/session synchronization.
- NEXT ACTION: resolve canonical app root and deployment entrypoint, then implement/test a complete 2FA management flow only in the confirmed active frontend. Preserve the locked trading page layout.


## Template migration reconciliation — 2026-11-06 (UTC+8)

### SOURCE OBSERVED
- Re-read this coordination document at blob 38245d759510afe77c204b3db2c0e4fce5c74f72 before this batch.
- Migration branch HEAD: `6af0210b6b2716cf5d0310fa3b7384d33bf8e808`; its tree contains Git submodule entries (mode `160000`) for the pinned template repositories, not expanded vendor source files.
- Pinned upstream snapshots: Strata Pro `a3f79d0237c68faddc877f8c1b00afece2fbbae8`; Shadcn Fintech `a905058c75a840896d27a16991f2e7cc1ca06f3f`. The upstream trees inspected contain 32 and 198 file blobs respectively. These counts confirm upstream source trees, not recursive clone/download into BTCBOX.
- Current auth feature branch HEAD: `741c709d818cb10145620e2e0ba84891736d64de`; its tree has no `frontend/vendor` directory. Its CI run `42124394817` passed unified build, backend tests, fail-closed deployment preflight, and unified output/entrypoint checks as previously recorded.
- The two branches are diverged. Compare reports migration branch as base and auth branch as head: 372 commits ahead / 24 behind, common ancestor `93a236e4a3ed6c9edd2003ac1068a89161015511`. This is not a safe direct-merge instruction; inspect unique commits and file overlap before any integration.
- Coordination branch remains the authoritative work entrypoint. No code, submodule, deployment, environment, or database changes were made in this batch.

### CONCLUSION / CLASSIFICATION
- SOURCE OBSERVED: both template versions are pinned as submodule references on the migration branch; neither template is expanded as ordinary files in the current auth branch.
- NOT VERIFIED: recursive submodule checkout/download, local dependency install/build of either upstream, actual page/component reuse in the canonical runtime, and visual/functional integration.
- SOURCE OBSERVED: the migration guide says these are design/component sources only; mock data, seeded balances, simulated transfers, Clerk auth, and fake ticker behavior must not be imported into BTCBOX.

### NEXT BATCH — SAFE EXECUTION
1. Build a source inventory from the exact pinned upstream trees: page routes, component entrypoints, package dependencies, licenses/attributions, and external service assumptions.
2. Build a BTCBOX route-to-template mapping without copying files yet; mark reuse, adapt, retain-native, or reject.
3. Resolve canonical app root and Vercel build configuration before changing frontend ownership or removing legacy assets.
4. Prepare a dedicated integration branch from the current approved development base only after inventory and compatibility review. Do not merge either divergent branch wholesale.
5. Preserve the locked trading layout and all existing auth backend behavior. No merge to main, deployment, production DB writes/migrations, or financial operations without user approval.


## Follow-up API contract audit — 2026-11-06

Application branch inspected: `feat/btcbox-web3-auth-20261105` at `741c709d818cb10145620e2e0ba84891736d64de`.

- SOURCE OBSERVED: backend exposes market ticker, candles and depth; spot limit submit/cancel routes; seconds order/settle/positions routes; account and order reads; deposit-address query; withdrawal validation/review flow; KYC and support submission.
- SOURCE OBSERVED: spot matching uses `submit_limit_order_matching_v1` / `cancel_limit_order_matching_v1` and is blocked unless the matching-engine cutover gate passes. Market orders are explicitly rejected.
- SOURCE OBSERVED: seconds trading uses server-side reference prices and atomic SQL RPCs with idempotency protections; it is distinct from perpetual futures and is blocked unless the financial-write cutover gate passes.
- SOURCE OBSERVED: `0008_financial_spot_trade_v3.sql` explicitly states it is not a matching engine; do not treat it as the active order book implementation. Separate `0009_financial_matching_engine_v1.sql` is present.
- SOURCE OBSERVED: current Vite `frontend/src/lib/api.ts` exposes market/kline, account read and order-history read, but not spot submit/cancel or seconds order/settle/positions methods. Current React routes for spot, seconds, orders, assets, deposit and withdrawal remain placeholders or are not connected.
- SOURCE OBSERVED: the legacy vanilla-JS customer UI has some trading interaction code, but it is not automatically connected to the new Vite React app.
- NOT VERIFIED: financial migrations/RPCs have been applied to the target Supabase project, matching or financial cutover flags are enabled, or any live financial lifecycle is end-to-end ready.
- NOT FOUND IN INSPECTED SOURCE: a perpetual futures engine/API; do not relabel seconds contracts as futures.
- Updated detail: see `docs/BTCBOX-FRONTEND-BACKEND-INTEGRATION-MATRIX.md` for the complete route/API matrix and safe connection sequence.


## Derivatives template source audit — 2026-11-06

### SOURCE OBSERVED

- The pinned Strata Pro source at `bymilon/strata-pro-crypto-ui` commit `a3f79d0237c68faddc877f8c1b00afece2fbbae8` contains 42 tree entries. Its tracked source is a dashboard starter: app shell, sidebar/topbar, token icon, dashboard cards/charts/table and static dashboard data. No futures, perpetual, derivatives, leverage, margin, position, or contract-specific source paths were found.
- Strata Pro README explicitly describes the project as frontend-only, using mock market data, and excluding live trading, auth, and backend integration.
- The pinned Shadcn Fintech source at `abderrahimghazali/shadcn-fintech` commit `a905058c75a840896d27a16991f2e7cc1ca06f3f` contains Crypto, Investments, Accounts, Transactions and Transfers pages, but no futures/perpetual/derivatives/margin/position source paths.
- Shadcn Fintech `src/components/crypto/trade-form.tsx` is a spot-style conversion/buy/sell form. Its `handleTrade()` uses local timers to display a successful trade without calling a backend. `crypto-page-client.tsx` seeds prices from static data and simulates price drift every three seconds. These are demo interactions, not an exchange order flow.

### INTEGRATION DECISION

- Do not treat either downloaded template as an existing perpetual-contract implementation.
- Reuse Strata Pro's market-terminal visual components and Shadcn Fintech's account/portfolio UI selectively; replace all demo prices, seeded balances and simulated trade success with BTCBOX APIs.
- Perpetual contracts remain a separate backend/frontend product gap: require explicit contract specs, isolated/cross margin policy, leverage limits, position accounting, funding, risk checks, liquidation and settlement before implementation. Do not relabel the existing seconds-contract product as perpetual.
- This audit is source-only. It does not prove runtime behavior or any external database deployment.


## Seconds-contract implementation coverage audit — 2026-11-06

### SOURCE OBSERVED

- Existing seconds-contract backend is materially implemented in `backend/api-core.js`: authenticated `POST /api/seconds/order`, `POST /api/seconds/settle`, and `GET /api/seconds/positions`; reference prices are sampled server-side from Coinbase with Bybit fallback. All three routes fail closed when `financialWritesEnabled()` is false.
- SQL migrations `0014_financial_seconds_contracts_v1.sql`, `0015_financial_seconds_one_open_position_v1.sql`, and `0024_seconds_settlement_idempotency_v1.sql` define atomic reserve/settlement ledger movements, one-open-position-per-user enforcement, and settlement idempotency. Migration files in Git do not prove they were applied to any Supabase environment.
- Legacy vanilla-JS UI `backend/assets/js/views-trading.js` includes a Seconds Contracts screen, open/history positions, countdown/settlement actions, durable pending-order intent and reconciliation. The source is not the current React/Vite route implementation.
- Existing tests in `backend/tests/seconds-persistent-order-guard.test.js` and `backend/tests/seconds-one-open-position-migration.test.js` cover durable idempotency intent, unknown outcomes, settlement request replay/conflicts, server-canonical settlement timestamps, and the database one-open-position guard. These are source-level automated tests; no test run was performed in this documentation-only batch.
- Current React/Vite `frontend/src/features/pages/Pages.tsx` still renders trade/seconds as integration-pending placeholders; `frontend/src/lib/api.ts` has no seconds API client methods. Thus existing seconds capability is not yet integrated into the new React UI.
- The inspected backend tree contains no perpetual/futures order, margin, leverage, funding, liquidation, or futures position engine. Seconds contracts are a distinct fixed-duration UP/DOWN product, not perpetual futures.

### NEXT SAFE WORK

- Reuse the existing seconds backend contract; do not create a second seconds ledger or duplicate order/settlement endpoints.
- Before wiring the React UI, add typed client methods matching the exact request/response contracts and tests for API parsing/error handling; keep all write actions disabled while the financial cutover gate is incomplete.
- Perpetual futures remain a separate product requiring approved risk/business rules and a dedicated engine. No leverage, margin, funding, liquidation, or settlement policy is inferred from the seconds product.
- No database migration was applied, no financial write was performed, and no deployment was initiated during this audit.


## Admin configuration UI follow-up — 2026-11-06

### SOURCE OBSERVED
- Re-read this coordination file at commit 430a99fbf29f92c28dc686d0595e10be5bf9fca4 before the batch.
- Corrected branch-specific admin finding: the earlier note that the admin route was only a placeholder describes the inspected main snapshot at 93a236e4a3ed6c9edd2003ac1068a89161015511. On the current development branch `feat/btcbox-web3-auth-20261105`, `backend/assets/js/views-account.js` already implements a partial `VIEWS.admin` console with user, withdrawal, KYC and audit tabs. The feature branch is not equivalent to the main snapshot.
- The feature branch already exposes `apiAdapter.adminConfig()` and the backend `GET/POST /api/admin/config` routes. The POST validates a fixed allowlist of deposit networks and address formats, supports announcement text up to 2,000 characters, and appends an admin audit event.

### IMPLEMENTED
- Feature commit `dbac594be78ecf158d8f3a3c8976e50e92d71a3a` adds a System Configuration tab to the existing admin console. It reads the existing config API, renders escaped deposit-address values and announcement text, and saves through the existing authenticated admin API. Blank address inputs are omitted from updates so they do not erase existing values. Uncertain save outcomes are surfaced as requiring verification rather than encouraging blind retries.
- Feature commit `2e7fd1c16e413be670ed5364a9817f896f4604e4` adds regression assertions for the config UI, API adapter and backend allowlist/validation contract.
- Exact current feature HEAD: `2e7fd1c16e413be670ed5364a9817f896f4604e4`.
- GitHub Actions run `42130071772` was observed as `queued` for this exact HEAD. Do not classify tests as passed until the run completes successfully.

### SAFETY / NOT VERIFIED
- No deposit address or announcement value was changed in a live environment; the code adds only the operator UI.
- No Supabase migration, production database write, financial transaction, merge to `main`, or Vercel deployment was performed.
- Runtime admin authentication, actual browser form behavior, live config persistence, and exact-head CI outcome remain NOT VERIFIED pending CI and staging QA.
- The older main-snapshot admin-placeholder statement remains valid for that snapshot only; do not generalize it to the feature branch.


## Admin read-only tabs — 2026-11-06
- Feature commit `34ba5e5ef159828aa1983beb166970bab49ba55e` adds admin read-only order and customer-support message tabs using existing authenticated API adapters. Order source is displayed; `legacy_state` is explicitly distinguished from PostgreSQL matching-engine data. Support is read-only and shows the API's latest 100 user messages.
- Regression tests are in `f55caad847f912888471dae9f3890f27c1b3dd0f`. Exact-head CI run `42130318767` completed successfully: unified build, backend tests, fail-closed preflight, and output verification passed.
- No merge, deployment, production configuration change, or financial operation was performed.


## React seconds positions read-only integration — 2026-11-06

### SOURCE OBSERVED / IMPLEMENTED
- Re-read this coordination document at current HEAD before this batch; the feature branch baseline was `f55caad847f912888471dae9f3890f27c1b3dd0f`.
- Commit `5703623a3224d66299baaac3f1fb7f88d05d98ec` adds a typed `getSecondsPositions()` client using the existing authenticated, no-store GET helper. It validates position IDs, supported symbols/directions/durations, positive amount/prices, epoch timestamps, and settlement-history fields.
- The React `/seconds` route is now protected by `ProtectedAccountRoute` and renders actual open positions and up to the API-provided history records in read-only cards. The UI does not call the order or settle endpoints.
- `cutover_incomplete: true` is rendered as a dedicated unavailable state and is explicitly not interpreted as an empty account. Network/API failures are shown separately. No countdown-based settlement action is offered.
- Commit `ad63253e9e40529b8f4faca29ddbf4086bda52c6` adds source-level regression tests for response validation, route authentication, read-only boundaries, and backend fail-closed gates, plus Simplified Chinese labels.

### TEST PASSED
- Exact-head frontend CI run `42131019355`: `npm install`, `npm run lint`, and `npm run build` all passed.
- Exact-head backend CI run `42131019361`: unified site build, complete backend test suite, fail-closed deployment preflight, and output/entrypoint verification all passed.
- Exact feature HEAD at time of verification: `ad63253e9e40529b8f4faca29ddbf4086bda52c6`.

### SAFETY / NOT VERIFIED
- This batch is read-only UI integration only. It does not enable or call `POST /api/seconds/order` or `POST /api/seconds/settle`.
- No Supabase migration was applied and no production database, balances, positions, or financial records were changed.
- The financial cutover gate remains closed. The CI pass proves build and source-level tests, not that migrations are applied, RPCs work in staging, reference feeds are operational, or real user positions can be loaded from a deployed environment.
- CSRF/request nonce/idempotency behavior for future React write actions remains to be verified before any trading action is exposed.
- No merge to `main`, Vercel deployment, or production financial operation was performed.


## Seconds backend-authoritative policy audit — 2026-11-06

### SOURCE OBSERVED
- Re-read the coordination entrypoint at `chore/shared-ai-coordination` HEAD `d27a6cade283dcb476ef63bd028a5d3eb2c0ebfa` before this batch. The feature branch baseline was `ad63253e9e40529b8f4faca29ddbf4086bda52c6`.
- `backend/api-core.js` currently owns the seconds order request boundary: symbols BTC/ETH/SOL/BNB, durations 30/60/300/900 seconds, positive amount with a hard-coded upper bound of 1,000,000,000,000, direction up/down, and mandatory request id. The handler does not accept client payout/profit-rate fields and passes only server-validated order fields to `submit_seconds_order_v1`.
- The SQL RPC independently checks symbol, direction, duration, positive amount and server-only execution grants. The order RPC accepts no payout parameter.
- The settlement handler samples the reference price on the server and passes that value to the SQL RPC; it does not use a client-supplied settlement price.
- `0014_financial_seconds_contracts_v1.sql` and `0024_seconds_settlement_idempotency_v1.sql` calculate winning profit as `round(amount * 0.85, 18)`. This is a fixed database rule in the current source, not an admin-editable setting.
- The inspected admin config UI/API is scoped to deposit addresses and announcement text; no seconds policy/config endpoint, configuration table, payout setting, minimum-stake setting, or versioned policy model was found in the inspected source.
- Existing SQL positions persist the order symbol, direction, amount, duration and prices, but do not persist a policy/config version or payout-rate snapshot.

### IMPLEMENTED
- Feature commit `0e18748eba11e6cddf78f0f24431ae1481cd1c51` adds `backend/tests/seconds-server-authoritative-rules.test.js`.
- The regression suite asserts backend-owned symbol/duration/amount limits, no client payout override, database-side rule checks and service-role-only RPC execution, server-sampled settlement price, fixed database payout rule, and the financial cutover gate.
- Exact feature HEAD verified after push: `0e18748eba11e6cddf78f0f24431ae1481cd1c51`; test file blob `169554e97d8449ae1291be6c72159c583a161fad`.

### TEST / STATUS
- SOURCE TEST ADDED: the new regression file is present at the exact feature HEAD.
- NOT VERIFIED: this new commit has no PR-triggered GitHub Actions workflow run in the workflow lookup. The combined status currently reports only `Vercel – btcboxcdt` failure with target `upgradeToPro=build-rate-limit`; this is a Vercel build-rate-limit status, not a reported Node test result. Do not claim the new test suite passed.
- Existing previously recorded CI passes apply to the earlier exact feature HEAD `ad63253e9e40529b8f4faca29ddbf4086bda52c6`, not this new commit.

### NEXT SAFE DESIGN
- Keep the policy authoritative on the server/database; never trust frontend-calculated limits, payout, open price, settlement price, or outcome.
- Before exposing admin-editable seconds policy, design a versioned policy record with active/effective windows, explicit symbol/duration allowlists, min/max stake, payout basis points, per-user exposure limits, admin authorization, append-only audit history, optimistic version checks and effective-time rules.
- Snapshot the policy version and payout terms onto each newly opened position so later policy edits cannot rewrite an existing position's settlement terms or history.
- Do not invent or silently change commercial values. Current 85% payout and amount ceiling remain source constants until separately approved business policy and isolated staging verification exist.
- No policy table, migration, admin write endpoint/UI, production database change, financial write, merge, or deployment was made in this batch.


## Seconds policy versioning design — 2026-11-06

### IMPLEMENTED (documentation only)
- Re-read the coordination entrypoint at branch HEAD `242795398059f2c6bed42da6d9a76dbcb92080e0`.
- Re-read the feature branch baseline `bb08e2b6c70ab2794fb02fba91e34f71ebf2c1b6`, including the current server-authoritative policy regression test and SQL migrations `0014` / `0024`.
- Feature commit `e87a77871c221d4ea67c6457e7c64a831147c9f5` adds `docs/SECONDS_POLICY_VERSIONING.md`, a non-executable design specification for immutable policy versions, effective windows, per-user exposure, admin audit, optimistic concurrency, and per-position payout snapshots.
- The design preserves the source-observed baseline (BTC/ETH/SOL/BNB; 30/60/300/900 seconds; current API ceiling; 85% winning profit) without changing runtime behavior.
- It specifies legacy NULL-snapshot settlement compatibility and requires order RPC policy resolution/snapshotting to be atomic before any admin editor is exposed.

### NOT IMPLEMENTED / NOT VERIFIED
- No migration, policy table, policy RPC, admin API, or policy UI was created in this batch.
- No migration was applied; no production/staging database, financial record, balance, position, or order was modified.
- No financial write gate was opened; no merge or deployment was performed.
- CI/runtime verification for the documentation-only commit is not yet recorded. This batch is not a runtime feature acceptance.

### NEXT
- Convert the approved specification into an additive migration and RPC changes on the feature branch, retaining legacy position behavior and current policy values.
- Before adding administrator write routes, verify the existing admin identity/role contract and implement append-only audit, nonce/idempotency, optimistic concurrency, and isolated staging tests.


## Seconds policy schema and RPC implementation — 2026-11-06

### IMPLEMENTED (source only; staging not applied)
- Re-read coordination branch HEAD `a1ea5cc3351d00c0f11d952ada05f3799e638b6b` and feature branch HEAD `e87a77871c221d4ea67c6457e7c64a831147c9f5`.
- Feature commit `c9393e4a35be714a838e9785a184f2648b9a7ab8` adds:
  - `backend/supabase/sql/0025_seconds_policy_versioning_v1.sql`
  - `backend/tests/seconds-policy-versioning.test.js`
- Migration is additive: immutable versioned policy table, separate active-policy pointer, append-only audit table, nullable per-position policy/version/payout/snapshot fields, immutable policy and position snapshot triggers.
- Version 1 seed records only source-observed baseline: BTC/ETH/SOL/BNB; 30/60/300/900 sec; positive minimum at numeric(38,18) precision; API-observed maximum 1e12; 8500 payout basis points. Exposure cap remains NULL (not invented).
- Replaced order RPC resolves and locks active policy, validates product/stake/exposure inside the same transaction as reserve, and stores immutable policy snapshot. It keeps idempotent replay before policy lookup and preserves the one-open-position DB guard.
- Replaced settlement RPC uses position payout snapshot; legacy NULL-snapshot positions retain 8500 bps fallback. Existing settlement maturity, ownership, idempotency, source and ledger logic retained.
- No client policy/payout parameters or admin mutation endpoint/UI added. Tables remain inaccessible to anon/authenticated; service_role receives read-only policy table access, and no policy writes are granted to service_role in this migration.

### VALIDATION / NOT VERIFIED
- Re-fetched exact feature HEAD `c9393e4a35be714a838e9785a184f2648b9a7ab8`; both files and blob SHAs verified.
- PR-triggered workflow lookup returned no runs for this commit. Node tests, SQL parsing, live RPC behavior, concurrency, and financial ledger invariants are NOT verified in this environment. Do not mark accepted.
- Migration has NOT been applied to staging or production. No balances, positions, orders, financial records or cutover flags were changed. No merge or deployment.

### REVIEW FLAGS BEFORE STAGING
- Independently review PostgreSQL trigger/locking behavior and the SQL function replacement against the deployed migration history.
- Add isolated staging tests for migration application, active-policy resolution, policy boundary rejects, concurrent same-user reserve, historical NULL-snapshot settlement, payout snapshot immutability, and ledger invariants.
- Admin policy authoring/activation remains intentionally unavailable until admin identity/permission contract, nonce/idempotency, optimistic concurrency and audit transaction are implemented.


## Seconds policy privilege and audit hardening — 2026-11-06

### IMPLEMENTED (source only)
- Re-read coordination HEAD `34d1e7b743f2b22d9b8eea319add73f3011f2a48` and feature baseline `c9393e4a35be714a838e9785a184f2648b9a7ab8`.
- Review found the policy resolver used `SELECT ... FOR SHARE` while `service_role` had only SELECT on policy tables. PostgreSQL row-locking SELECT can require UPDATE privilege, so the order RPC could fail despite the intended read-only grants.
- Feature commits `1fab9a3d5bab544e5cfbea618fd39704e3308e2f` and `a7871a870f2f4837322c5a86885f4906464da066` remove that row-lock privilege dependency; immutable policy rows and non-writable active pointer are read through MVCC.
- Added a database trigger that rejects UPDATE/DELETE on the policy audit table.
- Updated source-level regression assertions to require no row-lock clause and require append-only audit protection.
- Latest feature head after these changes: `fde1e6f7e9d272b41bacfd69b6e9e0cfbe77274f`.

### ADMIN AUTHORITY FINDING
- Current `api-core.js` admin authorization is a single shared `ADMIN_USER` / `ADMIN_PASS` Basic Auth credential, not an identified multi-admin subject with granular roles or policy-specific approval permission.
- Therefore no seconds policy draft/approve/activate API or UI is added in this batch. A shared Basic Auth identity is insufficient to produce trustworthy actor-level approval/audit records.
- Before policy writes, introduce an attributable admin identity/role contract and separate draft vs approval permission; preserve the existing admin auth path until a reviewed migration and compatibility plan exists.

### VALIDATION / NOT VERIFIED
- Re-fetched feature branch and changed files. Source checks are present; workflow lookup for the latest feature commit returned no runs. Node test execution and PostgreSQL parsing/application are not verified.
- No database migration was applied to staging or production. No balances, positions, orders or ledger rows changed; financial cutover remains closed. No merge or deployment.
- Next: obtain an actual PostgreSQL staging validation path; review admin identity/RBAC design; only then add read/write policy management endpoints.


## Seconds policy and settlement regression coverage — 2026-11-06

### IMPLEMENTED (source only)
- Re-read coordination HEAD `edd309b06dd946bc7a05a9aca1b196fe39e7c8a3` and feature HEAD `fde1e6f7e9d272b41bacfd69b6e9e0cfbe77274f`.
- Compared `0025_seconds_policy_versioning_v1.sql` settlement RPC against the historical `0024_seconds_settlement_idempotency_v1.sql` implementation and confirmed the revised function retains owner-scoped position locking, maturity checks, settlement-price timestamp checks, request-hash idempotency, frozen-balance invariant, financial operation, account update, ledger append, and final position update. The new function additionally calculates payout from the position snapshot and retains 8500 bps fallback for legacy NULL snapshots.
- Confirmed the order RPC resolves idempotent replay before active-policy lookup, preserving replay semantics if the active policy later changes.
- Added source-level assertions for replay ordering, settlement/ledger invariants, service-role-only RPC execution, and non-client-writable policy tables.
- Feature commit: `048d3c224baf089751cecc9d7a98d39c5d329c1c`; changed test blob: `51f5f922050531233ff6e66341ea71cb9f813d24`.

### DATABASE / VALIDATION OBSERVATIONS
- Supabase project inventory identifies project ref `zlozsutefnmgwwzrlipt`; read-only migration history returned only versions `20261102133555` and `20261103062716`. This list does not establish that the application SQL files `0014` through `0025` have been applied; their status remains unverified.
- No production SQL query or DDL was executed. No staging branch was created. No migration applied.
- Workflow lookup for feature commit `048d3c224baf089751cecc9d7a98d39c5d329c1c` returned no runs. Tests are source assertions only; Node execution and PostgreSQL runtime verification remain NOT VERIFIED.

### NEXT
- Secure a separately identified staging database or approved Supabase development branch before attempting SQL execution.
- Verify migration prerequisites `financial_ledger_v1`, `0014`, `0015`, and `0024` in that isolated environment; the repository file list and current migration registry are not sufficient proof of schema state.
- Resolve the actual business minimum stake from the approved product configuration before treating the numeric precision floor as the commercial minimum.
- Continue admin actor/RBAC design before any policy draft/activation write route or editor is added.
- Keep financial cutover closed; no merge/deploy until the exact migration chain, RPC invariants, and CI evidence are independently verified.


## Seconds stake-boundary source verification — 2026-11-06

### IMPLEMENTED (source only)
- Re-read coordination HEAD `d8e42b4f112a83f6277f4a788a48ad13283edfc3` and feature HEAD `048d3c224baf089751cecc9d7a98d39c5d329c1c`.
- Inspected the live source order handler, decimal parser, authoritative-rules test and historical `0014` / `0015` migrations.
- Confirmed the existing API has no separate commercial minimum stake: it rejects null/non-positive amounts, caps at 1,000,000,000,000, accepts up to 18 fractional decimal places, and keeps money as decimal strings / BigInt comparisons rather than IEEE-754.
- Therefore the seeded policy minimum `0.000000000000000001` represents the smallest positive amount representable by the current `numeric(38,18)` schema and API parser; it is not evidence of a commercial minimum chosen by product management.
- Added source-level regression coverage for this boundary and the seeded max/payout baseline.
- Feature commit: `5594e7450977a76423bc4cd7398c0f2beaed10b4`; test blob: `dcda51dea6833c6bebc8435242a0710460df7176`.

### NOT VERIFIED / NEXT
- No Node test run or CI workflow result is available for the new commit; source assertions remain unexecuted.
- Supabase currently reports no database branches for project `zlozsutefnmgwwzrlipt`; no isolated staging branch was available in the read-only branch inventory. Do not run migrations against the production project as a substitute.
- Next batch: obtain a separately provisioned staging database or approved development branch; validate the complete prerequisite chain and execute SQL tests there. Continue admin identity/RBAC design separately; do not create write endpoints using the shared Basic Auth actor.
- No production schema/data changed, no financial cutover, merge or deployment.


## Seconds payout floor and configurability — 2026-11-06

### IMPLEMENTED (source only)
- Re-read coordination HEAD `a2f28764f593c0f4c4fa003409b2d02dcedd1745` and feature HEAD `5594e7450977a76423bc4cd7398c0f2beaed10b4`.
- Clarified the user's product requirement: 85% is a minimum, not the only payout value; backend policy versions must be able to configure a higher winning-profit rate.
- Tightened the new policy schema payout constraint from 0–10000 bps to 8500–10000 bps, and the per-position snapshot constraint to the same range. This prevents any future policy writer from setting a rate below 85%, while allowing values through 100%.
- Updated the policy design specification to reflect 85%–100% configurable payout, per-version authority, and immutable per-position snapshots.
- Added source-level regression assertions for the minimum/maximum bounds, policy-sourced order snapshot, and settlement consumption of the snapshot.

### NOT IMPLEMENTED / NOT VERIFIED
- No administrator policy editor or write endpoint is exposed. The current shared `ADMIN_USER` / `ADMIN_PASS` Basic Auth does not identify individual actors or support safe role separation; actor-specific RBAC and draft/approve/activate audit flow remain prerequisites.
- The 85% floor is enforced in the new migration source only; migration `0025` has not been applied to any database.
- No Node test execution, CI run, PostgreSQL staging execution, or runtime verification is recorded.
- No production database changes, financial writes, cutover enablement, merge, or deployment.

### NEXT
- Design attributable administrator identity and explicit seconds-policy permissions, with separate author/reviewer/activator roles and atomic audit/idempotency/revision checks.
- Then add authenticated read/preview and draft/approve/activate endpoints and admin UI against the versioned policy model; validate only in isolated staging before any release.


## Seconds policy administrator identity and RBAC contract — 2026-11-06

### IMPLEMENTED (design and source guard only)
- Re-read coordination HEAD `bc63a59e4bee8bbb7969685f0fb8f0d6017e0adb` and feature HEAD `c1a65c40683c7305d55d972407580aeab9a27bc3`.
- Added `docs/SECONDS_POLICY_ADMIN_RBAC.md`: proposed dedicated Supabase Auth subject validation, private server-side permission lookup, explicit policy permissions, three-distinct-actor author/reviewer/activator separation, immutable draft/review/activate lifecycle, idempotency/revision/atomic audit contract, and UI/API rollout gates.
- Updated `docs/SECONDS_POLICY_VERSIONING.md` to point to the administrator identity and separation-of-duties contract.
- Added `backend/tests/seconds-policy-admin-rbac-design.test.js` source guard tests. They assert the current shared Basic Auth gate remains the only admin identity path and no seconds-policy write route is exposed before the RBAC implementation is ready.

### NOT IMPLEMENTED / NOT VERIFIED
- This batch is a proposed security contract, not runtime RBAC. No Supabase Auth admin enrollment, role table, policy endpoint, or admin UI was created.
- No Node tests or CI were run; no PostgreSQL staging environment was available/used.
- No SQL migration, database mutation, financial write, cutover change, merge, or deployment was performed.

### NEXT
- Review/approve administrator enrollment and the three-distinct-actor separation model.
- After approval, implement the identity/permission data model and private transition RPCs additively, then validate in isolated staging before exposing API/UI.


## Seconds policy source-contract reconciliation — 2026-11-06 (UTC+8)

- SOURCE OBSERVED: re-read feature branch `feat/btcbox-web3-auth-20261105` at `23ddb41c2866a6ae8c0ec557eb427b94b77ca30b`, coordination branch at `19719fe0ffdd9fc39cc162bb7962970fa46403b4`, migration `0025_seconds_policy_versioning_v1.sql`, and the policy/RBAC specifications.
- FINDING: `docs/SECONDS_POLICY_VERSIONING.md` still claimed current SQL positions did not carry policy version/payout snapshots, although migration 0025 source adds those nullable columns and the order/settlement RPCs write/read the snapshot. The document also blurred target governance design with the narrower migration 0025 implementation.
- PATCHED: corrected the versioning specification to distinguish source-only migration behavior from live database state, list the actual policy/active-pointer/audit tables and grants, describe order/settlement snapshot behavior, and explicitly enumerate the missing administrator membership, review/activation, write-RPC, idempotency, and UI layers.
- ADDED: `backend/tests/seconds-policy-versioning-doc-consistency.test.js` guards the documentation against contradicting migration 0025 and asserts the current service-role read-only/browser-role-denied privilege contract.
- TEST STATUS: regression tests are committed as source but have not been executed locally in this tool session. Exact-head GitHub Actions evidence must be checked before calling the batch CI-verified.
- SAFETY: no Supabase SQL was executed, no migration was applied, no admin roles/users were provisioned, no financial writes, merge, or Vercel deployment occurred. Deployment pause and financial fail-closed state remain unchanged.

## Seconds policy administrator provisioning and recovery contract — 2026-11-06 (UTC+8)

### IMPLEMENTED (design and source guard only)
- Feature commit: `904547a8dfbbb842a58be71ae3d7910f10f23c90`; changed blobs: RBAC `9503fcadb210ee5ae9f9e60a0f0b5228e44bb145`, versioning `38cc5487e5261401e437101d5bdb0a437b65cd01`, tests `5a261788da845e08c3e88b552ab3830480d17d95`. Coordination entry records source HEADs `5fd90c1646d9b7cdcf0b46e58c6cbaec86a590bd` / `98c06349596812306b0374de1c664a63554a3ff5`; the feature branch had advanced beyond the previously recorded RBAC batch, so this change is based on the current branch tip.
- Extended `docs/SECONDS_POLICY_ADMIN_RBAC.md` §11 with explicit enrollment/bootstrap, least-privilege grant and immediate revocation, suspension, emergency recovery, and private-schema/Data API requirements.
- Updated `docs/SECONDS_POLICY_VERSIONING.md` to point to the provisioning and recovery contract.
- Added four source-guard tests for non-self-service enrollment, two-person bootstrap, immediate revocation, break-glass limits, and browser/Data API isolation.
- Reviewed the current Supabase breaking-change index: as of 2026-10-30, new public tables are no longer automatically exposed to the Data API by default. This does not replace explicit verification that the proposed private schema is not in the project's exposed schemas and that grants/RLS are restrictive.

### NOT IMPLEMENTED / NOT VERIFIED
- This is still a design/specification and source-test change. No administrator identities, permission tables, bootstrap function, recovery credential, API route, UI, or runtime RBAC were created.
- The new Node source tests were not executed in this tool session; no PostgreSQL staging validation or CI run is claimed.
- No Supabase SQL was executed, no migration applied, no project settings/secrets changed, and no financial write/cutover, merge, or deployment occurred.

### NEXT
- Before runtime implementation, obtain an isolated staging database and approve the initial administrator enrollment procedure, exact permission grantors, and recovery operators.
- Inspect existing schema privileges/exposed schemas and the complete prerequisite migration chain in that isolated environment; then create the governance migration through the supported Supabase CLI workflow.
- Keep shared Basic Auth admin behavior unchanged and do not expose seconds-policy writes until verified identity, permission lookup, transition RPCs, and audit atomicity pass isolated tests.

## Seconds policy migration SQL syntax correction — 2026-11-06 (UTC+8)

### IMPLEMENTED (source only)
- Re-read feature HEAD `904547a8dfbbb842a58be71ae3d7910f10f23c90` and coordination HEAD `1966033fc61a211f86c2645aeb860a6f6fe8070f`; inspected migration `0025_seconds_policy_versioning_v1.sql` and its existing Node source tests.
- Found a missing statement terminator after the active-policy SELECT in `submit_seconds_order_v1`. The PL/pgSQL `IF NOT FOUND` branch followed the SELECT without a semicolon, making the migration source syntactically invalid.
- Added the missing semicolon without changing policy lookup semantics, transaction ordering, financial ledger behavior, or policy snapshot logic.
- Added a regression source assertion that the active-policy SELECT terminates before the `IF NOT FOUND` branch.

### NOT VERIFIED
- This is a static source correction. No PostgreSQL parser, isolated staging database, Node test run, or CI workflow result is available in this turn; therefore SQL runtime validity is NOT VERIFIED.
- No migration was applied, no production or staging database was modified, no financial write/cutover, merge, or deployment occurred.

### NEXT
- Obtain an isolated Supabase development branch or separately provisioned staging project before executing any migration.
- Inspect the exact prerequisite migration chain and validate migration 0025 with PostgreSQL, then test order/settlement and ledger invariants. Do not use production as a substitute for staging.

## Supabase live database and migration-order audit — 2026-11-06 (UTC+8)

### READ-ONLY LIVE OBSERVATIONS
- Queried Supabase project `zlozsutefnmgwwzrlipt` through read-only project inventory tools. Migration registry currently returns only timestamp versions `20261102133555` and `20261103062716`; development branch inventory is empty.
- Live `public.seconds_contract_positions` does not contain the migration-0025 policy snapshot columns (`policy_id`, `policy_version`, `payout_bps_snapshot`, `policy_snapshot`). The versioned policy tables are not present in the table inventory. Therefore migration 0025 is NOT installed in the observed live schema.
- This project records timestamp migration versions, while repository SQL uses four-digit filenames. Existing `backend/tests/migration-status-script.test.js` explicitly rejects direct timestamp-to-four-digit comparisons. Do not map these registries by string ordering or claim that source files 0001–0025 are installed.
- The live Seconds schema includes the base position table and current legacy columns. Repository source dependencies are: 0014 creates Seconds lifecycle; 0015 adds the one-open-position guard; 0024 replaces settlement with request-hash idempotency; 0025 adds policy versioning/snapshots. These prepared source migrations require isolated validation before application.
- Supabase table inventory reports RLS enabled on 14 public tables but no policies for those tables in Security Advisor. A read-only privilege query showed `anon` and `authenticated` have no SELECT/INSERT privileges on those public tables; `service_role` has the expected server-side table privileges (mostly DML, catalog read-only). This is not evidence of browser access, but RLS-without-policies remains an incomplete access-policy posture that must be reviewed before any direct client grants.
- Security Advisor reports RLS disabled on `private.btcbox_state_pre_test_cleanup_backup` and `private.btcbox_auth_test_users_backup`. A read-only privilege check found `private` schema USAGE and table privileges are false for `anon`, `authenticated`, and `service_role`; current API-role access was not observed. Keep these backups inaccessible; decide with the owner whether to enable RLS with no client policies or retain them under an explicitly verified owner-only access model. Do not auto-apply the advisor's suggested RLS-only SQL because it may change intended owner workflows.
- Security Advisor also reports Supabase Auth leaked-password protection disabled. This is a project setting requiring owner review, not changed in this batch.

### SOURCE DOCUMENTATION UPDATED
- Updated `backend/supabase/sql/MIGRATION-ORDER-AND-CUTOVER.md` to include prepared migrations 0023 (shared rate limiter), 0024 (Seconds settlement idempotency), and 0025 (Seconds policy versioning), their dependencies, and the timestamp-registry mapping warning.
- Added a source test guarding the documented ordering and dependency notes.
- No SQL was executed except read-only catalog SELECTs. No database DDL/DML, migration application, settings changes, secret reads, financial writes, cutover, merge, or deployment occurred.

### VALIDATION STATUS
- Live database observations are read-only evidence from 2026-11-06; they are not proof of every migration's historical application path.
- New Node test source was added but not executed. No CI run or PostgreSQL staging validation is claimed.
- The two private backup tables' RLS finding remains open; the 14 public no-policy findings remain a review item, with anon/authenticated table privileges confirmed absent in the observed query.

### NEXT
- Do not apply migration 0025 to production. Obtain an isolated staging project, map timestamp migration history to actual schema, apply the reviewed ordered chain there, and validate SQL/RPC/ledger invariants.
- Review the two private backup tables' retention and owner-only access model; separately review the 14 public RLS tables before granting any browser-role access.
- Review and enable leaked-password protection through the owner-approved Auth settings workflow.

## Supabase least-privilege follow-up — 2026-11-06 (UTC+8)

### Additional READ-ONLY privilege evidence
- Expanded catalog checks across all 14 observed `public` tables and both `private` backup tables. For every returned table, effective `PUBLIC`, `anon`, and `authenticated` privileges were false for SELECT, INSERT, UPDATE, and DELETE.
- Both private backup tables are owned by `postgres`, have RLS disabled and FORCE RLS disabled, but `private` schema USAGE and all four table privileges remain false for `PUBLIC`/API roles. This establishes current API-role inaccessibility, not an absence of defense-in-depth risk.
- Enumerated `SECURITY DEFINER` functions in `public`: only `rls_auto_enable()` was returned. It has fixed `search_path=pg_catalog`, owner `postgres`, and effective EXECUTE is false for `PUBLIC`, `anon`, and `authenticated`.
- These are point-in-time catalog observations; they do not prove all future default privileges or external connection roles. No SQL writes were made.

### Source guard added
- Added `backend/tests/supabase-privilege-contract.test.js` to assert the intended server-only privilege model in prepared migrations 0023 and 0025: RLS enabled, browser-role revokes, service-role-only RPC execution, and no direct policy-table DML grants to service_role.
- The source test is a static contract guard only; it does not execute SQL or prove live database state.

### Supabase CLI v3 compatibility note
- Supabase changelog announced CLI v3 as a breaking change on 2026-11-04: database commands default to local; hosted operations require explicit `--remote`, and unattended hosted changes require `--yes`. Current repository CI workflows do not invoke Supabase CLI, so no current workflow change was made. Any future staging scripts must pin the intended CLI major and explicitly select the staging target; never target production by default.


## Vercel build and CI trigger investigation — 2026-11-06 (UTC+8)

### READ-ONLY VERCEL EVIDENCE
- Queried the linked BOX team using its current team ID `team_tnwJkMYPnWK2BjBGf3Q2n3FB`. The team plan returned by Vercel is `hobby`; the linked project is `btcboxcdt` (`prj_rmwOE9q0XyZ3BikpxX2FzDt2VjKK`).
- The latest 30 deployment records include repeated builds across several branches, with READY, ERROR, CANCELED, and BLOCKED states. This confirms substantial deployment churn in the inspected window, but does not establish the exact quota accounting or prove that concurrency alone caused the build-rate-limit status.
- The latest READY deployment in the returned page was commit `d44d8d693ed026a4479b6fdc3d05bcbef2827a58` on `feat/btcbox-web3-auth-20261105`.
- The current feature source commit `80dde835ec58b8f0ca62fab51c4d4f545de73376` has no matching Vercel deployment record in the exact-SHA query. Its GitHub combined status still reports Vercel context `Vercel – btcboxcdt` as failure with target `https://vercel.com/fuyao999?upgradeToPro=build-rate-limit`.
- A previous deployment for commit `8182397a4066d0ac8811e5e992eae175c64c8f4e` failed during TypeScript compilation in `frontend/src/features/auth/AuthPages.tsx` because imports/identifiers such as `useAuth`, React hooks, router components, UI components and icons were unresolved in that historical source snapshot.
- The current feature branch version of `AuthPages.tsx` (blob `75d899646079bce4f857afec644739effa67588d`) contains explicit imports for those identifiers. Therefore the observed TypeScript failure is historical and is not evidence that the current branch file still has that exact defect. The subsequent READY deployment is consistent with a later build succeeding, but does not prove the exact current commit was built.

### CI WORKFLOW SCOPE
- The current feature branch's `.github/workflows/frontend-ci.yml` includes `feat/btcbox-web3-auth-20261105` in its push branch filter and runs frontend lint/build.
- The current feature branch's `.github/workflows/backend-ci.yml` also includes this branch in push and pull_request filters and covers `backend/**`, including the new source-contract test.
- The available commit-workflow lookup returns only pull-request-triggered runs. Its empty result is therefore not evidence that push-triggered runs did not execute. No successful CI run is claimed from this lookup.
- No workflow file change was necessary based on the inspected current feature branch contents.

### NEXT / SAFETY
- Keep the Hobby plan and Vercel project/team settings unchanged; do not upgrade, transfer projects, cancel deployments, or create another deployment without the user's explicit approval.
- Avoid unnecessary pushes that trigger repeated Vercel builds. First obtain the exact current GitHub Actions push-run result through a workflow-runs listing capability, then reconcile the Vercel build-rate-limit status with the plan's actual usage/limit information.
- Do not merge, deploy, modify production settings, or change financial cutover flags. The TypeScript failure above is historical evidence; the exact current commit remains without a matching Vercel deployment in the inspected history.


## CI recovery and exact-commit verification — 2026-11-06 (UTC+8)

### Failure evidence from prior feature commit
- Retrieved GitHub Actions push run `42137012101` for feature commit `80dde835ec58b8f0ca62fab51c4d4f545de73376`. The unified build succeeded; backend tests failed (238 total, 233 passed, 5 failed), causing later fail-closed checks to be skipped.
- The five failures were test-contract defects, not a demonstrated runtime regression:
  1. RBAC design test resolved `../../docs` outside the repository checkout; corrected to `../docs`.
  2. Policy doc-consistency test had the same incorrect docs path for both specifications.
  3. Policy versioning test prohibited every `FOR UPDATE` in the order RPC, including the intentional idempotent replay lock. Narrowed the assertion to the active-policy lookup only; replay locking remains separately asserted.
  4. Minimum-stake test's broad negative regex also matched the valid maximum-stake check. Narrowed it to reject only a hard-coded numeric-floor comparison in the API handler.
  5. Server-authoritative settlement test used a market-route delimiter that appears before the settlement handler. Corrected the section boundary to the next seconds-positions route.
- No financial SQL, API business logic, payout rules, cutover flags, or production database objects were changed in this repair.

### Repair and successful verification
- Feature commit: `c351c9de1671a93004d7ddda0021df5441672bee`, parent `80dde835ec58b8f0ca62fab51c4d4f545de73376`.
- Changed only four backend test files: `seconds-policy-admin-rbac-design.test.js`, `seconds-policy-versioning-doc-consistency.test.js`, `seconds-policy-versioning.test.js`, and `seconds-server-authoritative-rules.test.js`.
- Exact GitHub Actions push run `42138365542` for that SHA completed with conclusion `success` at `2026-11-06T00:39:34Z`. All steps succeeded: dependency install, unified site build, backend tests, fail-closed deployment configuration validation, unified output verification, and preserved entrypoint verification.
- Exact commit's GitHub combined status reports `Vercel – btcboxcdt` = `success`, target `https://vercel.com/fuyao999/btcboxcdt/5cXWxiFrTSTiehvjZ3NdhK6QEUhq`. This supersedes the earlier build-rate-limit failure status on commit `80dde...`; no plan upgrade or project transfer was made.
- This is source/CI verification only. No Supabase migration was applied, no staging database was created, and no merge or production cutover/deployment was performed.

### Next
- Continue from feature SHA `c351c9de1671a93004d7ddda0021df5441672bee`.
- With build and test gates green, proceed to the next backend integration review and identify any remaining source-only vs live-staging gaps. Keep financial writes and policy activation disabled until isolated staging and explicit approval.

## Seconds order idempotent response consistency — 2026-11-06 (UTC+8)

### SOURCE REVIEW / PATCH
- Re-read coordination HEAD `bbd15940d1bfdd64c0db37ab198ea67249f15100` and feature HEAD `c351c9de1671a93004d7ddda0021df5441672bee`.
- Found that `submit_seconds_order_v1` returned only the position ID/status/settlement time for an idempotent replay, while `/api/seconds/order` returned the newly fetched market sample as `open_price`. A replay could therefore display a price different from the persisted opening price.
- Updated migration 0025 source so both new-order and duplicate RPC responses include the authoritative persisted/opening price. Updated the API to require and display that database-confirmed value; duplicate responses label the source as `stored_reference`.
- Added `backend/tests/seconds-order-idempotency-response.test.js` to guard both RPC response paths and API response selection.
- Feature commits: `879e4c799ac00a0cb170d4c735cdcc6489d57db8` (implementation) and `a72330711f632830d2756f0fdfce5b343010774d` (test regex correction). Current feature HEAD is `a72330711f632830d2756f0fdfce5b343010774d`.

### VALIDATION / RELEASE BOUNDARY
- SOURCE OBSERVED: exact feature branch head points to `a72330711f632830d2756f0fdfce5b343010774d`; commit diff contains only `backend/api-core.js`, `backend/supabase/sql/0025_seconds_policy_versioning_v1.sql`, and the new source test.
- NOT VERIFIED: Node test execution, PostgreSQL parsing, migration execution, and staging behavior. GitHub Actions workflow-runs lookup for the exact SHA returned zero runs; no passing CI is claimed.
- Vercel combined status for the exact SHA reports `Vercel – btcboxcdt` failure with the build-rate-limit upgrade target. No plan upgrade or project-setting change was made.
- No migration was applied, no database or financial writes, no policy activation, no merge to main, and no production deployment.

### REMAINING FOLLOW-UP
- Idempotent replay still fetches a live reference price before calling the RPC. If all reference feeds are unavailable, the API can fail before the database gets a chance to replay an already-created order. A follow-up should allow a replay lookup without accepting a missing price for a genuinely new order, with a regression test.
- Continue to keep seconds policy write APIs/UI disabled until attributable administrator identity, permissions, approval transitions, and isolated staging validation exist.


## Seconds order replay during market-feed outage — 2026-11-06 (UTC+8)

### IMPLEMENTED (feature source)
- Re-read coordination entry point on chore/shared-ai-coordination and feature branch head a72330711f632830d2756f0fdfce5b343010774d before editing.
- Fixed the retry path for an already-created Seconds order when both market reference feeds are unavailable: the API now attempts the idempotent database RPC even when it cannot fetch a fresh reference price.
- Reordered the SQL RPC checks so it first locks and checks the existing open_request_id; a matching request returns the persisted position/open price/settlement time without needing a new feed sample.
- For a genuinely new request, the RPC now rejects NULL/non-positive opening prices with REFERENCE_PRICE_REQUIRED. The API maps that response to REFERENCE_PRICE_UNAVAILABLE; no new order is created without a valid server reference.
- Preserved the existing request-hash/user ownership conflict check, active policy lookup, balance row lock, atomic ledger writes, and immutable policy snapshot behavior.
- Added source-contract assertions covering replay-before-price-validation and the API's nullable feed-price replay attempt.
- Feature commit: 6ef4a5344fedfea667fec4226093bb0a247c02ed (parent a72330711f632830d2756f0fdfce5b343010774d); changed only backend/api-core.js, backend/supabase/sql/0025_seconds_policy_versioning_v1.sql, and backend/tests/seconds-order-idempotency-response.test.js.

### VALIDATION / RELEASE BOUNDARY
- SOURCE OBSERVED: exact feature branch ref advanced to 6ef4a5344fedfea667fec4226093bb0a247c02ed; commit diff reviewed and limited to the three files above.
- CI: GitHub Actions backend workflow run 42139779249 was observed in progress at 2026-11-06T00:51:03Z; no passing result is claimed until the run completes.
- Vercel combined status for the exact SHA reports Vercel – btcboxcdt failure with the Hobby build-rate-limit upgrade target. No plan upgrade or project setting change was made.
- NOT VERIFIED: Node test execution result until CI completion, PostgreSQL parsing/runtime behavior, live feed-outage replay, migration application, and isolated staging behavior.
- No database writes, migration application, financial test transaction, policy activation, merge to main, or production deployment occurred.

### NEXT
- Retrieve the final status and job logs for backend workflow run 42139779249; repair any failing source guard before moving on.
- Obtain isolated Supabase staging before applying migration 0025 or testing the financial RPC. Keep policy write APIs/UI and all financial cutover flags disabled.


## Seconds policy RBAC implementation-readiness review — 2026-11-06 (UTC+8)

### REVIEWED SOURCE / EXISTING SECURITY PERIMETER
- Re-read shared coordination branch and current feature head 6ef4a5344fedfea667fec4226093bb0a247c02ed.
- Reviewed docs/SECONDS_POLICY_ADMIN_RBAC.md, backend/tests/seconds-policy-admin-rbac-design.test.js, backend/tests/supabase-privilege-contract.test.js, backend/tests/seconds-policy-versioning.test.js, backend/api-core.js, and migration 0025.
- Current adminAuth() accepts one shared ADMIN_USER / ADMIN_PASS Basic Auth identity. It is not attributable to separate human administrators. Existing admin audit records using the configured username or generic admin cannot satisfy three-person policy approval.
- Existing 0025 policy tables are in public but RLS-enabled and revoked from PUBLIC/anon/authenticated; service_role has SELECT on policy and active-pointer tables but no direct INSERT/UPDATE/DELETE. Order/settlement RPCs are service-role-only. This is the current source contract, not proof of the live database catalog.
- Existing policy audit action enum covers seed/draft_created/activated/retired only. It is not a complete administrator membership, permission grant/revocation, review/rejection, idempotency, or security-event ledger.
- The active pointer has no approved administrator transition API/RPC. Do not use service_role direct table writes as a substitute for reviewed policy transitions.
- The current source test explicitly prevents seconds-policy routes from being added under the shared Basic Auth perimeter. Keep that guard.

### REQUIRED ADDITIVE DATA MODEL BEFORE RUNTIME POLICY ADMIN
- Dedicated private, non-Data-API schema objects are required for administrator membership, permission grants, policy review decisions, transition idempotency, and administrator security audit. Keep existing public policy rows inaccessible to browser roles.
- Membership must key to validated Supabase Auth UUID, have an explicit lifecycle state and monotonically increasing revision. Permission grants must use a strict allowlist and retain grantor UUID, reason, ticket/change reference, timestamps, and optional expiry. No email, metadata, caller-supplied role, or shared Basic Auth username may be the authority key.
- Policy review must bind the reviewer to the exact immutable policy ID/version and canonical content hash. Any edit creates a new immutable version and invalidates earlier review.
- Transition requests must bind actor UUID, action, target policy/version, expected membership/policy revision, request ID, and canonical request hash. Identical retries replay the original result; mismatched retries conflict.
- A private transition function must revalidate live membership and the exact permission inside the same transaction as state transition and append-only audit. It must enforce distinct author/reviewer/activator UUIDs, revision checks, effective-window conflict checks, and atomic rollback on audit failure.
- Do not create a public SECURITY DEFINER endpoint. If SECURITY DEFINER is genuinely required for a private transition, pin search_path, qualify every object, revoke PUBLIC/anon/authenticated execution, grant only to the trusted server role, and independently review owner/bypass-RLS behavior.
- Administrator enrollment/bootstrap is separate from policy lifecycle. No public bootstrap route; first provisioning is owner-controlled and two-person approved, then bootstrap is disabled. Recovery grants are temporary, audited, and cannot activate policies or open financial cutover.
- The frontend remains read-only until the complete authenticated API exists; it must not write policy tables or receive service credentials.

### IMPLEMENTATION GATE / NEXT WORK
- This pass is a source review and implementation-readiness contract only. No SQL migration, API route, admin UI, administrator membership, permission grant, or production setting was created or changed.
- The repo's only connected Supabase project has no isolated staging branch/environment available in the reviewed state. Do not apply migration 0025 or build privileged transition functions against production.
- Next safe implementation step is to obtain an isolated Supabase staging project, then create and validate a dedicated private-schema RBAC migration and transition RPCs there. Until then, keep the policy write surface absent and financial cutover closed.


## Seconds policy RBAC concrete schema contract — 2026-11-06 (UTC+8)

### IMPLEMENTED (documentation + source guard only)
- Re-read coordination HEAD ecf7df7dc2e2155985f6c7cc99ebb90f6dee4814 and feature HEAD 6ef4a5344fedfea667fec4226093bb0a247c02ed before editing.
- Extended docs/SECONDS_POLICY_ADMIN_RBAC.md with the concrete isolated-staging data contract: Auth-UUID membership, append-only permission grant events, immutable exact-version review decisions, actor/action/object/revision-bound idempotency, and append-only administrator security audit.
- Specified membership/policy revision checks, live permission revalidation, distinct author/reviewer/activator, atomic activation plus audit, and retirement behavior that preserves open-position snapshots.
- Clarified a PostgREST boundary: private schema remains non-exposed; because current backend uses REST RPC, a private RPC cannot be assumed callable. If REST is retained, only a tightly permissioned SECURITY INVOKER public wrapper is allowed, with no direct service-role table DML and no public SECURITY DEFINER wrapper. Otherwise use a separately authenticated direct DB connection.
- Extended backend/tests/seconds-policy-admin-rbac-design.test.js with source-contract assertions for the schema model and invocation boundary.
- Feature commit: 4bc5dc34ea8b45096183cdf7216324401a2369d0 (parent 6ef4a5344fedfea667fec4226093bb0a247c02ed); changed only docs/SECONDS_POLICY_ADMIN_RBAC.md and backend/tests/seconds-policy-admin-rbac-design.test.js.

### VERIFICATION / RELEASE BOUNDARY
- Exact GitHub Actions push run 42140415210 completed with conclusion success. All steps succeeded: backend dependency install, unified site build, backend tests, fail-closed deployment configuration validation, and unified output/preserved-entrypoint checks.
- Exact SHA combined status still reports Vercel – btcboxcdt failure with Hobby build-rate-limit upgrade target. No plan upgrade or project setting change was made.
- This is a design/source-guard contract only. No executable RBAC migration, administrator identity endpoint, policy write route, UI, membership, permission grant, Supabase database write, or staging database was created.
- No merge to main, production deployment, policy activation, or financial cutover occurred.

### NEXT
- Isolated Supabase staging is still a hard prerequisite. Before implementation, validate the actual Data API exposed-schema setting and PostgREST role behavior; then generate a migration through the pinned Supabase CLI workflow and run catalog/adversarial tests against staging.
- Keep seconds policy write surface absent and all financial cutover flags closed until the full runtime identity, RBAC, separation-of-duties, and atomic audit path is proven.


## Super Admin / delegated Admin model — implementation contract updated 2026-11-06 (UTC+8)

- User clarified the intended admin model: one Super Admin has all permissions and can create ordinary Admins and configure their permissions. The former mandatory three-person author/reviewer/activator workflow is not part of the product requirement.
- Feature commit `d22d964e0d4864d24dd6bd3eedc300970c641f23` updates `docs/SECONDS_POLICY_ADMIN_RBAC.md` and `backend/tests/seconds-policy-admin-rbac-design.test.js`. It records the Super Admin as the only administrator-provisioning authority, ordinary Admins as explicit least-privilege permission holders, protected Super Admin authority, live Auth/permission validation, and append-only audit.
- A follow-up source correction removes stale three-person assertions and contradictory author/reviewer bullets. The policy versioning, reasons, idempotency, revision checks, immutable open-position snapshots, and fail-closed behavior remain.
- Scope is documentation and static source-guard only. Runtime administrator APIs, administrator UI, RBAC migration, initial Super Admin provisioning, and permission grants are NOT IMPLEMENTED. No Supabase writes or migration, merge, or production deployment occurred.
- GitHub Actions push run for the exact final SHA is being checked; no pass is claimed until completed. Isolated Supabase staging remains unavailable.


## Super Admin model source-guard CI repair — 2026-11-06 (UTC+8)

- The first CI run for the initial Super Admin contract commit `b694f74b7cc3da5a7d9783ae7af589f85846b2e0` exposed two stale source assertions: one expected the older three-distinct-actor model, and another expected a wording variant for ordinary-admin provisioning.
- Follow-up commit `d22d964e0d4864d24dd6bd3eedc300970c641f23` removed stale three-person assertion strings and outdated author/reviewer restrictions, but CI run `42140915024` still failed two documentation-contract assertions (254/256 tests passed). The unified site build succeeded; backend tests failed, so later fail-closed/output checks were skipped.
- Corrective commit `10186811d10fe9737a348f34ff6b33de9dd66fde` aligns the policy-versioning documentation consistency test with the Super Admin/delegated Admin contract and uses the explicit ordinary-admin provisioning restriction wording.
- Final exact-SHA backend CI run is pending. No test pass is claimed yet.
- No runtime RBAC code, SQL migration, admin UI, Supabase write, financial cutover, merge, or deployment occurred.


### FINAL EXACT-SHA CI RESULT
- Feature SHA `10186811d10fe9737a348f34ff6b33de9dd66fde` — GitHub Actions backend CI run `42141050137` completed `success` at `2026-11-06T01:02:37Z`.
- All job steps succeeded: dependency install, unified site build, backend tests, fail-closed deployment configuration validation, and unified output/preserved entrypoint verification.
- Earlier failed run `42140915024` on `d22d964e0d4864d24dd6bd3eedc300970c641f23` was corrected; it had 254/256 tests passing and failed only stale doc-contract assertions. The final exact SHA above is the passing result.
- This verifies source/build/test contracts only, not runtime Supabase RBAC behavior. No isolated staging, migration, administrator account, role grant, financial operation, merge, or deployment was performed.


## Delegated administrator permission catalogue — 2026-11-06 (UTC+8)

- Added an initial closed permission-key catalogue to `docs/SECONDS_POLICY_ADMIN_RBAC.md` for dashboard, users, KYC, deposits, withdrawals, orders, support, announcements, system configuration, seconds policy, financial audit, and reviewed balance-adjustment requests.
- Added static assertions for the allowlisted module permissions and the rule that administrator provisioning/permission assignment is reserved exclusively to the Super Admin.
- Feature commit: `6dfd82cfb69b1a39e7acc2666366309219733398`. This remains a design/source-contract milestone only; no runtime authorization code, admin UI, database schema, migration, membership, or grant has been implemented.
- Financial permissions do not bypass existing backend cutover flags, transaction RPCs, balance invariants, idempotency, security checks, or audit.
- Exact-SHA backend CI is pending; no result is claimed until completion. No Supabase writes, merge, or production deployment.


## Runtime RBAC policy-helper foundation — 2026-11-06 (UTC+8)

### Product authority model (supersedes earlier contradictory notes)
- One owner-controlled Super Admin has all backend admin permissions and is the only authority allowed to provision ordinary Admin accounts and grant/change/suspend/revoke their permissions.
- Ordinary Admins receive explicit permissions from the closed allowlist only. They cannot manage administrators or change Super Admin authority.
- Super Admin can complete seconds-policy management without a mandatory three-person author/reviewer/activator process.
- Any older notes in this document requiring two-person bootstrap, three-person policy approval, or requiring all RBAC work to wait for staging are superseded as product requirements. Staging remains mandatory before database migrations, live administrator provisioning, or runtime activation against Supabase.

### Implemented source in feature branch
- Feature commit: `dd009a154a4dca8cdc2093f78e8bcd366a17d1e3`.
- Added `backend/admin-rbac.js` with a closed permission catalogue, strict normalization (unknown, wildcard, malformed, duplicate values rejected), active-membership checks, Super Admin full permission behavior, and exclusive administrator-management capability.
- Added `backend/tests/admin-rbac.test.js` covering allowlist integrity, grant normalization, Super Admin access, least-privilege Admin access, suspended/revoked fail-closed behavior, and resistance to request-shaped role fields.
- The module is intentionally a pure policy-helper layer. It does NOT authenticate tokens, load membership from a protected database, expose routes, provision users, persist grants, or replace the legacy shared Basic Auth admin login. It must only be called with membership data obtained from a trusted server-side source after trusted Auth validation.
- Existing admin routes are unchanged in this batch. No financial permissions bypass transaction/cutover controls.

### Validation / release boundary
- Exact-SHA GitHub Actions run lookup currently returns zero runs for `dd009a154a4dca8cdc2093f78e8bcd366a17d1e3`; tests have not been executed in CI yet. No pass claimed.
- No Supabase database writes, migration, live admin account, permission grants, merge to main, or production deployment.


### Exact-SHA CI and tree-integrity verification — 2026-11-06 (UTC+8)
- A first helper commit was found to have been constructed from the wrong base tree. Before proceeding, the feature branch was repaired by rebuilding from the exact tree of parent feature commit `6dfd82cfb69b1a39e7acc2666366309219733398`. Compare API confirms the repaired feature commit changes exactly two files relative to that parent: `backend/admin-rbac.js` and `backend/tests/admin-rbac.test.js`; no existing files or layouts are removed or rewritten.
- Repaired feature commit: `b4471ac6462194e2c1bfc4a695754fec17729698`.
- Exact backend CI run `42141737708` completed with conclusion `success`: unified build, backend tests, fail-closed deployment configuration, and output/entrypoint checks all passed.
- Exact frontend CI run `42141737685` completed with conclusion `success`: lint and build passed.
- The policy-helper module is still not runtime-connected to the legacy admin routes. It does not yet authenticate the Supabase token or load membership/grants from a protected store. Do not describe RBAC as live/active.
- No Supabase migration/write, admin provisioning, permission grant, merge to main, or production deployment.


## Supabase Auth token verification foundation — 2026-11-06 (UTC+8)

- Re-read coordination HEAD `f4130b0a822becd65f1b92c3acf8877509496a78` and feature HEAD `b4471ac6462194e2c1bfc4a695754fec17729698` before this batch.
- Added `backend/admin-auth.js`: strict bounded Bearer parsing; HTTPS-only Supabase Auth configuration; server-side GET to `/auth/v1/user` with the configured publishable/anon key and caller access token; canonical UUID validation; anonymous Auth users rejected; upstream failures fail closed as 503. It does not decode JWT claims for identity or roles and returns only the Auth user UUID.
- Added `backend/tests/admin-auth.test.js` covering token parsing, config validation, canonical identity from Auth response, rejection of request/user_metadata role claims, missing credentials, anonymous/non-UUID identities, Auth 401/403, upstream failures and network errors.
- Supabase docs were checked for JWT verification. For HS256/shared-secret projects, Supabase documents verifying the access token directly against Auth `/auth/v1/user`; JWT payload decoding alone is not a trust decision. Relevant doc: https://supabase.com/docs/guides/auth/jwts.
- Feature commit: `5e8d008e43887d8228e1962157e0c048e5ad9006` (parent `b4471ac6462194e2c1bfc4a695754fec17729698`). Compare API confirms exactly two added files: `backend/admin-auth.js` and `backend/tests/admin-auth.test.js`.
- Exact-SHA GitHub Actions backend run `42142544961` completed `success`; unified site build, backend tests, fail-closed deployment configuration validation, preserved output/entrypoint checks, and cleanup all passed.
- Exact-SHA Vercel combined status: `success` (preview check). No production deployment was requested or initiated.
- This is still an isolated identity-verification helper only. It is NOT wired into admin routes, does not load protected membership/grants, does not create the private admin store or bootstrap Super Admin, and does not replace legacy Basic Auth. No SQL migration, Supabase database write, live admin provisioning, permission grant, merge to main, or production deployment occurred.
- Next safe batch: design and test the protected private-schema membership/grant storage contract and Super Admin owner-controlled bootstrap; keep it source-only until an isolated staging database exists. Then connect verified Auth UUID -> live membership lookup -> closed permission helper in a parallel admin API surface, without breaking current Basic Auth until migration is tested.


## Private delegated-admin storage source — 2026-11-06 (UTC+8)

### Implemented on feature branch
- Re-read coordination HEAD `2fc3e43126452276972a8b3be3a1eba468bcef5a` and feature HEAD `5e8d008e43887d8228e1962157e0c048e5ad9006` before this batch.
- Added source-only SQL `backend/supabase/sql/0026_admin_rbac_private_store_v1.sql`:
  - non-exposed `private` schema; membership keyed by Supabase Auth UUID; one-Super-Admin partial unique index;
  - closed permission catalogue matching `backend/admin-rbac.js`;
  - append-only permission grant/revoke events and security audit;
  - revisioned memberships, expected-revision checks, request-hash idempotency and transaction-scoped duplicate-request serialization;
  - owner-only one-time `postgres` SQL bootstrap (no default user or HTTP bootstrap route);
  - trusted-server-only membership lookup and Super-Admin-only provision/set-permissions/suspend/reactivate/revoke transition functions;
  - RLS enabled, PUBLIC/anon/authenticated/service_role table DML revoked; service_role receives only private schema USAGE and narrowly scoped function EXECUTE.
- Updated `docs/SECONDS_POLICY_ADMIN_RBAC.md` to record the schema, invocation boundary, optimistic revision requirement and product-owner bootstrap model. Updated stale source guard wording that contradicted the one-owner Super Admin decision.
- Added `backend/tests/admin-rbac-schema.test.js` for private schema/RLS/privilege boundaries, closed permission catalogue, bootstrap protection, append-only audit, revision checks, idempotency, Super Admin-only management and source-only rollout.
- Feature commit: `fbfb96ee26ff8bce6637f2ca11cbf21f0644c928`. Compare API against prior feature HEAD `5e8d008e43887d8228e1962157e0c048e5ad9006` confirms exactly four paths changed: the new SQL source, new schema source tests, RBAC design doc, and the existing RBAC design test.
- Exact-SHA backend CI run `42144478167` completed `success`: unified site build, all backend tests, fail-closed configuration validation, preserved output/entrypoint checks and cleanup passed.
- Exact-SHA Vercel combined status: `failure` with the known Hobby build-rate-limit upgrade target. This is not a GitHub CI failure; no plan or project setting was changed.

### Hard rollout boundary / not yet validated
- The SQL migration was NOT applied to any Supabase database. No isolated staging database was available; SQL parser/runtime/catalog/role behavior and concurrency have NOT been validated against PostgreSQL.
- No Super Admin or ordinary Admin was provisioned; no permission was granted; no existing Basic Auth route was changed; no API route or admin UI was connected.
- The private schema is intentionally not exposed to PostgREST. The service-role function grants alone do not make private RPCs callable through REST. Before integration, choose and test a trusted invocation path (dedicated direct DB connection or a narrowly reviewed SECURITY INVOKER public wrapper) without exposing private schema or granting direct table DML.
- The trusted backend must validate Supabase Auth first and derive actor UUID from the Auth response; never trust a caller-supplied actor ID. The SQL transition functions rely on that trusted-server boundary.
- Do not apply `0026` to production. Next step is isolated-staging SQL/catalog/adversarial validation, then a parallel API integration and tests; preserve legacy Basic Auth until that new path is proven. No merge to main or production deployment.

## Current user decisions — authoritative correction (2026-11-06 UTC+8)

### Professional trading terminal layout
- The current approved professional trading terminal baseline is **V211**. V161 is historical context only and must not be treated as the current layout baseline.
- Future trading-page work must preserve V211's approved structure and visual direction. Do not revert to V161 or to the older simplified page.
- The user has authorized necessary, carefully scoped trading-page layout/interaction refinements; make one bounded change at a time and inspect it before proceeding. Do not infer permission for a wholesale redesign or changes to trading/financial business logic.
- Before any trading-page edit, inspect the actual V211 source/snapshot and record the exact path/commit evidence. If V211 cannot be positively identified in the repository, stop and report the missing source rather than guessing what V211 contains.

### Administrator authority model
- The authoritative product model is one owner-controlled **Super Admin** with all backend administrator permissions.
- Super Admin alone may create, configure, suspend, reactivate, and revoke ordinary Admin accounts and their explicit allowlisted permissions. Ordinary Admins cannot manage administrators or elevate their own permissions.
- Do **not** require three distinct people as author, reviewer, and activator. Mandatory three-person/separation-of-duties approval is superseded and is not a product requirement.
- Preserve technical safeguards: validated Supabase Auth identity, live server-side membership/permission checks, immutable policy versions/snapshots where relevant, revision checks, idempotency, transactional audit, and fail-closed financial controls. These safeguards do not reintroduce a multi-person approval requirement.
- Staging remains mandatory before applying database migrations, provisioning live administrators, or activating runtime RBAC against Supabase. No production database experiments.

### Conflict resolution
- This section supersedes any older coordination text that describes V161 as the current terminal baseline or mandates three-person seconds-policy approval. When older notes conflict, follow V211 and the single-Super-Admin model above.


## Integration reconciliation refresh — 2026-11-06

- Detailed current source/branch/route/build/CI reconciliation recorded in `docs/INTEGRATION_RECONCILIATION_2026-11-06.md`.
- Audit report commit: `2f94d4f8e1a2a4aa1cb5a5ff715d5a4ff8d468a0` on `chore/shared-ai-coordination`.
- Current main observed at `14a8e361fd928626d4e350a03698135f0c49ceea`; coordination HEAD before this report was `06e1b635724cbbcd4ff44e14814e3ee868f1cb98`.
- Current comprehensive implementation candidate: `feat/btcbox-web3-auth-20261105` at `fbfb96ee26ff8bce6637f2ca11cbf21f0644c928`; GitHub compare reports 374 ahead / 0 behind main. Exact-SHA GitHub Actions run `42144478167` passed; Vercel status failed only due deployment rate limiting. This candidate is not merge-ready and has not been independently browser-QA'd.
- No open PRs were returned by GitHub at refresh. Do not create a broad merge until candidate diff and route-level QA are complete.
- V211 source path remains unverified; no trading page edits are authorized until the exact approved source/snapshot is identified.
- User reports all test Auth users cleared; Supabase was not queried during this audit. Do not delete business schema/configuration or migration history.
- No main merge, production deployment, Supabase write, or destructive operation occurred.


## Candidate ancestry and page audit follow-up — 2026-11-06

- Updated reconciliation report: `docs/INTEGRATION_RECONCILIATION_2026-11-06.md`, latest report commit `e7158b06f6095fb032672230e6f2e0a2a4dae641`.
- Pairwise compare confirms candidate `fbfb96ee26ff8bce6637f2ca11cbf21f0644c928` descends from React Google Auth, Strata theme batch, no-fake-market-data fix and UI i18n/mobile branch histories. The old template migration branch remains diverged and its pinned vendor submodules are not in the candidate tree.
- Candidate SecondsPage is read-only positions/history with safe loading/error/cutover states; order placement/settlement are disabled. Candidate React routes for spot entry, orders, deposit, withdrawal, Earn, KYC and support remain placeholders. Admin UI remains absent and Basic Auth remains the active legacy route. No V211 source has been positively identified.
- No source implementation, database write, merge, or deployment was performed in this audit batch; the durable work is the current evidence ledger and branch/route disposition.


## Implementation batch — authenticated assets and orders — 2026-11-06

- Reconciliation detail updated in `docs/INTEGRATION_RECONCILIATION_2026-11-06.md`, commit `388805544cda4c984502ea147591f225b55e43b3`.
- On `feat/btcbox-web3-auth-20261105`, added authenticated, read-only Orders and Assets pages backed by existing `getOrders` and `getAccount` clients; protected the orders route; implemented loading/error/retry/empty states and accurate valuation-completeness display.
- Candidate head at report time: `403fc12d679b11590e5eaf5c8e8aaae15f33d99a`. CI run `42149902764` was still in progress; prior CI caught and identified a literal escaped newline syntax issue in App.tsx, corrected in this head. Await final CI result before claiming validation.
- No merge, PR, deployment, Supabase write, or financial transaction.


## Implementation batch — authenticated My Account profile — 2026-11-06 (UTC+8)

- Continued on `feat/btcbox-web3-auth-20261105`, starting from candidate `403fc12d679b11590e5eaf5c8e8aaae15f33d99a`.
- Implemented the `/me` account overview in `frontend/src/features/pages/Pages.tsx` using the existing authenticated `getAccount(signal)` client and `useAuth()` session state.
- Authenticated users now see the backend-returned username/email, KYC status, 2FA status, linked sign-in providers, and a partially masked BTCBOX UID. Unauthenticated users retain sign-in/register links. Loading, request error/retry, and abort cleanup are included.
- No new endpoint, mock profile, balance mutation, financial write, or trading-page change was introduced. The V211 trading terminal was not touched.
- Commits: `645c2221ea01afe566daa92973403d5bb8cb79f2` (profile implementation), `32a14b6a27a5da259fd61f3e8d483776016963d0` (session-hook import correction).
- Exact candidate head after this batch: `32a14b6a27a5da259fd61f3e8d483776016963d0`; GitHub compare against `403fc12d679b11590e5eaf5c8e8aaae15f33d99a` reports 3 commits ahead / 0 behind and exactly one changed path: `frontend/src/features/pages/Pages.tsx` (37 additions, 3 deletions).
- Source re-fetch at the exact head confirms the auth hook import and profile implementation are present. No GitHub Actions run was returned by the PR-run-only lookup; combined status reports only Vercel failure due the existing Hobby build-rate-limit target. Therefore this batch is SOURCE OBSERVED, not TEST PASSED. TypeScript/build and browser behavior remain NOT VERIFIED.
- No merge, PR, production deployment, Supabase write, or financial transaction occurred.


## Follow-up UI truthfulness fix — Seconds capability label — 2026-11-06 (UTC+8)

- On the same implementation branch, corrected the Trade Hub Seconds card to state that real open-position/settled-history viewing is available while new order entry remains disabled. This removes the misleading blanket `API integration pending` label.
- Commit: `ed115174b193dd71132195ff148f9afd5bfd22c5`.
- Exact-head source re-fetch confirms the updated copy. Compare from `403fc12d679b11590e5eaf5c8e8aaae15f33d99a`: 4 commits ahead / 0 behind, one path changed (`frontend/src/features/pages/Pages.tsx`).
- Combined status still reports only the existing Vercel Hobby build-rate-limit failure. No GitHub Actions test result is available for this exact SHA; build/test/browser validation remains NOT VERIFIED.
- No trade-order functionality or V211 layout was changed; no financial writes, merge, or deployment.


## Implementation batch — authenticated KYC status view — 2026-11-06 (UTC+8)

- On `feat/btcbox-web3-auth-20261105`, added `KycPage` using the existing authenticated `getAccount(signal)` response; protected the `/kyc` route with `ProtectedAccountRoute`.
- The page presents backend-returned KYC status, applicant name, document type, and a masked document number; includes loading/error/retry states and a support link. It explicitly says submission is not enabled when no submission exists. No fabricated status, upload flow, or unsupported write endpoint was added.
- Commits: `1790322796ca84e1c3b383569c55e73d878ec766` (KYC status component), `35f77daf6f6a6c2974d4cd0331e88bf6c25f31fa` (protected route).
- Exact SHA source re-fetch: `{"appSha":"d6a5d0e907fbe51f4cb218645ca1b41609f284ba","appRoute":true,"appLazy":true,"pageSha":"f683f3968e21fcb300a284d23cf755154655b152","component":true,"accountData":true}`. Compare from `ed115174b193dd71132195ff148f9afd5bfd22c5`: 2 ahead / 0 behind; files: [{"filename":"frontend/src/App.tsx","status":"modified","additions":2,"deletions":1,"changes":3,"previous_filename":null},{"filename":"frontend/src/features/pages/Pages.tsx","status":"modified","additions":34,"deletions":0,"changes":34,"previous_filename":null}].
- Combined status: [{"context":"Vercel – btcboxcdt","state":"failure","target_url":"https://vercel.com/fuyao999?upgradeToPro=build-rate-limit"}]. No GitHub Actions pass evidence was obtained for this exact SHA; TypeScript/build/browser QA remains NOT VERIFIED. Existing Vercel Hobby build-rate-limit failure is not treated as a code test result.
- No database write, identity-document upload, merge, production deployment, or V211 trading-terminal change.


## Implementation batch — authenticated customer support conversation — 2026-11-06 (UTC+8)

- On `feat/btcbox-web3-auth-20261105`, implemented the customer-facing support conversation using the existing backend routes, not a new or invented endpoint.
- Backend contract verified in `backend/api-core.js`: GET `/api/support/messages` returns the latest 50 account messages and updates the read marker; POST `/api/support/chat` requires authenticated user, validates non-empty content up to 2,000 characters, appends a user message, persists, and returns success. Existing admin reply route writes replies as `from:'admin'`.
- Added validated typed API client functions `getSupportMessages` and `sendSupportMessage`; built the protected SupportPage with real conversation rendering, user/support distinction, loading/error/retry, 2,000-character limit, send state, and warning not to share passwords/2FA/recovery phrases.
- Commits: `a181200457072d20bc20712569770f90728cbd36` (API client), `a859d76a28730540ec90d2396d4421c28a54d02c` (page), `5427529ddd8c8c5cd7d639fd1526ded80c3c21b2` (event type correction), `9e2e2ffb9ad3e713978b970e7bf327118285ea1f` (protected route).
- Exact-head re-fetch verification: `{"apiHasRead":true,"apiHasSend":true,"apiValidatesShape":true,"pageExists":true,"pageUsesRealApis":true,"pageCaps2000":true,"protectedRoute":true,"backendPostExists":true,"backendGetExists":true}`. Compare from `35f77daf6f6a6c2974d4cd0331e88bf6c25f31fa`: 4 commits ahead / 0 behind; files: [{"filename":"frontend/src/App.tsx","status":"modified","additions":2,"deletions":1,"changes":3,"previous_filename":null},{"filename":"frontend/src/features/pages/Pages.tsx","status":"modified","additions":52,"deletions":3,"changes":55,"previous_filename":null},{"filename":"frontend/src/lib/api.ts","status":"modified","additions":39,"deletions":0,"changes":39,"previous_filename":null}].
- Combined status: [{"context":"Vercel – btcboxcdt","state":"failure","target_url":"https://vercel.com/fuyao999?upgradeToPro=build-rate-limit"}]. No GitHub Actions pass result available for this exact SHA; TypeScript/build/browser test remains NOT VERIFIED. Existing Vercel Hobby build-rate-limit status is not a code test result.
- No admin reply code, database schema, Supabase production data, financial write path, V211 trading layout, merge, or deployment was changed.


## Implementation batch — authenticated deposit address and withdrawal review — 2026-11-06 (UTC+8)

- On `feat/btcbox-web3-auth-20261105`, implemented protected `/deposit` and `/withdraw` views backed by existing account endpoints.
- Verified backend contract in `backend/api-core.js`: `POST /api/deposit` with amount zero is address-query-only and returns a configured asset/network address; positive user-supplied amounts are rejected because credit requires on-chain confirmation. `GET /api/addresses` returns the signed-in user's masked saved addresses. `GET /api/account` provides account balances. `POST /api/withdraw` requires an eligible destination, fee, fund password, optional 2FA, idempotency key, and financial ledger cutover; it fails closed with `FINANCIAL_CUTOVER_INCOMPLETE` if the write path is not enabled.
- Added typed readers `getDepositAddress` and `getSavedCryptoAddresses`, supported asset/network validation and response checks. Added deposit page for configured address selection, retry, copy and chain safety warning. Added withdrawal review page showing live balances and masked saved crypto destinations; deliberately no submit action is exposed while financial ledger cutover remains incomplete.
- Commits: `4818b0a350cadccc046a243bb7a438ba2e0a48d7` (API readers), `60d57c6abb1261fd51769aff8b430eabc8e80ff3` (pages), `d0c89b2435161e2805bfd93ef6bda27cfe402cc4` (protected routes), `6ee679080ec3e4f75c14aab8e61bb6ab76b951ff` (legacy address flag compatibility).
- Exact-head source re-fetch checks: `{"depositReader":true,"addressBookReader":true,"depositPage":true,"depositRealEndpoint":true,"withdrawPage":true,"withdrawRealData":true,"withdrawFailClosed":true,"protectedDeposit":true,"protectedWithdraw":true}`. Compare from `9e2e2ffb9ad3e713978b970e7bf327118285ea1f`: 4 ahead / 0 behind; changed files: [{"filename":"frontend/src/App.tsx","status":"modified","additions":4,"deletions":2,"changes":6,"previous_filename":null},{"filename":"frontend/src/features/pages/Pages.tsx","status":"modified","additions":64,"deletions":1,"changes":65,"previous_filename":null},{"filename":"frontend/src/lib/api.ts","status":"modified","additions":37,"deletions":0,"changes":37,"previous_filename":null}].
- Combined status: [{"context":"Vercel – btcboxcdt","state":"failure","target_url":"https://vercel.com/fuyao999?upgradeToPro=build-rate-limit"}]. No PR-associated GitHub Actions workflow run was returned for this SHA; TypeScript/build/browser QA remains NOT VERIFIED. Vercel Hobby build-rate-limit is not a code test result.
- Deposit address lookup is implemented; on-chain deposit detection/history is not implemented in this batch. Withdrawal request submission remains intentionally disabled; no financial write, schema change, Supabase write, merge, deployment, or V211 trading layout change occurred.


## Earn catalog read endpoint batch — 2026-11-06 (UTC+8)

- Re-read this shared coordination document before work. Corrected the earlier incomplete Earn audit: feature source already contains POST /api/earn, atomic subscribe/redeem RPC calls, SQL migrations 0005, 0006, and normalized read migration 0011. Product rates/terms and immutable snapshots are database-defined; fixed early redemption uses the snapshotted early fee. Earn is not a manual-approval workflow in the current SQL contract.
- Added authenticated GET /api/earn/products to backend/api-core.js on feat/btcbox-web3-auth-20261105. It reads only active rows from public.earn_product_catalog using server-side Supabase service credentials, validates shape, and returns actions_enabled from the backend financial-write configuration. Missing table/config or upstream errors fail closed with 503; there is no mock catalog fallback.
- Feature HEAD: 9ad9a3d291be8b0e38ce5f69cc54e96f65115eda. Commits from prior feature HEAD 6ee679080ec3e4f75c14aab8e61bb6ab76b951ff: 2 ahead / 0 behind. Exact compare confirms only backend/api-core.js changed, 25 additions. Commit 7c81554af3b772e4b95e3e7f5938bda12de035c4 added the route; 9ad9a3d291be8b0e38ce5f69cc54e96f65115eda corrected its URL normalization.
- Exact-SHA source re-fetch confirms the route and corrected regular expression. No PR-triggered Actions run was returned; combined status shows only the existing Vercel Hobby build-rate-limit failure. Backend tests/runtime, frontend build, and browser QA remain NOT VERIFIED.
- Frontend API/page wiring is still outstanding. A frontend API write attempt was blocked by the platform safety check and was not retried through another route. No migrations were applied, no Supabase writes or financial operations occurred, and no merge/deployment/trading-layout change occurred.
- The live project migration history previously observed did not include 0006 or 0011. Therefore catalog and normalized earn-position reads are not proven live. Do not apply them to production in this source-only batch. Staging migration validation remains required before financial cutover.
- User's semi-manual operating model is acknowledged. Preserve backend-operated review/exception handling where present (notably withdrawal first-time/large-value manual review); do not invent a manual-approval state for Earn where the current contract has none.


## Earn frontend integration batch — 2026-11-06 (UTC+8)

- Re-read shared coordination document before this batch. Feature branch `feat/btcbox-web3-auth-20261105` now includes a protected `/earn` page, typed Earn catalog/action clients, and account Earn-position typing.
- The page reads the live active product catalog from authenticated `GET /api/earn/products` and the user's position/interest snapshot from authenticated `GET /api/account`. It displays catalog APY, asset, flexible/fixed term, early redemption fee, principal, estimated interest and maturity. No static seed catalog is presented as live data.
- Subscribe and redeem use the existing authenticated `POST /api/earn` backend route and its atomic `subscribe_earn_atomic` / `redeem_earn_atomic` RPCs. Request IDs are retained per operation across an uncertain network result so a user retry reuses the same idempotency key; the UI does not treat an unconfirmed response as success. Client amount precision is checked against catalog amount_scale; the database remains authoritative.
- The page is protected by the authenticated account route. If the financial write switch is false, catalog/position review remains available while subscribe/redeem are disabled with an explicit status. Partial account/catalog reads are handled independently, so a catalog read failure does not hide a successfully returned position snapshot.
- Feature commits in this batch: 412859aa3796f0ae54648a7d5e8548cfb1532fcb (Earn API clients), cc4b8802bc11b74384660744f8417d360e49e791 (account position typing), fed400f8ef68f8acf9302685da341bc646161804 (Earn page), 0ccae477434652170d3da0f6bf7b3de5dd3cc650 (protected route), 66fb2804c1948af12253fd899be8f0c187c1f483 (partial-read handling and stable idempotency retries).
- Feature HEAD: 66fb2804c1948af12253fd899be8f0c187c1f483. Compare from 9ad9a3d291be8b0e38ce5f69cc54e96f65115eda: 5 ahead / 0 behind. Changed files: frontend/src/App.tsx (+2/-1), frontend/src/features/pages/Pages.tsx (+94/-1), frontend/src/lib/api.ts (+72).
- Exact-SHA re-fetch confirmed Earn types, catalog reader, operation client, page export, live catalog call, subscribe/redeem actions, stable idempotency key reuse, protected route, and backend atomic RPC references. One initial source-presence assertion for positions used an outdated expression and returned false; the actual implementation reads `accountResult.value.earn_records` and was confirmed by source re-fetch.
- `frontend/package.json` declares `build: tsc -b && vite build` and `lint: tsc --noEmit`, but neither was executed in this environment. No PR-triggered Actions run was returned for this SHA; combined status reports only the existing Vercel Hobby build-rate-limit failure. TypeScript/build/browser runtime QA remains NOT VERIFIED.
- No migration was applied. Live project migration history previously observed did not include 0006 or 0011; therefore live catalog/position reads may fail closed until the migrations are reviewed and deliberately applied. No Supabase write, financial operation, merge, deployment, or V211 trading layout change occurred.
- The Earn workflow in the current SQL/API is atomic database processing, not a manual-approval queue. Preserve the user's broader semi-manual operating model in the admin-managed workflows that require review (especially withdrawals); do not invent Earn approval states absent from the backend contract.


## User-confirmed simplified semi-manual funds workflow — 2026-11-06

The user explicitly simplified the required business process. Do not expand it into automated chain monitoring, automatic payout, multi-stage settlement orchestration, or unnecessary verification steps.

1. Deposit: administrator configures one receiving address per supported asset/network. The deposit page displays exactly that configured address. The user transfers funds externally and waits. An administrator checks the transfer manually and performs one manual account credit ("上分") in the admin panel. The system records who credited, which user/asset/amount, time, reference/note, and the resulting ledger operation. No automated chain scanner or user-side claim form is required unless later requested.
2. Withdrawal: user submits asset, network, amount and destination address. Admin panel shows the request and its status. Administrator reviews and approves/rejects. After approval, the administrator manually sends the funds externally and records the completed/manual payout result (including transaction reference/hash if available). The user can see pending/reviewed/rejected/paid status. Approval must not be mislabeled as paid.
3. Keep only essential controls: authenticated user/admin, available-balance check and reservation/debit/refund semantics in one authoritative database transaction, idempotent admin credit/payout actions, and an audit trail. Do not create automatic chain broadcast, automatic matching, or a complex approval hierarchy.
4. Existing source has pieces of this workflow but it is not complete: admin deposit address config exists; admin manual credit endpoint `POST /api/admin/deposit/confirm` exists but is gated by financial cutover; user `POST /api/deposit` only returns an address and rejects a positive amount; withdrawal submit endpoint exists but is gated by financial cutover; admin withdrawal approve/reject endpoints exist but approval explicitly does not broadcast funds. The frontend currently has no deposit claim/history workflow and withdrawal submission remains hidden.
5. Next implementation priority: finish the simple manual deposit-credit and withdrawal-request/review/manual-paid workflow end to end. Reuse existing admin endpoints/RPCs where correct; add only the minimum missing record/status operation. Do not turn this into an automated on-chain integration. Preserve V211 layout and do not deploy or perform live balance changes without approval.


## Financial switch instruction and live compatibility audit — 2026-11-06

- User clarified: there are currently no users, so do not treat keeping the financial switch closed as a permanent requirement. Proceed with the financial workflow and prepare to enable the switch; do not delay merely to preserve legacy user balances.
- Read-only Supabase verification for project `zlozsutefnmgwwzrlipt`: Auth users = 0; financial_accounts = 0; withdrawal_requests = 0; earn_product_catalog = 7. Project status ACTIVE_HEALTHY. The current DB has the financial tables and RPCs already present, despite the migration registry showing only two timestamped migration entries. Do not infer migration application from source filenames alone.
- Exact live DB RPC contracts: `create_withdrawal_atomic` is currently the 9-argument signature ending in `p_request_hash text`; `review_withdrawal_atomic`, `admin_manual_deposit_atomic`, `apply_financial_operation`, `read_financial_account_snapshot_v1`, `read_admin_withdrawal_snapshot_v1`, and `read_admin_account_balances_v1` exist. Money-moving RPC ACLs observed grant EXECUTE to `service_role` (and postgres), not anon/authenticated. The live admin read snapshot currently lists `pending` requests; the current withdrawal table does not have `require_admin_review`, `payout_reference`, `paid_by`, or `paid_at` fields.
- The production Vercel app is the separate `btcbox-v33` project/repository, not the Vite frontend in `btcboxcdt`. Vercel environment metadata for `btcbox-v33` confirms `FINANCIAL_POSTGRES_RPC_ENABLED=0`, `FINANCIAL_POSTGRES_FULL_CUTOVER_APPROVED=0`, `FINANCIAL_POSTGRES_READS_ENABLED=0`, and `FINANCIAL_MATCHING_ENGINE_ENABLED=0` for production and preview. Do not enable matching engine for this simplified manual funds workflow.
- Source mismatch found in production repo `avali9308-code/btcbox-v33`: `backend/api-core.js` was calling the 10-argument withdrawal RPC with `p_require_admin_review`, while the live DB exposes only the 9-argument RPC. This would fail if financial writes were enabled. Created branch `fix/manual-withdrawal-rpc-compat-20261106` from main SHA `18a354a9e8e1d0365e240c7c44eda4a18d62ce07`; commits `1d66cdfe43d5974ba921a3573d40b897a58b584c` and `90b887eceb18e613cab22eea66295190e41d1b15` align the API to the live 9-argument RPC, make every withdrawal wait for admin review (simple user-requested flow), and correct deposit/withdrawal UI language to describe manual verification, manual credit and manual payout rather than automatic on-chain confirmation.
- Exact branch head `90b887eceb18e613cab22eea66295190e41d1b15`; compare to production main `18a354a9e8e1d0365e240c7c44eda4a18d62ce07`: 2 ahead / 0 behind; changed only `backend/api-core.js` (+4/-7) and `backend/assets/js/views-assets.js` (+4/-4). Exact-SHA source re-fetch confirmed 9-argument call and manual-review wording. Test script is `node --test tests/*.test.js`; build script is `node scripts/build-site.js`. Neither was run here. Vercel check on the branch is failure; no workflow run was returned. No deploy, environment-variable update, database write, or financial operation occurred.
- The financial switch is not being kept closed as a product requirement. However, it must not be flipped on the current production deployment before the compatibility branch is integrated and the manual payout completion path is available; otherwise the live app can accept withdrawal requests without a reliable end-to-end manual paid status. User has authorized proceeding without waiting for old-user migration; user has not separately authorized a production deployment in this batch.
- Remaining minimum work: add a simple audited manual payout-complete action after approval, expose approved-for-payment items in admin queue, and return the paid status/reference in user withdrawal history. Keep this simple; no chain scanner, auto-broadcast, or multi-stage approval.
- Supabase table listing surfaced a critical RLS advisory for `private.btcbox_state_pre_test_cleanup_backup` and `private.btcbox_auth_test_users_backup`: RLS is disabled on both backup tables. Do not auto-apply without user decision. Suggested lockdown SQL is included in the assistant response; verify schema exposure and intended access before enabling RLS because no policies would intentionally block access.


### Follow-up: legacy JSON user records check
- Additional read-only query found 3 records in `public.btcbox_state.data.users` (legacy JSON store), each with a balances object (18 asset entries total); all 18 entries have zero free/frozen balance. Supabase Auth users remain 0 and normalized financial_accounts remain 0.
- Do not claim the entire user store is empty: Auth is empty, but 3 legacy user/profile records remain. Their balances are zero, so no positive legacy balances require migration. Do not delete these profile records without the user's explicit instruction.


## Manual withdrawal payout completion batch — 2026-11-06

- Production repository remains `avali9308-code/btcbox-v33`, branch `fix/manual-withdrawal-rpc-compat-20261106`; production main baseline `18a354a9e8e1d0365e240c7c44eda4a18d62ce07`.
- Latest feature branch head: `e99502b02426a6773ca7201c5be45c7179110950`, 10 commits ahead / 0 behind main. Files changed: `backend/api-core.js`, `backend/assets/js/app-core.js`, `backend/assets/js/views-account.js`, `backend/assets/js/views-assets.js`, new SQL `backend/supabase/sql/0023_withdrawal_manual_payout_completion_v1.sql`, and `backend/tests/api-routing.test.js`.
- Added an audited manual payout-completion database RPC. It locks the withdrawal row, only accepts status `approved`, sets status `completed`, stores optional payout reference/note, paid admin and timestamp, and appends a financial audit record. It does not move funds again: the existing approval transaction already finalizes the frozen debit. RPC EXECUTE is revoked from PUBLIC/anon/authenticated and granted to service_role only.
- Added admin API `POST /api/admin/withdraw/mark-paid`, user API `GET /api/withdrawals`, and service-role read RPC `read_withdrawal_history_v1`. Admin queue now fetches the authoritative PostgreSQL list, shows both pending and approved-awaiting-manual-payout records, and offers approve/reject or mark-paid as appropriate. User withdrawal page now displays authoritative status, paid time and optional transfer reference. UI wording now accurately states that every withdrawal is manually reviewed and approval is not payment.
- Added route coverage for `/api/withdrawals` and `/api/admin/withdraw/mark-paid`; route list is now 25.
- Vercel build log for intermediate SHA `3c11b11f5bc8ae4dd7b49392becddd42a5ba78f8` exposed a syntax error caused by an incorrectly escaped URL-trim regex in the two newly added API routes. Fixed both occurrences in commit `23e4882758e671ef98df1f6fa88c9d8c9bbb1b3b`; source re-fetch shows the correct `replace(/\\/+$/, '')` expression. Subsequent UI copy and route-test commits bring the latest head to `e99502b02426a6773ca7201c5be45c7179110950`.
- Latest GitHub combined status still reports Vercel failure and no GitHub workflow runs were returned. The earlier build logs identify the syntax error; after the fix, latest build logs could not be retrieved due Vercel team access requiring reauthorization. Do not claim the latest build or tests passed.
- SQL migration `0023_withdrawal_manual_payout_completion_v1.sql` is committed but NOT applied to Supabase. No Vercel environment variables were changed, no production deployment was performed, no live database DDL/write was run, and no funds operation occurred in this batch.
- The switch is not being held off for legacy users. Before enabling the production write flags, integrate/deploy the code, apply migration 0023, verify the RPC grants and status constraint, and pass build/API smoke checks. Keep `FINANCIAL_MATCHING_ENGINE_ENABLED=0`; this manual funds workflow does not need the matching engine.


### Supabase transactional validation for migration 0023
- Executed the committed migration inside a single PostgreSQL transaction, inserted one synthetic approved withdrawal, called `mark_withdrawal_paid_atomic` twice with the same reference (first completion + idempotent retry), and called `read_withdrawal_history_v1`; the transaction completed without SQL/RPC errors and was rolled back.
- Post-rollback verification returned `persisted_test_withdrawals=0` and `persisted_payout_columns=0`. Therefore no migration DDL or test row remains in the live database. This is a transactional smoke test, not migration application or a production financial operation.


## Manual funds workflow follow-up — 2026-11-06 (UTC+8)

- Re-read this coordination entry before work. Production branch remains `fix/manual-withdrawal-rpc-compat-20261106`; production baseline remains `main` at `18a354a9e8e1d0365e240c7c44eda4a18d62ce07`.
- Fixed the stale withdrawal UI test contract by restoring visible guidance for bound withdrawal addresses, the 24-hour new-address cooldown, and first/large withdrawal manual review. The deposit page continues to say the receiving address is configured by the administrator and warns against wrong coin/network transfers; tests were updated to assert this approved manual-address model, not a system-generated address.
- Added a direct admin manual-credit form under the admin deposits tab. It accepts user UID, asset, actual received amount, optional transfer reference and note, confirms that staff checked receipt, and calls the existing audited `POST /api/admin/deposit/confirm` ledger route with an operation request ID. No user-side deposit claim form or chain scanner was added.
- Fixed admin user-list hydration: the page now calls `GET /api/admin/users` and renders the actual response fields `kyc_status` and `total_usdt`, allowing staff to retrieve a UID before manual credit. Added source tests for the manual-credit form, escaping, user-list hydration, and API field contract.
- Two intermediate preview builds surfaced stale UI assertions (first the removed withdrawal hint, then legacy system-generated deposit-address copy / old deposits-table assertions). Those tests were corrected to match the retained business rules and the user's semi-manual workflow; no business control was weakened to make tests pass.
- Latest production-repository branch HEAD: `755ebc51f158eae5d1f104253b4bac97f9abe967`; compare to main: 17 ahead / 0 behind. Changed paths remain limited to `backend/api-core.js`, `backend/assets/js/app-core.js`, `backend/assets/js/views-account.js`, `backend/assets/js/views-assets.js`, migration `0023_withdrawal_manual_payout_completion_v1.sql`, and tests `api-routing.test.js` / `frontend_security.test.js`.
- Vercel Preview deployment `dpl_5hS2oWZoufCFaxMTGKBqscGrdPsv` (`btcbox-v33-eksdw4zcz-box-2753.vercel.app`) is `READY`. Its build log confirms `BTCBOX public build created in dist/`; Node test suite reports 87 tests, 87 passed, 0 failed. This is a Preview artifact only, not a production deployment. No browser end-to-end test was run.
- Migration 0023 remains committed but NOT applied. Its prior transaction/rollback smoke test remains the only database validation; no production DDL, permanent database write, financial operation, environment-variable change, merge, or production deployment occurred. Do not enable the three financial cutover flags yet; keep `FINANCIAL_MATCHING_ENGINE_ENABLED=0`.
- Next: complete authenticated preview smoke checks for admin user lookup/manual credit and withdrawal queue/history using safe non-financial reads; review live admin identity/ADMIN_USER configuration and the three financial flags. Apply migration 0023 and enable cutover only after explicit production change approval and the remaining checks. Preserve the V211 trading layout.


## Admin user-scoped manual credit UX — 2026-11-06

- Reworked the admin user list so each user row has an 账户资产 action. It calls the existing authenticated GET /api/admin/user?uid=... detail endpoint; the selected UID is carried by the selected row and is not manually typed.
- The account panel shows USDT/BTC/ETH/SOL free and frozen balances. Each asset row has its own 人工上分 action; opening its inline form binds both the selected user UID and selected asset automatically. The operator only enters the verified received amount, with optional transfer reference and note.
- The standalone manual-credit tab and manual UID/coin entry form were removed. The existing audited POST /api/admin/deposit/confirm endpoint, confirmation prompt, idempotency key, and ledger operation remain unchanged. The backend still validates the supported asset, amount, request ID, admin actor and financial cutover state.
- Added/updated source tests for selected-user detail loading, automatic UID/asset binding, removal of the standalone UID form, and escaping of the user/asset/amount/reference/note values.
- One preview test run exposed a stale XSS assertion that still expected the removed global UID form; replaced it with assertions for the new account-panel flow. Latest feature branch HEAD: 79c598a038547b973314147f43a81f97b8d697d5, 22 commits ahead / 0 behind production main 18a354a9e8e1d0365e240c7c44eda4a18d62ce07.
- Vercel Preview dpl_BYiXWaDKDzG57MCF7DaHHTNFSxrA is READY at https://btcbox-v33-d14znhjd0-box-2753.vercel.app; build completed and Node test suite reports 87 passed / 0 failed. No browser E2E or authenticated UI interaction was performed.
- No backend API, SQL migration, financial flags, Supabase data, or production deployment was changed in this UX batch. Migration 0023 remains unapplied; no merge or production deployment occurred. Preserve V211 trading layout.


## Seconds-contract unlimited open positions — 2026-11-06

- USER DECISION: each user may hold an unlimited number of simultaneously open Seconds positions. Do not impose a per-user open-position count limit. The admin side must be able to inspect open positions; settlement/end-of-order behavior remains a server-side/admin-configurable business rule, not a hard-coded frontend-only rule.
- SOURCE OBSERVED on Supabase project `zlozsutefnmgwwzrlipt`: `public.seconds_contract_positions_one_open_per_user_idx` currently exists as a partial UNIQUE index on `user_id WHERE status='open'`; this is the direct database blocker to multiple open positions.
- SOURCE OBSERVED: the existing `submit_seconds_order_v1` RPC checks request idempotency, inserts/locks the user's USDT financial account row with `FOR UPDATE`, then performs the available-to-frozen ledger movement and inserts a position in one transaction. This account-row lock serializes concurrent order creation for the same user and is the existing concurrency guard to preserve when removing the per-user open-position index.
- SOURCE OBSERVED: separate uniqueness protections remain on `position_id`, `open_operation_id`, `open_request_id`, and `settle_request_id`; do not remove these. The read RPC `read_seconds_positions_v1` aggregates all open positions for a user without a per-user open-count cap; settled history is separately bounded to the latest 100 rows.
- SOURCE OBSERVED: current `seconds_contract_positions` contains zero rows (no open or settled positions). This supports the clean-database planning assumption, but is not permission to run permanent production DDL or financial writes.
- SOURCE OBSERVED: Supabase migration history currently lists only versions `20261102133555` and `20261103062716`, despite the live schema containing the Seconds RPCs and unique indexes. Treat migration-history drift as a release concern; reconcile the authoritative migration sequence before any permanent apply.
- NOT VERIFIED: PostgreSQL concurrency behavior with multiple simultaneous open positions has not been exercised in an isolated test database. No permanent index removal, migration apply, code commit, merge, financial flag change, or deployment was performed in this audit batch.
- NEXT IMPLEMENTATION: add a forward-only migration that drops only `seconds_contract_positions_one_open_per_user_idx`; retain all request/position/ledger uniqueness guards and the account-row lock. Add regression tests proving unlimited open positions are allowed while duplicate request IDs and duplicate position IDs remain rejected. Then test concurrent submissions and independent settlement for multiple positions using isolated fixtures before considering cutover. Do not change the V211 trading layout.


### Additional Seconds source audit — 2026-11-06

- SOURCE OBSERVED: the current backend `api-core.js` still hard-codes the allowed durations to `30/60/300/900`; the SQL schema repeats the same CHECK constraint. No admin Seconds policy/config endpoint was found in the inspected backend API source.
- SOURCE OBSERVED: the current settlement RPC hard-codes winning PnL to `round(amount * 0.85, 18)`; this is not an admin-configurable payout ratio. It also uses fixed tie/win/loss settlement behavior. The user requirement is that 85% is the minimum payout/profit ratio, not the only fixed value, and order-end handling must be controlled by backend/admin policy.
- SOURCE OBSERVED: `POST /api/seconds/order` currently returns `settle_at` calculated again from API `Date.now() + durationSec` rather than forwarding the authoritative `result.settle_at` returned by PostgreSQL. This must be corrected to return the database value unchanged; retries must preserve the original maturity timestamp.
- SOURCE OBSERVED: `GET /api/seconds/positions` forwards the full `open[]` array from `read_seconds_positions_v1`; that SQL RPC aggregates all open positions for the user without a per-user open-position count limit. Settled history is limited to the latest 100.
- NOT VERIFIED: admin-side global open-position queue, policy editing UI/API, per-symbol/per-duration payout configuration, and actual multiple-position frontend rendering have not been verified.
- Implementation must not introduce outcome manipulation or client-side settlement authority. Admin policy changes must be validated and snapshotted onto each newly opened position (or otherwise versioned) so an in-flight position's settlement terms cannot be retroactively changed. Settlement must remain server-side, atomic, auditable and idempotent.


## Seconds-contract implementation readiness recheck — 2026-11-06

- Re-read the coordination entry and Supabase skill before this batch. Production feature branch remains `fix/manual-withdrawal-rpc-compat-20261106`, confirmed at `79c598a038547b973314147f43a81f97b8d697d5`; compare to `main` `18a354a9e8e1d0365e240c7c44eda4a18d62ce07` remains 22 ahead / 0 behind.
- Re-fetched `backend/api-core.js` from the feature branch (blob `043639d6afd76b17c559a9c4493d8ae7036d2821`). SOURCE OBSERVED: `SECONDS_ALLOWED_DURATIONS` is still `30/60/300/900`; `POST /api/seconds/order` still returns `settle_at = Date.now()/1000 + durationSec` instead of forwarding the database RPC result. This is a confirmed outstanding API defect, not fixed in this batch.
- Re-fetched `backend/supabase/sql/0015_financial_seconds_one_open_position_v1.sql`: it creates the partial unique index and redefines the submit RPC to handle that index conflict. Live read-only catalog query independently confirms the index still exists: `seconds_contract_positions_one_open_per_user_idx ON (user_id) WHERE status='open'`.
- Rechecked live migration history: only `20261102133555` and `20261103062716` are recorded, despite the live Seconds schema/RPCs. This migration-history drift remains unresolved and must be reconciled before permanent DDL.
- Supabase official CLI v3 changelog (2026-11-04) confirms database commands now target local by default and hosted changes require explicit remote targeting/confirmation. Supabase CLI docs confirm `supabase migration new <name>` creates the timestamped migration file locally. The available Vercel sandbox creation endpoint rejected two correctly scoped attempts (400 bad_request); no project terminal or local Supabase CLI was obtained. Per the Supabase skill, no migration file was fabricated through GitHub contents API.
- No source code, tests, SQL migration, live schema, financial flags, merge, or deployment changed in this batch. No code/test claim is made. Next blocker-removal step: obtain a working project terminal/sandbox, run `supabase migration new`, then implement the index-only drop plus the database-authoritative `settle_at` fix and regression tests. Preserve the account-row `FOR UPDATE` lock and all independent idempotency/ledger constraints.


## Seconds API maturity timestamp fix — 2026-11-06

- Implemented on feature branch `fix/manual-withdrawal-rpc-compat-20261106`: `backend/api-core.js` now returns `settle_at: result.settle_at` from `submit_seconds_order_v1`, instead of recalculating maturity using the API process clock. This preserves the database's original maturity timestamp on idempotent retries.
- Added a regression source test in `backend/tests/frontend_security.test.js` asserting the API forwards the RPC value, does not calculate `Date.now()/1000 + durationSec`, and that the SQL RPC returns the persisted timestamp for both duplicate and fresh requests.
- Commits: API fix `d8ae56e55b8c02a033fab2d4d1d088231f6ec40e`; regression test `4710df3a23008c0947912793204fe511661ff633`. Current feature head after these two commits: `4710df3a23008c0947912793204fe511661ff633`, 24 ahead / 0 behind `main`.
- TEST STATUS: NOT RUN. GitHub combined status returned no status checks and commit workflow lookup returned no PR-triggered runs. No project terminal was available to run `npm test`. The test is committed but is not represented as passed.
- Sandbox retry: both Vercel sandbox API v4 and v2 creation attempts returned HTTP 400 bad_request, including a correctly scoped project ID. Stop retrying the same API path; use an independently provisioned local/project terminal or resolve Vercel sandbox permissions before further CLI-dependent work.
- BLOCKED: no Supabase migration was created because the Supabase skill requires `supabase migration new <name>` to generate it. No index removal, migration-history repair, duration/payout policy changes, SQL DDL, production DB write, merge, or deployment occurred.
- Remaining next steps: obtain a working CLI terminal; create and test a forward-only migration that drops only the per-user open-position partial unique index; retain account-row `FOR UPDATE` and all idempotency/ledger unique constraints; then perform isolated concurrent multi-position and independent-settlement tests. Do not use a paid Supabase branch without explicit cost approval. Preserve V211.


## Seconds-contract next-batch environment recheck — 2026-11-06

- Re-read this coordination file from `chore/shared-ai-coordination` before the batch (blob `735434210c54acc06f7c2c66fbbcf58a83cd849e`). Reconfirmed the active production feature branch head via GitHub branch API: `4710df3a23008c0947912793204fe511661ff633`; comparison to production `main` `18a354a9e8e1d0365e240c7c44eda4a18d62ce07` is 24 ahead / 0 behind. Changed-file scope remains seven paths: backend API, two frontend account/assets files, migration 0023, and two test files.
- Re-fetched `backend/supabase/sql/0015_financial_seconds_one_open_position_v1.sql`. SOURCE OBSERVED: migration 0015 creates `seconds_contract_positions_one_open_per_user_idx` and modifies `submit_seconds_order_v1` to map its conflict to `OPEN_POSITION_EXISTS`. It also retains the per-user USDT financial-account row lock `FOR UPDATE`; this lock and all independent request/position/operation/ledger uniqueness constraints must remain.
- Reconfirmed the previous `settle_at` API fix is present in the branch source. The latest source-test commit remains committed, but the Node test suite is still NOT RUN. GitHub combined status is `pending` with zero status contexts; commit workflow lookup returns no PR-triggered runs. No test pass is claimed.
- Vercel project `btcbox-v33` sandbox recheck: `list_sessions` returned zero sessions and `list_named_sandboxes` returned zero named sandboxes. A correctly shaped Vercel v2 sandbox-create request again returned HTTP 400 `bad_request`; no sandbox/terminal was provisioned. Do not state that a sandbox was created. Stop repeating this endpoint without new evidence or a changed access/configuration path.
- Supabase official docs refreshed: CLI v3 database commands target local by default; hosted targets require explicit `--remote`, and hosted mutations require confirmation. Official `supabase migration new <name>` creates the timestamped file under `supabase/migrations`. References: https://supabase.com/changelog/supabase-cli-v3 and https://supabase.com/docs/reference/cli/global-flags. No migration file was generated because no CLI terminal is available; do not fabricate a migration filename or claim the index is removed.
- No source code, test file, SQL migration, live schema, financial flag, production deployment, or merge changed in this batch. The multiple-open-position database restriction remains active and unmodified. No production DDL or financial writes were performed.
- NEXT: obtain a valid non-deploying terminal (not a Vercel deployment build); run the project CLI help/version checks; create the forward-only migration with `supabase migration new`; then implement only the drop of `seconds_contract_positions_one_open_per_user_idx`, preserving the account row lock and all idempotency/ledger protections. Run backend tests and isolated concurrent multi-position/independent-settlement tests before any migration apply or release discussion. Reconcile existing migration-history drift before a permanent hosted apply. Preserve V211.


## Seconds settlement and multi-position database audit — 2026-11-06

- Re-read this coordination document before the batch (blob `126acb29fcb16061f679b62ef794498637d76350`) and re-confirmed feature branch HEAD `4710df3a23008c0947912793204fe511661ff633`.
- Supabase live read-only verification: `seconds_contract_positions` contains 0 rows / 0 open rows. The partial unique index `seconds_contract_positions_one_open_per_user_idx` is still present and is the direct one-open-position restriction. Other independent unique indexes remain present: primary key `position_id`, `open_request_id`, `open_operation_id`, `settle_request_id`, and `settle_operation_id`. No DDL or financial writes were executed.
- Live `submit_seconds_order_v1` definition confirms the account-row `SELECT ... FOR UPDATE` lock is present and ledger debit/frozen credit plus position insert occur in one transaction. It still validates durations as 30/60/300/900 and catches the single-open index violation as `OPEN_POSITION_EXISTS`. Dropping only the partial index removes the per-user open-count cap; the existing row lock and independent unique constraints must remain.
- Live `read_seconds_positions_v1` aggregates every open row for the user without a per-user count limit; settled history is limited to 100.
- CRITICAL SOURCE OBSERVED: live `settle_seconds_position_v1` currently locks the exact `position_id` row and settles that position independently, but its already-settled branch is incorrect. It returns `duplicate:true, settled:true` for any later request ID; it only returns `IDEMPOTENCY_CONFLICT` when the incoming request ID equals the stored request ID but the request hash differs. This violates the previously agreed rule: only the same request ID + same hash may be an idempotent duplicate; a different request ID must return `POSITION_ALREADY_SETTLED`. The API currently forwards `result.duplicate` and does not map a database `POSITION_ALREADY_SETTLED` code. This must be fixed in a forward migration and API regression test before multi-position settlement is considered safe.
- The live settlement function uses the per-position row lock plus the USDT account row `FOR UPDATE`; this is compatible with multiple independent positions provided the already-settled/idempotency branch is corrected. It currently hard-codes winning PnL to 85%; this remains a separate backend policy-config requirement.
- Live migration history still contains only `20261102133555` and `20261103062716`. This does not match the source branch's SQL files 0014/0015/0023 and the live Seconds objects; migration-history reconciliation is a release blocker and must not be guessed or repaired by inserting history rows blindly.
- Environment attempt: Vercel v2 and v3 sandbox creation both returned HTTP 400 `bad_request`; no session or sandbox exists. Stop repeating the same sandbox API without a changed authorization/configuration path. No project terminal was obtained, so the Supabase CLI test suite remains NOT RUN and no migration was generated.
- Supabase CLI changelog refreshed: v3 (released 2026-11-02; changelog entry 2026-11-04) defaults database commands to local, requires explicit `--remote` for hosted targets, and asks for confirmation before hosted mutations. Official migration guide confirms this. References: https://supabase.com/changelog/supabase-cli-v3 and https://supabase.com/docs/guides/local-development/cli/migrating-to-v3.
- No source code, test, migration, production schema, deployment, or merge changed in this batch. The previous `settle_at` API forwarding fix remains in source but its regression test is still NOT RUN. Feature branch remains 24 ahead / 0 behind main.
- NEXT IMPLEMENTATION ORDER: (1) obtain a working local/non-deploying CLI environment; (2) generate a forward migration using `supabase migration new`; (3) in that migration drop only `seconds_contract_positions_one_open_per_user_idx` and replace `settle_seconds_position_v1` so same request ID + same hash returns duplicate, same ID + different hash returns `IDEMPOTENCY_CONFLICT`, and any different request ID on an already-settled position returns `POSITION_ALREADY_SETTLED`; (4) update API error mapping and add tests for all three cases; (5) run Node tests and isolated database concurrency/independent-settlement tests. Keep all account/ledger/idempotency locks and constraints. Reconcile migration history before any hosted apply. Do not merge/deploy or change V211.


## Seconds settlement idempotency and unlimited open-position repair candidate — 2026-11-06

### SOURCE OBSERVED / IMPLEMENTED IN FEATURE BRANCH
- Re-read this coordination entry before implementation. The active BTCBOX feature branch is `fix/manual-withdrawal-rpc-compat-20261106`; its latest remote head after this batch is `40f1d0aaf8bbd8a36be82fa2040fce58f8100fb3`. Compare against main `18a354a9e8e1d0365e240c7c44eda4a18d62ce07`: 30 ahead / 0 behind. No merge or deployment.
- Created the forward migration using Supabase CLI v3 `supabase migration new seconds_unlimited_open_positions_and_settlement_idempotency_v1`; generated timestamp: `20261106041624`. The timestamped migration is in `backend/supabase/migrations/`. An identical numbered mirror `backend/supabase/sql/0024_seconds_unlimited_open_positions_and_settlement_idempotency_v1.sql` keeps the existing local/docker SQL runner sequence continuous.
- The migration drops only `public.seconds_contract_positions_one_open_per_user_idx`. It does not delete or rewrite positions and does not remove the independent position/request/operation/ledger uniqueness constraints.
- The replacement `settle_seconds_position_v1` now returns duplicate success only for the same settled position + same request ID + same request hash; same request ID with a different hash returns `IDEMPOTENCY_CONFLICT`; a different request ID against an already-settled position returns `POSITION_ALREADY_SETTLED`.
- The settlement function retains the position-row `FOR UPDATE` lock, USDT account-row `FOR UPDATE` lock, atomic financial operation/ledger writes, and existing settlement calculation. The 85% calculation remains hard-coded and is explicitly queued for the policy-configuration batch; this migration does not claim to implement configurable payout rates.
- `backend/api-core.js` now preserves settlement business error codes and maps idempotency/already-settled conflicts to HTTP 409 rather than collapsing them into `FINANCIAL_RPC_FAILED`.
- Source audit confirms `GET /api/seconds/positions` returns the full `open[]` result and `assets/js/views-trading.js` renders the open array with `list.map`; no single-open frontend truncation was found.
- Added regression tests for migration semantics, preservation of locks/unique guards, API error mapping, and full open-array rendering.

### TEST EVIDENCE
- Ran `cd backend && npm test` in a non-deploying Vercel sandbox on the edited source: **92 tests passed, 0 failed**.
- Ran the focused Seconds tests: **8 passed, 0 failed**.
- Ran `python3 scripts/check_migration_status.py --offline`: numbered SQL migrations are continuous from 0001 through 0024.
- Ran `git diff --check`: no whitespace errors.
- After the code was committed to the feature branch through GitHub, verified the remote Git blob SHA matches the exact locally tested content for all six implementation/test files:
  - `backend/api-core.js`: `4caa953083a73e715e8257d98698f61466a0e3f4`
  - timestamped migration: `ea1856b7e6c9006de5a6a718373f81d56d2724aa`
  - numbered SQL mirror: `ea1856b7e6c9006de5a6a718373f81d56d2724aa`
  - migration-order doc: `472d839de7f4e2d5ee5a78e5359ae75cedb283c4`
  - migration regression test: `23095feff252fe3e590af452cd709c25610509c6`
  - settlement/API/open-array regression test: `d2717e7ae8f717c6294c64212b6da54376507cda`
- GitHub workflow lookup for latest feature commit returned no PR-triggered workflow runs. Do not describe this as GitHub CI passing.

### NOT VERIFIED / RELEASE BLOCKERS
- Sandbox has no Docker or `psql`; local PostgreSQL execution, PL/pgSQL compilation, isolated concurrent multi-position submissions, concurrent per-position settlement, and balance/ledger invariant tests were NOT RUN.
- Live Supabase project `zlozsutefnmgwwzrlipt` was only queried read-only. No migration was applied, no financial write was run, and no deployment or merge occurred. The live single-open-position partial unique index therefore remains active; multiple open positions are NOT yet enabled in the hosted database.
- Live migration history still contains only `20261102133555` and `20261103062716` while the live schema contains older financial/Seconds objects. Migration-history drift remains unresolved. Do not run hosted `db push`, `apply_migration`, or `migration repair` until each existing SQL migration is reconciled against actual schema effects.
- Supabase CLI v3 defaults database commands to local; hosted targeting requires explicit `--remote` and hosted mutations require confirmation. References: https://supabase.com/changelog/supabase-cli-v3 and https://supabase.com/docs/guides/local-development/cli/migrating-to-v3.

### NEXT BATCH
1. Build the small, backend-authoritative Seconds policy settings surface in admin: enabled state, allowed durations, min/max order amount, and configurable payout/profit ratio with 85% as the minimum. Avoid unnecessary UID/asset/manual fields.
2. Persist policy version and the effective duration/amount/payout terms onto each newly opened position; later admin changes must not alter in-flight positions. No preset outcomes or client-side settlement authority.
3. Add an admin read-only queue for all open Seconds positions; verify pagination/visibility for multiple positions. Existing user-facing open-array rendering is already present.
4. Add isolated PostgreSQL tests for multiple concurrent positions, same/different open request IDs, per-position settlement idempotency, concurrent balance locking, and no duplicate ledger postings.
5. Reconcile migration-history drift before any hosted migration application. No production DDL, real financial writes, merge, or deployment without explicit approval. Preserve V211 trading layout.


## Seconds configurable policy, immutable payout snapshots, and independent multi-position UI — 2026-11-06

### SOURCE OBSERVED / IMPLEMENTED
- This entry supersedes the earlier feature-head reference `40f1d0aaf8bbd8a36be82fa2040fce58f8100fb3`. Current feature branch: `fix/manual-withdrawal-rpc-compat-20261106`, HEAD `3ad91a456f6f5bee3d190efd0bbc66e8637519d9`. Compared with main `18a354a9e8e1d0365e240c7c44eda4a18d62ce07`: 32 ahead / 0 behind. No merge or deployment.
- Generated the next timestamped migration using Supabase CLI `supabase migration new seconds_policy_snapshot_and_admin_queue_v1`: `20261106042714_seconds_policy_snapshot_and_admin_queue_v1.sql`. Added the identical numbered runner copy `0025_seconds_policy_snapshot_and_admin_queue_v1.sql`; migration numbering is now continuous through 0025.
- Added `public.seconds_contract_policy` with administrator-editable enabled state, unique allowed durations, min/max USDT order amount, and payout rate. Defaults are 30/60/300/900 seconds, min 1 USDT, max 1e12 USDT, payout 0.85. The DB/API enforce payout >= 0.85 (85%); no hard-coded upper payout ceiling is imposed beyond the numeric column's precision.
- Replaced the order RPC to lock/read one coherent policy version (`FOR SHARE`), validate enabled/duration/amount server-side, preserve the account `FOR UPDATE` lock and atomic operation/ledger writes, and snapshot `policy_version` + `payout_rate` on each new position. Existing `duration_sec` and `amount` fields preserve the effective terms selected for that position.
- Replaced the settlement RPC to calculate winning PnL from the position's stored `payout_rate`, not the latest administrator setting. A policy change therefore affects new positions only.
- Added server-side policy read/update RPCs, an admin-only policy API, and a read-only paginated admin open-position queue RPC/API. Policy table RLS is enabled; table access and function execution are limited to `service_role`, called only from server-side API routes behind the existing admin authentication gate.
- User seconds UI now fetches backend policy, renders admin-selected durations and amount bounds, and fails closed if policy is unavailable or the global financial-write gate is off. The hard-coded one-open-position UI gate and obsolete one-open rule text were removed. Confirmed open positions can coexist; a single unresolved request ID still blocks duplicate submissions until reconciled.
- Replaced the single countdown with independent per-position countdown labels and per-position settlement locks/attempt tracking. The admin queue shows all open positions with pagination; a failed queue read is explicitly shown as unavailable rather than falsely displaying zero orders.
- Seconds order amount is now carried as a validated decimal string from the UI through the API to the numeric RPC parameter, avoiding JS floating-point serialization changes and allowing the database policy to be authoritative for the max amount.
- No changes to the V211 spot trading page layout.

### TEST / SOURCE EVIDENCE
- Exact tested feature HEAD: `3ad91a456f6f5bee3d190efd0bbc66e8637519d9`.
- `cd backend && npm test`: **101 passed, 0 failed**.
- `npm run build`: passed; public build created in local `dist/` only, generated artifacts restored afterward.
- `node --check` passed for `api-core.js`, `assets/js/app-core.js`, `assets/js/views-account.js`, and `assets/js/views-trading.js`.
- `python3 scripts/check_migration_status.py --offline`: migration numbering continuous through 0025.
- `git diff --check`: passed; working tree clean.
- Remote Git blob IDs match the exact tested local files:
  - `backend/api-core.js`: `91acaf19944642cc3023ff9ea59aa3865ca72ac7`
  - `backend/assets/js/app-core.js`: `c4406077df08029d876e56d5fee1dd8005c22e7d`
  - `backend/assets/js/views-account.js`: `670b8bf6df3ebba715840f9a5b3dd90881771b33`
  - `backend/assets/js/views-trading.js`: `ad63fafcecf5748cc5525d5586405fce7bd56d9c`
  - timestamped migration and numbered mirror: `b071d0f30275d9a4f39605628042020338b21ebe`
  - migration-order document: `dadf667cfe95db41053d5a7a578135fde2bcd5bd`
  - policy regression tests: `9ebd6c0c6af7a097954868807f2e0c757dfed0da`
- GitHub combined status contained no checks and workflow-run lookup returned no runs. Do not describe this as GitHub CI passing.

### LIVE DATABASE / RELEASE BLOCKERS
- Read-only live query on project `zlozsutefnmgwwzrlipt` confirms `seconds_contract_policy` does NOT exist yet, and `seconds_contract_positions_one_open_per_user_idx` still exists. Live migration history still contains only `20261102133555` and `20261103062716`.
- No production DDL, migration application, financial write, merge, or deployment was performed. Multi-position ordering and configurable policy are implemented in the feature branch only; they are NOT active in the hosted database.
- Sandbox still has neither Docker nor `psql`. PostgreSQL compilation, migration execution, concurrent multi-position open/settlement, account/ledger invariants, and live end-to-end tests were NOT run.
- Migration-history drift remains a release blocker. Do not use hosted `db push`, `migration repair`, or `apply_migration` until every pre-existing SQL migration has been reconciled with the actual live schema and the user explicitly approves hosted application.

### NEXT BATCH
1. Obtain a non-production PostgreSQL/Supabase test environment or a working local runtime; execute and compile migrations 0024/0025 in sequence.
2. Add database integration/concurrency tests for multiple simultaneous opens by one user, different request IDs, same request ID retries, concurrent settlement of separate positions, same-position settlement idempotency, and exact available/frozen/ledger invariants.
3. Reconcile the two-row live migration history with existing live schema and repository migration contents without inserting fake history rows.
4. Only after integration evidence and explicit approval, plan the hosted migration cutover. No production DDL, real financial writes, merge, or deployment without approval. Preserve V211.


## Seconds policy / settlement source-to-live reconciliation — 2026-11-06

### SOURCE OBSERVED
- Re-fetched this coordination document before the batch. The feature branch remains `fix/manual-withdrawal-rpc-compat-20261106`, HEAD `3ad91a456f6f5bee3d190efd0bbc66e8637519d9`.
- Re-read migration `20261106042714_seconds_policy_snapshot_and_admin_queue_v1.sql` (blob `b071d0f30275d9a4f39605628042020338b21ebe`). Its `settle_seconds_position_v1` contains the agreed three-way settled-position behavior: same request ID + same hash => duplicate success; same ID + different hash => `IDEMPOTENCY_CONFLICT`; different ID => `POSITION_ALREADY_SETTLED`.
- The same migration's `submit_seconds_order_v1` checks existing `open_request_id`, rejects a hash/user mismatch, returns the original position for an exact retry, locks the policy row `FOR SHARE`, locks the USDT account `FOR UPDATE`, and writes operation/ledger/position in one transaction.
- `backend/api-core.js` (blob `91acaf19944642cc3023ff9ea59aa3865ca72ac7`) maps `POSITION_ALREADY_SETTLED` and `IDEMPOTENCY_CONFLICT` to HTTP 409.
- No new migration is needed for settlement idempotency; do not create a duplicate 0026 patch for behavior already present in 0025.

### LIVE DATABASE — READ ONLY
- Re-read migration history: only `20261102133555` and `20261103062716` are recorded.
- Re-queried live schema: `public.seconds_contract_policy` is absent; `seconds_contract_positions_one_open_per_user_idx` remains present; seconds positions total 0 and open positions 0.
- Fetched the actual live `settle_seconds_position_v1` definition. It still returns `duplicate:true` for every different request ID against an already-settled position, and its win calculation still hard-codes `0.85`. Therefore the 0025 source fix is NOT active in the hosted database.
- No production DDL, financial writes, migration application/repair, merge, or deployment occurred.

### NEXT
1. Obtain a legitimate non-production PostgreSQL execution environment before claiming PL/pgSQL compilation or concurrency verification. Do not create a paid Supabase branch without the required cost approval.
2. Run migration 0024 then 0025 against an isolated database and verify exact retry, hash conflict, different-request conflict, multiple simultaneous opens, independent concurrent settlement, and ledger/account invariants.
3. Reconcile the live two-row migration history against every pre-existing migration's actual schema effects before proposing any hosted cutover. Never fabricate migration history entries.
4. Keep the hosted multi-position feature and configurable payout policy marked NOT ACTIVE until a reviewed, approved migration is applied. Preserve V211; no merge or deployment.


## Further live-schema / migration provenance audit — 2026-11-06

### Environment discovery
- Re-read this coordination file at blob `84b9eab736fa44f8428a04d45755426966b71017` before continuing.
- Supabase account currently lists only production project `zlozsutefnmgwwzrlipt`; `list_branches` returns no development branches. No isolated PostgreSQL test target is currently available. No branch/project was created and no cost was incurred.
- Feature branch remains `fix/manual-withdrawal-rpc-compat-20261106`; no source-code commit was made in this batch.

### Migration provenance
- Current `backend/supabase/migrations/` contains only the timestamped 0024 and 0025 migrations:
  - `20261106041624_seconds_unlimited_open_positions_and_settlement_idempotency_v1.sql`
  - `20261106042714_seconds_policy_snapshot_and_admin_queue_v1.sql`
- The operational baseline `0001`–`0023` exists only in `backend/supabase/sql/` as numbered SQL scripts, not as timestamped CLI migrations in the current migrations directory. The migration order document describes those as ordered operational scripts and separately identifies 0024/0025 as timestamped CLI migrations.
- Live DB has the baseline operational tables/functions/indexes (including seconds contracts and the one-open-position index), which align with the numbered SQL baseline; it has no policy table and still has the pre-0024 index/function behavior.
- Live migration history has two records (`20261102133555`, `20261103062716`) whose timestamped files are not present in the current migrations directory. This is an orphaned/unmatched history situation; the present evidence does NOT establish which historical files were applied or whether their effects are still present. Do not mark them reverted/applied or synthesize missing files until provenance is recovered.
- The numbered SQL scripts 0001–0023 must not be replayed against the live database: their core objects already exist. Their presence explains why schema can exist without corresponding timestamped CLI history; it does not authorize reapplication.

### Live security posture — READ ONLY
- All 15 public base tables inspected have RLS enabled; none has FORCE RLS. The `private` backup tables are not in the exposed public schema.
- `pg_policies` returned no public/private policies. For public tables, the inspected table grants show service_role privileges only; no anon/authenticated table grants were returned. With RLS enabled and no policies, browser roles remain default-denied at the row-policy layer; service_role is the intended server-side access path.
- Two live triggers were observed: confirmed-deposit immutability and earn-position snapshot immutability.
- This was read-only inspection; no grants, policies, triggers, tables, functions, or indexes were changed.

### Next
1. Recover the provenance/content of the two orphaned timestamped history records from Git history or deployment artifacts before any history repair.
2. Keep 0001–0023 as a reviewed baseline, not an instruction to replay on the already-provisioned live database.
3. Find a no-cost isolated PostgreSQL execution path; the account currently has no Supabase dev branch. Do not create a paid branch/project without explicit cost acceptance.
4. Compile and execute 0024 then 0025 only in isolated PostgreSQL, run concurrency/idempotency and ledger invariants, then prepare—but do not execute—a production cutover plan.


### Additional live drift found — manual withdrawal payout completion
- Live `withdrawal_requests` columns currently stop at `review_operation_id`; the `payout_reference`, `payout_note`, `paid_by`, and `paid_at` columns required by numbered SQL 0023 are absent.
- Live function inventory does not contain `mark_withdrawal_paid_atomic`; the 0023 SQL also defines `read_withdrawal_history_v1`, which is absent from the live function inventory.
- Therefore the manually approved-then-record-paid withdrawal completion flow in source SQL 0023 is not active in the hosted DB either. Do not report manual payout completion as production-ready.
- SQL 0023 is a numbered operational script, not a timestamped file in `supabase/migrations/`; no production changes were made.


## Withdrawal migration and admin UI compatibility audit — 2026-11-06

### SOURCE OBSERVED
- Re-fetched the coordination branch before this batch. Its head is `daa3344d68f03ad329017f7c112132a653d9133d`; the feature branch remains `fix/manual-withdrawal-rpc-compat-20261106` at `3ad91a456f6f5bee3d190efd0bbc66e8637519d9`.
- The feature API already contains:
  - `POST /api/admin/withdraw/mark-paid`, which calls `mark_withdrawal_paid_atomic` after the manual transfer and requires the financial-write gate plus configured admin actor;
  - `GET /api/withdrawals`, which calls `read_withdrawal_history_v1`;
  - `GET /api/admin/withdrawals`, which calls `read_admin_withdrawal_snapshot_v1`;
  - `POST /api/admin/withdraw/approve` and `/reject`, which call `review_withdrawal_atomic`.
- The currently loaded BTCBOX SPA still registers `admin` as `Admin view loading…`; its `admin.html` shell has no payout/TxID form. The loaded `app-core.js` has no call to the manual mark-paid route or payout-reference UI. Thus the payout endpoint exists in backend source but is not wired into the active BTCBOX admin UI.
- A separate `admin-panel/` React application exists in the repository, but its withdrawal page is an older independent client using `js-api-client`, legacy statuses (`CREATED/DONE/REJECTED/CANCELED`), and a legacy accept/reject flow. It does not implement the current `approved -> manually transfer -> mark-paid with reference` contract. Do not treat it as integrated or reuse it without an explicit contract port and route/build ownership verification.
- `backend/scripts/run_migrations.sh` applies every numbered `backend/supabase/sql/0001_*.sql` … `0025_*.sql` in lexical order to the supplied DATABASE_URL; it is documented for local/test PostgreSQL only.
- Migration compatibility blocker found in source:
  - `0002_financial_ledger_v1.sql` creates `public.withdrawal_requests`.
  - `0003_financial_lifecycle_v2.sql` extends `public.withdrawal_requests` and defines its lifecycle RPCs.
  - `0022_withdrawal_admin_review_status_v1.sql` instead redefines `create_withdrawal_atomic` against `public.withdrawals` and columns `withdrawal_id/request_hash`, a different schema/contract. The current ordered migration document labels 0022 as part of the sequence but does not reconcile this mismatch.
  - `0023_withdrawal_manual_payout_completion_v1.sql` returns to `public.withdrawal_requests`, adds payout fields, and expects `financial_audit_log`.
- The numbered migration runner therefore cannot be assumed to execute cleanly end-to-end. Do not run it against production or staging until 0022's provenance and compatibility are resolved. Do not silently skip/rename 0022 or invent a replacement migration.
- Existing live read-only evidence from the prior batch remains: production lacks the four payout columns and the three payout/history functions; no live migration was applied in this batch. A new read-only SQL probe attempt was blocked before execution, so no new live state is claimed here.

### NOT VERIFIED / BLOCKERS
- Whether `public.withdrawals` exists in the current hosted database and whether 0022 was ever applied anywhere.
- Whether the 0022 file is an abandoned legacy script, an intended alternate schema, or a wrongly numbered migration.
- PostgreSQL compilation/execution of 0022/0023 and the full 0001–0025 chain; no isolated PostgreSQL runtime is available.
- Actual active admin UI integration, since the SPA admin route remains a placeholder.

### NEXT
1. Recover the origin/commit history of 0022 and compare it with 0002/0003, the current live schema, and the old backup branch. Establish whether 0022 is obsolete or needs a safe forward correction; preserve its history as evidence.
2. Reconcile the migration-order document and runner so there is one explicitly validated, dependency-correct path. Do not replay 0001–0023 on the hosted database.
3. Port the manual payout action into the actual BTCBOX admin SPA only after confirming the permitted file ownership and route contract; show approved withdrawals, destination/asset/amount, manual transfer status, required TxID/reference, note, loading/error/success, and duplicate-safe refresh. Keep imported legacy admin-panel code out of the runtime unless deliberately integrated.
4. Obtain a no-cost isolated PostgreSQL execution path, then execute/compile the relevant migrations and test approve/reject/refund, manual payout completion, same-reference retry, conflicting-reference rejection, and audit-log invariants.
5. Keep production unchanged; no apply_migration, migration repair, db push, financial writes, merge, or deployment without explicit approval.


## Audit correction 2026-11-06
The prior withdrawal UI audit statement claiming the active BTCBOX admin route was only a placeholder was incorrect. On feature branch fix/manual-withdrawal-rpc-compat-20261106, backend/assets/js/views-account.js contains the admin withdrawal queue and a manual paid-completion modal; backend/assets/js/app-core.js calls the mark-paid API and backend/api-core.js calls mark_withdrawal_paid_atomic. The modal currently labels TxID/reference as optional, so it does not yet enforce the user's desired transfer-reference recording. Keep the separate admin-panel React app classified as legacy and not evidence of the active SPA. The database blocker remains: live production was previously observed missing payout columns and payout/history RPCs. No database or deployment change was made in this audit.


## Manual withdrawal TxID requirement — 2026-11-06

### SOURCE OBSERVED / IMPLEMENTED
- Feature branch: `fix/manual-withdrawal-rpc-compat-20261106`; latest commit: `e4c1bdb284a5228b38157e31ea82b698156ffd00`.
- Active BTCBOX SPA manual payout modal now labels TxID/reference as required, prevents blank submission, and keeps the modal open with focus returned to the field when empty.
- `POST /api/admin/withdraw/mark-paid` rejects a blank trimmed reference with `PAYOUT_REFERENCE_REQUIRED`; the existing 160-character limit remains.
- Numbered operational SQL `0023_withdrawal_manual_payout_completion_v1.sql` independently rejects blank references inside `mark_withdrawal_paid_atomic`.
- The existing approved-only completion, exact same-reference duplicate response, conflicting-reference rejection, and audit-log record remain unchanged. This records a staff-completed external transfer; it does not initiate a blockchain transfer or create a second debit.
- Added `backend/tests/withdrawal-manual-payout.test.js` with four source regression checks.

### VERIFICATION / NOT VERIFIED
- SOURCE OBSERVED: all four changed paths are present on the feature branch; the latest commit is the regression-test addition above.
- NOT VERIFIED: Node test suite execution, PostgreSQL compilation/integration, hosted database application, and production UI behavior. GitHub combined status returned no checks and workflow-run lookup returned no runs for the latest commit.
- No production database write, migration application/repair, merge, or deployment occurred. The hosted database still must be treated as missing the payout columns/RPCs until a fresh read-only check proves otherwise.

### NEXT
- Run the backend test suite and syntax checks in an isolated runtime. Then resolve the numbered migration baseline compatibility before planning any hosted database change. Keep the manual workflow simple and preserve V211.


## BTCBOX v33 — simple manual deposit workflow coordination (2026-11-06)

- User-approved behavior is intentionally simple: configure receiving address/network in admin; user transfers; staff verifies receipt manually; staff selects the user and matching asset row and enters the received amount for audited atomic credit.
- No user-created pending deposit order, chain watcher, automated credit, or extra approval stage is requested. UID and coin must be auto-bound from the selected user and asset row.
- Source audit on `avali9308-code/btcbox-v33` branch `fix/manual-withdrawal-rpc-compat-20261106`: backend `GET/POST /api/admin/config` exists and validates configured addresses, but the active Admin Console has no address configuration tab/form. Deposit page supports USDT/BTC/ETH/SOL/BNB/USDC while manual-credit UI/API only support USDT/BTC/ETH/SOL; `safeDepositAddresses()` also omits BNB/USDC.
- Implementation handoff: https://github.com/avali9308-code/btcbox-v33/issues/2
- The existing manual credit atomic RPC/idempotency/audit path must remain the only balance-credit path. Existing financial cutover gate must not be bypassed. No financial flags, DB schema/data, merge, or deployment changed.
- AI 3 updated BTCBOX v33 coordination/task-board docs in commits `0c8a760b4a6032f81c67e116fdae3901f744e7f3` and `5d397664990be07bb0f80e7fd6a4ac523f505db4`. This is a coordination handoff, not implementation or QA acceptance.


## BTCBOX V33 — manual deposit configuration batch — 2026-11-06

- The latest V33 feature branch source HEAD after this batch is `c82c07acad6df6e3bdc83de9f8be2b29bbade790` (subsequent coordination-document commits may advance it). The implementation adds an Admin Console deposit-address tab, uses existing authenticated admin config GET/POST, supports all eight configured network keys, and aligns manual-credit account rows/API validation with six assets (USDT/BTC/ETH/SOL/BNB/USDC).
- Explicit blank address values now clear/deactivate a known network; unknown network keys and malformed nonblank addresses remain rejected. User deposit flow remains manual verification/manual credit; no pending deposit orders or chain automation.
- Manual credit remains behind the financial cutover gate and atomic ledger RPC with idempotency/audit. No production DB writes, migration application, flag changes, merge or deployment.
- Five regression tests were added. A source-level audit passed 10/10 targeted assertions; Node tests/build/browser/isolated PostgreSQL were NOT RUN. GitHub Actions lookup for implementation SHA returned zero runs and no combined status contexts. Issue #2 remains open until executable test and independent review evidence is available.


## BTCBOX V33 — migration chain finding — 2026-11-06

- Issue #3: https://github.com/avali9308-code/btcbox-v33/issues/3. Source inspection found numbered migration 0022 references `public.withdrawals`, while 0002/0003 establish `public.withdrawal_requests` and 0023 uses `public.withdrawal_requests`. The numbered runner executes all these files in order.
- Classification: SOURCE OBSERVED; PostgreSQL runtime failure NOT REPRODUCED. Keep production DB untouched; do not skip/renumber migrations. Resolve against canonical schema and prove the full sequence in isolated PostgreSQL before cutover.


## BTCBOX V33 — withdrawal migration 0022 reconciliation — 2026-11-06

- Issue #3: https://github.com/avali9308-code/btcbox-v33/issues/3. Provenance checked: 0022 first appears in archive-extraction commit `05da31097802d012aa79b2976386ddce5f92757c` and is absent from its parent. No prior file history exists in this repo.
- Source resolution: 0002/0003 establish canonical `withdrawal_requests` and the single pending -> approved/rejected manual review flow. The active API calls the canonical nine-argument RPC; every withdrawal is manually reviewed. 0023 adds manual payout completion on that same table.
- 0022 now acts as an explicit compatibility checkpoint; it verifies the canonical table/status column and does not create a parallel schema, RPC overload, or second review state. It remains in the numbered runner sequence. Regression test file added; static source audit 12/12 passed.
- NOT RUN: Node tests/build or PostgreSQL runtime/full migration chain. No production DB writes, migration apply, financial flag changes, merge or deployment. Keep Issue #3 open until isolated runtime proof is obtained.


## BTCBOX audit migration simplification — 2026-11-06

- SOURCE OBSERVED: `backend/supabase/sql/0002_financial_ledger_v1.sql` is the single canonical creator of `public.financial_audit_log`; `0003`, `0004`, `0005`, `0006`, `0007`, and `0016` write using that canonical column contract.
- SOURCE OBSERVED: `0021_admin_audit_log_append_only_v1.sql` now validates the canonical table and applies RLS, service-role append-only grants, mutation-blocking triggers, and the existing `append_admin_audit_log` RPC contract. No second audit table is needed.
- FIXED IN SOURCE: marked `backend/supabase-migration-runner.sql` as deprecated/historical and explicitly prohibited execution. Its old instructions contradicted the current fail-closed financial flags and its aggregate SQL predates current numbered migration fixes.
- Canonical SQL source remains `backend/supabase/sql/NNNN_*.sql`; the numbered local/test runner is `backend/scripts/run_migrations.sh` and must only use an isolated local/test `DATABASE_URL`.
- NOT VERIFIED: PostgreSQL syntax/runtime, trigger behavior, role grants, complete numbered migration chain, Node tests/build. No hosted DB operation was performed.
- NO production table drop/recreate, production write, financial flag change, merge, or deployment. Preserve production schema and records.


## Migration channel audit — 2026-11-06

- SOURCE OBSERVED: the complete operational schema is in `backend/supabase/sql/NNNN_*.sql`; the local/test runner is `backend/scripts/run_migrations.sh`.
- SOURCE OBSERVED: `backend/supabase/migrations/` currently contains only timestamped 0024 and 0025 mirrors. Both files are byte-for-byte identical to numbered 0024 and 0025; they do not contain the base ledger, account, deposit, withdrawal, or audit schema and are NOT a complete empty-database bootstrap.
- SOURCE OBSERVED (read-only hosted migration-history query): the connected Supabase project reports versions `20261102133555` (`revoke_public_execute_rls_auto_enable`) and `20261103062716` (`create_private_btcbox_test_cleanup_backup`). Their matching timestamped migration files are absent from the current feature branch. This is migration-history drift; it is not permission to repair or replay history.
- DECISION: do not mix the numbered runner and Supabase CLI timestamped path. Do not run `db push`, `migration repair`, `db reset`, or apply SQL to the hosted project. Resolve one canonical bootstrap strategy and map the two hosted history entries before any hosted change.
- Supabase CLI v3 changed database commands to local-by-default and requires explicit remote targeting/confirmation for hosted changes; scripts must be reviewed before use.
- NOT VERIFIED: complete isolated PostgreSQL bootstrap, hosted schema equivalence, whether the two recorded hosted migrations have side effects beyond their names, and any safe repair sequence.
- No hosted database writes, migration apply/repair, reset, financial flag changes, merge, or deployment were performed.


## Operational migration runner boundary — 2026-11-06

- SOURCE OBSERVED: `0017_financial_migration_staging_v5.sql` creates a legacy quarantine table explicitly intended only for a dedicated staging project. `0018`–`0020` are read-only staging/ledger reconciliation diagnostics, not operational schema migrations.
- FIXED IN SOURCE: `backend/scripts/run_migrations.sh` now explicitly skips files 0017–0020 and applies only operational numbered migrations. The SQL files remain in the repository for the separate staging workflow; none were deleted.
- Updated the migration-order guide, Vercel deployment instructions, and pre-release checklist so the staging-only scripts are not represented as routine operational migrations.
- Added `backend/tests/migration-runner-boundaries.test.js` to guard the skip boundary and ensure the diagnostic scripts remain read-only.
- NOT VERIFIED: shell execution against PostgreSQL, full operational migration chain, staging import/reconciliation, Node tests/build. No production DB write, migration repair/apply, financial flag change, merge, or deployment.


## 2026-11-06 integration batch: delegated administrator authentication

- Working branch: `integration/btcbox-next-batch-20261106`, created from the current `main` after PR #26 was merged.
- Source-observed baseline: the React Supabase Auth provider already contains Ethereum/Solana wallet identity and account-linking flows; the web3 branch's auth provider and account security page are byte-identical to current main. Do not copy these again.
- Source-observed gap: `backend/api-core.js` still protects all `/api/admin/*` routes with shared Basic Auth, while `backend/admin-auth.js`, `backend/admin-rbac.js`, and the private membership schema existed but were not wired into the API.
- Implemented on this branch: Supabase Auth token verification followed by server-side membership lookup; route-to-permission enforcement for all current admin endpoints; service-role-only public RPC bridge that keeps the underlying `private` schema unexposed; unit tests for membership verification and fail-closed behavior.
- Legacy Basic Auth remains as a compatibility path until the existing admin console is migrated to Supabase Auth; it does not receive delegated-role permission checks. Remove it after the admin UI migration is complete.
- No database was reset or written, no production deployment was triggered, and no financial operations were executed.
- Validation pending: backend CI and frontend CI on the PR head; independent route-level QA and a fresh-schema dry run remain not verified.


## 2026-11-06 integration batch: remove the obsolete Seconds one-open rule

- Source-observed conflict: the active Seconds policy RPC still mapped a per-user partial unique index to `OPEN_POSITION_EXISTS`, and the repository retained both numbered and duplicate one-open-position SQL artifacts plus a test that required the restriction.
- Removed the obsolete single-open SQL artifacts and their contradictory test; removed the archived concatenated one-shot migration runner to prevent accidental reuse of stale schema instructions.
- Updated the active Seconds policy/order RPC so unique violations are treated only as request/idempotency conflicts; no per-user open-position uniqueness rule remains. The backend policy's optional `per_user_open_exposure` remains the configurable risk boundary, not an order-count limit.
- Updated settlement dependency notes so the Seconds settlement idempotency SQL depends on the core Seconds schema, not the retired single-open rule.
- Added `seconds-unlimited-open-positions.test.js` to guard the intended behavior and the complete open-position array response.
- No database was reset or written. The fresh empty-database schema is still a separate deliverable; do not apply old numbered migrations as a prerequisite.


## CI correction for unlimited Seconds positions batch

- The first PR #29 CI run failed because several existing tests still imported the retired `0015` SQL artifact, the migration checker treated retired sequence 15 as a missing file, and the isolated API harness did not map the new admin helper imports.
- Updated the Seconds server-authoritative test to validate the current policy RPC in `0025`, marked sequence 15 as intentionally retired in the static checker, aligned the settlement prerequisite wording, and synchronized the isolated API test harness with the admin helper imports.
- These are test/validation corrections only; no database operation or production change was performed. CI must rerun on the new exact PR head before merge.


## 2026-11-06 integration batch: React Seconds order entry and server policy read

- Added a service-role-only `read_active_seconds_policy_v1` RPC. The private policy tables remain unavailable to browser roles.
- Added authenticated `GET /api/seconds/policy`, which validates the active symbols, durations, stake bounds, payout floor, and optional exposure limit, and returns the backend financial-cutover state.
- Added typed frontend clients for active policy, order submission, and settlement.
- Replaced the React Seconds read-only placeholder with policy-driven order entry. A request ID and exact payload are persisted per authenticated user; an unresolved request can only be retried with the same ID and payload until the positions endpoint confirms it.
- Each open position displays its own remaining time. At maturity, the client asks the server to settle that specific position with a deterministic idempotency key; the server still samples the trusted reference price and applies the ledger transaction.
- The page renders every open position and settled history row; no per-user order-count cap was introduced. Backend policy may still set an aggregate exposure boundary.
- Financial writes remain disabled unless the existing backend cutover switch is enabled. No database was reset or written and no live financial operation or deployment was executed.
- Validation pending: frontend build, backend tests, and independent browser QA on the exact PR head.


## 2026-11-07 — 2号 AI frontend/admin integration follow-up

- Role: 2号 AI — Web App + Admin Panel owner. This batch is a dependent follow-up to Draft PR #50, not a replacement for it.
- Repository: `avali9308-code/btcboxcdt`.
- The previously mandated branch `work/btcbox-unified-20261104` was absent from the current GitHub branch inventory. It was recreated from the exact integration baseline `73367233a5f4d37e828cb124f03f3eff84a10a2c`, which compares identical to `fix/post-merge-db-bootstrap-seconds-20261106`. No old branch was deleted.
- SOURCE OBSERVED: PR #50 remains Draft and targets `main`; the parent integration branch contains the deposit snapshot/history, manual-credit ledger RPC, admin RBAC, withdrawal lifecycle, KYC/support workflows and the latest three passing CI runs attached to commit `73367233a5f4d37e828cb124f03f3eff84a10a2c`.
- SOURCE OBSERVED: customer `GET /api/orders` and administrator `GET /api/admin/orders` both use `financial_matching_orders` when matching-engine mode is requested, and both fail closed when that requested cutover is unavailable. Legacy state reads are an explicit fallback only when matching-engine mode is not requested.
- GAP FOUND: the admin audit endpoint previously selected canonical PostgreSQL audit reads only from `ADMIN_AUDIT_POSTGRES_READS_ENABLED`. Normalized financial reads could therefore be enabled while the audit UI still read the retention-limited state document, hiding PostgreSQL ledger events from the admin audit view.
- FIXED IN SOURCE: canonical audit reads are now also required whenever `financialPostgresReadsEnabled()` is true. Database audit read failures return 503; the route does not silently fall back to the state document.
- FIXED IN SOURCE: administrator withdrawal rejection and KYC rejection no longer use native `window.prompt`. Both use a centered, accessible in-app modal with a required reason, bounded to 300 characters; approval/rejection request behavior and existing financial cutover guards are unchanged.
- TESTS ADDED: regression coverage for custom rejection dialogs, manual-credit consistency across PostgreSQL ledger/deposit/audit writes and admin balance refresh, and customer/admin spot-order source parity. Existing PostgreSQL lifecycle assertions remain the database-level evidence for deposit history and idempotent retry.
- NOT VERIFIED: new branch CI, exact-head frontend build, Node tests, and independent browser QA are pending. The new changes are source-observed only until exact-head checks complete.
- SAFETY: no hosted database reads/writes were initiated in this batch; no financial operation, merge to `main`, production deployment, secret/config change, or financial cutover flag change was performed.
- NEXT: run Backend, PostgreSQL schema and Frontend CI on the dependent draft PR; review exact-head results; then continue checking whether every audited admin mutation has a matching canonical event and whether the admin/user views expose the same confirmed financial state.


### 2026-11-07 verification addendum — exact-head audit

- Latest tested application-code head: `6b82683a2436ccff6b4a23ebb68bd911fe9de43c`. The subsequent coordination-document commit is documentation-only and does not change tested application code.
- Additional gap found: the canonical audit reader selected only actor/action/reason and omitted `object_type`, `object_id`, and financial `metadata`. The admin UI therefore could not show amount, asset, receipt/TxID, or operation identifiers even when the database held them.
- FIXED IN SOURCE: canonical audit reads now select object identity and metadata, then render only an explicit allowlist (`asset`, `amount`, `fee`, `network`, `reference`, `payout_reference`, `operation_id`, `idempotency_key`, order fields). Raw metadata, wallet destinations, email addresses, and unknown keys are not returned. The audit UI now displays whether the source is PostgreSQL canonical, state-file retention-limited, or unknown.
- FIXED IN SOURCE: wallet redaction now matches an exact 40-hex Ethereum address, not the first 40 characters of a 64-hex transaction hash. Wallet addresses remain masked; full transaction hashes can be displayed as audit references.
- Additional refresh audit found one more false-failure path in delegated administrator membership changes. The membership mutation is now confirmed separately from the subsequent list refresh; refresh failure no longer reports that the membership mutation itself failed.
- EXACT-HEAD BACKEND CI: run `42281250727`, success. Build, 356 Node tests (356 passed / 0 failed), fail-closed preflight, and output/entrypoint checks all passed.
- EXACT-HEAD FRONTEND CI: run `42281250684`, success. Lint, Vite build, Chromium installation, and desktop/mobile route smoke tests all passed.

- Additional integration improvement: the Admin Panel Orders tab now displays whether its rows come from canonical PostgreSQL matching orders or the explicit legacy-state fallback. The customer and administrator order routes are covered by a source-parity regression test.
- POSTGRESQL EMPTY-DATABASE CI: run `42268516996`, success on the parent integration baseline `73367233a5f4d37e828cb124f03f3eff84a10a2c`. This follow-up changes no SQL migration or PostgreSQL bootstrap file, so the schema suite was not duplicated on the child PR.
- Parent PR #50 description still states `21dacf90fac3b48bf461707da1442ca35afbc95f` as its exact head, while its implementation branch currently resolves to `73367233a5f4d37e828cb124f03f3eff84a10a2c` (the base SHA of PR #51). Treat the SHA in PR #50's description as stale until its owner updates it.
- PR #51: Draft, open, based on `fix/post-merge-db-bootstrap-seconds-20261106`; no merge to `main`. PR #50 remains Draft.
- Vercel status on the child PR reports `build-rate-limit` / upgrade-to-Pro. This is a hosting preview/build-rate-limit status, not a GitHub Actions test failure. No production deployment or financial operation was initiated.
- NEXT: independent review of the updated audit metadata allowlist and permissions; confirm runtime configuration uses canonical financial reads before treating the audit list as complete; then continue Web App/Admin Panel integration against the same parent baseline.


### 2026-11-07 — next batch: admin user financial history and adjustment guard

- Role: 2号 AI — Web App + Admin Panel. Dependent follow-up remains Draft PR #51 against parent PR #50's exact implementation head `73367233a5f4d37e828cb124f03f3eff84a10a2c`.
- Additional source audit found the Admin user detail endpoint cloned the legacy user record and only removed credentials/KYC secrets. That broad `users.read` projection could also carry raw deposit, withdrawal, Earn and support-message arrays.
- FIXED IN SOURCE: remove raw `deposits`, `withdrawals`, `earn_records`, and `support_messages` from the generic user-detail projection. When normalized financial reads are enabled, the backend reuses the canonical `read_financial_account_snapshot_v1` RPC for balances and history. Deposit history is projected only when the verified membership also has `deposits.read`; withdrawal history only with `withdrawals.read`. When normalized reads are disabled, permitted histories are explicitly marked `legacy_state_retention_limited`.
- FIXED IN SOURCE: Admin user detail UI displays deposit asset/network, amount, status, TxID/receipt reference and time, with an explicit PostgreSQL versus retention-limited legacy source label. The view is hidden without `deposits.read`.
- FINANCIAL CONTROL GAP: permission `financial_adjustment.request` was mapped to `admin_adjustment_atomic`, which applies an immediate ledger mutation and has no approval queue. This conflicts with the permission's "request" semantics and lacks maker-checker control.
- SAFETY FIX: the direct `POST /api/admin/user/balance` endpoint now fails closed with `FINANCIAL_ADJUSTMENT_APPROVAL_REQUIRED` before any mutation until a dual-approval workflow is implemented. The misleading permission option was removed from the Admin role editor. The existing verified manual-deposit RPC path is unchanged. Do not re-enable this endpoint by changing only a feature flag.
- REGRESSION TESTS: added `backend/tests/admin-user-financial-history.test.js` for permission-scoped projections, legacy-array non-disclosure, UI source labels; extended `manual-deposit-reference.test.js` and `admin-route-permissions.test.js` for snapshot reuse and adjustment guard.
- EXACT-HEAD APPLICATION SHA: `e5f81fc535383b97ad2cea311deeb58c125d01c8`.
- BACKEND CI run `42285954538`: success; 362 tests passed, 0 failed; unified build, fail-closed preflight, output/entrypoint checks passed.
- FRONTEND CI run `42285954504`: success; lint, Vite build, Chromium install and 20/20 desktop/mobile route smoke tests passed.
- PostgreSQL schema CI was not rerun because this batch changes no SQL migration/bootstrap files. Parent baseline `73367233a5f4d37e828cb124f03f3eff84a10a2c` previously passed empty-database PostgreSQL CI run `42268516996`. A fresh database-level rerun remains a release gate after any future SQL changes.
- Vercel check remains `build-rate-limit`; no deployment was initiated. No hosted database operation, real funds operation, financial cutover change, merge, or production deployment occurred.
- NEXT: independently review the new user-detail field projection against every Admin role; verify Super Admin bootstrap and delegated-role provisioning in a disposable Supabase project; test real Supabase Auth/RBAC and private KYC Storage on staging; continue order/ledger reconciliation and complete a full browser workflow with a disposable account before any release decision.


### 2026-11-07 — next batch: live spot refresh and financial permission hardening

- Role: 2号 AI — Web App + Admin Panel. Work remains in Draft PR #51, based on PR #50's exact implementation head `73367233a5f4d37e828cb124f03f3eff84a10a2c`.
- SECURITY HARDENING: manual deposit credit now requires both `deposits.review` and `deposits.read`. The API rejects a credit request with `ADMIN_PERMISSION_DENIED` if the verified membership lacks deposit-history read access; the UI disables the credit action under the same condition. This ensures an operator can inspect existing receipt/ledger history before crediting.
- AUTH DOCUMENTATION: corrected `docs/INITIAL_SUPER_ADMIN_BOOTSTRAP.md` to state Google sign-in only. Email/password and email OTP are not to be enabled or relied on for this project.
- LIVE PRICE GAP FOUND: the React Spot Trading page fetched its ticker/order book only on initial load or manual refresh. The public Dashboard already polled markets every 30 seconds, but the trading workstation did not have an automatic refresh loop.
- FIXED IN SOURCE: Spot Trading now refreshes the ticker and order book every 15 seconds and candles every 60 seconds without reloading order-entry state or overwriting the customer's typed limit price. It displays the last successful update time and a warning when a refresh fails, retaining the last confirmed values instead of silently replacing them.
- REGRESSION TESTS: `backend/tests/spot-trading-live-refresh.test.js` protects polling lifecycle, cancellation cleanup, and the no-price-overwrite rule. `admin-route-permissions.test.js` now protects the dual permission requirement.
- EXACT-HEAD APPLICATION SHA: `8e7b9b8c271906df051a68d01e30c3f07b542e80`.
- BACKEND CI run `42286959099`: success; 366 tests passed, 0 failed; unified build, fail-closed preflight, output/entrypoint checks passed.
- FRONTEND CI run `42286959137`: success; lint, Vite build, Chromium installation and 20/20 desktop/mobile Playwright route smoke tests passed.
- PostgreSQL schema CI was not rerun: this batch changes no SQL migration or bootstrap file. Parent integration baseline `73367233a5f4d37e828cb124f03f3eff84a10a2c` passed empty-database PostgreSQL CI run `42268516996`.
- KYC RELEASE GATE: `docs/KYC_DOCUMENT_STORAGE.md` confirms no automatic deletion after approval/rejection and no retention period. This is intentionally left unresolved pending the owner's explicit privacy/legal retention policy; do not invent a retention duration or enable production KYC storage before it is set.
- Hosting check remains Vercel `build-rate-limit`; no deployment was attempted. No hosted Supabase writes, real funds operations, financial cutover change, merge to `main`, or production deployment occurred.
- NEXT: finish independent review of delegated-role grants and user-detail projection; perform Super Admin bootstrap, delegated-role provisioning, private KYC upload/preview and auth checks only in a disposable/staging Supabase project; get the owner-approved KYC retention/deletion policy; then continue full order/ledger reconciliation. Do not perform production cutover as part of this review.


### 2026-11-07 — next batch: delegated-admin PostgREST bridge repair

- Role: 2号 AI — Web App + Admin Panel. Work remains in the existing Draft PR #51 integration follow-up; no merge or deployment.
- CRITICAL INTEGRATION DEFECT FOUND: Admin Panel delegated-administrator list and mutation handlers call PostgREST endpoints `/rest/v1/rpc/admin_list_memberships_v1` and `/rest/v1/rpc/admin_manage_membership_v1`. Migration `0026_admin_rbac_private_store_v1.sql` previously defined only the corresponding `private.*` functions, and exposed only the `public.admin_get_membership_v1` bridge. As a result, membership session lookup could work while the Admin Panel's list/provision/update/suspend/reactivate/revoke calls would fail because PostgREST cannot invoke functions in the unexposed private schema.
- FIXED IN SOURCE: added `public.admin_list_memberships_v1(uuid)` and `public.admin_manage_membership_v1(uuid,uuid,bigint,text,text[],text,text,text)` SECURITY DEFINER SQL bridges. Both delegate to the private implementations, use a fixed `pg_catalog, private` search path, revoke execution from PUBLIC/anon/authenticated, and grant execution only to `service_role`. The private schema and its tables remain unexposed; the existing backend derives actor UUID from verified Supabase Auth and independently enforces Super Admin authority.
- REGRESSION TESTS: added `backend/tests/admin-rbac-postgrest-bridge.test.js` covering exact RPC names/signatures, private implementation delegation, execute grants, verified actor identity and Super Admin guards.
- CI GAP FOUND: PostgreSQL schema workflow only ran on PRs targeting `main`, while this follow-up PR targets `fix/post-merge-db-bootstrap-seconds-20261106`. SQL changes on this PR therefore would not trigger the empty-database schema suite.
- FIXED IN SOURCE: added the current integration base branch to the PostgreSQL workflow's `pull_request.branches` filter. The SQL migration change now qualifies for the empty-database PostgreSQL workflow on PR #51.
, and the disposable PostgreSQL parser rejected it. The bridge bodies were corrected to use SQL-standard single-quoted bodies with positional parameters (`$1..$8`), avoiding dollar-quote delimiter handling.
- REGRESSION TESTS now assert the exact SQL bridge bodies as well as signatures and grants. The failed disposable run was **42287860624** (job **128133254924**); it is a failure of the first bridge draft, not a passing result.
- VERIFIED AFTER CORRECTION: empty-database PostgreSQL run **42288216880** passed on commit `ab6a1ddf18e4554fa9a1e2b059c911b37d2c4ff7`; all canonical SQL files applied successfully to disposable PostgreSQL 16. Backend CI run **42288216886** passed with **371/371** tests, unified build and fail-closed preflight. Frontend CI run **42288216931** passed lint, Vite build, Chromium setup and desktop/mobile Playwright route smoke tests. These are exact current application/schema checks; the subsequent handoff-only documentation update does not change executable source.
- Exact source commits: initial SQL bridge `e261f7eded6c70b3d62900a13b9a0537ba53f6ef`; CI trigger `a073f333ff074ecf16290379ddf5e88a6932d0bf`; corrected SQL bodies `ccab9a84f579ec25e75e6e449673d9a8b4a860c5`; regression test update `c9b7da035c6546194d8048789e2ba49791675ce0`.
- KYC lifecycle review: existing code intentionally retains approved/rejected evidence and does not delete it. This remains blocked on the owner's explicit retention/deletion policy; do not invent a duration, delete real documents, or enable hosted KYC storage before policy approval.
- NEXT: wait for and inspect exact-head backend, frontend and empty-PostgreSQL CI; then review full role provisioning UI and KYC rejection/resubmission edge cases. If the SQL suite fails, fix the migration in the disposable CI environment only. No production DB, financial cutover, merge, or deployment.


## Delegated administrator identity mapping — 2026-11-07

### SOURCE OBSERVED
- The Admin Panel's delegated-administrator candidate selector previously submitted `user.uid`, which is BTCBOX's internal sequential account key (created from `db.next_uid++`), as `target_user_id`.
- The protected SQL membership function correctly requires `target_user_id` to exist in `auth.users`; the API also correctly validates a UUID. The previous selector therefore could not provision a normal BTCBOX user because the internal UID and Supabase Auth UUID are different identifiers.
- BTCBOX account records already retain the primary Supabase identity as `supabase_user_id` (and linked identities in `supabase_user_ids`).

### IMPLEMENTED
- The Super Admin's user-list response now includes `admin_auth_user_id`, sourced from the primary `supabase_user_id` (with first linked ID as legacy fallback). Non-Super-Admin responses receive an empty value; the raw linked-ID array is never serialized.
- The Admin Panel candidate selector now filters for UUID-shaped Auth IDs and submits that Auth UUID while continuing to show the BTCBOX internal UID as a human-readable account reference.
- Extended `AdminUserRecord` and added `backend/tests/admin-provisioning-identity.test.js` for response disclosure, candidate selection, and target-user contract checks.
- Code commit: `bf1bf3704c2de107b7e491e2d73dcdc54ebc90ba` (parent `9257324d45af4bdce4b2f283e4cee07366614fb2`).

### VERIFICATION
- SOURCE CHECK PASSED: re-fetched the exact commit's API response, frontend selector and regression test; the selector value is now `admin_auth_user_id`, not `uid`.
- GitHub Actions started for this exact PR head: backend run `42289098844`, frontend run `42289098919`, PostgreSQL schema run `42289098841`. All were `in_progress` at the time of this entry; no test pass is claimed yet.
- Vercel status still reports `build-rate-limit`; this is a platform quota failure, not a code-build result. No deployment was initiated.
- NOT VERIFIED: hosted Supabase Auth identity coverage for legacy accounts, runtime provisioning against isolated Supabase staging, and browser E2E of the full Super Admin workflow.

### NEXT
- Wait for exact-head backend/frontend/PostgreSQL CI results and fix any failures.
- Validate with isolated Supabase staging only after a safe test identity and environment are available. Do not create or change hosted/production administrator memberships during QA.
- No merge, deployment, production database operation, or financial transaction was performed.


### Verification correction — 2026-11-07
- The first backend CI attempt on `bf1bf3704c2de107b7e491e2d73dcdc54ebc90ba` exposed a test-harness path error (the new test referenced `../../frontend` from the backend directory). The application code built successfully, but the backend test job failed; this attempt is explicitly not counted as a pass.
- Corrected the test paths to `../frontend` in commit `d017c8bdc3ccebd9337410d3e513ce41a8fdb5b2`.
- Exact corrected-head backend CI run `42289313884`: **passed, 374/374 tests**, unified build and fail-closed preflight.
- Exact corrected-head PostgreSQL schema CI run `42289313983`: **passed**, all canonical SQL migrations applied to an empty disposable PostgreSQL database.
- Exact corrected-head frontend CI run `42289313921`: **passed**, including lint, Vite build, Chromium setup, and desktop/mobile Playwright route smoke tests. All three GitHub Actions suites passed for application-code head `d017c8bdc3ccebd9337410d3e513ce41a8fdb5b2`; the later coordination-only PR head is `f718332b7e388f3d8f7dda7b2cea5e96a4c4a5cb`.


### 2026-11-07 — KYC legacy-status resubmission guard
- Role: 2号 AI — Web App + Admin Panel. Continued in Draft PR #51; no merge or deployment.
- DEFECT FOUND: The customer KYC page already treated `processing`, `under_review`, and `verified` as locked states, but the API submission guard only blocked exact `pending` and `approved`. Legacy/imported records using these aliases could therefore be resubmitted, replacing evidence while still under review or after verification.
- FIXED: added a shared server-side `kycSubmissionBlock` status normalizer. It blocks `pending/processing/under_review` as in-review and `approved/verified` as approved; `rejected/failed/not_submitted` remain eligible for the existing resubmission flow. The guard runs before new document upload and record replacement.
- REGRESSION TEST: added coverage for all locked aliases, case/whitespace normalization, and allowed rejected/failed/unsubmitted states.
- Code commit: `feed31301d44f4231eeafabca86e7abee722d24f`.
- EXACT-HEAD BACKEND CI run `42291352612`: **passed, 375/375 tests**, unified build and fail-closed preflight.
- EXACT-HEAD FRONTEND CI run `42291352569`: **passed**, lint, Vite build, Chromium and **20/20** desktop/mobile Playwright route smoke tests.
- EXACT-HEAD PostgreSQL schema CI run `42291352599`: **passed**, all canonical SQL migrations applied to an empty disposable PostgreSQL database.
- This batch changes no SQL schema; the PostgreSQL suite was run regardless and passed. Vercel remains subject to the existing `build-rate-limit` platform status; no deployment was attempted.
- NEXT: continue cross-checking Admin role visibility against user-detail projections and the canonical order/ledger read paths; run hosted Auth/Storage workflows only in isolated staging after test credentials are available. KYC retention/deletion remains an owner-policy decision; no duration is invented and no documents are deleted.
- No production DB operation, financial transaction, merge, or deployment was performed.


### 2026-11-07 — KYC legacy-state guard and Admin Auth identity projection
- Role: 2号 AI — Web App + Admin Panel. Changes remain in Draft PR #51.
- KYC DEFECT: Customer UI locked `processing`, `under_review`, and `verified`, while the server only blocked exact `pending` and `approved`. Legacy/imported status aliases could bypass the UI and overwrite an in-review/verified submission.
- KYC FIX: added server-side status normalization and a shared submission guard. In-review aliases return `KYC_ALREADY_PENDING`; approved aliases return `KYC_ALREADY_APPROVED`; rejected/failed/unsubmitted remain eligible for the existing resubmission workflow. The guard executes before uploading or replacing evidence.
- KYC REGRESSION: exact-head backend run `42291352612` passed **375/375** tests; frontend run `42291352569` passed lint/build and **20/20** desktop/mobile Playwright smoke tests; PostgreSQL run `42291352599` passed empty-database schema bootstrap.
- ADMIN PRIVACY DEFECT: Admin `users.read` detail route cloned the user record and removed passwords/session secrets, but still retained Supabase Auth UUID fields and linked provider identity metadata. The Admin UI does not consume these fields.
- ADMIN PRIVACY FIX: user detail projection now removes `supabase_user_id`, `supabase_user_ids`, `auth_identities`, and `auth_providers` before returning the record. Added regression assertions and confirmed the Admin UI has no dependency on those properties.
- Code commit: `1483eb7821f098387bebfc52e3b2a44990e46488`; KYC source/test commit: `feed31301d44f4231eeafabca86e7abee722d24f`.
- EXACT-HEAD BACKEND CI run `42291739085`: **passed, 376/376 tests**, unified build and fail-closed preflight.
- EXACT-HEAD PostgreSQL schema CI run `42291739078`: **passed**, all canonical migrations applied to an empty disposable PostgreSQL database.
- EXACT-HEAD frontend CI run `42291739115`: lint and Vite build passed; Chromium setup / desktop-mobile smoke suite was still running at the time this entry was written. No full frontend pass is claimed yet.
- No SQL migrations changed. No hosted Supabase Auth/Storage writes, KYC document deletion, production DB operation, financial transaction, merge, or deployment occurred.
- NEXT: confirm exact-head frontend CI; continue checking Admin role projections and user/admin order/ledger source alignment. KYC retention/deletion still requires owner policy approval; do not invent a duration.


### 2026-11-07 — Admin financial balance projection hardening
- Role: 2号 AI — Web App + Admin Panel. Continued in Draft PR #51.
- FINDING 1: `GET /api/admin/user` cloned the complete legacy user record before adding permission-scoped PostgreSQL balance fields. Even after the explicit balance assignment was gated, a pre-existing `balances` object could remain in the clone. Fixed by deleting inherited `balances` and `financial_balance_source` before projecting fields; balances and their source are now attached only when the caller has `deposits.read`, matching the existing manual-credit UI and deposit review permission model. The UI hides balance values/source and explains the missing permission when `deposits.read` is absent.
- FINDING 2: `GET /api/admin/users` exposed `total_usdt` to every `users.read` administrator and unnecessarily read account balances/prices for all such requests. Fixed by requiring the existing `financial_audit.read` permission before querying financial balances/prices or including the aggregate field. No new RBAC permission was added.
- Regression coverage added in `backend/tests/admin-user-financial-history.test.js` for inherited-balance stripping, detail projection gating, and aggregate gating on the user list.
- Commits: `c7d88b7b98554ca7150c5291a4c688ea1a66e734`, `bf44da41f7a2e7b19bca6b34b78ae7f61bcbf89a`, `e0b192f5749f30934257bb69966dc114bf7b9cc7`.
- Exact-head CI for `e0b192f5749f30934257bb69966dc114bf7b9cc7`: Backend run `42293160614`, Frontend run `42293160750`, PostgreSQL schema run `42293160618`; all were running when this note was authored. No pass is claimed until final conclusions are successful.
- No schema change, merge, deployment, production database operation, or financial transaction. PR #51 remains Draft.
- NEXT: after CI passes, continue auditing permission-scoped KYC identity evidence, order/customer history parity and audit-event coverage. Hosted Supabase workflows remain staging-only.


#### Verification result — 2026-11-07
- Exact application-code head `e0b192f5749f30934257bb69966dc114bf7b9cc7` CI is fully green:
  - Backend `42293160614`: **378/378 tests passed**, build and fail-closed preflight passed.
  - Frontend `42293160750`: lint/build passed; **20/20** desktop/mobile Playwright route smoke tests passed.
  - PostgreSQL `42293160618`: empty-database bootstrap and canonical SQL application passed.
- The final coordination-doc-only branch head is recorded in Git; no application code changed after the exact tested code head.


## 2026-11-07 — Five-batch continuation (KYC → orders → fund audit → support idempotency → API contract)

- Role: continuation AI on `work/btcbox-unified-20261104`. Verified handoff commits `e0b192f` and `d8539d2` are in branch history; HEAD was `d8539d2` at start (no other AI had pushed to this branch). PR #51 and follow-up PRs #52/#53 were found closed and could not be reopened; opened fresh draft PRs to trigger CI. No merge, no deployment, no production DB / real funds operation. No new RBAC permission invented. Google sign-in unchanged; no Email OTP reintroduced.

### Batch 1 — KYC permission & state consistency
- FINDING: legacy `processing` / `under_review` KYC records were invisible to the admin review queue (exact `'pending'` filter) while the customer-side `kycSubmissionBlock` blocked resubmission, leaving those users stuck. `kyc_level` also ignored the `verified` / `processing` / `under_review` aliases. Permission exposure was already correct: ordinary responses mask `id_number`; admin user-detail strips KYC evidence to `{status}`; `reviewed_by` / `review_reason` are never serialized to customers; document previews are owner-scoped 5-minute signed URLs gated by `kyc.read`.
- FIX: added shared `normalizeKycStatus` / `isKycInReview` / `isKycApproved` helpers; admin KYC queue now includes all in-review aliases and returns the actual status; approve accepts every in-review alias without the exception override; `kyc_level` uses alias-aware predicates. No new permission.
- REGRESSION: `backend/tests/kyc-flow.test.js` extended (alias normalizer, approval gate accepts aliases, kyc_level alias awareness, no-new-permission guard, queue filter). `account-credentials.test.js` assertion updated.
- Code commit `4e5e5685832a158a81cd8a34e181335355fd65e9`. Backend CI run **42297056648** passed (exact SHA). Frontend / PostgreSQL CI path-filter-skipped (no frontend / SQL changes); parent commit all three green.

### Batch 2 — Spot order data consistency
- FINDING: in PostgreSQL matching mode the customer order history and admin order list read the same `financial_matching_orders` table, but projections diverged: admin rewrote canonical `cancelled` → `canceled` (customer saw raw DB value), admin omitted `client_order_id`, used `amount`/`time`/slashed-symbol vs customer `quantity`/`created_at`/unslashed-symbol, and customer lacked `type`.
- FIX: both projections now emit customer-canonical fields (`order_id`, `quantity`, `created_at`, `client_order_id`, `type: 'limit'`, unslashed symbol, raw DB status) while retaining legacy admin aliases (`id`, `amount`, `time`). No matching-engine / schema / trade-logic change.
- REGRESSION: `backend/tests/order-history-source-parity.test.js` extended (consistent status values, client_order_id in both, no silent canceled→canceled rewrite, symbol format, shared core fields).
- Code commit `e423b4afbe6827ef7bb05c0555b57614070471ee`. Backend CI run **42297955945** passed (exact SHA). Frontend / PostgreSQL path-filter-skipped.

### Batch 3 — Admin fund operations audit (code + test review only)
- FINDING: no critical gap. Manual deposit credit, withdrawal approve/reject/mark-paid, and account freeze/unfreeze all enforce cutover gating, actor identity, atomic RPCs, duplicate/idempotency protection, and write canonical `financial_audit_log` rows with actor, subject, amount, asset, reason, reference/operation id. Direct balance adjustment remains disabled pending a maker-checker queue. Minor: withdrawal approve carries a hardcoded reason (admin-supplied reason not accepted) — left as-is to avoid API contract change.
- REGRESSION: new `backend/tests/admin-fund-ops-audit.test.js` locks in audit fields, idempotency keys, atomic RPCs, state guard on freeze, and disabled direct-adjustment guard.
- Commit `88e39bf559be428394c26161d27fa27b8799453a`. Backend CI run **42298110345** passed (exact SHA).

### Batch 4 — Customer service & review operation idempotency
- FINDING: admin `POST /api/push` (broadcast / single-user in-app message) had no idempotency key — a double-click or retry after a lost response duplicated the message in every recipient's conversation. Support reply already had request_id idempotency; KYC/withdrawal review are state/RPC guarded.
- FIX: mandatory 16–100 char `request_id` on push, bounded persisted dedup set `recent_admin_push_requests` (capped 200), content-hash + target conflict detection (409 on reuse with different content), `duplicate:true` on exact retry, request_id stored on each delivered message and in the audit event.
- REGRESSION: new `backend/tests/admin-support-idempotency.test.js` (support reply idempotency, push idempotency, KYC/withdrawal review guards).
- Commit `e6c7d933358992b1874be425fbe7ec5c500c894a`. Backend CI triggered via workflow_dispatch (PRs #51/#52/#53 were found closed); see final handoff for run id.

### Batch 5 — Web App + Admin Panel integration
- VERIFIED: frontend `tsc --noEmit` passes; admin permission map covers all admin routes; every key admin API function exists in the client and uses the bearer-token `adminRequest` helper; admin panel uses `role="dialog"` / `aria-modal="true"` and no native `alert`/`confirm`/`prompt`; confirmed-success-then-refresh-failure keeps the success notice and tells operator to reload (KYC + withdrawal queue). No real feature deleted, no permission relaxed.
- REGRESSION: new `backend/tests/admin-api-contract.test.js`.
- Commit `dd98b5470f66952976e512bbb3e894e79fe87836`. Backend CI triggered via workflow_dispatch.

### Interruption / handoff note
- Final branch HEAD at documentation time: see the doc commit SHA. Working tree clean after each batch. All five batches are backend-only (api-core.js + tests); no frontend source, no SQL migration changed. The single failing local test (`build-site.js publishes...`) is a pre-existing environment issue requiring a frontend build artifact, unrelated to these changes.
- NEXT: if a future batch touches frontend or SQL, re-run frontend-ci and PostgreSQL schema CI on the exact commit (they were path-filter-skipped here). Reopen or open a fresh draft PR against `fix/post-merge-db-bootstrap-seconds-20261106` if CI is needed; PRs #51/#52/#53 were closed and unreopenable. KYC retention/deletion remains an owner-policy decision — do not invent a duration.


## 2026-11-07 — Phase 2: full-stack assembly batch 1 (support idempotency + audit-log SQL indexes)

- Branch HEAD at start: `83e2123` (matches remote). PR #54 was found closed; opened #55 then #56 (both draft) as PRs keep getting closed by another actor. No merge, no deploy, no production funds.
- **Customer support chat idempotency (end-to-end frontend + backend)**: `POST /api/support/chat` now accepts an optional `request_id` (16–100 chars). Exact retry returns `duplicate:true` with the original message id; reuse with different content returns 409 `SUPPORT_MESSAGE_IDEMPOTENCY_CONFLICT`; the persisted user message carries `request_id`. Frontend `SupportPage` generates a stable request id per send (`crypto.randomUUID`) and keeps it in `pendingRequestId` until the send succeeds, so a retry after a lost response cannot duplicate the message. `sendSupportMessage` signature extended backward-compatibly with optional `requestId`. `tsc --noEmit` and `vite build` pass.
- **SQL (PostgreSQL CI exercised)**: new migration `0032_admin_audit_log_filter_indexes_v1.sql` adds two non-destructive indexes on `public.financial_audit_log` — `(action, id desc)` and `(subject_user_id, id desc)` — matching the `GET /api/admin/audit-logs` query access paths (filtered by action or subject, ordered by id desc). Registered in `scripts/bootstrap-empty-database.sh` FILES list and `MIGRATION-ORDER-AND-CUTOVER.md` (required by the bootstrap test; initial omission caused one backend CI failure, fixed in follow-up commit).
- Regression tests: extended `admin-support-idempotency.test.js` (customer chat idempotency + frontend wiring), `admin-fund-ops-audit.test.js` (0032 indexes). Local backend: 395 tests, 394 pass (1 pre-existing build-site env issue).
- Commits: `5be1998` (support idempotency + SQL indexes), `4afe942` (bootstrap/migration-doc registration fix). PR #56 (draft) triggers all three CI suites on `4afe942`. Frontend CI run **42301789426** and PostgreSQL CI run **42301789026** already passed on `5be1998`; backend CI on `5be1998` failed only due to the missing bootstrap registration, fixed by `4afe942`.

## 2026-11-07 — Phase 2 batch 2: admin withdrawal 409 retry UX

- Withdrawal approve/reject retries that return 409 `WITHDRAWAL_ALREADY_PROCESSED`
  (first attempt succeeded but response was lost) are now surfaced in the Admin
  Panel as a confirmed notice + queue refresh via `isAlreadyProcessed` /
  `handleAlreadyProcessed`, instead of a red error. Applies to approve and reject
  (confirmReviewRejection) paths; mark-paid duplicate was already handled in the
  success path. Frontend `tsc --noEmit` + `vite build` pass. Regression test in
  `admin-api-contract.test.js`. Commit `b3f82d9`. Backend CI (workflow_dispatch)
  **42303540899** success; PR-triggered backend **42303573419** success; frontend
  CI **42303573493** (temp draft PR #57) verified. PostgreSQL CI path-skipped (no
  SQL change this batch).

## 2026-11-07 — Phase 2 batch 3: KYC already-reviewed 409 UX + Playwright smoke green

- KYC approve retry returning 409 `KYC_EXCEPTION_REQUIRED` (first attempt
  succeeded but response lost) is now surfaced in the Admin Panel as a confirmed
  notice + queue refresh via the generalized `isAlreadyProcessed` helper (now
  covers WITHDRAWAL_ALREADY_PROCESSED, KYC_EXCEPTION_REQUIRED, and status 409).
  Regression test in `admin-api-contract.test.js`. Commit `36bcc71`.
- Verified Earn subscribe/redeem and Seconds open/settle already use stable
  deterministic request ids retained across retries (idempotent); admin support
  reply likewise. No change needed.
- Playwright e2e smoke (`frontend/e2e/auth-routes.spec.ts`) runs **20/20 green**
  locally (desktop + mobile chromium), covering /login, /register, /admin,
  /assets, /orders, /kyc, /deposit, /withdraw, /seconds, /support, /settings,
  /earn, /trade/BTCUSDT, /me.
- CI: Backend workflow_dispatch + temp draft PR #58 on `36bcc71`; Frontend CI
  via PR #58. PostgreSQL path-skipped (no SQL change this batch).


## Frontend public-market preview batch — 2026-11-07

- Implemented public `/trade/:symbol` route access; private account/order endpoints remain authenticated by their API handlers.
- Anonymous account `AUTH_REQUIRED` no longer turns the spot preview into a page-wide error.
- Public market overview refresh now polls every 15 seconds with an in-flight guard; last confirmed ticker rows remain visible during provider errors with an explicit stale-feed warning.
- Added source-contract regression assertions in `backend/tests/spot-trading-live-refresh.test.js`.
- Commits: `06586c56e5286cec63ebab8f64b2a5a9224692e3`, `19b143136b28bbb7e565ab134a1732d0ae80043c`, `0ef183b58f7e83984ce08baad8dea63603f22271`, `7d4bd7d92a172364254ae75feb6a78e8f67c3b91`, `4be2b4b7462f89ce0f210ba6730e34b073f5683b`.
- TEST NOT YET RUN on these commits. Prior successful CI at `abe8bedc922e2d5cf2d1e6e2755ebb25c15d7117` is historical evidence only.
- NOT VERIFIED: browser end-to-end, frontend build/typecheck on this head, public preview on deployed hostname, and provider data freshness.
- Auth mismatch remains open: inspected `AuthPages.tsx` still contains email/password, username/password and wallet sign-in options despite the user's report that Google-only adjustment was made. Do not overwrite; locate the intended adjustment first.
- Detailed evidence and resume steps: `docs/FRONTEND-MARKET-PREVIEW-BATCH-2026-11-07.md`.

- Additional Admin Panel cross-check: the current `frontend/src/features/admin/AdminPage.tsx` includes the manual-credit workflow under user detail, required receipt/TxID reference, stable idempotency key, balance/history refresh and deposit read/review permission gates. Backend uses `admin_manual_deposit_atomic` and fails closed while financial writes are disabled; no production write testing was done. Existing manual-credit and deposit-reference tests cover these contracts.
- Vercel domain lookup confirms `btcboxcdt.vercel.app` belongs to the `btcboxcdt` project, but the project still reports `live:false` and latest deployment `ERROR`; deployment remains paused.

- Auth branch cross-check: `feat/btcbox-react-google-auth-20261105` removes username/password and wallet UI but still exposes Supabase email/password login, registration and reset. It does not meet the user's Google-only/no-email-auth requirement; do not port it.

- Google + wallet public auth UI batch: `AuthPages.tsx` now presents Google OAuth and a unified Connect wallet chooser (Ethereum/EVM + Solana), removes public email/password and BTCBOX username/password forms, retains optional backend-requested 2FA challenge and existing callback handling, and adds Phantom/Coinbase Wallet mobile links. Regression test asserts forbidden legacy controls are absent.
- Backend wallet identity validation accepts only Supabase-verified Ethereum or Solana claims with valid address formats. Supabase Web3 provider enablement itself is NOT VERIFIED; no live wallet auth was attempted.
- CI branch coverage fixed: unified branch added to backend/frontend push triggers; backend workflow now watches `AuthPages.tsx`. Build/test-only CI runs `42309363348` (backend) and `42309363409` (frontend) were running on `aa42ea2a7e4e798687fb9b208b5a36bdde2da389`; record final conclusions after completion.
- Detailed changes, commits and resume point: `docs/FRONTEND-MARKET-PREVIEW-BATCH-2026-11-07.md`.

- CI follow-up: backend run `42309363348` exposed a stale spot-route assertion; updated `backend/tests/spot-trading-api.test.js` to assert the approved public preview route. Backend run `42309521968` on `1a1e93a78bfd2f5ef5d931796fabf5f11fc8428d` passed build, tests, fail-closed preflight and output checks. Frontend run `42309363409` passed install/lint/build/Chromium setup; Playwright desktop/mobile route smoke tests were still running at last check.

- Frontend browser verification: after updating stale E2E assertions that expected email/username auth and a protected spot route, run `42309855968` passed all desktop/mobile route smoke tests. Added explicit Google-enabled runtime button coverage; latest run `42310007202` on `4f4b64917b1c1d0cea5575a71222fdbe7dd87313` passed install, lint, build, Chromium setup and all desktop/mobile Playwright tests.

- Follow-up: market API now emits per-symbol server snapshot time after provider fetch completion; frontend propagates it as `snapshotTs` and labels it “Snapshot checked” (not exchange event time). Auth page entry points now expose Google only; wallet controls/deep links removed. Existing 2FA verification remains.
- CI evidence: backend run `42310573294` at intermediate test commit `c966aa0` failed 1/400 because an older assertion expected “Last update”; that assertion has been updated. Latest exact-head CI must be checked before declaring tests passed.
- Details: `docs/FRONTEND-MARKET-PREVIEW-BATCH-2026-11-07.md`.

- CI: Backend run `42310916938` at `7d5ed8f` passed unified build, 401/401 tests, fail-closed preflight, and output/entrypoint checks. Frontend run `42310911601` at `0394a88` passed install, lint, and build; browser smoke test was still running at last check. See `docs/FRONTEND-MARKET-PREVIEW-BATCH-2026-11-07.md`.

- Deployment cross-check: latest Vercel production deploy `dpl_2cAQrbFQbTouccNyccnYZfY7P89e` on main `361be5c` confirms `npm install` and frontend build now succeed, but Vercel's `npm test` reports 350/356 pass and 6 failures. GitHub backend/frontend/PostgreSQL CI for that same main SHA report success; investigate environment/test discrepancy without deploying the unified branch. Detailed record is in `docs/FRONTEND-MARKET-PREVIEW-BATCH-2026-11-07.md`.


- Current-state correction (2026-11-07): current unified-branch `AuthPages.tsx` is Google-only (email/password, username/password and wallet entry points are absent); earlier notes describing those controls are historical and superseded. The latest app-source commit is `84603e7150db06c6861e4667fb7a4c55f70f4f2d`, current branch HEAD at inspection is docs-only `b49b021ba1f4a22fc6896a9124409137e864e6d9`. Frontend CI `42311253408` on `84603e7` had install/lint/build green while Chromium setup and Playwright were still pending. Backend CI `42310916938` on `7d5ed8f` passed 401/401 backend tests and fail-closed preflight; no backend source changes followed that tested source commit.
- Market timestamps: `snapshotTs` is server response snapshot time; `providerTs` is only supplied when the provider returns a normalized event time (Bybit fallback). Coinbase stats lack an exchange event timestamp, so do not represent server snapshot time as provider event time.
- Admin manual credit re-audit passed source-contract checks for receipt reference, bounded decimal, stable idempotency request, permission gating, atomic audited RPC, and canonical history refresh. No production financial write was performed.

## Authentication contract correction — 2026-11-07 (supersedes prior Google-only wording)

The owner explicitly confirmed the required BTCBOX sign-in methods:
- BTCBOX username + password login.
- Google OAuth login.
- Wallet login (Web3; currently implemented through Supabase Web3 identity for Ethereum and Solana).
- No email registration, email/password login, or email OTP/recovery.

Account creation is initiated through Google or wallet identity verification. A new identity without BTCBOX credentials is routed to Account Setup to choose a unique BTCBOX username and password; this does not create an email registration flow. Existing username/password accounts use the BTCBOX /api/login endpoint.

Source observations:
- frontend/src/lib/auth.tsx already had username login, Google OAuth, and Supabase Web3 sign-in functions; email sign-in/sign-up and email password-recovery functions have now been removed from the React auth provider.
- frontend/src/features/auth/AuthPages.tsx now exposes username/password on login, Google OAuth, Ethereum wallet and Solana wallet entry points; registration exposes Google and wallet identity creation, then routes users who need credentials to Account Setup.
- backend/api-core.js already implements BTCBOX username/password login using PBKDF2-HMAC-SHA256 (600,000 iterations), constant-time comparison, IP/username rate limits, frozen-account rejection, session issuance and optional 2FA.
- The Supabase session exchange verifies the identity with /auth/v1/user, accepts only a single Google or Web3 provider, validates wallet chain/address, and rejects duplicate wallet ownership. Email identities are now rejected by the server-side provider allowlist.
- backend/api/register remains disabled; this is intentional. Usernames/passwords are set after Google or wallet identity verification, not by email registration.
- Regression coverage was updated in frontend/e2e/auth-routes.spec.ts, backend/tests/account-credentials.test.js, and backend/tests/google-only-auth.test.js.

Verification status:
- SOURCE OBSERVED: all three requested authentication paths have front-end and/or backend implementation paths in source after this batch.
- NOT VERIFIED: successful real Google OAuth, live Ethereum/Solana wallet signatures, new-user provisioning, username collision behavior against a live isolated database, and production auth-provider settings. Do not claim these runtime flows are end-to-end verified.
- CI for the new branch head must be checked after these commits. The previously green frontend CI run tested the obsolete Google-only UI and is not evidence for this change.
- No production database, auth settings, merge, or deployment was changed.
## Authentication batch verification update — 2026-11-07

- Frontend CI run 42314537379 passed on source SHA 80731237b1f58d5097563521a9524e1f0d060c8c: npm install, lint, build, Chromium install, and desktop/mobile Playwright route smoke tests all completed successfully.
- Backend CI run 42314790953 passed on source SHA 62250b00bae0d7eac20bede9adf98e69c4137e85: backend build and all 402 tests passed; deployment preflight completed successfully.
- An earlier backend run failed because stale Google-only assertions remained in google-only-auth.test.js, google-only-identity.test.js, and spot-trading-live-refresh.test.js. Those assertions were corrected to the owner-approved username/Google/Web3 contract; the latest backend run above is green.
- The latest code commit at the time of this note is 62250b00bae0d7eac20bede9adf98e69c4137e85. Documentation updates may advance the branch head without changing the tested application source.
- SOURCE OBSERVED + TEST PASSED: username login UI and endpoint contracts, Google UI flow, Ethereum/Solana wallet entry points, email-provider rejection, frontend build/lint/browser route smoke tests, and backend 402-test suite.
- NOT VERIFIED: live Supabase Google provider configuration, real wallet signature challenge on mobile/desktop wallets, fresh account creation against isolated Supabase, and full account setup with a newly provisioned wallet identity.
- Production deployment remains paused. No production database/auth settings were changed.
## Current source reconciliation — 2026-11-07 (supersedes earlier Google-only status)

Re-read the current unified-branch source at the start of this batch. The current authentication UI and provider expose all three owner-approved methods: BTCBOX username/password, Google OAuth, and Ethereum/Solana Web3 wallet sign-in. Email sign-in, email registration, and email password-reset methods are not exposed by the React auth provider. The prior Google-only statements above are historical and superseded.

Market timestamp semantic clarification:
- `snapshotTs` is generated by the BTCBOX server after provider responses complete.
- `providerTs` is provider-supplied but is not one universal kind of exchange event timestamp: Coinbase `ticker.time` is the last-trade timestamp; Bybit top-level `payload.time` is the provider response timestamp.
- Frontend type comments and regression coverage now explicitly preserve this distinction. Do not label every `providerTs` value as an exchange trade/event timestamp.
- This source-level contract does not establish that live provider data is always fresh. Runtime freshness, upstream outages, and live production market display remain unverified.

Admin review re-audit:
- Withdrawal approval changes review state only; staff must separately transfer funds and then record the TxID/reference using the manual payout completion action.
- Withdrawal rejection requires a reason and uses the atomic database review RPC; the database transaction records the refund and audit together.
- Manual payout completion requires a bounded TxID/reference and is status/audit confirmation only; it does not broadcast or debit funds again.
- Frontend preserves confirmed action state if the subsequent queue refresh fails and handles already-processed retries without repeating the financial action.
- KYC rejection requires a reason; direct approval checks in-review state and requires a stored document unless the explicit exception path supplies a reason.
- These are source/test-contract observations. No live admin session or production financial operation was executed.
## Follow-up batch — 2026-11-07: market semantics and Admin KYC conflict handling

Market timestamp contract:
- `frontend/src/lib/api.ts` now documents `providerTs` accurately: Coinbase supplies a last-trade timestamp; Bybit supplies a provider response timestamp. `snapshotTs` remains the BTCBOX server snapshot timestamp.
- `backend/tests/spot-market-catalog.test.js` now asserts the provider-specific timestamp sources and the separate server snapshot timestamp.
- Backend CI run `42315401002` passed 403/403 tests on source commit `936d5baf435aa2ca25f1e95117f6cc2c62941f41`; frontend CI run `42315396247` passed install, lint, build, Chromium install, and desktop/mobile route smoke tests on source commit `8d86ceceb62a32e5feabdebc56523ec320e73b73`.

Admin KYC conflict handling:
- Found a false-positive classification: the Admin Panel treated every HTTP 409 and `KYC_EXCEPTION_REQUIRED` as evidence that a KYC action had already succeeded. That could mask actionable server responses such as missing identity documents or a requirement for exception approval.
- `frontend/src/features/admin/AdminPage.tsx` now classifies only the explicit `WITHDRAWAL_ALREADY_PROCESSED` code as a confirmed withdrawal retry. KYC 409 responses remain actionable errors and are shown to the operator; dead KYC duplicate-success handling was removed.
- `backend/tests/admin-api-contract.test.js` now guards against treating generic 409 or KYC exception-required responses as confirmed success.
- Backend CI run `42315626395` passed 403/403 tests and deployment preflight on source commit `51c302a96f069876e438321d3597501fcbc26b54`.
- Frontend CI run `42315614500` completed SUCCESS on source commit `06ddef81192a72b5717125f59b069ac1a478dca6`: npm install, lint, build, Chromium installation, and all 24 desktop/mobile Playwright route smoke tests passed (12 desktop + 12 mobile).

Current branch HEAD at note creation: `51c302a96f069876e438321d3597501fcbc26b54`. No merge, deployment, production database change, or live financial operation was performed.

## Latest continuation record — 2026-11-07 (Admin KYC evidence gate)

- Current batch commits on `work/btcbox-unified-20261104`: `7fe5a5ea214b3633107a9276cd604554e6df4ae7` (disable KYC approval without an uploaded document and working signed preview); `8b452412ed5e6a3f560bfd01426ec117da4a773a` (regression test); `f7f02459e2985b90fcc0eefe564f822ba43bc007` (handoff evidence).
- The KYC exception override remains backend-only. Do not expose it as a normal approval action: it can bypass the normal document gate and requires an explicit reason/audit trail. Escalate any decision to broaden that policy to the owner.
- Next: run backend KYC/admin tests and frontend lint/build/desktop-mobile route smoke tests against the resulting branch head; then continue withdrawal audit/idempotency and market provider freshness review.
- No merge, deployment, production database change, or live financial action was performed.


## Verification status for KYC evidence-gate commits — 2026-11-07

- The GitHub commit-status API reports only the Vercel context for commits `7fe5a5e`, `8b45241`, and `7817fc2`; that context is FAILURE with Vercel's `upgradeToPro=build-rate-limit` URL. This is an account/build-quota block, not a test assertion result.
- No backend test or frontend CI result has yet been produced for the KYC evidence-gate source commit. Do not label this batch TEST PASSED until those suites run on the exact source SHA.
- Prior successful backend/frontend runs listed in the earlier ledger belong to earlier commits and do not verify these new changes.
- Release remains blocked: no merge or deployment.


## Continuation checkpoint — withdrawal rejection reason hardening (2026-11-07)

- Branch: `work/btcbox-unified-20261104`.
- Commits: `d2e13fe` (API requires actual rejection reason), `ee7e1e6` (API contract regression test), `cd2ab80` (correct control-character matcher), `de97dad` (handoff note).
- Review finding: front-end already enforced a reason, but backend silently substituted a generic reason for direct API requests. This is now fail-closed at the API boundary: blank reason => 400 `WITHDRAWAL_REJECTION_REASON_REQUIRED`; over 200 chars/control characters => 400 `WITHDRAWAL_REJECTION_REASON_INVALID`.
- The valid reason is forwarded to the existing atomic SQL RPC; no ledger, refund, state-transition, permission, or production behavior was otherwise changed.
- Backend CI workflow is configured to run on pushes to this branch for backend changes. Await an actual successful run before marking TEST PASSED. No local test execution was performed through this GitHub API-only workflow.
- Next: inspect withdrawal RPC behavior under terminal-state retries and audit visibility; then investigate market provider fallback/freshness. Keep merge/deployment/production DB and live funds operations paused.


## Continuation checkpoint — withdrawal audit + market freshness (2026-11-07)

- Withdrawal API: backend now rejects a blank rejection reason and rejects overlong/control-character reasons before calling the existing atomic refund/review RPC. Frontend already enforced a reason; this closes the direct-API gap. Commits: `d2e13fe`, `ee7e1e6`, `cd2ab80`.
- Market API: Bybit fallback rows now require a provider response timestamp within 60 seconds old / 15 seconds future. Coinbase's last-trade timestamp is intentionally not subjected to this response-age test. Commits: `b19331f`, `a09834e`.
- Tests added in `backend/tests/admin-api-contract.test.js` and `backend/tests/spot-market-catalog.test.js`. Source diffs and test assertions have been reviewed, but no exact-commit test pass has been observed; do not mark TEST PASSED.
- Vercel status remains build-rate-limit failure; this does not prove backend test failure. GitHub Actions workflow-run lookup returned no PR-triggered runs for the test commit. Push workflow execution result remains unverified.
- No production provider setting, financial database, live account, merge, or deployment was touched.
- Next: inspect admin audit visibility and the market response cache/provider behavior; obtain backend CI on exact source commits when Actions reports a result.

## 2026-11-07 continuation — manual payout audit cross-check

- Reviewed `0027_withdrawal_manual_payout_completion_v1.sql`, `withdraw/mark-paid` API handler, and existing manual payout tests.
- Confirmed source-level invariants: only approved withdrawals can be marked completed; a non-empty payout reference is required; exact retries do not append a second audit row; conflicting references fail; completion is status/audit-only and does not broadcast or debit again.
- Added regression assertions for verified admin actor, withdrawal subject, payout reference, paid_by/paid_at and duplicate-audit prevention. Commit: `8e41700b213bc30aba86b3e31bd441db9676ea7a`.
- Tests remain NOT VERIFIED on the new commit; do not infer pass from static source review. No production DB or deployment action.
- Continue directly with public market cache and spot trade preview parity review.

## 2026-11-07 continuation — public market freshness

- Verified the spot trade UI polls market/depth every 15 seconds, browser fetches bypass local cache, and backend market requests fetch upstream ticker data rather than serving the declared but unused in-memory price cache.
- Reduced the market endpoint's shared cache from max-age=2 / s-maxage=5 / stale-while-revalidate=3 to max-age=0 / s-maxage=2 / stale-while-revalidate=1. A small shared cache remains to limit provider load; no stale upstream fallback was introduced.
- Added a source-contract regression test. Commits: `e2898dddb7b3a556a3e59ad531b9b72f8c700dda`, `1ff6d48da611f6a1679179d931a4832a3ab936b6`.
- Live provider and deployed behavior remain NOT VERIFIED; no production deploy.

## 2026-11-07 continuation — spot market consistency

- Trade UI now identifies ticker, order-book and chart providers separately, so Coinbase/Bybit source divergence is visible rather than hidden by one combined label.
- Depth response/client validates positive numeric price and size, sorts sides correctly, caps 20 levels, rejects malformed empty sides and includes server snapshot/provider timestamps.
- K-line client retains source, validates OHLC relationships and surfaces failed refreshes while retaining the last confirmed chart.
- Regression assertions added to `backend/tests/spot-market-catalog.test.js`; tests and browser build are NOT VERIFIED in this environment.
- Commits: `ae544a241fc0d8fcd93f94b55bafe998788cb045`, `f9c20505a739864dc85881b0fc64232ade8d2bd4`, `9d280a5774560ffcd4579ff4da3e32794fc6423d`, `36d71cc080ff72582a92ac7d0fac668001a21c29`, `17114ab149f1b9c897b8d657d2f8d51c769d39a5`, `3081a36532d481cb83ddae409c1366047d6f2ca3`, `08fabb8c8566f4527160d184c014443acc2a477c`, `38a4f8f3b1f52f72d026c6b976917aa5dd01a89a`.
- No production deploy or real order activity. Continue with CI status and responsive/auth route checks.

## 2026-11-07 continuation — mobile spot preview

- Added an isolated Playwright case at 320px width for the public spot preview. It stubs market, candles, depth and trading status, checks separate ticker/order-book/chart providers and verifies document width does not exceed viewport width.
- Commit `27782f4bd589ee84d133c3862e32bf63568c874d`; source-contract assertion correction `a4404e287e9fcdaa4b88a9522a817d36a9cfb95d`.
- Browser test not executed here; do not mark pass. Vercel check remains rate-limited and no Actions run for the current commits has yet been confirmed.
- Continue with route/auth and mobile regression review; no production deployment.

## 2026-11-07 CI results

- Backend CI `42318730474` at `1b472aff19232f02295079a86f76096881ceeb46`: SUCCESS — unified build, backend tests, deployment-config preflight and preserved entrypoints all passed.
- Frontend CI `42318554054` at `27782f4bd589ee84d133c3862e32bf63568c874d`: SUCCESS — lint, build, Chromium and desktop/mobile route smoke tests passed, including the new 320px spot preview test.
- The earlier backend red run was caused by an incorrect test slice boundary and is fixed; the earlier frontend red run was caused by missing KlineResponse source typing and is fixed.
- Vercel deployment check still reports rate limit only; production deployment remains paused. No real funds, live orders or production DB were touched.

## 2026-11-07 continuation — authentication route coverage

- SOURCE OBSERVED: BTCBOX username/password are stored as salted PBKDF2-SHA256 hashes (600,000 iterations), not plaintext; verification uses crypto.timingSafeEqual. Username login applies persistent IP and normalized-username lockouts and returns a generic invalid-credentials message.
- SOURCE OBSERVED: first-time credential setup attaches username/password to the currently authenticated BTCBOX user; it does not create a second account. Setup requires a session created within five minutes. Duplicate usernames are rejected before persistence.
- SOURCE OBSERVED: Google OAuth uses Supabase PKCE and a dedicated callback; backend identity exchange verifies the Supabase user. Wallet login uses Supabase Web3 sign-in and requires an access-token session before exchanging it with BTCBOX. UI supports EIP-6963 Ethereum providers and injected Solana providers.
- SOURCE OBSERVED: credential recovery requires a fresh, linked Google or wallet identity, short-lived server-side proof, and configured TOTP where enabled. Password reset revokes other BTCBOX sessions and outstanding login challenges.
- Added Playwright contract coverage for username/password login submission + safe rejection, and first-time username/password setup on the same existing account. Commit: 2598d7ef901e7bea36036d6381e3d2126838c525.
- NOT VERIFIED: live Supabase Google provider configuration, wallet provider availability on real devices, Google OAuth redirect allowlist, and end-to-end login against the hosted backend. Browser CI for the new tests is pending.
- No email registration or email/password auth added. No production DB, real funds, order execution, merge or deployment touched.

## 2026-11-07 continuation — authentication regression verification

- Username/password login browser test passed: verifies the exact BTCBOX username endpoint payload and visible generic invalid-credentials feedback.
- First-time credential setup browser test passed on desktop and mobile after the fixture was corrected to satisfy the account snapshot contract and reflect persisted credentials on the subsequent account reload.
- OAuth cancellation callback browser test passed: displays a clear cancellation message and a return-to-login path without issuing a BTCBOX session.
- Frontend CI run 42321032193 at 00581b5ab1bc10697ce01f447b91d21d17f0372e: SUCCESS — lint, build, Chromium install and desktop/mobile route smoke tests passed.
- Backend wallet-identity regression verifies EVM lowercase normalization, valid Solana base58 address acceptance, malformed addresses and unsupported chains. Backend CI run 42321114844 at 863576598db9414669798ff917f389ccb8eb8892: SUCCESS — 411 backend tests and unified build/preflight passed.
- Earlier test-only failures were diagnosed from Actions logs and corrected: missing account fixture field; fixture not reflecting saved credentials; and cross-VM object assertion semantics. No production authentication behavior was weakened.
- Remaining NOT VERIFIED: live Supabase Google provider/redirect configuration and real injected wallet sign-in on physical devices. No production deployment, DB mutation, merge, or real financial operation.

## 2026-11-07 continuation — mobile spot workstation

- Mobile spot layout now keeps the market price summary first and the limit-order form immediately after it; chart and order-book panels are not allowed to push the primary buy/sell form below long chart content.
- At mobile widths, chart and order book are opened as bottom-anchored drawers (max-height 72dvh), with safe-area bottom padding and explicit Close controls. Desktop retains the side-by-side chart/order-book workstation layout.
- Chart creation waits until its container has a non-zero width; opening the mobile chart drawer re-runs chart setup and ResizeObserver keeps it responsive.
- 320px Playwright coverage verifies price and limit order priority, chart/depth hidden by default, chart canvas rendering when opened, both drawer open/close interactions, distinct provider provenance, and no horizontal overflow.
- Frontend CI run 42321826347 at bb6183557b9048734382c3f4cac75d8fbc8b5a7c: SUCCESS — lint, build and desktop/mobile Playwright route smoke all passed (32 tests).
- No trade execution, matching, settlement, account balance or financial backend behavior changed. No production deploy.

## 2026-11-07 continuation — wallet provider failure behavior

- Added isolated Playwright coverage for unavailable EVM and Solana injected wallet providers. Both paths must surface a visible authentication error and must not call BTCBOX Supabase-session exchange endpoints without a wallet-backed Supabase session.
- Frontend CI run 42322062375 at 24017400371e46cb200fbe37867c5190ee5f1080: SUCCESS — lint, build and 34 desktop/mobile route tests passed.
- Real wallet signing and Supabase provider enablement remain unverified on physical devices; this test covers the no-provider failure path only.

## 2026-11-07 continuation — Admin semi-manual review queues

- Cross-checked the existing Admin Panel workflow before extending it: deposit receipt verification and manual ledger credit remain under Users; withdrawal approval is separate from staff's actual manual transfer and requires a TxID/reference to mark paid; KYC approval is disabled unless the document upload and secure preview URL are both present; rejection requires an operator reason.
- Added explicit Refresh queue controls to Withdrawals and KYC so staff can fetch newly submitted items without leaving the tab or reloading the whole Admin Panel.
- Refresh state is isolated from action busy state. A manual refresh failure reports only a refresh error and cannot falsely claim a financial/admin action was confirmed. Post-action refresh retains the distinct "action confirmed, queue refresh failed" messaging.
- Frontend CI run 42322366989 at 3e15087f7952f05d3022f61be3f62ee14af1f8bc: SUCCESS (lint/build/desktop-mobile route suite).
- Follow-up corrected the manual withdrawal refresh failure message so it cannot reuse the post-action confirmation wording. Frontend CI run 42322432342 at c7366273d51526bca32135766908ba1160d8fcf7: SUCCESS (lint/build/desktop-mobile route suite).
- No changes to deposit ledger writes, withdrawal execution/settlement, KYC backend decisions, production DB or deployment.

## 2026-11-07 continuation — Admin browser QA

- Continued single-owner repository execution as required by this document; no external AI handoff or parallel workstream.
- Added two isolated Playwright Admin cases: withdrawal queue refresh failure must remain read-only and must not imply a confirmed financial action; KYC approval remains disabled without an uploaded document and secure preview URL.
- Tests use a synthetic Supabase browser session and intercepted API fixtures only; no real identity, production API, financial write, database or deployment is used.
- New test commit: `d42c2fdbc5de26be937ead020e147abdd0930432`. Push CI run `42328415525` completed SUCCESS: lint, build and all 38 desktop/mobile Playwright tests passed (19 desktop + 19 mobile), including both new Admin cases. Backend PR run `42328419228` completed SUCCESS with 411/411 tests, build, preflight and output checks; frontend PR run `42328419231` completed SUCCESS with lint, build and browser tests.

## 2026-11-07 continuation — trading mode chooser and Admin QA

- Reorganized Trade Hub so the four requested modes are visible first: Spot, Seconds, Earn, and Futures. Futures remains explicitly unavailable because no supported futures service is registered; no simulated contract entry was added.
- Moved the backend-returned spot pair list below the mode cards so a long pair list cannot push Seconds/Earn/Futures below the fold. Spot catalogue errors and empty states remain explicit; no pairs are fabricated.
- Added an Earn entry to the mode chooser and translated its copy for all seven supported frontend locales. The Earn page remains account-gated; subscribe/redeem stay disabled unless backend financial controls report enabled.
- Playwright now verifies all mode cards, an actual mocked backend-enabled spot pair, unsupported Futures state, and the Earn route's authentication gate.
- Admin Playwright checks remain isolated to mocked identities/API responses and verify withdrawal refresh failures do not imply financial success or issue mutation requests, and KYC approval stays disabled without document evidence.
- Exact code/test head: `8967f936520470cd0a624efc718012dc615e26e2`. Push CI `42329063335`: SUCCESS — lint, build and 40 desktop/mobile tests (20 desktop + 20 mobile). Backend PR CI `42329067130`: SUCCESS — unified build, 411/411 backend tests, fail-closed preflight and output checks. Frontend PR CI `42329067115`: SUCCESS — lint, build and 40 desktop/mobile tests.
- No real funds, live orders, production database writes, merge or deployment performed.


## Visual direction update — 2026-11-07

- User explicitly superseded the earlier proposal to force a near-monochrome black/white/green BTCBOX palette. Follow the original mature UI foundation palette and component language instead; do not flatten the design into a single dark slab.
- The approved baseline is the existing mature UI foundation source palette: deep navy surfaces, restrained blue interaction/accent states, readable cool-neutral text, and distinct profit/loss semantics. Preserve the original spacing, hierarchy, typography and responsive behavior unless an evidence-based defect requires adjustment.
- Brand treatment should be integrated rather than pasted: use a reusable inline-vector BTCBOX mark and wordmark; maintain consistent sizing/alignment across desktop sidebar and mobile header. Do not substitute a bitmap logo as the only branding treatment.
- This is approval for visual/brand implementation only. It does not authorize changes to trading, settlement, account, authentication, financial rules, production data, merge, or deployment.


## Priority update — registration and public preview first (2026-11-07)

- User directed that the registration page and public preview page take priority ahead of the remaining page-wide visual polish.
- Registration remains Google + supported wallet identity creation (Ethereum/Solana), followed by BTCBOX username/password setup after identity verification. Do not add email registration.
- The signed-out public preview is the customer `/home` market landing page. It must remain accessible without login, display only provider-backed market data, and provide clear register/sign-in/trading discovery paths.
- Use the original mature UI palette and component language; keep responsive desktop/mobile layouts. No auth provider, market API contract, trading, account or financial behavior changes are authorized by this visual task.


## Registration / public preview CI evidence — 2026-11-07

- Tested source commit: `2e5c0401812d39be1bec055718d66b63f96c2734`.
- Frontend CI run `42331547336`: SUCCESS — install, lint, build and 44 desktop/mobile Playwright tests passed.
- Backend CI run `42331547350`: SUCCESS — unified build, 411/411 backend tests, fail-closed deployment preflight and preserved entrypoint checks passed.
- Automated coverage includes 320px registration and signed-out public preview routes; this is not a substitute for manual visual review on physical devices.


## 2026-11-07 active unified-branch continuation

- Active branch confirmed from PR #59: `work/btcbox-unified-20261104`; PR #59 remains OPEN / DRAFT / NOT MERGED, base `fix/post-merge-db-bootstrap-seconds-20261106`.
- Current assignment is 2号 AI (Web App + Admin Panel). The 2026-11-05 branch inventory and historical baseline above are retained as historical evidence, not current branch state.
- Registration and signed-out public preview are the immediate UI priorities. The current implementation uses Google + Ethereum/Solana wallet identity creation, then BTCBOX username/password setup; username/password remains available for login. Email registration/login is not added.
- Preserve the mature deep-navy/blue visual foundation selected by the user; do not force the previously proposed monochrome black/green palette. Use the reusable vector `BrandLogo` component rather than a raster logo pasted into the page.
- No merge, deployment, production DB/auth configuration, financial write or real order action without explicit owner approval.


## 2026-11-07 auth shell / mobile preview continuation

- 2号 AI continued the registration and signed-out public preview work on `work/btcbox-unified-20261104` / Draft PR #59.
- Confirmed the customer routes previously mounted login, registration, account setup and OAuth callback inside the full `AppLayout`, which injected the global topbar and mobile bottom navigation into the dedicated auth screens. The auth screens already supplied their own brand/market links, causing duplicated chrome and reducing available mobile viewport height.
- Auth-flow routes are now rendered without the trading app shell; public customer routes retain the normal sidebar/topbar/bottom navigation. Auth and account-setup viewport heights now use the full standalone viewport.
- The signed-out home preview's hero logo is hidden at mobile widths where the topbar already provides the BTCBOX brand mark; it remains visible when the topbar brand mark is not shown.
- E2E assertions now verify no global banner/navigation on login and registration, and verify the mobile preview keeps its topbar navigation while avoiding a duplicated hero brand mark.
- No authentication methods, provider contracts, market API contracts, order/financial logic, production settings, merge or deployment were changed.


## 2026-11-07 auth-shell / preview verification result

- Final tested source/test SHA: `4e0695afae911c670214703a819de2618036aaeb`.
- Frontend CI run `42333471864`: SUCCESS — npm install, lint, build and `44/44` desktop/mobile Playwright tests passed.
- Backend CI run `42333471866`: SUCCESS — unified build, `411/411` backend tests, fail-closed deployment preflight and preserved output checks passed.
- The first test run caught an assertion that incorrectly required a responsive topbar logo link to be visible in both project viewport configurations. The app code was not at fault; removed that breakpoint-sensitive assertion while retaining checks for the header, mobile navigation and hidden duplicate hero mark. The rerun passed all 44 tests.
- The auth-route assertions passed in desktop and mobile projects: no global banner or primary navigation is rendered on login/registration. Public preview assertions passed with the normal app header/navigation and no horizontal overflow or signed-out financial mutations.
- Latest PR #59 remains OPEN / DRAFT / NOT MERGED. No production deployment, DB/auth configuration change, or financial action was performed.
- Manual screenshot-based visual acceptance is still pending; CI browser tests are not claimed as physical-device visual approval.


## Public market snapshot visibility — 2026-11-07

- 2号 AI reviewed the public `/home` market preview and its `getMarkets` response mapping. Each ticker already carries `snapshotTs` from the backend server snapshot timestamp, distinct from the provider timestamp.
- FIXED: the public market table now displays the latest confirmed server snapshot time, or explicitly states that snapshot time is unavailable. This makes retained last-confirmed rows easier to assess when the refresh warning is shown and avoids implying that provider event time and server snapshot time are interchangeable.
- TEST ADDED: public-preview Playwright coverage now asserts that the server snapshot indicator is visible when the API fixture includes a server timestamp.
- Commits: `23b5fb8b10ce176c449e5803dc914fc3d65b8751` (UI); `a421c57382435d0f49f278a53b9d5a32a2b0a5b2` (browser regression).
- NOT VERIFIED: exact-commit CI, real upstream timestamp freshness, deployed UI, and screenshot-based visual review. No auth/backend contract, database, financial action, merge or deployment changed.


## Admin review queue reload safety — 2026-11-07

- 2号 AI cross-reviewed the existing semi-manual Admin Panel withdrawal and KYC queues. Manual refresh failures already retain the last confirmed rows with an explicit error; this is intentional for an operator-initiated refresh and is covered by existing read-only failure tests.
- FOUND: when navigating away from a review tab and returning, the tab loader previously retained the prior queue state if the new initial GET failed. That could redisplay stale withdrawal/KYC rows after a failed tab reload.
- FIXED: clear the respective withdrawal/KYC row state before a tab-level queue fetch. If that fetch fails, the prior review actions are no longer available from stale rows. Manual refresh behavior remains unchanged and continues to retain last-confirmed rows with a visible error.
- TEST ADDED: Admin E2E loads a withdrawal row, switches to KYC, then simulates a 503 when returning to Withdrawals; it asserts the stale row and Approve action are absent and the queue error is visible.
- Commits: d23218081fbbd9d993ef3280f4933ab1cc349d65 (Admin queue state); 8a834cc1b5734b5a0259b54457e3d92ce7649815 (E2E regression).
- Verification pending: frontend CI for latest code/test SHA. No finance API semantics, manual payout workflow, backend, production DB, merge or deployment changed.


## Admin audit snapshot reload safety — 2026-11-07

- SOURCE OBSERVED: entering the Audit tab fetched a new snapshot but retained the previous audit rows and source/completeness labels until success. A failed re-entry could therefore leave stale audit events and stale "PostgreSQL canonical" confidence visible.
- FIXED: clear prior audit rows and reset source/completeness to unknown before requesting a new tab snapshot; show an explicit empty-snapshot row when a successful response contains no events.
- REGRESSION: Playwright now loads a canonical audit fixture, navigates away, forces the next audit read to fail, and asserts that the old event and canonical source label are absent.
- Scope: frontend presentation/state only. No audit schema, API contract, financial behavior, database, or production configuration changed.
- Manual-credit review: source inspection confirms the current UI persists an actor/target/asset-scoped idempotency request before submission and reuses it after network/5xx/409 uncertainty. Do not generate a replacement request ID for an unconfirmed credit; verify the user's ledger before resolving ambiguous outcomes.


## Admin manual payout retry recovery — 2026-11-07

- REVIEWED backend contract/test: exact manual payout retries with the same reference are idempotent; a conflicting reference for an already completed withdrawal is rejected. The operation records payout status/audit metadata and does not apply another ledger debit.
- FINDING: the Admin UI did not persist the payout TxID/reference before POST. If the response was lost and the administrator refreshed the page, the approved withdrawal could return with a blank input, inviting entry of a different reference.
- FIXED: persist only the non-secret TxID/reference in actor + withdrawal-scoped localStorage before sending; restore it on the next Admin session; remove it only after a confirmed API response. If persistence is unavailable, do not send the payout mutation. If the response is ambiguous, retain the same reference and tell the operator to verify chain/history before retrying.
- FIXED: duplicate-reference success notice is no longer overwritten by the generic queue-refresh notice.
- E2E: simulate a 503 after the first payout request, reload the page, assert the exact reference is restored, retry, return an idempotent duplicate success, and assert the completed status.
- Scope: Admin frontend recovery and test only. No payout RPC, financial API contract, DB, ledger or production setting changed.


- Additional identity isolation: restored payout drafts replace in-memory drafts when the authenticated administrator changes, preventing one operator's unsent reference from appearing in another operator's session.
- Latest UI safety follow-up: `8d75ce111e06ca8a7f7fca64bb4e755c1e1724b6`.


- CI cross-check caught two existing frontend-source assertions in Core-owned contract tests that expected the prior payout notice call shape. Preserved their intended refresh-after-success contract while keeping the duplicate-reference notice visible after refresh; no backend test/schema or API contract change required.
- Follow-up commit: `be2b47513b18f961e96a5d97c2b99b6aec10b3c9`. Backend CI rerun required.


## Admin user-detail selection isolation — 2026-11-07

- 2号 AI cross-reviewed the Admin Users / manual-credit panel against the per-user deposit history and ledger-source labels.
- FOUND: selecting a second user left the previously selected user's detail panel mounted while the next `admin/user` GET was pending. If that read failed, the old user's balances, deposit history and manual-credit form remained visible even though the operator had attempted to open another user.
- FIXED: clear the selected user before issuing the next detail request. A failed read now leaves the explicit “Select a user…” state and no prior user's balance/deposit evidence or manual-credit controls.
- REGRESSION: Playwright loads one user's ledger-backed balance and deposit history, then simulates a 503 for the next user's detail request; it asserts the previous deposit ID and balance row disappear and the read error is visible.
- Scope: frontend selection state and E2E only. No deposit API, ledger, database, idempotency key, credit behavior, or production configuration changed.
- Verification: exact-head CI pending; no merge, deployment, production DB write, or real financial operation performed.


## Admin audit identity clarity — 2026-11-07

- Cross-check found the audit table used generic “Actor” and “User” headers while the values are administrator identity and affected BTCBOX UID. This can obscure which UUID is the operator versus the customer affected by the event.
- Updated the UI headers to “Operator ID” and “Affected user UID”; the stored `by` and `uid` values and API contract remain unchanged.
- Extended the audit E2E to assert both identity column labels and the synthetic operator/affected-user cells.
- CI previously exposed two E2E fixture/locator assumptions in the audit reload and user-detail isolation tests; those tests were made deterministic before adding the identity assertions. Latest exact-head CI is pending.
- No backend, audit schema, permissions, financial operations, production database, merge or deployment action performed by 2号 AI.


## Admin queue race and evidence-refresh isolation — 2026-11-07 (2号 AI)

- Repository check: PR #59 was merged by the repository owner on 2026-11-07 into `fix/post-merge-db-bootstrap-seconds-20261106`; the collaboration branch continues at its own HEAD. No deployment or production database action was performed by this batch.
- FOUND: Admin user-detail reads could complete out of order. A slow response for an earlier user selection could overwrite a newer user's detail panel, even after the old panel was cleared before each request.
- FIXED: sequence the user-detail requests with a component ref; only the latest selection may update user data, surface its error, or release the busy state.
- REGRESSION: Playwright delays the first user-detail response, loads the second user first, then releases the first response and verifies the second user's balance remains selected.
- FOUND: manual KYC queue refresh retained the previously loaded review rows when the new read failed, leaving stale evidence rows and approval controls available after a refresh error.
- FIXED: clear the KYC queue before manual refresh. If the request fails, no stale KYC evidence or approval action remains visible; the read error is shown.
- REGRESSION: KYC E2E now loads an incomplete evidence row, simulates a 503 on manual refresh, and verifies the stale user row and Approve button disappear. No financial/admin mutation is sent.
- Scope: frontend state isolation and Playwright only. No KYC decision rules, financial APIs, ledger, database schema, authentication, or production settings changed.
- Commits: `c806372` (latest-user response guard), `bda8639` (out-of-order response test), `6b5810f` (KYC fail-closed refresh), `ef50db2` (KYC refresh regression).
- Verification: exact-head CI queued/running at handoff; do not mark the batch fully verified until both frontend and backend workflows finish.


## Admin rapid-selection E2E assertion correction — 2026-11-07

- Exact-head frontend CI run `42347244241` completed with 52 Playwright cases passing and 2 failures (desktop/mobile variants of the same test); lint and production build passed.
- Root cause was an over-broad test assertion: it expected the previously selected user's email to disappear from the entire page, although that user correctly remains in the directory table. The assertion was checking directory visibility, not stale selected-detail state.
- Corrected the regression to assert that the earlier user remains in the directory while the stale `Available: 111.00` balance never replaces the latest user's `Available: 222.00` detail. This retains the out-of-order response regression without incorrectly hiding directory data.
- Follow-up test commit: `dab5f6dee6ea6f1196f0afe172f5d95cc4d3170c`. New exact-head CI must pass before marking verified.


## Admin KYC preview fail-closed and deposit record traceability — 2026-11-07 (2号 AI)

- FOUND: KYC approval was disabled when the document was absent or the secure URL was missing, but a response carrying both a URL and `document_preview_error` could still expose an approval action while the UI preferred the link and ignored the preview failure.
- FIXED: a non-empty `document_preview_error` now suppresses the secure-image link and disables Approve even if `document_uploaded` and `document_url` are present. Reject remains available to an authorized reviewer; no approval mutation is sent by the UI.
- REGRESSION: KYC E2E covers both missing upload and uploaded-but-preview-failed records, verifies both Approve buttons remain disabled, and verifies no secure-image link is exposed.
- FOUND: Admin per-user deposit history displayed amount/status/reference/time but omitted the source record ID, making it harder to correlate a row with ledger and support evidence.
- IMPROVED: show the deposit record ID as a separate read-only column and assert it in the existing user-detail E2E. The ID remains optional and displays an em dash when absent.
- Scope: Admin presentation and Playwright only. No KYC API decision policy, deposit API, ledger, DB schema, or financial mutation changed.
- Commits: `11a13c5` (KYC preview fail-closed), `feaf362` (KYC preview regression), `0a9cfb1` (deposit record ID), `0ef84b5` (deposit ID assertion). Exact-head CI pending.


## Admin audit history pagination and deposit-history completeness labels — 2026-11-07 (2号 AI)

- FOUND: Admin audit API already returns `next_before` and accepts a `before` cursor, but the UI only loaded the first 50 events. Added cursor-based “Load older records” for canonical PostgreSQL audit pages, deduplicating by event ID and refusing to append pages if source/completeness changes.
- Cross-check: canonical audit cursor is a positive PostgreSQL bigint and is supported by `readAdminAuditLogPage`. Legacy state audit IDs are generated as `AL...` strings, while the shared route currently validates `before` using the PostgreSQL-bigint validator before selecting the legacy branch. Therefore the UI intentionally does not expose cursor pagination for `btcbox_state`; it explicitly labels this retention-limited source instead of offering a button that would fail.
- FOUND: the account snapshot SQL returns only the 20 most recent deposit records. The Admin panel previously titled this simply “Deposit history”, which could imply full history. It now says “Deposit history · latest 20” and directs staff to the audit log for the wider financial event trail.
- Regression coverage: canonical two-page audit fetch, no pagination for a legacy `AL...` cursor, and explicit latest-20 note in user detail.
- Scope: frontend UI/API query parameter/tests/docs. No backend code, financial contract, ledger, database, production setting, or real account data changed.
- Commits: `0bf6425` (audit API cursor), `662d676` (Admin pagination), `fbc04a0` (canonical pagination E2E), `3986341` (source and history limits), `f51f17a` (legacy cursor and deposit limit E2E). Exact-head CI pending.


- Additional cross-review: audit pagination can remain in flight while an operator leaves and reopens the tab. Added a request-generation guard so an older page cannot append into a newly loaded snapshot; E2E deliberately delays the older page, reopens the tab, then releases the stale response and verifies it is ignored.
- Commits: `28c3df8` (stale-page response guard), `4fa93a5` (tab-switch race regression). Exact-head CI pending.


- Audit traceability: the Admin audit table now exposes the canonical event ID as its own column. The operator field remains explicitly described as the recorded actor identifier, not a human-readable display name; this avoids presenting UUIDs as verified staff names. E2E asserts the event ID column and canonical event ID value. Commits: `cb8a45d`, `95de3cc`.

## 2026-11-07 — 2号 AI public market provenance batch

- Dedicated branch: `work/ai2-integration-batch-20261107` from the active unified collaboration branch.
- The public market UI now distinguishes server snapshot time from provider timestamp/source and shows elapsed provider age; absent provider time remains explicitly unavailable.
- Added a Playwright regression fixture with intentionally different server and provider timestamps.
- Commits: `6ed1954`, `86b24d2`, `c00ecb7`. Exact-head CI and screenshot QA pending.
- No merge, deploy, production DB/auth change, real order, or financial write. Continue the existing release pause.

## 2026-11-07 — 2号 AI Admin tab response isolation

- Found stale Admin tab/search GET responses could overwrite a newer view because the shared loader lacked a request sequence guard outside audit pagination.
- Added a latest-request guard across Admin tab reads, errors and loading-state release; added a delayed-withdrawals response Playwright regression.
- Commits: `fc09aa7`, `6e206e4`. Exact-head CI pending.
- Frontend/test-only. No backend, financial, auth, database, production configuration, merge or deployment action.

## 2026-11-07 — 2号 AI deployment test isolation follow-up

- Inspected latest production deployment logs: frontend build succeeded; backend test command failed with 350/356 pass. One confirmed process failure was `tests/api-routing.test.js` inheriting a weak Vercel `ADMIN_PASS` and throwing `ADMIN_PASS_TOO_WEAK` during module load.
- Added a strong test-only `ADMIN_PASS` before importing the API adapter in that test file. This does not change runtime policy or Vercel settings. Five other reported failures remain unclassified until backend CI logs are available.
- Fixed an over-escaped provider-age Playwright matcher; lint/build had passed, but the first E2E run exposed the matcher defect.
- Admin tab effect cleanup now invalidates prior outstanding reads.
- Commits: `92f7f48`, `e535141`, `4091008`. Final-head CI pending. No deployment or merge.

- CI wiring gap fixed: backend workflow previously allowed push runs on the unified branch but omitted it from PR target branches. Added `work/btcbox-unified-20261104` to backend `pull_request.branches` so backend changes in draft integration PRs are tested. Commit: `e66111e`. Verify the run starts on this PR head.

- Backend CI now confirms the test-only admin secret isolates the deployment environment issue; build passed and 410/411 tests passed. Remaining failure was an outdated KYC source assertion that did not include the new secure-preview-error approval block. Updated test expectation to match the intended fail-closed UI (commit `ddd6f92`); rerun pending.

- Backend CI `42356561473` passed all 411 tests plus unified build, fail-closed preflight and output checks.
- Frontend CI `42356454539` exited success but reported 2 flaky tests that passed on retry. Stabilized the Admin stale-queue fixture for repeated initial reads and relaxed the new test's exact GET count. Commit: `94ba7a9`. Fresh exact-head frontend CI pending.

- Escalation to 1号/Core owner: production Vercel has a weak `ADMIN_PASS` and `api-core.js` throws at module import, which can prevent the shared catch-all API adapter from starting. The test-only override in `api-routing.test.js` fixes only test isolation, not runtime. Before release, the authorized environment owner must set a compliant strong secret, or Core owner must scope the fail-closed guard to admin authentication rather than crashing shared API startup. 2号 did not change production secrets or weaken policy.

- Frontend CI `42356699699` succeeded with 62 passed, but two Admin queue tests were flaky on first attempt and passed on retry because fixtures used GET counts while the app can issue repeated initial reads. Converted those failures to explicit action-triggered flags (commits `a0fab6b`, `7662bba`). Fresh exact-head CI pending; target zero flaky cases.

- Latest backend CI `42356891197` passed: unified build, 411/411 backend tests, deployment preflight and output checks.
- Latest frontend CI `42356891195` has passed install/lint/build/Chromium setup; Playwright desktop/mobile route tests remain in progress. Do not claim completion until final job status is success.
- PR #61 remains draft/open; no merge or deployment.

- Final CI green: frontend `42356891195` passed **64/64 desktop/mobile Playwright tests** with no flaky retries; backend `42356891197` passed **411/411 tests**, unified build, fail-closed preflight and output checks.
- PR #61 stays open/draft. No merge or deployment. Production weak `ADMIN_PASS` runtime blocker and manual visual/live-provider Preview checks remain unresolved.


## 2号 AI — registration and public preview responsive QA — 2026-11-07

- Registration source review confirmed Google/Ethereum/Solana identity verification first, followed by BTCBOX username/password setup at `/account-setup`. No email registration/OTP was introduced. Username/password, Google and wallet sign-in remain on login.
- Public `/home`, `/markets`, and `/trade/:symbol` routes remain available signed out; private account routes remain gated.
- Added Playwright coverage for registration at 320/390/768/1440 px and public preview at 320/375/768/1024/1440 px, including core content and no document-level horizontal overflow.
- Commit: `4362d2589ae1c81c4ba4a5be585aa4b526a97c37`. Fresh PR CI pending.
- Vercel status is blocked by the free-plan daily deployment cap (`api-deployments-free-per-day`); no deployment was retried. Automated viewport tests do not replace manual screenshot or live-provider verification.
- No production changes, merge, or deployment.


- Regression follow-up: first CI run `42357749939` exposed an E2E locator defect, not a UI defect: the test selected the hidden duplicate market-row representation. Replaced it with a locator constrained to visible paragraphs. Fix commit `ad7073ed1639be40f79bfd777d28fac9b1ee170f`; rerun exact-head CI before acceptance.


- FINAL CI — frontend run `42357960746` passed **68/68 desktop/mobile Playwright tests** after fixing the hidden duplicate-row locator. npm install, lint, build and Chromium setup passed. Backend run `42357960745` passed unified build, tests, fail-closed preflight and output/entrypoint checks.
- Vercel's separate status remains blocked by the free-plan daily deployment cap. No deployment was attempted. Manual screenshot and live-provider checks remain pending.


## 2026-11-07 — 2号 AI public market no-placeholder batch

- Dedicated branch: `fix/public-market-no-placeholder-data-20261107`, based on `main` at `2a3810d`; integration target remains `work/btcbox-unified-20261104`.
- Public Markets previously formatted zero-initialized pair entries as prices. Invalid/empty refreshes could also leave old values in memory and render them as current.
- Fixed provider parsing to accept only positive prices from the current response, clear missing/failed quotes, update all visible quote/stat elements, and hide unsupported/empty rows on Home and Markets. Trade headers now show unavailable values rather than formatting zero. Removed public-facing simulation/backend-internal wording from unavailable states.
- Added market-adapter and public UI regression tests. Exact-head CI, browser QA, and live-provider Preview verification are pending; do not mark accepted until CI passes. No production deployment, environment change, database write, or real financial operation.
- Detailed handoff: `docs/PUBLIC-MARKET-NO-PLACEHOLDER-HANDOFF-2026-11-07.md`.


## 2026-11-07 — 2号 AI Vite public UI copy and stale-market follow-up

- Vercel project lookup for btcboxcdt reports framework `vite`; the same repository also contains the backend static app. The batch therefore covers both the backend market adapter/views and the Vite customer-facing dashboard/pages, rather than assuming the legacy HTML view is the only active UI.
- Vite dashboard previously retained last confirmed quote rows after a market refresh error while labelling the table as live. It now clears market rows on refresh failure, and the table itself suppresses any quote rows whenever an error is present. Unavailable state is explicit and does not show stale snapshot/provider metadata or a misleading zero-pair count.
- Removed customer-visible wording that described orders as “sample or simulated” and “never simulated in the browser”; replaced it with ordinary account/market copy.
- Added Playwright regressions for a successful quote followed by a failed refresh and for empty market responses; added a source-contract test preventing simulation wording in customer pages.
- PR #63 now includes these Vite changes as well as the backend view/adapter fixes. Exact-head frontend/backend CI and browser QA remain pending; no production deployment or financial/DB operation.


## 2026-11-07 — 2号 AI final visible-copy cleanup

- Removed the visible “Preview” status pill from the top bar and “Preview · API verification pending” banner from the sidebar.
- Replaced the customer-facing “Integration pending / scaffolded / in this preview” section placeholder with a neutral “Unavailable” state.
- Removed remaining customer-facing “sample/simulated orders” copy from both Orders page implementations.
- Backend market depth cache is now cleared when the current order-book provider refresh fails, instead of continuing to display an old book.
- Regression tests cover these visible-copy rules and stale depth clearing. Latest PR head is d80ce66; exact-head CI is queued/running. No merge or deployment has been performed.
