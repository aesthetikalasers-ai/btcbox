# BTCBOX Integration Reconciliation — 2026-11-06

Repository: `avali9308-code/btcboxcdt`
Audit branch: `chore/shared-ai-coordination`
Audit base HEAD: `06e1b635724cbbcd4ff44e14814e3ee868f1cb98`
Main HEAD observed: `14a8e361fd928626d4e350a03698135f0c49ceea`
No main merge, production deployment, Supabase write, or destructive action was performed.

## Executive decision

Use `feat/btcbox-web3-auth-20261105` at `fbfb96ee26ff8bce6637f2ca11cbf21f0644c928` as the current comprehensive implementation candidate for continued source QA. It is 374 commits ahead of main and 0 behind according to GitHub compare, so it already contains the current main ancestry plus a large accumulated implementation series. Do not merge it yet: the diff spans backend API/security, SQL migrations, account/auth, frontend routing and UI, and needs route-by-route review plus independent QA.

Do not revive the old template migration branch as a merge candidate. It is 24 commits ahead / 49 behind main and diverged. Do not merge old fix branches separately. No open pull requests were returned by the repository's GitHub pulls endpoint at audit time.

## Current source-of-truth observations

### Build roots

- Root `package.json` on main is Create React App / `react-scripts`.
- `frontend/package.json` on main is a separate Vite + React 19 + TypeScript + Tailwind 4 application.
- `backend/package.json` defines the canonical backend build command: install/build `../frontend`, then run `backend/scripts/build-site.js`.
- Main's `backend/scripts/build-site.js` overlays the Vite build at the public root and preserves legacy SPA/admin/OAuth assets. The older template branch has the same core build architecture, with additional branding asset copy steps.
- Therefore the intended customer-facing build path is Vite under `frontend/` assembled by `backend/scripts/build-site.js`; the root CRA manifest is a conflicting legacy artifact, not evidence that the Vite frontend is absent. Do not delete the root CRA files until Vercel project root/build settings are independently confirmed.

### Frontend routes on main

Main `frontend/src/App.tsx` currently routes `/trade/:symbol`, `/seconds`, `/orders`, `/deposit`, `/withdraw`, `/earn`, `/login`, `/register`, `/kyc`, `/support`, and `/settings` to generic SectionPage placeholders. `/home`, `/markets`, `/trade-hub`, `/assets`, and `/me` have page components, but that does not establish complete business integration.

### Accumulated auth/seconds/admin candidate

At `fbfb96ee26ff8bce6637f2ca11cbf21f0644c928`, `frontend/src/App.tsx` adds Supabase auth pages/callback, account setup, account security, protected routes and a dedicated SecondsPage. Spot trade, orders, deposits, withdrawals, Earn, KYC and support still route to SectionPage placeholders in that snapshot. This is materially further along than main but is not a complete exchange frontend.

The same feature branch includes:
- `backend/admin-auth.js` and tests: trusted Supabase Auth token verification helper.
- `backend/admin-rbac.js` and tests: closed permission catalogue and Super Admin policy helpers.
- `backend/supabase/sql/0025_seconds_policy_versioning_v1.sql` and `0026_admin_rbac_private_store_v1.sql`.
- seconds order/settlement, rate-limit, audit and account-security source/tests.
These are source-level deliverables. Migration 0025/0026 have not been applied or validated against PostgreSQL staging; RBAC is not connected to live admin routes or admin UI. Legacy Basic Auth remains in place. Do not describe Super Admin/RBAC as active.

### Existing backend SPA and trade surface

The legacy backend SPA has a substantial existing API adapter and a dedicated `backend/assets/js/views-trade.js` / `views-trade.css` trading workspace, plus real backend routes for account, spot orders, seconds, deposits, withdrawals, Earn, KYC, support and admin. Its source describes live market endpoints and no synthesized market data; this is a source claim, not runtime verification.

The React app and legacy SPA are currently separate UI implementations. Their API contracts and page coverage must be reconciled before choosing which UI owns each customer workflow. Do not embed the old vanilla-JS app inside React or discard its backend contracts.

### V211 protection

The user's approved professional trading terminal baseline is V211. This audit has not positively identified a V211-named source file or snapshot path in the inspected tree. The legacy trade view is professional-workspace code, but it must not be assumed to be V211 without explicit source evidence. No trading page was edited. Before any trading UI change, locate and record the exact V211 source/snapshot and its commit.

## Branch inventory and disposition

