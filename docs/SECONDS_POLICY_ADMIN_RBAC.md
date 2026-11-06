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
- Policy transitions require the relevant current permission. The Super Admin may author, review and activate a policy without a three-person separation requirement.
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
- Super Admin can complete the policy lifecycle alone; ordinary Admins are limited to their explicit current grants.
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

## 11. Administrator enrollment, permission lifecycle and recovery

This section is a provisioning contract only. It does not create administrator accounts, permissions, or a database bootstrap path.

### Enrollment and initial bootstrap
- No self-service administrator registration, automatic promotion, or role inference from email domain is allowed.
- An administrator must first have an existing Supabase Auth account. Provisioning is keyed by the exact Auth UUID obtained from a trusted Auth user lookup; email is a human-readable review attribute, never the authorization key.
- The initial bootstrap must be an explicit, owner-controlled, out-of-band operation against an isolated environment first. Require two separately authenticated approvers, a recorded change/ticket identifier, exact Auth UUIDs, the permission set, and a reason. Do not ship a default administrator UUID, email allowlist, shared password, or public bootstrap endpoint.
- After the first administrator set is provisioned, permanently disable/remove the bootstrap path. Further grants use the normal audited permission-management workflow and cannot be self-approved.
- A provisioned identity starts disabled with no permissions until a separate grant is committed. Supabase account existence alone grants no BTCBOX administrator access.

### Permission grant, change and revocation
- Model membership state separately from permission grants. Suggested states: pending, active, suspended, revoked. Suggested permission records contain the exact permission key, grantor Auth UUID, reason, change/ticket reference, created timestamp, and optional expiry.
- Grant/revoke operations require an authorized grantor, reason, expected membership revision, idempotency key, and atomic append-only audit event. A grantor cannot grant permissions to themselves or approve their own elevation.
- Revocation and suspension take effect on the next sensitive request: perform a live server-side membership/permission lookup on every policy transition. Do not cache grants in browser state, long-lived server memory, JWT claims, or a stale session.
- Deleting or disabling a Supabase Auth user must not silently leave an active BTCBOX membership. Disable/revoke the BTCBOX membership first; reject requests if Auth identity lookup or membership status cannot be confirmed.
- Permission names are an allowlisted enum. Unknown permission keys, wildcard grants, implicit inheritance, and client-supplied role names are rejected.

### Emergency recovery and break-glass
- Break-glass is not a normal API role and must never bypass Supabase Auth validation, actor attribution, the three-person policy lifecycle, or append-only audit.
- If all administrators are locked out, recovery is performed only by the project owner through a separately authenticated, out-of-band database operation in an isolated/reviewed change window. Require two-person approval where operationally possible, an incident/change identifier, exact Auth UUIDs, a bounded temporary grant, and a written reason.
- The recovery grant expires automatically and is followed by a mandatory review of every action taken during the window, rotation/revocation of any temporary access, and a new two-person audit record. No permanent hidden super-admin or reusable bypass token is permitted.
- If audit persistence is unavailable, emergency policy mutations remain blocked. Recovery may restore access administration, but it must not activate a seconds policy or enable financial cutover.

### Database and Data API boundary
- Keep membership, permission, provisioning history, idempotency, and audit objects in a dedicated non-exposed schema (proposed name: `private`). Explicitly verify the project's exposed-schema configuration; do not assume a `public` table is private merely because a current default changed.
- Enable RLS as defense in depth, revoke table/schema privileges from `PUBLIC`, `anon`, and `authenticated`, and grant only the minimum server-side role access required. Do not grant the browser role membership reads.
- Keep service credentials server-side. The frontend receives only permission-filtered presentation data and cannot grant, revoke, or edit administrator permissions directly.
- Preserve historical actor UUIDs and audit records when an administrator is suspended or revoked; do not cascade-delete attribution history.

