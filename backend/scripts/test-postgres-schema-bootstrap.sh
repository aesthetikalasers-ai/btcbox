#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must point to the disposable CI PostgreSQL service}"

# Supabase-managed roles and auth schema are supplied by the isolated CI harness.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE 'CREATE ROLE anon NOLOGIN'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE 'CREATE ROLE authenticated NOLOGIN'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN EXECUTE 'CREATE ROLE service_role NOLOGIN BYPASSRLS'; END IF;
END
$roles$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY);
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
SQL

# This is an isolated, disposable local PostgreSQL instance in CI. The production
# bootstrap guard remains unchanged and remote hosts still require owner approval.
BTCBOX_BOOTSTRAP_CONFIRM=YES bash backend/scripts/bootstrap-empty-database.sh

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $verify$
DECLARE
  v_accounts regclass := to_regclass('public.financial_accounts');
  v_withdrawals regclass := to_regclass('public.withdrawal_requests');
  v_spot_orders regclass := to_regclass('public.financial_matching_orders');
  v_spot_trades regclass := to_regclass('public.financial_matching_trades');
  v_cancel_requests regclass := to_regclass('public.financial_matching_cancel_requests');
  v_admin_members regclass := to_regclass('private.admin_memberships');
  v_market_requests regclass := to_regclass('private.spot_market_request_idempotency');
  v_proc regprocedure;
  v_signature text;
  v_table text;
  v_table_oid regclass;
