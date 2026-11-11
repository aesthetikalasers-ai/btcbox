# BTCBOX Perpetual / Four-Products — Risks & Unfinished Items (honest)

## Gated on live-Postgres testing (must pass before enabling)
- `0041` PL/pgSQL RPCs were written without a live Postgres in this environment. Contract tests mock the RPC layer. **Required**: apply 0001..0041 to staging Supabase, run the 10 scenarios in `backend/tests/perpetual-live-db-scenarios.md` (duplicate order, insufficient margin, service restart mid-match, price anomaly, price-source outage, liq-critical order, partial-fill-then-cancel, double funding settlement, simultaneous close+liq, DB tx failure). Ledger must reconcile: sum(available_delta)=0 per operation, no negative balances, no duplicate debits.
- Matching-loop margin accounting (maker/taker margin release/lock, over-reserve refund, fee credit to insurance) is the highest-risk code path — needs concurrency testing with `pgbench`-style parallel orders.
- `perp_apply_fill_to_position` flip/close/reduce paths need property-based testing.

## Unfinished / deferred (deliberately, not faked)
- Cross margin, portfolio margin, hedge mode, stop/trigger/trailing orders, ADL/socialized loss (bad debt is recorded, not socialized), spot trading fees (still zero-fee CHECK in 0008 — P0 for spot revenue).
- High-frequency depth / websocket order-book streaming — REST polling only v1.
- K-line/chart data for perpetual UI — page shows honest "awaiting feed" state; no fake candles.
- Admin UI tabs for perpetual markets (API exists; console UI may be partial) — verify in admin console.
- Independent security audit, legal compliance review (Cambodia + target markets), open-source license verification of vendor submodules (strata-pro, shadcn-fintech — not initialized locally).
- Backup/restore drill, disaster-recovery runbook for perpetual tables.

## Known risks
- Live balances still on legacy JSON; perpetual uses Postgres `financial_accounts`. Until full cutover, USDT balances are split-brain between JSON and Postgres. **Perpetual must not be enabled until the USDT balance authority is unified in Postgres** (the `perpetualEngineEnabled` switch enforces this by requiring financial writes enabled).
- Insurance fund starts at 0 — early liquidations with loss beyond margin create bad debt. Seed insurance fund before enabling.
- Mark-price sources: ≥2 required; if all sources outage, trading pauses (correct) but funding/liquidation also pause — positions protected but funding interval may drift. Document ops procedure.
- Max leverage 100 hard cap; markets should set lower (e.g. 10-25).
- Frontend e2e Playwright seeds `en` locale; default-Japanese first-visit not asserted by e2e (verified in code audit only).

## Phase-8 gate status (as of this delivery)
- [x] Four products have backend code (perpetual = staging-gated)
- [x] API ↔ frontend integration (code complete; build-verified)
- [ ] Ledger reconciliation (requires live DB)
- [ ] Financial / risk / restart-recovery tests (requires live DB)
- [ ] Backup/restore drill
- [ ] Permission & security review
- [ ] OSS license verification (vendor submodules)
- [ ] Independent security audit
- [ ] Legal compliance review (Cambodia / target markets)
→ Perpetual must remain `perpetualEngineEnabled=OFF` until all boxes checked. Spot/Seconds/Earn unchanged.
