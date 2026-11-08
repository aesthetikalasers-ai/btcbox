-- BTCBOX hosted schema contract check (READ ONLY)
-- Purpose: compare critical PR #67 schema objects with the connected database.
-- Safe to run in Supabase SQL Editor as a read-only diagnostic.
-- This script performs SELECTs only. It does not create, alter, delete, or update anything.
-- A fresh-schema bootstrap must NOT be run merely because this report shows missing objects.

with expected_objects(object_type, schema_name, object_name) as (
  values
    ('table','private','admin_permission_catalog'),
    ('table','private','admin_memberships'),
    ('table','private','admin_permission_events'),
    ('table','private','admin_security_audit'),
    ('table','private','admin_request_idempotency'),
    ('table','private','seconds_policy_request_idempotency'),
    ('table','public','seconds_contract_policies'),
    ('table','public','seconds_contract_policy_active'),
    ('table','public','seconds_contract_policy_audit'),
    ('table','public','financial_matching_cancel_requests'),
    ('function','private','bootstrap_super_admin_v1'),
    ('function','public','admin_get_membership_v1'),
    ('function','public','admin_list_memberships_v1'),
    ('function','public','admin_manage_membership_v1'),
    ('function','public','admin_set_seconds_policy_v1'),
    ('function','public','admin_list_seconds_open_positions_v1'),
    ('function','public','submit_limit_order_matching_v1'),
    ('function','public','cancel_limit_order_matching_v1'),
    ('function','public','submit_seconds_order_v1')
),
object_status as (
  select
    e.object_type,
    e.schema_name,
    e.object_name,
    case
      when e.object_type = 'table' then
        to_regclass(format('%I.%I', e.schema_name, e.object_name)) is not null
      when e.object_type = 'function' then
        exists (
          select 1
          from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = e.schema_name
            and p.proname = e.object_name
            and p.prokind = 'f'
        )
    end as exists_in_database
  from expected_objects e
)
select
  object_type,
  schema_name,
  object_name,
  exists_in_database,
  case when exists_in_database then 'PRESENT' else 'MISSING' end as status
from object_status
order by object_type, schema_name, object_name;

-- Compact state summary: counts and revision only; never returns user/session records.
select
  (select count(*) from auth.users) as supabase_auth_user_count,
  (select count(*) from public.btcbox_state) as btcbox_state_row_count,
  (select max(revision) from public.btcbox_state) as btcbox_state_revision,
  (select count(*) from public.earn_product_catalog where active) as active_earn_product_count,
  (select count(*) from public.financial_matching_markets where enabled) as enabled_spot_market_count,
  (select count(*) from private.btcbox_auth_test_users_backup) as auth_test_backup_row_count,
  (select count(*) from private.btcbox_state_pre_test_cleanup_backup) as state_backup_row_count;

-- RLS and browser-role grants for the two private test-backup tables.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls,
  has_schema_privilege('anon', n.nspname, 'USAGE') as anon_schema_usage,
  has_schema_privilege('authenticated', n.nspname, 'USAGE') as authenticated_schema_usage,
  has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
  has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_select
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'private'
  and c.relname in (
    'btcbox_auth_test_users_backup',
    'btcbox_state_pre_test_cleanup_backup'
  )
  and c.relkind in ('r','p')
order by c.relname;
