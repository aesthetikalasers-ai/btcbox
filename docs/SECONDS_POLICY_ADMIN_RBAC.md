# BTCBOX Seconds Policy Administration — Identity and RBAC Contract

Status: source implementation exists on the integration branch. Hosted schema installation, initial Super Admin provisioning and end-to-end runtime verification remain pending.

## Identity and permission model

- Admin API requests use a Supabase Auth Bearer token. The backend validates the token with Supabase Auth and derives the actor UUID from the returned authenticated user; caller-supplied actor IDs, roles, email or user metadata are not authorization evidence.
- Membership and delegated permissions live in the private schema created by `0026_admin_rbac_private_store_v1.sql`.
- Membership and permissions are checked server-side for sensitive requests. Suspended, revoked, unknown or unavailable membership fails closed.
- Super Admin is a separate membership flag. An active Super Admin receives every permission in the permission catalog and can manage delegated administrators and Seconds policy without a three-person workflow.
- Ordinary administrators receive only explicitly granted permissions. Seconds policy editing requires `seconds_policy.manage`; reading requires `seconds_policy.read`.
- The browser does not write private tables or policy tables directly. The backend calls narrow service-role-only public RPC wrappers.

## Implemented administrator lifecycle

`0026_admin_rbac_private_store_v1.sql` creates the private membership, permission catalog, append-only permission events, security audit and request-idempotency store. `0028_admin_rbac_service_rpc_wrappers_v1.sql` exposes narrow PostgREST wrappers with execution granted only to `service_role`.

The initial Super Admin bootstrap is a one-time owner-controlled database operation:
1. The intended administrator first registers/signs in so an exact row exists in `auth.users`.
2. The project owner verifies the Auth UUID out of band.
3. The owner invokes `private.bootstrap_super_admin_v1` from a PostgreSQL owner session (`session_user = postgres`) with a reason and change reference.
4. The function refuses if a Super Admin already exists and appends an owner-bootstrap audit event.

This bootstrap is not exposed as an API. It does not create a customer or Auth account. No initial Super Admin has been provisioned merely by adding the SQL source.

After bootstrap, the Super Admin can provision, change permissions, suspend, reactivate and revoke delegated administrators. The database RPC verifies that the acting membership is an active Super Admin, verifies the target Auth user exists, prevents self-change and Super Admin modification, checks optimistic revision and idempotency, and appends audit events transactionally.

## Implemented Seconds policy transition

- `GET /api/admin/seconds-policy` requires `seconds_policy.read`.
- `POST /api/admin/seconds-policy` requires `seconds_policy.manage`.
- The API derives the actor UUID from verified Auth, canonicalizes and hashes the request, and calls `public.admin_set_seconds_policy_v1`.
- The SQL transition rechecks live membership permission, request ID/hash, expected active policy version and policy bounds. It creates a new immutable policy version, moves the active pointer, appends the policy audit and stores the replay response in one transaction.
- Payout is constrained to a minimum of 8500 bps (85%) with no fixed upper ceiling. Durations are positive integer seconds. Optional exposure and open-position limits are supported.
- A policy change is one atomic create-and-activate action. Separate draft, reviewer, schedule and retirement APIs are not part of the current implementation.
- The Super Admin may complete the policy change alone. No three-person or distinct-author/reviewer/activator requirement applies.

## Security invariants

- No shared Basic Auth fallback for the React Admin API.
- No authorization from browser state, customer metadata or caller-provided actor/role fields.
- Private schema tables are not directly accessible to `anon`, `authenticated` or `service_role`; trusted service execution is through narrow functions.
- Money-moving and policy transitions require database-side validation, bounded reason, request idempotency and audit in the same transaction.
- Identical retries replay the stored response; mismatched request hashes conflict.
- Stale policy versions are rejected. Refresh is required before retrying a changed policy.
- Missing Auth, permission state, policy storage or audit persistence fails closed.

## Remaining verification

- The SQL chain has not yet been executed against a disposable empty PostgreSQL database.
- Owner bootstrap and first Super Admin enrollment have not been performed.
- Real Supabase Auth-to-PostgREST integration and browser E2E have not been proven.
- No hosted database write, production deployment or main-branch merge is authorized by this document.

Run the complete ordered SQL chain against an isolated empty database before any hosted installation. Verify privileges, bootstrap, delegated-admin lifecycle, Super Admin policy changes, concurrency, idempotent replay and audit atomicity. Keep financial cutover disabled until separate approval.