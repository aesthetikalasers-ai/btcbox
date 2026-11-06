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

The backend build installs/builds the Vite app, then assembles the public output through `backend/scripts/build-site.js`. The frontend can also be checked independently:

```sh
npm install --prefix frontend
npm run lint --prefix frontend
npm run build --prefix frontend
```

## Compatibility assets

The build currently retains selected legacy static assets and OAuth routes while their remaining dependencies are being replaced by the React application. These files are compatibility dependencies, not a second canonical customer frontend. Do not remove them until their routes, callbacks, tests, and production references have been migrated and verified.

## Safety and release rules

- Never use fabricated market prices, balances, order history, or candles as live data.
- Financial posting, deposits, withdrawals, order placement, matching, and settlement must remain fail-closed in QA.
- Use isolated test fixtures for financial workflow tests; do not write test transactions to the hosted production database.
- Do not merge to `main`, change production configuration, or deploy without explicit user approval.
- Preserve the locked trading-page layout unless an explicitly approved change requires otherwise.
