-- 0057_admin_withdrawal_queue_includes_approved_payouts_v1.sql
-- Keep approved withdrawals visible until staff records the manual payout.
-- The approval debit is already final; this read RPC is display-only.
CREATE OR REPLACE FUNCTION public.read_admin_withdrawal_snapshot_v1()
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_count integer;
  v_review_count integer;
  v_approved_count integer;
  v_withdrawals jsonb;
BEGIN
  SELECT
    count(*) FILTER (WHERE status IN ('pending', 'pending_admin_review'))::integer,
    count(*) FILTER (WHERE status = 'pending_admin_review')::integer,
    count(*) FILTER (WHERE status = 'approved')::integer
  INTO v_count, v_review_count, v_approved_count
  FROM public.withdrawal_requests
  WHERE status IN ('pending', 'pending_admin_review', 'approved');

  -- Approved items are prioritized so outstanding manual payouts remain
  -- actionable even when the pending-review queue is busy.
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'uid', user_id, 'coin', asset, 'amount', amount, 'fee', fee,
    'settlement_asset', settlement_asset, 'settlement_amount', settlement_amount,
    'conversion_rate', conversion_rate, 'network', network, 'address', destination,
    'status', status, 'require_admin_review', require_admin_review,
    'txid', '', 'time', created_at
  ) ORDER BY priority, created_at ASC, id ASC), '[]'::jsonb)
  INTO v_withdrawals
  FROM (
    SELECT id, user_id, asset, amount, fee, settlement_asset, settlement_amount,
      conversion_rate, network, destination, status, require_admin_review,
      created_at, CASE WHEN status = 'approved' THEN 0 ELSE 1 END AS priority
    FROM public.withdrawal_requests
    WHERE status IN ('pending', 'pending_admin_review', 'approved')
    ORDER BY priority, created_at ASC, id ASC
    LIMIT 200
  ) active;

  RETURN jsonb_build_object(
    'ok', true,
    'pending_count', v_count,
    'pending_admin_review_count', v_review_count,
    'approved_count', v_approved_count,
    'withdrawals', v_withdrawals
  );
END;
$$;

REVOKE ALL ON FUNCTION public.read_admin_withdrawal_snapshot_v1()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_admin_withdrawal_snapshot_v1()
  TO service_role;
