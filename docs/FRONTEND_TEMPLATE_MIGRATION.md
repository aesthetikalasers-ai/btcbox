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

- Responsive navigation follow-up: the mobile bottom bar now mirrors the desktop sidebar semantic route colors for Home/Markets, Trade, Assets, and My. Active-state contrast and touch-target sizing are retained; no route or business behavior changed.

- Assets page batch: the account summary is now three live-data cards (estimated value, returned asset count, valuation completeness), asset rows include the existing token icon component and subtle semantic markers. Partial valuations remain explicitly incomplete; no aggregate is synthesized from incomplete prices.
- Account Security overview cards now have restrained semantic surfaces for linked methods, 2FA and password status. Values remain from the authenticated account snapshot; auth actions and recovery flows are unchanged.

- Deposit/withdrawal presentation batch: deposit address card now has a teal/cyan verification surface, clearer asset/network destination treatment, high-visibility network warning, and stronger history header. Withdrawal page balance summary and submit panel now have distinct semantic cyan/violet surfaces, consistent 48px form controls/focus states, and a full-width high-visibility submit action. Existing destination selection, fee calculation, account balances, 2FA/fund-password requirements, request-id persistence/idempotency, backend gates, and staff-review semantics are unchanged. No deposit or withdrawal was initiated.

- Support page presentation batch: private conversation, user/staff message surfaces, help-center entry and message composer now use a distinct indigo/cyan support palette with clearer headers, readable message alignment, larger text-entry target and prominent send action. Authentication gating, private account-message retrieval, message contents, request-id retry behavior and support APIs are unchanged; no messages were sent.

- Earn page batch: added three real-record summary metrics (live catalog count, returned position count, and active position count), product cards with a stronger APY hierarchy, dedicated subscribe-panel treatment, consistent 48px controls and improved position metric surfaces. Counts are derived only from the live catalog and authenticated account response; no projected balances, demo rates or simulated yield were added. Subscribe/redeem actions, decimal validation, request IDs, backend action gate and retry behavior are unchanged. No Earn transaction was submitted.

- Orders/account-setup follow-up: Orders history now has a clearer branded history header, table hierarchy and mobile-card hover affordance; its records, status mapping, loading/error/empty states and route behavior are unchanged. Account setup now shares the branded secure-access shell, cyan identity-verification accent and consistent primary action with the sign-in experience. Username/password constraints, credential API, navigation and authentication state transitions are unchanged.

- Auth-page finishing batch: login/register and password-recovery panels now share the branded cyan/indigo/success accent system and stronger card hierarchy; all auth inputs and full-width provider actions have consistent 48px touch height. Username/email/Google/wallet/2FA/password-recovery providers, Supabase auth/session flow, validation rules and navigation are unchanged. No Clerk or demo identity flow introduced.


## Japanese-first localization audit — 2026-11-08

- The runtime already has a seven-language selector and a shared React i18n provider in `frontend/src/lib/i18n.tsx`; the current initial language is English and the persisted preference key is `btcbox-language`.
- Japanese translations exist, but coverage is partial. Missing Japanese dictionary entries currently fall back to the English source string, so changing the default immediately would produce mixed-language screens.
- The shared dashboard/market table already formats numbers and timestamps with `ja-JP` when Japanese is selected. The language preference is already user-selectable in the Topbar.
- The business-pages module contains hundreds of translation call sites, while the current AuthPages module does not use the shared translation function. These areas need a deliberate Japanese copy pass; Admin and all status/error/empty/loading messages also require coverage review.
- Required sequence before switching the default: (1) inventory all visible customer/admin strings and dynamic API-facing messages; (2) add reviewed Japanese translations and remove hard-coded UI copy from auth/layout/business pages; (3) verify 100% key coverage with a test that fails on missing Japanese keys; (4) set first-visit default to `ja`, persist explicit user selection, and set `document.documentElement.lang` on initial render; (5) run desktop/mobile route smoke tests and inspect Japanese text wrapping, button widths and table overflow.
- Keep English available. Do not change API contracts, auth/session behavior, financial rules, number precision, or the locked Spot page layout as part of localization.
- No default-language switch is made by this audit; it records the prerequisite work so the application is not released with accidental mixed-language UI.

- Strata Pro dashboard card surface port: the BTCBOX dashboard's shared chart/market Card now uses the upstream 16px/20px radius, restrained inset highlight, subtle border and deeper layered shadow. The BTCBOX live market table, provider-backed candles, empty/error states and all market API behavior remain the source of truth; upstream static token/demo data and its nonfunctional volume selector are intentionally not copied.


## Product-grade localization and financial terminology standard

BTCBOX localization is a complete language system per locale, not a literal translation pass. Every supported locale must have its own natural, consistent terminology, sentence structure, tone, number/date conventions and UI copy. Do not mix source-language fragments into a localized sentence or reproduce English syntax unnaturally.

- Financially necessary industry terms may remain in their recognized form where that is the professional convention for the target market (examples include Spot, Limit Order, Market Order, Maker, Taker, API, BTC, ETH and USDT). Do not preserve English merely for convenience.
- For each locale, maintain a reviewed terminology glossary with canonical labels, approved abbreviations, contextual definitions, prohibited variants and first-use explanatory guidance where needed.
- Preserve canonical asset tickers, protocol/network names, order identifiers, API field names and legally/technically significant identifiers. Localize their surrounding explanation and user guidance.
- Use locale-native phrasing for navigation, forms, validation, success/error/warning messages, empty/loading/unavailable states, risk disclosures, notifications and help content. Consistency applies across customer and admin surfaces.
- Never alter financial meaning, risk level, fees, precision, timestamps, order states or API contracts during translation. Ambiguous source copy must be resolved against product behavior before translation, not guessed.
- Require per-locale completeness checks (no missing dictionary keys), terminology checks and native-language review. Test long labels, line wrapping, tables, dialogs and mobile touch targets at supported viewport widths.
- Japanese is the intended first-visit default; English remains available and user selection persists. Do not enable Japanese-first until all user-visible routes and dynamic messages pass completeness and UI review. Other locales must also remain internally consistent rather than falling back unpredictably to English.

- Locale formatting consistency batch: shared `localeTags` now drives both live market and top-token price formatting, and the document `lang` attribute follows the active persisted language on initial provider mount and subsequent changes. No language default changed; financial values and precision remain unchanged.

- Added an isolated browser regression test for language selection: switching to Japanese updates the HTML language metadata and Japanese navigation labels, then survives a full page reload. The test does not change the default locale or touch account/financial state.

- Localized the dashboard Top tokens panel and market snapshot metadata across all seven supported locales, including source labels and relative-age units. Numeric formatting uses the shared locale map; asset tickers and USDT remain canonical financial identifiers.

- Localized the market-feed stale-snapshot warning in all seven locales and localized the loading-state accessible label. The stale-data fail-closed behavior and 90-second threshold are unchanged.

- Completed first full locale-copy pass for Dashboard, Assets and Orders labels/status text in all seven supported locales. Financial identifiers and exact numeric values remain unchanged; common operational labels (available/frozen, price/quantity, valuation status) now have consistent locale entries.

- Japanese-first terminology batch: completed native Japanese copy for the Trade Hub's Spot, Seconds, Earn and Futures availability/status surfaces. Operational availability wording preserves backend fail-closed semantics; Spot, Seconds, Earn and Futures remain recognized product terms where useful. No order execution behavior changed.

- Japanese account-center and KYC copy batch: added native Japanese for My Account profile/security summaries and the identity-verification form, document guidance, submission/confirmation states and privacy warnings. No identity verification rules, document handling, account APIs or authentication behavior changed.
