# BTCBOX Phase 1 Backend Audit — BACKEND / DB / LEDGER / API / TESTS

- **Audit date:** 2026-11-10
- **Branch:** `feature/four-products` (verified)
- **Repo root:** `/home/user/Dola/chats/38418458470338065/btcbox`
- **Mode:** read-only source inspection. No source modified, no git push, no database touched.
- **Scope:** backend API core, server.py, financial Python modules, admin auth/RBAC, Vercel functions, all SQL migrations, Spot/Seconds/Earn endpoints + DB RPCs, ledger, safety switches, matching engine, tests, deployment deps.

---

## 0. Executive summary of critical findings (12 lines)

1. **A real persistent matching engine exists** in `0008_financial_matching_engine_v1.sql`: order book in DB table `financial_matching_orders`, fills in `financial_matching_trades`, all state transactional in Postgres. It is **not** in-memory.
2. **Single writer per pair** is enforced via transaction-scoped `pg_advisory_xact_lock` on the pair key (`0008` lines ~145-146), plus a per-(user, client_order_id) lock. Crash recovery is transactional (any partial state rolls back; open orders persist and remain matchable). There is **no independent matching service** — matching runs synchronously inside the Postgres RPC called by the API (taker-driven).
3. **The ledger IS enforced in the Postgres cutover path:** every `UPDATE financial_accounts` is paired with a `financial_ledger` insert, either through the `apply_financial_operation` primitive (`0002:105-164`) or inline in matching/seconds/withdrawal RPCs. No direct balance UPDATE bypassing the ledger was found in any active SQL or JS.
4. **HOWEVER — the live balance authority is still JSON, not the ledger.** `financial_storage_guard.py` forces `FINANCIAL_STORAGE_MODE=legacy_json`; all four `FINANCIAL_*` flags default to `0` (`.env.example`); balance reads still come from `btcbox_state.data` JSON (`api-core.js:260`, `:2022`). The Postgres ledger is the future cutover target, not the live system. Partial enablement would create split-brain accounting.
5. **NO Perpetual / Contract / Futures backend exists.** No positions table with long/short/entry/mark/liq price, no margin, no maintenance margin, no liquidation engine, no funding rate, no mark/index price with multi-source validation. `tests/smoke.test.js:157` explicitly asserts the word "Perpetual" is absent. The "Seconds Contract" product is a short-duration binary-payout product, not a perpetual.
6. **No active direct balance write bypassing the ledger.** `server.py` admin balance-adjust form is a no-op (`server.py:984-987` returns "disabled" message, never mutates). `api-core.js:2974-2976` returns HTTP 409 for admin balance adjustment. Deposit credit by user is rejected (`api-core.js:2176`).
7. **JS Number/float math on money: active settlement paths are decimal-safe** (`parseMoneyInput` string parser + BigInt `compareMoney`/`addMoney` at `api-core.js:1117-1145`; the prior `Number(body.qty)` bug from REVIEW-3 is fixed and guarded by `backend_security.test.js:175-176`). Float `Number()` usage is confined to display/valuation and config thresholds. **Latent violation:** `api-core.js:3349` `const delta = Number(body.delta)` in the admin fund-op handler — but this code is dead (shadowed by the 409 return at `:2974`). `earn_policy.py:decimal_to_storage` returns `float()` for the legacy JSON path.
8. **Idempotency is present on every financial write** in the cutover path: withdrawal (`request_id` unique + `request_hash`, `0029`/`0033`), spot order (`client_order_id` unique per user + payload-mismatch raise, `0008`), spot cancel (`client_cancel_id` persisted with response replay, `0008`), earn subscribe/redeem (`request_id`), seconds order/settle (`request_id` + `request_hash`, `0024`), manual deposit (`request_id`), admin fund op (`request_id`). No missing idempotency on an active financial write was found.
9. **Fee-bearing trading is NOT implemented.** `financial_matching_markets.maker_fee_rate`/`taker_fee_rate` have `CHECK (... = 0)` (`0008:36-37`); no fee debit/credit legs exist in the fill path. This is a P0 blocker for fee-bearing production (known: BUS-MATCH-004).
10. **Markets default to `enabled=false`** (`0008:24`); no seed data in canonical migrations (the existing-schema-upgrades file seeds 4 pairs only for an existing schema). Orders fail closed with "market disabled or unconfigured". Deployment must not mistake a successful migration for a configured market (known: BUS-MATCH-003).
11. **Migration numbering:** 33 canonical SQL files (not 34). Gaps at `0009` (retired) and `0015-0020` (retired/removed) — documented in `MIGRATION-ORDER-AND-CUTOVER.md`. Numbering collision: `existing-schema-upgrades/0039_existing_schema_market_catalog_upgrade_v1.sql` shares number `0039` with `sql/0039_withdrawal_approve_no_burn_v1.sql` (separate dir, excluded from bootstrap, but confusing).
12. **Test suite:** 66 `*.test.js` files (65 in `backend/tests/` + 1 integration) + 1 SQL integration script, ~502 `test()` calls. No financial concurrency/rollback/reconciliation tests against a live Postgres exist (source-level RPC contract tests only). Perpetual test coverage is zero because the product does not exist.

---

## 1. Existing backend features inventory per product