### Provisioning acceptance checks
- New Auth users are not administrators unless a separately audited membership grant exists.
- Email changes, user-editable metadata changes, and JWT role-claim changes do not alter membership or permissions.
- Self-grant, self-elevation, unknown permission, wildcard permission, expired grant, suspended membership, and revoked membership are rejected.
- Permission revocation is honored on the next request, including between draft, review, and activation.
- Duplicate grant/revoke requests replay one committed result; mismatched idempotency payloads conflict.
- Auth lookup, membership lookup, audit storage, or database transaction failure denies the operation.
- Initial bootstrap is unavailable after first provisioning; break-glass grants are temporary, audited, and cannot bypass policy separation of duties.



## 12. Concrete database contract for the first isolated-staging migration

This section is a schema/API contract, not executable SQL. It must be translated into a generated migration and tested on an isolated Supabase staging project before any production consideration.

### 12.1 Private objects and immutable attribution

The first migration must create and secure these objects in the non-exposed private schema:

- administrator memberships: one row per Auth UUID, explicit pending/active/suspended/revoked state, positive monotonic revision, provisioned timestamp, and no cascade deletion of historical attribution;
- permission grant events: append-only grant/revoke/expiry events keyed by Auth UUID and allowlisted permission key, with grantor UUID, reason, ticket/change reference, creation time, and optional expiry; current permissions are derived from events and live membership state;
- policy review decisions: immutable decision bound to policy UUID, exact policy version, canonical content SHA-256, reviewer Auth UUID, decision (approved/rejected), reason, and timestamp; one decision for a version, with a changed draft represented by a new version;
- transition idempotency: request ID, actor UUID, action, target policy/version, expected revision, canonical request hash, committed response, and timestamp; same actor/request ID with a different action, target, revision, or hash conflicts;
- administrator security audit: append-only event with actor UUID, exact permission, action, target, before/after snapshots, reason, ticket reference, request ID/hash, prior/new revision, and server timestamp.

Membership and grant events must not be keyed by email or username. Foreign keys to auth.users should preserve historical actor attribution; user deletion must not cascade-delete membership history or audit events. A missing Auth user or disabled Auth identity must fail closed at request time.

### 12.2 Permission and transition invariants

- Permission keys are a closed enum: seconds_policy.read, seconds_policy.draft, seconds_policy.review, seconds_policy.activate, seconds_policy.retire, and separately scoped administrator-provisioning permissions. Unknown values and wildcard grants are rejected.
- A membership must be active and the exact permission unexpired at the time of every request and again inside the authoritative transition transaction.
- Grant/revoke events increment membership revision. Policy transition requests carry expected membership and policy revisions; stale revisions conflict rather than silently applying.
- Draft creation stores a complete canonical policy snapshot and content hash. Review binds to that exact hash. Any content change creates a new version and requires a new review.
- Approval and activation are separate auditable transitions when the acting administrator's grants require them; the Super Admin may complete the full lifecycle alone. Rejection is terminal for that version.
- Activation atomically checks the acting identity's current permission (or protected Super Admin authority), expected active-pointer revision, effective-time overlap, and request idempotency; then moves the pointer and appends the audit event. Any audit failure rolls back the pointer transition.
- Retirement closes future eligibility only. It never rewrites existing position snapshots or changes settlement of open positions.

### 12.3 PostgREST invocation boundary

The private schema remains absent from Supabase Data API exposed schemas. Because the current backend invokes database RPCs through Supabase REST, a private function cannot simply be assumed callable at /rest/v1/rpc.

Preferred invocation contract:
- keep all tables and authoritative transition functions in the private schema;
- if the backend continues to use PostgREST, provide only a narrowly scoped public-schema SECURITY INVOKER wrapper whose EXECUTE privilege is revoked from PUBLIC, anon, and authenticated and granted only to service_role;
- grant service_role only the minimum private-schema USAGE and function EXECUTE required by that wrapper; do not grant direct table DML;
- wrapper arguments must not include an authoritative actor UUID. The trusted backend supplies a validated Auth subject to the private transition function, and the private function rechecks live membership and permissions;
- if this privilege boundary cannot be demonstrated with catalog queries and adversarial tests, use a separately authenticated direct database connection rather than exposing the private schema.

