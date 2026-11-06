# BTCBOX final runtime reconciliation — 2026-11-06

## Identity
1号 AI — Core integration / repository reconciliation review.

## SOURCE OBSERVED

The recovered repository currently contains two separate React customer runtimes:

- `frontend/`: Vite + React 19, the newer BTCBOX professional UI foundation with live API clients, i18n, Supabase authentication, responsive layout, and the current design system.
- root `src/`: the older Create React App/template runtime described by the legacy README.

The root `package.json` points at `react-scripts`, while `frontend/package.json` is the Vite application. This split is the primary merge/deployment ambiguity.

## SOURCE OBSERVED — deployment risk

Before this reconciliation there was no root `vercel.json`. A Vercel project attached to the repository could therefore resolve the root CRA application instead of the intended `frontend/` runtime.

The frontend itself calls `/api/*`, while the canonical catch-all function lives at `backend/api/[...path].js`. The reconciliation adds an explicit Vercel build target and API rewrite without changing business logic.

## SOURCE OBSERVED — product audit

The newer frontend is materially closer to the requested professional exchange direction:

- Inter / Noto Sans / JetBrains Mono typography.
- Dark, restrained exchange palette and responsive mobile layout.
- Live market and kline requests instead of hard-coded market numbers.
- Authenticated account, orders, deposit, withdrawal, Earn and support API clients.
- Supabase authentication and protected account routes.
- Admin route is kept outside the customer AppLayout.
- Unsupported futures functionality is explicitly marked unavailable.

However, the requested final trading experience is **not yet complete** in this branch:

- `/trade/:symbol` is still an integration-pending placeholder.
- The requested mobile dual workspace (order book left / order entry right), order-type selector, quantity/amount controls, percentage shortcuts and chart bottom drawer are not present as the final trading screen.
- TradeHub explicitly says spot API integration is pending.
- Therefore this branch should not be described as the finished professional trading terminal yet.

## REPRODUCED

Repository comparison shows `integration/btcbox-complete-final-v3-20261106` diverges from current `main` and is not a clean fast-forward candidate. It is ahead by 9 commits and behind by 48 commits relative to current main. Blind merging would risk reintroducing the duplicate-runtime structure and conflicting integration history.

## FIX APPLIED

- Added explicit Vercel configuration targeting `frontend/`.
- Added explicit deployment of the shared backend catch-all function.
- Added `/api/*` → backend catch-all rewrite.
- Kept existing backend business logic untouched.
- Kept the newer frontend runtime as the deployment target rather than deleting the legacy source immediately.

## REPRODUCED — Vercel preview build

The first preview build of this reconciliation branch failed before compilation because the frontend has no `frontend/package-lock.json`, while the deployment install command used `npm ci`. The failure was corrected by switching the Vercel install command to `npm --prefix frontend install`.

## NOT VERIFIED

- Hosted Vercel deployment after this commit.
- Browser/mobile visual QA at the required 320–430px trade widths.
- Production database writes or financial cutover.
- Real order submission/settlement.

## RELEASE POSITION

Do not treat this branch as production-ready merely because the runtime selection is fixed. The next acceptance gate is: build + deployed preview + mobile/browser audit of the actual trading page, followed by API contract verification.
