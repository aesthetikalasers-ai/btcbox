# BTCBOXCDT — Open Issues & Owner Handoff (2026-11-04, updated 2026-11-07)

> This file was referenced in the collaboration instructions but did not exist in
> the repository at handoff time. It is created here to record the current state
> and exact continuation point.

## Current branch & git state
- Branch: `work/btcbox-unified-20261104` (tracks `origin/work/btcbox-unified-20261104`).
- Handoff commits verified in history: `e0b192f5749f30934257bb69966dc114bf7b9cc7` (admin finance projection code), `d8539d2ed66370f7ce0fffadcc48d6fa98dbd5b9` (doc commit, was HEAD at start).
- Code commits added in this session (oldest → newest):
  1. `4e5e5685832a158a81cd8a34e181335355fd65e9` — fix(kyc): unify in-review status aliases
  2. `e423b4afbe6827ef7bb05c0555b57614070471ee` — fix(orders): align customer/admin order projections
  3. `88e39bf559be428394c26161d27fa27b8799453a` — test(admin): fund-operation audit/idempotency invariants
  4. `e6c7d933358992b1874be425fbe7ec5c500c894a` — fix(admin): broadcast push idempotency by request_id
  5. `dd98b5470f66952976e512bbb3e894e79fe87836` — test(admin): API contract invariants
  - Plus this documentation commit (see git log).
- Working tree: clean (no uncommitted changes) after the doc commit.
- PRs: #51, #52, #53 were found closed and could not be reopened; fresh draft PRs
  were opened to trigger CI. Backend CI was also triggered via `workflow_dispatch`
  on the work branch as a reliable fallback.

## Tests passed / not passed
- Backend `node --test tests/*.test.js`: 393 tests, 392 pass. The single failure is
  `build-site.js publishes the React root...` — a pre-existing environment issue
  requiring a frontend build artifact (`frontend/dist`), unrelated to these changes.
- Frontend: `tsc --noEmit` (lint script) passes locally. Frontend CI was
  path-filter-skipped on GitHub because no `frontend/**` file changed.
- PostgreSQL schema CI: path-filter-skipped because no `backend/supabase/sql/**`
  file changed. Parent baseline green.
- CI-skip clarification (verified 2026-11-07): `frontend-ci.yml` and
  `btcbox-postgres-schema-ci.yml` have no `workflow_dispatch` trigger, and their
  `push` branch whitelists do not include `work/btcbox-unified-20261104`. On a
  pull_request they are additionally gated by `paths` (`frontend/**` and
  `backend/supabase/sql/**` respectively). Since this batch changes zero frontend
  and zero SQL files, both suites are correctly skipped — no source change was
  fabricated to force them. If a future batch touches either path, both will
  trigger automatically on the PR.
- Collaboration PR: Draft **#54** (open) `work/btcbox-unified-20261104` →
  `fix/post-merge-db-bootstrap-seconds-20261106`. PRs #51/#52/#53 were found
  closed and unreopenable. Do not merge or deploy.
- Verified backend CI runs (exact SHA): 42297056648 (4e5e568), 42297955945 (e423b4a),
  42298110345 (88e39bf). Later commits (e6c7d93, dd98b54) were triggered via
  workflow_dispatch; check `actions/workflows/backend-ci.yml` runs for the final SHA.

## Unresolved / owner-policy items (do not invent)
- KYC document retention/deletion after approval/rejection: no retention period,
  no automatic deletion. Blocked on owner's explicit privacy/legal policy.
- Withdrawal approve carries a hardcoded reason (no admin-supplied reason field);
  intentionally left to avoid API contract change — owner may decide to add one.
- Direct administrator balance adjustment (`POST /api/admin/user/balance`) remains
  disabled pending a maker-checker / dual-approval queue.
- PR #51/#52/#53 are closed/unreopenable; a future operator should open a fresh
  draft PR against `fix/post-merge-db-bootstrap-seconds-20261106` (or `main`) if
  CI-on-PR is desired, or rely on `workflow_dispatch`.

