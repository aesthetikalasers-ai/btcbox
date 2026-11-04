# BTCBOX production page audit — 2026-11-05

## Audit target

- Production Vercel deployment: `btcboxcdt-k6aaicpqr-fuyao999.vercel.app`
- Deployment ID: `dpl_2jDZyjMq4wzNvE7B6Nh2qXbc9jin`
- Production source: `main` at `05951f701b5a53f73089ab8e157ab310a700750d`
- Audit branch: `fix/production-launch-page-audit-20261105`
- This is a source and deployment-metadata audit. A real-device browser pass has not yet been performed.

## Immediate UI defects addressed in PR #19

1. Remove randomly generated fallback candles and volume bars. Charts must display only data returned by the market API.
2. Replace the top-bar account dead button with a link to the account page.
3. Disable notifications until a notification service is connected.
4. Make top-bar and in-page market search actually filter market symbols/names.
5. Localize market table labels, prices and percentage formatting.
6. Improve mobile navigation dialog semantics, menu state, close-button target size and bottom-nav label fit.
7. Allow shared button labels to wrap for long translations.
8. Prevent integration-pending cards from overflowing narrow screens.
9. Check all seven locale dictionaries for duplicate keys.

## Page-by-page status from production source

| Page / route | Current frontend status | Existing backend contract | Priority / next action |
|---|---|---|---|
| Markets `/markets` | Partially integrated: market list and 1h candles load; errors and table labels need consistent UX | `GET /api/market`, `GET /api/kline`, `GET /api/depth` | P1: add refresh/error/retry feedback and verify live responses |
| Trade hub `/trade-hub` | Mode selection only; spot and seconds are marked pending | Spot `POST /api/order`, `POST /api/order/cancel`, `GET /api/orders`; seconds APIs below | P1: build on existing order contracts; do not invent payloads |
| Spot trade `/trade/:symbol` | Placeholder page; no order form/order book/history UI | `POST /api/order`, `POST /api/order/cancel`, `GET /api/orders`, `GET /api/depth`, `GET /api/kline` | P1: port verified flow and keep write actions disabled until full contract tests pass |
| Seconds `/seconds` | Placeholder page | `POST /api/seconds/order`, `POST /api/seconds/settle`, `GET /api/seconds/positions` | P1: implement open/settle/history states only after lifecycle and idempotency tests |
| Assets `/assets` | Empty account-data state; no live balance or history view | `GET /api/account`, `GET /api/orders`, `GET /api/addresses` | P1: connect authenticated read-only account data first |
| Deposit `/deposit` | Placeholder page | `POST /api/deposit` | P1: endpoint currently returns address details in query mode; it does not create a pending user deposit order. Do not imply a submitted deposit request |
| Withdraw `/withdraw` | Placeholder page | `POST /api/withdraw` | P0 safety: never enable until backend financial gates, address/network validation, fees, fund password/2FA, review, idempotency and staging lifecycle are verified |
| Earn `/earn` | Placeholder page | `POST /api/earn` with subscribe/redeem actions | P1: confirm products, eligibility, read APIs and redemption states before enabling |
| Login / Register `/login`, `/register` | Placeholder pages; no credentials collected by current React frontend | `POST /api/login`, `POST /api/register`, `POST /api/supabase-login`, `POST /api/login/2fa`, `POST /api/logout` | P1: connect configured Supabase Auth and server session exchange; verify Google/email policy |
| Account `/me` | Static sign-in prompt; no authenticated profile read | `GET /api/account` | P1: add session-aware profile and sign-out state |
| KYC `/kyc` | Placeholder page | `POST /api/kyc` | P1: implement only the fields and review states the API supports; do not imply document upload if unsupported |
| Orders `/orders` | Placeholder page | `GET /api/orders` | P1: connect authenticated order history and status filtering |
| Support `/support` | Placeholder page | `GET /api/support/messages`, `POST /api/support/chat`, `GET /api/chat/unread` | P1: connect messages, send state, unread count and error handling |
| Settings `/settings` | Placeholder page | `POST /api/settings/password`, `POST /api/settings/fundpwd`, `POST /api/2fa/enable`, `POST /api/2fa/confirm`, `POST /api/2fa/disable` | P1: implement one security action at a time with confirmation and recovery states |

## Structural findings

- The React API client in `frontend/src/lib/api.ts` currently exposes only market list and candle reads. The backend already has a broader API surface, but most React routes do not consume it.
- Several older source views and `backend/assets/js/app-core.js` contain prior UI/API adapter logic. They are useful as contract references, not proof that the new React pages are wired or browser-tested.
- Backend documentation states that the deposit endpoint is address-query-only and does not create a pending deposit order.
- The current frontend's login, registration, trade, seconds, withdrawal, KYC, support and settings routes are scaffolds. They must not be presented as working capabilities.
- Vercel runtime-error aggregation returned no runtime error clusters in the queried seven-day window. This does not prove client-side correctness or route-level browser acceptance.
- Vercel Hobby runtime logs could not be retrieved for the requested historical window because of retention limits.

## Work order

1. Land and verify PR #19 (production chart, navigation, search, responsive and localization corrections).
2. Add authenticated read-only account, order-history and support views using existing contracts.
3. Integrate Supabase login/register and session restoration; verify sign-out and optional 2FA challenge.
4. Build spot trading and seconds interfaces against existing contracts, initially gated from financial writes.
5. Complete deposit/withdraw lifecycle only after explicit staging verification; keep all financial gates closed until approved.
6. Complete KYC, Earn and settings workflows with clear pending/success/error/unknown states.
7. Run browser/device QA at 320, 360, 390, 430, tablet and desktop widths; test every navigation item and form state.

## Guardrails

- No production data writes, financial flag changes, migrations, PR merges or deployments as part of this audit.
- No fabricated market data, balances, orders, deposit records or transaction success.
- Use existing project components and mature libraries before introducing custom UI primitives.
- Every page is marked operational, read-only, preview-only, unavailable or pending based on its actual API and test evidence.
