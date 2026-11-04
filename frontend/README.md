# BTCBOX Frontend

Separate React 19 + Vite + TypeScript frontend based on [Strata Pro Crypto UI](https://github.com/bymilon/strata-pro-crypto-ui). Upstream is MIT-licensed; see [LICENSE](./LICENSE). shadcn/ui config and base components are included.

Run: `cd frontend && npm install && npm run dev`. Validate: `npm run lint && npm run build`.

This app does not replace `../backend`. Charts and token rows still use sample data and are visibly labeled as preview. Do not represent them as live market data or enable trading until the BTCBOX API adapter and acceptance tests are implemented. Keep current Vercel backend settings unchanged until separately reviewed.
