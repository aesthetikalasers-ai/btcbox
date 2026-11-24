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

## Phase 1 follow-up: route and test review (2026-11-24)

### Findings

1. **Perpetual admin route reachability — SOURCE OBSERVED, runtime NOT VERIFIED.** The handler contains a `sub.startsWith('perpetual/')` block with `market` POST, `liquidations` GET and `insurance` GET handlers. However, the common `requiredPermission(route, verb)` resolver returns `null` for these paths, and the handler returns `ADMIN_ROUTE_NOT_FOUND` before reaching the perpetual block. The route block appears unreachable through the current dispatcher. Do not simply add a broad permission mapping: the three routes have different risk profiles and need explicit least-privilege permissions, audit expectations, and a decision about whether the market mutation is in scope. No production request was made.
2. **Permission matrix test coverage is incomplete — SOURCE OBSERVED.** `backend/tests/admin-route-permissions.test.js` asserts several core routes but does not explicitly cover `POST /admin/withdraw/approve`, `POST /admin/withdraw/reject`, `POST /admin/withdraw/mark-paid`, `POST /admin/support/read`, or all FAQ methods. The resolver currently maps these routes, but the tests do not protect every mapping against regression.
3. **Perpetual routes are absent from the route permission contract test.** This aligns with the missing resolver mapping and means current tests do not catch the apparent unreachable-route condition.
4. **Test execution is pending.** Source and test files have been inspected, but the backend test suite has not yet been executed in this work session. No TEST PASSED claim is made.

### Files inspected in this pass

- `backend/api-core.js` — route dispatcher, permission resolver, admin route handlers.
- `backend/admin-auth.js` — Supabase identity verification and membership lookup.
- `backend/admin-rbac.js` — closed permission catalogue and permission evaluation.
- `backend/tests/admin-route-permissions.test.js` — explicit route permission assertions.
- `backend/tests/admin-api-contract.test.js` — API/frontend route contract and response behavior assertions.
- `backend/package.json` — backend test command is `npm test` (`node --test --test-reporter=spec tests/*.test.js`).

### Required next checks before implementation

- Add a complete route inventory test that enumerates every route/method, including support read receipts, all FAQ methods, all withdrawal actions, and perpetual routes.
- Decide whether the three perpetual routes should be restored, deliberately retired, or left inaccessible; obtain explicit owner approval before enabling the market mutation route.
- Run the backend test suite and relevant frontend typecheck/build in a disposable checkout or CI environment. Record the exact results.
- Do not change financial, matching, settlement, or perpetual mutation behavior as part of a pure route extraction.

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


## Perpetual contract and PR #113 coordination (2026-11-24)

- The owner has advised that the related perpetual/market-picker work tracked around PR #113 is actively being repaired. This admin workstream will not edit PR #113 or its branch.
- Treat #113 as an upstream integration dependency to inspect later: compare its eventual API expectations, market selection behavior, and supported contract modes against the backend contracts before connecting the admin UI.
- The current backend contains public/user perpetual endpoints under `/api/perpetual/*` and separate admin handlers under `/api/admin/perpetual/*`. They are different route surfaces and must not be conflated.
- The admin handlers currently present are:
  - `POST /api/admin/perpetual/market` — market configuration mutation; handler checks `system_config.write`.
  - `GET /api/admin/perpetual/liquidations` — read-only liquidation event query; handler checks `financial_audit.read`.
  - `GET /api/admin/perpetual/insurance` — read-only insurance account query; handler checks `financial_audit.read`.
- The shared admin route permission resolver does not currently map these three paths. Consequently the dispatcher returns `ADMIN_ROUTE_NOT_FOUND` before these inner handler checks. This is SOURCE OBSERVED; it has not been reproduced with a live request.
- They remain deliberately fail-closed. Do not expose them by adding mappings until the owner approves the exact route/permission policy and audit expectations. In particular, do not make the market mutation reachable as a side effect of UI restructuring.
- A regression test now asserts that these three admin endpoints remain unexposed while their handler code and inner permission checks remain present. This is a guardrail, not a claim that the endpoints are operational.

## CI execution boundary

- The existing backend CI did not include this isolated admin branch in its push trigger, so branch commits would not automatically run the backend build/test/preflight workflow.
- The workflow's push trigger has now been extended on this branch only to include `work/admin-backend-restructure-20261124`. No other branch trigger, PR #113 trigger, or production deployment configuration was changed.
- Verify the workflow run for the latest branch commit before claiming any tests passed.


## Follow-up module contract review (2026-11-24)

### SOURCE OBSERVED — user centre / finance boundary

