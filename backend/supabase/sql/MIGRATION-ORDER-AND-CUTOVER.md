# Financial SQL migration order and cutover gates

> **编号约定（phase2）**: 本目录下迁移已统一重命名为 `0001_xxx.sql` … `0022_xxx.sql`，按编号升序应用即可。`0001_btcbox_state_cas.sql` 为基础，`0002–0014` 为有序业务 RPC；旧 `0015` 单用户单未完成订单限制已废弃，`0016` 为可选自动化链上验证，`0017–0020` 为 staging/对账，`0021` 为管理员审计日志 append-only 表，`0022` 为提现人工审核状态扩展。用 `scripts/check_migration_status.py` 校验编号连续性与已应用状态。


Apply these migrations to a dedicated staging project in dependency order. These files are migrations, not read-only reports; audit scripts and staging drill outputs are not migrations. Complete the checks before production cutover.

1. `financial_ledger_v1.sql`
2. `financial_lifecycle_v2.sql`
3. `financial_admin_adjustment_v1.sql`
4. `financial_earn_redemption_idempotency_v4.sql`
5. `financial_earn_policy_v5.sql`
6. `financial_admin_manual_deposit_v1.sql`
7. `financial_spot_trade_v3.sql`
8. `financial_matching_engine_v1.sql`
9. `financial_read_api_v1.sql` (base normalized account snapshot RPC)
10. `financial_read_api_earn_v1.sql` (extends the account snapshot with earn positions)
11. `financial_admin_read_api_v1.sql`
12. `financial_admin_account_read_api_v1.sql`
13. `financial_seconds_contracts_v1.sql` — creates the Seconds lifecycle RPCs and extends the financial operation type constraint.

The lifecycle `confirm_deposit_atomic` RPC is intentionally fail-closed and cannot credit a deposit without trusted verification. The intended deposit-credit path for the current manual-review business model is the separately audited `admin_manual_deposit_atomic` RPC; manual credits must use the separately audited `admin_manual_deposit_atomic` RPC. The `financial_deposit_chain_verification_v3.sql` is optional when the deployment does not enable automated chain verification, but it is required before enabling that automated verification path.

The `financial_migration_staging_v5.sql` quarantine table and the `financial_migration_staging_reconciliation_v6.sql`, `financial_migration_reconciliation_v4.sql`, and `financial_ledger_reconciliation_v1.sql` files are staging/import or read-only reconciliation steps, not part of the ordered operational RPC sequence above. Run them only in the documented staging workflow.

Before cutover:

- Confirm exact function signatures using the static audit and PostgreSQL staging drill.
- Confirm service-role-only execution for all money-moving RPCs and deny direct browser-role table access.
- Import/restore historical state into staging, reconcile balances and histories, and verify rollback.
- Test idempotent retries and concurrent requests for deposits, withdrawals, earn, spot trade, and seconds contracts.
- Keep financial writes disabled until all relevant reads and writes use the same authoritative ledger and the full-cutover approval is explicit.

## Withdrawal review and audit contract corrections

The ordered migrations retain a single canonical `public.financial_audit_log` schema from
`0002_financial_ledger_v1.sql`. Migration `0021` must map the legacy administrator
audit RPC arguments onto `actor_id`, `subject_user_id`, `action`, `object_type`,
`object_id`, `reason`, and `metadata`; it must not create a competing set of
`uid/by/detail/meta` columns.

Migration `0022` extends `public.withdrawal_requests` (not a separate
`public.withdrawals` table), adds the persisted `require_admin_review` and
`request_hash` fields, and changes the canonical RPC to the single 10-argument
signature used by the API. The function must retain `apply_financial_operation`
inside the same transaction as the withdrawal row insert. Both `pending` and
`pending_admin_review` are eligible for the existing atomic review RPC and the
administrator read snapshot.

Do not apply these migrations to production as part of source-code validation.
Run the complete ordered migration chain on an isolated staging database, then test
same-key/same-payload retries, same-key/payload-mismatch rejection, concurrent
withdrawal creation, approval, rejection/refund, and the administrator review queue.

## Later prepared migrations (0023–0027)

The numbered SQL files added after the original 0001–0022 sequence are separate prepared migrations; their presence in Git does not mean they are installed in any database.

15. `0023_btcbox_shared_rate_limit_v1.sql` — creates the server-side shared fixed-window limiter. Apply before enabling API routes that call `btcbox_rate_limit_consume_v1`; it denies browser-role table access and grants the RPC to the server role only.
16. `0024_seconds_settlement_idempotency_v1.sql` — replaces the Seconds settlement RPC with request-hash idempotency. Requires only the Seconds tables/RPCs from `0014_financial_seconds_contracts_v1.sql`; multiple simultaneous open positions per user are supported and no per-user open-position unique index is permitted.
17. `0025_seconds_policy_versioning_v1.sql` — adds immutable versioned policy, active pointer, append-only policy audit, and per-position payout/policy snapshots. Apply only after the Seconds base and settlement-idempotency migrations have been validated. It does not implement administrator policy authoring/approval/activation APIs and does not enable financial cutover.
18. `0026_admin_rbac_private_store_v1.sql` — creates the private administrator membership, permission-event, security-audit and request-idempotency store. It seeds permission definitions only; it does not create an administrator. Super Admin provisioning is a separate owner-controlled operation, and the API must verify Supabase Auth and load membership before these permissions are effective.
19. `0027_withdrawal_manual_payout_completion_v1.sql` — adds staff-paid completion after an approved withdrawal. A non-empty TxID/reference is mandatory; the RPC is idempotent for the same reference, rejects a conflicting reference, changes status and appends audit only, and does not broadcast or debit funds again. It preserves the pending/review/approved states from `0022`.
20. `0028_admin_rbac_service_rpc_wrappers_v1.sql` — exposes only service-role RPC wrappers for reading an administrator membership and managing delegated membership. The private schema remains unexposed; `anon` and `authenticated` receive no execute rights. The HTTP layer must still verify the Supabase Auth token and check the returned permission set before every admin route.

Do not interpret the filename sequence as permission to apply every file blindly. The existing staging/import and reconciliation migrations remain conditional workflow steps, and optional chain verification remains conditional on enabling that product path. Follow each migration's header and the staging drill.

### Migration registry mapping warning

The live Supabase migration registry may use timestamp versions rather than these four-digit source filenames. The migration checker intentionally refuses to compare timestamp registry versions directly with four-digit filenames. Do not infer that `0001`–`0025` have or have not been applied from a simple lexical comparison; verify the actual schema, function signatures, and a reviewed explicit mapping in an isolated environment.
