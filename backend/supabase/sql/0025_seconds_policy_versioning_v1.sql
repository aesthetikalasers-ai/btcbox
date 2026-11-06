-- BTCBOX seconds policy versioning v1.
-- Additive/source-only migration. Apply ONLY in isolated staging after review.
-- 85% is the minimum configurable winning-profit rate; future policy versions may raise it up to 100%.
-- Existing positions retain their immutable snapshot or legacy 85% fallback.
-- It does not enable financial cutover or create administrator write endpoints.

CREATE TABLE IF NOT EXISTS public.seconds_contract_policies (
  policy_id uuid PRIMARY KEY,
  policy_version bigint NOT NULL UNIQUE CHECK (policy_version > 0),
  symbols text[] NOT NULL CHECK (cardinality(symbols) > 0),
  durations_sec integer[] NOT NULL CHECK (cardinality(durations_sec) > 0),
  min_stake numeric(38,18) NOT NULL CHECK (min_stake > 0),
  max_stake numeric(38,18) NOT NULL CHECK (max_stake >= min_stake),
  payout_bps integer NOT NULL CHECK (payout_bps >= 8500),
  per_user_open_exposure numeric(38,18),
  effective_from timestamptz NOT NULL,
  effective_until timestamptz,
  change_reason text NOT NULL CHECK (length(btrim(change_reason)) BETWEEN 1 AND 500),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (effective_until IS NULL OR effective_until > effective_from),
  CHECK (symbols <@ ARRAY['BTC','ETH','SOL','BNB']::text[]),
  CHECK (durations_sec <@ ARRAY[30,60,300,900]::integer[]),
  CHECK (per_user_open_exposure IS NULL OR per_user_open_exposure > 0)
);

