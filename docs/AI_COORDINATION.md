# BTCBOX AI Coordination

Last refreshed: 2026-11-05 (UTC+8)
Repository: `avali9308-code/btcboxcdt`
Coordination branch: `chore/shared-ai-coordination`
Observed baseline: `main` at/including merge commit `93a236e4a3ed6c9edd2003ac1068a89161015511` (PR #20, read-only account/orders API).

## Roles and boundaries

- AI 1 — Implementation: owns implementation work on its assigned feature/fix branches and opens PRs.
- AI 2 — Independent QA: reviews diffs, tests, responsive behavior, API contracts, and reports evidence; does not silently take over implementation ownership.
- AI 3 — Integration and coordination: maintains this document, audits repository/PR/CI state, maps dependencies and risks, coordinates batches, and does not modify other teams' owned code without explicit approval.
- The user is the final approver for merges, production deployment, destructive operations, and material business-rule changes.

## Mandatory operating rules

1. Read this file before each work batch and update it when decisions or evidence change.
2. Work on dedicated branches; do not push directly to `main`.
3. Do not merge or deploy based only on a green-looking UI or an AI assertion. Record exact head SHA, diff scope, CI/test evidence, and independent QA result.
4. Preserve existing production data, database schema/configuration, secrets, and financial records. No database reset, bulk deletion, or production write tests.
5. No real deposits, withdrawals, order placement, matching, or financial posting during QA. Use read-only paths or isolated test fixtures.
6. Keep frontend/backend API contracts explicit. Never fabricate market prices, balances, order history, or chart candles.
7. Reuse mature, license-compatible components and assets where practical; retain required license/attribution notices.
8. Prioritize mobile usability and accessible touch targets, but do not change core trading behavior or layout without explicit approval.
9. Keep deployment automation paused until the user authorizes release readiness.
10. Classify findings as SOURCE OBSERVED, REPRODUCED, TEST PASSED, or NOT VERIFIED.

## Repository observations at refresh

- The previously designated coordination branch was absent from the branch listing; this branch has now been recreated from `main`.
- The prior `docs/AI_COORDINATION.md` was not present on `main` or the inspected UI feature branch, so this file restores the coordination entry point from established project rules and current verifiable repository state.
- Latest commit found in repository commit search: `93a236e4a3ed6c9edd2003ac1068a89161015511`, merge of PR #20 (`feat/read-only-account-orders-20261105`).
- PR #20 adds authenticated read-only account/orders functions in `frontend/src/lib/api.ts`; the diff alone does not prove live API connectivity or end-to-end account hydration.
- Root `README.md` describes an English-only, mock-data CRA frontend and lists known mock-only limitations. Root `package.json` also defines a CRA frontend. This documentation must be reconciled against the actual deployed app and current `frontend/` tree before treating it as authoritative.
- Branch inventory observed: `audit/admin-launch-readiness-20261104`, `feat/btcbox-brand-assets-20261104`, `feat/btcbox-mature-ui-foundation-20261105`, `feat/btcbox-ui-i18n-mobile-20261105`, `feat/read-only-account-orders-20261105`, `feature/btcbox-react-frontend-20261104`, `fix/backend-launch-readiness-20261104`, `fix/btcbox-button-hierarchy-mobile-20261105`, `fix/btcbox-i18n-completeness-20261105`, `fix/btcbox-live-chart-no-fake-data-20261105`, `fix/i18n-remove-duplicate-dictionary-keys-20261105`, `fix/mobile-sidebar-close-touch-target-20261105`, `fix/production-launch-page-audit-20261105`, `integration/admin-fixes-on-strata-20261104`, `integration/frontend-backend-contract-map-20261104`, `integration/frontend-market-api-20261104`, `integration/repo-reconciliation-20261104`, `integration/restore-btcbox-admin-20261104`, `integration/strata-unified-build-20261104`, `main`.

## Batch execution queue

### Batch A — establish source of truth (current)
- Inspect root and frontend package manifests, app entry points, route maps, build/test scripts, workflows, and deployment configuration.
- Compare the merged `main` tree with active feature branches and open PRs; identify duplicate or superseded fixes.
- Reconcile README claims with actual source and API behavior.
- Check CI and deployment automation state; do not trigger production deployment.

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
- Run install/build/lint/unit/integration checks and report exact results.
- Independent QA must review each PR head SHA before any merge request is approved.

## Evidence ledger

- SOURCE OBSERVED: branch search showed the coordination branch missing before it was recreated; current repository branch inventory is recorded above.
- SOURCE OBSERVED: root README describes mock-only frontend limitations; root package manifest uses CRA scripts.
- SOURCE OBSERVED: commit `93a236e4a3ed6c9edd2003ac1068a89161015511` adds read-only account/orders client functions.
- NOT VERIFIED: production API connectivity, account/order end-to-end behavior, mobile visual correctness, complete localization, current CI state, and Vercel deployment state.
