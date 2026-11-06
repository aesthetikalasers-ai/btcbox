# BTCBOX source recovery

Recovery branch: `recovery/btcbox-all-sources-20261106`
Base: `feat/btcbox-strata-theme-batch-20261105` at `0b93b1a5c77aaff5420ab1bbdf2f5c9eec5f88de`

This branch restores the complete source repositories as pinned Git submodules in one BTCBOX checkout. It also retains the 14 Strata theme/live-market commits that were not present on `main`.

## Pinned sources

| Local path | Repository | Pinned commit | Purpose |
|---|---|---|---|
| `frontend/vendor/strata-pro` | `bymilon/strata-pro-crypto-ui` | `a3f79d0237c68faddc877f8c1b00afece2fbbae8` | Full trading UI source |
| `frontend/vendor/shadcn-fintech` | `abderrahimghazali/shadcn-fintech` | `a905058c75a840896d27a16991f2e7cc1ca06f3f` | Full fintech/account UI source |
| `references/btcbox-v33` | `avali9308-code/btcbox-v33` | `d2702086ce217fa365f8a77fe4e55b5766ebbe62` | Latest recovered v33 business implementation branch |
| `references/source-archives` | `avali9308-code/BTC` | `c6c8e79862046d75430c897a369fafae31dc5601` | Original downloaded source archives and reference material |

## Checkout

```bash
git clone --recurse-submodules --branch recovery/btcbox-all-sources-20261106 https://github.com/avali9308-code/btcboxcdt.git
```

For an existing clone:

```bash
git submodule update --init --recursive
```

## Recovery boundary

- Runtime candidate remains the existing `frontend/` React/Vite application and BTCBOX backend.
- Complete upstream source repositories are available as pinned checkouts for selective integration.
- The v33 application is retained intact as a reference source; its separate app/backend architecture must be reviewed before runtime files are copied.
- No production branch, deployment, database, secrets, or financial data were changed.
- No submodule is automatically included in the production build.
- Do not merge this recovery branch into `main` until source inventory, build checks, and integration review are complete.

## Verified findings to carry into the next audit

- The React/Vite route file still labels Spot, Seconds, account, deposit, withdrawal, login and register integrations as pending/placeholders.
- The full Strata Pro and Shadcn Fintech repositories are not yet runtime-integrated.
- The v33 feature branch contains manual deposit/withdrawal and seconds-contract business work, but also many migration-focused commits. Only relevant business code should be selectively ported; do not carry the rejected migration work forward.
- The v33 backend is a separate vanilla-JS app/API structure and must not overwrite the BTCBOX React/Vite app or backend.
- Vercel runtime root and production readiness remain unverified; do not deploy from this branch.
