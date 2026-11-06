# BTCBOX — recovered work and integration status (2026-11-06)

## Source of truth

- Final product target: `avali9308-code/btcboxcdt`.
- V33 remains a separate source/reference repository: `avali9308-code/btcbox-v33`. Do not delete it until final acceptance.
- Current main baseline: `cdd626bae94a44cd665c2861ae9870c3cf86e8b1`.
- The following integration work is already in main:
  - PR #26 — React runtime/customer baseline and recovered UI/business contracts; merge `59e00770635808c5a3d7026932096d279e391a58`.
  - PR #28 — admin RBAC foundations and concurrent Seconds positions; merge `3ec255d9f86097959932592471f539be346d6221`.
  - PR #29 — removed obsolete one-open-position artifacts/rule; merge `5fdb657bebfdf510af0523bc86250f11af33c797`.
  - PR #30 — corrected Supabase admin membership validation and added tests; merge `73a979fcc1470eb72cda72ad99e2ec6c74c254c1`.
  - PR #31 — fixed isolated auth route test module resolution; merge `cdd626bae94a44cd665c2861ae9870c3cf86e8b1`.
- Current follow-up branch: `integration/btcbox-complete-final-v2-20261106`, based on the latest main and currently 10 commits ahead / 0 behind at the last compare.

## Work already merged into main

### Frontend and visual system
- React 19 + Vite + TypeScript customer runtime and route structure.
- BTCBOX styling adapted from Strata Pro and Shadcn Fintech design references.
- API-driven market and chart data; fabricated market rows and random chart fallbacks removed.
- Market filtering/search and mobile chart touch controls.
- Authenticated Orders and Assets pages with loading, empty, unauthenticated and error states.
- Supabase Email/Google auth, password recovery, linked identities, 2FA foundations and account setup.
- Customer pages for seconds positions/history, deposit address lookup, saved withdrawal addresses, Earn, KYC and support.

### Backend and business rules
- Multiple concurrent unfinished Seconds positions; obsolete single-open-position partial unique artifacts removed from source.
- Seconds request/settlement idempotency and versioned policy schema foundations retained.
- Admin RBAC membership schema and Supabase membership validation helpers.
- Manual payout SQL/API foundation: approved withdrawals can be marked paid only after staff manually transfer funds; TxID/reference is mandatory, same-reference retries are idempotent, conflicting references are rejected, and no blockchain broadcast or second debit occurs.
- The live database still has migration-history drift and the hosted policy/payout schema is not assumed active.

## Follow-up branch contents

- Admin API requires verified Supabase Auth bearer tokens and active administrator membership; shared Basic Auth fallback is removed.
- Admin routes use route-specific permissions. The admin session endpoint returns the verified admin UUID, active status, Super Admin flag and permissions.
- Legacy admin entry uses Supabase email/Google sign-in and skips customer-account exchange on the admin path.
- New React `/admin` console: Overview, Users/manual credit, Deposit addresses, Withdrawals/manual payout, KYC, Audit, Orders and Support.
- Admin API client uses the Supabase bearer token. Manual credit binds UID and coin to the selected user and asset row; no user-created pending deposit order.
- Customer withdrawal form selects an eligible saved address, derives asset/network from it, requires fund password and 2FA when enabled, and retains the same request ID after uncertain network results.
- Withdrawal availability is reported by a backend fail-closed endpoint; user submission stays disabled until financial cutover is enabled.
- The old admin console's deposit-review queue is replaced with the simple configured-address → staff verify → selected user/asset row → manual credit workflow.
- Admin withdrawal console displays pending/review/approved requests; approved withdrawals require staff to enter the actual transfer TxID/reference before marking paid.

## Business constraints preserved

- Deposits: configure receiving address/network; user transfers; staff verifies actual receipt and manually credits. No chain watcher, automatic credit or user-created pending deposit order.
- Withdrawals: staff review and manual transfer; TxID/reference required to record completion. No automatic broadcast.
- Seconds: allow multiple unfinished positions. Admin/backend policy controls enabled state, allowed durations, amount boundaries and payout ratio; 85% is the configurable minimum, not the only fixed value.
- Protect the existing trading-page layout from unrelated redesign.
- No production DB write, destructive reset, financial cutover enablement, production deployment or V33 deletion was performed or authorized by this integration work.

## Verification

- Earlier merged baseline snapshot `84f11a11bff5e45a4bb6049b5177bad2f41dcdcf`: frontend TypeScript/Vite build passed; backend unified build passed; Node regression tests passed 281/281.
- The current follow-up branch includes further admin/auth/withdrawal changes; its CI must be checked at the exact latest SHA before calling it green.
- No browser QA, isolated PostgreSQL execution of the complete migration chain, Supabase admin-member bootstrap or live financial workflow test has been performed.
- Production Supabase remains read-only in this work. Existing migration history does not match the repository's current migration files; do not run `db push`, `migration repair`, `db reset`, or apply migrations until provenance is reconciled and the user explicitly approves.
- React Seconds order submission/settlement and administrator policy authoring/activation are not yet complete end-to-end. The current React Seconds page remains read-only.
- Spot order-entry remains a scaffold.
- Customer address-book creation UI is not yet present; withdrawal currently uses already-saved eligible addresses.
- React admin source is integrated but has not passed browser QA. Admin membership-management UI and first Super Admin provisioning remain incomplete.
- Strata Pro and Shadcn Fintech are Git submodule pins to full upstream repositories, not vendored copies inside the BTCBOX runtime. Their design language has been adapted; not every upstream page has been copied.
- Figma connected seat was View-only; no editable design-file key was available. No OpenAI Platform connector was available in this session.
- Vercel previously returned `build-rate-limit`; this is not a successful deployment.
- No merge or deployment is requested by this document. V33 remains intact until target acceptance is complete.
