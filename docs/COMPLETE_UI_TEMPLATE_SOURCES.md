# Complete UI template sources

The full upstream repositories are pinned as Git submodules so implementation agents can inspect every page, component, stylesheet, asset and original configuration without a lossy partial copy.

## Pinned sources

| Local path | Upstream | Pinned commit | License |
|---|---|---|---|
| `frontend/vendor/strata-pro` | https://github.com/bymilon/strata-pro-crypto-ui | `a3f79d0237c68faddc877f8c1b00afece2fbbae8` | MIT |
| `frontend/vendor/shadcn-fintech` | https://github.com/abderrahimghazali/shadcn-fintech | `a905058c75a840896d27a16991f2e7cc1ca06f3f` | MIT |

## Clone for implementation agents

Use a recursive clone so both complete source trees are checked out:

```bash
git clone --recurse-submodules --branch feat/btcbox-unified-template-migration-20261105 https://github.com/avali9308-code/btcboxcdt.git
```

If the repository is already cloned:

```bash
git submodule update --init --recursive
```

## Integration rules

- These are complete upstream source repositories, pinned to immutable commits; they are not yet merged into the BTCBOX runtime.
- Inspect the full source before deciding which screens/components replace current BTCBOX screens.
- Strata Pro is the primary source for market/trading presentation.
- Shadcn Fintech is the source for account/dashboard/settings and related financial UI patterns.
- BTCBOX remains responsible for Supabase auth/session, API contracts, real market/account data and all business/financial behavior.
- Do not wire upstream demo/seed/mock data, Clerk auth, or demo transfers/trades into BTCBOX.
- Adapt Next.js-specific Shadcn routes/components to the existing Vite/React app only after reviewing dependencies and assets.
- Preserve both MIT license files and notices.
- Do not change root/Vercel build settings, merge, or deploy as part of source acquisition.
