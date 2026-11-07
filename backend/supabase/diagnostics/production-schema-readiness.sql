-- BTCBOX production/staging schema readiness diagnostic (READ ONLY).
-- Run in Supabase SQL Editor using a read-only/operator session.
-- SELECT statements only: no schema, privilege, or application-data mutations.
--
-- PRESENT proves catalog presence only, not business correctness.
-- MISSING or unsafe privilege results block dependent feature/cutover activation.
-- Never run the empty-database bootstrap against a database with existing BTCBOX data.

WITH required_functions(name, expected_arity) AS (
  VALUES
    ('admin_adjustment_atomic',8),
    ('admin_get_membership_v1',1),
    ('admin_list_memberships_v1',1),
    ('admin_manage_membership_v1',8),
    ('admin_manual_deposit_atomic',9),
    ('admin_read_seconds_open_positions_v1',1),
    ('admin_set_seconds_policy_v1',12),
    ('admin_set_spot_market_v1',13),
    ('append_admin_audit_log',6),
    ('btcbox_rate_limit_consume_v1',2),
    ('btcbox_save_state',2),
    ('cancel_limit_order_matching_v1',3),
    ('create_withdrawal_atomic',11),
    ('mark_withdrawal_paid_atomic',4),
    ('read_active_seconds_policy_v1',0),
    ('read_admin_account_balances_v1',1),
    ('read_admin_withdrawal_snapshot_v1',0),
    ('read_financial_account_snapshot_v1',1),
    ('read_seconds_positions_v1',1),
    ('read_spot_market_snapshot_v1',0),
    ('redeem_earn_atomic',4),
    ('review_withdrawal_atomic',4),
    ('settle_seconds_position_v1',8),
    ('submit_limit_order_matching_v1',8),
    ('submit_seconds_order_v1',9),
    ('subscribe_earn_atomic',7)
),
function_inventory AS (
  SELECT r.name, r.expected_arity,
         count(p.oid) AS overload_count,
         count(p.oid) FILTER (WHERE p.pronargs = r.expected_arity) AS matching_arity_count,
         string_agg(
           format('%I.%I(%s) [arity=%s]', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid), p.pronargs),
           '; ' ORDER BY n.nspname, pg_get_function_identity_arguments(p.oid)
         ) FILTER (WHERE p.oid IS NOT NULL) AS signatures,
         coalesce(bool_or(p.pronargs = r.expected_arity
           AND has_function_privilege('service_role', p.oid, 'EXECUTE')), false) AS service_role_execute,
         coalesce(bool_or(p.pronargs = r.expected_arity
           AND has_function_privilege('anon', p.oid, 'EXECUTE')), false) AS anon_execute,
         coalesce(bool_or(p.pronargs = r.expected_arity
           AND has_function_privilege('authenticated', p.oid, 'EXECUTE')), false) AS authenticated_execute
  FROM required_functions r
  LEFT JOIN pg_proc p ON p.proname = r.name
    AND p.pronamespace IN (SELECT oid FROM pg_namespace WHERE nspname IN ('public','private'))
  LEFT JOIN pg_namespace n ON n.oid = p.pronamespace
  GROUP BY r.name, r.expected_arity
),
required_tables(schema_name, table_name) AS (
  VALUES
    ('public','btcbox_state'),
    ('public','financial_accounts'),
    ('public','financial_ledger'),
    ('public','financial_operations'),
    ('public','financial_audit_log'),
    ('public','deposit_records'),
    ('public','withdrawal_requests'),
    ('public','earn_product_catalog'),
    ('public','earn_positions'),
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
    ('private','admin_request_idempotency'),
    ('private','seconds_policy_request_idempotency'),
    ('private','spot_market_request_idempotency')
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
),
required_columns(schema_name, table_name, column_name, expected_type) AS (
  VALUES
    ('public','withdrawal_requests','require_admin_review','boolean'),
    ('public','withdrawal_requests','request_hash','text'),
    ('public','withdrawal_requests','payout_reference','text'),
    ('public','withdrawal_requests','payout_note','text'),
    ('public','withdrawal_requests','paid_by','text'),
    ('public','withdrawal_requests','paid_at','timestamp with time zone'),
    ('public','financial_audit_log','event_id','text'),
    ('public','seconds_contract_positions','policy_id','uuid'),
    ('public','seconds_contract_positions','policy_version','bigint'),
    ('public','seconds_contract_positions','payout_bps_snapshot','integer'),
    ('public','seconds_contract_positions','policy_snapshot','jsonb')
),
column_inventory AS (
  SELECT r.*, c.data_type
  FROM required_columns r
  LEFT JOIN information_schema.columns c
    ON c.table_schema=r.schema_name AND c.table_name=r.table_name AND c.column_name=r.column_name
),
required_indexes(index_name, table_name) AS (
  VALUES
    ('financial_audit_action_id_desc_idx','financial_audit_log'),
    ('financial_audit_subject_id_desc_idx','financial_audit_log')
),
index_inventory AS (
  SELECT r.index_name, r.table_name, i.indexname
  FROM required_indexes r
  LEFT JOIN pg_indexes i ON i.schemaname='public' AND i.tablename=r.table_name AND i.indexname=r.index_name
)
SELECT 'RPC'::text AS category,
       name AS object_name,
       CASE WHEN overload_count = 0 THEN 'MISSING'
            WHEN matching_arity_count = 0 THEN 'SIGNATURE_MISMATCH'
            WHEN overload_count <> 1 THEN 'LEGACY_OVERLOAD_PRESENT'
            WHEN NOT service_role_execute THEN 'PRESENT_BUT_SERVICE_ROLE_CANNOT_EXECUTE'
            WHEN anon_execute OR authenticated_execute THEN 'PRESENT_BUT_PUBLICLY_EXECUTABLE'
            ELSE 'PRESENT_SERVICE_ROLE_ONLY' END AS status,
       format('Expected arity=%s; installed: %s', expected_arity,
         coalesce(signatures, 'No public/private signature found')) AS detail
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

