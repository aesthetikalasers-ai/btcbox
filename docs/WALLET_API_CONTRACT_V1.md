# BTCBOX Wallet API Contract V1 (Draft)

Status: interface contract for parallel frontend/backend implementation. This document does not claim that the new `/api/wallet/*` routes are implemented or deployed.

## 1. Transport and identity

- Base URL: same-origin `/api` (or the configured `VITE_API_BASE_URL`).
- JSON request/response; `Accept: application/json`; `Cache-Control: no-store` for private wallet data.
- All private routes require the existing authenticated BTCBOX session and resolve the owner from the verified session. Never accept a client-supplied `user_id` as authorization.
- Use UUIDs as opaque identifiers. Amounts and balances are decimal strings, never JavaScript floating-point values.
- Mutating requests require an `Idempotency-Key` header (or the established request id field) and return stable results for exact retries.

## 2. Existing API (already present in source)

| Method | Route | Current meaning |
|---|---|---|
| GET | `/api/account` | Account snapshot; includes legacy balance/transaction compatibility fields and masked saved addresses |
| GET | `/api/addresses` | List saved withdrawal destinations; address values are masked |
| GET | `/api/addresses/select?id=...` | Owner-only full saved destination for withdrawal confirmation |
| POST | `/api/addresses` | Save a user-provided withdrawal destination or bank payout method |
| POST | `/api/deposit` | Query a configured asset/network deposit address; positive client-supplied credit amounts are rejected |
| POST | `/api/withdraw` | Withdrawal request; financial write cutover and risk controls apply |

These legacy routes must not be silently repurposed as custodial wallet-generation APIs.

## 3. Wallet API (contract and implementation status)

**Source status on `feat/wallet-api-contract-v1` (2026-11-16):** the read-only overview, address-list, and ledger routes are implemented and passed backend CI. This is source/CI evidence only; these changes are not merged or deployed, and live authenticated endpoint behavior has not yet been verified.

- `GET /api/wallet`: implemented; reads only the authenticated user's wallet accounts and returns exact decimal strings. Empty account sets remain empty; no Exchange balance fallback or synthetic zero rows. **Zero-balance asset accounts are filtered out:** an asset appears only when available + frozen is greater than zero. Newly initialized empty BTC/ETH/etc. account rows must not cause coin types to appear in the user's wallet UI.
- `GET /api/wallet/addresses`: implemented; supports asset/network filters and returns only public address metadata. Derivation references and key material are excluded.
- Frontend `/assets` list: filters seeded/empty account rows and displays a currency only when available or frozen balance is positive. Deposit asset choices remain a separate supported-network catalogue so a user can choose a currency to receive for the first time.
- Deposit selector starts with no asset/network selected; it exposes only BTC, ETH, USDT, SOL, BNB, and USDC combinations accepted by the current frontend deposit API adapter. It does not imply address-generation availability; the API must return a real configured address before one is shown.
- Withdrawal overview also hides seeded zero-balance rows; a currency with frozen funds remains visible, while withdrawal eligibility still depends on positive available balance and server-side checks.
- `GET /api/wallet/ledger`: implemented; owner-scoped cursor pagination, signed exact decimal deltas, and operation type/status lookup.
- `POST /api/wallet/addresses`: parses and validates the requested asset/network code, then deliberately returns `WALLET_PROVIDER_UNAVAILABLE` until an approved network allow-list and custody/address-derivation provider are configured. No address is derived, persisted, or returned, and no shared placeholder address is used. The current validation is syntactic only; it does not mean the asset/network pair is approved.
- External-wallet verification and key-consent/key-custody routes are not implemented yet and fail closed.

The connected Supabase schema was checked read-only. On 2026-11-16, wallet profile, account, address, ledger, operation, encrypted-key-vault, and external-wallet tables each contained zero rows. UI must show genuine empty states rather than inventing wallet balances or addresses.

### GET `/api/wallet`

Returns the signed-in user's wallet overview.