## Exact continuation point for the next AI
- Start from `work/btcbox-unified-20261104` HEAD (doc commit after `dd98b54`).
- Files last modified: `backend/api-core.js`, `backend/tests/kyc-flow.test.js`,
  `backend/tests/account-credentials.test.js`, `backend/tests/order-history-source-parity.test.js`,
  `backend/tests/admin-fund-ops-audit.test.js` (new), `backend/tests/admin-support-idempotency.test.js` (new),
  `backend/tests/admin-api-contract.test.js` (new), `docs/AI_COORDINATION.md`, this file.
- Suggested next work: (a) if frontend/SQL changes are made, run frontend-ci and
  PostgreSQL CI on the exact SHA; (b) consider adding admin-supplied reason to
  withdrawal approve if the owner wants it; (c) continue hosted Supabase Auth/Storage
  workflow testing only in isolated staging with test credentials.
- No uncommitted modifications expected. If `git status` shows `backend/dist/`,
  remove it (build artifact, not tracked).

## Authentication contract correction — 2026-11-07

Owner-confirmed required methods: BTCBOX username/password login, Google OAuth, and wallet login (Ethereum/Solana Web3). Email registration, email/password login, and email OTP/recovery are not required.

Implementation batch on this branch:
- frontend/src/features/auth/AuthPages.tsx: login UI now includes username/password, Google, Ethereum wallet and Solana wallet. Registration uses Google or wallet identity; first-time identities are routed to Account Setup to create BTCBOX username/password.
- frontend/src/lib/auth.tsx: removed React email/password sign-in, email registration, and email reset/recovery methods. Retained username credentials and Google/Web3 auth flows.
- backend/api-core.js: Supabase identity allowlist now accepts only single-provider Google or Web3 identities; email provider identities are rejected.
- frontend/e2e/auth-routes.spec.ts: browser assertions now cover the requested entry points and absence of email forms.
- backend/tests/account-credentials.test.js: verifies Google/Web3 allowed and email/multi-provider identities rejected.
- backend/tests/google-only-auth.test.js: replaced stale Google-only React UI assertion with the owner-approved three-method contract.

Backend username authentication already uses PBKDF2-HMAC-SHA256 (600,000 iterations), strict username/password validation, IP/username rate limits, frozen-account checks and optional 2FA. Web3 identity verification is handled by Supabase Auth and checked server-side against the verified identity; Ethereum/Solana wallet addresses are validated and duplicate wallet ownership is rejected.

Important: source-level implementation is not proof of live Supabase provider configuration or successful real wallet signatures. Isolated E2E/runtime auth verification remains outstanding. No production auth settings, database, merge or deployment was changed.
## Authentication batch verification update — 2026-11-07

- Frontend CI run 42314537379 passed on source SHA 80731237b1f58d5097563521a9524e1f0d060c8c: npm install, lint, build, Chromium install, and desktop/mobile Playwright route smoke tests all completed successfully.
- Backend CI run 42314790953 passed on source SHA 62250b00bae0d7eac20bede9adf98e69c4137e85: backend build and all 402 tests passed; deployment preflight completed successfully.
- An earlier backend run failed because stale Google-only assertions remained in google-only-auth.test.js, google-only-identity.test.js, and spot-trading-live-refresh.test.js. Those assertions were corrected to the owner-approved username/Google/Web3 contract; the latest backend run above is green.
- The latest code commit at the time of this note is 62250b00bae0d7eac20bede9adf98e69c4137e85. Documentation updates may advance the branch head without changing the tested application source.
- SOURCE OBSERVED + TEST PASSED: username login UI and endpoint contracts, Google UI flow, Ethereum/Solana wallet entry points, email-provider rejection, frontend build/lint/browser route smoke tests, and backend 402-test suite.
- NOT VERIFIED: live Supabase Google provider configuration, real wallet signature challenge on mobile/desktop wallets, fresh account creation against isolated Supabase, and full account setup with a newly provisioned wallet identity.
- Production deployment remains paused. No production database/auth settings were changed.

## Admin KYC evidence-gating batch — 2026-11-07

