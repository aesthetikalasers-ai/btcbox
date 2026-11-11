# Phase 1 Frontend / Client-Surface Audit — BTCBOX

- **Repo:** `/home/user/Dola/chats/38418458470338065/btcbox`
- **Branch:** `feature/four-products` (verified via `git branch --show-current`)
- **Audit scope:** frontend React client + legacy trading-view JS + admin console language + build/deploy. Read-only; no source modified, no git push.
- **Audit date:** 2026-11-10
- **Method:** static source inspection with `file:line` citations. No `npm install` / build run. Large files (Pages.tsx 1211 lines, api.ts 1168 lines) sampled at key sections; all red-line evidence cited verbatim.

---

## 0. Executive verdict on the four customer red-lines

| # | Requirement | Verdict | Evidence |
|---|---|---|---|
| 1 | Customer product list = exactly **Spot / Seconds Contract / Contract / Earn**; no 5th "Futures"; no mislabeling | **VIOLATION** | TradeHub shows **Spot, Seconds, Earn, Futures** (Futures = unavailable placeholder). Required **Contract** product does not exist. Two e2e tests *enforce* Futures being visible. `frontend/src/features/pages/Pages.tsx:73-77`; `frontend/e2e/auth-routes.spec.ts:968,984`; `frontend/e2e/redesign.spec.ts:213-215` |
| 2 | Mobile product grid = **2×2** (two columns, four equal cards), NOT single-column stack | **VIOLATION** | Grid container is `grid gap-4 sm:grid-cols-2` — no base `grid-cols-2`, so below 640 px (Tailwind `sm`) it renders **1 column**. No CSS override in `index.css`. `Pages.tsx:73` |
| 3 | Default = Japanese; supported = JP/CN/EN/ES/DE/IT/PT; manual switch + cross-visit persistence; admin = fixed Chinese | **COMPLIANT** (one dead-code note) | Default `ja` at `i18n.tsx:93`; 7-language union type `i18n.tsx:11`; localStorage key `btcbox-language` read `i18n.tsx:89`, write `i18n.tsx:111`; switchers in `Topbar.tsx:64-88` and `AuthPages.tsx:135`; admin forced `zh-CN` at `App.tsx:68` + Chinese `admin-i18n.ts:1-2`. `vi.json` is present but **not loaded** (dead code). |
| 4 | React Seconds page vs legacy API consistency (endpoints + fields) | **CONSISTENT** | React `api.ts:486,521,560-561,585-586` vs legacy `backend/assets/js/app-core.js:411-432` vs backend handlers `backend/api-core.js:2549,2578,2621,2667`. `SecondsOrderInput` fields `{request_id,symbol,direction,duration_sec,amount}` (`api.ts:540-545`) match legacy body exactly. |

**Does a Contract / Perpetual trading UI already exist? NO.** No `/contract` or `/futures` route (`App.tsx:38-58`), no Contract page component, no contract API client functions in `api.ts`, no contract admin tab. The only "Futures" artifact is a disabled placeholder card on the trade chooser.

---

## 1. Existing frontend features inventory (per product)

### 1.1 Spot — fully built
- Route: `/trade/:symbol` → `SpotTradingPage` (`App.tsx:41`); `/markets` → `MarketsPage` (`App.tsx:39`); `/trade` redirects to `/trade-hub` (`App.tsx:40`).
- `SpotTradingPage` (`Pages.tsx` ~500-528): candlestick chart (`lightweight-charts`), order book, limit-order entry (buy/sell), available balance, estimated total, idempotent retry (`pendingIntent.client_order_id`), policy-gated submission (`tradingStatus.spot_order_entry_enabled`), open-orders list with cancel.
- `MarketsPage` (`features/markets/MarketsPage.tsx`, 112 lines): live ticker list (5 s poll), search/filter/sort, favorites (localStorage `btcbox.market-favorites`), selected-pair candle chart, stale-snapshot fail-closed (>90 s hides quotes).
- `Dashboard` home (`features/dashboard/Dashboard.tsx`, 160 lines): BTC summary, top tokens, mini trend SVG, CTA → `/trade-hub`.
- Spot markets config list on TradeHub (`Pages.tsx:80-84`) from `getSpotMarketPairs`.

