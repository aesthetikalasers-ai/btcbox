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

- `GET /api/wallet`: implemented; reads only the authenticated user's wallet accounts and returns exact decimal strings. Empty account sets remain empty; no Exchange balance fallback or synthetic zero rows.
- `GET /api/wallet/addresses`: implemented; supports asset/network filters and returns only public address metadata. Derivation references and key material are excluded.
- `GET /api/wallet/ledger`: implemented; owner-scoped cursor pagination, signed exact decimal deltas, and operation type/status lookup.
- `POST /api/wallet/addresses`: deliberately returns `WALLET_PROVIDER_UNAVAILABLE` until an approved custody/address-derivation provider is configured. No shared placeholder address is returned.
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
        "available": "0",
        "frozen": "0",
        "total": "0",
        "version": 0
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

The live Auth schema also has an `auth.users` insert/update trigger that creates the corresponding wallet profile and seeds one wallet account for every active asset. The current project has zero Auth users, profiles, and wallet accounts; a newly created Auth user should therefore receive the nine currently active asset accounts through this trigger, not through a manual balance insert.

**Migration source gap:** the 2026-11-16 wallet foundation migrations appear in the live Supabase migration history but their SQL source files are not yet present in `backend/supabase/sql/`, and the empty-database bootstrap does not yet apply them. This must be reconciled before claiming a clean database bootstrap can recreate the Wallet schema. Do not solve this by manually inserting user rows or by opening direct client table permissions.

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

1. Implement and test read-only wallet overview, address listing, and ledger history.
2. Implement provider-backed address allocation only after custody/network provider configuration is verified.
3. Implement external-wallet challenge and confirmation.
4. Implement consent and encrypted-key custody only after KMS/HSM integration and threat-model review.
5. Connect the React Assets/Deposit/Withdraw pages without changing the locked trading terminal layout.
