-- Disposable PostgreSQL integration test for Perpetual funding settlement.
-- Exercises a real matched long/short pair, margin-funded debit, persisted-rate
-- parity, exact retry, and ledger/account reconciliation. All fixtures roll back.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.test_credit(
  p_deposit_id text,
  p_user_id text,
  p_asset text,
  p_amount numeric,
  p_request_id text,
  p_reference text,
  p_note text
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_hash text;
BEGIN
  v_hash := encode(extensions.digest(
    concat_ws('|','admin-ci',p_user_id,p_asset,p_amount::text,
      coalesce(p_reference,''),coalesce(p_note,'')), 'sha256'
  ), 'hex');
  RETURN public.admin_manual_deposit_atomic(
    p_deposit_id,'admin-ci',p_user_id,p_asset,p_amount,p_request_id,v_hash,p_reference,p_note
  );
END;
$$;

DO $perpetual_funding_tests$
DECLARE
  v_result jsonb;
  v_failed boolean := false;
  v_funding_at timestamptz := '2026-11-19 00:00:00+00';
  v_long_available numeric(38,18);
  v_long_frozen numeric(38,18);
  v_short_available numeric(38,18);
  v_short_frozen numeric(38,18);
  v_long_margin numeric(38,18);
  v_long_funding_paid numeric(38,18);
  v_short_margin numeric(38,18);
  v_short_funding_paid numeric(38,18);
  v_funding_ops integer;
  v_funding_history integer;
  v_funding_ledger integer;
  v_funding_net numeric(38,18);
  v_total_frozen numeric(38,18);
  v_position_margin numeric(38,18);
  v_open_reserved numeric(38,18);
BEGIN
  INSERT INTO auth.users(id)
  VALUES ('00000000-0000-4000-8000-000000000001')
  ON CONFLICT(id) DO NOTHING;
  PERFORM private.bootstrap_super_admin_v1(
    '00000000-0000-4000-8000-000000000001',
    'disposable PostgreSQL Perpetual funding integration test',
    'CI-PERP-FUNDING-ONLY'
  );

  -- Fund each side with exactly one unit of initial margin. After order matching,
  -- available is zero so the long-side funding debit must come from isolated margin.
  PERFORM pg_temp.test_credit(
    'MD-PERP-LONG-CI','perp-long-ci','USDT',100,
    'deposit-perp-long-ci-0001','perp-long-fixture','postgres-ci'
  );
  PERFORM pg_temp.test_credit(
    'MD-PERP-SHORT-CI','perp-short-ci','USDT',100,
    'deposit-perp-short-ci-0001','perp-short-fixture','postgres-ci'
  );

  INSERT INTO public.perpetual_markets(
    symbol,base_asset,quote_asset,enabled,status,price_tick,quantity_step,min_quantity,
    max_leverage,maintenance_margin_rate,maker_fee_rate,taker_fee_rate,
    mark_price_stale_sec,circuit_breaker_deviation_pct
  ) VALUES (
    'BTCUSDT','BTC','USDT',true,'trading',1,0.001,0.001,
    10,0.005,0,0,60,5
  );

  INSERT INTO public.perpetual_mark_price_feed(
    symbol,index_price,mark_price,sources,source_count,max_deviation_pct,status
  ) VALUES (
    'BTCUSDT',100,100,
    '[{"source":"ci-a","price":100},{"source":"ci-b","price":100},{"source":"ci-c","price":100}]'::jsonb,
    3,0,'ok'
  );

  -- Resting short ask, then a market buy from the long side; both positions are
  -- opened through the actual Perpetual matching RPC and ledger paths.
  v_result := public.perp_submit_order(
    'PERP-ASK-CI-0001','perp-short-ci','BTCUSDT','limit','sell',100,1,1,false,false,
    'perp-short-open-ci-0001'
  );
  IF v_result->>'ok'<>'true' OR (v_result->>'remaining_quantity')::numeric<>1 THEN
    RAISE EXCEPTION 'Perpetual maker order setup failed: %',v_result;
  END IF;

  v_result := public.perp_submit_order(
    'PERP-BUY-CI-0001','perp-long-ci','BTCUSDT','market','buy',NULL,1,1,false,false,
    'perp-long-open-ci-0001'
  );
  IF v_result->>'ok'<>'true' OR (v_result->>'filled_quantity')::numeric<>1
     OR (v_result->>'remaining_quantity')::numeric<>0 THEN
    RAISE EXCEPTION 'Perpetual taker order did not fully match: %',v_result;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.perpetual_positions
    WHERE user_id='perp-long-ci' AND symbol='BTCUSDT' AND side='long'
      AND quantity=1 AND isolated_margin=100
  ) OR NOT EXISTS (
    SELECT 1 FROM public.perpetual_positions
    WHERE user_id='perp-short-ci' AND symbol='BTCUSDT' AND side='short'
      AND quantity=1 AND isolated_margin=100
  ) THEN
    RAISE EXCEPTION 'Perpetual matching did not create the expected isolated long/short positions';
  END IF;

  -- Reusing the original client key with a different reduce-only intent must fail closed.
  v_failed := false;
  BEGIN
    PERFORM public.perp_submit_order(
      'PERP-BUY-CI-REPLAY-FLAG-1','perp-long-ci','BTCUSDT','market','buy',NULL,1,1,true,false,
      'perp-long-open-ci-0001'
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%client order id payload mismatch%' THEN RAISE; END IF;
    v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'Perpetual order replay accepted a changed reduce_only flag';
  END IF;

  -- close_position is a separate intent and must also be part of the replay payload.
  v_failed := false;
  BEGIN
    PERFORM public.perp_submit_order(
      'PERP-BUY-CI-REPLAY-FLAG-2','perp-long-ci','BTCUSDT','market','buy',NULL,1,1,true,true,
      'perp-long-open-ci-0001'
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%client order id payload mismatch%' THEN RAISE; END IF;
    v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'Perpetual order replay accepted a changed close_position flag';
  END IF;

  INSERT INTO public.perpetual_funding_rates(
    symbol,funding_at,rate,premium_index,mark_price,index_price,sources,settled
  ) VALUES (
    'BTCUSDT',v_funding_at,0.001,0,100,100,'[]'::jsonb,false
  );

  -- Long pays from frozen isolated margin because available is zero.
  v_result := public.perp_settle_funding_one('BTCUSDT',v_funding_at,0.001,'perp-long-ci');
  IF v_result->>'ok'<>'true' OR (v_result->>'payment_delta')::numeric<>-0.1 THEN
    RAISE EXCEPTION 'Long funding debit failed or used the wrong persisted rate: %',v_result;
  END IF;

  -- Exact retry must be a successful duplicate, not a unique-key exception.
  v_result := public.perp_settle_funding_one('BTCUSDT',v_funding_at,0.001,'perp-long-ci');
  IF v_result->>'duplicate'<>'true' THEN
    RAISE EXCEPTION 'Perpetual funding retry was not idempotent: %',v_result;
  END IF;

  -- Reusing the same key with a different rate must fail closed, even after settlement.
  v_failed := false;
  BEGIN
    PERFORM public.perp_settle_funding_one('BTCUSDT',v_funding_at,0.002,'perp-long-ci');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%funding rate does not match persisted funding rate%' THEN RAISE; END IF;
    v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'Perpetual funding accepted a rate different from the persisted rate';
  END IF;

  -- Short receives the same persisted funding amount.
  v_result := public.perp_settle_funding_one('BTCUSDT',v_funding_at,0.001,'perp-short-ci');
  IF v_result->>'ok'<>'true' OR (v_result->>'payment_delta')::numeric<>0.1 THEN
    RAISE EXCEPTION 'Short funding credit failed or used the wrong persisted rate: %',v_result;
  END IF;

  SELECT available,frozen INTO v_long_available,v_long_frozen
    FROM public.financial_accounts WHERE user_id='perp-long-ci' AND asset='USDT';
  SELECT available,frozen INTO v_short_available,v_short_frozen
    FROM public.financial_accounts WHERE user_id='perp-short-ci' AND asset='USDT';
  SELECT isolated_margin,funding_paid INTO v_long_margin,v_long_funding_paid
    FROM public.perpetual_positions WHERE user_id='perp-long-ci' AND symbol='BTCUSDT';
  SELECT isolated_margin,funding_paid INTO v_short_margin,v_short_funding_paid
    FROM public.perpetual_positions WHERE user_id='perp-short-ci' AND symbol='BTCUSDT';

  IF v_long_available<>0 OR v_long_frozen<>99.9 OR v_long_margin<>99.9
     OR v_long_funding_paid<>0.1 THEN
    RAISE EXCEPTION 'Long funding must debit isolated margin and record funding once: available %, frozen %, margin %, funding_paid %',
      v_long_available,v_long_frozen,v_long_margin,v_long_funding_paid;
  END IF;
  IF v_short_available<>0.1 OR v_short_frozen<>100 OR v_short_margin<>100
     OR v_short_funding_paid<>-0.1 THEN
    RAISE EXCEPTION 'Short funding credit or signed funding_paid mismatch: available %, frozen %, margin %, funding_paid %',
      v_short_available,v_short_frozen,v_short_margin,v_short_funding_paid;
  END IF;

  SELECT count(*) INTO v_funding_ops
    FROM public.financial_operations
   WHERE operation_type='perp_funding' AND user_id IN ('perp-long-ci','perp-short-ci');
  SELECT count(*) INTO v_funding_history
    FROM public.perpetual_funding_history
   WHERE symbol='BTCUSDT' AND funding_at=v_funding_at
     AND user_id IN ('perp-long-ci','perp-short-ci');
  SELECT count(*) INTO v_funding_ledger
    FROM public.financial_ledger l
    JOIN public.financial_operations o ON o.id=l.operation_id
   WHERE o.operation_type='perp_funding' AND o.user_id IN ('perp-long-ci','perp-short-ci');
  SELECT coalesce(sum(l.available_delta+l.frozen_delta),0) INTO v_funding_net
    FROM public.financial_ledger l
    JOIN public.financial_operations o ON o.id=l.operation_id
   WHERE o.operation_type='perp_funding' AND o.user_id IN ('perp-long-ci','perp-short-ci');

  IF v_funding_ops<>2 OR v_funding_history<>2 OR v_funding_ledger<>2 OR v_funding_net<>0 THEN
    RAISE EXCEPTION 'Funding replay/ledger reconciliation mismatch: operations %, history %, ledger %, net %',
      v_funding_ops,v_funding_history,v_funding_ledger,v_funding_net;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.financial_accounts a
     WHERE a.user_id IN ('perp-long-ci','perp-short-ci') AND a.asset='USDT'
       AND (a.available+a.frozen) IS DISTINCT FROM (
         SELECT coalesce(sum(l.available_delta+l.frozen_delta),0)
           FROM public.financial_ledger l
          WHERE l.user_id=a.user_id AND l.asset=a.asset
       )
  ) THEN
    RAISE EXCEPTION 'Perpetual test account balances do not reconcile to ledger sums';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.financial_operations o
     WHERE o.user_id IN ('perp-long-ci','perp-short-ci')
       AND NOT EXISTS (SELECT 1 FROM public.financial_ledger l WHERE l.operation_id=o.id)
  ) THEN
    RAISE EXCEPTION 'Perpetual test created an orphan financial operation';
  END IF;

  SELECT coalesce(sum(frozen),0) INTO v_total_frozen
    FROM public.financial_accounts
   WHERE user_id IN ('perp-long-ci','perp-short-ci') AND asset='USDT';
  SELECT coalesce(sum(isolated_margin),0) INTO v_position_margin
    FROM public.perpetual_positions
   WHERE user_id IN ('perp-long-ci','perp-short-ci') AND symbol='BTCUSDT';
  SELECT coalesce(sum(reserved_margin),0) INTO v_open_reserved
    FROM public.perpetual_orders
   WHERE user_id IN ('perp-long-ci','perp-short-ci') AND status IN ('open','partially_filled');
  IF v_total_frozen<>v_position_margin+v_open_reserved THEN
    RAISE EXCEPTION 'Perpetual frozen funds do not reconcile to position margin plus open-order reserve';
  END IF;

  RAISE NOTICE 'BTCBOX Perpetual funding settlement, replay, persisted-rate, margin and ledger checks passed';
END
$perpetual_funding_tests$;

ROLLBACK;
