-- Read-only administrator queue for open Seconds positions.
-- The queue exposes only operational position fields and user UUIDs; no balance,
-- email, KYC data, or controls capable of changing/settling a position.
CREATE OR REPLACE FUNCTION private.admin_read_seconds_open_positions_v1(
  p_actor_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_membership jsonb;
  v_positions jsonb;
  v_total_count bigint;
  v_total_exposure numeric;
  v_overdue_count bigint;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'administrator identity required';
  END IF;

  v_membership := private.admin_get_membership_v1(p_actor_user_id);
  IF coalesce((v_membership->>'found')::boolean,false) IS NOT TRUE
     OR NOT (
       coalesce((v_membership->>'is_super_admin')::boolean,false)
       OR coalesce(v_membership->'permissions','[]'::jsonb) ? 'seconds_policy.read'
     ) THEN
    RAISE EXCEPTION 'seconds policy read permission required';
  END IF;

  SELECT count(*), coalesce(sum(amount),0),
         count(*) FILTER (WHERE settle_at <= v_now)
    INTO v_total_count, v_total_exposure, v_overdue_count
  FROM public.seconds_contract_positions
  WHERE status='open';

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'position_id',q.position_id,
    'user_id',q.user_id,
    'symbol',q.symbol,
    'direction',q.direction,
    'amount',q.amount,
    'duration_sec',q.duration_sec,
    'open_price',q.open_price,
    'settle_at',floor(extract(epoch from q.settle_at)*1000)::bigint,
    'created_at',floor(extract(epoch from q.created_at)*1000)::bigint,
    'payout_bps_snapshot',q.payout_bps_snapshot,
    'policy_version',q.policy_version,
    'overdue',q.settle_at <= v_now
  ) ORDER BY q.settle_at ASC),'[]'::jsonb)
    INTO v_positions
  FROM (
    SELECT position_id,user_id,symbol,direction,amount,duration_sec,open_price,
           settle_at,created_at,payout_bps_snapshot,policy_version
    FROM public.seconds_contract_positions
    WHERE status='open'
    ORDER BY settle_at ASC
    LIMIT 100
  ) q;

  RETURN jsonb_build_object(
    'ok',true,
    'generated_at',floor(extract(epoch from v_now)*1000)::bigint,
    'total_open_count',v_total_count,
    'total_open_exposure',v_total_exposure,
    'overdue_count',v_overdue_count,
    'truncated',v_total_count>100,
    'positions',v_positions
  );
END;
$$;

REVOKE ALL ON FUNCTION private.admin_read_seconds_open_positions_v1(uuid)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.admin_read_seconds_open_positions_v1(uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.admin_read_seconds_open_positions_v1(
  p_actor_user_id uuid
) RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.admin_read_seconds_open_positions_v1(p_actor_user_id);
$$;

REVOKE ALL ON FUNCTION public.admin_read_seconds_open_positions_v1(uuid)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_read_seconds_open_positions_v1(uuid)
  TO service_role;

COMMENT ON FUNCTION public.admin_read_seconds_open_positions_v1(uuid) IS
  'Trusted backend read-only Seconds open-position queue. Rechecks active seconds_policy.read permission and returns at most 100 operational rows.';