### 1.1 Spot (exists, fail-closed, zero-fee only)
- Limit orders only; market orders rejected at API (`api-core.js:2425-2426`).
- `POST /api/order` → `submit_limit_order_matching_v1` RPC (`0008:111`), gated by `FINANCIAL_MATCHING_ENGINE_ENABLED=1` (`api-core.js:2431-2433`).
- `POST /api/order/cancel` → `cancel_limit_order_matching_v1` RPC (`0008:282`), gated.
- `GET /api/orders` → order read (gated, `api-core.js:2768-2771`).
- `GET /api/market`, `/api/market/pairs`, `/api/kline`, `/api/depth` — public market data from CoinGecko/Binance feeds (server-fetched; client prices never trusted for settlement).
- 4 pairs supported in code: BTC/ETH/SOL/BNB × USDT (`api-core.js:319` `SECONDS_ALLOWED_SYMBOLS`; matching pair derived from symbol).
- **Not implemented for Spot:** market orders, fee accounting (zero only), post-only/IOC/FOK time-in-force, stop orders, iceberg, self-trade-prevention beyond `user_id <> p_user_id` in maker select (`0008` fill loop), trading as maker incentive, independent matching service.

### 1.2 Seconds Contract (exists, fail-closed; binary-payout, NOT perpetual)
- `GET /api/seconds/policy` — reads active versioned policy from Postgres (`seconds_contract_policy_active` / `seconds_contract_policies`).
- `POST /api/seconds/order` → `submit_seconds_order_v1` RPC (`0014:52`, redefined by `0025` with policy snapshot). Server fetches its own open reference price from the same trusted feeds as `/api/market`; client-supplied prices never trusted (`api-core.js:316-318` comment; RPC receives `p_open_price` from server ref at `:2608`).
- `POST /api/seconds/settle` → `settle_seconds_position_v1` RPC (`0014:99`, redefined by `0024` with request-hash idempotency). Server fetches settle price; passes `p_settle_price`, `p_settle_price_source`, `p_settle_price_ts` (`api-core.js:2648`).
- `GET /api/seconds/positions` → `read_seconds_positions_v1` (`0014:160`).
- Policy versioning: immutable policy versions, active pointer, per-position payout/policy snapshot taken in same transaction as reserve (`0025`). Readiness guard: `seconds-policy-readiness.js` `hasActiveVersionedSecondsPolicy()` fails closed if no active versioned policy (payout_bps >= 8500 enforced).
- Allowed symbols BTC/ETH/SOL/BNB; durations governed by active immutable policy (fixed allowlist removed by `0031`).
- **This is a binary-option-like product** (stake USDT, payout multiplier `payout_bps`, win/lose at expiry), not a leveraged futures contract. No position holding, no mark-to-market, no liquidation.

### 1.3 Earn (exists, fail-closed)
- `GET /api/earn/products` — product catalog (from JSON config / Postgres read RPC).
- `POST /api/earn` (subscribe) → `subscribe_earn_atomic` RPC (`0003:109`, hardened by `0005`/`0006`). Principal frozen; product policy snapshotted DB-side; caller cannot set payout (`financial_db.py:redeem_earn` comment).
- Redeem → `redeem_earn_atomic` RPC (`0003:144`).
- Interest math in `earn_policy.py` uses Python `Decimal` (4-decimal USDT quantum, ROUND_HALF_UP). Legacy JSON compatibility stores as float via `decimal_to_storage` (latent, legacy path only).
- Products: fixed-term and demand (prorated by elapsed seconds) + early-redemption penalty.

### 1.4 Perpetual / Contract / Futures (DOES NOT EXIST)
- No tables, no RPCs, no API endpoints, no tests. Grep for `perpetual|futures|leverage|margin|liquidation|funding_rate|mark_price|index_price|isolated.*margin|maintenance_margin` across `backend/` returns only a smoke-test assertion that "Perpetual" is absent and CSS color named `#0b0e14` (false positive). **Everything needed for Perpetual must be built from scratch** (see §2).

### 1.5 Wallet / Deposit / Withdraw (exists, fail-closed, half-manual)
- Deposit: `POST /api/deposit` — amount<=0 returns deposit address; user-submitted amounts rejected with 403 (`api-core.js:2175-2176`). No chain watcher; staff manually verify and credit via `admin_manual_deposit_atomic` RPC (`0007:27`, called at `api-core.js:3471`). Deposit addresses from env vars, fail-closed if placeholder.
- Withdraw: `POST /api/withdraw` → `create_withdrawal_atomic` (11-arg, `0029`, asserted unique by `0033`), gated by `financialWritesEnabled()`. Address whitelist + cooldown, fund password + TOTP, large-value / first-withdrawal admin review (DB-enforced by `0038`), fee-quote idempotency (`0029`).
- Admin: `withdraw/approve`, `withdraw/reject`, `withdraw/mark-paid` (staff-paid completion, `0027`), all gated + audited. Approval is a status decision only (`0039` "approve_no_burn" — no funds moved at approve; rejection releases frozen; mark-paid debits frozen exactly once).

### 1.6 Admin / RBAC / Audit (exists)
- Supabase Auth identity verification (`admin-auth.js` — calls `/auth/v1/user`, no JWT decoding), membership loaded from protected server-side store via `admin_get_membership_v1` RPC.
- Closed permission catalogue (`admin-rbac.js` — 26 permission keys; super-admin bypass).
- Append-only audit log with mutation-block trigger (`0021` `block_audit_log_mutation`), `append_admin_audit_log` RPC.
- Super-admin bootstrap is owner-only `private.bootstrap_super_admin_v1` (requires `session_user=postgres`), not seeded.
- Admin endpoints: session, admins/manage, users, user detail, user freeze, kyc review, deposit/confirm (manual credit), withdraw approve/reject/mark-paid, spot-markets (read/write config), seconds-policy (read/write versioned), seconds-positions read, stats, audit-logs, config, support reply, addresses.

