# BTCBOXCDT deployment blocker — 2026-11-07

## Scope and safety

- Repository: `avali9308-code/btcboxcdt`
- Coordination branch: `work/btcbox-unified-20261104`
- Vercel project: `btcboxcdt` (`prj_rmwOE9q0XyZ3BikpxX2FzDt2VjKK`)
- Team: `BOX` / Hobby plan
- This batch changed one Vercel build setting only. It did not create a deployment, promote an alias, merge a PR, or access production financial data.

## Source-observed evidence

- The latest deployment inspected before the configuration correction was `dpl_ELZ73yuhyU15pytc9UmRV4B5VcpZ`.
- It targeted production from `main` at commit `fa4513701af75b4c4cb39d60a3df08f07d632af4`.
- Deployment state was `ERROR`, with `errorCode=ENOENT`.
- Build logs show Vercel ran the install command `npm --prefix frontend install` from the backend project root. npm consequently looked for `/vercel/path0/backend/frontend/package.json`, which does not exist.
- `backend/package.json` defines the build script as `npm --prefix ../frontend install --no-audit --no-fund && npm --prefix ../frontend run build && node scripts/build-site.js`. Therefore the frontend installation is already correctly handled by the backend build script using the sibling path.
- `backend/vercel.json` sets the build command to `npm run build && npm test` and output directory to `dist`.

## Configuration correction applied

- Updated the Vercel project's install command from the failing frontend-relative command to `npm install`.
- This lets the install phase run in the backend root; the backend build script then installs and builds the sibling `../frontend` directory using its correct relative path.
- The Vercel settings update succeeded at 2026-11-07. No deployment was triggered, consistent with the release pause.

## Not yet verified

- No post-change deployment has been run, so the correction is not yet build-verified.
- Production hostname behavior and the deployed API response freshness remain unverified.
- The latest production deployment before the correction was built from `main`, not from the coordination branch. Do not infer that branch changes are live.
- No claim is made that this deployment issue alone explains all reported stale-market behavior.

## Next safe batch

1. When release testing is authorized, create one controlled preview deployment from the intended commit and verify install/build/test output.
2. Confirm `/api/market`, `/api/depth`, and `/api/kline` return changing, timestamped provider data; inspect response cache headers and provider source.
3. Only after preview verification and independent QA should production release be considered. Do not place real orders or write financial data during QA.
