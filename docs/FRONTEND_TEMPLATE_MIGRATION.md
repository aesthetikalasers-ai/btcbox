# BTCBOX Unified Frontend Template Migration

Status: source references consolidated into the integration candidate; full runtime migration remains pending.

## Target architecture

- Canonical runtime: `frontend/` (Vite + React 19 + TypeScript + Tailwind 4).
- Strata Pro: complete source reference for crypto market/trading presentation (React + Vite + Tailwind 4 + Lightweight Charts; MIT).
- shadcn-fintech: complete source reference for account, authentication-screen, settings, transaction and support UI (Next.js 16; MIT). Port components/page composition into Vite rather than importing its Next.js app router or Clerk integration.
- BTCBOX remains the system of record: Supabase auth/session, BTCBOX APIs, real data and all business/financial behavior.

## Required page coverage

| BTCBOX route / capability | Source | Integration boundary |
| --- | --- | --- |
| Home / Markets | Strata Pro dashboard, charts, token table, app shell | BTCBOX market endpoints only; honest empty/error states |
| Trade hub / Trade pair | Strata Pro chart and market components | Preserve BTCBOX order workflow, API contracts and locked Spot layout |
| Login / Register | shadcn-fintech sign-in/sign-up composition | Existing Supabase auth and Google OAuth callback/session only |
| Assets / Account / Security | shadcn-fintech account and dashboard patterns | BTCBOX authenticated account/balance APIs only |
| Orders / History | shadcn-fintech transaction-table patterns | BTCBOX order/history endpoints only |
| Deposit / Withdraw | shadcn-fintech forms and status patterns | Financial writes remain fail-closed until independently verified |
| Settings / Support / Admin | shadcn-fintech patterns | Existing BTCBOX permissions and verified APIs only |

## Migration rules

1. Do not change the production build root or Vercel project settings.
2. Do not import Next.js server components, app-router assumptions, Clerk, seed data, fake balances, simulated transfers or demo trades.
3. Preserve both original MIT licenses and notices.
4. Port full page structures, navigation, components, typography, semantic color/surface system, interaction states and responsive behavior into the existing React/Vite app.
5. Preserve BTCBOX auth/session, API contracts, financial rules and locked Spot layout.
6. Do not present mock fallbacks as live values; use truthful loading/empty/error/unavailable states.
7. Comprehensive responsive verification after consolidation at 320, 360, 375, 390, 414, 430, 768, 1024, 1280 and 1536px.
8. No merge to main, production deployment, hosted Supabase writes or real financial operations during migration.

## Upstream sources

- Strata Pro: https://github.com/bymilon/strata-pro-crypto-ui (pinned `a3f79d0237c68faddc877f8c1b00afece2fbbae8`)
- shadcn-fintech: https://github.com/abderrahimghazali/shadcn-fintech (pinned `a905058c75a840896d27a16991f2e7cc1ca06f3f`)

## Consolidation status

The upstream repositories are pinned as Git submodules. This establishes source availability only; it does not mean their pages/components are already integrated into the BTCBOX runtime. Runtime porting and real BTCBOX data/auth wiring remain required.


## Runtime porting ledger — 2026-11-08

- The candidate runtime remains Vite + React; upstream submodules are reference sources, not runtime imports.
- Dashboard / Markets already consumes BTCBOX market endpoints and provider-backed chart candles. The latest UI batch adds distinct semantic accent surfaces to the three BTC summary metrics while retaining live-data-only values and existing responsive geometry.
- Account Security, Assets, and Orders have prior BTCBOX-backed visual/responsive adaptations; these are partial page ports, not evidence that the full shadcn-fintech page compositions have been ported.
- Still pending: complete navigation/shell composition pass, full shadcn-fintech account/settings/auth/transaction/support page ports, deeper Strata Pro dashboard/market component ports, and a single consolidated desktop/mobile visual acceptance pass.
- No Next.js app router, Clerk, demo data, or mock financial values are introduced by this batch. The locked Spot trading-page layout and API contract are untouched.

- My Account quick-navigation cards now use distinct semantic accents for verification, orders, support, and settings. Routes and their existing BTCBOX-backed page behavior are unchanged.
