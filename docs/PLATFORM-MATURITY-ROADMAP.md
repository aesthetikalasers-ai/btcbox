# BTCBOX Platform Maturity Roadmap

**Status:** Planning baseline  
**Baseline:** 525cc9d6c72140f3778ae295e46f1338482189cc  
**Execution branch:** docs/platform-maturity-roadmap  
**Production policy:** This roadmap does not authorize production deployment, merging, financial enablement, or real-fund operations.

## Product objective

Bring BTCBOX to a mature digital-asset platform standard: dependable behavior, clear and consistent visual design, robust security boundaries, accessible interactions, responsive performance, and predictable operation under failure.

Proceed incrementally with evidence. A visual redesign is never permission to rewrite financial, authentication, custody, or matching behavior.

## Non-negotiable principle: desktop and mobile are separate experiences

**Desktop and mobile are two deliberately designed interfaces, not one interface merely resized or rearranged by responsive CSS.**

- Build and maintain distinct desktop and mobile page compositions and navigation patterns.
- Use separate layout shells and, for complex workflows, distinct page compositions (for example, DesktopAppShell and MobileAppShell).
- A media query or viewport check may select the experience. It must not be the primary mechanism that transforms the desktop composition into the mobile composition.
- Never simply shrink desktop tables, charts, order forms, sidebars, or multi-column grids to fit a phone.
- Design mobile workflows intentionally for touch, limited width, safe areas, readable type, thumb reach, and focused tasks.
- Design desktop workflows to use available screen area effectively, with deliberate information density, persistent navigation, and multi-panel trading layouts where useful.
- Share domain logic, API clients, validation, permissions, data models, and design tokens where safe. Share visual components only when their interaction and information architecture genuinely work in both experiences.
- Do not fork business rules between desktop and mobile. Presentation may differ; financial calculations, validation, permissions, and server contracts must remain consistent.
- Define explicit tablet/intermediate-width behavior. Do not assume a tablet is merely a compressed desktop or enlarged phone.
- Preserve keyboard operation and screen-reader semantics on desktop; preserve touch target size and gesture alternatives on mobile.

### Layout acceptance matrix

Validate at minimum these CSS viewport widths and representative physical devices:
- Mobile: 320, 360, 375, 390, 430 px
- Tablet / compact landscape: 600, 768, 820, 1024 px
- Desktop: 1280, 1366, 1440, 1600, 1920 px

For every page and viewport, capture screenshots and verify:
- no unintended horizontal page scrolling, clipping, overlap, or hidden primary actions;
- no sticky/fixed element covering content, dialogs, charts, or navigation;
- readable typography, consistent spacing, and deliberate content density;
- chart containers have measurable non-zero dimensions before chart initialization and resize correctly;
- tables have a deliberate mobile representation (purpose-built cards, focused columns, or a dedicated detail view), never merely a squeezed desktop table;
- forms and critical actions remain visible, understandable, and reachable;
- loading, empty, stale, offline, error, and success states are designed for that layout;
- safe-area insets, keyboard appearance, orientation changes, and browser chrome are considered on mobile.

## Engineering principles

1. **Safety first:** financial capabilities remain fail-closed unless separately reviewed and explicitly authorized. Development and QA use simulated funds and isolated test accounts only.
2. **No blind replacement:** preserve verified production fixes. Review changes against the current production baseline and merge narrowly.
3. **Evidence over claims:** every task supplies a file-level diff, exact commands, exit codes, test output, screenshots where visual, and known limitations.
4. **Small batches:** one bounded scope per pull request; no unrelated cleanup bundled with functional changes.
5. **Rollback:** every production-bound change needs a documented rollback or mitigation plan.
6. **Accessibility and localization:** keyboard, focus, screen-reader, contrast, translated text expansion, and locale-specific formatting are acceptance requirements.
7. **Operational resilience:** handle timeouts, retries, cancellation, duplicate submissions, stale data, partial failures, and recovery explicitly.
8. **No secrets in source:** never commit credentials, tokens, private keys, real customer data, or production exports. Rotate exposed credentials through their issuing providers and verify revocation.

## Delivery phases and gates

### Phase 0 — Baseline and governance
- Record the current production commit, deployment identity, environment boundaries, and known verified fixes.
- Inventory routes, page components, API surfaces, feature flags, financial gates, and test suites.
- Establish a page/device screenshot baseline and defect register.
- Confirm secrets are absent from tracked files and build artifacts.
- Do not change production configuration or financial flags.

**Exit gate:** reproducible baseline, route inventory, test inventory, risk register, and verified no-secrets scan.

### Phase 1 — Security and platform foundations
- Review authentication/session lifecycle, authorization boundaries, rate limiting, CSRF/CORS policy, input validation, and error disclosure.
- Review Supabase RLS policies, service-role key boundaries, storage policies, and server-only secrets.
- Review dependency vulnerabilities, security headers, logging redaction, audit trails, backup and restore procedures.
- Verify financial feature flags default to disabled and deployment preflight rejects unsafe settings.
- Review exposed credentials; rotate/revoke affected credentials with the provider, verify old credentials fail, and inspect available access logs.

**Exit gate:** documented threat/risk findings, no unresolved critical/high issue in approved scope, and evidence financial paths remain fail-closed. Credential rotation is performed by the credential owner; never paste secrets into chat or source.

### Phase 2 — Design system and independent desktop/mobile foundations
- Inventory typography, color, spacing, radius, elevation, icon, motion, and component conventions.
- Define semantic design tokens and component states.
- Specify distinct desktop, mobile, and tablet information architecture.
- Define separate layout shells and page composition boundaries before page-by-page redesign.
- Define shared logic/component rules so presentation separation does not duplicate business behavior.
- Add visual regression baselines and viewport coverage.