```json
{
  "ok": true,
  "wallet": {
    "accounts": [
      {
        "asset": "USDT",
        "available": "0.25",
        "frozen": "0",
        "total": "0.25",
        "version": "0"
      }
    ],
    "updated_at": "2026-01-01T00:00:00.000Z"
  }
}
```

Balances are sourced from the canonical wallet/financial ledger, not browser state or legacy JSON. Do not fabricate a balance when the ledger read is unavailable.

### GET `/api/wallet/addresses?asset=USDT&network=TRC20`

Returns deposit addresses owned by the authenticated user. Return only public address metadata; never return derivation secrets, seed phrases, private keys, encrypted key material, KMS references, or internal signing metadata.

### POST `/api/wallet/addresses`

Requests an address for an allow-listed asset/network. The server validates the pair, obtains/derives the address through the configured custody provider, persists it, and returns the public address. If no provider/derivation service is configured, fail closed with `WALLET_PROVIDER_UNAVAILABLE`; do not return a shared placeholder address as a personal wallet.

Request:
```json
{ "asset": "USDT", "network": "TRC20" }
```

Response:
```json
{
  "ok": true,
  "address": {
    "id": "uuid",
    "asset": "USDT",
    "network": "TRC20",
    "address": "public-chain-address",
    "status": "active",
    "is_primary": true
  }
}
```

### GET `/api/wallet/ledger?asset=USDT&cursor=...`

Returns a cursor-paginated, owner-scoped ledger history. Each item contains `operation_id`, `asset`, `type`, signed decimal `available_delta` / `frozen_delta`, resulting balances, status, and timestamp. Never treat a pending deposit as credited funds.

### POST `/api/wallet/external/challenge`

Creates an expiring challenge for linking an external wallet. Request includes public address, network/chain, provider, and verification method. The server stores only a challenge hash and returns the challenge text plus expiry.

### POST `/api/wallet/external/confirm`

Verifies the signed challenge server-side and marks the external wallet verified. Never trust a client-provided `verified: true` flag.

### POST `/api/wallet/key-consents`

Records an explicit, versioned consent before any key-custody action. Return a consent receipt identifier and version. Consent revocation must be supported and audited.

### POST `/api/wallet/keys` (restricted; not part of initial UI integration)

Accepts only a server-generated or envelope-encrypted key payload after a valid consent and policy check. Plaintext private keys, seed phrases, or recovery phrases must never be sent to ordinary application logs, analytics, audit metadata, or a browser-readable API response. Encryption/decryption and signing must be delegated to an approved KMS/HSM or isolated key service. If that provider is not configured, return `KEY_CUSTODY_UNAVAILABLE`.

- **Latest backend changes (2026-11-16):** ledger cursors and account `version` values are validated against PostgreSQL `BIGINT`; account versions are serialized as decimal strings to avoid JavaScript safe-integer precision loss. The wallet address POST route receives the parsed request body, validates asset/network syntax, and fails closed until an approved network registry and custody adapter exist. Unit tests cover large account versions and malformed/valid-but-unavailable address requests. CI initially exposed an over-escaped digit regex in the new version validator; this was corrected in commit `aaaa8b8`, and the backend CI rerun is in progress.

## 4. Error envelope

All new routes use:
```json
{
  "ok": false,
  "code": "WALLET_PROVIDER_UNAVAILABLE",
  "msg": "Wallet service is temporarily unavailable.",
  "request_id": "opaque-request-id"
}
```

Expected status mapping: 400 invalid asset/network/payload; 401 unauthenticated; 403 policy/consent denied; 404 owner-scoped resource not found; 409 idempotency or state conflict; 429 rate limited; 503 provider/KMS/ledger unavailable. Never expose SQL errors, secrets, key material, or internal provider credentials.

## 5. Data model mapping

The live Supabase project currently exposes wallet tables for assets, wallet accounts, wallet addresses, operations, ledger, encrypted key vault, key versions, external wallets, key consents, signing policies, key-access audit, owner principals, and owner approvals. Existing database routines include wallet-operation application, external-wallet challenge/confirmation, key-consent record/revoke, and encrypted-key storage.