### 1.2 Seconds Contract — fully built
- Route: `/seconds` → `SecondsPage`, login-gated (`App.tsx:42`).
- `SecondsPage` (`Pages.tsx:679-708`): active policy card (`getSecondsPolicy`), order form (direction up/down, duration, amount), open positions grid, settled history grid, per-position countdown, server-authoritative settlement.
- API: `getSecondsPositions`, `getSecondsPolicy`, `submitSecondsOrder`, `settleSecondsPosition` (`api.ts:485,520,557,582`).

### 1.3 Earn — fully built (read-only until backend enables actions)
- Route: `/earn` → `EarnPage`, login-gated (`App.tsx:50`).
- `EarnPage` (`Pages.tsx:962-1045`): live catalog (`getEarnCatalog`), product cards (APY, term, early-redemption fee), subscribe form, positions list with redeem; actions gated by `actions_enabled` from backend.
- Also surfaced in Sidebar secondary nav (`Sidebar.tsx:14`) and MyPage quick links (`Pages.tsx:121`).

### 1.4 Contract / Futures — **NOT built**
- No route, no page, no order entry, no positions view, no API client, no admin config tab.
- Only artifact: disabled placeholder card titled **"Futures"** on TradeHub (`Pages.tsx:77`): `<CardTitle>{t("Futures")}</CardTitle><CardDescription>{t("Futures trading is currently unavailable.")}</CardDescription>` + `Badge "Unavailable"`. It is a dashed-border card distinct from the three live product cards.

### 1.5 Non-product features present
Account/assets (`AssetsPage`), orders (`OrdersPage`), deposit/withdraw (`DepositPage`/`WithdrawPage`), KYC (`KycPage`), support chat (`SupportPage`), profile (`MyPage`), settings/security (`AccountSecurityPage`), auth (login/register/2FA/callback/account-setup), admin console (`AdminPage`).

---

## 2. Missing features inventory (for four-product center + Contract trading UI)

1. **Contract product card** in TradeHub — must replace the Futures placeholder with "Contract" and wire to a Contract trading route. (`Pages.tsx:73-77`)
2. **Contract route + page** — no `/contract` (or `/perpetual`) route in `App.tsx:38-58`; no `ContractTradingPage` component.
3. **Contract trading UI** — order ticket (market/limit, leverage, side, quantity), position list with margin/liquidation, order history, funding-rate display, close/reduce-position actions. None exist.
4. **Contract API client** — no functions in `api.ts` for contract markets, positions, orders, leverage, or settlement. `api.ts` exports stop at spot/seconds/earn/account/admin.
5. **Contract admin console** — `AdminPage.tsx` tabs include spot markets and seconds policy (`AdminPage.tsx:999`); no contract markets / leverage / risk config tab.
6. **Contract i18n keys** — locale files contain "Futures"/"Futures trading is currently unavailable." keys (e.g. `en.json:232,133`) but no Contract-product glossary.
7. **Mobile 2×2 grid** — product grid must add base `grid-cols-2` (and verify card button/title alignment) (`Pages.tsx:73`).
8. **e2e tests must be inverted** — current tests assert Futures *visibility*; they must assert exactly four products (Spot/Seconds/Contract/Earn) and assert 2-column mobile layout. (`auth-routes.spec.ts:968-984`, `redesign.spec.ts:213-215`, `responsive-visual-qa.spec.ts`)
9. **Contract navigation entry** — Sidebar/BottomNav currently route only to `/trade-hub` aggregator (`Sidebar.tsx:9`, `BottomNav.tsx:9`); decide whether Contract gets a direct nav entry.

---

## 3. API endpoint inventory consumed by frontend (cross-referenced to `api.ts`)

Base URL: `API_BASE_URL = configuredBase || "/api"` (`api.ts:42`). All requests `credentials: "include"`.

