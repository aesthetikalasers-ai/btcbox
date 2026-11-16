# BTCBOX End-to-End Execution Plan — 2026-11-16

> **Status:** Owner-directed execution plan. Read this document together with the top section of `docs/AI_COORDINATION.md` before making changes.
>
> **Authority:** The latest owner-approved decisions in `docs/AI_COORDINATION.md` take precedence if any historical note conflicts. This plan expands the delivery sequence and completion gates; it does not authorize production deployment, a merge to `main`, production financial operations, or changes to secrets/provider settings.

## 0. Mission and definition of done

Deliver a coherent BTCBOX customer experience and a connected Earn capability using the current `main` branch as the source baseline. Complete the work in controlled, reviewable stages, without replacing unrelated existing functionality.

The task is complete only when all of the following are true:

1. Visitors can open Sign in / Create account from the preview/application page in a modal, switch between them, close it without losing page context, and use the currently approved Email and Google authentication paths.
2. Existing account/session behavior, password recovery, email verification and OAuth callback handling remain functional; unrelated wallet/Web3 errors do not leak into authentication.
3. Earn customer UI, Admin configuration UI, backend endpoints, database configuration, wallet operations and ledger records use one agreed contract and represent the same real state.
4. Flexible/current earnings follow the owner-defined default-enrollment rule for qualifying held assets, without locking those assets or requiring a subscription.
5. Fixed-term earning is always opt-in, explicitly confirmed by the user, and provides the configured additional earning on top of applicable flexible/current earning.
6. No product rates, assets, terms, eligibility rules, balances, earnings or successful operations are fabricated or hardcoded where they belong to persisted configuration or live API responses.
7. Protected trading functionality and the existing BTCBOX visual language remain intact.
8. Required builds, focused automated tests, end-to-end checks and responsive visual checks pass, or every remaining gap is clearly identified as not verified and the owner explicitly accepts it.
9. A reproducible handoff records the exact branch, commit, changed files, test evidence, screenshots, known limitations and release boundary.

A green build alone is not completion. A mock screen alone is not completion. A database migration alone is not completion.

## 1. Roles, ownership and collaboration protocol

### Code/UI AI — application delivery owner

Responsible for:
- Customer authentication modal and route compatibility.
- Customer Earn page and its states.
- Admin Earn management surfaces within the existing Admin architecture and RBAC.
- Application-side HTTP/API integration, validation and error presentation.
- Frontend tests, responsive implementation, screenshots and application handoff.

### Database assistant — database and financial-integrity owner

Responsible for:
- Supabase schema/migrations and database-side Earn/wallet foundations.
- Database RPCs and their authorization/idempotency rules.
- Wallet account, operation and append-only ledger integrity.
- Database-side product configuration, accrual/settlement foundations and focused database validation.
- Documenting the exact request/response contract and migration dependencies for the Code/UI AI.

### Owner

The owner decides material product/business rules, final visual acceptance, merge to `main`, production deployment and any real-money/production operation.

### Coordination rules

- One owner per file. Do not concurrently edit the same application or migration file.
- Before integration, publish the API contract: endpoint/method, authenticated identity source, request schema, response schema, error codes, idempotency behavior and permission requirement.
- If a contract changes, update the shared contract first and notify the other owner before changing consumers.
- Use separate task branches created from the latest `main`; do not base new work on stale historical integration branches without comparison.
- Keep commits small and task-scoped. Do not mix auth, Earn, unrelated cleanup and trading changes in one commit.
- The owner previews locally. Do not reset, overwrite or interfere with the owner's working tree or another AI's workspace.
- Never claim an item is implemented, tested, live or deployed without corresponding evidence.

## 2. Phase 0 — baseline and scope lock

**Purpose:** Confirm the exact current source and avoid building against historical assumptions.

Tasks:
1. Fetch the latest `main` HEAD and record its full SHA and timestamp.
2. Read the current auth entry points, OAuth callback/session restoration, existing Earn page/API/catalog/positions/subscription flow, Admin navigation/RBAC, wallet APIs and relevant database migrations.
3. Identify the active frontend and backend build roots from current configuration. Do not assume a historical README or old branch is authoritative.
4. Map existing routes, files and handlers to be reused. Identify duplicate/legacy implementations only where they affect this task.
5. Record protected files and agree on file ownership before implementation.
6. Record the current baseline build/test status so pre-existing failures are not attributed to this work.

Deliverables:
- Baseline commit SHA.
- Short source map: existing feature → source file/API/table.
- Task branch names and file ownership.
- List of pre-existing failures or unverified paths.

**Exit gate:** The team can identify the exact implementation points and knows which existing code must be extended rather than duplicated. No broad cleanup or unrelated refactor is needed to proceed.