The backend must verify exact function signatures, grants, RLS policies, constraints, and migration provenance before calling these routines. The presence of a table or function in the database does not prove that its API, authorization, or runtime behavior is complete.

**Wallet↔Exchange identity and ledger boundary (read-only verification, 2026-11-16):** `btcbox_wallet_accounts.user_id` is a UUID referencing `btcbox_user_profiles.user_id`; Exchange `financial_accounts.user_id` is a text BTCBOX user ID. The database contains a one-to-one `btcbox_auth_accounts` mapping (`supabase_user_id` UUID ↔ `btcbox_user_id` text) and a corresponding `btcbox_auth_identities` table, but both mapping tables currently contain zero rows. The current API login/session path keeps linked Supabase IDs and the BTCBOX internal `uid` in the server-side `btcbox_state` user record; it does not yet persist this mapping into those relational tables. Existing `create_withdrawal_atomic` and `verify_and_credit_deposit_atomic` operate on the legacy Exchange `financial_accounts`/`financial_ledger` path, not the new Wallet tables. `btcbox_apply_wallet_operation_v1` operates on only one Wallet account. Therefore none of these routines is a valid Wallet↔Exchange transfer implementation. Before exposing transfer, persist/verify the one-to-one identity mapping, add a single PostgreSQL transaction that locks both account rows in deterministic order, debits one available balance and credits the other, writes both ledgers with one shared transfer reference and idempotency record, and has explicit least-privilege grants. Do not implement this as two independent RPC calls.

The live Auth schema also has an `auth.users` insert/update trigger that creates the corresponding wallet profile and seeds one wallet account for every active asset. The current project has zero Auth users, profiles, and wallet accounts; a newly created Auth user should therefore receive the nine currently active asset accounts through this trigger, not through a manual balance insert.

**Current deployment topology (owner decision, 2026-11-16):** during the build phase, Wallet and Exchange use the same Supabase project/server database and shared Auth. Keep Wallet and Exchange business tables, accounts, balances, ledgers, addresses, and permissions logically isolated even though they reside in one database. Physical database/service separation is deferred until the system is stable. Test accounts and test data do not need to be restored. The migration-source/bootstrap gap is a later repository reproducibility task and does not block current development.

## 6. Acceptance gates

1. Session identity is resolved server-side; cross-user reads/writes are denied.
2. All balance-changing operations use one atomic, idempotent ledger operation.
3. Address generation is provider-backed, unique per user/network policy, and never falls back to a shared address.
4. Deposit credit requires independently verified chain evidence and confirmation policy; a submitted amount or TxID alone is not proof.
5. Withdrawal remains gated by the existing fee, allowlist, cooldown, step-up authentication, admin review, and financial cutover controls.
6. Key custody is fail-closed, consented, encrypted, audited, and isolated behind KMS/HSM; no plaintext secret disclosure.
7. Add route contract tests, authorization tests, idempotency tests, provider-failure tests, and frontend loading/empty/error states.
8. Do not enable financial flags, mutate production balances, or deploy as part of this contract-only batch.

## 7. Implementation order

1. Complete and pass CI for read-only wallet overview, address listing, and ledger history.
2. Persist and verify the one-to-one Supabase Auth UUID ↔ BTCBOX internal user ID mapping; reconcile server-side session identity with relational auth mapping.
3. Design and test a single-transaction Wallet↔Exchange transfer operation with dual ledger entries and idempotency; keep its migration unapplied until explicitly approved.
4. Implement provider-backed address allocation only after custody/network provider configuration is verified.
5. Integrate trusted chain observations for deposit credit; never accept client-supplied confirmations or amount as proof.
6. Implement wallet withdrawal lifecycle only after Wallet-specific ledger, fee/risk policy, admin review, signing and broadcast boundaries are defined; do not blindly reuse legacy Exchange withdrawal RPCs.
7. Implement external-wallet challenge/confirmation and consented encrypted-key custody only after provider/KMS/HSM review.
8. Connect React Assets/Deposit/Withdraw pages without changing the locked trading terminal layout.
