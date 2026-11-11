# BTCBOX Mobile Product Design Specification

**Version:** 1.0  
**Status:** Design baseline for implementation and review  
**Reference board:** [BTCBOX mobile design board](./btcbox-mobile-design-board.svg)  
**Product:** BTCBOX digital-asset exchange  
**Default first-visit locale:** Japanese, while honoring a user's saved supported locale  
**Scope:** Progressive improvement of the existing product; not a rebuild.

> The SVG is a structural and visual reference. It is not a pixel-perfect implementation mandate. All labels shown in the board are illustrative; production copy must come from the existing locale dictionaries. Preserve existing business logic and reuse existing components wherever possible.

## 1. Product intent

BTCBOX should feel like a mature, trustworthy digital-asset exchange: professional, restrained, data-first, fast to understand, and comfortable to use on a phone.

The visual direction is a dark financial interface with a deep navy foundation, controlled brand-blue accents, clear market figures, consistent token marks, and semantic gain/loss colors. Avoid the appearance of a generic SaaS admin dashboard or a promotional landing page.

### Design principles

1. **Data before decoration.** Prices, percentage changes, balances, volume and order actions have higher visual priority than marketing copy or decorative cards.
2. **Dense, not cramped.** Prefer compact rows and clear alignment; retain enough vertical spacing and touch area for mobile use.
3. **One visual language.** Shared color tokens, typography, icon style, borders, radii, spacing and feedback patterns across all routes.
4. **Honest state.** Loading, stale data, unavailable services and errors must be explicit. Never simulate live market movement.
5. **Locale integrity.** Japanese, English and Simplified Chinese must each be complete. Do not mix languages within a selected locale, except standard financial symbols and terms.
6. **Progressive improvement.** Reuse the current application architecture, APIs, components and completed work. Do not restart or replace functioning modules without evidence and approval.

## 2. Global visual system

The values below are a proposed baseline. Before implementation, map them to existing CSS variables/design tokens where possible rather than introducing a competing token system.

| Token | Proposed value | Use |
|---|---|---|
| App background | #081426 | Main mobile canvas |
| Raised surface | #10233D | Panels, menus, compact cards |
| Recessed surface | #0B1B30 | Lists and chart backgrounds |
| Brand accent | #38BDF8 | Active navigation, links, focus, primary accent |
| Positive | #00D49A | Gains and successful states |
| Negative | #FB7185 | Losses and destructive warnings |
| Primary text | #F4F8FF | Main labels and figures |
| Secondary text | #A8BAD0 | Supporting labels |
| Muted text | #8298B2 | Metadata and inactive controls |
| Divider | #1B3552 | Subtle separators and outlines |

### Color and semantic rules

- Use green and red only for their semantic meaning; do not use them as unrelated decoration.
- Brand blue identifies interaction and active state, not profit/loss.
- Keep surfaces distinct through restrained tonal contrast and subtle separators, not thick borders and nested cards.
- Maintain readable contrast for small labels and disabled states.
- Do not use color alone to communicate a state; include a sign, label, icon or accessible text.

### Typography and figures

- Use the project's existing Japanese-capable font stack; verify Japanese glyph coverage on real devices.
- Use tabular numerals for prices, balances, percentages, quantities and timestamps.
- Align prices and percentages consistently within lists.
- Main market price is the strongest figure; pair name and metadata are secondary.
- Avoid oversized marketing headlines on functional screens.
- Do not shrink text below comfortable mobile readability to fit more rows.

### Shape, spacing and motion

- Use modest corner radii consistently. Avoid turning every row into a large rounded card.
- Prefer compact list rows with subtle separators.
- Establish spacing with a small consistent scale and reuse existing utilities.
- Motion should communicate a real state transition only: route change, menu opening, loading, or a price update received from the data source.
- Respect prefers-reduced-motion. Never pulse a “live” indicator when the data feed is stale or disconnected.

## 3. Mobile information architecture

The mobile application has five primary destinations: Home, Markets, Trade, Assets and My account.

Use the existing bottom-navigation component and route structure where possible. The active destination uses the brand accent; inactive destinations remain muted. Preserve the fixed navigation height and safe-area behavior already implemented. Content must have sufficient bottom inset so the navigation never covers the last actionable row.

### 3.1 Home

**Purpose:** Let a visitor or customer understand the market immediately and move to a relevant action.

**Recommended order:**
1. Compact top bar: BTCBOX mark, search or notification only if functional, and account entry.
2. Short localized market greeting/summary; avoid a large marketing hero.
3. One compact market snapshot for the leading asset or market-wide summary.
4. A Top markets list with token mark, symbol/name, latest price and 24-hour change.
5. A concise See all markets action.
6. Optional market news/insight only if backed by real content and not pushing market rows below the fold.

