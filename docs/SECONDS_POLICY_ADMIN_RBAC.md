# BTCBOX Seconds Policy Administration — Identity, RBAC and Approval Contract

Status: proposed security design; documentation only. No runtime admin identity or policy-write feature is enabled by this document.
Scope: seconds-contract policy management only. This is not a general admin-console RBAC migration.

## 1. Current-state boundary

The current admin API is protected by one shared `ADMIN_USER` / `ADMIN_PASS` Basic Auth credential. The authenticated actor is effectively the shared configured username, not a separately authenticated human administrator. Existing admin audit logging does not turn that shared credential into attributable individual identity.

Therefore:
- Do not expose seconds-policy create, edit, approve, activate, schedule, retire, or delete routes under the current Basic Auth gate.
- Do not accept `actor_id`, `role`, `approved_by`, or `activated_by` from request JSON as proof of identity or authority.
- Do not infer an admin role from customer `user_metadata`, browser state, local storage, email text, or an unverified JWT payload.
- Keep existing admin routes and authentication behavior unchanged until a separately reviewed migration and compatibility plan is approved.

## 2. Proposed administrator identity

Use a dedicated administrator identity mapped to a Supabase Auth user:
- The request must carry a valid Supabase access token in the Authorization Bearer header.
- The backend must validate the token with the trusted Supabase Auth server (for example, the Auth `getUser` endpoint) before using its subject. Decoding a JWT locally without signature/issuer/audience/expiry verification is not sufficient.
- The canonical actor is the validated Auth user UUID (`sub` / returned user ID), never a caller-supplied actor field.
- Keep administrator membership and permissions in a private, non-Data-API-exposed schema/table, keyed by Auth user UUID. Read the current membership/permission state server-side for every sensitive action so revocation is not delayed by stale JWT role claims.
- Do not use mutable `user_metadata` for authorization. Do not rely solely on `app_metadata` claims for immediate revocation.
- Unknown, disabled, suspended, or unavailable identity/permission state fails closed.

The initial implementation should be additive and isolated to seconds-policy administration. It must not silently convert all existing Basic Auth admin routes or alter their current behavior.

## 3. Least-privilege permissions

Use explicit permission keys, not a broad `is_admin` boolean:
- `seconds_policy.read`: read current and historical policy summaries.
- `seconds_policy.draft`: create a new draft policy version.
- `seconds_policy.review`: approve or reject a submitted draft.
- `seconds_policy.activate`: activate an already-approved version or schedule its effective time.
- `seconds_policy.retire`: retire a policy according to the defined effective-time and open-position rules.

A role may map to one or more permission keys, but the database/API must check the specific permission for every operation. No policy mutation permission is implied by access to the existing admin console.

## 4. Separation of duties

For every policy version that becomes active:
- The author, reviewer, and activator must be three distinct validated administrator subjects.
- An author cannot review or activate the same policy version.
- A reviewer cannot activate the same policy version.
- A rejected draft cannot be activated; changes after review create a new immutable draft revision and require review again.
- An administrator's permission can be revoked between stages; the permission must be rechecked at the time of each transition.
- Emergency suspension, if later required, must be a separate audited operation with narrowly scoped permission and explicit behavior for already-open positions. Do not invent it as a side effect of ordinary policy edits.

This is a proposed high-assurance separation-of-duties model. Any relaxation (for example, allowing one person to hold multiple roles across separate actions) requires explicit product/security approval and must never collapse the three actor identities for one activation.

## 5. Policy lifecycle and immutable versions

Recommended lifecycle:
1. Draft: author submits a complete candidate version with a reason and expected base version.
2. Review: a different reviewer approves or rejects the exact immutable draft hash/version.
3. Activation: a third administrator activates the approved version, immediately or at a validated future effective time.
4. Retirement: a separately authorized action closes future eligibility without rewriting positions already opened under the policy.

Every edit creates a new draft/version. Never UPDATE an activated policy row in place. The active pointer transition, effective-window conflict check, audit append, request-idempotency record, and optimistic revision check must commit atomically.