---

## 2. Missing features inventory (especially Perpetual)

For Perpetual/Contract/Futures, **none** of the following exist and must be built:

| Capability | Status | Notes |
|---|---|---|
| Perpetual markets table (index, mark source, max leverage, maintenance margin fraction, funding interval) | MISSING | `financial_matching_markets` is spot-only (zero-fee, limit-only) |
| Orders with `client_request_id` idempotency | Partially exists (spot pattern reusable) | Need per-product idempotency namespace |
| Positions table (long/short, entry price, mark price, liquidation price, margin mode isolated/cross, leverage, size, unrealized PnL) | MISSING | No `positions` table of any kind (only earn/seconds "positions" which are unrelated) |
| Isolated margin accounting | MISSING | |
| Maintenance margin & liquidation engine (off-chain keeper + on-chain settlement) | MISSING | No background worker/keeper of any kind exists |
| Funding rate computation & payment | MISSING | |
| Mark price / index price with multi-source validation & deviation bands | MISSING | Seconds uses single server-fetched reference price only; no multi-source consensus |
| Independent matching service (low-latency, single-writer process, not Postgres-RPC-per-order) | MISSING | Current matching is synchronous inside Postgres RPC — adequate for low-volume spot, not for perpetual |
| Fee accounting (maker/taker debit/credit legs, fee destination, rounding) | MISSING | Spot forces fees to zero (P0 blocker even for spot fee-bearing) |
| Market orders / IOC / FOK / post-only / stop / trigger | MISSING | Spot rejects market orders |
| ADL / insurance fund / clawback | MISSING | |
| Cross-margin wallet / unified account | MISSING | |
| Liquidation cascade / position close-out matching | MISSING | |

Other gaps (non-perpetual):
- Chain watcher / automatic deposit crediting (deliberately half-manual — documented choice).
- Withdrawal broadcast to chain (manual payout by staff; `mark-paid` records staff-paid completion only).
- Dual-approval admin balance adjustment queue (direct adjustment disabled at `api-core.js:2975`; message says "wait for the dual-approval adjustment queue").
- Postgres cutover itself (reads still from JSON; `FINANCIAL_POSTGRES_READS_ENABLED=0`).

---

## 3. Database tables & relationship summary (compact ER)

All tables below are **Postgres tables in the `public` schema** (Supabase-hosted Postgres). Supabase Auth (`auth.users`) is managed by Supabase; BTCBOX references user UUIDs as `text`. No separate "Supabase table" category — all business tables are plain Postgres tables accessed via PostgREST/RPC with `service_role`.

### Auth / users / state
- `btcbox_state` (`0001`) — singleton row `id=main`, `revision bigint` (CAS), `data jsonb`. **Holds legacy JSON state: users, balances, security counters, config.** Written via `btcbox_save_state(p_expected_revision, p_data)` with optimistic concurrency. This is the LIVE balance authority until cutover.
- Supabase `auth.users` — external; admin membership store in private schema (`0026` `private.admin_memberships` etc., not public).

### Balances / ledger (Postgres cutover target)
- `financial_accounts` (`0002`) — PK `(user_id, asset)`, `available numeric(38,18)`, `frozen numeric(38,18)`, `version bigint` (optimistic), CHECK >=0. **The balance table.**
- `financial_operations` (`0002`) — idempotency records: `idempotency_key text unique` (16-128), `operation_type` enum, `request_hash`, `metadata jsonb`. PK `uuid`.
- `financial_ledger` (`0002`) — append-only double-entry rows: `operation_id` FK→operations, `available_delta`, `frozen_delta`, `available_after`, `frozen_after`. Unique `(operation_id, user_id, asset)`. Every balance change writes here.
- `financial_audit_log` (`0002`, extended by `0021` append-only trigger) — admin/action audit.

### Spot markets / orders / fills
- `financial_matching_markets` (`0008`) — PK `(base_asset, quote_asset)`, `enabled bool default false`, `price_tick`, `quantity_step`, `min_quantity`, `min_notional`, `min/max_limit_price`, `maker/taker_fee_rate` (CHECK=0).
- `financial_matching_orders` (`0008`) — **the persistent order book**: PK `id`, `user_id`, pair, `side`, `price`, `quantity`, `remaining_quantity`, `status` (open/partially_filled/filled/cancelled), `client_order_id` (unique per user), `reserve_asset`, `reserved_remaining`, `reserve_operation_id` FK→operations. Partial indexes on asks/bids define the price-time book.
- `financial_matching_trades` (`0008`) — **persistent fills**: `maker_order_id`/`taker_order_id` FK→orders, `buyer/seller_user_id`, `price`, `quantity`, `quote_amount`, `operation_id` FK→operations. CHECK buyer<>seller (no self-trade).
- `financial_matching_cancel_requests` (`0008`) — PK `(user_id, client_cancel_id)`, persisted `response jsonb` for idempotent replay.

### Seconds contracts
- `seconds_contract_policies` / `seconds_contract_policy_active` (`0025`) — immutable versioned policies, active pointer.
- Seconds positions table (created in `0014` — `seconds_contract_positions` or similar; holds `position_id`, `user_id`, `symbol`, `direction`, `amount`, `open_price`, `duration_sec`, `settle_at`, `status`, `policy_snapshot`, `payout_bps`).
- Seconds settlement idempotency table (`0024`).