**Rules:**
- Do not place a full technical-analysis chart on Home.
- Remove duplicate hero CTAs and redundant feature cards.
- A signed-in user should see useful market/account actions, not registration prompts.
- A signed-out visitor may see sign-in/register actions, but must still be able to browse public market data and reach help/support.
- Above-the-fold content should contain useful market information on common phone widths.

### 3.2 Markets

**Purpose:** A discoverable market list and the home of market analysis.

**Recommended order:**
1. Page title and search.
2. Market category/filter controls (only categories supported by the actual catalog).
3. Compact market list with symbol, localized asset name, price, 24-hour change and volume where available.
4. Market-analysis/chart section for the selected market, positioned as a first-class section rather than buried at the bottom.
5. Timeframe controls and indicators only when supported by the existing chart implementation.
6. Market depth/order-book entry where supported.

**Rules:**
- K-line/market-analysis content belongs on Markets, not as a large Home section.
- On a narrow phone, the chart may use a compact selected-pair header and a clear expand/full-screen action.
- Keep list rows compact but readable; do not split every metric into a separate large card.
- Clearly identify data source/time or stale state where the API exposes it.
- Empty or unavailable markets must show an honest empty/unavailable state, not fabricated tickers.

### 3.3 Trade — locked layout

**Critical boundary:** The existing BTCBOX trading-page layout is locked.

- Do not rearrange the trading screen's major regions, buy/sell panels, order form, order book, open orders or execution controls.
- Do not replace its workflow with the illustrative Trade phone on the reference board.
- Only make explicitly scoped bug fixes, accessibility corrections, token/icon consistency changes or small responsive fixes that preserve the established layout.
- Any proposed structural change requires separate owner approval before implementation.

### 3.4 Assets

**Purpose:** Make holdings and fund actions understandable and safe.

**Recommended order:**
1. Total estimated balance and denomination.
2. Today's change only if calculated from a reliable source.
3. Deposit and withdraw actions, shown only when the corresponding capability is genuinely enabled.
4. Holdings list with token mark, symbol, quantity and estimated value.
5. Recent activity/transaction history.
6. Security and availability notices where relevant.

**Rules:**
- Never imply a deposit, withdrawal or settlement is automatic if the current backend process is manual.
- Show unavailable actions as unavailable with an explanation, or omit them according to existing product policy; do not route to a fake flow.
- Use explicit confirmation and result states for financial actions.
- Format amounts and currencies consistently and avoid misleading precision.

### 3.5 My account

**Signed-in state:** account identity/status, account information, security settings, identity verification/KYC status, order history, customer support, language and appearance settings, and sign out.

**Signed-out state:** sign-in and create-account entry points, public help/support entry, language selection, and no fabricated account data.

**Rules:**
- Authenticated users must never see the signed-out registration panel as their account home.
- The page must render from the authoritative auth/session state, not a stale local visual flag.
- Support must be reachable by guests; do not force a registration redirect merely to open support.
- Sensitive actions may require authentication, but the support entry and public help content should not.

## 4. Authentication, navigation and feedback requirements

These are functional acceptance requirements, not visual suggestions.

1. After successful registration/sign-in, resolve the session and navigate to the intended destination or the agreed account landing route.
2. Route changes, page refreshes and browser back/forward must not accidentally discard a valid session.
3. Auth guards must distinguish loading, authenticated, anonymous and error states; do not treat “session still initializing” as anonymous.
4. OAuth callback processing must be idempotent and must not bounce repeatedly between register/login routes.
5. Prevent duplicate submissions while a request is in progress.
6. Show clear progress feedback immediately; on timeout/failure, show an actionable message and retry path.
7. Do not leave an indefinite spinner with no explanation.
8. Preserve the intended redirect destination safely; do not accept unsafe external redirect URLs.
9. Customer support must not inherit the registration route guard unless a specific protected support action requires authentication.

## 5. Market-data behavior

- Use the existing approved market data API/provider; do not add an unapproved source simply for visual movement.
- Display a quote timestamp/source/age if the API exposes it.
- Poll at the interval already established by the application and backend constraints; do not create multiple competing poll loops.
- Use per-request cancellation and timeout behavior consistent with the existing market implementation.
- A price flash may indicate a real changed quote, but must not imply a change when the payload is unchanged.
- When a request fails, mark data stale or show an error state; do not present an old quote as freshly updated.
- Avoid full-row layout shifts when a number changes; reserve consistent widths and use tabular numerals.
- Verify update behavior using actual response timestamps and values, not a screenshot or animation alone.

## 6. Responsive layout requirements

Treat mobile as its own information hierarchy, not a scaled desktop layout.

