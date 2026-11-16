# BTCBOX Referral & Rewards API Contract V1 (Draft)

Status: backend design contract for parallel UI work. This document does not claim that referral routes, tables, fee settlement, or reward payouts are implemented or deployed.

## 1. Product boundary

- Referral is an attribution and fee-rebate programme. It is not a generic points/rewards balance.
- The initial programme supports a configurable two-level referral tree: direct invitee (L1) and second-level invitee (L2). Rates, eligible products, payout asset, qualification rules, caps, holding periods, and effective dates are policy configuration and MUST remain disabled until explicitly approved.
- UI must not invent invite counts, commission rates, earnings, rankings, or payout statuses. Before live APIs exist, use an isolated mock adapter and label the entire dataset as Demo/Preview.
- "Rewards" is a hub for real reward programmes. "Launchpad" is a separate product surface and must not be presented as referral commission unless an actual Launchpad programme exists.
- No referral reward is accrued from trading volume alone. The eligible basis is a fee actually charged and settled by the exchange, net of reversals/refunds. Zero-fee trades produce zero referral commission.

## 2. Verified implementation constraints (2026-11-17)

- The connected Supabase schema currently has no referral/invite/reward/commission tables.
- Existing spot matching schema exposes fills in `financial_matching_trades`, but its market fee rates are constrained to zero in the current matching-engine migration. The current spot fill path therefore cannot be used to manufacture fee revenue or referral commission.
- Referral must be integrated at the authoritative fee-settlement event, not inferred by the browser or calculated from user-submitted trade/volume values.
- Current wallet and exchange financial accounts/ledgers are separate logical domains even though they share one Supabase project. Referral accrual must have its own immutable commission ledger and a controlled payout path; it must not directly update wallet balances from a read API.
- All current changes are design/source only. No production schema changes or payouts are authorized by this contract.

## 3. Identity, attribution and anti-abuse

- Every private endpoint requires the existing authenticated BTCBOX session. Resolve the owner from the verified server session; never trust a client-supplied `user_id`.
- Each eligible user receives one immutable, unique referral code and a canonical share URL.
- Referral code lookup is case-insensitive after normalization. Code generation must use cryptographically secure randomness and a database unique constraint; collision retries happen server-side.
- A new account may bind one inviter only during the approved signup/activation flow. Binding is immutable after the first successful attribution. Never allow self-referral, cycles, duplicate bindings, or retroactive inviter changes through a public API.
- Account linking, multiple auth identities, suspicious device/payment/address clusters, and staff/test accounts require explicit anti-abuse policy. Do not infer identity from editable user metadata.
- L2 attribution is derived from the immutable graph: inviter's inviter. The client cannot submit a level or beneficiary.
- No referral code means no attribution. Do not silently assign a default inviter.

## 4. Proposed API surface

All endpoints are same-origin `/api`, JSON, private/no-store, and owner-scoped.

| Method | Route | Purpose | State |
|---|---|---|---|
| GET | `/api/referral/overview` | Summary: own code/link, direct and indirect invite counts, accrued/available/paid totals by asset | Planned |
| GET | `/api/referral/code` | Read or lazily provision the authenticated user's unique code | Planned |
| POST | `/api/referral/code/rotate` | Restricted rotation; old links remain attributable only according to an approved policy | Disabled until policy |
| GET | `/api/referral/invites?level=1&cursor=...` | Paginated masked invite list and qualification state | Planned |
| GET | `/api/referral/commissions?status=&asset=&cursor=...` | Immutable commission entries with source event, level, rate snapshot, amount, status and timestamps | Planned |
| GET | `/api/referral/policy` | Public, versioned policy summary including effective date and enabled products | Planned |

No public endpoint accepts a beneficiary, inviter, commission amount, fee amount, rate, level, status, or payout destination from the browser.

### GET /api/referral/overview response (illustrative only)

```json
{
  "ok": true,
  "referral": {
    "enabled": false,
    "policy_version": null,
    "code": null,
    "share_url": null,
    "counts": { "direct": 0, "indirect": 0 },
    "totals": {
      "accrued": [],
      "available": [],
      "paid": []
    }
  }
}
```

When the programme is disabled or not configured, return an explicit disabled state; do not return plausible-looking sample numbers. Empty totals are empty arrays, not synthetic zero-balance asset rows.

## 5. Proposed database model (not yet migrated)

Use dedicated tables with RLS enabled and no direct client write access. Server-side service-role access must still include explicit owner filters for reads. Any SECURITY DEFINER routine must have a fixed search_path, narrow EXECUTE grants, explicit authorization checks, and security review.

1. `btcbox_referral_codes`
   - `user_id` unique FK/identity reference; `code` unique normalized text; `status`; `created_at`; optional rotation metadata.
2. `btcbox_referral_attributions`
   - `invitee_user_id` unique; `inviter_user_id`; `bound_at`; `source`; `policy_version`; immutable once set.
   - Check inviter != invitee. Enforce acyclic two-level derivation in trusted server/RPC logic.
3. `btcbox_referral_policies`
   - version, enabled flag, effective window, eligible product/market scope, L1/L2 rates, payout asset/rules, caps, qualification/holding rules, and policy JSON. Rates are decimal NUMERIC, never JS floats.
4. `btcbox_referral_commissions`
   - unique source fee event + beneficiary + level; source trade/fee operation reference; trader; beneficiary; level; fee asset/amount; rate snapshot; commission amount; status; created/available/paid/reversed timestamps; idempotency key.
   - Immutable source facts and append-only correction/reversal records. Never silently edit historical rates or accrued amounts.
