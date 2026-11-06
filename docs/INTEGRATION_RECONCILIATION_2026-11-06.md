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


## Follow-up UI truthfulness fix — Seconds capability label — 2026-11-06 (UTC+8)

- On `feat/btcbox-web3-auth-20261105`, corrected the Trade Hub Seconds card to state that real open-position/settled-history viewing is available while new order entry remains disabled. This removes the misleading blanket `API integration pending` label.
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


## Earn integration follow-up — 2026-11-06 (UTC+8)

- Corrected the prior frontend-only audit: the active feature branch already contains the authenticated POST /api/earn subscription/redemption handler, database migrations 0005_financial_earn_redemption_idempotency_v4.sql and 0006_financial_earn_policy_v5.sql, and read migration 0011_financial_read_api_earn_v1.sql. The handler delegates balance changes to atomic PostgreSQL RPCs and returns FINANCIAL_CUTOVER_INCOMPLETE while the financial write switch is off. The catalog migration defines seven products and immutable per-position policy snapshots; early fixed-term redemption applies the configured fee.
- Added authenticated GET /api/earn/products to backend/api-core.js. It reads active product rows from public.earn_product_catalog through the server-only Supabase service credential, validates returned fields, and exposes only a boolean actions_enabled; it never falls back to frontend seed data. If the catalog migration/table is absent or the read fails, it returns a fail-closed 503.
- Feature commits: 7c81554af3b772e4b95e3e7f5938bda12de035c4 (catalog reader; initial URL normalization typo) and 9ad9a3d291be8b0e38ce5f69cc54e96f65115eda (corrected URL normalization). Exact compare from 6ee679080ec3e4f75c14aab8e61bb6ab76b951ff confirms two commits ahead / zero behind and only backend/api-core.js changed (25 additions).
- Exact-SHA source re-fetch confirms the authenticated catalog route and corrected URL normalization. GitHub Actions lookup returned no PR-triggered workflow runs; combined status reports only the existing Vercel Hobby build-rate-limit failure. Backend runtime tests, TypeScript/build, and browser QA are NOT VERIFIED.
- Frontend Earn API/page wiring was not committed in this batch; the attempted frontend API write was blocked by the platform safety check and was not retried through another path. Earn page remains a placeholder. No SQL migration was applied, no Supabase write or financial operation occurred, and no merge/deployment/trading-layout change occurred.
- Product/position/interest read data: the existing account snapshot can expose earn_records only when the read migration is applied; migration 0011 returns normalized positions. The new catalog route depends on migration 0006. Migration history previously observed on the live project did not include these migrations, so live catalog availability remains NOT VERIFIED. Do not apply migrations to production as part of this source-only batch.
- Product behavior remains database-defined: flexible products accrue by elapsed time; fixed products mature at term end; early fixed redemption deducts the snapshotted early fee. Do not describe Earn as requiring manual approval; no such state exists in the current SQL/API contract. The broader BTCBOX semi-manual operating model remains relevant to withdrawal review and other admin-operated processes.


## Earn frontend integration batch — 2026-11-06 (UTC+8)

