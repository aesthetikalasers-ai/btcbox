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


-- Admin-managed spot pair rules. The service role can call only this audited,
-- permission-checked transition; it never receives direct market-table DML.
CREATE TABLE IF NOT EXISTS private.spot_market_request_idempotency (
  actor_user_id uuid NOT NULL,
  request_id text NOT NULL CHECK (request_id ~ '^[A-Za-z0-9_-]{16,100}$'),
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(actor_user_id,request_id)
);
ALTER TABLE private.spot_market_request_idempotency ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.spot_market_request_idempotency FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION private.admin_set_spot_market_v1(
  p_actor_user_id uuid,
  p_base_asset text,
  p_quote_asset text,
  p_enabled boolean,
  p_price_tick numeric,
  p_quantity_step numeric,
  p_min_quantity numeric,
  p_min_notional numeric,
  p_min_limit_price numeric,
  p_max_limit_price numeric,
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
  v_existing private.spot_market_request_idempotency%rowtype;
  v_market public.financial_matching_markets%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_response jsonb;
BEGIN
  IF p_actor_user_id IS NULL
     OR coalesce(p_base_asset,'') !~ '^[A-Z0-9]{2,16}$'
     OR coalesce(p_quote_asset,'') !~ '^[A-Z0-9]{2,16}$'
     OR p_base_asset=p_quote_asset
     OR p_quote_asset<>'USDT'
     OR p_enabled IS NULL
     OR p_price_tick IS NULL OR p_price_tick<=0
     OR p_quantity_step IS NULL OR p_quantity_step<=0
     OR p_min_quantity IS NULL OR p_min_quantity<=0
     OR p_min_notional IS NULL OR p_min_notional<0
     OR (p_min_limit_price IS NOT NULL AND p_min_limit_price<=0)
     OR (p_max_limit_price IS NOT NULL AND p_max_limit_price<=0)
     OR (p_min_limit_price IS NOT NULL AND p_max_limit_price IS NOT NULL
         AND p_min_limit_price>p_max_limit_price)
     OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 1 AND 500
     OR p_request_id IS NULL OR p_request_id !~ '^[A-Za-z0-9_-]{16,100}$'
     OR p_request_hash IS NULL OR p_request_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid spot market configuration';
  END IF;

  v_membership := private.admin_get_membership_v1(p_actor_user_id);
  IF coalesce((v_membership->>'found')::boolean,false) IS NOT TRUE
     OR NOT (coalesce(v_membership->'permissions','[]'::jsonb) ? 'system_config.write') THEN
    RAISE EXCEPTION 'system config write permission required';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_actor_user_id::text || ':' || p_request_id,0)
  );
  SELECT * INTO v_existing
  FROM private.spot_market_request_idempotency
  WHERE actor_user_id=p_actor_user_id AND request_id=p_request_id;
  IF FOUND THEN
    IF v_existing.request_hash<>p_request_hash THEN
      RAISE EXCEPTION 'spot market idempotency payload mismatch';
    END IF;
    RETURN v_existing.response || jsonb_build_object('replayed',true);
  END IF;

  -- Serialize rule changes with every order submit/cancel on this market.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_base_asset||'/'||p_quote_asset,0)
  );
  SELECT * INTO v_market
  FROM public.financial_matching_markets
  WHERE base_asset=p_base_asset AND quote_asset=p_quote_asset
  FOR UPDATE;

  IF FOUND THEN
    v_before := jsonb_build_object(
      'base_asset',v_market.base_asset,'quote_asset',v_market.quote_asset,'enabled',v_market.enabled,
      'price_tick',v_market.price_tick,'quantity_step',v_market.quantity_step,'min_quantity',v_market.min_quantity,
      'min_notional',v_market.min_notional,'min_limit_price',v_market.min_limit_price,
      'max_limit_price',v_market.max_limit_price,'maker_fee_rate',v_market.maker_fee_rate,
      'taker_fee_rate',v_market.taker_fee_rate
    );
    -- Existing resting orders were accepted under their original precision and
    -- price/size constraints. Do not silently reinterpret them under new rules.
    IF (v_market.price_tick IS DISTINCT FROM p_price_tick
        OR v_market.quantity_step IS DISTINCT FROM p_quantity_step
        OR v_market.min_quantity IS DISTINCT FROM p_min_quantity
        OR v_market.min_notional IS DISTINCT FROM p_min_notional
        OR v_market.min_limit_price IS DISTINCT FROM p_min_limit_price
        OR v_market.max_limit_price IS DISTINCT FROM p_max_limit_price)
       AND EXISTS (
         SELECT 1 FROM public.financial_matching_orders
         WHERE base_asset=p_base_asset AND quote_asset=p_quote_asset
           AND status IN ('open','partially_filled')
       ) THEN
      RAISE EXCEPTION 'cannot change spot market rules while open orders exist; cancel resting orders first';
    END IF;
  END IF;

  INSERT INTO public.financial_matching_markets(
    base_asset,quote_asset,enabled,price_tick,quantity_step,min_quantity,
    min_notional,min_limit_price,max_limit_price
  ) VALUES (
    p_base_asset,p_quote_asset,p_enabled,p_price_tick,p_quantity_step,p_min_quantity,
    p_min_notional,p_min_limit_price,p_max_limit_price
  )
  ON CONFLICT(base_asset,quote_asset) DO UPDATE SET
    enabled=EXCLUDED.enabled,
    price_tick=EXCLUDED.price_tick,
    quantity_step=EXCLUDED.quantity_step,
    min_quantity=EXCLUDED.min_quantity,
    min_notional=EXCLUDED.min_notional,
    min_limit_price=EXCLUDED.min_limit_price,
    max_limit_price=EXCLUDED.max_limit_price,
    updated_at=clock_timestamp()
  RETURNING * INTO v_market;

  v_after := jsonb_build_object(
    'base_asset',v_market.base_asset,'quote_asset',v_market.quote_asset,
    'enabled',v_market.enabled,'price_tick',v_market.price_tick,
    'quantity_step',v_market.quantity_step,'min_quantity',v_market.min_quantity,
    'min_notional',v_market.min_notional,'min_limit_price',v_market.min_limit_price,
    'max_limit_price',v_market.max_limit_price,
    'maker_fee_rate',v_market.maker_fee_rate,'taker_fee_rate',v_market.taker_fee_rate,
    'updated_at',v_market.updated_at
  );

  INSERT INTO public.financial_audit_log(
    actor_id,subject_user_id,action,object_type,object_id,reason,metadata
  ) VALUES (
    p_actor_user_id::text,NULL,'admin_spot_market_updated','spot_market',
    p_base_asset||'/'||p_quote_asset,btrim(p_reason),
    jsonb_build_object('before',coalesce(v_before,'null'::jsonb),'after',v_after,'request_id',p_request_id)
  );

  v_response := jsonb_build_object('ok',true,'market',v_after,'replayed',false);
  INSERT INTO private.spot_market_request_idempotency(actor_user_id,request_id,request_hash,response)
  VALUES(p_actor_user_id,p_request_id,p_request_hash,v_response);
  RETURN v_response;