### 3.1 Public / market
| Method | Path | Function (api.ts:line) | Purpose |
|---|---|---|---|
| GET | `/api/market/pairs` | `getSpotMarketPairs` `:56-60` | configured spot pairs |
| GET | `/api/market` | `getMarkets` `:79-83` | live tickers |
| GET | `/api/kline` | `getKlines` `:122,136` | OHLCV candles |
| GET | `/api/depth` | `getOrderBook` `:190,192` | order book |
| GET | `/api/trading/status` | `getTradingStatus` `:181-182` | feature flags (spot entry, etc.) |
| GET | `/api/auth-client-config` | `getAuthClientConfig` `:629-633` | oauth/supabase config |

### 3.2 Spot trading
| Method | Path | Function | Purpose |
|---|---|---|---|
| POST | `/api/order` | `submitSpotOrder` `:210,213` | place limit order |
| POST | `/api/order/cancel` | `cancelSpotOrder` `:223,226` | cancel order |
| GET | `/api/orders` | `getOrders` `:441-442` (via `readAuthenticated`) | order history |

### 3.3 Seconds Contract
| Method | Path | Function | Purpose |
|---|---|---|---|
| GET | `/api/seconds/positions` | `getSecondsPositions` `:485-486` | open + settled positions |
| GET | `/api/seconds/policy` | `getSecondsPolicy` `:520-521` | active policy version |
| POST | `/api/seconds/order` | `submitSecondsOrder` `:557,560-561` | open position |
| POST | `/api/seconds/settle` | `settleSecondsPosition` `:582,585-586` | trigger settlement |

### 3.4 Earn
| Method | Path | Function | Purpose |
|---|---|---|---|
| GET | `/api/earn/products` | `getEarnCatalog` `:407-408` | product catalog + actions flag |
| POST | `/api/earn` | `submitEarnAction` `:419,425-426` | subscribe/redeem |

### 3.5 Account / wallet / support / KYC
| Method | Path | Function | Purpose |
|---|---|---|---|
| GET | `/api/account` | `getAccount` `:351-352` | balances + profile |
| POST | `/api/login`, `/api/login/2fa` | `loginWithUsername` `:669-671`, `completeLogin2fa` `:742-744` | session + 2FA |
| POST | `/api/supabase-login` | `exchangeSupabaseSession` `:656-658` | oauth exchange |
| POST | `/api/account/credentials` (+`/reauth`,`/recover`) | `setBtcboxCredentials` `:682-684`, `reauthenticateBtcboxCredentials` `:694-696`, `recoverBtcboxCredentials` `:706-708` | credential setup/recovery |
| POST | `/api/auth/link-identity` (+`/reauth`) | `linkSupabaseIdentity` `:730-732`, `reauthenticateIdentityForLink` `:718-720` | identity linking |
| POST | `/api/logout` | `logout` `:602,605-606` | end session |
| POST | `/api/kyc` | `submitKyc` `:761,770` | KYC submission |
| GET | `/api/support/messages` | `getSupportMessages` `:781-782` | support chat history |
| POST | `/api/support/chat` | `sendSupportMessage` `:792,799-800` | send support message |
| GET | `/api/addresses`, `/api/addresses/select` | `getSavedCryptoAddresses` `:819-820`, `getSelectedCryptoAddress` `:847-849` | address book |
| GET | `/api/withdrawal/config` | `getWithdrawalConfig` `:856-857` | fees + networks |
| POST | `/api/withdraw` | `submitWithdrawal` `:865,877-878` | withdraw |
| POST | `/api/deposit` | `getDepositAddress` `:892,899-900` | deposit address (POST with coin/network) |

### 3.6 Admin (token-auth, `adminRequest` → `/api/admin/*`, `api.ts:1016-1017`)
`getAdminSession`, `getAdminMemberships`, `manageAdminMembership` (POST `admin/admins/manage` `:1043`), `getAdminStats`, `getAdminUsers`, `getAdminUser`, `getAdminWithdrawals`, `getAdminConfig`, `getAdminSpotMarkets`, `saveAdminSpotMarket` (POST `admin/spot-markets` `:1070`), `getAdminSecondsOpenPositions`, `getAdminSecondsPolicy`, `saveAdminSecondsPolicy` (POST `admin/seconds-policy` `:1126`), `saveAdminConfig` (POST `admin/config` `:1129`), `adminManualCredit` (POST `admin/deposit/confirm` `:1132`), `adminApproveWithdrawal`/`adminRejectWithdrawal`/`adminMarkWithdrawalPaid` (POST `admin/withdraw/*` `:1135-1141`), `getAdminKyc`, `adminApproveKyc`/`adminRejectKyc` (POST `admin/kyc/*` `:1147-1150`), `getAdminAuditLogs`, `getAdminOrders`, `getAdminSupportMessages`, `adminReplySupport` (POST `:1163-1165`).

