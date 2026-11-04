# BTCBOX frontend design system adoption

## Purpose

Rebuild the BTCBOX frontend on top of a coherent, responsive design system instead of continuing isolated page-level styling fixes. This work is intentionally limited to the frontend presentation and interaction layer. Existing BTCBOX API contracts, authentication boundaries, and financial safety controls remain authoritative.

## Upstream references reviewed

- [Strata Pro Crypto UI](https://github.com/bymilon/strata-pro-crypto-ui) — MIT. Reference for the React/Vite crypto dashboard shell, spacing rhythm, chart/table composition, and restrained dark terminal surfaces. Its README explicitly describes its market data as mock/demo data; none of that data is to be reused as BTCBOX production data.
- [Open Exchange Trading UI](https://github.com/openexch/trading-ui) — Apache-2.0. Reference for exchange-specific interaction patterns: order book, order entry, trades, open orders, connection state, and mobile navigation. Its API/WebSocket endpoints target a separate matching-engine stack and must not be copied as BTCBOX endpoints.

The upstream projects are references and selective component sources, not drop-in replacements for the BTCBOX application.

## BTCBOX implementation decisions

1. Preserve the existing React application, routing, API client, Supabase authentication integration, and Vercel deployment configuration.
2. Use one semantic token system for surfaces, text, borders, accent, buy/sell states, focus rings, radii, and elevation.
3. Keep action hierarchy consistent: primary actions use the accent fill; secondary actions use a raised surface; destructive actions use the semantic danger color; icon controls have consistent hit areas.
4. At phone widths (320–430px), prioritize stacked content and compact market rows rather than forcing desktop tables to scroll horizontally.
5. Keep desktop information density where appropriate, but use consistent row heights, typography, and column alignment.
6. Do not render mock balances, fake orders, fabricated success states, or sample prices. Data must come from BTCBOX APIs; disconnected workflows remain explicitly pending.
7. No changes to production financial flags, database permissions, order matching, deposit, or withdrawal execution are part of this UI foundation.

## Attribution and license handling

When code is copied or substantially adapted from Strata Pro, retain its MIT copyright and license notice in the repository. When code is copied or substantially adapted from Open Exchange, retain its Apache-2.0 license and required notices. Purely visual inspiration does not imply copying source code. Before importing individual source files, inspect their headers, dependencies, and any third-party notices.

## Verification gate

A Vercel preview being READY is not equivalent to UI or business acceptance. Before merge, verify builds and tests, then inspect the rendered experience at 320, 360, 375, 390, 414, 430, 768, 1024, and desktop widths. Check overflow, tap target placement, text clipping, navigation, loading/error/empty states, and API truthfulness. Do not merge or deploy to production until the checks have passed.