Do not create a public SECURITY DEFINER wrapper or add private to exposed schemas merely to make the REST call work. Any wrapper must be reviewed for default PUBLIC EXECUTE, schema USAGE, role inheritance, and SECURITY INVOKER behavior.

### 12.4 Migration acceptance matrix

The isolated-staging migration is not accepted until catalog and behavior tests prove:
- private schema is not Data API exposed; PUBLIC/anon/authenticated have no USAGE or table/function privileges;
- service_role cannot directly INSERT/UPDATE/DELETE membership, grant, review, transition, audit, policy, or active-pointer rows;
- only the intended service-role wrapper is executable through PostgREST; browser roles cannot execute it;
- wrapper and private transition both reject caller-supplied actor spoofing, invalid Auth subjects, disabled membership, revoked/expired permissions, and permission-store/audit failures;
- concurrent draft/review/activation attempts serialize correctly and stale revisions conflict;
- duplicate idempotency returns one committed response/audit event, while mismatched payloads conflict;
- Super Admin may complete policy transitions alone; ordinary Admins remain limited to explicit grants, and no operation may alter an open position's policy snapshot.


## 13. Product decision — single super administrator with delegated administrators

This section records the product owner's decision and supersedes conflicting approval/bootstrap language in Sections 4, 9, 11, 12.2 and 12.4.

### 13.1 Administrator model

- There is one owner-controlled Super Admin authority. The Super Admin has every BTCBOX admin permission, including user/account operations, financial review capabilities, system configuration, seconds-policy read/draft/review/activate/retire, administrator creation, permission assignment, suspension and revocation.
- The Super Admin can create or provision ordinary Admin accounts from existing, verified Supabase Auth users. Ordinary Admins cannot create or promote administrators. No public self-registration or automatic promotion is allowed.
- The Super Admin assigns each Admin an explicit set of allowlisted permissions. Permissions are configurable and may be changed, suspended or revoked by the Super Admin at any time.
- Ordinary Admins can perform only the operations covered by their current grants. They cannot create or promote administrators, grant permissions, grant themselves permissions, alter Super Admin authority, or change the Super Admin identity.
- Administrator management is reserved to the Super Admin; it is not a delegable permission. Ordinary Admins cannot obtain it through a wildcard, role label, user metadata, request body, or UI manipulation.
- The Super Admin may perform the complete seconds-policy lifecycle alone. A three-distinct-person author/reviewer/activator rule is not required. Policy changes remain versioned, reasoned, permission-checked and audited.

### 13.2 Super Admin bootstrap and protection

- The initial Super Admin is provisioned once by the project owner through a private, out-of-band operation using the exact UUID of an existing Supabase Auth user. No default email, password, UUID, or public bootstrap endpoint is shipped.
- The Super Admin authority is represented by a protected server-side membership/authority record, not a user-editable metadata claim or a caller-supplied role.
- No ordinary Admin can create, replace, suspend, revoke, or modify the Super Admin. Changing the Super Admin requires a separate owner-controlled out-of-band recovery/change procedure.
- If the Super Admin identity is unavailable, recovery is owner-controlled and audited. Do not add a hidden permanent backdoor or a public break-glass route.

### 13.3 Permission assignment and enforcement