## 3. Phase 1 — authentication modal

**Priority:** First user-facing implementation.

### Required behavior
1. Top-bar Sign in opens the login state in a modal on the preview/application page.
2. Create account opens the registration state in the same modal system.
3. Login and registration can switch without a full-page navigation or reload.
4. Closing the modal returns to the same underlying page and preserves its context.
5. Existing Supabase Email/password and Google methods remain supported.
6. Password recovery, email verification, invalid credentials, already-registered, loading, success and failure states are covered.
7. Google OAuth may leave for provider authorization, but callback must restore the session and return to the correct application context.
8. Legacy `/login` and `/register` links remain compatible by opening the matching modal state or routing safely into the same flow; they must not render the old standalone full-screen customer auth experience.
9. Ordinary email/Google auth must not trigger unrelated wallet-connect/Web3 calls or show errors such as `eth_requestAccounts` missing/invalid.
10. Customer-facing errors must be understandable and localized; raw stack traces, SQL details, secrets and provider internals must not be exposed.

### Constraints
- Do not rewrite Supabase Auth.
- Do not change Auth providers, redirect settings, keys or secrets as a shortcut.
- Do not enable Google-only registration. Verify the backend/config path, including `GOOGLE_ONLY_AUTH`, against the approved Email + Google behavior.
- Keep OAuth callback routes/handlers functional even though standalone login/register screens are removed from the customer journey.
- Modal must support keyboard focus, Escape/close behavior, focus return, scroll locking and mobile-safe sizing.

### Tests and evidence
- Email registration and sign-in with isolated test identities.
- Already-registered, invalid password, unverified email and password-recovery cases.
- Google OAuth redirect/callback/session restoration in a permitted non-production test environment.
- Modal open/switch/close, preserved page context, direct legacy URL behavior.
- No Web3 wallet error during Email/Google auth.
- Desktop and mobile screenshots.

**Exit gate:** Real provider flow is verified in an isolated environment, or the exact provider-dependent portion is labelled NOT VERIFIED. UI-only mocks do not satisfy auth acceptance.

## 4. Phase 2 — Earn data contract and database readiness

**Purpose:** Make the database and application agree before building financial UI behavior.

### Business rules (fixed by owner)
- Qualifying held assets default into flexible/current earnings according to persisted product configuration.
- Flexible/current earning requires no separate user application and does not lock the user's assets.
- Fixed-term products require the user's explicit selection of product, asset, amount and term, followed by explicit confirmation.
- Fixed-term earning is additional to applicable flexible/current earning under the configured rules.
- Rates, supported assets, eligibility, terms, calculation cadence, product status and payout settings are configuration, not hardcoded application assumptions.
- Do not add new business rules, restrictions, fees, rate promises or guaranteed-return language without owner approval.

### Contract work
Agree and document:
- Product catalog fields and product state.
- Supported asset and term configuration.
- Flexible/current eligibility and accrual representation.
- Fixed-term subscription request and confirmation.
- User positions, principal, available/locked amounts, accrued earnings, maturity and payout history.
- Admin create/update/enable/disable operations and permission requirements.
- Error codes, validation rules, decimal precision and idempotency keys.
- Ownership: derive user identity from the verified server-side session/token; never trust a client-supplied user ID as authorization.

### Database integrity
- Extend existing Earn tables/RPCs where appropriate; do not create a competing parallel Earn system.
- Replace hardcoded product-ID-to-asset assumptions within the approved Earn scope with persisted configuration.
- Enforce server-side eligibility, supported asset, amount, term and product-state validation.
- Make subscription, accrual and settlement operations atomic and idempotent.
- Maintain an auditable append-only financial ledger; do not directly edit a displayed balance or create profit by inserting arbitrary values.
- Keep wallet available balance, reserved/locked amount, principal, earnings and payout state consistent.
- Restrict privileged database operations to the server/service role. Never expose service-role credentials to the browser.
- Use isolated test fixtures and rollback-safe test procedures. No production financial posting.

Deliverables:
- Versioned API contract.
- Migration/RPC list and dependency order.
- Database-side tests for authorization, invalid input, duplicate requests, insufficient funds, product configuration changes and ledger consistency.
- Explicit list of what is real, simulated for test only, and not yet connected.

**Exit gate:** Contract is approved by both implementers; database operations are safely callable by the backend; financial invariants and idempotency are tested in an isolated environment.

## 5. Phase 3 — Admin Earn configuration

Implement inside the existing Admin navigation, authorization and visual language.