### Earn
- `earn_positions` (`0002`) — `id`, `user_id`, `product_id`, `asset`, `principal`, `status` (active/redeemed/matured), `subscribe_operation_id`/`redeem_operation_id` FK→operations.
- Earn product catalog (in `0006` / JSON config).

### Wallet
- `deposit_records` (`0002`) — `id`, `user_id`, asset/network/amount/txid, `status`, `idempotency_key unique`.
- `withdrawal_requests` (`0002`, extended by `0022` admin-review status, `0027` payout completion, `0029` fee quote) — `id`, `user_id`, asset/network/amount/fee/destination, `status`, `request_id unique`, review fields, `expected_fee`, `payout_reference`.

### Admin / RBAC / rate limit
- Private schema `private.*` (`0026`) — admin memberships, permissions, super-admin bootstrap, audit. Public wrappers in `0028`.
- `btcbox_rate_limits` (`0023`, scopes extended by `0037`) — shared server-side rate limit, HMAC-keyed. Scopes: `withdraw_create`, `spot_order`, `spot_cancel` (consumed in API), `earn_subscribe`, `earn_redeem`, `seconds_order`, `seconds_settle` (consumed in API), plus auth/2FA/credential scopes.

**Relationships:** every financial entity (order reserve, fill, earn subscribe/redeem, withdrawal freeze/approve/reject/payout, deposit credit, seconds reserve/settle, admin adjustment) references a `financial_operations.id` which has ≥1 `financial_ledger` rows, and ledger rows move values between `available`/`frozen` on `financial_accounts`. `btcbox_state` JSON is the legacy parallel authority, not joined to these tables.

---

## 4. API endpoint inventory (method + path + handler + auth + purpose)

All `/api/*` routes are served by the single catch-all Vercel Function `backend/api/[...path].js` → `api-adapter.js` → `api-core.js:handler`. `backend/api/router.js` is a static-named fallback for the Vercel multi-segment routing bug. `backend/api/healthz.js` is an independent static probe. `backend/src/api/` contains only a README (no code).

### Public / auth (no financial write)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/healthz` | none | Static probe (separate function) |
| GET | `/api/auth-client-config` | none | Auth provider config |
| GET | `/api/auth-health` | none | Auth availability |
| GET | `/api/config` | none | Public config, deposit address availability (fail-closed) |
| POST | `/api/captcha` | none | Captcha issue |
| POST | `/api/register`, `/api/login`, `/api/supabase-login`, `/api/google-login` | none | Auth (Google mock only when CONTEXT=dev + ALLOW_GOOGLE_MOCK=1) |
| POST | `/api/logout` | session | |
| POST | `/api/login/2fa`, `/api/2fa/enable`, `/api/2fa/confirm`, `/api/2fa/disable` | session/user | TOTP with replay protection |
| POST | `/api/auth/link-identity`, `/api/auth/link-identity/reauth` | user | Identity linking with reauth |
| POST | `/api/account/credentials`, `/reauth`, `/recover` | user | Credential management |

### Public market data
| GET | `/api/market`, `/api/market/pairs`, `/api/kline`, `/api/depth` | none | Server-fetched prices (CoinGecko/Binance); fail-closed to "maintenance" |

### Authenticated user — financial (all fail-closed unless FINANCIAL_* flags=1)
| Method | Path | Auth | RPC / purpose |
|---|---|---|---|
| GET | `/api/account` | user | Balance/history read — **still from btcbox_state JSON** (`api-core.js:2005-2064`, `:2022`) |
| GET/POST | `/api/addresses`, `/api/addresses/select` | user | Payout address whitelist + cooldown |
| POST | `/api/kyc` | user | KYC submit |
| POST | `/api/deposit` | user | Address query only; user amounts rejected (403) |
| GET | `/api/withdrawal/config` | user | Fee/network config, fail-closed availability |
| POST | `/api/withdraw` | user + fundpwd + 2FA | `create_withdrawal_atomic` (11-arg); idempotency `request_id` 16-80 chars; rate scope `withdraw_create` |
| POST | `/api/order` | user | `submit_limit_order_matching_v1`; `client_order_id` 16-100; limit-only; scope `spot_order` |
| POST | `/api/order/cancel` | user | `cancel_limit_order_matching_v1`; `client_cancel_id`; scope `spot_cancel` |
| GET | `/api/orders` | user | Order history (gated) |
| GET | `/api/earn/products` | user | Earn catalog |
| POST | `/api/earn` (subscribe) | user | `subscribe_earn_atomic`; scope `earn_subscribe` |
| POST | `/api/earn` (redeem) | user | `redeem_earn_atomic`; scope `earn_redeem` |
| GET | `/api/seconds/policy` | user | Active versioned policy |
| POST | `/api/seconds/order` | user | `submit_seconds_order_v1`; server-fetched open price; scope `seconds_order` |
| POST | `/api/seconds/settle` | user | `settle_seconds_position_v1`; server-fetched settle price + source + ts; scope `seconds_settle` |
| GET | `/api/seconds/positions` | user | `read_seconds_positions_v1` |
| POST | `/api/settings/password`, `/settings/fundpwd`, `/settings/2fa` | user | Security settings |
| POST/GET | `/api/support/chat`, `/api/support/messages`, `/api/chat/unread` | user | Support |