- Added typed Earn catalog/action clients and optional normalized Earn positions to the account snapshot type.
- Replaced the placeholder /earn route with a protected Earn page. The page reads active products from authenticated GET /api/earn/products and the user's positions/estimated interest from authenticated GET /api/account. It presents backend APY, asset, product type, term, early redemption fee, principal, estimated interest and maturity; it does not use a hardcoded product catalog.
- Added subscribe and redeem actions through existing POST /api/earn. Both actions use UUID request IDs and retain the same key for retry after an uncertain response, relying on backend idempotency. UI reports success only after an affirmative backend response. Database RPCs remain authoritative for balance, amount scale, maturity and early redemption fee.
- When actions_enabled is false, the page still permits read-only review but disables subscribe/redeem and explains that financial cutover is incomplete. Account and catalog reads are settled independently so one read can still display if the other fails.
- Commits: 412859aa3796f0ae54648a7d5e8548cfb1532fcb (API clients), cc4b8802bc11b74384660744f8417d360e49e791 (position typing), fed400f8ef68f8acf9302685da341bc646161804 (page), 0ccae477434652170d3da0f6bf7b3de5dd3cc650 (protected route), 66fb2804c1948af12253fd899be8f0c187c1f483 (partial read and idempotency retry handling).
- Exact compare from 9ad9a3d291be8b0e38ce5f69cc54e96f65115eda to 66fb2804c1948af12253fd899be8f0c187c1f483: 5 ahead / 0 behind. Files: App.tsx +2/-1; Pages.tsx +94/-1; api.ts +72. Exact-SHA source re-fetch confirmed the new client functions, page, route, and backend atomic RPC references.
- Package scripts declare npm run lint as tsc --noEmit and npm run build as tsc -b && vite build. These were not executed here. No PR-triggered Actions run was returned; combined status only reports Vercel Hobby build-rate-limit failure. TypeScript, build and browser QA remain NOT VERIFIED.
- No Supabase migration/write, financial operation, merge, deployment, or V211 trading layout change occurred. The previously observed live migration history did not include 0006 and 0011, so actual live catalog/position read availability is not verified; these migrations require review and explicit staging/production rollout.
- The Earn SQL/API contract processes subscription and redemption atomically; no manual approval state exists for Earn. The wider semi-manual model remains a requirement for admin-reviewed workflows such as first-time and high-value withdrawals.


## User-confirmed simplified semi-manual funds workflow — 2026-11-06

User's explicit direction: keep deposit/withdraw simple and semi-manual. For deposits, admin configures the address for each asset/network; the user transfers to that address; staff manually verifies receipt and manually credits the user's balance. For withdrawals, user submits a request; admin reviews the request status; after approval, staff manually sends funds externally and records the payout as paid/completed. Approval is not payout completion.

Source audit:
- Existing admin address configuration is `GET/POST /api/admin/config`.
- User `POST /api/deposit` amount 0 only returns the configured address; positive amount is rejected. There is no user deposit request/history route in this source.
- Existing admin manual credit endpoint `POST /api/admin/deposit/confirm` calls `admin_manual_deposit_atomic`, but it is disabled until financial cutover is enabled.
- User withdrawal endpoint `POST /api/withdraw` already validates user, amount, saved destination, fund password/optional 2FA, idempotency and calls `create_withdrawal_atomic`, but fails closed while cutover is incomplete.
- Admin `POST /api/admin/withdraw/approve` and `reject` call `review_withdrawal_atomic`. Approval explicitly says no chain broadcast occurred. No completed/manual-payout action was identified in this audit.
- Current frontend deposit page only shows the configured address and incorrectly describes credit as on-chain confirmation. Current withdrawal page is read-only and does not expose submission.
Required next work: minimal manual workflow only—user deposit record/history is optional and not required by current user direction; manual admin credit after external verification; user withdrawal request; admin pending/approve/reject; manual payout completion with reference/hash and visible status. No chain scanner, automatic payout, automatic broadcast, or multi-stage approval machinery.


## Financial switch and current production contract — 2026-11-06

