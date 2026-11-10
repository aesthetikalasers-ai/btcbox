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

## UI visual design and acceptance standard

**Mandatory for all BTCBOX UI work:** [BTCBOX 全站 UI 视觉设计与验收规范 V1.0](docs/BTCBOX-UI-VISUAL-STANDARDS-V1.md).

This document is the canonical visual acceptance standard for new pages, existing-page changes, refactors, shared components, and release checks. Its four acceptance layers are independent and all required:

1. Whole-site visual consistency.
2. Independent mobile layout and visual acceptance.
3. Independent desktop layout and visual acceptance.
4. Continuous responsive behavior across widths and breakpoints.

The standard also defines card spacing and layout rhythm, test viewports, multilingual layout checks, trading-page protections, evidence requirements, and pass/fail states. A page must not be called visually complete until all four layers and applicable trading/multilingual checks pass with recorded evidence. A desktop page merely scaled down to mobile is not sufficient.

When a UI change is proposed, consult the full standard before implementation and include its applicable checks in the change's verification notes. If this summary and the detailed standard ever differ, the versioned detailed standard governs visual acceptance.

## Safety and release rules

- Never use fabricated market prices, balances, order history, or candles as live data.
- Financial posting, deposits, withdrawals, order placement, matching, and settlement must remain fail-closed in QA.
- Use isolated test fixtures for financial workflow tests; do not write test transactions to the hosted production database.
- Do not merge to `main`, change production configuration, or deploy without explicit user approval.
- Preserve the locked trading-page layout unless an explicitly approved change requires otherwise.