A policy must contain the full approved terms: symbol allowlist, duration allowlist, min/max stake, payout basis points (85%–100% with 85% minimum), exposure cap, effective time, and any other settlement-relevant term. Missing/unknown active policy fails closed for new orders. The frontend is a display/editor only; the database RPC is authoritative.

## 6. API contract before implementation

Proposed route family (not implemented):
- `GET /api/admin/seconds-policy`: authenticated read; requires `seconds_policy.read`.
- `POST /api/admin/seconds-policy/drafts`: create immutable draft; requires `seconds_policy.draft`.
- `POST /api/admin/seconds-policy/drafts/:id/review`: approve/reject exact draft; requires `seconds_policy.review`.
- `POST /api/admin/seconds-policy/:id/activate`: activate/schedule approved version; requires `seconds_policy.activate`.
- `POST /api/admin/seconds-policy/:id/retire`: retire version; requires `seconds_policy.retire`.

Every mutation must:
- Derive actor ID from validated Supabase Auth identity; reject caller-provided actor/role fields.
- Require a bounded non-empty reason, a high-entropy request ID/idempotency key, and an expected revision/version.
- Bind idempotency to actor, action, object, expected revision, and canonical request hash.
- Reject duplicate request IDs with mismatched payloads and stale revisions.
- Recheck permission and separation-of-duties inside the authoritative database transition, not only in React or a preliminary API check.
- Return committed policy version, new revision, audit event ID, and effective time.
- Fail closed if Auth, permission lookup, audit persistence, or database transaction is unavailable.

Do not expose arbitrary PATCH/PUT/DELETE for policy rows. Use narrowly scoped transition RPCs in a private schema, revoke default PUBLIC execution, and grant execution only to the trusted server role. Review any SECURITY DEFINER function carefully: fixed search_path, strict identity/permission checks, no client execution, and no bypass of actor separation.

## 7. Audit requirements

Append an audit event in the same database transaction as each successful state transition. Record:
- validated actor UUID and permission used;
- action and target policy ID/version;
- before/after canonical policy snapshots (secrets and unrelated personal data excluded);
- reason, request ID, request hash, prior/new revision, and server timestamp;
- author/reviewer/activator identity references.

Audit rows are append-only. A failed or rolled-back transition must not leave a success audit event. A lost response followed by retry must return the same committed result without duplicating the transition or audit event.

## 8. Admin UI behavior

The UI should expose policy controls only after read/write APIs and server-side authorization are complete:
- Read-only current policy and version history first.
- Draft editor validates inputs for usability, but never acts as the authority.
- Review view shows the exact candidate diff, author, reason, and effective time.
- Activation view shows reviewer identity and requires explicit confirmation.
- Users without a permission do not see an actionable control; direct API calls are still rejected server-side.
- Loading, validation, conflict, unauthorized, unavailable, and success states must be explicit.
- No frontend control may write directly to policy tables or use the Supabase service-role key.

## 9. Required acceptance tests

- Invalid/expired/wrong-issuer token, unknown admin, disabled admin, and permission-store outage all fail closed.
- Caller-supplied actor ID or role cannot influence authorization or audit identity.
- User-editable metadata cannot grant administrator permissions.
- Author/reviewer/activator identity collisions are rejected.
- Permission revocation between draft, review, and activation is honored.
- A rejected or stale draft cannot be activated.
- Concurrent activation/effective-window conflicts are rejected transactionally.
- Missing reason, nonce/idempotency key, or expected revision is rejected.
- Duplicate identical requests replay the committed result; mismatched duplicates conflict.
- Policy transition and audit append commit or roll back together.
- Existing open positions retain their policy/payout snapshots after later policy activation or retirement.
- All tests run against an isolated staging database; financial cutover remains closed.

## 10. Rollout gates and explicit non-goals

Before implementation: review and approve the identity provider contract, administrator enrollment/provisioning process, role assignments, separation-of-duties model, and emergency recovery process.

This document does not create admin users, grant roles, create database tables/functions, expose API routes/UI, apply a migration, alter existing admin login, enable financial writes, merge, or deploy.
