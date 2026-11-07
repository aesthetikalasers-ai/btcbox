# BTCBOX production data-preserving migration plan — 2026-11-07

Status: planning and read-only inventory only. This document is not an execution authorization and contains no production write instructions to run blindly. No migration, export, backup, DDL, DML, grant, revoke, or financial cutover was performed while preparing it.

## 1. Live data baseline (read-only)

Connected Supabase project was inspected using count-only/catalog-only SELECT statements. No row payloads, user IDs, balances, addresses, password hashes, session tokens, or secret values were returned.

### Existing canonical tables

| Table | Current rows |
|---|---:|
| `btcbox_state` | 1 |
| `earn_product_catalog` | 7 |
| `financial_accounts` | 0 |
| `financial_operations` | 0 |
| `financial_ledger` | 0 |
| `financial_audit_log` | 0 |
| `deposit_records` | 0 |
| `withdrawal_requests` | 0 |
| `earn_positions` | 0 |
| `financial_matching_markets` | 0 |
| `financial_matching_orders` | 0 |
| `financial_matching_trades` | 0 |
| `seconds_contract_positions` | 0 |

### Existing state document

The single `btcbox_state` row is at revision **29**, last updated **2026-11-03 13:29:46 UTC**. Its top-level structure contains:
- 3 internal user records;
- 8 configured deposit-address entries;
- 3 session records and 0 temporary login tokens;
- 0 embedded audit log entries;
- an announcement value and a UID counter.

The three user records contain six asset balance slots each (18 total); every `free` and `frozen` value is numeric and all 18 slots are zero. Embedded per-user `deposits`, `withdrawals`, `orders`, `earn_records`, `support_messages`, `addresses`, and `address_audit` arrays are all empty.

Identity setup counts:
- 2 of 3 users have a Supabase Auth UUID link;
- 0 users currently have a BTCBOX username;
- 0 users currently have a BTCBOX username-login password credential;
- 0 users have a linked wallet identity;
- no nonzero free/frozen balances were found.

This does **not** prove that users are disposable. The three account records, provider links, configured deposit addresses, announcement, UID counter, and the existing state revision must all be preserved. The unlinked third account must be manually reconciled against trusted identity evidence; never auto-merge accounts by matching email or user-supplied metadata.

The JSON state contains credential/security-related fields. Their values were not read. Any export or staging copy must be encrypted, access-restricted, and scrubbed of live session/token material before being shared with developers or used outside the protected production environment.

### Earn product catalog

The production `earn_product_catalog` contains 7 rows. Canonical migration `0006_financial_earn_policy_v5.sql` seeds the same product IDs with `ON CONFLICT (product_id) DO NOTHING`, so it does not overwrite existing catalog rows. Before applying the migration to a clone, compare the seven existing product definitions against the canonical seed; do not assume matching IDs mean matching policy values.

## 2. What the baseline means

- The normalized financial tables currently contain no rows, but the existing `btcbox_state` row is real application data and is the current store for the three user records and related state.
- Do not fabricate financial ledger/account rows from zero balances.
- Do not delete or replace `btcbox_state` as part of schema cutover. Migration `0001` creates the CAS table/function for a fresh schema; it is not a legacy state import tool.
- Existing user credential fields are not equivalent to the current `login_password_hash` contract. Current account credentials are established through the authenticated account-credentials flow. Do not copy legacy random/dummy hashes or salts into the new login credential fields.
- Since no existing account has a BTCBOX username/password credential, a successful Google or wallet sign-in followed by the account-credentials setup flow is required before username/password login can work for that account. The unlinked account needs identity recovery/reconciliation first.
- The absence of wallet links is a state observation, not permission to attach a wallet to an account without a verified ownership flow.

## 3. Required migration sequence

1. **Freeze and preserve evidence.** At a planned maintenance window, pause application writes using an approved operational procedure. Capture a Supabase-managed backup/PITR point and a separate encrypted logical export. Record project ref, timestamp, source branch/head, and checksums. Verify that a restore can be performed before changing schema.
2. **Clone safely.** Restore the backup into a dedicated staging project with restricted access. Remove or invalidate live sessions and temporary tokens in the staging copy only. Do not share raw production JSON, secrets, credential hashes, or personal records in PRs/issues.
3. **Capture reconciliation evidence.** On an isolated staging clone, install `backend/requirements-postgres-staging.txt` and run `python3 backend/scripts/audit_migration_mapping.py` with `STAGING_DATABASE_URL`. Preserve its source SHA-256 manifest, timestamp ledger, and schema-only catalog inventory with the change record. The tool is read-only, blocks the known production project reference, and deliberately reports `MANUAL_REVIEW_REQUIRED`; it does not infer a mapping or run migrations. Then continue with owner-reviewed source/blob SHA and catalog reconciliation.\n4. **Map migration history.** The live Supabase migration ledger currently contains timestamp versions `20261102133555` and `20261103062716`. They do not map to the repository's four-digit filenames. Do not update the ledger by hand or assume any numbered SQL has run. Establish an owner-reviewed mapping from migration source/blob SHAs to the actual schema and ledger state.
5. **Reconcile schema before applying anything.** Compare every canonical migration's preconditions and effects with the restored staging schema. The source inventory now contains 26 numbered migrations through `0033`. Several source files contain non-idempotent `CREATE FUNCTION` / constraint changes; do not rerun them simply because the ledger mapping is unknown.
6. **Apply only the reviewed pending upgrade set** on staging, in dependency order, with stop-on-first-error behavior. Preserve the `btcbox_state` row and revision, all three users, the 8 deposit-address entries, the 7 Earn products, and every existing auth/provider mapping. Do not seed a Super Admin automatically.
7. **Resolve administrator bootstrap separately.** Confirm the intended Supabase Auth UUID out of band. Only the project owner may run the owner-only Super Admin bootstrap after verifying the identity and confirming no Super Admin already exists.
8. **Verify preservation and behavior.** Compare pre/post table counts and a protected checksum of `btcbox_state.data`; verify the state revision and account/provider mapping; verify Earn catalog definitions; inspect RLS, grants, function identity arguments, SECURITY DEFINER search paths, private schema usage, and PostgREST cache. Run withdrawal replay/fee-quote tests, manual deposit review, admin RBAC permission boundaries, spot order idempotency, and Seconds policy/settlement concurrency tests on staging.
9. **Rollback plan.** Prefer restore of the verified pre-migration backup/PITR point. Do not rely on improvised reverse SQL or dropping/recreating financial tables. Keep the original backup immutable until post-cutover reconciliation is signed off.

## 4. Explicit release blockers

Production cutover remains blocked until all of the following are resolved:
- the timestamp migration ledger has a verified source mapping;
- all 26 migrations have been rehearsed against a protected copy of the current database, not just a fresh empty database;
- the 11 missing RPCs and the 9-vs-11-argument withdrawal signature mismatch are reconciled;
- the withdrawal status/fee/idempotency/payout fields and audit `event_id` are installed and verified;
- Seconds policy tables, position snapshots, and duration constraint are installed and verified;
- private schema `USAGE` is correctly granted to `service_role` without browser exposure;
- all existing state/user/address/catalog records are preserved and reconciled;
- a restorable backup and a tested rollback procedure are available;
- separate explicit owner approval is given for production migration and any financial cutover.

## 5. Current safety status

This plan was prepared from read-only queries only. Production data and schema were not changed. Financial flags were not changed. No production deployment was triggered.