SELECT 'COLUMN'::text AS category,
       format('%I.%I.%I', schema_name, table_name, column_name) AS object_name,
       CASE WHEN data_type IS NULL THEN 'MISSING'
            WHEN data_type <> expected_type THEN 'TYPE_MISMATCH'
            ELSE 'PRESENT' END AS status,
       format('Expected type=%s; installed type=%s', expected_type, coalesce(data_type,'<missing>')) AS detail
FROM column_inventory

UNION ALL

SELECT 'INDEX'::text AS category,
       index_name AS object_name,
       CASE WHEN indexname IS NULL THEN 'MISSING' ELSE 'PRESENT' END AS status,
       format('Expected on public.%I', table_name) AS detail
FROM index_inventory

UNION ALL

SELECT 'CONSTRAINT'::text AS category,
       'public.seconds_contract_positions.duration_sec' AS object_name,
       CASE WHEN EXISTS (
              SELECT 1 FROM pg_constraint
              WHERE conrelid='public.seconds_contract_positions'::regclass
                AND conname='seconds_contract_positions_duration_sec_positive'
            ) THEN 'PRESENT'
            WHEN EXISTS (
              SELECT 1 FROM pg_constraint
              WHERE conrelid='public.seconds_contract_positions'::regclass
                AND conname='seconds_contract_positions_duration_sec_check'
            ) THEN 'LEGACY_FIXED_ALLOWLIST'
            ELSE 'MISSING' END AS status,
       coalesce((
         SELECT pg_get_constraintdef(oid)
         FROM pg_constraint
         WHERE conrelid='public.seconds_contract_positions'::regclass
           AND conname IN ('seconds_contract_positions_duration_sec_check',
                           'seconds_contract_positions_duration_sec_positive')
         ORDER BY conname LIMIT 1
       ), 'No expected duration constraint found') AS detail

UNION ALL

SELECT 'CONSTRAINT'::text AS category,
       'public.withdrawal_requests.withdrawal_requests_status_check' AS object_name,
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_constraint
         WHERE conrelid='public.withdrawal_requests'::regclass
           AND conname='withdrawal_requests_status_check'
           AND pg_get_constraintdef(oid) LIKE '%pending_admin_review%'
           AND pg_get_constraintdef(oid) LIKE '%completed%'
       ) THEN 'PRESENT'
       WHEN EXISTS (
         SELECT 1 FROM pg_constraint
         WHERE conrelid='public.withdrawal_requests'::regclass
           AND conname='withdrawal_requests_status_check'
       ) THEN 'LEGACY_STATUS_SET'
       ELSE 'MISSING' END AS status,
       coalesce((
         SELECT pg_get_constraintdef(oid)
         FROM pg_constraint
         WHERE conrelid='public.withdrawal_requests'::regclass
           AND conname='withdrawal_requests_status_check'
       ),'No withdrawal status constraint found') AS detail

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