BEGIN
  IF v_accounts IS NULL OR v_withdrawals IS NULL OR v_spot_orders IS NULL
     OR v_spot_trades IS NULL OR v_cancel_requests IS NULL OR v_admin_members IS NULL THEN
    RAISE EXCEPTION 'required BTCBOX financial tables were not installed';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=v_accounts) THEN
    RAISE EXCEPTION 'financial_accounts must have RLS enabled';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=v_withdrawals) THEN
    RAISE EXCEPTION 'withdrawal_requests must have RLS enabled';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=v_spot_orders) THEN
    RAISE EXCEPTION 'financial_matching_orders must have RLS enabled';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=v_spot_trades) THEN
    RAISE EXCEPTION 'financial_matching_trades must have RLS enabled';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=v_cancel_requests) THEN
    RAISE EXCEPTION 'financial_matching_cancel_requests must have RLS enabled';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=v_admin_members) THEN
    RAISE EXCEPTION 'private.admin_memberships must have RLS enabled';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.seconds_contract_positions'::regclass
      AND conname='seconds_contract_positions_duration_sec_positive'
      AND pg_get_constraintdef(oid) ILIKE '%duration_sec > 0%'
  ) THEN
    RAISE EXCEPTION 'Seconds position duration must be governed by positive active-policy values';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=v_market_requests) THEN
    RAISE EXCEPTION 'private.spot_market_request_idempotency must have RLS enabled';
  END IF;

  -- Verify every Perpetual table is present, RLS-enabled, and unavailable to browser roles.
  FOREACH v_table IN ARRAY ARRAY[
    'perpetual_markets','perpetual_orders','perpetual_positions','perpetual_trades',
    'perpetual_cancel_requests','perpetual_funding_rates','perpetual_funding_history',
    'perpetual_mark_price_feed','perpetual_liquidation_events','perpetual_position_history'
  ] LOOP
    v_table_oid := to_regclass('public.' || quote_ident(v_table));
    IF v_table_oid IS NULL THEN
      RAISE EXCEPTION 'required Perpetual table is missing: %',v_table;
    END IF;
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=v_table_oid) THEN
      RAISE EXCEPTION 'Perpetual table must have RLS enabled: %',v_table;
    END IF;
    IF has_table_privilege('anon',v_table_oid,'SELECT')
       OR has_table_privilege('anon',v_table_oid,'INSERT')
       OR has_table_privilege('anon',v_table_oid,'UPDATE')
       OR has_table_privilege('anon',v_table_oid,'DELETE')
       OR has_table_privilege('authenticated',v_table_oid,'SELECT')
       OR has_table_privilege('authenticated',v_table_oid,'INSERT')
       OR has_table_privilege('authenticated',v_table_oid,'UPDATE')
       OR has_table_privilege('authenticated',v_table_oid,'DELETE') THEN
      RAISE EXCEPTION 'Perpetual table is directly accessible to anon/authenticated: %',v_table;
    END IF;
    IF NOT has_table_privilege('service_role',v_table_oid,'SELECT')
       OR NOT has_table_privilege('service_role',v_table_oid,'INSERT')
       OR NOT has_table_privilege('service_role',v_table_oid,'UPDATE') THEN
      RAISE EXCEPTION 'Perpetual service_role table grants are incomplete: %',v_table;
    END IF;
    IF v_table='perpetual_positions' THEN
      IF NOT has_table_privilege('service_role',v_table_oid,'DELETE') THEN
        RAISE EXCEPTION 'service_role requires DELETE only on perpetual_positions';
      END IF;
    ELSIF has_table_privilege('service_role',v_table_oid,'DELETE') THEN
      RAISE EXCEPTION 'service_role has unexpected DELETE on Perpetual table: %',v_table;
    END IF;
  END LOOP;

  -- Exact signatures, invoker security, pinned search_path, and service-role-only EXECUTE.
  FOREACH v_signature IN ARRAY ARRAY[
    'public.perp_submit_order(text,text,text,text,text,numeric,numeric,integer,boolean,boolean,text)',
    'public.perp_cancel_order(text,text,text)',
    'public.perp_record_mark_price(text,numeric,numeric,jsonb,integer)',
    'public.perp_settle_funding_one(text,timestamptz,numeric,text)',
    'public.perp_liquidate_position(text,text)',
    'public.perp_latest_mark_price(text,integer)',
    'public.perp_apply_fill_to_position(text,text,text,numeric,numeric,integer,numeric)'
  ] LOOP
    v_proc := to_regprocedure(v_signature);
    IF v_proc IS NULL
       OR NOT has_function_privilege('service_role',v_proc,'EXECUTE')
       OR has_function_privilege('anon',v_proc,'EXECUTE')
       OR has_function_privilege('authenticated',v_proc,'EXECUTE') THEN
      RAISE EXCEPTION 'Perpetual RPC must be service-role-only with exact signature: %',v_signature;
    END IF;
    IF (SELECT prosecdef FROM pg_proc WHERE oid=v_proc) THEN
      RAISE EXCEPTION 'Perpetual RPC must be SECURITY INVOKER: %',v_signature;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p, unnest(coalesce(p.proconfig,ARRAY[]::text[])) AS cfg(setting)
      WHERE p.oid=v_proc AND cfg.setting='search_path=""'
    ) THEN
      RAISE EXCEPTION 'Perpetual RPC must pin an empty search_path: %',v_signature;
    END IF;
  END LOOP;

  v_proc := to_regprocedure('public.admin_manual_deposit_atomic(text,text,text,text,numeric,text,text,text,text)');
  IF v_proc IS NULL OR NOT has_function_privilege('service_role',v_proc,'EXECUTE')
     OR has_function_privilege('anon',v_proc,'EXECUTE')
     OR has_function_privilege('authenticated',v_proc,'EXECUTE') THEN
    RAISE EXCEPTION 'manual deposit RPC grants are not service-role-only';
  END IF;

  v_proc := to_regprocedure('public.create_withdrawal_atomic(text,text,text,text,numeric,numeric,text,text,text,boolean,numeric)');
  IF v_proc IS NULL OR NOT has_function_privilege('service_role',v_proc,'EXECUTE')
     OR has_function_privilege('anon',v_proc,'EXECUTE')
     OR has_function_privilege('authenticated',v_proc,'EXECUTE') THEN
    RAISE EXCEPTION 'withdrawal create RPC grants are not service-role-only';
  END IF;

  v_proc := to_regprocedure('public.review_withdrawal_atomic(text,text,boolean,text)');
  IF v_proc IS NULL OR NOT has_function_privilege('service_role',v_proc,'EXECUTE')
     OR has_function_privilege('anon',v_proc,'EXECUTE')
     OR has_function_privilege('authenticated',v_proc,'EXECUTE') THEN
    RAISE EXCEPTION 'withdrawal review RPC grants are not service-role-only';
  END IF;

  v_proc := to_regprocedure('public.mark_withdrawal_paid_atomic(text,text,text,text)');
  IF v_proc IS NULL OR NOT has_function_privilege('service_role',v_proc,'EXECUTE')
     OR has_function_privilege('anon',v_proc,'EXECUTE')
     OR has_function_privilege('authenticated',v_proc,'EXECUTE') THEN
    RAISE EXCEPTION 'withdrawal paid RPC grants are not service-role-only';
  END IF;

  v_proc := to_regprocedure('public.submit_limit_order_matching_v1(text,text,text,text,text,numeric,numeric,text)');
  IF v_proc IS NULL OR NOT has_function_privilege('service_role',v_proc,'EXECUTE')
     OR has_function_privilege('anon',v_proc,'EXECUTE')
     OR has_function_privilege('authenticated',v_proc,'EXECUTE') THEN
    RAISE EXCEPTION 'spot submit RPC grants are not service-role-only';
  END IF;

  v_proc := to_regprocedure('public.cancel_limit_order_matching_v1(text,text,text)');
  IF v_proc IS NULL OR NOT has_function_privilege('service_role',v_proc,'EXECUTE')
     OR has_function_privilege('anon',v_proc,'EXECUTE')
     OR has_function_privilege('authenticated',v_proc,'EXECUTE') THEN
    RAISE EXCEPTION 'spot cancel RPC grants are not service-role-only';
  END IF;

  v_proc := to_regprocedure('public.admin_set_spot_market_v1(uuid,text,text,boolean,numeric,numeric,numeric,numeric,numeric,numeric,text,text,text)');
  IF v_proc IS NULL OR NOT has_function_privilege('service_role',v_proc,'EXECUTE')
     OR has_function_privilege('anon',v_proc,'EXECUTE')
     OR has_function_privilege('authenticated',v_proc,'EXECUTE') THEN
    RAISE EXCEPTION 'spot market admin RPC grants are not service-role-only';
  END IF;

  v_proc := to_regprocedure('public.read_spot_market_snapshot_v1()');
  IF v_proc IS NULL OR NOT has_function_privilege('service_role',v_proc,'EXECUTE')
     OR has_function_privilege('anon',v_proc,'EXECUTE')
     OR has_function_privilege('authenticated',v_proc,'EXECUTE') THEN
    RAISE EXCEPTION 'spot market read RPC grants are not service-role-only';
  END IF;

  v_proc := to_regprocedure('public.settle_seconds_position_v1(text,text,text,text,text,numeric,text,timestamptz)');
  IF v_proc IS NULL OR NOT has_function_privilege('service_role',v_proc,'EXECUTE')
     OR has_function_privilege('anon',v_proc,'EXECUTE')
     OR has_function_privilege('authenticated',v_proc,'EXECUTE') THEN
    RAISE EXCEPTION 'Seconds settlement RPC grants are not service-role-only';
  END IF;

  -- Verify the final post-0028 RBAC bridge state, not the intermediate
  -- SECURITY DEFINER wrappers created by migration 0026.
  IF NOT has_schema_privilege('service_role','private','USAGE')
     OR has_schema_privilege('anon','private','USAGE')
     OR has_schema_privilege('authenticated','private','USAGE') THEN
    RAISE EXCEPTION 'private schema USAGE must be granted only to service_role';
  END IF;

  IF has_table_privilege('service_role','private.admin_memberships','SELECT')
     OR has_table_privilege('service_role','private.admin_memberships','INSERT')
     OR has_table_privilege('service_role','private.admin_memberships','UPDATE')
     OR has_table_privilege('service_role','private.admin_memberships','DELETE') THEN
    RAISE EXCEPTION 'service_role must not have direct private membership table access';
  END IF;

  FOREACH v_signature IN ARRAY ARRAY[
    'public.admin_get_membership_v1(uuid)',
    'public.admin_list_memberships_v1(uuid)',
    'public.admin_manage_membership_v1(uuid,uuid,bigint,text,text[],text,text,text)',
    'public.admin_set_seconds_policy_v1(uuid,bigint,text[],integer[],numeric,numeric,integer,numeric,integer,text,text,text)',
    'public.admin_set_spot_market_v1(uuid,text,text,boolean,numeric,numeric,numeric,numeric,numeric,numeric,text,text,text)',
    'public.read_spot_market_snapshot_v1()'
  ] LOOP
    v_proc := to_regprocedure(v_signature);
    IF v_proc IS NULL
       OR NOT has_function_privilege('service_role',v_proc,'EXECUTE')
       OR has_function_privilege('anon',v_proc,'EXECUTE')
       OR has_function_privilege('authenticated',v_proc,'EXECUTE') THEN
      RAISE EXCEPTION 'Admin PostgREST wrapper grants are not service-role-only: %',v_signature;
    END IF;
    IF (SELECT prosecdef FROM pg_proc WHERE oid=v_proc) THEN
      RAISE EXCEPTION 'public Admin PostgREST wrapper must be SECURITY INVOKER: %',v_signature;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p, unnest(coalesce(p.proconfig,ARRAY[]::text[])) AS cfg(setting)
      WHERE p.oid=v_proc AND cfg.setting='search_path=""'
    ) THEN
      RAISE EXCEPTION 'public Admin PostgREST wrapper must pin an empty search_path: %',v_signature;
    END IF;
  END LOOP;

  FOREACH v_signature IN ARRAY ARRAY[
    'private.admin_get_membership_v1(uuid)',
    'private.admin_list_memberships_v1(uuid)',
    'private.admin_manage_membership_v1(uuid,uuid,bigint,text,text[],text,text,text)',
    'private.admin_set_seconds_policy_v1(uuid,bigint,text[],integer[],numeric,numeric,integer,numeric,integer,text,text,text)',
    'private.admin_set_spot_market_v1(uuid,text,text,boolean,numeric,numeric,numeric,numeric,numeric,numeric,text,text,text)'
  ] LOOP
    v_proc := to_regprocedure(v_signature);
    IF v_proc IS NULL
       OR NOT has_function_privilege('service_role',v_proc,'EXECUTE')
       OR has_function_privilege('anon',v_proc,'EXECUTE')
       OR has_function_privilege('authenticated',v_proc,'EXECUTE') THEN
      RAISE EXCEPTION 'private Admin function grants are not service-role-only: %',v_signature;
    END IF;
  END LOOP;
