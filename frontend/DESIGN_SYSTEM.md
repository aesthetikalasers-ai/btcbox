# BTCBOX Frontend Design System

Status: implementation standard for the mature UI foundation branch.
Scope: visual system and responsive component behavior only. Business API contracts and financial safety controls are out of scope.

## 1. Design principles

- Design once, reuse everywhere. Page files compose shared primitives; they do not invent new button, card, radius, or spacing rules.
- Prefer mature, maintained React components with compatible licenses and dependencies. Adapt source components to BTCBOX; do not transplant another product's mock data, auth, trading engine, or API assumptions.
- Preserve the existing BTCBOX Vite + React + TypeScript + Tailwind 4 stack. Do not replace the build stack to accommodate a reference project.
- Real market/account data only. Empty, loading, unavailable, and pending states must be explicit; never present demo balances or fake order success as live data.
- Keep keyboard focus, accessible labels, reduced-motion behavior, and minimum touch targets.

## 2. Responsive layout ranges

Use fluid layouts and the project's Tailwind breakpoints. These ranges describe expected behavior, not device-specific user-agent detection.

| Viewport width | Layout behavior |
| --- | --- |
| 320–359 px | Compact single column; 12 px page gutters; no secondary columns |
| 360–389 px | Standard phone; 16 px gutters; full-width primary actions |
| 390–430 px | Large phone; 16–20 px gutters; allow more breathing room, not oversized controls |
| 431–639 px | Narrow tablet / large phone; centered content with max-width |
| 640–767 px | Small tablet; 20–24 px gutters; retain single-column forms |
| 768–1023 px | Tablet; 24 px gutters; two-column cards only when each column remains usable |
| 1024–1279 px | Compact desktop; desktop navigation and constrained content |
| 1280–1535 px | Desktop; full dashboard composition |
| 1536 px and above | Wide desktop; cap content width rather than stretching cards and tables |

Tailwind breakpoint mapping: sm 640, md 768, lg 1024, xl 1280, 2xl 1536. Do not add one-off breakpoints for named phone models.

## 3. Global spacing and shape tokens

- Page gutters: 12 px at 320–359; 16 px from 360–639; 24 px from 640–1023; 28–32 px from 1024 upward.
- Main section spacing: 20–24 px on phones; 24–32 px on larger screens.
- Card internal padding: 16 px on phones; 20 px from tablet; 24 px on desktop. Dense data cards may use 12 px only when content remains readable.
- Card radius: 12 px standard; 16 px for prominent summary surfaces. Avoid mixing arbitrary radii on the same page.
- Control radius: 8–12 px, consistently by component family.
- Borders use the existing brand-border tokens; elevation is subtle and reserved for layered surfaces.
- Use 4 px spacing increments; avoid arbitrary per-page gaps unless content density requires it.

## 4. Typography hierarchy

Use the semantic classes already introduced in `frontend/src/index.css`:

| Role | Class | Target |
| --- | --- | --- |
| Hero / major balance | `.type-display` | 28–36 px, strong |
| Page title | `.type-page-title` | 22–26 px |
| Section title | `.type-section-title` | 16 px |
| Card title | `.type-card-title` | 15 px |
| Body | `.type-body` | 15 px |
| Compact body | `.type-body-compact` | 14 px |
| Control / field label | `.type-label` | 13 px |
| Metadata | `.type-meta` | 12 px |
| Micro annotation | `.type-micro` | 11 px; never for key values or actions |
| Financial value | `.type-price` | 20–28 px, tabular numerals |

Do not shrink body copy to solve layout overflow. Wrap, stack, abbreviate only with an accessible full label, or change the layout.

## 5. Shared component contract

- Buttons: default 44 px high, small 40 px only for secondary dense contexts, large 48 px, icon button at least 44 × 44 px. On touch-first primary actions prefer 48 px. Do not use small buttons for the only critical action.
- Inputs/selects: minimum 44 px control height; keep mobile text at least 16 px to prevent browser zoom.
- Cards: use shared Card primitives and semantic padding classes; avoid per-page custom card geometry.
- Badges: status-only, concise, never the sole indicator of success or failure.
- Dialogs/drawers: constrain to viewport height, support internal scrolling, preserve safe-area insets and keyboard focus.
- Tables: provide a deliberate mobile row/card representation or a contained horizontal scroller; never silently clip essential columns.
- Navigation: stable tap targets, clear active state, safe-area padding at the bottom.

## 6. Mobile and browser requirements

- Respect `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` for fixed navigation and overlays.
- Prefer dynamic viewport units where appropriate; test browser chrome expansion/collapse.
- Support portrait and landscape without fixed-width content assumptions.
- Test browser text scaling and long translated strings across all seven locales: en, ja, zh-CN, es, vi, it, pt.
- Prevent horizontal page overflow; intentional table/chart scrolling must remain local to its component.
- Do not rely on hover for essential actions.

## 7. Required visual QA matrix

Check at minimum: 320, 360, 375, 390, 414, 430, 768, 1024, 1280, and 1536 px.

For each representative page verify:
- no page-level horizontal overflow or clipped text;
- cards align to a consistent grid and use consistent padding/radius;
- primary buttons are at least 44 px high and reachable;
- long labels and translated copy wrap without collisions;
- prices use tabular numerals and remain visually primary;
- loading, error, empty, unavailable, and pending states are distinguishable;
- bottom navigation and dialogs respect safe areas;
- desktop tables and mobile representations show equivalent essential information.

A passing CI build is not a substitute for visual QA on a rendered preview.

## 8. Reference and license handling

Initial visual references:
- bymilon/strata-pro-crypto-ui (MIT): dashboard hierarchy, sidebar/topbar, chart and analytics composition. It is a frontend demo with mock data, not a production market-data or trading backend.
- openexch/trading-ui (Apache-2.0): trading workspace patterns such as order book, order form, trades, and responsive trading layout. Its service contracts are not BTCBOX contracts.

Before copying any source file, verify the current upstream license and retain required notices. Prefer adapting isolated components and patterns over copying entire applications. Document provenance for every copied source component.