**Gap:** no contract/perpetual endpoints anywhere in this inventory.

---

## 4. i18n status

### 4.1 Default locale — **Japanese (compliant)**
- `I18nProvider` initial state reads `localStorage.getItem("btcbox-language")` (`i18n.tsx:89`); if absent/invalid returns `"ja"` (`i18n.tsx:93`). First-visit default = Japanese.

### 4.2 Supported locales — **exactly the required 7 (compliant)**
- Union type: `Language = "en" | "ja" | "zh-CN" | "es" | "pt" | "it" | "de"` (`i18n.tsx:11`). Matches required JP/CN/EN/ES/DE/IT/PT.
- `localeTags` BCP-47 map at `i18n.tsx:14`.
- `en`, `ja`, `zh-CN` bundled at build time (`i18n.tsx:38`); `es/pt/it/de` lazy-fetched via Vite `?url` imports (`i18n.tsx:7-10,39,51`) with 10 s timeout and schema validation (every `en` key must exist as non-empty string, `i18n.tsx:53-59`).
- **Key coverage:** all seven active locale files = **947 keys each** (verified by JSON parse count). `loading-messages.json` covers all 7 languages with the 3 loading/error strings. Full parity — no coverage gap.
- **Dead code note:** `src/lib/locales/vi.json` (Vietnamese, 947 keys) exists on disk but is **not imported**, not in the `Language` union, and not loadable. Comment at `i18n.tsx:37`: "the legacy Vietnamese dictionary stays in source." Harmless but should be removed or explicitly retained.

### 4.3 Persistence — **localStorage (compliant)**
- Read at `i18n.tsx:89`; written after successful load at `i18n.tsx:111` (`window.localStorage.setItem("btcbox-language", requestedLanguage)`), explicitly skipped when `fixedLanguage` is set (admin) so admin visits don't clobber customer preference. Cross-visit persistence works.
- No cookie-based fallback; if localStorage is blocked, preference is session-only (comment `i18n.tsx:91`). Acceptable per requirement ("localStorage/cookie must exist").

### 4.4 Manual switch — **two switchers (compliant)**
- `Topbar.tsx:64-88`: dropdown menu (`LANGUAGE_MENU` → `setLanguage`), rendered only when `canChangeLanguage`.
- `AuthPages.tsx:135`: `<select>` on login/register with all 7 options (ja/zh-CN/en/es/de/it/pt).
- `document.documentElement.lang` updated on change (`i18n.tsx:120-122`).

### 4.5 Admin console language — **fixed Chinese (compliant)**
- `App.tsx:68`: `<I18nProvider fixedLanguage={/^\/admin\/?$/i.test(pathname) ? "zh-CN" : undefined}>` — forces `zh-CN` on `/admin`.
- `admin-i18n.ts:1-2`: "Administrator UI uses Chinese independently of the customer locale." `adminText()` returns Chinese strings; `AdminPage.tsx:8` imports it and calls `adminText(...)` 76 times.
- Caveat: `fixedLanguage` regex matches only exact `/admin` or `/admin/`. Admin is a single tabbed page (no sub-routes), so this is fine today; if admin sub-routes are added the regex must widen.

---

## 5. Mobile product-grid layout vs 2×2 requirement

