# Seconds Contract Policy Versioning

Status: design specification only; not an executable migration.
Owner: BTCBOX backend/business integration.
Scope: seconds-contract product policy. Perpetual futures are explicitly out of scope.

## Authority

The backend and database are authoritative. The browser may display the policy returned by an authenticated read endpoint, but may not decide or override symbols, direction, duration, stake limits, payout, reference price, maturity, settlement outcome, exposure caps, or activation time.

The existing order/settlement path remains unchanged until the schema, RPC integration, admin authorization, audit trail, staging migration, and QA gates below are complete.

## Baseline values (source-observed; not a new approval)

- Symbols: BTC, ETH, SOL, BNB.
- Durations: 30, 60, 300, 900 seconds.
- Direction: up or down.
- Stake: positive; API hard ceiling currently 1,000,000,000,000.
- Winning profit: currently 85% of stake; future policy versions may configure 85%–100%; tie returns stake; loss loses stake.
- Current SQL positions do not carry a policy version or payout snapshot.

These values document current source behavior only. They are not a proposal to increase limits or alter commercial terms. A future admin policy must be seeded from a reviewed baseline and must never silently broaden these values.

## Target data model

### seconds_contract_policies

Append-only policy versions, one row per immutable version:
- id UUID primary key
- version BIGINT unique, monotonically increasing
- status: draft | scheduled | active | retired
- symbols TEXT[] (validated against the server-supported symbol registry)
- durations_sec INTEGER[] (validated against the server-supported duration registry)
- min_stake NUMERIC(38,18), max_stake NUMERIC(38,18)
- payout_bps INTEGER (8500..10000; 8500 is the minimum, 10000 is the maximum; values are per policy version)
- per_user_open_exposure NUMERIC(38,18)
- effective_from TIMESTAMPTZ, effective_until TIMESTAMPTZ nullable
- created_by, approved_by (authenticated admin subject IDs)
- created_at, activated_at
- change_reason TEXT (required and bounded)
- optimistic revision/version token

Constraints: min_stake > 0; max_stake >= min_stake; payout_bps between 8500 and 10000 (85% minimum, 100% maximum); effective_until > effective_from when present. Prevent overlapping active windows. Exactly one policy may be active at a given instant. A policy version is immutable after activation; edits create a new version.

### seconds_contract_policy_audit

Append-only audit events:
- id UUID primary key
- policy_id UUID
- action, actor_id, actor_role
- before_snapshot and after_snapshot JSONB
- reason, request_id, created_at

No UPDATE/DELETE permission for application roles. Audit values must exclude secrets and personal data not needed for accountability.

### Position snapshot

Add nullable fields to seconds_contract_positions for legacy compatibility:
- policy_id UUID
- policy_version BIGINT
- payout_bps_snapshot INTEGER
- policy_snapshot JSONB (only settlement-relevant immutable terms)

New orders must atomically resolve the active policy at database time, validate symbol/duration/stake/exposure against it, and persist its ID/version/payout snapshot with the position in the same transaction as the reserve. Legacy positions with NULL policy fields retain their existing settlement behavior; they must never be backfilled with a guessed policy.

Settlement must calculate profit from the position snapshot, not by reading the currently active policy. The configured payout_bps_snapshot must be between 8500 and 10000. 8500 produces 0.85 stake profit; higher versions may increase that profit up to 1.00 stake. Later policy changes never change an already-open position's payout, duration, stake, or settlement terms. A later policy change must not change any open position's payout, duration, stake, or settlement terms.

## Required database and API controls

- Policy lookup and validation happen inside the transactional order RPC; do not rely only on API-layer validation.
- RPC execution remains service_role-only; anon/authenticated receive no direct table access.
- Admin writes require an individually validated administrator identity, explicit seconds-policy permission, recent-auth/request-nonce protection, idempotency, optimistic revision matching, and the three-distinct-actor author/reviewer/activator separation described in `docs/SECONDS_POLICY_ADMIN_RBAC.md`.
- Separate create-draft, approve/schedule, activate, and retire transitions. No direct arbitrary UPDATE endpoint.
- Require a non-empty change reason and append an audit event in the same transaction as every state transition.
- Enforce per-user open exposure and one-open-position constraints in the database, not only in React.
- Do not allow editing or deleting activated policy versions, audit rows, or position snapshots.
- Policy read API is authenticated; admin mutation API is role-gated and returns the committed version and audit ID.
- Unknown/expired/missing active policy fails closed for new orders. It must not synthesize a default policy at runtime.

## Rollout sequence

1. Review this specification and explicitly approve the business baseline and administrator permission model.
2. Add an additive migration in a dedicated feature branch. Keep all new policy fields nullable for existing positions.
3. Add immutable policy version/audit tables, constraints, grants, and database-side active-policy resolver.
4. Update order RPC to atomically validate and snapshot the active policy; update settlement RPC to use only the stored snapshot. Preserve legacy NULL-snapshot settlement behavior.
5. Add admin API with authorization, nonce/idempotency, optimistic concurrency and append-only audit. Do not expose UI before API tests pass.
6. Add read-only policy preview to admin; then add draft/review/activation controls only after independent security review.
7. Apply migration only to isolated staging. Test rollback strategy, concurrency, effective-time boundaries, historical position settlement, replay, and financial ledger invariants.
8. Keep all financial cutover flags closed until staging evidence is complete and the user separately authorizes release.

## Acceptance tests required before enabling policy writes

- Invalid symbols, durations, stake bounds, exposure, and unknown policy versions are rejected by the database RPC.
- Concurrent activation cannot create overlapping active policies.
- Stale revision, duplicate request, unauthorized role, missing nonce, and missing change reason are rejected.
- Audit record and policy transition commit or roll back together.
- New positions store the exact active version and payout snapshot.
- Policy changes do not change existing open positions or their settlement result.
- Legacy NULL-snapshot positions settle with the legacy rule, without guessed backfill.
- Client-supplied payout, policy ID, price, maturity, or outcome cannot override server/database values.
- Full backend tests and isolated staging RPC tests pass with financial cutover still closed.

## Explicit non-goals

This specification does not create or apply a migration, change the current 85% payout, raise or lower stake limits, enable financial writes, expose a policy editor, or authorize a merge/deployment.
