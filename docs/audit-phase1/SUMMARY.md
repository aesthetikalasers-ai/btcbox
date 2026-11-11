# BTCBOX Four-Products Integration — Phase 1 Audit Summary (2026-11-10)

Branch: `feature/four-products` (from `main` @ d203110d). Full detail: `FRONTEND-AUDIT.md` + `BACKEND-AUDIT.md` in this directory.

## Verdict
Existing financial core is **production-grade in design** (DB-persistent matching, ledger-enforced, idempotent, decimal-safe, safety switches default-off) but **not yet live-cutover**: balances still run on legacy JSON, fees are unimplemented (zero-fee CHECK), and no Perpetual/Contract backend or UI exists. Perpetual is greenfield and is built additively on the same Postgres ledger pattern (migration `0041_perpetual_contract_v1.sql`).

## Existing features
- **Spot**: markets catalog, limit orders, DB-persistent order book + fills (0008), cancel idempotency, ledger freeze/release. Fees = 0 (not implemented).
- **Seconds Contract**: binary UP/DOWN, policy versioning, server settlement, idempotency (0014/0024/0025), React page consistent with API.
- **Earn**: catalog, subscribe/redeem, positions, ledger, policy (0005/0006).
- **Wallet**: deposits/withdrawals with admin review, first-successful-review guard, approve-no-burn, fee-quote idempotency.
- **Auth/Admin**: Supabase auth + Google + Web3, 2FA, RBAC, append-only audit log, superadmin listing.
- **i18n**: default Japanese, 7 languages full parity (947 keys), localStorage persistence, admin fixed Chinese. ✅ compliant.

## Red-line violations found (now fixed in feature branch — see build agents)
1. **Customer product list showed 4th card "Futures"** instead of required "Contract" (Pages.tsx:73-77). Two e2e tests enforced it. → Frontend agent replacing with Contract.
2. **Mobile product grid was single-column** (`sm:grid-cols-2` only, no base). → Frontend agent setting `grid-cols-2` base (2×2).
3. **No Contract/Perpetual backend or UI.** → 0041 SQL + backend API + frontend ContractPage.

## Critical risks / open items
- Live balance authority = legacy JSON (`financial_storage_guard.py` forces `legacy_json`; all `FINANCIAL_*` flags default 0). Postgres ledger is cutover target. Perpetual uses Postgres financial_accounts and is gated by `perpetualEngineEnabled()` (default OFF) — safe by default.
- Trading fees not implemented (0008 CHECK maker/taker=0). 0041 implements fee legs for perpetual (credited to insurance fund `__perp_insurance__`). Spot fees remain P0.
- No live-Postgres concurrency/rollback/ledger-reconciliation tests exist (66 test files, contract-level only). Perpetual RPCs require live-DB Phase-7 testing before enabling.
- Vendor submodules (strata-pro, shadcn-fintech) not initialized — licenses unverified locally.
- Hosted Supabase project (`zlozsutefnmgwwzrlipt`) is NOT bootstrapped to canonical schema. 0041 must be applied to staging first.

## Financial safety switches (all intact, default-off)
`financialWritesEnabled`, `financialPostgresReadsEnabled`, `matchingEngineEnabled`, `matchingEngineRequested`, `manualDepositRpcEnabled`, seconds-policy-readiness, 0037 rate-limit scopes, 0038 withdrawal first-review, 0039 approve-no-burn. Added: `perpetualEngineEnabled` (default OFF).