- SOURCE OBSERVED: the admin KYC queue returns `document_uploaded` and a short-lived private `document_url`; the backend normal approval path rejects missing stored evidence with `KYC_DOCUMENT_REQUIRED`.
- SOURCE OBSERVED: the KYC queue previously enabled Approve even when the document was absent or its signed preview URL could not be generated. This exposed an action that was guaranteed to fail, and could encourage reviewers to approve without seeing the evidence.
- FIXED: Approve is now disabled unless the upload exists and a secure preview URL is available. The row explains whether the document is missing or the preview needs refreshing. Reject remains available to authorized reviewers.
- SECURITY / BUSINESS RULE: no admin exception override was added to the UI. The existing backend `admin_override` bypasses the ordinary evidence gate and requires a reason; enabling it is a material review-policy decision and is not silently exposed as a normal approval path.
- TEST ADDED: `backend/tests/kyc-flow.test.js` asserts the evidence and preview gate while preserving the authorized reject path.
- NOT VERIFIED: live Admin session, signed-document preview against Supabase Storage, and browser-level manual KYC review. No production records, database, deployment, or financial operation was touched.
- Commits: `7fe5a5ea214b3633107a9276cd604554e6df4ae7` (UI); `8b452412ed5e6a3f560bfd01426ec117da4a773a` (regression test).


## Withdrawal rejection audit-reason hardening — 2026-11-07

- SOURCE OBSERVED: the Admin UI already requires a non-empty rejection reason, but the backend API previously substituted a generic default reason when a caller omitted it. This allowed a direct API caller with `withdrawals.review` permission to reject/refund without recording the operator's actual rationale.
- FIXED: `POST /api/admin/withdraw/reject` now rejects blank reasons with `WITHDRAWAL_REJECTION_REASON_REQUIRED`; reasons over 200 characters or containing control characters are rejected with `WITHDRAWAL_REJECTION_REASON_INVALID`. Valid reason text is passed unchanged to the atomic database review RPC.
- TEST ADDED: `backend/tests/admin-api-contract.test.js` verifies the server-side validation and confirms the UI still requires a reason.
- Preserved: atomic `review_withdrawal_atomic` transaction, row lock, ledger refund, and append-only audit event. No SQL migration or production database change was needed.
- NOT VERIFIED: backend test suite on this exact commit; GitHub Actions push should run backend CI, but no passing run result has been observed yet. Vercel's prior build-rate-limit check is separate from backend tests.
- Commits: `d2e13fe776efd54af3d9d828e03689b854ad8916` (initial API validation); `ee7e1e6a35c6158cf5c37bc46602fe5746520fca` (regression test); `cd2ab8079cb91b889792d4736f171bafbf2c2468` (correct control-character matcher).
- No merge, deployment, production database change, or live financial operation was performed.


## Bybit fallback freshness gate — 2026-11-07

- SOURCE OBSERVED: the market endpoint already had a 5-second provider fetch timeout and Coinbase-primary / Bybit-fallback behavior. Coinbase `ticker.time` is last-trade time; Bybit `payload.time` is provider response time.
- FINDING: Bybit fallback rows were accepted even when the response timestamp was absent, more than 60 seconds old, or implausibly more than 15 seconds in the future. That could surface an old cached response as a current BTCBOX snapshot.
- FIXED: Bybit fallback now requires a valid provider response timestamp within the range `now - 60s` through `now + 15s`; stale/invalid rows are skipped rather than presented as fresh.
- IMPORTANT: this age gate is deliberately not applied to Coinbase last-trade timestamps; quiet trading pairs can legitimately have an older last trade while the provider request itself is healthy.
- TEST ADDED: `backend/tests/spot-market-catalog.test.js` locks the Bybit response-time gate and protects Coinbase's distinct last-trade semantics.
- NOT VERIFIED: live upstream behavior, production market freshness, and the exact-commit backend CI result. No production market/provider settings were changed.
- Commits: `b19331f3015126cc6fa3043d778cbe3d04abd2ff` (freshness gate); `a09834e834d9fd811c01cf2a97b3eda6c049eb1c` (regression test).
- No merge or deployment was performed.

## Manual withdrawal payout audit cross-check — 2026-11-07

