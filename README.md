# BTCBOX — Secure Crypto Exchange (White-label Frontend)

A complete, deployable white-label crypto-exchange frontend customized for **BTCBOX**, built on an
open-source React template. Dark professional trading theme (OKX / Binance style), English-only,
all mock data, no backend required.

## Template selection

**Selected template:** `react-crypto-exchange` by **cenksari**
- Source: <https://github.com/cenksari/react-crypto-exchange> (master branch, downloaded 2026-11-04)
- Demo: <https://react-crypto-exchange-nine.vercel.app/>
- License: **MIT** (Copyright (c) 2025 Cenk SARI) — original `LICENSE.md` retained in this directory.
- Stack: React 19 + TypeScript + react-router-dom v7 + Create React App (react-scripts 5) +
  ApexCharts (candlesticks) + Material Icons + Poppins.
- Why this one: builds cleanly, covers 9/10 required page areas out of the box, small and easy to
  rebrand. The fallback OPEX `web-app-main` (MIT, 10/10 pages, i18next + lightweight-charts) was
  kept in reserve but not needed. One build dependency conflict (`ajv@6` vs `ajv-keywords@5`, a
  known CRA5 issue) was fixed by pinning `ajv@^8`; `npm install --legacy-peer-deps` is recommended.

## Branding applied

| Asset | File | Used for |
| --- | --- | --- |
| Horizontal logo (dark text) | `public/images/logo.png` | kept for light contexts |
| White horizontal logo | `public/images/logo-white.png` | navbar, login/signup/forgot/404, landing header/footer (dark theme) |
| Pure icon (diamond check) | `public/images/logo-icon.png`, `public/favicon.png`, `logo192.png`, `logo512.png` | favicon, PWA icons, mobile header logo, avatar placeholder |
| Inverse logo (green bg) | `public/images/logo-inverse.png` | available for loader/dark footer |
| Full vertical logo | `public/images/logo-full.png` | available |

- Brand primary color: **#2BA85A** (links, active nav, primary CTA, selection).
- Up / buy green: **#0ECB81**; down / sell red: **#F6465D** (deliberately distinct from brand green).
- Secondary: dark gray **#4A4A4A** family; dark theme palette: bg `#0B0E11`, card `#161A1E`,
  border `#2B3139`, text `#EAECEF`, secondary text `#848E9C`.
- Brand name **BTCBOX** applied to `<title>`, meta tags, manifest, navbar copyright, 404 copy,
  package name. Slogan: **Secure Crypto Exchange**.
- Original author references (cenksari.com profile pictures, `Cenk SARI`, `@cenksari`, footer
  credit link) removed/replaced with local assets and generic names.

## Dark theme conversion

The original template was light-only. A full dark override layer was appended to
`src/styles/site.css` (CSS variables `--btc-*`) re-theming every surface: body, cards, inputs,
tables, tabs, header, navbar, widgets, login forms, buttons (with hover/active/disabled states),
scrollbars. ApexCharts candlestick options were set to dark mode with up/down wick colors. A new
landing page (`src/screens/Landing`) uses the same palette.

## Page coverage (10 required areas)

| # | Area | Status | Route / location |
| --- | --- | --- | --- |
| 1 | Landing / home | ✅ added | `/` (LandingScreen, hero + markets ticker + features + CTA) |
| 2 | Navigation + user account area | ✅ | top header menu (Markets/Wallet/Orders/Deposit) + notifications + user chip; sidebar navbar |
| 3 | Assets / balance overview | ✅ | `/capital` (CapitalScreen, market list with prices/change/volume/charts + search) |
| 4 | Market list + coin search | ✅ | `/capital` (TopBar search) + `/market` left Market widget |
| 5 | Candlestick chart + trading area | ✅ | `/market` (CandleStick ApexCharts + CoinHorizontal ticker) |
| 6 | Buy / sell order entry | ✅ | `/market` (BuySell widget, Buy/Sell tabs, amount/price inputs) |
| 7 | Orders + trade history | ✅ | `/transactions` (TransactionsScreen) + `/market` (TradeHistory, BuyOrders, SellOrders) |
| 8 | Deposit / withdraw | ✅ | `/dashboard` (BankProcess widget with accounts, generic USD wire info) |
| 9 | Profile / settings | ✅ | `/members` (ProfileScreen) + `/settings`, `/contacts`, `/messages`, `/members/notifications` (InfoScreen placeholders) |
| 10 | Login / register + responsive | ✅ | `/signin`, `/members/signup`, `/members/forgot-password`; media queries down to 375px, sidebar collapses, tables horizontal-scroll, mobile header logo added |