-- The active pointer is separate from immutable policy content.
CREATE TABLE IF NOT EXISTS public.seconds_contract_policy_active (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  policy_id uuid NOT NULL REFERENCES public.seconds_contract_policies(policy_id),
  activated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  activated_by text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.seconds_contract_policy_audit (
  audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL REFERENCES public.seconds_contract_policies(policy_id),
  action text NOT NULL CHECK (action IN ('seed','draft_created','activated','retired')),
  actor_id text NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 500),
  before_snapshot jsonb,
  after_snapshot jsonb NOT NULL,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE OR REPLACE FUNCTION public.prevent_seconds_policy_audit_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'seconds contract policy audit is append-only';
END;
$$;

DROP TRIGGER IF EXISTS seconds_contract_policy_audit_immutable ON public.seconds_contract_policy_audit;
CREATE TRIGGER seconds_contract_policy_audit_immutable
BEFORE UPDATE OR DELETE ON public.seconds_contract_policy_audit
FOR EACH ROW EXECUTE FUNCTION public.prevent_seconds_policy_audit_mutation_v1();

ALTER TABLE public.seconds_contract_positions
  ADD COLUMN IF NOT EXISTS policy_id uuid REFERENCES public.seconds_contract_policies(policy_id),
  ADD COLUMN IF NOT EXISTS policy_version bigint,
  ADD COLUMN IF NOT EXISTS payout_bps_snapshot integer,
  ADD COLUMN IF NOT EXISTS policy_snapshot jsonb;

ALTER TABLE public.seconds_contract_positions
  ADD CONSTRAINT seconds_positions_payout_bps_snapshot_check
  CHECK (payout_bps_snapshot IS NULL OR payout_bps_snapshot >= 8500);

-- Policy records and position terms are immutable after insertion.
CREATE OR REPLACE FUNCTION public.prevent_seconds_policy_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'seconds contract policy versions are immutable; create a new version';
END;
$$;

DROP TRIGGER IF EXISTS seconds_contract_policies_immutable ON public.seconds_contract_policies;
CREATE TRIGGER seconds_contract_policies_immutable
BEFORE UPDATE OR DELETE ON public.seconds_contract_policies
FOR EACH ROW EXECUTE FUNCTION public.prevent_seconds_policy_mutation_v1();

CREATE OR REPLACE FUNCTION public.prevent_seconds_position_policy_rewrite_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.policy_id IS NOT DISTINCT FROM NEW.policy_id
     AND OLD.policy_version IS NOT DISTINCT FROM NEW.policy_version
     AND OLD.payout_bps_snapshot IS NOT DISTINCT FROM NEW.payout_bps_snapshot
     AND OLD.policy_snapshot IS NOT DISTINCT FROM NEW.policy_snapshot THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'seconds position policy snapshot is immutable';
END;
$$;

DROP TRIGGER IF EXISTS seconds_position_policy_snapshot_immutable ON public.seconds_contract_positions;
CREATE TRIGGER seconds_position_policy_snapshot_immutable
BEFORE UPDATE ON public.seconds_contract_positions
FOR EACH ROW EXECUTE FUNCTION public.prevent_seconds_position_policy_rewrite_v1();

-- Seed exactly the currently observed behavior. This does not broaden policy.
INSERT INTO public.seconds_contract_policies (
  policy_id, policy_version, symbols, durations_sec, min_stake, max_stake,
  payout_bps, per_user_open_exposure, effective_from, change_reason, created_by
) VALUES (
  '02500000-0000-4000-8000-000000000001',
  1,
  ARRAY['BTC','ETH','SOL','BNB'],
  ARRAY[30,60,300,900],
  0.000000000000000001,
  1000000000000,
  8500,
  NULL,
  clock_timestamp(),
  'Initial policy snapshot of existing server/database rules; no commercial change',
  'system-migration'
) ON CONFLICT (policy_version) DO NOTHING;

INSERT INTO public.seconds_contract_policy_active(singleton,policy_id,activated_by)
SELECT true, policy_id, 'system-migration'
FROM public.seconds_contract_policies WHERE policy_version=1
ON CONFLICT (singleton) DO NOTHING;

INSERT INTO public.seconds_contract_policy_audit(policy_id,action,actor_id,reason,after_snapshot)
SELECT policy_id,'seed','system-migration',change_reason,
  jsonb_build_object('version',policy_version,'symbols',symbols,'durations_sec',durations_sec,
    'min_stake',min_stake,'max_stake',max_stake,'payout_bps',payout_bps,
    'per_user_open_exposure',per_user_open_exposure)
FROM public.seconds_contract_policies WHERE policy_version=1
AND NOT EXISTS (SELECT 1 FROM public.seconds_contract_policy_audit WHERE action='seed');

ALTER TABLE public.seconds_contract_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seconds_contract_policy_active ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seconds_contract_policy_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.seconds_contract_policies, public.seconds_contract_policy_active,
  public.seconds_contract_policy_audit FROM public, anon, authenticated;
GRANT SELECT ON public.seconds_contract_policies, public.seconds_contract_policy_active TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.seconds_contract_policies,
  public.seconds_contract_policy_active, public.seconds_contract_policy_audit FROM service_role;

-- New orders resolve and snapshot the active policy in the same transaction
-- that reserves funds. Existing request-id replay is checked before policy
-- lookup, preserving idempotent replay even after a later policy activation.
CREATE OR REPLACE FUNCTION public.submit_seconds_order_v1(
  p_position_id text, p_user_id text, p_symbol text, p_direction text,
  p_amount numeric, p_duration_sec integer, p_open_price numeric,
  p_request_id text, p_request_hash text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_existing public.seconds_contract_positions%rowtype;
  v_policy public.seconds_contract_policies%rowtype;
  v_available numeric;
  v_frozen numeric;
  v_operation_id uuid;
  v_now timestamptz := clock_timestamp();
  v_settle_at timestamptz;
BEGIN
  IF coalesce(p_user_id,'')='' OR p_symbol NOT IN ('BTC','ETH','SOL','BNB')
     OR p_direction NOT IN ('up','down') OR p_amount IS NULL OR p_amount<=0
     OR p_duration_sec NOT IN (30,60,300,900)
     OR p_request_id !~ '^[A-Za-z0-9_-]{16,100}$'
     OR coalesce(p_request_hash,'') !~ '^[0-9a-f]{64}$'
     OR p_position_id !~ '^SC[A-Fa-f0-9]{30}$' THEN
    RETURN jsonb_build_object('ok',false,'code','INVALID_ARGUMENT');
  END IF;

  SELECT * INTO v_existing FROM public.seconds_contract_positions
  WHERE open_request_id=p_request_id FOR UPDATE;
  IF FOUND THEN
    IF v_existing.open_request_hash<>p_request_hash OR v_existing.user_id<>p_user_id THEN
      RETURN jsonb_build_object('ok',false,'code','IDEMPOTENCY_CONFLICT');
    END IF;
    RETURN jsonb_build_object('ok',true,'duplicate',true,'position_id',v_existing.position_id,
      'status',v_existing.status,'open_price',v_existing.open_price,
      'settle_at',extract(epoch from v_existing.settle_at)::bigint);
  END IF;

  -- A missing/invalid price is acceptable only for the replay lookup above.
  -- Never create a new position without a positive server-supplied price.
  IF p_open_price IS NULL OR p_open_price<=0 THEN
    RETURN jsonb_build_object('ok',false,'code','REFERENCE_PRICE_REQUIRED');
  END IF;

  SELECT p.* INTO v_policy
  FROM public.seconds_contract_policy_active a
  JOIN public.seconds_contract_policies p ON p.policy_id=a.policy_id
  WHERE a.singleton=true
    AND p.effective_from<=v_now
    AND (p.effective_until IS NULL OR p.effective_until>v_now);
  -- Policy rows are immutable and the active pointer is not writable by the API role.
  -- A plain MVCC read is sufficient; avoid requiring UPDATE privilege for row locks.
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok',false,'code','SECONDS_POLICY_UNAVAILABLE');
  END IF;
  IF NOT (p_symbol=ANY(v_policy.symbols))
     OR NOT (p_duration_sec=ANY(v_policy.durations_sec))
     OR p_amount<v_policy.min_stake OR p_amount>v_policy.max_stake THEN
    RETURN jsonb_build_object('ok',false,'code','POLICY_LIMIT_EXCEEDED',
      'policy_version',v_policy.policy_version);
  END IF;

  INSERT INTO public.financial_accounts(user_id,asset) VALUES(p_user_id,'USDT') ON CONFLICT DO NOTHING;
  SELECT available,frozen INTO v_available,v_frozen FROM public.financial_accounts
  WHERE user_id=p_user_id AND asset='USDT' FOR UPDATE;
  IF v_available<p_amount THEN
    RETURN jsonb_build_object('ok',false,'code','INSUFFICIENT_BALANCE');
  END IF;

  IF v_policy.per_user_open_exposure IS NOT NULL AND
     (SELECT coalesce(sum(amount),0) FROM public.seconds_contract_positions
      WHERE user_id=p_user_id AND status='open') + p_amount > v_policy.per_user_open_exposure THEN
    RETURN jsonb_build_object('ok',false,'code','OPEN_EXPOSURE_LIMIT_EXCEEDED');
  END IF;

  v_settle_at:=v_now+make_interval(secs=>p_duration_sec);
  INSERT INTO public.financial_operations(idempotency_key,user_id,asset,operation_type,request_hash,metadata)
  VALUES(p_request_id,p_user_id,'USDT','seconds_open',p_request_hash,
    jsonb_build_object('position_id',p_position_id,'symbol',p_symbol,'direction',p_direction,
      'amount',p_amount,'duration_sec',p_duration_sec,'open_price',p_open_price,
      'policy_id',v_policy.policy_id,'policy_version',v_policy.policy_version,
      'payout_bps',v_policy.payout_bps))
  RETURNING id INTO v_operation_id;

  UPDATE public.financial_accounts SET available=available-p_amount,frozen=frozen+p_amount,
    version=version+1,updated_at=v_now WHERE user_id=p_user_id AND asset='USDT'
  RETURNING available,frozen INTO v_available,v_frozen;

  INSERT INTO public.financial_ledger(operation_id,user_id,asset,available_delta,frozen_delta,available_after,frozen_after)
  VALUES(v_operation_id,p_user_id,'USDT',-p_amount,p_amount,v_available,v_frozen);

  INSERT INTO public.seconds_contract_positions(
    position_id,user_id,symbol,direction,amount,duration_sec,open_price,open_price_source,
    open_price_ts,open_request_id,open_request_hash,open_operation_id,settle_at,
    policy_id,policy_version,payout_bps_snapshot,policy_snapshot
  ) VALUES (
    p_position_id,p_user_id,p_symbol,p_direction,p_amount,p_duration_sec,p_open_price,
    'server_reference_feed',v_now,p_request_id,p_request_hash,v_operation_id,v_settle_at,
    v_policy.policy_id,v_policy.policy_version,v_policy.payout_bps,
    jsonb_build_object('policy_version',v_policy.policy_version,'symbols',v_policy.symbols,
      'durations_sec',v_policy.durations_sec,'min_stake',v_policy.min_stake,
      'max_stake',v_policy.max_stake,'payout_bps',v_policy.payout_bps,
      'per_user_open_exposure',v_policy.per_user_open_exposure)
  );

  RETURN jsonb_build_object('ok',true,'duplicate',false,'position_id',p_position_id,
    'open_price',p_open_price,'policy_version',v_policy.policy_version,
    'settle_at',extract(epoch from v_settle_at)::bigint);
EXCEPTION WHEN unique_violation THEN
  -- The only expected unique conflicts are request/idempotency collisions.
  -- Multiple open positions per user are intentionally permitted.
  RETURN jsonb_build_object('ok',false,'code','IDEMPOTENCY_CONFLICT');
END;
$$;

-- Settlement uses the immutable payout snapshot for newly created positions.
-- NULL snapshots are legacy positions and retain the historical 85% rule.
CREATE OR REPLACE FUNCTION public.settle_seconds_position_v1(
  p_position_id text, p_user_id text, p_request_id text, p_request_hash text,
  p_symbol text, p_settle_price numeric, p_settle_price_source text, p_settle_price_ts timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_pos public.seconds_contract_positions%rowtype;
  v_available numeric; v_frozen numeric; v_op_id uuid;
  v_pnl numeric; v_credit numeric; v_win boolean; v_tie boolean;
  v_now timestamptz:=clock_timestamp();
  v_payout_bps integer;
BEGIN
  IF coalesce(p_user_id,'')='' OR p_position_id !~ '^SC[A-Fa-f0-9]{30}$'
     OR p_request_id !~ '^[A-Za-z0-9_-]{16,100}$'
     OR coalesce(p_request_hash,'') !~ '^[0-9a-f]{64}$'
     OR p_symbol NOT IN ('BTC','ETH','SOL','BNB')
     OR p_settle_price IS NULL OR p_settle_price<=0
     OR coalesce(p_settle_price_source,'') NOT IN ('coinbase','bybit')
     OR p_settle_price_ts IS NULL
     OR p_settle_price_ts>v_now+interval '5 seconds'
     OR p_settle_price_ts<v_now-interval '2 minutes' THEN
    RETURN jsonb_build_object('ok',false,'code','INVALID_ARGUMENT');
  END IF;

  SELECT * INTO v_pos FROM public.seconds_contract_positions
  WHERE position_id=p_position_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','POSITION_NOT_FOUND'); END IF;
  IF v_pos.symbol<>p_symbol THEN RETURN jsonb_build_object('ok',false,'code','SYMBOL_MISMATCH'); END IF;

  IF v_pos.status='settled' THEN
    IF v_pos.settle_request_id=p_request_id THEN
      IF v_pos.settle_request_hash IS DISTINCT FROM p_request_hash THEN
        RETURN jsonb_build_object('ok',false,'code','IDEMPOTENCY_CONFLICT');
      END IF;
      RETURN jsonb_build_object('ok',true,'duplicate',true,'settled',true,
        'position_id',v_pos.position_id,'win',v_pos.win,'tie',v_pos.tie,
        'pnl',v_pos.pnl,'settle_price',v_pos.settle_price);
    END IF;
    RETURN jsonb_build_object('ok',false,'code','POSITION_ALREADY_SETTLED');
  END IF;
  IF v_now<v_pos.settle_at THEN
    RETURN jsonb_build_object('ok',true,'duplicate',false,'settled',false,
      'settle_at',extract(epoch from v_pos.settle_at)::bigint);
  END IF;
  IF p_settle_price_ts<v_pos.settle_at THEN
    RETURN jsonb_build_object('ok',false,'code','SETTLEMENT_PRICE_BEFORE_MATURITY');
  END IF;

  v_payout_bps:=coalesce(v_pos.payout_bps_snapshot,8500);
  v_tie:=p_settle_price=v_pos.open_price;
  v_win:=(not v_tie) AND ((v_pos.direction='up' AND p_settle_price>v_pos.open_price)
    OR (v_pos.direction='down' AND p_settle_price<v_pos.open_price));
  v_pnl:=CASE WHEN v_tie THEN 0 WHEN v_win THEN round(v_pos.amount*v_payout_bps/10000,18)
    ELSE -v_pos.amount END;
  v_credit:=CASE WHEN v_tie THEN v_pos.amount WHEN v_win THEN v_pos.amount+v_pnl ELSE 0 END;

  INSERT INTO public.financial_accounts(user_id,asset) VALUES(p_user_id,'USDT') ON CONFLICT DO NOTHING;
  SELECT available,frozen INTO v_available,v_frozen FROM public.financial_accounts
  WHERE user_id=p_user_id AND asset='USDT' FOR UPDATE;
  IF v_frozen<v_pos.amount THEN
    RETURN jsonb_build_object('ok',false,'code','FROZEN_BALANCE_INVARIANT');
  END IF;

  INSERT INTO public.financial_operations(idempotency_key,user_id,asset,operation_type,request_hash,metadata)
  VALUES(p_request_id,p_user_id,'USDT','seconds_settle',p_request_hash,
    jsonb_build_object('position_id',p_position_id,'symbol',p_symbol,'direction',v_pos.direction,
      'amount',v_pos.amount,'open_price',v_pos.open_price,'settle_price',p_settle_price,
      'settle_price_source',p_settle_price_source,'settle_price_ts',p_settle_price_ts,
      'pnl',v_pnl,'win',v_win,'tie',v_tie,'policy_id',v_pos.policy_id,
      'policy_version',v_pos.policy_version,'payout_bps_snapshot',v_payout_bps))
  RETURNING id INTO v_op_id;

  UPDATE public.financial_accounts SET available=available+v_credit,frozen=frozen-v_pos.amount,
    version=version+1,updated_at=v_now WHERE user_id=p_user_id AND asset='USDT'
  RETURNING available,frozen INTO v_available,v_frozen;

  INSERT INTO public.financial_ledger(operation_id,user_id,asset,available_delta,frozen_delta,available_after,frozen_after)
  VALUES(v_op_id,p_user_id,'USDT',v_credit,-v_pos.amount,v_available,v_frozen);

  UPDATE public.seconds_contract_positions SET status='settled',settle_price=p_settle_price,
    settle_price_source=p_settle_price_source,settle_price_ts=p_settle_price_ts,pnl=v_pnl,
    win=v_win,tie=v_tie,settle_request_id=p_request_id,settle_request_hash=p_request_hash,
    settle_operation_id=v_op_id,settled_at=v_now WHERE position_id=p_position_id;

  RETURN jsonb_build_object('ok',true,'duplicate',false,'settled',true,
    'position_id',p_position_id,'win',v_win,'tie',v_tie,'pnl',v_pnl,
    'settle_price',p_settle_price,'policy_version',v_pos.policy_version);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok',false,'code','IDEMPOTENCY_CONFLICT');
END;
$$;

REVOKE ALL ON FUNCTION public.submit_seconds_order_v1(text,text,text,text,numeric,integer,numeric,text,text)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_seconds_order_v1(text,text,text,text,numeric,integer,numeric,text,text)
  TO service_role;
REVOKE ALL ON FUNCTION public.settle_seconds_position_v1(text,text,text,text,text,numeric,text,timestamptz)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_seconds_position_v1(text,text,text,text,text,numeric,text,timestamptz)
  TO service_role;


-- Read the active policy through a narrow server-only RPC. Browser roles never
-- receive table access; the backend adds the financial cutover feature flag.
CREATE OR REPLACE FUNCTION public.read_active_seconds_policy_v1()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT coalesce(
    (
      SELECT jsonb_build_object(
        'ok', true,
        'policy', jsonb_build_object(
          'policy_id', p.policy_id,
          'policy_version', p.policy_version,
          'symbols', p.symbols,
          'durations_sec', p.durations_sec,
          'min_stake', p.min_stake,
          'max_stake', p.max_stake,
          'payout_bps', p.payout_bps,
          'per_user_open_exposure', p.per_user_open_exposure,
          'effective_from', p.effective_from,
          'effective_until', p.effective_until
        )
      )
      FROM public.seconds_contract_policy_active a
      JOIN public.seconds_contract_policies p ON p.policy_id = a.policy_id
      WHERE a.singleton = true
        AND p.effective_from <= clock_timestamp()
        AND (p.effective_until IS NULL OR p.effective_until > clock_timestamp())
      LIMIT 1
    ),
    jsonb_build_object('ok', false, 'code', 'SECONDS_POLICY_UNAVAILABLE')
  );
$$;

REVOKE ALL ON FUNCTION public.read_active_seconds_policy_v1() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_active_seconds_policy_v1() TO service_role;
