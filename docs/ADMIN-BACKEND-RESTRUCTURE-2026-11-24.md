# BTCBOX Admin Backend Restructure — 2026-11-24

## Working boundary

- Working branch: `work/admin-backend-restructure-20261124`
- Baseline branch: `integration/btcbox-acceptance-20261123`
- Verified common baseline commit: `92a32c2d2c40ad8bfd1d53785411d4cdc67424ca`
- This work is isolated from PR #113 (market-picker / trading frontend).
- Do not merge, deploy, or modify production data from this workstream without explicit authorization.
- Do not change funds, deposits, withdrawals, matching, settlement, authentication, database RPCs, or production schema as part of structural refactoring. Any such change requires a separate impact report and approval.

## Initial source inventory (SOURCE OBSERVED)

### Current implementation shape

- Admin React entry: `frontend/src/features/admin/AdminPage.tsx` (1,357 lines at baseline).
- Admin API client: `frontend/src/lib/api.ts` (1,727 lines at baseline; shared with non-admin product features, so admin-only edits must be narrowly scoped).
- Admin API handler: `backend/api-core.js` (4,753 lines at baseline; admin routes are embedded in the shared API request handler).
- Authentication: `backend/admin-auth.js`.
- Permission policy: `backend/admin-rbac.js`.
- Seconds policy readiness guard: `backend/seconds-policy-readiness.js`.
- Admin translations: `frontend/src/lib/admin-i18n.ts`.

### Authentication and authorization observed

- Admin requests verify a Supabase bearer token against the Supabase Auth user endpoint.
- The canonical Auth user UUID is then used to load active administrator membership from the protected database RPC `admin_get_membership_v1`.
- The backend applies a closed permission catalogue through `hasAdminPermission`; Super Admin membership is separately recognized.
- Administrator membership management uses dedicated database RPCs and is Super Admin-only.
- Do not weaken or bypass this verification chain while reorganizing routes.

### Existing admin route surface observed

| Business area | Existing routes | Existing permission boundary |
|---|---|---|
| Session / admin identity | `GET /admin/session` | Verified active membership |
| Admin membership | `GET /admin/admins`, `POST /admin/admins/manage` | Super Admin only |
| Dashboard | `GET /admin/stats` | `dashboard.read` |
| User centre | `GET /admin/users`, `GET /admin/user`, `POST /admin/user/freeze`, `POST /admin/user/reset-pwd`, `POST /admin/user/reset-email` | `users.read`, `users.freeze`, `users.manage` |
| Balance adjustment | `POST /admin/user/balance` | `financial_adjustment.request` |
| KYC | `GET /admin/kyc`, `POST /admin/kyc/approve`, `POST /admin/kyc/reject` | `kyc.read`, `kyc.review` |
| Deposit review | `POST /admin/deposit/confirm` | `deposits.review` plus `deposits.read` |
| Withdrawal | `GET /admin/withdrawals`, `POST /admin/withdraw/approve`, `POST /admin/withdraw/reject`, `POST /admin/withdraw/mark-paid` | `withdrawals.read`, `withdrawals.review` |
| Orders | `GET /admin/orders` | `orders.read` |
| Support | `GET /admin/support/messages`, `POST /admin/support/read`, `POST /admin/support/reply` | `support.read`, `support.reply` |
| Help centre | `GET /admin/support/faq`, `POST /admin/support/faq`, `POST /admin/support/faq/delete` | `support.read`, `support.manage` |
| Audit | `GET /admin/audit-logs` | `financial_audit.read` |
| System configuration | `GET /admin/config`, `POST /admin/config`, `POST /admin/push` | `system_config.read/write`, `announcements.manage` |
| Deposit/payout addresses | `GET /admin/addresses`, `POST /admin/address/manage` | `payout_addresses.read_sensitive/manage` |
| Spot market configuration | `GET /admin/spot-markets`, `POST /admin/spot-markets` | `system_config.read/write` |
| Seconds contracts | `GET /admin/seconds-policy`, `POST /admin/seconds-policy`, `GET /admin/seconds-positions` | `seconds_policy.read/manage` |