- Validate at 320, 360, 375, 390 and 430 CSS-pixel widths, plus a tablet breakpoint.
- Keep primary actions reachable without excessive scrolling.
- Use compact navigation labels and consistent icon geometry.
- Preserve the current fixed bottom-nav height and safe-area insets.
- Prevent horizontal overflow, clipped token names, truncated prices and chart controls colliding.
- Use progressive disclosure for secondary analytics and dense metadata.
- Maintain touch targets appropriate for mobile interaction.
- Keep the existing desktop layout unless the task explicitly includes desktop changes.
- Do not make desktop-only controls disappear on mobile unless the equivalent action remains available.

## 7. Localization requirements

- Japanese is the first-visit default, unless the user has a saved supported locale.
- A saved locale must persist across routes and reloads.
- Each locale dictionary must have unique keys and complete coverage for all visible labels, errors, empty states, buttons, navigation and support entry points.
- Do not hardcode English labels in page components when the locale system is available.
- Use Japanese financial wording naturally; preserve standard symbols such as BTC, USDT, 24H and common technical abbreviations where appropriate.
- Keep automated tests deterministic by explicitly setting their test locale; separately test the clean first-visit Japanese default.

## 8. Scope and delivery plan

This project has a limited execution window. Prioritize defects and high-impact improvements; do not promise a complete redesign in a four-hour session.

### Priority 0 — release-blocking usability
- Correct authenticated vs signed-out account rendering.
- Fix session persistence and auth-route bounce.
- Fix support entry routing for guests.
- Improve slow/indefinite auth feedback and duplicate submission behavior.

### Priority 1 — high-impact mobile improvements
- Make Home market-first and remove duplicate/promotional content.
- Keep K-line/analysis on Markets and make it easy to discover.
- Improve compact market rows and numerical hierarchy.
- Confirm genuine quote refresh and stale-state behavior.
- Remove mixed-language UI in the selected locale.

### Priority 2 — consistency polish
- Align colors, typography, icons, separators and radii with the existing design tokens.
- Refine spacing and responsive behavior.
- Improve loading/empty/error/success feedback.
- Do not spend time on decorative animation before functional issues are resolved.

### Suggested four-hour focus window

This is a triage plan, not a guarantee that all issues can be fully completed in four hours:

| Timebox | Focus | Required outcome |
|---|---|---|
| 0:00–1:00 | Auth/account/support triage and fixes | Reproducible core flows work or blockers are documented |
| 1:00–2:00 | Home/Markets hierarchy | Home is market-first; chart is discoverable on Markets |
| 2:00–3:00 | Mobile consistency and locale | High-impact layout and language issues fixed |
| 3:00–4:00 | Focused regression and evidence | Auth, support, key routes and mobile smoke tests recorded |

If a deep backend/provider defect exceeds the timebox, do not fake completion. Record the exact blocker, owner and next action.

## 9. Protected implementation boundaries

- Keep the current GitHub + Vercel + Supabase architecture.
- Follow the repository's single active integration candidate and the current docs/AI_COORDINATION.md.
- Reuse existing components and API contracts wherever possible.
- Respect team file ownership.
- Preserve the locked Trade page layout.
- No production database writes, destructive SQL, real financial operations, merge to main or production deployment without the required owner authorization.
- Do not merge stale feature branches wholesale or replay already absorbed changes.
- No mock balances, fake live prices, fake KYC states, fake support success or placeholder execution flows.

## 10. Acceptance checklist

### Functional
- [ ] Register and sign in complete with clear progress and error feedback.
- [ ] A signed-in user sees the authenticated account page.
- [ ] Session survives route navigation and refresh.
- [ ] OAuth callback does not loop between auth pages.
- [ ] Guest support opens without a forced registration redirect.
- [ ] Market quote refresh is verified against real response timestamps.
- [ ] Stale/error states are honest and visible.
- [ ] Financial actions reflect actual backend availability.

### Visual and responsive
- [ ] Home shows useful market information early.
- [ ] K-line analysis is discoverable on Markets.
- [ ] Mobile layout is purpose-designed, not desktop-shrunk.
- [ ] Prices and percentages align and remain stable when updated.
- [ ] No clipped content or bottom-nav overlap at target widths.
- [ ] Design tokens and icon styles are consistent.
- [ ] Trade page's locked structure is unchanged.

### Localization
- [ ] First-time visitor receives Japanese.
- [ ] Saved supported locale persists.
- [ ] No mixed-language labels in the selected locale.
- [ ] Locale dictionaries pass duplicate/missing-key checks.

### Evidence
- [ ] Record exact commit SHA.
- [ ] Record tests and their exact result.
- [ ] Record screenshots/viewports reviewed.
- [ ] Mark anything not exercised as NOT VERIFIED.
- [ ] Do not treat CI route smoke tests as independent visual acceptance.

---

**Final product test:** A user should understand the market quickly, navigate without being sent back to registration, access support, trust the displayed data, and complete supported account tasks comfortably on a phone — while the existing trading-page structure and completed project work remain protected.