### Admin (all under `/api/admin/*`, Supabase Auth + RBAC membership + permission check)
| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/admin/session` | any active admin | Identity/membership |
| GET | `/admin/admins`, POST `/admin/admins/manage` | super-admin only | Delegated admin lifecycle |
| GET | `/admin/users`, `/admin/user` | users.read | User list/detail |
| POST | `/admin/user/balance` | (disabled) | **Returns 409 always** (`api-core.js:2974-2976`); direct adjustment disabled |
| POST | `/admin/user/freeze` | users.freeze | Account freeze flag (not balance) |
| POST | `/admin/user/reset-pwd`, `/admin/user/reset-email` | users.manage | |
| GET/POST | `/admin/kyc`, `/admin/kyc/approve`, `/admin/kyc/reject` | kyc.read/kyc.review | |
| POST | `/admin/deposit/confirm` | deposits.review + deposits.read | `admin_manual_deposit_atomic` (manual credit, idempotent) |
| POST | `/admin/withdraw/approve`, `/admin/withdraw/reject`, `/admin/withdraw/mark-paid` | withdrawals.review | `review_withdrawal_atomic`; approve=status only (no burn, `0039`); reject releases frozen; mark-paid debits once (`0027`) |
| GET | `/admin/withdrawals`, `/admin/orders` | withdrawals.read / orders.read | |
| GET/POST | `/admin/spot-markets` | system_config | Market catalog config (read RPC `read_spot_market_snapshot_v1`) |
| GET/POST | `/admin/seconds-policy` | seconds_policy.read/manage | Versioned policy activation (atomic RPC `0028`) |
| GET | `/admin/seconds-positions` | seconds_policy.read | Bounded open-positions queue (`0030`, max 100 rows) |
| GET | `/admin/stats` | dashboard.read | |
| GET | `/admin/audit-logs` | financial_audit.read | Append-only audit (`0021`) |
| GET/POST | `/admin/config` | system_config.read/write | |
| POST | `/admin/push` | announcements.manage | |
| GET/POST | `/admin/addresses`, `/admin/address/manage` | payout_addresses.* | |
| POST/GET | `/admin/support/reply`, `/admin/support/messages` | support.* | |

---

## 5. Fund flow description (Postgres cutover path; all gated)

```
Deposit (half-manual):
  user requests deposit address → staff observes chain transfer → staff calls
  POST /admin/deposit/confirm → admin_manual_deposit_atomic (0007) →
  apply_financial_operation(operation_type='deposit_credit') →
  financial_accounts.available += amount  +  financial_ledger row (0002)
  [No automatic chain watcher; no user-created pending deposit credit]

Available balance → freeze:
  • Spot order: POST /api/order → submit_limit_order_matching_v1 (0008)
      reserve: available -= reserve, frozen += reserve (buy: quote price*qty; sell: base qty)
      → financial_operations(spot_order_reserve) + financial_ledger row
      → order persisted in financial_matching_orders (open)
  • Seconds entry: POST /api/seconds/order → submit_seconds_order_v1 (0014/0025)
      available -= stake, frozen += stake (USDT only) + policy snapshot
      → financial_operations + financial_ledger row + seconds position row
  • Earn subscription: POST /api/earn → subscribe_earn_atomic (0003/0006)
      available -= principal, frozen += principal
      → financial_operations(earn_subscribe) + financial_ledger + earn_positions row

Settlement / fill:
  • Spot fill (taker-driven, inside submit RPC):
      loop over price-time book (financial_matching_orders indexes) →
      4 ledger legs per fill (0008:259-263):
        buyer base  +fill (available), buyer quote frozen -reserved, available +price-improvement
        seller base frozen -fill, seller quote available +quote_amount
      → financial_operations(spot_trade) + 4×financial_ledger + financial_matching_trades row
      + update both orders remaining_quantity/status
      [Fees = 0; no fee legs]
  • Spot cancel: cancel_limit_order_matching_v1 → frozen -= remaining, available += remaining
      → financial_operations(spot_order_cancel) + financial_ledger + order status=cancelled
      + persisted cancel_request response for idempotent replay
  • Seconds settle: POST /api/seconds/settle (server-fetched settle price) →
      settle_seconds_position_v1 (0024 idempotent) → win: frozen -stake, available += stake+payout
      lose: frozen -stake (stake forfeit) → financial_operations + financial_ledger
  • Earn redeem: redeem_earn_atomic → frozen -principal, available += principal+interest
      (DB-snapshotted policy; caller cannot set payout) → financial_operations(earn_redeem) + ledger

Withdraw:
  POST /api/withdraw → create_withdrawal_atomic → available -= (amount+fee), frozen += (amount+fee)
    (operation_type 'withdraw_freeze') + ledger row + withdrawal_requests row (status pending/pending_admin_review)
  → admin review (0038 first-successful-withdrawal guard, DB-authoritative)
    approve: status only, NO fund movement (0039 approve_no_burn)
    reject: frozen -= amount, available += amount (withdraw_reject) + ledger
    mark-paid (staff broadcast manually): frozen -= amount+fee (withdraw_complete) + ledger,
      records payout_reference, debits exactly once (0027)

