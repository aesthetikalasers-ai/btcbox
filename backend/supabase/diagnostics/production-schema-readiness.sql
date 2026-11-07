-- BTCBOX production/staging schema readiness diagnostic (READ ONLY).
-- Run in Supabase SQL Editor using a read-only/operator session.
-- SELECT statements only: no schema, privilege, or application-data mutations.
--
-- PRESENT proves catalog presence only, not business correctness.
-- MISSING or unsafe privilege results block dependent feature/cutover activation.
-- Never run the empty-database bootstrap against a database with existing BTCBOX data.

WITH required_functions(name) AS (
  VALUES
    ('admin_adjustment_atomic'),
    ('admin_get_membership_v1'),
    ('admin_list_memberships_v1'),
    ('admin_manage_membership_v1'),
    ('admin_manual_deposit_atomic'),
    ('admin_read_seconds_open_positions_v1'),
    ('admin_set_seconds_policy_v1'),
    ('admin_set_spot_market_v1'),
    ('append_admin_audit_log'),
    ('btcbox_rate_limit_consume_v1'),
    ('btcbox_save_state'),
    ('cancel_limit_order_matching_v1'),
    ('create_withdrawal_atomic'),
    ('mark_withdrawal_paid_atomic'),
    ('read_active_seconds_policy_v1'),
    ('read_admin_account_balances_v1'),
    ('read_admin_withdrawal_snapshot_v1'),
    ('read_financial_account_snapshot_v1'),
    ('read_seconds_positions_v1'),
    ('read_spot_market_snapshot_v1'),
    ('redeem_earn_atomic'),
    ('review_withdrawal_atomic'),
    ('settle_seconds_position_v1'),
    ('submit_limit_order_matching_v1'),
    ('submit_seconds_order_v1'),
    ('subscribe_earn_atomic')
),
function_inventory AS (
  SELECT r.name,
         count(p.oid) AS overload_count,
         string_agg(
           format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)),
           '; ' ORDER BY n.nspname, pg_get_function_identity_arguments(p.oid)
         ) FILTER (WHERE p.oid IS NOT NULL) AS signatures,
         coalesce(bool_or(has_function_privilege('service_role', p.oid, 'EXECUTE')), false) AS service_role_execute,
         coalesce(bool_or(has_function_privilege('anon', p.oid, 'EXECUTE')), false) AS anon_execute,
         coalesce(bool_or(has_function_privilege('authenticated', p.oid, 'EXECUTE')), false) AS authenticated_execute
  FROM required_functions r
  LEFT JOIN pg_proc p ON p.proname = r.name
    AND p.pronamespace IN (SELECT oid FROM pg_namespace WHERE nspname IN ('public','private'))
  LEFT JOIN pg_namespace n ON n.oid = p.pronamespace
  GROUP BY r.name
),
required_tables(schema_name, table_name) AS (
  VALUES
    ('public','btcbox_state'),
    ('public','financial_accounts'),
    ('public','financial_ledger'),
    ('public','financial_audit_log'),
    ('public','deposit_records'),
    ('public','withdrawal_requests'),
    ('public','financial_matching_markets'),
    ('public','financial_matching_orders'),
    ('public','financial_matching_trades'),
    ('public','seconds_contract_positions'),
    ('public','seconds_contract_policies'),
    ('public','seconds_contract_policy_active'),
    ('public','seconds_contract_policy_audit'),
    ('public','btcbox_rate_limits'),
    ('private','admin_permission_catalog'),
    ('private','admin_memberships'),
    ('private','admin_permission_events'),
    ('private','admin_security_audit'),
    ('private','admin_request_idempotency')
),
table_inventory AS (
  SELECT r.schema_name, r.table_name, c.oid, c.relrowsecurity,
         CASE WHEN c.oid IS NOT NULL THEN has_table_privilege('anon', c.oid, 'SELECT') END AS anon_select,
         CASE WHEN c.oid IS NOT NULL THEN has_table_privilege('authenticated', c.oid, 'SELECT') END AS authenticated_select,
         CASE WHEN c.oid IS NOT NULL THEN has_table_privilege('service_role', c.oid, 'SELECT') END AS service_role_select
  FROM required_tables r
  LEFT JOIN pg_namespace n ON n.nspname = r.schema_name
  LEFT JOIN pg_class c ON c.relnamespace = n.oid
    AND c.relname = r.table_name AND c.relkind IN ('r','p')
)
SELECT 'RPC'::text AS category,
       name AS object_name,
       CASE WHEN overload_count = 0 THEN 'MISSING'
            WHEN NOT service_role_execute THEN 'PRESENT_BUT_SERVICE_ROLE_CANNOT_EXECUTE'
            WHEN anon_execute OR authenticated_execute THEN 'PRESENT_BUT_PUBLICLY_EXECUTABLE'
            ELSE 'PRESENT_SERVICE_ROLE_ONLY' END AS status,
       coalesce(signatures, 'No public/private signature found') AS detail
FROM function_inventory

UNION ALL

SELECT 'TABLE'::text AS category,
       format('%I.%I', schema_name, table_name) AS object_name,
       CASE WHEN oid IS NULL THEN 'MISSING'
            WHEN NOT relrowsecurity THEN 'PRESENT_RLS_DISABLED'
            WHEN schema_name = 'private' AND (anon_select OR authenticated_select)
              THEN 'PRESENT_PRIVATE_BUT_BROWSER_SELECT_GRANTED'
            ELSE 'PRESENT_RLS_ENABLED' END AS status,
       CASE WHEN oid IS NULL THEN 'Required table is absent'
            ELSE format('RLS=%s; anon SELECT=%s; authenticated SELECT=%s; service_role SELECT=%s',
                        relrowsecurity, anon_select, authenticated_select, service_role_select)
       END AS detail
FROM table_inventory

UNION ALL

SELECT 'SCHEMA'::text AS category,
       n.nspname AS object_name,
       CASE WHEN n.nspname = 'private'
              AND (has_schema_privilege('anon', n.oid, 'USAGE')
                OR has_schema_privilege('authenticated', n.oid, 'USAGE'))
            THEN 'PRESENT_BUT_BROWSER_USAGE_GRANTED'
            WHEN n.nspname = 'private'
              AND NOT has_schema_privilege('service_role', n.oid, 'USAGE')
            THEN 'PRESENT_BUT_SERVICE_ROLE_USAGE_MISSING'
            ELSE 'PRESENT' END AS status,
       format('anon USAGE=%s; authenticated USAGE=%s; service_role USAGE=%s',
              has_schema_privilege('anon', n.oid, 'USAGE'),
              has_schema_privilege('authenticated', n.oid, 'USAGE'),
              has_schema_privilege('service_role', n.oid, 'USAGE')) AS detail
FROM pg_namespace n
WHERE n.nspname IN ('public','private')

ORDER BY category, object_name;
