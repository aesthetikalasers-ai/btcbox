# BTCBOX

BTCBOX is a React/Vite customer application served together with the Node/Vercel API from the `backend/` deployment root.

## Canonical application

- Customer UI: `frontend/` (React, TypeScript, Vite).
- Authentication and customer/admin API client: `frontend/src/lib/`.
- Server/API and deployment build: `backend/`.
- Public output: `backend/dist/` (generated; do not edit directly).
- Supabase SQL and backend tests: `backend/supabase/` and `backend/tests/`.

The deployment build is run from `backend/`:

```sh
npm ci --prefix backend
npm run build --prefix backend
npm test --prefix backend
```

The backend build installs/builds the Vite app, then assembles the public output through `backend/scripts/build-site.js`. For the currently empty Supabase database, use the one-time fresh-schema bootstrap only after an isolated PostgreSQL dry run and explicit owner approval:

```sh
DATABASE_URL=postgresql://... BTCBOX_BOOTSTRAP_CONFIRM=YES npm run bootstrap:empty-db --prefix backend
```

For a remote Supabase target, also set `BTCBOX_ALLOW_REMOTE_BOOTSTRAP=YES` only after confirming the exact project and empty schema. The bootstrap refuses existing BTCBOX tables, excludes legacy import/staging SQL and automated chain verification, and does not run as part of CI.

The frontend can also be checked independently:

```sh
npm install --prefix frontend
npm run lint --prefix frontend
npm run build --prefix frontend
```

## Static compatibility surface

The React/Vite application is the only customer and administrator application published by the build. The only retained static page is the OAuth consent screen at `/oauth/consent`; it uses an isolated token stylesheet and its own external script. The legacy `/auth/callback` URL redirects into the React PKCE callback route. Old static SPA assets remain source-only during test-contract retirement and are not copied into the public output.

## Safety and release rules

- Never use fabricated market prices, balances, order history, or candles as live data.
- Never expose demo accounts, simulated customer activity, preview/scaffold labels, or placeholder actions in the customer release. If a service is not implemented or enabled, state that it is unavailable and keep its actions disabled.
- Financial posting, deposits, withdrawals, order placement, matching, and settlement must remain fail-closed in QA.
- Use isolated test fixtures for financial workflow tests; do not write test transactions to the hosted production database.
- Do not merge to `main`, change production configuration, or deploy without explicit user approval.
- Preserve the locked trading-page layout unless an explicitly approved change requires otherwise.