Realized PnL: spot — embedded in fill legs (no separate PnL table). Seconds — payout at settle.
Earn — interest at redeem. No unified PnL ledger.
```

**Where ledger entries are written:** every balance-affecting RPC writes `financial_operations` + ≥1 `financial_ledger` row in the same transaction. Confirmed locations: `0002:163` (primitive), `0003` (via primitive), `0004`, `0005`, `0006`, `0007` (via primitive), `0008:199` (reserve), `:259` (4 fill legs), `:348` (cancel release), `0014:87/:148` (seconds reserve/settle), `0022` (via primitive), `0024:59`, `0025:246/:355`, `0029` (via primitive), `0038` (via primitive), `0039:74` (redefined primitive + via primitive).

---

## 6. Financial safety switches / readiness guards inventory

| Name | File | What it gates |
|---|---|---|
| `FINANCIAL_POSTGRES_RPC_ENABLED` (default 0) | `.env.example`, `api-core.js:271` | Enables Postgres RPC transport for financial writes |
| `FINANCIAL_POSTGRES_FULL_CUTOVER_APPROVED` (default 0) | `.env.example`, `api-core.js:272` | Must be 1 together with RPC_ENABLED for `financialWritesEnabled()` |
| `FINANCIAL_POSTGRES_READS_ENABLED` (default 0) | `.env.example`, `api-core.js:276` | Enables Postgres reads (balance snapshot RPC) |
| `FINANCIAL_MATCHING_ENGINE_ENABLED` (default 0) | `.env.example`, `api-core.js:284/289` | Enables spot order/cancel; fail-closed 503 otherwise |
| `financial_storage_guard.validate_financial_storage_mode()` | `financial_storage_guard.py` | Forces `legacy_json`; any other value raises. Used by `server.py` startup. |
| `hasActiveVersionedSecondsPolicy()` | `seconds-policy-readiness.js` | Pre-write check that an active versioned seconds policy exists with payout_bps>=8500; returns false (fail-closed) on any error/missing |
| `financialWritesEnabled()` / `matchingEngineEnabled()` / `manualDepositRpcEnabled()` | `api-core.js:270-290` | Composite gates; every financial write route checks these and returns 503 `FINANCIAL_CUTOVER_INCOMPLETE` / `MATCHING_ENGINE_UNAVAILABLE` |
| `supabaseStorageConfigured()` | `api-core.js:251-253` | Requires SUPABASE_URL + service key; else 503 |
| Shared rate limiter `btcbox_rate_limit_consume_v1` | `0023`, scopes `0037` | Consumed before every financial write (`rateCheckShared`); `unavailable` → fail-closed 503. Scopes: withdraw_create(5/15min), spot_order(30/5min), spot_cancel, earn_subscribe(10/15min), earn_redeem(20/15min), seconds_order(30/5min), seconds_settle + auth scopes |
| Withdrawal first-successful-review guard | `0038` | DB-authoritative: ORs API large-value/unknown-price flag with own prior-successful-withdrawal history; stale legacy btcbox_state cannot bypass first-withdrawal review |
| Withdrawal approve-no-burn | `0039` | Approval is status+audit only; rejection releases frozen; payout completion debits frozen exactly once |
| Withdrawal fee-quote idempotency | `0029` | Existing requests retain stored fee; new requests must match current server quote (409 WITHDRAWAL_FEE_CHANGED) |
| Withdrawal address whitelist + cooldown | `api-core.js:2219-2222` | New addresses cooling (default 24h) |
| Fund password + TOTP + persistent lockout counters | `api-core.js:2238-2261`, counters in `btcbox_state` | 5 failures → 15min lock, persisted |
| Account freeze enforced on every financial write | `api-core.js:2196`, `:2415` | Not just at login |
| Deposit addresses fail-closed | `api-core.js:2171-2173`, env var format validation | Placeholder/missing → "maintenance", no fallback |
| Admin audit append-only + outbox flush | `0021` trigger, `api-core.js:2983` | Audit persistence failure → 503 retry |
| Service-role privilege minimization | `0035`, `0036` | Revokes unnecessary DELETE/TRUNCATE/REFERENCES/TRIGGER; keeps single DELETE for rate-limit cleanup |
| Private schema exposure control | `0026`, `0028` | Admin membership store private; only narrow SECURITY INVOKER wrappers public, EXECUTE to service_role only |
| `CONTEXT=production` default / Google mock hard-gate | `.env.example`, `server.py`, `api-core.js` | Mock login unreachable in production |

**None of these switches are disabled or bypassed in code.** All default to off/fail-closed. The customer red line "no disabling financial safety switches" is satisfied in source.

---

## 7. Test coverage summary and unresolved issues

- **66** `*.test.js` files total (65 in `backend/tests/` + 1 `integration-tests/dev-server.test.js`) + `postgres-financial-lifecycle.integration.sql` (22KB SQL drill, not executed in CI). ~502 `test()` calls. (Task brief said 67; actual source count is 66 files.)
- **CI:** `vercel.json` buildCommand = `npm run build && npm test`; `npm test` = `node --test tests/*.test.js`. Source-level only — **no live Postgres DDL execution, no concurrency/rollback/reconciliation tests** (explicitly stated in `MIGRATION-ORDER-AND-CUTOVER.md` and REVIEW-3).
- Financial tests present (source-contract level): `spot-matching-idempotency`, `spot-trading-api`, `spot-trading-live-refresh`, `spot-market-catalog`, `seconds-persistent-order-guard`, `seconds-order-idempotency-response`, `seconds-server-authoritative-rules`, `seconds-policy-*` (5 files), `withdrawal-*` (4 files), `admin-fund-ops-audit`, `admin-user-financial-history`, `manual-deposit-reference`, `manual-credit-assets`, `rpc-source-contract` (22KB), `migration-mapping-audit`, `migration-status-script`, `shared-rate-limit`, `supabase-privilege-contract`, `deployment-preflight-rbac`, `backend_security` (asserts no `Number(body.qty)` float conversion — guards the BUS-MATCH-005 fix), `order-history-source-parity`.
- **Financial scenarios NOT covered by any test:**
  - Concurrent matching / partial fills / cancellation races against a real DB.
  - Rollback failure / crash mid-fill recovery (transactional by construction but untested).
  - Buyer/seller ledger reconciliation (sum of deltas = 0 per asset per fill).
  - Fee accounting (does not exist).
  - Market orders / stop orders (do not exist).
  - Perpetual anything (does not exist).
  - Deposit chain verification (deliberately not integrated).
  - Withdrawal broadcast to chain (manual).
  - Idempotency payload-mismatch (same key, different body) behavior at HTTP layer.
  - Decimal precision boundary (18 fractional digits, tick/step) — recommended in BUS-MATCH-005 but not present.
- **Skipped/failing:** none identified as `.skip` in a quick scan; no run was executed (read-only audit). TODO/FIXME in financial code: none material — `seconds-policy-versioning-doc-consistency.test.js:20` asserts spec text says "Separate draft/review/scheduled activation/retirement endpoints are not implemented" (known gap). `server.py` admin UI contains stale labels "adjust balances" / "confirm credit; balance will increase" (`server.py:643`, `:658`) and a non-functional adjust form (`:1015-1023`) — misleading but disabled.
- **Unresolved known issues from prior reviews (still OPEN):** BUS-MATCH-003 (markets require operator provisioning — no seed), BUS-MATCH-004 (zero-fee only — P0), BUS-MATCH-005 (float precision — FIXED in API, regression test added).

---

## 8. Production deployment dependency list

- **Hosting:** Vercel (Node 22.x, `package.json` engines). Single catch-all function due to Hobby 12-function limit (`[...path].js` comment).
- **Database:** Supabase-hosted Postgres (NOT self-hosted). `docker-compose.yml` is **local dev only** (postgres:17-alpine), explicitly forbidden for production. Migrations applied via `scripts/bootstrap-empty-database.sh` (guarded, empty-DB only) or `scripts/run_migrations.sh` (compatibility alias). `requirements-postgres-staging.txt` = `psycopg[binary]` only, for isolated staging drill runner.
- **Node deps:** minimal — `package.json` has no runtime dependencies listed (uses Node built-ins: `crypto`, `fetch` global). Frontend build pulls from `../frontend`.
- **Python deps:** `server.py` zero-dependency (stdlib only) + `earn_policy.py`/`financial_*` (stdlib `decimal`). `psycopg` only for staging drill.
- **Env vars required (keys only, from `.env.example` + code):**
  - `FINANCIAL_POSTGRES_RPC_ENABLED`, `FINANCIAL_POSTGRES_FULL_CUTOVER_APPROVED`, `FINANCIAL_POSTGRES_READS_ENABLED`, `FINANCIAL_MATCHING_ENGINE_ENABLED` (all default 0)
  - `CONTEXT` (default production), `CORS_ALLOWED_ORIGINS`
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`), `SUPABASE_AUTH_URL`, `SUPABASE_AUTH_PUBLISHABLE_KEY` (or `SUPABASE_AUTH_ANON_KEY`)
  - `BTCBOX_RATE_LIMIT_HMAC_SECRET` (≥32 random bytes)
  - Deposit address slots: `DEPOSIT_USDT_TRC20`, `DEPOSIT_USDT_ERC20`, `DEPOSIT_USDT_BEP20` (optional), `DEPOSIT_BTC`, `DEPOSIT_ETH`, `DEPOSIT_SOL`, `DEPOSIT_BNB`, `DEPOSIT_USDC_ERC20` (fail-closed if missing/placeholder)
  - `WITHDRAWAL_LARGE_THRESHOLD_USDT` (default 1000), `WITHDRAWAL_ADDRESS_COOLDOWN_HOURS` (default 24)
  - `ALLOW_GOOGLE_MOCK` (default 0, dev-only), `GOOGLE_CLIENT_ID` (server.py, optional)
  - `DATA_DIR`/`DATA_FILE` (server.py legacy JSON, local only)
- **Submodules (4, `.gitmodules`):** `frontend/vendor/strata-pro`, `frontend/vendor/shadcn-fintech` (UI templates), `references/btcbox-v33`, `references/source-archives` (reference archives, not built).
- **Build:** `npm run build` → installs frontend, builds frontend, runs `scripts/build-site.js`. `npm test` runs in build (gate).
- **CSP/headers:** `vercel.json` — strict CSP, connect-src allows `*.supabase.co` and `api.coingecko.com`.
- **Note:** `server.py` (Python) is a **legacy compatibility service**, must not be exposed publicly (header comment). Production API surface is Vercel functions only.

---

## 9. Critical risks — detailed citations

### 9.1 Direct balance update bypassing ledger — NONE found in active code
- All `UPDATE public.financial_accounts` locations: `0002:155-157` (inside `apply_financial_operation`, ledger insert at `:163`), `0008:193-194` (reserve, ledger at `:199`), `0008:237-246` (fill legs, 4×ledger at `:259`), `0008:341-342` (cancel release, ledger at `:348`), `0014:84` (ledger at `:87`), `0014:145` (ledger at `:148`), `0024:56` (ledger at `:59`), `0025:242` (ledger at `:246`), `0025:351` (ledger at `:355`), `0039:67-68` (redefined primitive, ledger at `:74`). Every one paired with a ledger insert in the same transaction.
- `api-core.js`: no assignment to `.free`/`.frozen`/`balances[]` anywhere except zero-init (`:850-855`) and read-compat shaping (`:2022`). `u.frozen = frozen` at `:3398` is the account-freeze **boolean** flag, not a balance.
- `server.py`: no balance assignment; adjust form is a no-op (`:984-987`); deposit confirm always rejects (`:553-564`); legacy financial writes "permanently retired" (header).
- **RISK (not a violation):** the live authority is still `btcbox_state.data` JSON. All financial write gates are composite and require reads enabled too: `financialWritesEnabled()` = `manualDepositRpcEnabled()` (RPC_ENABLED + FULL_CUTOVER_APPROVED) + READS_ENABLED + supabase configured (`api-core.js:270-281`); `matchingEngineEnabled()` = MATCHING_ENGINE_ENABLED + manualDepositRpcEnabled + READS_ENABLED + supabase configured (`:283-286`). No partial-enablement path was found. Mitigation remains: keep all flags 0 until full cutover; `matchingEngineRequested()` (`:288-289`, flag-only) is used only for status display, not for writes.

### 9.2 JS Number float math on money — active settlement paths clean; two latent
- **Clean:** `parseMoneyInput` (`api-core.js:1117-1125`) returns canonical decimal string, rejects >18 frac digits; `compareMoney`/`addMoney`/`moneyScaledInteger` use BigInt (`:1126-1145`). All financial write routes use these. Regression guard `backend_security.test.js:175-176`.
- **Latent 1:** `api-core.js:3349` `const delta = Number(body.delta)` — admin fund-op handler. Dead code (shadowed by 409 return at `:2974`). If the 409 guard is ever removed without fixing this, admin balance adjustments would use IEEE-754. Must fix before enabling admin fund ops.
- **Latent 2:** `earn_policy.py:decimal_to_storage` returns `float(...)` — legacy JSON storage only. Postgres path passes strings.
- **Acceptable (display/valuation only):** `api-core.js:796` `Number(amount)` (withdrawal config read), `:885-892` portfolio valuation (price × balance for display), `:2327/:2349` market price parsing, `seconds-policy-readiness.js:42-44` policy validation reads. None affect settlement.
- **SQL:** all money columns `numeric(38,18)`; no `float`/`double precision`/`real` anywhere in `backend/supabase/`.

### 9.3 In-memory-only trade state — NONE
- Order book, fills, seconds positions, earn positions, withdrawals, deposits, idempotency records, cancel responses — all in Postgres tables. `btcbox_state` JSON is persisted in Supabase (not in-memory) but is the legacy non-financial authority. The Python `server.py` loads JSON into memory but financial writes are disabled; its in-memory state is config/non-financial.

### 9.4 Missing idempotency on financial writes — NONE found on active writes
- Withdrawal: `request_id` unique (`withdrawal_requests.request_id unique`, `0002`) + `request_hash`; replay returns duplicate; payload mismatch → 409 (`0029`).
- Spot order: `client_order_id` unique per user (`financial_matching_orders` unique `(user_id, client_order_id)`, `0008`) + explicit payload-mismatch raise + advisory lock on request key.
- Spot cancel: `client_cancel_id` persisted in `financial_matching_cancel_requests` with full response; exact replay returns stored response.
- Earn: `request_id` + `request_hash` (idempotency via `financial_operations.idempotency_key`).
- Seconds: `request_id` + `request_hash`; `0024` adds settlement request-hash idempotency.
- Manual deposit / admin fund op: `request_id` + `request_hash`; 409 `IDEMPOTENCY_CONFLICT` on conflict (`api-core.js:3378`, `:3473`).
- **Gap:** the legacy JSON path (disabled) has no idempotency — irrelevant while disabled. No `client_request_id` pattern for a future perpetual order API exists yet (must build).

### 9.5 Matching engine — verified real & persistent (details in §0.1-0.2, §3)
- **Not** API wrappers, **not** in-memory. Order book = DB table with price-time partial indexes. Fills = DB table. Single-writer per pair via advisory lock. Crash-safe via transaction. Idempotent. Taker-driven synchronous matching inside Postgres RPC (no independent service — adequate for spot, insufficient for perpetual). Zero-fee only. Markets default disabled.

### 9.6 Migration numbering / gaps
- 33 canonical files. Retired slots: `0009` (legacy direct-fill spot trade removed), `0015-0020` (old seconds single-position restriction, chain verification, staging/import/reconcile, read-only ledger diagnostic moved to `diagnostics/`). Documented in `MIGRATION-ORDER-AND-CUTOVER.md`.
- Collision: `existing-schema-upgrades/0039_existing_schema_market_catalog_upgrade_v1.sql` vs `sql/0039_withdrawal_approve_no_burn_v1.sql` — same number, different content, separate directory, excluded from bootstrap. Cosmetic but confusing; recommend renaming the upgrades file.
- The connected hosted Supabase project is **NOT** bootstrapped to this canonical schema (has legacy state/catalog/test-backup rows; zero Auth users). Fresh bootstrap must not run against it.

---

## 10. Bottom line for the four-products / perpetual roadmap

- **Spot, Seconds, Earn** backends exist and are built to a high safety standard (ledger-enforced, idempotent, fail-closed, decimal-safe at the API boundary) but are **disabled by default** and **not yet the live balance authority** (JSON still live). Zero-fee only; markets unseeded.
- **Perpetual does not exist at all.** The entire margin/position/liquidation/funding/mark-price/independent-matching stack must be built. The spot matching engine's Postgres-RPC-synchronous design should not be reused for perpetual; a dedicated low-latency single-writer matching service is required.
- **No customer red-line violation found in active code.** Two latent items to fix before any cutover: `api-core.js:3349` float `Number(body.delta)` in dead admin fund-op code; remove or fix the stale `server.py` admin balance-adjust form. The highest-priority engineering item is completing the Postgres cutover (reads + writes + reconciliation) before any real-money trading, and implementing fee accounting even for spot.
