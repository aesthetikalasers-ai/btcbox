# BTCBOX Unified Frontend Template Migration

Status: migration branch initialized; source audit in progress.

## Target architecture

- Canonical runtime candidate: `frontend/` (Vite + React 19 + TypeScript + Tailwind 4).
- Strata Pro: crypto market/dashboard visual foundation. Its source is MIT licensed and uses React + Vite + Tailwind 4 + Lightweight Charts, so it is the closest runtime match.
- Shadcn Fintech: account, authentication-screen, settings, transaction and support visual references. Its source is MIT licensed but is a Next.js 16 application; port components and page composition into the existing Vite app rather than importing its Next.js app router or Clerk integration.
- BTCBOX remains the system of record: Supabase auth/session and BTCBOX API contracts. Template seed/demo data and third-party auth must not be used as production data or identity providers.

## Page mapping

| BTCBOX route / capability | Visual source | Integration boundary |
| --- | --- | --- |
| Home / Markets | Strata Pro dashboard, charts, token table, app shell | Bind only to BTCBOX market endpoints; empty/error states when unavailable |
| Trade hub / Trade pair | Strata Pro chart and market components | Preserve BTCBOX order workflow and market contract; no simulated order engine |
| Login / Register | Shadcn Fintech sign-in/sign-up composition | Rebuild with existing Supabase auth client; retain Google OAuth callback/session handling |
| Assets / Account | Shadcn Fintech accounts and dashboard patterns | BTCBOX authenticated account/balance API only |
| Orders / History | Shadcn Fintech transaction-table patterns | BTCBOX read-only orders/history endpoints |
| Deposit / Withdraw | Shadcn Fintech form and status patterns | Keep financial writes fail-closed; never import demo transfer behavior |
| Settings / Support | Shadcn Fintech settings/support patterns | Connect only to existing BTCBOX endpoints and verified capabilities |

## Migration rules

1. Do not replace the existing Vite build root or change Vercel project root until the canonical production entry is verified.
2. Do not import Next.js server components, Next app-router assumptions, Clerk, seed data, or fake balances into the Vite application.
3. Preserve original MIT license and attribution notices for both sources.
4. Port visual components into the existing React/Vite app and adapt imports/dependencies deliberately.
5. Remove/disable every mock fallback before presenting a value as live.
6. Verify mobile layouts at 320, 360, 375, 390, 414, 430, 768, 1024, 1280 and 1536px.
7. Do not merge or deploy from this branch. Financial write paths remain disabled during QA.

## Upstream sources

- Strata Pro: https://github.com/bymilon/strata-pro-crypto-ui
- Shadcn Fintech: https://github.com/abderrahimghazali/shadcn-fintech

## Initial source observations

- Strata Pro package: React 19, Vite 6, Tailwind 4, Lightweight Charts 5, Zustand; MIT.
- Shadcn Fintech package: Next.js 16, React 19, Tailwind 4, shadcn/ui; MIT. Its auth pages use a separate provider setup and must be adapted rather than copied as a working BTCBOX auth implementation.
- BTCBOX main already contains Strata-derived UI files and a Vite app at `frontend/`; this migration must consolidate rather than duplicate the existing Strata implementation.