All internal links resolve (no dead links). Extra template links that had no page (`/data`,
`/docs`, `/api`, `/search`, `/wallet`, `/members/application`) were repointed or routed to
existing pages / the Info placeholder.

## Language cleanup (English-only)

~110 non-English / template-specific occurrences removed across ~25 files:
- 59× `TRY` currency code → `USDT`; `BTC/TRY` → `BTC/USDT`; `TL` / `Turkish Lira` phrases → `USD`.
- 4× `Etherium` typo → `Ethereum`.
- 3 Turkish bank entries (Ziraat / Garanti / Yapı Kredi, branches, TR IBANs, external hotlinked
  logos) → generic international USD/EUR accounts; BankProcess widget rewritten.
- Turkish names (`Tarık`, `Cenk`) → generic `Alex` / `Jordan`.
- All `cenksari` profile-picture hotlinks → local `logo-icon.png`; author credit link removed.
- Dashboard EFT/TL info blocks → generic wire-transfer copy.
- Verified: no Chinese characters (`[\x{4e00}-\x{9fff}]`) and no Turkish special characters
  (`çğıöşü`) remain in `src/` or `public/` (excluding `node_modules`/`build`).

## Build & run

```bash
npm install --legacy-peer-deps   # installs deps (pins ajv@8 for CRA5)
npm start                        # dev server at http://localhost:3000
npm run build                    # production build -> build/ (verified OK)
```

Serve the static build with any static server, e.g. `npx serve -s build`. The app is a pure SPA
with mock data — no backend required.

## Files changed / added

- Modified: `package.json` (name, Linux build script), `public/index.html`,
  `public/manifest.json`, `src/styles/site.css` (dark layer + landing styles + 375px media),
  `src/navigation/Navigation.tsx` (new routes), `src/components/Navbar/Navbar.tsx`,
  `src/components/Header/HeaderRight.tsx`, `src/components/Header/HeaderLeft.tsx` (mobile logo),
  `src/components/Widgets/BankProcess/BankProcess.tsx`,
  `src/components/Widgets/CandleStick/CandleStick.tsx` (dark chart),
  `src/components/Widgets/Profile/Profile.tsx` (dead link),
  `src/screens/Dashboard/DashboardScreen.tsx`, all auth screens' logo src, plus bulk
  TRY/Etherium/name replacements across widgets and screens.
- Added: `src/screens/Landing/LandingScreen.tsx`, `src/screens/Info/InfoScreen.tsx`,
  `public/images/logo-white.png`, `logo-icon.png`, `logo-inverse.png`, `logo-full.png`,
  `public/favicon.png` (brand assets).
- Replaced: `public/images/logo.png`, `public/logo192.png`, `public/logo512.png` with brand assets.

## Known limitations / legacy issues

1. Mock data only — no real API integration; order forms and deposit/withdraw are UI demos.
2. Some coin icons are hotlinked from external icon CDNs (iconarchive / iconfinder / kindpng);
   if a host blocks hotlinking the alt text shows. Replace with local assets for production.
3. InfoScreen placeholders (Settings / Addresses / Messages / Notifications) are minimal
   "coming soon" pages — full implementations left to backend integration.
4. Sidebar navbar is hidden below 1020px (template's original `responsive-hide`); mobile
   navigation is via the top header menu and the added mobile logo home link.
5. `browserslist` caniuse data is ~11 months old (warning only); run
   `npx update-browserslist-db@latest` if desired.