- **Product grid container:** `Pages.tsx:73` — `<div className="grid gap-4 sm:grid-cols-2">`.
- Tailwind `grid` with no `grid-cols-*` at the base breakpoint = **`grid-template-columns: none` → single column**. `sm:grid-cols-2` applies only at **≥640 px**.
- Therefore on all phone viewports (320–430 px, which the e2e matrix iterates: `responsive-visual-qa.spec.ts:5` widths `[320,360,375,390,430,768,1024,1440]`) the four cards render as a **1×4 vertical stack**, violating the required 2×2.
- `index.css` contains no override for this grid. Media blocks at `index.css:138` (`max-width:640px`), `:262` (`min-width:640px`), `:272` (`max-width:639px`), `:336` (`max-width:1279px`) style `.exchange-summary`, `.balance-row`, `.account-actions`, `.exchange-workspace`, `.spot-book-*` — spot trading workspace, not the trade-hub product grid. No `.card-lift` or trade-hub grid rule.
- Card internals: each product card uses `flex flex-wrap items-center justify-between gap-3` for badge+button (`Pages.tsx:74-76`), so buttons/titles are consistent. Fix is a one-class change (`grid-cols-2` at base), but must be accompanied by an e2e assertion.
- **BottomNav** (`BottomNav.tsx:17`) is `grid-cols-5` (5 tabs) — correct, unrelated to product grid.

---

## 6. Four-product red-line compliance — detailed evidence

### 6.1 What the TradeHub actually renders (`Pages.tsx:72-78`)
```
72: return <PageFrame ... title={t("Choose your trading mode")} ...>
73:  <div className="grid gap-4 sm:grid-cols-2">
74:   <Card ...><CardTitle>{t("Spot")}</CardTitle> ... <Link to="/markets">View markets</Link></Card>
75:   <Card ...><CardTitle>{t("Seconds")}</CardTitle> ... <Link to="/seconds">Open</Link></Card>
76:   <Card ...><CardTitle>{t("Earn")}</CardTitle> ... <Link to="/earn">Open</Link></Card>
77:   <Card className="border-dashed ..."><CardTitle>{t("Futures")}</CardTitle>
        <CardDescription>{t("Futures trading is currently unavailable.")}</CardDescription>
        ... <Badge variant="secondary">{t("Unavailable")}</Badge> ...</Card>
78:  </div>
```
- Count = 4 cards, but the fourth is **Futures**, not **Contract**. Required set = {Spot, Seconds, Contract, Earn}; actual set = {Spot, Seconds, Earn, Futures}. **Contract is absent; Futures is present.** Even marked "Unavailable", it is a customer-facing fifth-concept product (the customer forbids a Futures product entry entirely).
- Seconds is correctly labeled **"Seconds"** (`Pages.tsx:75`, route `/seconds`) — no mislabeling as Futures/Contract. Page title is "Seconds contracts" (`Pages.tsx:680`).
- No other product entry points: Sidebar primary = Home/Markets/Trade/Assets/My (`Sidebar.tsx:7-12`), secondary = Orders/Earn/Support/Settings (`Sidebar.tsx:14-19`). BottomNav = Home/Markets/Trade/Assets/My (`BottomNav.tsx:8-13`). MyPage quick links = Deposit/Withdraw/Earn (`Pages.tsx:121`). None add a product.

### 6.2 Tests that currently *enforce* the violation
- `e2e/auth-routes.spec.ts:968` — test name: `"trade chooser exposes the backend-enabled products and keeps unsupported futures unavailable"`. `:980-984` asserts headings **Spot, Seconds, Earn** visible and `page.getByText("Futures", { exact: true }).toBeVisible()`.
- `e2e/redesign.spec.ts:213-215` — after `page.goto('/trade-hub')` asserts `main` contains `/Futures|先物|合约|Futuros|futuros|tương lai|futures/i` (all-language Futures presence).
- These must be rewritten to assert the four-product set + Contract presence + no-Futures, plus a 2-column mobile layout assertion.

---

## 7. React Seconds page vs legacy API — consistency check (red-line 4)