- Use a closed permission allowlist, grouped by product area (for example users, KYC, deposits, withdrawals, orders, support, announcements, system configuration, and seconds policy). The Super Admin receives all permissions implicitly from the protected authority record; ordinary Admins receive explicit grants only.
- Every sensitive request validates the Supabase Auth token with the trusted Auth server, derives the actor UUID from that validated identity, and reads current membership and grants server-side. A stale JWT, browser state, email address, user_metadata, app_metadata, or caller-provided role is never sufficient authority.
- Grant, change, suspension and revocation operations record the Super Admin actor UUID, target Auth UUID, exact permission set, reason, request ID, timestamps and before/after state in append-only audit history. Revocation takes effect on the next sensitive request.
- Permission changes are atomic and idempotent. A repeated identical request returns the committed result; a reused request ID with different content conflicts. Unknown permissions and wildcard grants are rejected.
- The Super Admin cannot be modified through ordinary administrator-management APIs. Ordinary Admins cannot call those APIs even if they forge the UI or request payload.

### 13.4 UI and rollout

- The admin console presents a dedicated Super Admin area for creating/provisioning admins, viewing their status, assigning permission checkboxes/groups, editing grants, and suspending or revoking access.
- Ordinary Admins see only modules and actions allowed by their current permissions. Hiding controls is a usability feature only; every API endpoint independently enforces authorization.
- The first implementation remains source/design-only until an isolated Supabase staging project is available. Do not apply migrations or create a live Super Admin against production as part of this batch.
- This decision does not enable financial cutover, perform deposits/withdrawals, change existing shared Basic Auth routes, merge to main, or deploy.

### 13.5 Acceptance criteria

- The protected Super Admin can perform every admin operation and can create ordinary Admins and assign/revoke their allowlisted permissions.
- An ordinary Admin with no relevant grant is denied; an Admin with a specific grant is allowed only that scope.
- Ordinary Admins cannot self-grant, grant another Admin, create an Admin, or alter Super Admin authority.
- Tampered role fields, user-editable metadata, email changes, stale JWT claims and direct API calls cannot elevate privileges.
- Revocation is effective on the next sensitive request; Auth or permission-store failure fails closed.
- Every administrator lifecycle and permission change is attributable and append-only audited.
- No three-person approval requirement is imposed on Super Admin policy changes.


## 14. Initial backend permission catalogue

This is the initial allowlist for ordinary Admin grants. The Super Admin receives all capabilities from the protected Super Admin authority and does not need individual grants. These keys are a closed enum; do not accept arbitrary strings, wildcard values, or implicit role inheritance.

| Permission key | Scope |
| --- | --- |
| dashboard.read | Read operational dashboard and aggregate status |
| users.read | Search and view user profiles |
| users.manage | Update permitted non-security user fields |
| users.freeze | Freeze or unfreeze accounts under the approved account policy |
| kyc.read | View KYC submissions and review queue |
| kyc.review | Approve or reject KYC submissions |
| deposits.read | View deposit requests and status |
| deposits.review | Review deposit confirmations; does not itself authorize ledger posting outside the approved financial workflow |
| withdrawals.read | View withdrawal requests and status |
| withdrawals.review | Review withdrawal requests; does not bypass financial cutover, security checks, or transaction settlement controls |
| orders.read | View orders, positions, and order history |
| support.read | View customer support conversations |
| support.reply | Reply to customer support conversations |
| support.manage | Assign, categorize, and close support cases |
| announcements.read | View announcements and delivery status |
| announcements.manage | Create, edit, publish, or retire announcements |
| system_config.read | Read operational configuration |
| system_config.write | Change allowlisted operational configuration with reason and audit |
| seconds_policy.read | Read current and historical seconds-contract policy |
| seconds_policy.manage | Create and activate policy versions, subject to policy validation, immutable snapshots and audit |
| financial_audit.read | Read financial audit records; sensitive fields remain masked by default |
| financial_adjustment.request | Submit a reviewed balance-adjustment request, not post arbitrary ledger rows |

Administrator provisioning and permission assignment are deliberately absent from the ordinary grant catalogue. Only the Super Admin can list, create, modify, suspend, revoke, or grant permissions to Admin accounts. A separate owner-controlled procedure changes Super Admin authority.

