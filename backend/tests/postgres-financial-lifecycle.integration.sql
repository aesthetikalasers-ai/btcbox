-- Disposable PostgreSQL integration checks for the four financial write paths.
-- The caller wraps this file in a transaction and rolls it back after assertions.

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

DO $financial_tests$
DECLARE
  v_result jsonb;
  v_snapshot jsonb;
  v_hash text;
  v_balance numeric;
  v_frozen numeric;
  v_ledger_before bigint;
  v_ledger_after bigint;
  v_failed boolean;
  v_trade_count integer;
  v_position_id text := 'SC' || repeat('0',30);
  v_open_request_id text := 'seconds-open-request-0001';
  v_settle_request_id text := 'seconds-settle-request-0001';
  v_settle_hash text;
  v_payout_bps integer;
BEGIN
  -- 1) Manual deposit: exact retry is a no-op; same key with changed payload conflicts.
  v_result := pg_temp.test_credit(
    'MD-CI-0001','deposit-user','USDT',100,'deposit-ci-request-0001','deposit-ref-ci-1','postgres-ci'
  );
  IF v_result->>'ok'<>'true' OR v_result->>'duplicate'<>'false' THEN
    RAISE EXCEPTION 'first manual deposit failed: %',v_result;
  END IF;
  v_result := pg_temp.test_credit(
    'MD-CI-0002','deposit-user','USDT',100,'deposit-ci-request-0001','deposit-ref-ci-1','postgres-ci'
  );
  IF v_result->>'ok'<>'true' OR v_result->>'duplicate'<>'true' THEN
    RAISE EXCEPTION 'manual deposit exact retry was not idempotent: %',v_result;
  END IF;
  SELECT available INTO v_balance FROM public.financial_accounts
  WHERE user_id='deposit-user' AND asset='USDT';
  IF v_balance<>100 THEN RAISE EXCEPTION 'manual deposit credited more than once: %',v_balance; END IF;

  -- UI/API allow 160-character receipt references; the SQL hash must use the same full value.
  v_result := pg_temp.test_credit(
    'MD-CI-LONG-REF','long-reference-user','USDT',5,'deposit-ci-long-reference-0001',repeat('R',130),'postgres-ci'
  );
  IF v_result->>'ok'<>'true' OR v_result->>'status'<>'confirmed' THEN
    RAISE EXCEPTION 'manual deposit rejected a valid 130-character reference: %',v_result;
  END IF;
  SELECT available INTO v_balance FROM public.financial_accounts
  WHERE user_id='long-reference-user' AND asset='USDT';
  IF v_balance<>5 THEN RAISE EXCEPTION 'long-reference manual deposit ledger mismatch: %',v_balance; END IF;

  v_result := pg_temp.test_credit(
    'MD-CI-LONG-REF-RETRY','long-reference-user','USDT',5,'deposit-ci-long-reference-0001',repeat('R',130),'postgres-ci'
  );
  IF v_result->>'duplicate'<>'true' THEN
    RAISE EXCEPTION 'long-reference exact retry was not idempotent: %',v_result;
  END IF;
  SELECT available INTO v_balance FROM public.financial_accounts
  WHERE user_id='long-reference-user' AND asset='USDT';
  IF v_balance<>5 THEN RAISE EXCEPTION 'long-reference retry credited funds twice: %',v_balance; END IF;

  v_snapshot := public.read_financial_account_snapshot_v1('long-reference-user');
  IF jsonb_array_length(v_snapshot->'deposits')<>1 THEN
    RAISE EXCEPTION 'account snapshot did not return exactly one manual deposit: %',v_snapshot->'deposits';
  END IF;
  IF v_snapshot->'deposits'->0->>'status'<>'confirmed' OR
     v_snapshot->'deposits'->0->>'reference'<>repeat('R',130) OR
     (v_snapshot->'deposits'->0->>'amount')::numeric<>5 OR
     (v_snapshot->'balances'->'USDT'->>'free')::numeric<>5 THEN
    RAISE EXCEPTION 'account snapshot deposit history and balance do not match: %',v_snapshot;
  END IF;

  v_failed := false;
  BEGIN
    PERFORM pg_temp.test_credit(
      'MD-CI-0003','deposit-user','USDT',101,'deposit-ci-request-0001','deposit-ref-ci-1','postgres-ci'
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'manual deposit accepted same request ID with changed amount'; END IF;

  -- 2) Withdrawal: freeze, approve, mark paid without a second debit, and reject/refund.
  v_hash := encode(extensions.digest(
    'deposit-user|USDT|TRC20|10|T12345678|withdrawal-ci-request-0001','sha256'
  ),'hex');
  v_result := public.create_withdrawal_atomic(
    'WD-CI-0001','deposit-user','USDT','TRC20',10,1,'T12345678',
    'withdrawal-ci-request-0001',v_hash,false,1
  );
  IF v_result->>'ok'<>'true' OR v_result->>'duplicate'<>'false' THEN
    RAISE EXCEPTION 'withdrawal creation failed: %',v_result;
  END IF;

  -- Current fee changed to 2, but the exact old request must replay its stored fee of 1.
  v_result := public.create_withdrawal_atomic(
    'WD-CI-RETRY','deposit-user','USDT','TRC20',10,2,'T12345678',
    'withdrawal-ci-request-0001',v_hash,false,2
  );
  IF v_result->>'duplicate'<>'true' OR (v_result->>'fee')::numeric<>1 THEN
    RAISE EXCEPTION 'withdrawal retry did not preserve its original fee snapshot: %',v_result;
  END IF;

  SELECT available,frozen INTO v_balance,v_frozen FROM public.financial_accounts
  WHERE user_id='deposit-user' AND asset='USDT';
  IF v_balance<>89 OR v_frozen<>11 THEN
    RAISE EXCEPTION 'withdrawal freeze mismatch: available %, frozen %',v_balance,v_frozen;
  END IF;

  -- Capture ledger count before approval to prove that approval itself is non-financial.
  SELECT count(*) INTO v_ledger_before FROM public.financial_ledger WHERE user_id='deposit-user';
  v_result := public.review_withdrawal_atomic('WD-CI-0001','admin-ci',true,'postgres-ci approve');
  IF v_result->>'status'<>'approved' OR v_result->>'duplicate'<>'false' THEN
    RAISE EXCEPTION 'withdrawal approval failed: %',v_result;
  END IF;
  v_result := public.review_withdrawal_atomic('WD-CI-0001','admin-ci',true,'postgres-ci approve');
  IF v_result->>'status'<>'approved' OR v_result->>'duplicate'<>'true' THEN
    RAISE EXCEPTION 'withdrawal approval retry was not idempotent: %',v_result;
  END IF;

  -- Approval is status-only: preserve the user's full reserved amount and create no ledger row.
  SELECT count(*) INTO v_ledger_after FROM public.financial_ledger WHERE user_id='deposit-user';
  IF v_ledger_after<>v_ledger_before THEN
    RAISE EXCEPTION 'approval must not create a financial ledger row';
  END IF;
  SELECT available,frozen INTO v_balance,v_frozen FROM public.financial_accounts
  WHERE user_id='deposit-user' AND asset='USDT';
  IF v_balance<>89 OR v_frozen<>11 THEN
    RAISE EXCEPTION 'approval changed reserved funds: available %, frozen %',v_balance,v_frozen;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.withdrawal_requests
    WHERE id='WD-CI-0001' AND review_operation_id=freeze_operation_id
  ) THEN
    RAISE EXCEPTION 'approved withdrawal is not linked to its original freeze operation';
  END IF;

  -- Staff payout completion is the single, idempotent ledger debit of frozen funds.
  SELECT count(*) INTO v_ledger_before FROM public.financial_ledger WHERE user_id='deposit-user';
  v_result := public.mark_withdrawal_paid_atomic('WD-CI-0001','admin-ci','txid-ci-0001','postgres-ci payout');
  IF v_result->>'status'<>'completed' OR v_result->>'duplicate'<>'false' THEN
    RAISE EXCEPTION 'manual payout completion failed: %',v_result;
  END IF;
  v_result := public.mark_withdrawal_paid_atomic('WD-CI-0001','admin-ci','txid-ci-0001','postgres-ci payout');
  IF v_result->>'status'<>'completed' OR v_result->>'duplicate'<>'true' THEN
    RAISE EXCEPTION 'manual payout retry was not idempotent: %',v_result;
  END IF;
  SELECT count(*) INTO v_ledger_after FROM public.financial_ledger WHERE user_id='deposit-user';
  IF v_ledger_after<>v_ledger_before+1 THEN
    RAISE EXCEPTION 'manual payout must create exactly one debit ledger operation';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.financial_operations o
    JOIN public.withdrawal_requests w ON w.payout_operation_id=o.id
    WHERE w.id='WD-CI-0001' AND o.operation_type='withdraw_paid'
  ) THEN
    RAISE EXCEPTION 'completed withdrawal is not linked to its withdraw_paid ledger operation';
  END IF;
  SELECT available,frozen INTO v_balance,v_frozen FROM public.financial_accounts
  WHERE user_id='deposit-user' AND asset='USDT';
  IF v_balance<>89 OR v_frozen<>0 THEN
    RAISE EXCEPTION 'manual payout changed balance after approval: available %, frozen %',v_balance,v_frozen;
  END IF;

  PERFORM pg_temp.test_credit(
    'MD-CI-0004','reject-user','USDT',20,'deposit-ci-request-0002','deposit-ref-ci-2','postgres-ci'
  );
  v_hash := encode(extensions.digest(
    'reject-user|USDT|TRC20|5|T87654321|withdrawal-ci-request-0002','sha256'
  ),'hex');
  v_result := public.create_withdrawal_atomic(
    'WD-CI-0002','reject-user','USDT','TRC20',5,1,'T87654321',
    'withdrawal-ci-request-0002',v_hash,false,1
  );
  IF v_result->>'ok'<>'true' THEN RAISE EXCEPTION 'rejected withdrawal creation failed: %',v_result; END IF;
  v_result := public.review_withdrawal_atomic('WD-CI-0002','admin-ci',false,'postgres-ci reject');
  IF v_result->>'status'<>'rejected' THEN RAISE EXCEPTION 'withdrawal rejection failed: %',v_result; END IF;
  SELECT available,frozen INTO v_balance,v_frozen FROM public.financial_accounts
  WHERE user_id='reject-user' AND asset='USDT';
  IF v_balance<>20 OR v_frozen<>0 THEN
    RAISE EXCEPTION 'withdrawal rejection did not refund exactly once: available %, frozen %',v_balance,v_frozen;
  END IF;

  -- 3) Spot: match at maker price, then cancel with durable request-key binding.
  PERFORM pg_temp.test_credit(
    'MD-CI-0005','spot-seller','BTC',1,'deposit-ci-request-0003','deposit-ref-ci-3','postgres-ci'
  );
  PERFORM pg_temp.test_credit(
    'MD-CI-0006','spot-buyer','USDT',20000,'deposit-ci-request-0004','deposit-ref-ci-4','postgres-ci'
  );
  INSERT INTO public.financial_matching_markets(
    base_asset,quote_asset,enabled,price_tick,quantity_step,min_quantity,min_notional
  ) VALUES('BTC','USDT',true,1,0.001,0.001,1)
  ON CONFLICT(base_asset,quote_asset) DO UPDATE SET enabled=true;

  v_result := public.submit_limit_order_matching_v1(
    'SPOT-SELL-0001','spot-seller','BTC','USDT','sell',10000,0.1,'spot-sell-request-0001'
  );
  IF v_result->>'ok'<>'true' THEN RAISE EXCEPTION 'spot maker order failed: %',v_result; END IF;
  v_result := public.submit_limit_order_matching_v1(
    'SPOT-BUY-0001','spot-buyer','BTC','USDT','buy',10000,0.1,'spot-buy-request-0001'
  );
  IF v_result->>'ok'<>'true' THEN RAISE EXCEPTION 'spot taker order failed: %',v_result; END IF;

  SELECT count(*) INTO v_trade_count FROM public.financial_matching_trades
  WHERE pair_key='BTC/USDT';
  IF v_trade_count<>1 THEN RAISE EXCEPTION 'spot matching did not create exactly one trade: %',v_trade_count; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.financial_matching_orders WHERE id='SPOT-SELL-0001' AND status='filled')
     OR NOT EXISTS (SELECT 1 FROM public.financial_matching_orders WHERE id='SPOT-BUY-0001' AND status='filled') THEN
    RAISE EXCEPTION 'spot matching did not close both fully-filled orders';
  END IF;
  SELECT available INTO v_balance FROM public.financial_accounts
  WHERE user_id='spot-buyer' AND asset='BTC';
  IF v_balance<>0.1 THEN RAISE EXCEPTION 'spot buyer did not receive base asset: %',v_balance; END IF;
  SELECT available INTO v_balance FROM public.financial_accounts
  WHERE user_id='spot-seller' AND asset='USDT';
  IF v_balance<>1000 THEN RAISE EXCEPTION 'spot seller did not receive quote asset: %',v_balance; END IF;

  v_result := public.submit_limit_order_matching_v1(
    'SPOT-CANCEL-0001','spot-buyer','BTC','USDT','buy',9000,0.05,'spot-cancel-order-0001'
  );
  IF v_result->>'ok'<>'true' THEN RAISE EXCEPTION 'spot cancellable order creation failed: %',v_result; END IF;
  v_result := public.cancel_limit_order_matching_v1('spot-buyer','SPOT-CANCEL-0001','spot-cancel-request-0001');
  IF v_result->>'duplicate'<>'false' OR v_result->>'status'<>'cancelled' THEN
    RAISE EXCEPTION 'first spot cancellation failed: %',v_result;
  END IF;
  v_result := public.cancel_limit_order_matching_v1('spot-buyer','SPOT-CANCEL-0001','spot-cancel-request-0001');
  IF v_result->>'duplicate'<>'true' OR v_result->>'status'<>'cancelled' THEN
    RAISE EXCEPTION 'spot cancellation replay failed: %',v_result;
  END IF;

  v_result := public.submit_limit_order_matching_v1(
    'SPOT-CANCEL-0002','spot-buyer','BTC','USDT','buy',9000,0.05,'spot-cancel-order-0002'
  );
  IF v_result->>'ok'<>'true' THEN RAISE EXCEPTION 'second spot cancellable order creation failed: %',v_result; END IF;
  v_failed := false;
  BEGIN
    PERFORM public.cancel_limit_order_matching_v1('spot-buyer','SPOT-CANCEL-0002','spot-cancel-request-0001');
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'spot cancellation key was reused for a different order'; END IF;
  SELECT available,frozen INTO v_balance,v_frozen FROM public.financial_accounts
  WHERE user_id='spot-buyer' AND asset='USDT';
  IF v_balance<>18550 OR v_frozen<>450 THEN
    RAISE EXCEPTION 'conflicting spot cancel changed reserved funds: available %, frozen %',v_balance,v_frozen;
  END IF;

  -- 4) Admin market configuration: owner bootstrap, permission gate, audit and replay safety.
  INSERT INTO auth.users(id) VALUES('00000000-0000-4000-8000-000000000001')
  ON CONFLICT(id) DO NOTHING;
  PERFORM private.bootstrap_super_admin_v1(
    '00000000-0000-4000-8000-000000000001',
    'disposable PostgreSQL integration test',
    'CI-TEST-ONLY'
  );
  v_failed := false;
  BEGIN
    PERFORM public.admin_set_spot_market_v1(
      '00000000-0000-4000-8000-000000000001',
      'BTC','USDC',true,1,0.001,0.001,1,NULL,NULL,
      'reject non-USDT quote pair in disposable test',
      'spot-market-non-usdt-quote-0001',repeat('f',64)
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'admin spot market accepted an unsupported non-USDT quote pair';
  END IF;

  v_result := public.admin_set_spot_market_v1(
    '00000000-0000-4000-8000-000000000001',
    'BTC','USDT',true,1,0.001,0.001,1,NULL,NULL,
    'enable spot market in disposable test',
    'spot-market-config-request-0001',repeat('a',64)
  );
  IF v_result->>'ok'<>'true' OR v_result->>'replayed'<>'false'
     OR v_result->'market'->>'enabled'<>'true' THEN
    RAISE EXCEPTION 'admin spot market configuration failed: %',v_result;
  END IF;
  v_result := public.admin_set_spot_market_v1(
    '00000000-0000-4000-8000-000000000001',
    'BTC','USDT',true,1,0.001,0.001,1,NULL,NULL,
    'enable spot market in disposable test',
    'spot-market-config-request-0001',repeat('a',64)
  );
  IF v_result->>'replayed'<>'true' THEN
    RAISE EXCEPTION 'admin spot market exact replay was not idempotent: %',v_result;
  END IF;

  -- Rule changes must not reinterpret the still-open resting order.
  v_failed := false;
  BEGIN
    PERFORM public.admin_set_spot_market_v1(
      '00000000-0000-4000-8000-000000000001',
      'BTC','USDT',true,2,0.001,0.001,1,NULL,NULL,
      'attempt precision change while a resting order exists',
      'spot-market-rule-change-0001',repeat('e',64)
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'admin spot market changed price tick while resting orders existed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.financial_matching_markets
    WHERE base_asset='BTC' AND quote_asset='USDT' AND enabled=true AND price_tick=1
  ) THEN
    RAISE EXCEPTION 'rejected spot rule change modified the active market';
  END IF;

  v_failed := false;
  BEGIN
    PERFORM public.admin_set_spot_market_v1(
      '00000000-0000-4000-8000-000000000001',
      'BTC','USDT',false,1,0.001,0.001,1,NULL,NULL,
      'conflicting reuse in disposable test',
      'spot-market-config-request-0001',repeat('b',64)
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'admin spot market accepted a changed payload for an existing request ID'; END IF;
  v_result := public.admin_set_spot_market_v1(
    '00000000-0000-4000-8000-000000000001',
    'BTC','USDT',false,1,0.001,0.001,1,NULL,NULL,
    'disable spot market in disposable test',
    'spot-market-config-request-0002',repeat('c',64)
  );
  IF v_result->'market'->>'enabled'<>'false' THEN
    RAISE EXCEPTION 'admin spot market disable did not persist: %',v_result;
  END IF;
  -- A previously committed order must replay even after the market is paused.
  v_result := public.submit_limit_order_matching_v1(
    'SPOT-SELL-0001','spot-seller','BTC','USDT','sell',10000,0.1,'spot-sell-request-0001'
  );
  IF v_result->>'duplicate'<>'true' OR v_result->>'status'<>'filled' THEN
    RAISE EXCEPTION 'exact spot order retry failed after market pause: %',v_result;
  END IF;

  -- 5) Seconds: reserve, snapshot payout policy, settle after maturity, exact replay.
  PERFORM pg_temp.test_credit(
    'MD-CI-0007','seconds-user','USDT',100,'deposit-ci-request-0005','deposit-ref-ci-5','postgres-ci'
  );
  v_hash := encode(extensions.digest(
    'seconds-user|BTC|up|10|30|'||v_open_request_id,'sha256'
  ),'hex');
  v_result := public.submit_seconds_order_v1(
    v_position_id,'seconds-user','BTC','up',10,30,100,v_open_request_id,v_hash
  );
  IF v_result->>'ok'<>'true' OR v_result->>'duplicate'<>'false' THEN
    RAISE EXCEPTION 'Seconds order submission failed: %',v_result;
  END IF;
  v_result := public.submit_seconds_order_v1(
    v_position_id,'seconds-user','BTC','up',10,30,NULL,v_open_request_id,v_hash
  );
  IF v_result->>'ok'<>'true' OR v_result->>'duplicate'<>'true' THEN
    RAISE EXCEPTION 'Seconds order replay did not return persisted position: %',v_result;
  END IF;

  -- Change the active policy after this position opened. Its 85% snapshot must remain immutable.
  v_result := public.admin_set_seconds_policy_v1(
    '00000000-0000-4000-8000-000000000001',
    1,
    ARRAY['BTC','ETH','SOL','BNB']::text[],
    ARRAY[30,60,120,300,900]::integer[],
    0.000000000000000001,
    1000000000000,
    9200,
    NULL,
    NULL,
    'Raise the payout rate for new positions in disposable PostgreSQL test',
    'seconds-policy-request-0001',
    repeat('d',64)
  );
  IF v_result->>'ok'<>'true' OR v_result->'policy'->>'payout_bps'<>'9200' THEN
    RAISE EXCEPTION 'Seconds policy update to 92%% failed: %',v_result;
  END IF;

  UPDATE public.seconds_contract_positions
  SET settle_at=clock_timestamp()-interval '1 second'
  WHERE position_id=v_position_id;
  SELECT payout_bps_snapshot INTO v_payout_bps
  FROM public.seconds_contract_positions WHERE position_id=v_position_id;
  IF v_payout_bps<>8500 THEN RAISE EXCEPTION 'Seconds order did not snapshot the active payout policy: %',v_payout_bps; END IF;

  v_settle_hash := encode(extensions.digest(v_settle_request_id||'|'||v_position_id,'sha256'),'hex');
  v_result := public.settle_seconds_position_v1(
    v_position_id,'seconds-user',v_settle_request_id,v_settle_hash,
    'BTC',110,'coinbase',clock_timestamp()
  );
  IF v_result->>'settled'<>'true' OR v_result->>'win'<>'true' OR (v_result->>'pnl')::numeric<>8.5 THEN
    RAISE EXCEPTION 'Seconds settlement did not use the 85%% policy snapshot: %',v_result;
  END IF;
  SELECT available,frozen INTO v_balance,v_frozen FROM public.financial_accounts
  WHERE user_id='seconds-user' AND asset='USDT';
  IF v_balance<>108.5 OR v_frozen<>0 THEN
    RAISE EXCEPTION 'Seconds settlement balance mismatch: available %, frozen %',v_balance,v_frozen;
  END IF;
  v_result := public.settle_seconds_position_v1(
    v_position_id,'seconds-user',v_settle_request_id,v_settle_hash,
    'BTC',NULL,NULL,NULL
  );
  IF v_result->>'duplicate'<>'true' OR v_result->>'settled'<>'true' THEN
    RAISE EXCEPTION 'Seconds settlement replay required a live quote after completion: %',v_result;
  END IF;
  v_result := public.settle_seconds_position_v1(
    v_position_id,'seconds-user',v_settle_request_id,encode(extensions.digest('conflicting-settlement','sha256'),'hex'),
    'BTC',110,'coinbase',clock_timestamp()
  );
  IF v_result->>'code'<>'IDEMPOTENCY_CONFLICT' THEN
    RAISE EXCEPTION 'Seconds settlement accepted a conflicting request hash: %',v_result;
  END IF;

  -- A position opened after the policy change must snapshot 92%, not inherit 85%.
  v_result := public.submit_seconds_order_v1(
    'SC111111111111111111111111111111','seconds-user','BTC','up',10,120,100,
    'seconds-open-request-0002',
    encode(extensions.digest('seconds-user|BTC|up|10|120|seconds-open-request-0002','sha256'),'hex')
  );
  IF v_result->>'ok'<>'true' OR v_result->>'duplicate'<>'false' THEN
    RAISE EXCEPTION 'Seconds order under updated policy failed: %',v_result;
  END IF;
  UPDATE public.seconds_contract_positions
  SET settle_at=clock_timestamp()-interval '1 second'
  WHERE position_id='SC111111111111111111111111111111';
  SELECT payout_bps_snapshot INTO v_payout_bps
  FROM public.seconds_contract_positions
  WHERE position_id='SC111111111111111111111111111111';
  IF v_payout_bps<>9200 THEN
    RAISE EXCEPTION 'new Seconds position did not snapshot 92%% payout: %',v_payout_bps;
  END IF;
  v_result := public.settle_seconds_position_v1(
    'SC111111111111111111111111111111','seconds-user',
    'seconds-settle-request-0002',
    encode(extensions.digest('seconds-settle-request-0002|SC111111111111111111111111111111','sha256'),'hex'),
    'BTC',110,'coinbase',clock_timestamp()
  );
  IF v_result->>'settled'<>'true' OR v_result->>'win'<>'true'
     OR (v_result->>'pnl')::numeric<>9.2 THEN
    RAISE EXCEPTION 'Seconds settlement did not use the new 92%% snapshot: %',v_result;
  END IF;
  SELECT available,frozen INTO v_balance,v_frozen FROM public.financial_accounts
  WHERE user_id='seconds-user' AND asset='USDT';
  IF v_balance<>117.7 OR v_frozen<>0 THEN
    RAISE EXCEPTION 'updated-policy Seconds settlement balance mismatch: available %, frozen %',v_balance,v_frozen;
  END IF;
  v_result := public.settle_seconds_position_v1(
    'SC111111111111111111111111111111','seconds-user',
    'seconds-settle-request-0002',
    encode(extensions.digest('seconds-settle-request-0002|SC111111111111111111111111111111','sha256'),'hex'),
    'BTC',110,'coinbase',clock_timestamp()
  );
  IF v_result->>'duplicate'<>'true' THEN
    RAISE EXCEPTION 'updated-policy Seconds settlement replay was not idempotent: %',v_result;
  END IF;
  RAISE NOTICE 'BTCBOX deposit, withdrawal, spot, admin-market and multi-policy Seconds RPC integration checks passed';
END
$financial_tests$;

ROLLBACK;