| Concern | React (`frontend/src/lib/api.ts`) | Legacy (`backend/assets/js/app-core.js`) | Backend handler (`backend/api-core.js`) |
|---|---|---|---|
| Open position | POST `/api/seconds/order`, body `SecondsOrderInput{request_id,symbol,direction:"up"\|"down",duration_sec,amount}` (`:557-561`, type `:540-545`) | `secondsOrder` → POST `/seconds/order` body `{symbol,direction,duration_sec,amount,request_id}` (`:411-413`) | `POST /api/seconds/order` (`:2577-2578`) |
| Settle | POST `/api/seconds/settle`, body `{position_id,symbol,request_id}` (`:582-586`) | `secondsSettle` → POST `/seconds/settle` body `{position_id,request_id,symbol}` (`:420-422`) | `POST /api/seconds/settle` (`:2620-2621`) |
| Positions | GET `/api/seconds/positions` (`:485-486`) | `secondsPositionsGet` → GET `/seconds/positions` (`:431-432`) | `GET /api/seconds/positions` (`:2666-2667`) |
| Policy | GET `/api/seconds/policy` (`:520-521`) | (legacy view does not render policy; React is a superset) | `GET /api/seconds/policy` (`:2548-2549`) |

- Field sets match exactly (order of keys irrelevant). `SecondsOrderResult` (`api.ts:547-555`) includes `position_id, symbol, direction, amount, duration_sec, open_price, settle_at, duplicate` — matches legacy reconciliation contract referenced in `backend/tests/smoke.test.js:299-310` (position reconciliation against refreshed snapshot, `POSITION_STATUS_UNCONFIRMED` guard).
- Legacy `views-trading.js` (414 lines) is the old SPA seconds view with localStorage-persisted idempotency intents (`btcbox.seconds.pending.v1.<uid>`, `btcbox.seconds.settlement.v1.<uid>.<positionId>`, `views-trading.js:35-36`). React `Pages.tsx` seconds flow carries equivalent `pendingIntent` guard (`Pages.tsx` submit block; `client_order_id`/`request_id` retry pattern). Consistent.

---

## 8. Frontend test inventory & coverage gaps

### 8.1 Unit (`frontend/tests/`)
- **Only `decimal.test.ts`** (1391 bytes) — decimal arithmetic precision. Run via `node --experimental-strip-types --test tests/decimal.test.ts` in CI (`frontend-ci.yml`).
- No component tests, no `api.ts` tests, no i18n unit tests (i18n validated by `scripts/check-i18n.mjs` + `npm run check:i18n` in CI).

### 8.2 E2E (Playwright, `frontend/e2e/`, 9 specs)
| Spec | Coverage |
|---|---|
| `auth-routes.spec.ts` (69 KB) | auth flows, spot preview, **trade chooser product assertions (currently Futures-enforcing)** |
| `redesign.spec.ts` (15 KB) | responsive spot workspace, logo, **Futures-presence assertion** |
| `responsive-visual-qa.spec.ts` (5.6 KB) | viewport matrix 320–1440 screenshots incl. `/trade-hub`; **no column-count assertion** |
| `language-loading.spec.ts` (7.7 KB) | lazy locale load/failure/retry |
| `market-feed-fail-closed.spec.ts` (9.2 KB) | stale snapshot hides quotes |
| `chart-reliability.spec.ts` | chart rendering |
| `navigation-accessibility.spec.ts` | mobile nav focus/Escape |
| `auth-two-factor.spec.ts` | 2FA |
| `account-read-recovery.spec.ts` | credential recovery |

Projects: `desktop-chromium` + `mobile-chromium` (Pixel 7) (`playwright.config.ts`). Note: Playwright storageState seeds `localStorage btcbox-language=en` — e2e runs in English, does **not** exercise default-Japanese first-visit path.