- Source-observed: `mark_withdrawal_paid_atomic` requires an approved withdrawal and a non-empty, bounded payout reference; it changes payout status and records the reference, actor, timestamp and an audit event. The function does not broadcast a chain transaction or apply a second ledger debit.
- Source-observed: an exact retry with the same reference returns the completed result before the audit insert; a retry with a different reference is rejected. This prevents duplicate completion audit rows and prevents silently replacing the payout reference.
- Follow-up regression coverage added in `backend/tests/withdrawal-manual-payout.test.js` at commit `8e41700b213bc30aba86b3e31bd441db9676ea7a`: checks actor/subject/action/reference fields, paid_by/paid_at, and the no-duplicate-audit retry path.
- Verification status: source/test assertions added; test suite has NOT been run on this commit in this environment. Do not label TEST PASSED.
- No SQL migration, production database, real payout, merge or deployment was performed.
- Next continuation: inspect market response/cache freshness and spot trade public preview/depth/K-line route parity; then auth entry-point smoke tests. Keep the work moving with concise source-level checks and targeted regression tests.

## Public market snapshot freshness — 2026-11-07

- Source-observed before change: browser requests already use `cache: "no-store"` and the spot-trade screen polls ticker/depth every 15 seconds; backend fetches current Coinbase/Bybit data per request (the declared `LIVE_PRICE_CACHE_MS` is not used by the market route). The public response nevertheless allowed a 5-second shared-cache lifetime plus 3 seconds stale-while-revalidate.
- Changed `backend/api-core.js` market response cache policy to `public, max-age=0, s-maxage=2, stale-while-revalidate=1`. This reduces shared edge reuse while retaining a small cache to avoid excessive provider calls; no stale provider data is substituted on upstream failure.
- Added regression assertion in `backend/tests/spot-market-catalog.test.js` for the cache policy, browser no-store behavior and 15-second trade-screen refresh interval.
- Commits: `e2898dddb7b3a556a3e59ad531b9b72f8c700dda` (API), `1ff6d48da611f6a1679179d931a4832a3ab936b6` (test).
- Verification status: source and test assertion updated; no test run on these commits in this environment. Live upstream freshness and deployed browser behavior remain NOT VERIFIED.
- No production deployment was performed.

## Spot ticker / depth / chart consistency — 2026-11-07

- Found a visibility gap: the trade screen showed only one provider label (order book preferred), hiding when ticker, depth and candles came from different upstream providers. It now displays separate Ticker / Order book / Chart source labels.
- Depth API now normalizes both Coinbase and Bybit levels, drops malformed/non-positive price or size rows, sorts bids descending and asks ascending, caps each side at 20 levels, and rejects an empty/malformed side rather than returning a misleading partial book. Response includes server snapshot time and provider timestamp when Bybit supplies one.
- Frontend depth parser independently validates/sorts levels and rejects an empty/malformed book.
- K-line client now retains provider provenance, validates OHLC range consistency, and exposes a visible warning when refresh fails instead of silently keeping old candles.
- Added source-contract regression assertions in `backend/tests/spot-market-catalog.test.js`.
- Commits: `ae544a241fc0d8fcd93f94b55bafe998788cb045` (depth API), `f9c20505a739864dc85881b0fc64232ade8d2bd4` (depth client), `9d280a5774560ffcd4579ff4da3e32794fc6423d` (provider labels), `36d71cc080ff72582a92ac7d0fac668001a21c29` (depth regression), `17114ab149f1b9c897b8d657d2f8d51c769d39a5` (candle source/OHLC validation), `3081a36532d481cb83ddae409c1366047d6f2ca3` (chart warning/source UI), `08fabb8c8566f4527160d184c014443acc2a477c` (chart regression), `38a4f8f3b1f52f72d026c6b976917aa5dd01a89a` (K-line response typing).
- Verification status: static source cross-check and regression assertions committed; test/build/browser execution on these commits remains NOT VERIFIED. No production deploy or real order activity.
- Next continuation: run/check CI on the current head; then address route-level auth behavior and responsive trade UI issues without changing execution/settlement logic.
