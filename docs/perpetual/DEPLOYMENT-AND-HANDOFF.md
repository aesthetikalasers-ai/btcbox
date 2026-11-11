# BTCBOX Four-Products — Handoff / Resume Guide (interrupt-safe)

If this session is interrupted (quota), another AI can resume from this state.

## State
- Branch: `feature/four-products` (pushed to origin). All work on this branch; `main` untouched.
- Repo local path (this VM): `/home/user/Dola/chats/38418458470338065/btcbox`. If resuming in a fresh VM: `git clone` the repo, `git checkout feature/four-products`.
- Secrets (provided by user, **never commit**, never put in commit messages/logs): GitHub PAT for push; Supabase project `zlozsutefnmgwwzrlipt` service-role key + JWT; Vercel token `vck_*`. In this VM they are stored gitignored at `backend/.env.local`. In a fresh VM recreate that file (it is gitignored).
- Live Supabase project is NOT bootstrapped to canonical schema and may be production. **Do not apply 0041 to it directly** — apply to a staging Supabase project first, run live-DB tests, then cut over.

## What is done (verify with `git log` on feature/four-products)
1. Phase 1 audit: `docs/audit-phase1/{FRONTEND,BACKEND,SUMMARY}.md`.
2. Phase 2/3 core: `backend/supabase/sql/0041_perpetual_contract_v1.sql` (schema + RPCs). Needs live-Postgres validation.
3. Backend API/workers/tests under `backend/` (perp endpoints, perp-* workers, tests).
4. Frontend: 2×2 grid fix, Futures→Contract, /contract page, i18n 7-locale keys, e2e fix.
5. Docs: `docs/perpetual/ARCHITECTURE.md`, `docs/perpetual/RISK-AND-UNFINISHED.md`, this file.

## Resume checklist
1. `git pull origin feature/four-products`; check `git status` for uncommitted work from interrupted agents.
2. Run backend tests: `cd backend && npm test` (contract tests). Run frontend build: `cd frontend && npm install && npx tsc -b && npx vite build`.
3. Provision a staging Supabase project; apply migrations in order `backend/supabase/sql/0001..0041`; run live-DB scenarios listed in `backend/tests/perpetual-live-db-scenarios.md`.
4. Seed one market (e.g. BTCUSDT) via admin API with `enabled=true, status='trading'` only in staging.
5. Only after all Phase-7 scenarios pass and ledger reconciles: enable `perpetualEngineEnabled` in staging, then production.
6. Merge to `main` only via PR after green CI. Never force-push main.

## Hard rules (must not be violated by resuming agent)
- Exactly four customer products: Spot / Seconds Contract / Contract / Earn. Never a fifth Futures. Seconds ≠ Contract.
- Mobile grid 2×2, never single column.
- Default Japanese, 7 locales, admin Chinese.
- No fake balances/fills, no disabling safety switches, no JS Number settlement, no direct balance writes bypassing ledger, no secrets in commits.
- If a Phase-8 gate fails, the product stays closed (switch OFF) — never fake availability via UI.
