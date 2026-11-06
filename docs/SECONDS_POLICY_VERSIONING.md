# Seconds Contract Policy Versioning

Status: implemented in the integration branch source; hosted database application and runtime PostgreSQL verification are NOT VERIFIED.
Owner: BTCBOX backend/business integration.

## Authority and source boundary

The database order/settlement RPCs are authoritative. The browser is an editor/display only. Source files in Git do not prove a hosted Supabase database has these migrations installed.

Implemented source:
- `0025_seconds_policy_versioning_v1.sql`: immutable policy versions, active pointer, append-only policy audit, position snapshots, server-side order policy validation and payout-snapshot settlement.
- `0026_admin_rbac_private_store_v1.sql`: private admin membership/permission store, owner-only initial Super Admin bootstrap, delegated-admin lifecycle and live permission lookup.
- `0028_admin_rbac_service_rpc_wrappers_v1.sql`: service-role-only PostgREST wrappers, including atomic Seconds policy version creation/activation.
- `backend/api-core.js`: authenticated `GET /api/admin/seconds-policy` and `POST /api/admin/seconds-policy` routes. Actor UUID comes from verified Supabase Auth, and the route checks `seconds_policy.read` or `seconds_policy.manage`.
- `frontend/src/features/admin/AdminPage.tsx`: policy editor with request-key preservation, optimistic policy version, reason, and payout/duration/stake/exposure controls.

## Policy behavior

- Symbols are selected from BTC, ETH, SOL and BNB.
- Durations are configurable positive integer seconds; no fixed preset list is required by the database policy schema.
- Minimum payout is 8500 bps (85%). There is no schema-level 100% ceiling; the backend and UI must preserve that rule.
- Minimum/maximum stake are configurable and validated by the database RPC.
- Per-user open exposure and unfinished-position count are optional policy limits. A null limit means that limit is not imposed.
- Every successful policy change creates a new immutable version, updates the active pointer, appends an audit event and stores the idempotent response in one transaction.
- The active policy version is checked optimistically. A stale editor must refresh rather than overwrite a newer policy.
- New Seconds orders read the active policy inside the transaction that reserves funds and snapshot policy ID/version/payout terms on the position. Existing positions retain their snapshots.
- Missing active policy, unavailable policy storage, invalid server price or policy violation fails closed for new orders.

## Administrator authority

The current source uses verified Supabase Auth identity and the private membership store. A Super Admin receives every permission in the catalog, including `seconds_policy.manage`; delegated admins require that explicit permission. The SQL transition rechecks the live membership permission inside the transaction.

The implemented lifecycle is one atomic create-and-activate operation per change. Separate draft/review/scheduled activation/retirement endpoints are not implemented and must not be described as shipped. The Super Admin can make a complete policy change alone; no three-person approval is required.

Initial Super Admin bootstrap is a one-time owner-controlled SQL operation after an existing Supabase Auth user has registered. The function requires the database `session_user` to be `postgres`, validates the exact Auth UUID, records a reason/reference, and refuses if a Super Admin already exists. It is not a public API or self-service promotion.

## Validation status and release gates

Source-level CI covers policy routes, RPC contract, authorization, idempotency, audit and policy invariants. However:
- SQL migrations have NOT been executed against a disposable PostgreSQL/Supabase instance in this validation pass.
- The hosted Supabase database has NOT been modified.
- The initial Super Admin has NOT been provisioned by this source integration.
- Real authenticated browser-to-PostgREST policy editing has NOT been end-to-end tested.
- Financial writes and seconds settlement remain fail-closed until separate database and business QA plus explicit release approval.

Before release, apply the complete canonical SQL chain only to an isolated empty database, verify every migration and function signature, test owner bootstrap and Super Admin/delegated permissions, and run concurrent policy updates and order/settlement replay tests. Do not apply source migrations to production as part of code validation.