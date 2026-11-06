# Seconds Contract Policy Versioning

Status: design specification plus source-only migration contract; no live migration/runtime acceptance is implied.
Owner: BTCBOX backend/business integration.
Scope: seconds-contract product policy. Perpetual futures are explicitly out of scope.

## Authority

The backend and database are authoritative. The browser may display policy returned by an authenticated read endpoint, but may not decide or override symbols, direction, duration, stake limits, payout, reference price, maturity, settlement outcome, exposure caps, or activation time.

The existing order/settlement path remains unchanged until schema deployment, RPC integration, administrator authorization, audit trail, isolated staging migration, and QA gates are complete.

## Baseline values (source-observed; not a new approval)

- Symbols: BTC, ETH, SOL, BNB.
- Durations: 30, 60, 300, 900 seconds.
- Direction: up or down.
- Stake: positive; API hard ceiling currently 1,000,000,000,000.
- Winning profit: policy minimum 85% (8500 bps), configurable up to 100% (10000 bps); tie returns stake; loss loses stake.
- These values document current source behavior only. They are not approval to increase limits or alter commercial terms.

## Current source implementation boundary (migration 0025)

The feature branch contains `backend/supabase/sql/0025_seconds_policy_versioning_v1.sql`. This is a source artifact only; its presence in Git does not prove it has been applied to any Supabase database.

That migration currently defines:
- `public.seconds_contract_policies`: immutable policy content rows with version, symbols, durations, min/max stake, payout (8500–10000 bps), optional per-user exposure, effective window, reason, and text `created_by`.
- `public.seconds_contract_policy_active`: a singleton active-policy pointer.
- `public.seconds_contract_policy_audit`: append-only seed/draft-created/activated/retired audit vocabulary.
- Nullable `policy_id`, `policy_version`, `payout_bps_snapshot`, and `policy_snapshot` columns on `public.seconds_contract_positions`.
- `submit_seconds_order_v1` reads the active policy, checks policy symbol/duration/stake/exposure, and stores the policy/payout snapshot in the same transaction as the order reserve.
- `settle_seconds_position_v1` calculates winning profit from the stored payout snapshot; legacy NULL snapshots retain the 85% fallback; tie returns principal.

The migration enables RLS and revokes table access from PUBLIC/anon/authenticated. It grants service_role SELECT on policy and active-pointer tables, but revokes service_role INSERT/UPDATE/DELETE on policy, active-pointer, and audit tables. The order/settlement RPCs remain service_role-only and SECURITY INVOKER.

**Not implemented by migration 0025:** individually authenticated admin actors, role/membership tables, draft/review/activation transition APIs, three-person separation of duties, admin policy-write RPCs, idempotency records for admin transitions, or a policy editor UI. The existing `created_by` and audit `actor_id` are text fields and are not proof of a validated Supabase Auth subject.

## Future governance data model

The following is a target extension, not a description of the current migration:
- Keep policy content immutable; every edit creates a new policy version.
- Store administrator membership and permissions in a private, non-Data-API schema. Canonical actor IDs must be UUIDs derived from a server-validated Supabase Auth user, never caller-supplied role/actor fields.
- Store exact-version review decisions and admin mutation idempotency/revision records separately from immutable policy content.
- Use distinct author, reviewer, and activator identities. No single identity may occupy more than one of those roles for a version.
- Add narrowly scoped database transition operations only after privilege design review. SECURITY DEFINER is not a default: if required to bridge table grants, keep the function in a non-exposed schema, fix search_path, revoke default PUBLIC execution, grant only the trusted server role, and enforce actor/permission/separation checks inside the transaction.
- Prevent overlapping effective windows and stale concurrent activation; append audit events atomically with every successful transition.

## Required database and API controls

- Policy lookup and validation happen inside the transactional order RPC; API-only validation is insufficient.
- anon/authenticated receive no direct policy-table access. The current migration grants service_role read-only access; no policy write path exists.
- Admin writes require an individually validated administrator identity, explicit seconds-policy permission, idempotency, optimistic revision matching, and the three-distinct-actor separation described in `docs/SECONDS_POLICY_ADMIN_RBAC.md`.
- Separate create-draft, review, activate, and retire transitions. No arbitrary PATCH/PUT/DELETE policy-row endpoint.
- Require a non-empty change reason and append an audit event in the same transaction as each successful state transition.
- Enforce per-user open exposure and one-open-position constraints in the database, not only in React.
- Do not edit/delete policy versions, audit rows, or position snapshots.
- Policy read API must be authenticated; admin mutation API must be server-authorized and return committed version and audit ID.
- Missing/expired active policy fails closed for new orders; never synthesize a default policy at runtime.

## Rollout sequence

1. Review and approve the business baseline, administrator enrollment, permission model, and emergency recovery process.
2. Design the additive governance schema and transition RPCs against the exact existing migration 0025 contract; inspect namespace and privilege collisions first.
3. Generate migration files through the supported Supabase CLI workflow; do not hand-invent migration filenames.
4. Add admin API with verified identity, authorization, nonce/idempotency, optimistic concurrency, separation of duties, and atomic audit.
5. Add read-only policy preview; expose draft/review/activation UI only after backend authorization tests pass.
6. Apply only to isolated staging after explicit approval. Test concurrency, effective-time boundaries, historical position settlement, replay, and financial ledger invariants.
7. Keep all financial cutover flags closed until staging evidence is complete and the user separately authorizes release.

## Acceptance tests required before enabling policy writes

- Invalid symbols, durations, stake bounds, exposure, and unknown policy versions are rejected by the database RPC.
- Concurrent activation cannot create overlapping active policies.
- Stale revision, duplicate request, unauthorized role, missing idempotency key, and missing change reason are rejected.
- Author/reviewer/activator collisions and revoked permissions are rejected at transition time.
- Audit record and policy transition commit or roll back together.
- New positions store the exact active version and payout snapshot.
- Policy changes do not change existing open positions or their settlement result.
- Legacy NULL-snapshot positions settle with the legacy rule, without guessed backfill.
- Client-supplied payout, policy ID, price, maturity, or outcome cannot override server/database values.
- Full backend tests and isolated staging RPC tests pass with financial cutover still closed.

## Explicit non-goals

This specification does not create or apply a migration, create admin users or permissions, change the current 85% minimum, raise or lower stake limits, enable financial writes, expose a policy editor, or authorize a merge/deployment.