The handler also contains a separate perpetual-market admin route group. It is not part of the first restructuring batch and must not be accidentally removed.

## Initial gaps to verify before proposing new functionality

These are inventory findings, not claims that a feature is impossible:

1. User list search visibly supports UID/email. Message-ID lookup and cross-conversation search have not yet been verified.
2. The current user/balance admin API exists, but the exact UI and audit semantics for a distinct manual debit workflow need verification. Do not implement debit by merely passing a negative credit amount.
3. The admin orders endpoint reads matching orders; a separate fills/trades workbench and its permissioned data source have not yet been verified.
4. The announcement write route exists; a dedicated announcement list/history workbench has not yet been verified.
5. Coin metadata/catalogue and chain/network configuration need to be distinguished from the existing spot-pair configuration and deposit-address settings.
6. Historical Seconds settlement records and their admin read-only view need verification. The existing open-position queue is explicitly read-only and must remain so.
7. Finance read paths can switch to canonical PostgreSQL sources under feature flags. Their source/completeness indicators and fail-closed behavior must be preserved.

## Target business navigation (proposed)

1. Overview
2. User Centre
3. Finance Centre — deposits, withdrawals, credit adjustments, debit adjustments as separate audited workflows
4. Spot Trading Centre — orders and, only when a verified source exists, trades/fills
5. Seconds Contract Centre — policy versions, open positions, settlement history (read-only unless a separately approved action exists)
6. Coin & Market Centre — asset metadata, networks, deposit/withdrawal availability, spot pairs
7. Customer Service Centre — conversation inbox, message ID / UID / email search, per-conversation history and replies
8. Records & Audit Centre — financial audit, administrator actions, relevant business records
9. System Management — administrator RBAC, announcements, global configuration

This is a navigation proposal, not an instruction to fabricate missing data or create new financial capabilities.

## Restructuring sequence

### Phase 1 — inventory and contract freeze
- Record current routes, permissions, request/response shapes, database RPC names, data-source flags, and existing tests.
- Identify shared frontend files and keep non-admin behavior untouched.
- No runtime behavior changes.

### Phase 2 — safe backend modularization
- Extract only pure route metadata / permission mapping / input normalization helpers first.
- Preserve route paths, HTTP methods, response shapes, error codes, authorization order, audit calls, and idempotency semantics.
- Keep the existing handler as the orchestration boundary until parity tests pass.
- Do not extract financial mutations or change SQL/RPC contracts in this phase.

### Phase 3 — business module organization
- Organize admin read-only handlers and service boundaries by business domain.
- Add route contract tests and authorization matrix tests before moving mutation handlers.
- Keep finance, matching, settlement, and identity operations frozen unless explicitly approved.

### Phase 4 — verification and handoff
- Run focused unit tests, admin API tests, frontend typecheck/build, and relevant security tests.
- Compare route/permission inventories before and after.
- Report exact changed files, commit SHA, test outcomes, and any NOT VERIFIED items.
- Open a separate draft PR only after the isolated branch has a reviewable, tested batch; do not attach this work to PR #113.

## Evidence labels

- SOURCE OBSERVED: directly read from the branch source.
- REPRODUCED: issue reproduced by executing a test or request.
- TEST PASSED: relevant automated check completed successfully.
- NOT VERIFIED: source or behavior has not yet been fully checked.

## First implementation gate

Before any code extraction, inspect the existing test layout and identify tests that cover:
- Admin Auth and membership loading
- RBAC permission catalogue and route matrix
- Admin route responses and error codes
- Financial audit outbox behavior
- Admin support reply/read idempotency
- Seconds policy versioning and open-position read-only behavior
- Spot market configuration contract

Do not proceed with a code move that lacks a reliable parity test for its affected boundary.