END;
$$;

REVOKE ALL ON FUNCTION private.admin_set_spot_market_v1(uuid,text,text,boolean,numeric,numeric,numeric,numeric,numeric,numeric,text,text,text)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.admin_set_spot_market_v1(uuid,text,text,boolean,numeric,numeric,numeric,numeric,numeric,numeric,text,text,text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.admin_set_spot_market_v1(
  p_actor_user_id uuid,
  p_base_asset text,
  p_quote_asset text,
  p_enabled boolean,
  p_price_tick numeric,
  p_quantity_step numeric,
  p_min_quantity numeric,
  p_min_notional numeric,
  p_min_limit_price numeric,
  p_max_limit_price numeric,
  p_reason text,
  p_request_id text,
  p_request_hash text
) RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $wrap$
  SELECT private.admin_set_spot_market_v1(
    p_actor_user_id,p_base_asset,p_quote_asset,p_enabled,p_price_tick,
    p_quantity_step,p_min_quantity,p_min_notional,p_min_limit_price,p_max_limit_price,
    p_reason,p_request_id,p_request_hash
  );
$wrap$;

REVOKE ALL ON FUNCTION public.admin_set_spot_market_v1(uuid,text,text,boolean,numeric,numeric,numeric,numeric,numeric,numeric,text,text,text)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_spot_market_v1(uuid,text,text,boolean,numeric,numeric,numeric,numeric,numeric,numeric,text,text,text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.read_spot_market_snapshot_v1()
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $read$
  SELECT jsonb_build_object(
    'ok',true,
    'markets',coalesce(jsonb_agg(jsonb_build_object(
      'base_asset',base_asset,'quote_asset',quote_asset,'enabled',enabled,
      'price_tick',price_tick,'quantity_step',quantity_step,'min_quantity',min_quantity,
      'min_notional',min_notional,'min_limit_price',min_limit_price,
      'max_limit_price',max_limit_price,'maker_fee_rate',maker_fee_rate,
      'taker_fee_rate',taker_fee_rate,'updated_at',updated_at
    ) ORDER BY base_asset,quote_asset),'[]'::jsonb)
  )
  FROM public.financial_matching_markets;
$read$;

REVOKE ALL ON FUNCTION public.read_spot_market_snapshot_v1()
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.read_spot_market_snapshot_v1() TO service_role;

COMMENT ON FUNCTION public.admin_set_spot_market_v1(uuid,text,text,boolean,numeric,numeric,numeric,numeric,numeric,numeric,text,text,text) IS
  'Trusted backend only. Requires active system_config.write membership; atomically upserts spot market rules and appends audit/idempotency records.';
