# Seconds policy versioning design

Status: design only; no financial behavior or database has been changed.

## Current source baseline
- Backend accepts BTC, ETH, SOL, BNB.
- Backend accepts 30, 60, 300, 900 second durations.
- Stake must be positive and no greater than 1,000,000,000,000.
- Settlement currently pays 85% profit on a win, fixed in the SQL function.
- Admin config currently edits deposit addresses and announcement only.
- Admin authentication is shared Basic Auth, not individual policy-management identities.

Do not change these values until a separately approved policy is staged and verified.

## Proposed immutable policy model
Use non-public/private schema tables and service-role-only RPC wrappers. Never grant browser roles direct access.

1. `seconds_contract_policy_versions`: immutable rows with policy UUID, monotonic version, supported symbols, durations, min/max stake, payout basis points, per-user exposure limit, effective time, actor, reason, creation time, and canonical JSON snapshot. Corrections create a new version; never update an existing version.
2. `seconds_contract_policy_control`: one active-policy pointer with a monotonically increasing control version. Activation uses compare-and-swap against the expected version.
3. `seconds_contract_policy_audit`: append-only events with actor, reason, old/new policy IDs, expected/resulting control versions, before/after snapshots, and timestamp. Activation and audit append occur in one transaction.

## Position snapshot
Add nullable policy ID/version for legacy rows, plus payout basis points and immutable policy snapshot. For each new order, the database reads the active policy, validates symbol/duration/stake/exposure, reserves funds, and stores the exact policy snapshot in the same transaction. The client never supplies policy IDs, payout, limits, or snapshots.

Legacy positions must be explicitly tagged as legacy and retain the existing 8500-basis-point rule after historical semantics are verified. Settlement must use the payout basis points stored on that position, never the current active policy.

## Administrator and API requirements
- Keep policy tables inaccessible to anon/authenticated/browser roles.
- Use server-verified individual administrator identities and a policy-management role before write access. The current shared Basic Auth credential does not provide distinct actors or granular roles.
- If Supabase JWT claims are used, authorize only from trusted server-managed app_metadata, never user_metadata.
- Require CSRF protection, nonce/idempotency key, human-readable reason, and optimistic control-version checks.
- Append the audit event atomically with activation.
- Fail closed when policy state is missing, invalid, stale, or unavailable; never fall back to client-provided values.
- Consider two-person approval for payout and exposure-limit changes.

## Staging gates
- Generate the migration through the repository's actual Supabase CLI workflow; inspect its generated name and order.
- Apply the complete financial migration chain only to isolated staging.
- Verify grants, RLS, function search_path, and database advisors.
- Test invalid values, missing policy, stale/concurrent activation, idempotent retries, audit atomicity, and concurrent exposure checks.
- Open a position under policy A, activate policy B, and prove settlement still uses policy A.
- Verify legacy positions retain the historical 85% rule and browser roles cannot read or mutate policy data.
- Keep the financial cutover fail-closed until the authoritative ledger cutover is complete.

## Scope exclusions
No migration, endpoint, admin UI, payout change, order-rule change, database mutation, financial operation, merge, or deployment is authorized or performed by this design.