| Branch | Latest observed HEAD | Compare to main | Disposition |
|---|---|---:|---|
| `main` | `14a8e361fd928626d4e350a03698135f0c49ceea` | baseline | Preserve; no writes |
| `chore/shared-ai-coordination` | `06e1b635724cbbcd4ff44e14814e3ee868f1cb98` | coordination docs | Keep as shared record |
| `feat/btcbox-web3-auth-20261105` | `fbfb96ee26ff8bce6637f2ca11cbf21f0644c928` | 374 ahead / 0 behind | Primary accumulated QA candidate; not merge-ready |
| `feat/btcbox-unified-template-migration-20261105` | `6af0210b6b2716cf5d0310fa3b7384d33bf8e808` | 24 ahead / 49 behind | Historical template/build evidence; do not merge directly |
| `feat/btcbox-react-google-auth-20261105` | `5598a54dac689d6d4e6a7482e3311d0d5e7f8b1b` | 38 ahead / 0 behind | Earlier auth implementation; compare/reuse only if unique |
| `feat/btcbox-strata-theme-batch-20261105` | `0b93b1a5c77aaff5420ab1bbdf2f5c9eec5f88de` | 14 ahead / 0 behind | Visual/chart fixes; compare/reuse only if unique |
| `fix/btcbox-no-fake-market-data-20261105` | `39c1a970bec240cd2f1c77aa063fff0c7c130ce2` | 3 ahead / 0 behind | Small chart-data correction; verify already included in candidate |
| `feat/btcbox-mature-ui-foundation-20261105` | no unique commits vs main | behind | Historical/superseded |
| `feat/btcbox-ui-i18n-mobile-20261105` | no unique commits vs main | behind | Already merged to main through PR #21 |
| `fix/btcbox-button-hierarchy-mobile-20261105` | no unique commits vs main | behind | Historical/superseded |
| `fix/btcbox-i18n-completeness-20261105` | no unique commits vs main | behind | Historical/superseded |
| `fix/btcbox-live-chart-no-fake-data-20261105` | 6 ahead / 21 behind | diverged | Do not merge separately; verify candidate contains desired fix |

## CI and deployment evidence

- Exact candidate SHA `fbfb96ee26ff8bce6637f2ca11cbf21f0644c928`: GitHub Actions check run `42144478167` completed SUCCESS. The run covers unified frontend/backend build, backend tests, fail-closed deployment configuration validation, preserved output/entrypoint checks and cleanup.
- The same SHA's Vercel status is FAILURE because the deployment was rate-limited with a retry-in-24-hours message. This is not a GitHub test failure. No deployment setting was changed.
- Template branch SHA `6af0210b6b2716cf5d0310fa3b7384d33bf8e808`: earlier evidence recorded a READY preview artifact, but it is an older, divergent branch and does not prove current candidate readiness.
- GitHub currently returns no open pull requests for this repository.
- No browser E2E, route-by-route functional QA, deployed live API verification, V211 visual comparison, SQL runtime validation, or real financial workflow test is claimed.

## Next implementation batches

1. **Candidate diff audit:** compare the complete `fbfb96e` tree to main by functional area; confirm all useful market/no-fake-data, mobile, localization, brand/template and auth changes are present. Identify accidental regressions and duplicate/legacy artifacts.
2. **Page coverage matrix:** map each route to its existing React page, legacy SPA view, backend API contract and missing interaction states. Prioritize spot trading (only after V211 source identification), SecondsPage, account/assets/orders, deposit/withdraw, KYC, support and Earn.
3. **Admin completion:** preserve existing backend admin API/Basic Auth while building a real admin UI and a parallel Auth+membership integration. Keep RBAC SQL source-only until PostgreSQL staging/catalog/role/concurrency tests are available. Financial write controls remain fail-closed.
4. **Canonical build/deployment:** inspect actual Vercel project root/build settings and verify the public output locally/preview; do not change production settings or deploy without user approval.
5. **Release QA:** exact-SHA tests, route/browser checks at mobile and desktop sizes, auth/session checks, API contract checks and independent review before requesting merge approval.

## User/account/database note

The user reports that all test Auth users have been cleared. This audit did not re-query Supabase Auth, and therefore records this as user-confirmed rather than independently verified. Clearing Auth users does not imply deleting business tables, policy/catalog data, migration history or audit structures. Preserve those.


## Candidate ancestry cross-check — follow-up