Required capabilities:
1. View configured Earn products and their current status.
2. Create/edit product configuration using only owner-approved fields.
3. Configure supported assets, terms, rates, eligibility, calculation and payout parameters where supported by the database contract.
4. Enable/disable products with clear confirmation and audit provenance.
5. View user participation/positions and relevant principal, lock, accrual, maturity and payout status.
6. View operational history and failures without exposing secrets or unnecessary sensitive user data.
7. Respect existing RBAC; do not invent a new administrator role or bypass permission checks.

Rules:
- Every displayed or editable field must map to persisted configuration.
- No frontend-only configuration that appears saved but is not persisted.
- No silent modification of existing product data.
- Validate inputs on both server and client; server is authoritative.
- Destructive or financially material changes require explicit confirmation and appropriate authorization.

Tests:
- Unauthorized admin cannot read or mutate configuration.
- Authorized admin can create/update/enable/disable a test product.
- Invalid rate/term/asset/configuration is rejected server-side.
- Changes are reflected in customer catalog from the same source of truth.
- Audit history identifies actor, action, target and timestamp.

**Exit gate:** Admin configuration persists, is permission-protected, audited and drives the customer-facing catalog.

## 6. Phase 4 — customer Earn experience

Extend the existing Earn route/page and data flow; do not build a second product surface.

Required sections:
1. Flexible/current earnings overview and eligibility status.
2. Configured fixed-term product catalog.
3. Explicit fixed-term application flow showing product, asset, amount, term and all relevant configured conditions before confirmation.
4. User's actual active positions/participations.
5. Principal, available/locked amount, accrued earnings, maturity and payout status where applicable.
6. Actual earnings and wallet transaction history.
7. Clear empty, loading, unavailable, validation and error states.

Rules:
- Flexible/current default eligibility must not be presented as a user subscription.
- Fixed-term subscription must never occur merely by opening a product or page.
- Do not optimistically show a successful subscription or payout before server confirmation.
- Display real API/database values only. If an endpoint is not ready, show a clearly unavailable/not-connected state rather than fabricated values.
- Use exact decimal-safe representations for asset amounts and rates; do not use floating-point arithmetic for financial decisions.
- Localize labels, numbers, dates and errors consistently with the existing customer language system.

Tests:
- Eligible and ineligible asset states from test fixtures/configuration.
- Flexible/current view does not lock or reserve the user's funds.
- Fixed-term requires explicit confirmation and rejects invalid amount/term.
- Refresh/reopen shows server-persisted position state.
- Duplicate submit does not create duplicate positions.
- Failed API requests never display a false success or fabricated balance.

**Exit gate:** Customer UI is driven by persisted configuration and server responses, with no mock financial values in customer-visible states.

## 7. Phase 5 — end-to-end wallet and Earn integration

Test the complete controlled lifecycle using isolated test identities and non-production fixtures:

1. Authenticated test user is resolved server-side.
2. Wallet account and supported asset state are loaded from the real test backend.
3. Qualifying held asset is evaluated against configured flexible/current rules.
4. Flexible/current accrual is recorded according to the configured calculation policy without locking the held asset.
5. User explicitly chooses a fixed-term product, asset, amount and term.
6. Server validates configuration, user, amount, available balance and product status.
7. Fixed-term subscription and corresponding wallet/ledger state change occur atomically.
8. Position and wallet UI refresh from confirmed server state.
9. Accrual and maturity/settlement are processed idempotently.
10. Payout/release appears in wallet state and transaction history.
11. Admin views show the same persisted position and operation history.
12. Repeated requests, retries, interrupted requests and duplicate settlement attempts do not double-charge, double-credit or duplicate positions.

Required reconciliation:
- Sum of ledger movements reconciles to wallet balances under the defined ledger model.
- Locked/reserved amounts reconcile to active fixed-term positions.
- Earn accrual and payout entries reconcile to position history.
- Admin and customer views reference the same underlying records.
- All financial operations have stable IDs/correlation IDs and auditable timestamps.

**Exit gate:** The complete test lifecycle passes with isolated test data and ledger reconciliation evidence. No real user funds or production posting are used.

## 8. Phase 6 — regression, visual and security acceptance

### Protected regression scope
Run focused regression for:
- Spot, Perpetual and Seconds entry points.
- Existing chart/market data and stale/unavailable states.
- Order book, order entry, order placement/cancel UI paths as safe test/read-only checks.
- Wallet balance loading and existing asset/account screens.
- Existing Admin authentication, navigation and permission gates.
- Existing customer language selection and localization.
- OAuth callback and session restoration.

Do not place real orders, submit real deposits/withdrawals or perform production financial actions.

### Responsive visual acceptance
Test exact widths:
- 375, 390, 430, 768, 1366, 1440 and 1920 px.
- Also inspect continuous resizing between breakpoints, not only the listed snapshots.