5. `btcbox_referral_payout_batches` (only when payout flow is approved)
   - batch status, totals, idempotency, approval/audit references and payout operation references. Actual payout must use the canonical financial ledger transaction path.

Exact FK targets and user-ID data types must be confirmed against the active Auth/business identity model before migration. Do not guess or create incompatible foreign keys.

## 6. Commission accounting rules

- Commission source is an authoritative, committed fee-settlement event emitted by the matching/settlement engine. A fill row by itself is not proof that a fee was collected.
- Commission calculation uses the fee amount and asset actually charged, multiplied by the versioned L1/L2 rate snapshot. Use PostgreSQL NUMERIC and deterministic rounding rules per asset precision.
- One source fee event can create at most one commission row per beneficiary/level. Enforce with a unique constraint and idempotency key.
- If the underlying fee is reversed, refunded, or corrected, append a linked negative reversal/correction entry. Do not delete the original commission.
- Pending, available, paid, reversed, and rejected states must have explicit transitions and audit records. Only available commissions may enter an approved payout batch.
- Payout must be atomic with the relevant Wallet or Exchange ledger credit and use the canonical financial operation/idempotency mechanism. Never credit a displayed total directly.
- No payout or accrual is permitted while the fee source is zero/unimplemented or programme policy is disabled.

## 7. Security and operational requirements

- Prevent BOLA/IDOR: every list/detail query is filtered by the authenticated owner; no user ID is accepted as an authority.
- Rate-limit code lookup and binding attempts. Avoid leaking whether arbitrary accounts exist.
- Use cursor pagination, bounded page sizes, strict asset/status filters, exact decimal strings and opaque IDs.
- Do not expose emails, full invitee identifiers, IPs, device fingerprints, wallet addresses, or internal risk reasons in the normal referral UI.
- Audit policy changes, code rotations, attribution decisions, commission creation/reversal, and payout approvals.
- Fail closed if policy, fee event, identity, or ledger services are unavailable.

## 8. UI integration guidance for AI 2

- Build the Referral page and Rewards hub using a dedicated adapter such as `referralApi.ts`; keep Mock implementation in a separate module and switch it only through an explicit development flag.
- The mock must be visibly labelled "Demo data" / "Preview only" on every screen that shows it. Never mix mock and live values.
- Build empty, loading, disabled, error, and populated states. For live disabled state, show that the programme is not yet active rather than fake earnings.
- Show L1/L2 labels only as explanatory structure; do not hardcode commission percentages or imply a payout guarantee.
- Rewards may link to Referral only when the referral page exists. Launchpad must have its own route and honest unavailable state until a real Launchpad module is implemented; do not point both to an unrelated `/trade-hub`.
- Do not modify the locked trading terminal layout or its order-book/order-entry/market-data flows.

## 9. Delivery gates

1. Approve business policy: L1/L2 rates, eligible products, payout asset, qualification, caps, holding/settlement delay, reversals, and legal copy.
2. Confirm authoritative fee-settlement event and identity/FK types.
3. Add migration SQL and database tests on the feature branch only; do not apply to production without explicit authorization.
4. Implement server routes and anti-abuse tests.
5. Integrate UI adapter and remove demo mode only after live endpoints and end-to-end tests pass.
6. Enable payouts only after ledger atomicity, reconciliation, admin approvals and audit tests pass.

Until gates 1-5 pass, referral remains preview-only and no real commission balance is promised.

## 10. Fee-source verification update (2026-11-17)

The live connected Supabase project was queried read-only. Findings:

- `financial_matching_markets` exists and both live constraints enforce `maker_fee_rate = 0` and `taker_fee_rate = 0`.
- The live `submit_limit_order_matching_v1` function writes four spot fill ledger legs (buyer base/quote and seller base/quote) but contains no fee calculation, fee debit, or fee recipient ledger leg.
- The live `execute_spot_trade_atomic` function also writes only the two traded-asset ledger legs and has no fee handling.
- No `perpetual_*` tables currently exist in the connected project. No referral/invite/reward/commission tables exist either.
- The repository's `0041_perpetual_contract_v1.sql` source defines `maker_fee` and `taker_fee`, subtracts them from the respective trader settlement, and credits their sum to the configured insurance account in the same fill operation/ledger transaction. However, market fee rates default to zero, and this migration is not currently reflected in the connected database (the live `perpetual_*` tables are absent). Therefore it is a potential future authoritative fee source, not a live source today.
- Auth/business identity mapping is `btcbox_auth_accounts.supabase_user_id (uuid) -> btcbox_user_id (text)`; business financial tables use `btcbox_users.user_id (text)`. New referral attribution should key on canonical `btcbox_user_id` only after the verified session-to-BTCBOX identity mapping is present. Do not store a raw email as the relationship key.
- No live referral code, attribution, or commission source currently exists. No fee-bearing trade path was identified as enabled in the connected database.

**Conclusion:** No real referral commission can currently accrue. Keep programme and payouts disabled. The first technical prerequisite is to establish a real fee-bearing settlement path and event identity. Spot needs an atomic fee debit + fee recipient ledger leg before any fee referral can be attached. Perpetual can become a candidate only after migration, nonzero approved fee policy, runtime enablement, and isolated live-DB reconciliation tests. Do not treat the insurance-fund credit as automatically equivalent to distributable platform revenue; revenue ownership and referral split must be explicitly approved.
