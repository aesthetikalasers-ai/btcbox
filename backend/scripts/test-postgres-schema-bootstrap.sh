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

SELECT 'BTCBOX PostgreSQL schema bootstrap and RLS/grant verification passed' AS result;
SQL

echo '[test] Executing financial lifecycle RPCs inside a rolled-back PostgreSQL transaction.'
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/tests/postgres-financial-lifecycle.integration.sql