For each affected page verify:
- Mobile and desktop layouts independently.
- No horizontal overflow, clipped text, overlapping controls or hidden critical actions.
- Consistent spacing, card proportions, typography, buttons, borders and modal behavior.
- Touch targets and keyboard/focus behavior.
- Loading, empty, unavailable, error and success states.
- Localization and long translated strings.

Keep the current BTCBOX brand and design language. Improve consistency and finish; do not introduce an unrelated new visual theme.

### Security and privacy checks
- No service-role key, database password, OAuth secret, private key or other secret in browser bundles, logs, screenshots or commits.
- No client-supplied user ID used as an authorization boundary.
- Admin routes and mutation APIs enforce server-side permissions.
- User financial records are scoped to the authenticated user.
- Error messages do not disclose SQL, stack traces, internal paths or credentials.
- No unauthorised private-key capture, plaintext secret storage or wallet signing behavior is introduced by this task.

### Test evidence
Record exact command, result, commit SHA and environment for:
- Frontend lint/typecheck/build.
- Backend tests/build.
- Database migration/RPC tests.
- Auth flow tests.
- API contract and Earn lifecycle tests.
- Responsive/browser E2E tests.
- Screenshot set for each changed page.

Classify each result:
- **PASS** — executed on the exact delivered commit and passed.
- **NEEDS FIX** — executed and failed or revealed a defect.
- **NOT VERIFIED** — not executed or depends on unavailable external/provider environment.

Do not convert NOT VERIFIED into PASS based on source inspection.

**Exit gate:** No unresolved critical/high-severity issue in the changed scope; protected regression passes; responsive evidence exists; any external-provider limitation is disclosed.

## 9. Phase 7 — final handoff and owner acceptance

The Code/UI AI must deliver:
1. Task branch name and exact final commit SHA.
2. Base `main` SHA used.
3. Complete changed-file list grouped by feature.
4. Summary of behavior changed and behavior intentionally preserved.
5. API contract version and endpoint list.
6. Migration/RPC dependencies (database assistant supplies the database-side record).
7. Exact build/test commands and results.
8. Auth provider verification status.
9. Earn lifecycle and ledger reconciliation evidence.
10. Screenshots at required widths.
11. Known issues, deferred work and NOT VERIFIED items.
12. Confirmation that no main merge, production deployment or real financial operation occurred.

Owner acceptance checklist:
- [ ] Login/register modal matches the approved guest-first flow.
- [ ] Email and Google authentication work in the permitted test environment.
- [ ] Password recovery, email verification and failure states are handled.
- [ ] Earn flexible/current default behavior matches the owner's rules.
- [ ] Fixed-term enrollment is explicit opt-in and provides configured additional earning.
- [ ] Admin configuration drives the customer catalog.
- [ ] Wallet balances, locks, earnings and payouts reconcile with the ledger.
- [ ] No fabricated financial data or hardcoded product business rules.
- [ ] Protected trading behavior remains intact.
- [ ] Mobile, desktop and continuous responsive acceptance pass.
- [ ] Localization and notification states pass.
- [ ] Security and permission checks pass.
- [ ] Exact source, test evidence and outstanding limitations are delivered.

**Release boundary:** After owner acceptance, stop and request the owner's explicit decision. Do not merge to `main`, enable production deployment, change production environment settings, or execute production financial operations without separate explicit authorization.

## 10. Execution board — update continuously

Keep this compact board current as work progresses. Do not mark a phase complete without linking its evidence.

| Phase | Owner | Status at plan creation | Completion evidence |
|---|---|---|---|
| 0. Baseline and scope lock | Code/UI AI + database assistant | NOT STARTED / refresh against latest main | Base SHA, source map, branch/file ownership |
| 1. Auth modal | Code/UI AI | NOT STARTED | Auth flow tests, modal E2E, screenshots |
| 2. Earn contract/database readiness | Database assistant + Code/UI AI | NOT STARTED | Contract, migration/RPC tests, invariants |
| 3. Admin Earn configuration | Code/UI AI | NOT STARTED | RBAC, persistence and audit tests |
| 4. Customer Earn experience | Code/UI AI | NOT STARTED | API-backed UI tests and screenshots |
| 5. Wallet/Earn end-to-end | Both owners | NOT STARTED | Lifecycle and ledger reconciliation |
| 6. Regression/visual/security | Code/UI AI + database assistant | NOT STARTED | Exact-SHA test matrix and evidence |
| 7. Handoff/owner acceptance | Code/UI AI; owner approves | NOT STARTED | Complete handoff and owner checklist |

Update status only when evidence exists. If work is blocked, record the blocking dependency, responsible owner and next concrete action. Do not silently skip a phase.