**Exit gate:** approved design tokens, layout specifications, shell/component architecture, and visual test strategy. Do not redesign all pages before this gate.

### Phase 3 — Page-by-page experience stabilization
Work through routes in small batches:
1. Dashboard
2. Markets
3. Spot Trade
4. Contract
5. Assets (deposit, withdrawal, addresses, history)
6. Orders and trade history
7. Login, registration, account and security settings
8. KYC
9. Support and notifications
10. Admin

For every page:
- document desktop, mobile, and tablet user journeys separately;
- inspect existing behavior before changing it;
- fix layout defects without changing business semantics;
- provide designed loading, empty, error, stale, and success states;
- test localization, long text, number/currency formatting, keyboard, touch, and accessibility;
- preserve known production fixes and add regression tests.

**Exit gate:** page-specific acceptance checklist complete, screenshots attached, tests passing, and no unexplained regression.

### Phase 4 — Market data and chart reliability
- Verify provider source, freshness timestamps, stale-data handling, reconnect behavior, and rate limits.
- Verify chart lifecycle, container measurement, resize, symbol/timeframe changes, cancellation, and stale-response protection.
- Ensure unavailable data is never represented as a valid zero price or fabricated candle.
- Test network loss/recovery, tab visibility changes, and repeated navigation.

**Exit gate:** reproducible market-data and chart tests with explicit stale/offline behavior.

### Phase 5 — Trading, orders, and ledger correctness
- Map every order lifecycle and state transition.
- Verify server-side validation, idempotency, duplicate prevention, precision/rounding, partial fills, cancellation races, and auditability.
- Verify balances and ledger invariants transactionally; reconcile orders, fills, fees, and balances.
- Keep matching, order placement, settlement, and financial writes disabled in production until separately approved.
- Use simulated funds and isolated test infrastructure only.

**Exit gate:** independent domain review, deterministic integration tests, reconciliation evidence, and explicit authorization before any production financial activation.

### Phase 6 — Deposits, withdrawals, KYC, and administration
- Verify deposit intent/record creation, chain confirmation policy, manual review, and idempotent crediting.
- Verify withdrawal address controls, risk checks, approvals, limits, fee changes, and broadcast lifecycle.
- Verify KYC state transitions, least-privilege administration, dual control for sensitive actions, and immutable audit records.
- Never imply a workflow is implemented merely because a UI page exists.

**Exit gate:** end-to-end simulated workflow evidence, security review, and documented operational procedures.

### Phase 7 — Performance, compatibility, and resilience
- Measure Core Web Vitals and route-level performance on representative devices and networks.
- Test supported browsers, slow networks, offline/recovery, API degradation, and concurrent usage.
- Review polling frequency, request cancellation, caching, bundle size, chart performance, and memory leaks.
- Add monitoring, actionable alerts, structured logs, and privacy-safe diagnostics.

**Exit gate:** agreed performance budgets met or exceptions documented; failure and recovery tests pass.

### Phase 8 — Release readiness
- Full regression across desktop, mobile, tablet, locales, and supported browsers.
- Security review, dependency review, backup/restore drill, incident/runbook review.
- Verify production environment variables and financial gates independently.
- Prepare staged rollout, monitoring window, rollback procedure, and owner sign-off.
- Release only after explicit owner approval. This roadmap grants no deployment authority.

**Exit gate:** signed release checklist and explicit go/no-go decision.

## Required task handoff format

Every implementation batch must return:
1. Scope and acceptance criteria.
2. Baseline commit and working branch.
3. Exact files changed and why.
4. Diff summary; identify any shared business logic touched.
5. Commands run, exit codes, and relevant test output.
6. Desktop/mobile/tablet screenshots at stated viewport sizes for visual work.
7. Accessibility and localization checks.
8. Security/financial impact statement.
9. Known limitations and follow-up issues.
10. Rollback procedure.

## Independent review and change control

- Development AI implements and tests; the independent reviewer audits source, diffs, evidence, and risk.
- A developer's self-reported test result is not independent acceptance.
- No direct edits to production branch, no merge, and no deployment without explicit owner authorization.
- No production financial switch, real-money transaction, migration, or custody operation is authorized by routine UI work.
- Reviewer outcomes: **PASS**, **CONDITIONAL PASS** (with explicit blockers), or **REJECT**.
- A rejected batch returns to development with file-specific findings and must be re-reviewed after correction.

## Immediate next actions

1. Confirm the actual default/production branch head and deployment mapping; do not infer them from a prior report.
2. Capture a read-only inventory of routes, layout shells, breakpoints, page components, and current test commands.
3. Create a desktop/mobile/tablet layout audit matrix for every route.
4. Inspect the current LanguageMenu integration and verify whether the desktop sidebar renders a duplicate language selector; if confirmed, propose a narrowly scoped fix on a separate branch.
5. Start Phase 0 only. Do not begin broad redesign or financial implementation until the baseline and acceptance gates are documented.

## Definition of mature

BTCBOX is not mature merely because it builds or looks polished. It must demonstrate:
- distinct, purpose-designed desktop and mobile experiences;
- consistent behavior and accurate financial state across interfaces;
- secure authorization and fail-closed financial controls;
- truthful market-data freshness and robust chart lifecycle;
- reliable order/ledger invariants and auditable funds workflows;
- accessible, localized, performant interfaces;
- tested recovery, monitoring, backups, and rollback;
- independent review evidence for every material release.
