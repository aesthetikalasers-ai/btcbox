# BTCBOX admin/backend restore notes — 2026-11-04

## Source and destination
- Source: `avali9308-code/btcbox-v33`, source commit `18a354a9e8e1d0365e240c7c44eda4a18d62ce07`.
- Destination: `avali9308-code/btcboxcdt`, branch `integration/restore-btcbox-admin-20261104`.
- Restored 118 tracked text/source files under `backend/`, including the BTCBOX admin page, API handlers, shared server code, frontend assets, Supabase SQL migrations, tests, build scripts, and selected operational/review documents.

## Deliberate exclusions
- `backend/dist/`: generated build output; regenerate with `npm run build`.
- `backend/DEPLOYMENT.md`: excluded because it contains a hard-coded admin password and unsafe financial feature flags set to enabled. Rotate any credential that may have been used from that file; do not copy it into Vercel.
- `backend/docs/AI*` and `backend/docs/dola-prep/`: historical coordination/research material, not required runtime files; some describes an obsolete repository layout.
- Root `admin-panel/` archive/reference application: not copied. This restore is the BTCBOX-owned `backend/admin.html` and its actual API, not the unrelated OPEX reference panel.

## How to build and test this restored backend
Run commands from the `backend/` directory:
- `npm run build`
- `npm test`
- `npm run preflight`

The Vercel configuration is `backend/vercel.json`; the Vercel project's Root Directory must be set to `backend` before deploying this directory. The repository root currently contains a separate React template, so this restore intentionally does not overwrite root files or change the production Vercel project settings.

## Important deployment and business caveats
- This commit only restores source files to an integration branch. It does not merge, deploy, change Vercel settings, or modify Supabase.
- Keep all `FINANCIAL_*` switches disabled until the migration sequence, RPC contracts, ledger reconciliation, and end-to-end tests are verified.
- The previously recorded withdrawal lifecycle review identifies a gap after approval: chain broadcast, transaction ID persistence, retry handling, and final confirmation are not yet proven. Do not treat an approved withdrawal as a completed on-chain transfer.
- Passing source tests/build is not production acceptance. Verify the exact deployed SHA and browser/API flows in Preview before release.