### 8.3 Coverage gaps
- No test asserts **exactly four products** or **absence of Futures**.
- No test asserts **2-column mobile grid**.
- No test asserts **default locale = Japanese** on first visit (localStorage cleared).
- No Contract/perpetual tests (product doesn't exist).
- No `api.ts` contract/shape tests.

---

## 9. Production build / deploy dependencies

- **Stack:** React 19.0.1, Vite 6.2.3, TypeScript ~5.8.2, Tailwind CSS 4 (`@tailwindcss/vite`), react-router-dom 7.9.2, zustand 5, lightweight-charts 5, lucide-react, @radix-ui primitives, @supabase/supabase-js 2.72 (`package.json:18-35`).
- **Build script:** `npm run build` = `tsc -b && vite build` (`package.json:13`). Output `dist/`. `assetsDir: "frontend-assets"` to avoid colliding with legacy `/assets` (`vite.config.ts:12-21`). Manual chunk: `react-runtime` (`vite.config.ts:17-19`).
- **Node version:** CI pins **Node 22** (`frontend-ci.yml`, `backend-ci.yml`). No `engines` field in `frontend/package.json`; `backend/package.json` has `engines`. Recommend adding `engines.node` to frontend.
- **Deploy:** Vercel — `backend/vercel.json`: `buildCommand: "npm run build && npm test"`, `outputDirectory: "dist"`, with CSP/security headers and rewrites (incl. `/admin.html` → `/admin`, `/auth/callback` → `/auth/react-callback`). CSP `connect-src 'self' https://*.supabase.co https://api.coingecko.com` — contract price feeds (if any external) must be added.
- **CI:** `.github/workflows/frontend-ci.yml` — `npm install` → `check:i18n` → `lint` (tsc --noEmit) → decimal test → `build` → Playwright (chromium) → upload visual-QA screenshots. Trigger branches list does **not** include `feature/four-products` (only `main`, `feature/btcbox-complete-redesign`, `feature/btcbox-react-frontend-20261104`, `feat/btcbox-web3-auth-20261105`, `fix/post-merge-db-bootstrap-seconds-20261106`, `work/btcbox-unified-20261104`) — current branch won't trigger frontend CI on push.

---

## 10. Dependencies & vendor submodules — licenses

- **Frontend package:** MIT (`package.json:5`), description "based on Strata Pro Crypto UI (MIT)".
- **Vendor submodules (`.gitmodules`):**
  - `frontend/vendor/strata-pro` ← `https://github.com/bymilon/strata-pro-crypto-ui.git` (commit `a3f79d0`)
  - `frontend/vendor/shadcn-fintech` ← `https://github.com/abderrahimghazali/shadcn-fintech.git` (commit `a905058`)
  - **Both submodule directories are EMPTY in this checkout** (`git submodule status` prefix `-` = not initialized; `ls` shows `.`/`..` only). Local license files cannot be verified. Upstream repos are typically MIT (strata-pro = MIT per `package.json` description; shadcn-fintech = MIT per shadcn ecosystem convention) — **must confirm after `git submodule update --init` and retain LICENSE/NOTICE.** `frontend/LICENSE`, `frontend/NOTICE`, `frontend/NOTICE.md` exist; `SOURCE_AND_LICENSE.txt` (repo root) documents the cenksari react-crypto-exchange MIT origin.
- No `node_modules` present; no lockfile at `frontend/package-lock.json` (CI uses `npm install`, not `npm ci`, for frontend — non-deterministic installs; backend uses `npm ci`). Recommend adding a frontend lockfile and `npm ci`.

---

## 11. Risks / open issues

1. **Red-line 1 + 2 violations are live on `feature/four-products`** despite the branch name. Must fix before any customer-facing deploy.
2. **e2e tests encode the wrong product set** — removing Futures will break `auth-routes.spec.ts:984` and `redesign.spec.ts:215`; tests must be updated in the same change.
3. **Contract trading UI is a greenfield build** — no route, no page, no API client, no admin tab, no i18n keys. Largest missing surface.
4. **Submodules not initialized** — vendor license verification pending; build may reference vendor assets (check import paths — no `vendor/` imports found in `src/` during this audit, so likely vendored as reference only, but confirm).
5. **`feature/four-products` not in CI trigger list** — frontend CI won't run on this branch's pushes.
6. **`vi.json` dead locale** — either wire it in or delete; `check:i18n` may or may not cover it (script not executed in this audit).
7. **Admin `fixedLanguage` regex** is exact-path only (`/^\/admin\/?$/`); if admin sub-routes are introduced, customer locale could leak into admin.
8. **CSP `connect-src`** (`vercel.json`) must include any new contract/price-feed origins.
9. **Playwright seeds `en` locale** — default-Japanese path untested.
10. **`getDepositAddress` is a POST** (`api.ts:899-900`) — unusual; confirm backend contract (idempotency). Not a frontend bug but worth flagging to backend audit.

---

*End of frontend audit. All citations are `file:line` against the working tree on `feature/four-products` at audit time.*
