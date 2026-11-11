# Public market no-placeholder-data handoff — 2026-11-07

## Owner and branch
- Owner: 2号 AI — Web App + Admin Panel
- Branch: `fix/public-market-no-placeholder-data-20261107`
- Base: `main` at `2a3810da1aef2c0c7c58df0cfdb059a212eeb0d6`
- Intended integration target: `work/btcbox-unified-20261104`
- No merge to `main`, deployment, production environment change, database write, or real order was performed.

## User-facing requirement
The public website must not present demo wording, simulated market values, zero-filled quote rows, or stale prices as if they were current exchange data. When the real provider feed is unavailable, show a concise unavailable/updating state and no quote values.

## Source findings
- `backend/assets/js/app-core.js` initializes the supported pair catalog with zero values while the first provider response is pending.
- `backend/assets/js/views-home.js` previously rendered every supported pair in the public Markets table, formatting those initial zero values as market prices.
- The home dashboard could retain old market values after an incomplete or failed refresh.
- `backend/assets/js/views-trade.js` used a direct price formatter for the desktop chart header and displayed wording about simulated data in the unavailable order-book state.

## Changes
- Market payload parsing now counts only records with a valid positive price from the current response.
- Pairs omitted from a provider response are cleared rather than retaining an old quote. Empty/invalid responses and request failures clear all current quotes and set the feed unavailable.
- Live price, change, 24h high and 24h low elements render an em dash when no current quote exists.
- Public Markets lists only pairs with a positive quote from the current successful provider response. An empty list shows a concise feed-unavailable state rather than zero rows.
- Home market cards and pair counts update when the provider refresh completes and exclude unavailable quotes.
- Trade headers use validated quote formatters; unavailable order-book/recent-trade messages no longer mention simulated data or backend implementation details.
- Vite dashboard now clears stale market rows on refresh failure; the market table suppresses quotes whenever its feed reports an error and removes the stale-data banner/metadata from that state.
- Customer-facing copy no longer describes orders as sample/simulated or says they are never simulated in the browser; empty order history uses ordinary account wording.
- Removed visible Preview and API-verification-pending badges from the customer navigation, and replaced scaffolded/in-preview section copy with a neutral unavailable state.
- Removed remaining sample-order wording from the alternate Orders page.
- Backend order-book cache is cleared when the current depth provider refresh fails.
- Added Playwright coverage for a real quote followed by a failed refresh and for an empty market response, plus source-contract checks for customer-facing wording.
- Added regression coverage for invalid/empty provider payloads, missing pairs, and public UI placeholder suppression.

## Verification
- Source review and branch diff performed.
- Automated tests have been added. Exact-head backend and frontend CI are **PENDING** after the latest Vite follow-up commits.
- Browser/visual QA, live provider freshness in Preview, and production runtime behavior remain **NOT VERIFIED**.
- CI must pass on the exact PR head before this batch is accepted.
- Do not interpret source-level changes as proof that the live provider is currently healthy.