High-impact financial operations remain independently gated by backend cutover flags, transaction RPCs, idempotency, balance invariants, security checks and audit persistence. An Admin permission never bypasses those controls, and a UI permission never substitutes for server authorization.


## 15. Private administrator store v1 — source implementation contract

This source-only migration implements the first storage layer for the single Super Admin / delegated Admin product decision. It does not apply itself and does not create the first administrator.

### Objects
- `private.admin_memberships`: Auth UUID primary key, active/suspended/revoked state, protected Super Admin flag, monotonic revision, timestamps and creator UUID. A partial unique index permits at most one Super Admin.
- `private.admin_permission_catalog`: closed seed list matching the backend permission helper.
- `private.admin_permission_events`: append-only grant/revoke events; current permissions are derived from the latest event for each permission and live membership status.
- `private.admin_security_audit`: append-only actor/target/action/reason/request-hash/before/after history.
- `private.admin_request_idempotency`: actor + request ID primary key, request hash and committed response.

### Functions and privilege boundary
- `private.bootstrap_super_admin_v1`: owner-only one-time SQL operation; EXECUTE granted only to `postgres`. It requires an existing Auth UUID, a reason and change reference, refuses a second Super Admin, and creates an audit event. It is not an HTTP endpoint.
- `private.admin_get_membership_v1`: trusted backend lookup after Supabase Auth verification; returns active status, revision and current allowlisted permissions.
- `private.admin_manage_membership_v1`: trusted-server transition requiring an active Super Admin actor. It provisions an existing Auth user, replaces explicit grants, suspends/reactivates/revokes ordinary Admins, rejects self-management and any Super Admin target, increments revision, writes grant/revoke events, idempotency and audit atomically.
- The service role has private schema USAGE and EXECUTE on the two runtime functions only. It has no direct table DML. PUBLIC/anon/authenticated have no schema/table/function access. Tables have RLS enabled as defense in depth. The private schema must remain absent from Data API exposed schemas.
- SECURITY DEFINER is confined to private functions with fixed search_path and narrow EXECUTE grants; there is no public SECURITY DEFINER wrapper.

### Important integration boundary
The SQL functions trust the actor UUID passed by the trusted backend. The future route MUST first call the Supabase Auth user endpoint, derive the actor UUID from that verified response, ignore actor/role fields in request JSON, and only then call the private RPC using the server-held service credential. Never expose the service credential. The backend must compute a canonical SHA-256 request hash and stable request ID. A private schema RPC is not automatically callable through PostgREST unless private is exposed; do not expose it. The integration must use a separately verified invocation path or a narrowly reviewed SECURITY INVOKER wrapper without granting direct table DML.

### Bootstrap and safety
The migration seeds only permission definitions. It does not create a Super Admin, ordinary Admin, permission grant, or default account. Initial Super Admin bootstrap is a separate owner-controlled SQL operation against an isolated staging environment, using an exact verified Auth UUID. No self-service bootstrap, default email, password, or hidden recovery account exists. Ordinary APIs cannot modify the Super Admin identity.

### Validation status
This batch adds migration source and static contract tests only. No PostgreSQL parser or isolated staging database was available for execution, so SQL runtime/catalog behavior is NOT yet validated. Do not apply this migration to production. The next integration stage must validate SQL on isolated staging, verify actual role/function privileges and exposed-schema configuration, and test concurrent/idempotent operations before any route is connected.


### 15.1 Source review corrections
- Bootstrap audit attribution is explicitly marked `owner_bootstrap` with no fabricated administrator actor UUID; the target Auth UUID remains separately recorded.
- Permission replacement writes a complete grant/revoke snapshot for every catalogue key, so removing a permission actually revokes it rather than leaving an older grant active.
- A transaction-scoped advisory lock serializes the same actor/request-id before idempotency lookup, preventing concurrent identical retries from racing into duplicate mutations.
- Permission-event ordering uses an identity sequence as a deterministic tie-breaker for events created in the same timestamp resolution window.
