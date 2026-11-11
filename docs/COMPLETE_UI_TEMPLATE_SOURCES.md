# Complete UI template sources

The full upstream repositories are pinned as Git submodules so implementation agents can inspect every page, component, stylesheet, asset and original configuration without a lossy partial copy.

## Pinned sources

| Local path | Upstream | Pinned commit | License |
|---|---|---|---|
| `frontend/vendor/strata-pro` | https://github.com/bymilon/strata-pro-crypto-ui | `a3f79d0237c68faddc877f8c1b00afece2fbbae8` | MIT |
| `frontend/vendor/shadcn-fintech` | https://github.com/abderrahimghazali/shadcn-fintech | `a905058c75a840896d27a16991f2e7cc1ca06f3f` | MIT |

## Integration rules

- These are complete upstream source repositories pinned to immutable commits; they are source inputs, not yet BTCBOX runtime pages.
- Strata Pro is the primary source for market/trading presentation.
- shadcn-fintech is the source for account, authentication-screen, settings, transaction and support patterns.
- BTCBOX remains the system of record: Supabase auth/session, APIs, real market/account data and all business/financial behavior.
- Do not wire template demo/seed/mock data, Clerk auth, or demo transfers/trades into BTCBOX.
- Adapt Next.js-specific shadcn-fintech components to the existing Vite/React app; do not import its app router or Clerk integration.
- Preserve both upstream MIT license files and notices when porting source.
- Preserve the locked Spot trading-page layout and BTCBOX API/business contracts.
