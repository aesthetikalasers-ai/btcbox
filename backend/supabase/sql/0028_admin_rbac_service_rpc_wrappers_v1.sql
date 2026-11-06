-- 0028_admin_rbac_service_rpc_wrappers_v1.sql
-- Expose narrowly scoped wrappers in public so the trusted backend can call
-- the private admin store through Supabase PostgREST without exposing schema
-- private or granting table access to anon/authenticated users.
CREATE OR REPLACE FUNCTION public.admin_get_membership_v1(p_actor_user_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.admin_get_membership_v1(p_actor_user_id);
$$;

CREATE OR REPLACE FUNCTION public.admin_list_memberships_v1(p_actor_user_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $fn$
  SELECT private.admin_list_memberships_v1(p_actor_user_id);
$fn$;

REVOKE ALL ON FUNCTION public.admin_list_memberships_v1(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_memberships_v1(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_manage_membership_v1(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_expected_revision bigint,
  p_action text,
  p_permissions text[],
  p_reason text,
  p_request_id text,
  p_request_hash text
) RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.admin_manage_membership_v1(
    p_actor_user_id,p_target_user_id,p_expected_revision,p_action,
    p_permissions,p_reason,p_request_id,p_request_hash
  );
$$;

REVOKE ALL ON FUNCTION public.admin_get_membership_v1(uuid)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.admin_manage_membership_v1(uuid,uuid,bigint,text,text[],text,text,text)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_membership_v1(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_manage_membership_v1(uuid,uuid,bigint,text,text[],text,text,text)
  TO service_role;

COMMENT ON FUNCTION public.admin_get_membership_v1(uuid) IS
  'Trusted backend only. Returns admin membership after the caller independently verifies the Supabase Auth access token.';
COMMENT ON FUNCTION public.admin_manage_membership_v1(uuid,uuid,bigint,text,text[],text,text,text) IS
  'Trusted backend only. Delegated administrator lifecycle; the private function enforces active Super Admin authority and optimistic revision.';


-- Super Admin / explicitly permitted policy managers can atomically create and
-- activate a new immutable policy version. The caller identity is supplied by
-- the trusted backend only after Supabase Auth verification.
CREATE TABLE IF NOT EXISTS private.seconds_policy_request_idempotency (
  actor_user_id uuid NOT NULL,
  request_id text NOT NULL CHECK (request_id ~ '^[A-Za-z0-9_-]{16,100}$'),
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(actor_user_id,request_id)
);
ALTER TABLE private.seconds_policy_request_idempotency ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.seconds_policy_request_idempotency FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION private.admin_set_seconds_policy_v1(
  p_actor_user_id uuid,
  p_expected_policy_version bigint,
  p_symbols text[],
  p_durations_sec integer[],
  p_min_stake numeric,
  p_max_stake numeric,
  p_payout_bps integer,
  p_per_user_open_exposure numeric,
  p_max_open_positions_per_user integer,
  p_reason text,
  p_request_id text,
  p_request_hash text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_membership jsonb;
  v_existing private.seconds_policy_request_idempotency%rowtype;
  v_current_version bigint;
  v_next_version bigint;
  v_policy_id uuid;
  v_now timestamptz := clock_timestamp();
  v_before jsonb;
  v_after jsonb;
  v_response jsonb;
  v_count integer;
BEGIN
  IF p_actor_user_id IS NULL OR p_expected_policy_version IS NULL OR p_expected_policy_version < 1
     OR coalesce(array_length(p_symbols,1),0) < 1 OR coalesce(array_length(p_durations_sec,1),0) < 1
     OR NOT (p_symbols <@ ARRAY['BTC','ETH','SOL','BNB']::text[])
     OR NOT (0 < ALL(p_durations_sec))
     OR p_min_stake IS NULL OR p_min_stake <= 0
     OR p_max_stake IS NULL OR p_max_stake < p_min_stake
     OR p_payout_bps IS NULL OR p_payout_bps < 8500
     OR (p_per_user_open_exposure IS NOT NULL AND p_per_user_open_exposure <= 0)
     OR (p_max_open_positions_per_user IS NOT NULL AND p_max_open_positions_per_user <= 0)
     OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 1 AND 500
     OR p_request_id IS NULL OR p_request_id !~ '^[A-Za-z0-9_-]{16,100}$'
     OR p_request_hash IS NULL OR p_request_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid seconds policy change';
  END IF;

  SELECT count(DISTINCT symbol) INTO v_count FROM unnest(p_symbols) AS items(symbol);
  IF v_count <> cardinality(p_symbols) THEN RAISE EXCEPTION 'duplicate policy symbol'; END IF;
  SELECT count(DISTINCT duration) INTO v_count FROM unnest(p_durations_sec) AS items(duration);
  IF v_count <> cardinality(p_durations_sec) THEN RAISE EXCEPTION 'duplicate policy duration'; END IF;

  v_membership := private.admin_get_membership_v1(p_actor_user_id);
  IF coalesce((v_membership->>'found')::boolean,false) IS NOT TRUE
     OR NOT (coalesce(v_membership->'permissions','[]'::jsonb) ? 'seconds_policy.manage') THEN
    RAISE EXCEPTION 'seconds policy permission required';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_actor_user_id::text || ':' || p_request_id,0)
  );
  SELECT * INTO v_existing FROM private.seconds_policy_request_idempotency
    WHERE actor_user_id=p_actor_user_id AND request_id=p_request_id;
  IF FOUND THEN
    IF v_existing.request_hash <> p_request_hash THEN RAISE EXCEPTION 'seconds policy idempotency conflict'; END IF;
    RETURN v_existing.response || jsonb_build_object('replayed',true);
  END IF;

  SELECT p.policy_version,
    jsonb_build_object('policy_id',p.policy_id,'policy_version',p.policy_version,
      'symbols',p.symbols,'durations_sec',p.durations_sec,'min_stake',p.min_stake,
      'max_stake',p.max_stake,'payout_bps',p.payout_bps,
      'per_user_open_exposure',p.per_user_open_exposure,
      'max_open_positions_per_user',p.max_open_positions_per_user)
  INTO v_current_version,v_before
  FROM public.seconds_contract_policy_active a
  JOIN public.seconds_contract_policies p ON p.policy_id=a.policy_id
  WHERE a.singleton=true
  FOR UPDATE OF a;
  IF v_current_version IS NULL THEN RAISE EXCEPTION 'active seconds policy unavailable'; END IF;
  IF p_expected_policy_version <> v_current_version THEN RAISE EXCEPTION 'stale seconds policy version'; END IF;

  SELECT coalesce(max(policy_version),0)+1 INTO v_next_version FROM public.seconds_contract_policies;
  v_policy_id := gen_random_uuid();
  INSERT INTO public.seconds_contract_policies(
    policy_id,policy_version,symbols,durations_sec,min_stake,max_stake,payout_bps,
    per_user_open_exposure,max_open_positions_per_user,effective_from,change_reason,created_by
  ) VALUES (
    v_policy_id,v_next_version,p_symbols,p_durations_sec,p_min_stake,p_max_stake,p_payout_bps,
    p_per_user_open_exposure,p_max_open_positions_per_user,v_now,btrim(p_reason),p_actor_user_id::text
  );

  UPDATE public.seconds_contract_policy_active
    SET policy_id=v_policy_id,activated_at=v_now,activated_by=p_actor_user_id::text
    WHERE singleton=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'active seconds policy pointer unavailable'; END IF;

  v_after := jsonb_build_object('policy_id',v_policy_id,'policy_version',v_next_version,
    'symbols',p_symbols,'durations_sec',p_durations_sec,'min_stake',p_min_stake,
    'max_stake',p_max_stake,'payout_bps',p_payout_bps,
    'per_user_open_exposure',p_per_user_open_exposure,
    'max_open_positions_per_user',p_max_open_positions_per_user);
  INSERT INTO public.seconds_contract_policy_audit(
    policy_id,action,actor_id,reason,before_snapshot,after_snapshot,request_id
  ) VALUES (
    v_policy_id,'activated',p_actor_user_id::text,btrim(p_reason),v_before,v_after,p_request_id
  );

  v_response := jsonb_build_object('ok',true,'policy',v_after,'replayed',false);
  INSERT INTO private.seconds_policy_request_idempotency(actor_user_id,request_id,request_hash,response)
    VALUES(p_actor_user_id,p_request_id,p_request_hash,v_response);
  RETURN v_response;
END;
$$;

REVOKE ALL ON FUNCTION private.admin_set_seconds_policy_v1(uuid,bigint,text[],integer[],numeric,numeric,integer,numeric,integer,text,text,text)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.admin_set_seconds_policy_v1(uuid,bigint,text[],integer[],numeric,numeric,integer,numeric,integer,text,text,text)
  TO service_role;

COMMENT ON FUNCTION private.admin_set_seconds_policy_v1(uuid,bigint,text[],integer[],numeric,numeric,integer,numeric,integer,text,text,text) IS
  'Trusted backend only. Atomically versions and activates a Seconds policy after live seconds_policy.manage authorization; 8500 bps is a floor with no fixed ceiling.';


-- Public PostgREST bridge is SECURITY INVOKER. service_role has only private-schema
-- USAGE and EXECUTE on this transition function, never direct table DML.
CREATE OR REPLACE FUNCTION public.admin_set_seconds_policy_v1(
  p_actor_user_id uuid,
  p_expected_policy_version bigint,
  p_symbols text[],
  p_durations_sec integer[],
  p_min_stake numeric,
  p_max_stake numeric,
  p_payout_bps integer,
  p_per_user_open_exposure numeric,
  p_max_open_positions_per_user integer,
  p_reason text,
  p_request_id text,
  p_request_hash text
) RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $wrap$
  SELECT private.admin_set_seconds_policy_v1(
    p_actor_user_id,p_expected_policy_version,p_symbols,p_durations_sec,
    p_min_stake,p_max_stake,p_payout_bps,p_per_user_open_exposure,p_max_open_positions_per_user,
    p_reason,p_request_id,p_request_hash
  );
$wrap$;

REVOKE ALL ON FUNCTION public.admin_set_seconds_policy_v1(uuid,bigint,text[],integer[],numeric,numeric,integer,numeric,integer,text,text,text)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_seconds_policy_v1(uuid,bigint,text[],integer[],numeric,numeric,integer,numeric,integer,text,text,text)
  TO service_role;