END
$verify$;

DO $operation_types$
DECLARE
  v_definition text;
  v_type text;
BEGIN
  SELECT pg_get_constraintdef(c.oid)
    INTO v_definition
    FROM pg_constraint c
   WHERE c.conrelid='public.financial_operations'::regclass
     AND c.conname='financial_operations_operation_type_check'
     AND c.convalidated;
  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'final financial operation CHECK constraint is missing or unvalidated';
  END IF;
  FOREACH v_type IN ARRAY ARRAY[
    'deposit_credit','withdraw_freeze','withdraw_approve','withdraw_reject',
    'withdraw_paid','earn_subscribe','earn_redeem','admin_adjustment',
    'spot_trade','spot_order_reserve','spot_order_cancel','seconds_open',
    'seconds_settle','migration_opening_balance','perp_order_reserve',
    'perp_trade','perp_order_cancel','perp_funding','perp_liquidation',
    'perp_insurance_cover','perp_bad_debt'
  ] LOOP
    IF position(quote_literal(v_type) IN v_definition)=0 THEN
      RAISE EXCEPTION 'final financial operation CHECK constraint is missing %', v_type;
    END IF;
  END LOOP;
END
$operation_types$;

SELECT 'BTCBOX PostgreSQL schema bootstrap and RLS/grant verification passed' AS result;
SQL

echo '[test] Executing financial lifecycle RPCs inside a rolled-back PostgreSQL transaction.'
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/tests/postgres-financial-lifecycle.integration.sql

echo '[test] Executing Perpetual funding settlement checks inside a rolled-back PostgreSQL transaction.'
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/tests/perpetual-live-db.integration.sql