- User clarified there are no users and the financial switch does not need to remain closed merely for legacy-data protection. Read-only Supabase check: Auth users 0, financial_accounts 0, withdrawal_requests 0, Earn product catalog 7.
- Live database has the required core tables and RPCs, including admin manual deposit credit, withdrawal create/review, financial operation, account snapshot, admin withdrawal snapshot, and admin account balance reads. The live `create_withdrawal_atomic` is 9 arguments (ending with `p_request_hash`); withdrawal table lacks `require_admin_review` and manual-paid metadata fields. The live admin withdrawal snapshot lists pending only. Registry has two timestamped migration entries; actual schema/function inspection is the source of truth.
- Production app is separate repo `avali9308-code/btcbox-v33`, Vercel project `btcbox-v33`. All four cutover flags are currently plain 0 in production and preview. Matching engine should stay off for the requested manual deposit/withdrawal flow.
- Found API/DB mismatch: production backend called the 10-argument create-withdrawal RPC while the live DB exposes 9 args. Branch `fix/manual-withdrawal-rpc-compat-20261106` fixes this and makes every withdrawal enter manual admin review. Deposit and withdrawal page wording now reflects configured receiving addresses, manual receipt verification/credit, manual withdrawal review and manual payout.
- Commits: `1d66cdfe43d5974ba921a3573d40b897a58b584c`, `90b887eceb18e613cab22eea66295190e41d1b15`. Exact compare to main: 2 ahead / 0 behind; two files changed. Source checks passed. Test/build not run; Vercel check failed; no Actions run returned. No production deploy, Vercel env edit, DB write or funds operation.
- Do not treat the switch as permanently off. Enable only after the branch is integrated and the remaining manual payout completion action/status is available. No legacy user migration is needed; no deployment was authorized/performed in this batch.
- Critical Supabase advisor finding: RLS disabled on two private backup tables (`btcbox_state_pre_test_cleanup_backup`, `btcbox_auth_test_users_backup`). User must decide whether to lock these down; no automatic change was made.


## Manual withdrawal payout completion batch — 2026-11-06

- Production code branch `fix/manual-withdrawal-rpc-compat-20261106`, latest SHA `e99502b02426a6773ca7201c5be45c7179110950`; compare with production main `18a354a9e8e1d0365e240c7c44eda4a18d62ce07`: 10 ahead / 0 behind.
- Added SQL migration `backend/supabase/sql/0023_withdrawal_manual_payout_completion_v1.sql`: payout metadata fields, `completed` status, row-locked `mark_withdrawal_paid_atomic` (only approved withdrawals, idempotent same-reference retry, audit row, no second balance movement), admin queue snapshot including pending+approved, and user withdrawal-history read RPC. New RPC execution is service_role only.
- Backend adds admin mark-paid endpoint and authenticated user withdrawal-history endpoint. Frontend adds admin queue fetch and manual paid action with optional TxID/reference, and user-visible withdrawal history with pending/approved/rejected/completed labels and payout reference/time. All withdrawal requests are manual-review requests; no scanner, broadcast or automatic payout is added.
- Route test list now includes `withdrawals` and `admin/withdraw/mark-paid` (25 nested routes total).
- Intermediate Vercel build logs for SHA `3c11b11f5bc8ae4dd7b49392becddd42a5ba78f8` showed a syntax error from a wrongly escaped URL-trim regex in the two new API routes. Both occurrences were corrected in `23e4882758e671ef98df1f6fa88c9d8c9bbb1b3b`; latest source check confirms the proper regex. Latest Vercel combined status is still failure; latest build logs were not available because the Vercel team scope requires reauthorization. No CI/test pass is claimed.
- Latest diff from main: 6 files changed (API core, app-core adapter, admin UI, withdrawal UI, SQL migration, API routing tests). Static source checks confirm the new endpoints, RPC guard, admin queue, and user history paths are present. Node tests/build have not been rerun after the regex correction.
- Migration 0023 is committed but NOT applied to the live Supabase project. No production env variables changed, no deploy, no DB DDL/write, and no financial operation performed. Current financial flags were last observed at 0 in production and preview; they have not been changed in this batch. Matching engine remains off.
- Next: restore Vercel team access to inspect the latest build; apply migration 0023 only after a reviewed database change window; deploy/integrate this branch; run build, API tests and authenticated manual workflow smoke tests; then enable the three financial cutover flags (not the matching engine flag). User has said not to keep the switch closed just because there are no users; this does not replace the code/schema/smoke-check prerequisites.


### Supabase migration 0023 transactional smoke test
- Ran migration 0023 in a PostgreSQL transaction, inserted a synthetic approved withdrawal, invoked `mark_withdrawal_paid_atomic` for first completion and same-reference idempotent retry, and called `read_withdrawal_history_v1`. No SQL/RPC error occurred.
- Rolled back the transaction. Follow-up query confirmed 0 persisted synthetic withdrawal rows and 0 persisted payout metadata columns. This verifies SQL/RPC execution paths without applying the migration or retaining data; migration 0023 remains unapplied.
