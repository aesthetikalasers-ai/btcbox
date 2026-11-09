# BTCBOX

BTCBOX frontend and shared Node API handler. The current migration target is Vercel with Supabase-backed persistence. See `VERCEL-DEPLOYMENT.md` and `SUPABASE-FIRST-DEPLOYMENT.md` before deploying.

## Financial safety status

All financial write, normalized-read, and matching capabilities require explicit opt-in: every relevant `FINANCIAL_*` variable must be set to the exact string `1`. Unset, empty, or malformed values remain disabled. The sample environment sets all financial flags to `0`, and deployment preflight requires all four to be explicitly `0`.

The existing administrative manual-deposit path calls `admin_manual_deposit_atomic` only behind the complete financial cutover gate. It fails closed without crediting funds when the gate is not approved. The current SQL and API contract has not yet been applied to a live staging database as part of this source archive review; do not enable production financial flags until the RPC signatures, migration order, data reconciliation, and end-to-end tests are verified.

The current user-facing deposit route returns deposit address details but does not create a pending user deposit order. A separate pending-order workflow and its approval RPC contract must be completed and tested before claiming that user-requested manual deposit approval is implemented.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:fb0d3bdafed33b526f8fe1a6373b6e2e25b512ce2badc543c3a24f7ce14b0056 -->

## Local integration

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:570c42b73ee4c583beaf334a7e5f7f0c3e605b7fbeae8832812127c6aecb7de9 -->

Use Node 22 and the installed `frontend/` dependencies (`npm install --prefix frontend`). Run `npm run test:integration --prefix backend` to check the complete local server. This integration check is separate from standalone backend `npm test`; backend CI runs it after the unified build installs the frontend dependencies. From the repository root:

<!-- /coderabbit-ai-generated:v1 -->

```sh
CONTEXT=dev BTCBOX_DEV_HOST=0.0.0.0 \
FINANCIAL_POSTGRES_RPC_ENABLED=0 FINANCIAL_POSTGRES_FULL_CUTOVER_APPROVED=0 \
FINANCIAL_POSTGRES_READS_ENABLED=0 FINANCIAL_MATCHING_ENGINE_ENABLED=0 \
npm run dev --prefix backend
```

Open http://localhost:4175/home. This serves Vite and the existing API adapter on the same origin. `/api/healthz` is the process probe; it does not certify database or identity-provider readiness. Without Supabase configuration, API calls return actual unavailable responses rather than the frontend HTML fallback. No synthetic accounts or market data are installed.

Supply the non-production Supabase URL, server-only service key, auth URL/public key, rate-limit HMAC secret and approved callback URL through a private environment file or the task's secure environment configuration. Never put service keys in `VITE_*`. The launcher does not create a project, migrate a database, provision admins, or enable financial operations. Follow the existing isolated bootstrap and financial acceptance gates before explicitly enabling any financial flag. Google OAuth requires its own provider configuration; wallet acceptance requires a real test-wallet signature.

`BTCBOX_DEV_PORT` overrides 4175; the default bind address is 127.0.0.1. `CONTEXT=dev` is mandatory. This development server is not a production server.

## Local checks

<!-- /coderabbit-ai-generated:v1 -->

- `npm test`
- `npm run build`

A passing source-level test suite is not a substitute for a live Supabase staging drill or Vercel Preview end-to-end validation.