GitHub pairwise comparisons confirm the selected candidate is a fast-forward descendant of:
- `feat/btcbox-react-google-auth-20261105` (`5598a54dac689d6d4e6a7482e3311d0d5e7f8b1b`);
- `feat/btcbox-strata-theme-batch-20261105` (`0b93b1a5c77aaff5420ab1bbdf2f5c9eec5f88de`);
- `fix/btcbox-no-fake-market-data-20261105` (`39c1a970bec240cd2f1c77aa063fff0c7c130ce2`);
- `feat/btcbox-ui-i18n-mobile-20261105` (`8c8c75e65852cef9b403c6df341509b25d01486d), already merged to main through PR #21).

The candidate is therefore not missing those accumulated auth/theme/no-fake-data/mobile-i18n commit histories. The template migration branch is different: it has 24 commits not in the candidate and the two branches diverged from merge-base `93a236e4a3ed6c9edd2003ac1068a89161015511`. Candidate tree inspection confirms it does not contain `.gitmodules` or `frontend/vendor/*`; the pinned complete upstream template submodules remain only on the old template branch and must be reviewed as a separate source asset, not merged wholesale.

Further source inspection on candidate `fbfb96e`:
- `SecondsPage` exists and reads actual open/history position snapshots, displays loading/error/cutover-incomplete states, and explicitly disables placing/settling orders in that view. This is a read-only page, not a complete seconds trading flow.
- `backend/assets/js/app-core.js` still uses Basic Auth for admin endpoints; no `VIEWS.admin` implementation was found. Admin UI is still missing in this SPA snapshot.
- Candidate `frontend/src/App.tsx` still uses SectionPage for spot order entry, orders, deposits, withdrawals, Earn, KYC and support. Authentication/account security and read-only seconds positions are implemented further than main, but those workflows remain incomplete.
- V211 remains unlocated; the existing legacy trade view must not be assumed to equal V211.


## Batch execution — authenticated assets and order history

Implementation branch: `feat/btcbox-web3-auth-20261105`.

- Added `OrdersPage` in `frontend/src/features/pages/Pages.tsx`, using the existing `getOrders(signal)` authenticated API client. It displays returned order records only, has loading/error/retry/empty states, and no order mutations.
- Changed `/orders` to require an authenticated account route and load the new page.
- Replaced the Assets placeholder with an authenticated `getAccount(signal)` view. It renders available/frozen balances from the returned account snapshot, shows estimated USDT total only when the backend marks valuation complete, and surfaces unpriced assets without presenting partial totals as complete. Loading/error/retry/empty states are included.
- Both pages use the existing API client; no new endpoint, mock balance, seeded order, or financial write path was added.
- Source commits in this batch:
  - `f860aeabadbcd46e86e51cd395d9a1a92fe1f1fe` — order history page.
  - `6601ed9771fe0d4e4cc21edd212b619bb04ae6f5` — protected orders route (contained a literal escaped newline typo in its import line; CI caught it).
  - `5d3fb2f62e5a7e575412a779bca4e4b664dabed4` — authenticated assets page (same inherited import-line typo; CI caught it).
  - `403fc12d679b11590e5eaf5c8e8aaae15f33d99a` — corrected the import-line syntax issue.
- Frontend CI for the order page commit `f860ae...` passed (run `42149692267`). The two following commits failed TypeScript lint specifically at `frontend/src/App.tsx:14` due to the literal escaped newline; no build step ran on those commits. That source defect was corrected at `403fc12d...`. CI run `42149902764` for the corrected head was still in progress at the time of this report update; do not claim it passed until the run completes.
- Latest candidate SHA observed: `403fc12d679b11590e5eaf5c8e8aaae15f33d99a`. It remains 377 commits ahead / 0 behind main at the last compare.
- No main merge, pull request, deployment, database write, or financial transaction occurred.


## Implementation batch — authenticated My Account profile — 2026-11-06 (UTC+8)

- Continued on `feat/btcbox-web3-auth-20261105`, starting from candidate `403fc12d679b11590e5eaf5c8e8aaae15f33d99a`.
- Implemented the `/me` account overview in `frontend/src/features/pages/Pages.tsx` using the existing authenticated `getAccount(signal)` client and `useAuth()` session state.
- Authenticated users now see the backend-returned username/email, KYC status, 2FA status, linked sign-in providers, and a partially masked BTCBOX UID. Unauthenticated users retain sign-in/register links. Loading, request error/retry, and abort cleanup are included.
- No new endpoint, mock profile, balance mutation, financial write, or trading-page change was introduced. The V211 trading terminal was not touched.
- Commits: `645c2221ea01afe566daa92973403d5bb8cb79f2` (profile implementation), `32a14b6a27a5da259fd61f3e8d483776016963d0` (session-hook import correction).
- Exact candidate head after this batch: `32a14b6a27a5da259fd61f3e8d483776016963d0`; GitHub compare against `403fc12d679b11590e5eaf5c8e8aaae15f33d99a` reports 3 commits ahead / 0 behind and exactly one changed path: `frontend/src/features/pages/Pages.tsx` (37 additions, 3 deletions).
- Source re-fetch at the exact head confirms the auth hook import and profile implementation are present. No GitHub Actions run was returned by the PR-run-only lookup; combined status reports only Vercel failure due the existing Hobby build-rate-limit target. Therefore this batch is SOURCE OBSERVED, not TEST PASSED. TypeScript/build and browser behavior remain NOT VERIFIED.
- No merge, PR, production deployment, Supabase write, or financial transaction occurred.
