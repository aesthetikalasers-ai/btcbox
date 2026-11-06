# BTCBOX recovered code integration — 2026-11-06

## Repository and branch facts

- Target product repository: `avali9308-code/btcboxcdt`.
- V33 remains a separate source/reference repository: `avali9308-code/btcbox-v33`.
- PR #26 restored the first React/runtime and customer-page baseline and was merged to main as `59e00770635808c5a3d7026932096d279e391a58`.
- PR #28 subsequently merged administrator RBAC and unlimited concurrent seconds-position support. Its changes are part of the current main baseline and must be preserved.
- Current follow-up integration branch: `integration/btcbox-complete-final-20261106`, created from the latest main snapshot before these follow-up changes.

## Work already merged to main

- React 19 + Vite customer runtime and route structure.
- BTCBOX styling adapted from the Strata design language; Shadcn Fintech source reference retained.
- Market data is API-driven; removed seeded/demo market rows and random chart fallback data.
- Customer Orders and Assets pages use authenticated account/order APIs with loading, empty, unauthenticated and error states.
- Customer auth includes Supabase Email and Google, account setup, password recovery, linked identities and 2FA foundations.
- Backend seconds settlement idempotency, multiple concurrent open positions, versioned policy schema and admin RBAC schema/helper foundations.
- Manual payout completion SQL/API foundation requiring a non-empty TxID/reference, idempotent for the same reference, rejecting a conflicting reference and not broadcasting or debiting again.

## Follow-up integration branch contents

- Retires shared Basic Auth from admin API requests. Every admin API call requires a verified Supabase Auth bearer token, an active admin membership and route-specific RBAC permission checks.
- Adds an admin session endpoint exposing only the verified administrator UUID, active status, Super Admin flag and permission list.
- Adds Supabase email/Google sign-in to the legacy admin entry and isolates the admin login path from customer account exchange.
- Adds a separate React `/admin` console with role-gated Overview, Users/manual credit, Deposit addresses, Withdrawals/manual payout, KYC, Audit, Orders and Support tabs.
- Adds typed bearer-authenticated admin API methods and exposes the Supabase access token from the React AuthProvider.
- Adds a customer withdrawal request form that derives asset/network from a selected saved address, requires fund password and 2FA when enabled, and retains the same request ID when a network result is uncertain.
- Adds the withdrawal availability endpoint. It remains fail-closed until financial ledger cutover flags and the required backend services are enabled.
- Adds per-user, per-asset manual credit in the admin UI. UID and coin are derived from the selected user and asset row; no user-created pending deposit order is introduced.
- Adds manual payout completion controls that require TxID/reference after staff have actually transferred funds.
- Retains the exact configured deposit-address network keys and the manual-credit model.

## User-approved business constraints retained

- Deposit: staff configure the receiving address/network; customer transfers there; staff verify actual receipt and manually credit. No automatic chain watcher, auto-credit, or user-created pending deposit order.
- Withdrawal: staff review; staff manually transfer; staff enter TxID/reference to mark paid. No automatic blockchain broadcast.
- Seconds: multiple unfinished orders are allowed. Policy boundaries and payout ratio must be controlled by the backend/admin policy, with 85% as a configurable floor rather than a hard-coded only value.
- The BTCBOX trading-page layout is protected from unrelated redesign.
- No production database write, destructive reset, real financial cutover enablement, production deployment or V33 deletion is authorized by this integration work.

## Verification and remaining work

- Earlier snapshot `84f11a11bff5e45a4bb6049b5177bad2f41dcdcf` passed frontend TypeScript/Vite build, backend unified build and 281/281 Node regression tests.
- Follow-up admin console, Supabase-only admin auth and withdrawal-form changes require a fresh CI pass on this branch.
- The 0026 admin RBAC and 0027 manual payout migrations are source-only; they have not been applied to production. Isolated PostgreSQL execution of the full migration chain is still required.
- No browser QA, Supabase admin-member bootstrap or live financial workflow test has been performed.
- The React seconds page is still read-only; seconds order submission/settlement UI and admin policy authoring/activation API are not complete end-to-end.
- Spot order-entry remains a scaffold.
- Customer address-book creation UI is not yet present; withdrawal currently uses eligible saved addresses.
- The React admin console is source-integrated but not browser-validated. Administrator membership-management UI and first Super Admin provisioning remain to be completed.
- `frontend/vendor/strata-pro` and `frontend/vendor/shadcn-fintech` are Git submodule pins to full upstream repositories, not vendored copies inside the BTCBOX runtime. Their design language has been adapted, but not every upstream page has been copied into the runtime.
- Figma connected seat was View-only and no editable design-file key was available. No OpenAI Platform connector was available in this session.
- Vercel previously reported `build-rate-limit`; this is a platform rate limit, not a successful deployment.
- V33 must remain intact until the final target branch passes migration, API, browser and financial workflow acceptance.