- The current Users tab searches by UID or email. A separate message-ID search or cross-conversation message lookup is not present in the inspected AdminPage flow.
- The current user detail finance action is explicitly **Manual credit**. It requires a PostgreSQL ledger balance source, a verified receipt/transaction reference, an idempotency request ID, and both `deposits.review` and `deposits.read`.
- A separate backend `POST /admin/user/balance` route exists for signed balance adjustment / freeze / unfreeze through `admin_adjustment_atomic`, protected by `financial_adjustment.request`. The inspected AdminPage does not expose a distinct manual-debit workflow or API client wrapper for that route.
- Do not implement manual debit by sending a negative amount through the deposit-credit endpoint. A separate debit workflow needs its own operator reason, explicit target/amount confirmation, idempotency, ledger result, and audit trail. This is a funds-impacting feature and remains out of scope pending separate owner approval.
- The user details view currently displays the latest 20 deposit records, not an exhaustive deposit ledger. It correctly labels source and completeness and points staff to the audit log for wider history.

### SOURCE OBSERVED — customer support

- The current support inbox groups messages by UID and returns the most recent 100 messages per customer conversation.
- The inspected inbox has thread-level read marking and replies, but no search field for message ID, UID, or email inside the support module, and no dedicated global message-ID lookup across conversations.
- A future support workbench should add indexed/search-backed lookup rather than loading every retained message into the browser. Preserve the existing per-thread read cursor and reply idempotency.

### SOURCE OBSERVED — Seconds contracts

- The current admin API exposes the active policy and a read-only open-position queue. It does not expose a dedicated historical settlement/results endpoint in the inspected route map.
- The UI correctly describes the open-position queue as read-only and explicitly prevents staff from forcing a result or manually releasing frozen funds. Keep this boundary.
- A settlement-history view should be added only after the canonical settlement data source and its read permission are identified; do not infer settled outcomes from the open-position queue.

### SOURCE OBSERVED — asset catalogue vs market configuration

- The current Spot markets tab manages spot-pair trading rules. Deposit-address keys and the set of balance assets are separately hardcoded in the AdminPage.
- No independent admin API for coin metadata/catalogue and chain/network enablement was found in the inspected route map. Do not treat spot-pair configuration or deposit-address configuration as a complete coin/network management system.

### CI regression correction

- The first CI run for this branch completed the unified site build successfully, then failed one newly added source assertion because the test expected a single-route FAQ permission line while the actual resolver intentionally groups FAQ POST and FAQ delete under one shared `support.manage` condition.
- The source resolver itself was already correct; this was a test expectation mismatch, not a production-code defect. The assertion was corrected to match the grouped condition.
- A new CI run was triggered by commit `78ef2fc5316bd13616efb9b62fee1c175be4850a`. Its status must be checked before recording a passing result.

## Approved implementation update: manual debit (2026-11-24)

The operator workflow is intentionally minimal:

- Select the user in the User Centre; choose the asset and enter the debit amount.
- No operator-entered reason, note, dual approval, or extra review stage is required.
- The debit may take the user's available balance below zero.
- The browser retains the same request ID across an uncertain retry; the backend uses the existing atomic `admin_adjustment_atomic` operation.
- The system records administrator identity, subject UID, asset, signed delta, before/after ledger state, operation ID and timestamp through the financial operation / ledger / audit records. The audit reason is a fixed internal action marker (`admin_manual_debit`), not an operator field.

### Ledger boundary

- New migration: `backend/supabase/sql/0045_admin_manual_debit_negative_balance_v1.sql`.
- Only a marked manual-debit adjustment with a negative available delta and zero frozen delta may create a negative available balance.
- Other debit paths (withdrawal freeze/approval, earn subscription, and frozen-balance movements) retain their insufficient-funds checks.
- A confirmed deposit credit can increase an already-negative available balance, including a partial offset that remains below zero.
- The manual-debit UI is available only when the selected user's balance source is confirmed as `postgres_financial_ledger` and the administrator has the existing `financial_adjustment.request` permission plus balance-read access.
- The existing manual-credit flow remains separate and unchanged.
- The admin account-balance list reader now accepts finite negative `free` values from the ledger while continuing to reject negative frozen balances, so a negative debit result remains visible in the Admin user centre.


### Safety and rollout

- The migration is committed to this isolated branch only. It has **not** been applied to any Supabase database.
- No production deployment, production DB write, PR #113 modification, or merge has been performed.
- CI and database integration tests must validate this migration before any staging application. Production application requires a separate explicit authorization.

## Approved implementation update: support cross-conversation search (2026-11-24)

- The Support inbox now accepts a server-side search query for message ID, UID, username, or email.
- Exact message-ID matches return nearby conversation context; identity matches return the latest retained messages for the matching user.
- Search results are bounded to 500 messages, with at most 100 messages per selected conversation. The browser does not download every retained conversation to search locally.
- Message IDs and usernames are visible in the inbox. Existing read-cursor, unread-count, and reply actions remain in place; full-thread unanswered status is supplied by the backend so a narrow search result does not mislabel the conversation.
- Search remains within the existing `support.read` permission boundary. Reply still requires `support.reply`.
