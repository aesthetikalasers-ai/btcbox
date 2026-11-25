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
$;

CREATE OR REPLACE FUNCTION pg_temp.fail_withdrawal_approval_audit()
RETURNS trigger
LANGUAGE plpgsql
AS $
BEGIN
  IF NEW.action = 'withdrawal_approved' AND NEW.object_id = 'WD-CI-ROLLBACK' THEN
    RAISE EXCEPTION 'simulated withdrawal approval audit failure';
  END IF;
  RETURN NEW;
END;
$;

DROP TRIGGER IF EXISTS ci_fail_withdrawal_approval_audit ON public.financial_audit_log;
CREATE TRIGGER ci_fail_withdrawal_approval_audit
BEFORE INSERT ON public.financial_audit_log
FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_withdrawal_approval_audit();

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

  -- Approval atomically consumes the frozen principal + fee exactly once.
  SELECT count(*) INTO v_ledger_before FROM public.financial_ledger WHERE user_id='deposit-user';
  v_result := public.review_withdrawal_atomic('WD-CI-0001','admin-ci',true,'postgres-ci approve');
  IF v_result->>'status'<>'approved' OR v_result->>'duplicate'<>'false' THEN
    RAISE EXCEPTION 'withdrawal approval failed: %',v_result;
  END IF;
  v_result := public.review_withdrawal_atomic('WD-CI-0001','admin-ci',true,'postgres-ci approve');
  IF v_result->>'status'<>'approved' OR v_result->>'duplicate'<>'true' THEN
    RAISE EXCEPTION 'withdrawal approval retry was not idempotent: %',v_result;
  END IF;
  SELECT count(*) INTO v_ledger_after FROM public.financial_ledger WHERE user_id='deposit-user';
  IF v_ledger_after<>v_ledger_before+1 THEN
    RAISE EXCEPTION 'approval must create exactly one financial ledger operation';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.financial_operations o
    JOIN public.withdrawal_requests w ON w.review_operation_id=o.id
    WHERE w.id='WD-CI-0001' AND o.operation_type='withdraw_approve'
  ) THEN
    RAISE EXCEPTION 'approved withdrawal is not linked to a withdraw_approve operation';
  END IF;
  SELECT available,frozen INTO v_balance,v_frozen FROM public.financial_accounts
  WHERE user_id='deposit-user' AND asset='USDT';
  IF v_balance<>89 OR v_frozen<>0 THEN
    RAISE EXCEPTION 'approval did not consume frozen funds: available %, frozen %',v_balance,v_frozen;
  END IF;

  -- Staff payout completion records status/reference only and never debits again.
  SELECT count(*) INTO v_ledger_before FROM public.financial_ledger WHERE user_id='deposit-user';
  v_result := public.mark_withdrawal_paid_atomic('WD-CI-0001','admin-ci','internal-ref-ci-0001','postgres-ci payout');
  IF v_result->>'status'<>'completed' OR v_result->>'duplicate'<>'false' THEN
    RAISE EXCEPTION 'manual payout completion failed: %',v_result;
  END IF;
  v_result := public.mark_withdrawal_paid_atomic('WD-CI-0001','admin-ci','internal-ref-ci-0001','postgres-ci payout');
  IF v_result->>'status'<>'completed' OR v_result->>'duplicate'<>'true' THEN
    RAISE EXCEPTION 'manual payout retry was not idempotent: %',v_result;
  END IF;
  SELECT count(*) INTO v_ledger_after FROM public.financial_ledger WHERE user_id='deposit-user';
  IF v_ledger_after<>v_ledger_before THEN
    RAISE EXCEPTION 'manual payout completion must not create a second ledger operation';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.withdrawal_requests
    WHERE id='WD-CI-0001' AND status='completed'
      AND payout_reference='internal-ref-ci-0001' AND payout_operation_id IS NULL
  ) THEN
    RAISE EXCEPTION 'manual payout completion did not persist only the internal reference/status';
  END IF;
  SELECT available,frozen INTO v_balance,v_frozen FROM public.financial_accounts
  WHERE user_id='deposit-user' AND asset='USDT';
  IF v_balance<>89 OR v_frozen<>0 THEN
    RAISE EXCEPTION 'manual payout completion changed funds after approval: available %, frozen %',v_balance,v_frozen;
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
  IF v_result->>'status'<>'rejected' OR v_result->>'duplicate'<>'false' THEN
    RAISE EXCEPTION 'withdrawal rejection failed: %',v_result;
  END IF;
  v_result := public.review_withdrawal_atomic('WD-CI-0002','admin-ci',false,'postgres-ci reject');
  IF v_result->>'status'<>'rejected' OR v_result->>'duplicate'<>'true' THEN
    RAISE EXCEPTION 'withdrawal rejection retry was not idempotent: %',v_result;
  END IF;
  SELECT available,frozen INTO v_balance,v_frozen FROM public.financial_accounts
  WHERE user_id='reject-user' AND asset='USDT';
  IF v_balance<>20 OR v_frozen<>0 THEN
    RAISE EXCEPTION 'withdrawal rejection did not refund exactly once: available %, frozen %',v_balance,v_frozen;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.financial_operations o
    JOIN public.withdrawal_requests w ON w.review_operation_id=o.id
    WHERE w.id='WD-CI-0002' AND o.operation_type='withdraw_reject'
  ) THEN
    RAISE EXCEPTION 'rejected withdrawal is not linked to its withdraw_reject operation';
  END IF;

  -- Cursor history: records are user-scoped, stable across pages, and expose only customer-safe review details.
  v_hash := encode(extensions.digest(
    'deposit-user|USDT|TRC20|2|T12345678|withdrawal-ci-request-0003','sha256'
  ),'hex');
  v_result := public.create_withdrawal_atomic(
    'WD-CI-0003','deposit-user','USDT','TRC20',2,1,'T12345678',
    'withdrawal-ci-request-0003',v_hash,true,1
  );
  IF v_result->>'ok'<>'true' THEN RAISE EXCEPTION 'paginated withdrawal creation failed: %',v_result; END IF;
  v_result := public.review_withdrawal_atomic('WD-CI-0003','admin-ci',false,'cursor pagination reject reason');
  IF v_result->>'status'<>'rejected' THEN RAISE EXCEPTION 'paginated withdrawal rejection failed: %',v_result; END IF;

  v_snapshot := public.read_withdrawal_history_page_v1('deposit-user',NULL,NULL,1);
  IF v_snapshot->>'ok'<>'true' OR v_snapshot->>'has_more'<>'true'
     OR jsonb_array_length(v_snapshot->'withdrawals')<>1
     OR v_snapshot->'withdrawals'->0->>'id'<>'WD-CI-0003'
     OR v_snapshot->'withdrawals'->0->>'rejection_reason'<>'cursor pagination reject reason'
     OR coalesce(v_snapshot->'withdrawals'->0->>'reviewed_at','')='' THEN
    RAISE EXCEPTION 'first withdrawal history page did not return the newest customer-safe row and cursor: %',v_snapshot;
  END IF;
  v_snapshot := public.read_withdrawal_history_page_v1(
    'deposit-user',
    (v_snapshot->'next_cursor'->>'created_at')::timestamptz,
    v_snapshot->'next_cursor'->>'id',
    1
  );
  IF v_snapshot->>'ok'<>'true' OR v_snapshot->>'has_more'<>'false'
     OR jsonb_array_length(v_snapshot->'withdrawals')<>1
     OR v_snapshot->'withdrawals'->0->>'id'<>'WD-CI-0001'
     OR v_snapshot->'withdrawals'->0->>'status'<>'completed' THEN
    RAISE EXCEPTION 'second withdrawal history page did not continue after the stable cursor: %',v_snapshot;
  END IF;
  v_snapshot := public.read_withdrawal_history_page_v1('unrelated-user',NULL,NULL,20);
  IF jsonb_array_length(v_snapshot->'withdrawals')<>0 THEN
    RAISE EXCEPTION 'withdrawal history returned another user records: %',v_snapshot;
  END IF;

  -- A failed approval audit must roll back the approval ledger debit and status update.
  PERFORM pg_temp.test_credit(
    'MD-CI-ROLLBACK','rollback-user','USDT',30,'deposit-ci-rollback-0001','rollback-credit','postgres-ci'
  );
  v_hash := encode(extensions.digest(
    'rollback-user|USDT|TRC20|5|T12345678|withdrawal-ci-rollback-0001','sha256'
  ),'hex');
  v_result := public.create_withdrawal_atomic(
    'WD-CI-ROLLBACK','rollback-user','USDT','TRC20',5,1,'T12345678',
    'withdrawal-ci-rollback-0001',v_hash,true,1
  );
  IF v_result->>'ok'<>'true' THEN RAISE EXCEPTION 'rollback fixture withdrawal creation failed: %',v_result; END IF;
  v_failed := false;
  BEGIN
    PERFORM public.review_withdrawal_atomic('WD-CI-ROLLBACK','admin-ci',true,'rollback audit failure');
  EXCEPTION WHEN OTHERS THEN
    v_failed := SQLERRM LIKE '%simulated withdrawal approval audit failure%';
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'approval unexpectedly succeeded when its audit insert failed'; END IF;
  SELECT available,frozen INTO v_balance,v_frozen FROM public.financial_accounts
  WHERE user_id='rollback-user' AND asset='USDT';
  IF v_balance<>24 OR v_frozen<>6 THEN
    RAISE EXCEPTION 'approval audit failure did not roll back the debit: available %, frozen %',v_balance,v_frozen;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.withdrawal_requests
    WHERE id='WD-CI-ROLLBACK' AND status='pending_admin_review'
  ) OR EXISTS (
    SELECT 1 FROM public.financial_operations
    WHERE idempotency_key='withdraw-approve:WD-CI-ROLLBACK'
  ) THEN
    RAISE EXCEPTION 'approval audit failure left a partial status or ledger operation';
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


-- Perpetual settlement: execute real RPCs in this disposable, rolled-back PostgreSQL transaction.
DO $perpetual_settlement_tests$
DECLARE
  v_at timestamptz := clock_timestamp()-interval '1 second';
  v_ts text := floor(extract(epoch from clock_timestamp())*1000)::text;
  v_result jsonb;
  v_balance numeric;
  v_frozen numeric;
  v_margin numeric;
  v_paid numeric;
  v_rows integer;
  v_debit numeric;
  v_credit numeric;
  v_failed boolean := false;
  v_bad_debt numeric;
  v_insurance numeric;
BEGIN
  INSERT INTO public.perpetual_markets(
    symbol,base_asset,quote_asset,enabled,status,price_tick,quantity_step,min_quantity,
    market_quantity_step,market_min_quantity,max_position_notional,
    funding_interval_sec,funding_rate_cap,mark_price_stale_sec,next_funding_at
  ) VALUES ('BTCUSDT','BTC','USDT',true,'trading',0.01,0.001,0.001,0.01,0.01,1000000,28800,0.0075,300,v_at)
  ON CONFLICT(symbol) DO UPDATE SET enabled=true,status='trading',
    market_quantity_step=excluded.market_quantity_step,market_min_quantity=excluded.market_min_quantity,
    max_position_notional=excluded.max_position_notional,
    funding_interval_sec=28800,funding_rate_cap=0.0075,mark_price_stale_sec=300,next_funding_at=excluded.next_funding_at;

  PERFORM pg_temp.test_credit('MD-PERP-L','perp-long-ci','USDT',1000,'perp-long-credit-0001','long-ref','perp CI');
  PERFORM pg_temp.test_credit('MD-PERP-S','perp-short-ci','USDT',1000,'perp-short-credit-0001','short-ref','perp CI');
  UPDATE public.financial_accounts SET available=available-100,frozen=frozen+100
   WHERE user_id IN ('perp-long-ci','perp-short-ci') AND asset='USDT';
  INSERT INTO public.perpetual_positions(user_id,symbol,side,quantity,entry_price,isolated_margin)
  VALUES ('perp-long-ci','BTCUSDT','long',1,1000,100),('perp-short-ci','BTCUSDT','short',1,1000,100);
  INSERT INTO public.perpetual_mark_price_feed(
    symbol,index_price,mark_price,sources,source_count,max_deviation_pct,status
  ) VALUES ('BTCUSDT',1000,1000,jsonb_build_array(
    jsonb_build_object('source','binance','price','1000','ts',v_ts),
    jsonb_build_object('source','okx','price','1001','ts',v_ts)),2,0.1,'ok');
  v_result := public.perp_record_funding_rate_snapshot('BTCUSDT',v_at,1001,1002);
  IF v_result->>'ok'<>'true' OR v_result->>'formula_version'<>'btcbox-funding-v1'
     OR (v_result->>'rate')::numeric<>0.001
     OR (v_result->>'premium_index')::numeric<>0.0015 THEN
    RAISE EXCEPTION 'fixed funding formula producer returned an unexpected snapshot: %',v_result;
  END IF;
  v_result := public.perp_settle_funding_market('BTCUSDT',v_at);
  IF v_result->>'ok'<>'true' OR (v_result->>'settled')::integer<>2 THEN
    RAISE EXCEPTION 'funding batch failed: %',v_result;
  END IF;
  SELECT available,frozen INTO v_balance,v_frozen FROM public.financial_accounts WHERE user_id='perp-long-ci' AND asset='USDT';
  SELECT isolated_margin,funding_paid INTO v_margin,v_paid FROM public.perpetual_positions WHERE user_id='perp-long-ci' AND symbol='BTCUSDT';
  IF v_balance<>899 OR v_frozen<>100 OR v_margin<>100 OR v_paid<>1 THEN
    RAISE EXCEPTION 'long positive-rate payment mismatch: %, %, %, %',v_balance,v_frozen,v_margin,v_paid;
  END IF;
  SELECT available,frozen INTO v_balance,v_frozen FROM public.financial_accounts WHERE user_id='perp-short-ci' AND asset='USDT';
  SELECT isolated_margin,funding_paid INTO v_margin,v_paid FROM public.perpetual_positions WHERE user_id='perp-short-ci' AND symbol='BTCUSDT';
  IF v_balance<>901 OR v_frozen<>100 OR v_margin<>100 OR v_paid<>-1 THEN
    RAISE EXCEPTION 'short positive-rate receipt mismatch: %, %, %, %',v_balance,v_frozen,v_margin,v_paid;
  END IF;
  SELECT count(*) INTO v_rows FROM public.perpetual_funding_history WHERE symbol='BTCUSDT' AND funding_at=v_at;
  SELECT coalesce(sum(payment_delta),0),coalesce(sum(clearing_delta),0) INTO v_debit,v_credit
   FROM public.perpetual_funding_clearing_ledger WHERE symbol='BTCUSDT' AND funding_at=v_at;
  IF v_rows<>2 OR v_debit<>0 OR v_credit<>0 THEN
    RAISE EXCEPTION 'funding history/clearing mismatch: rows %, payment sum %, clearing sum %',v_rows,v_debit,v_credit;
  END IF;
  v_result := public.perp_settle_funding_market('BTCUSDT',v_at);
  IF v_result->>'stale_boundary'<>'true' THEN RAISE EXCEPTION 'funding replay not rejected: %',v_result; END IF;
  SELECT count(*) INTO v_rows FROM public.perpetual_funding_history WHERE symbol='BTCUSDT' AND funding_at=v_at;
  IF v_rows<>2 THEN RAISE EXCEPTION 'funding replay duplicated history'; END IF;

  -- Missing snapshot must fail and preserve the due boundary.
  v_at := clock_timestamp()-interval '1 second';
  UPDATE public.perpetual_markets SET next_funding_at=v_at WHERE symbol='BTCUSDT';
  BEGIN
    PERFORM public.perp_settle_funding_market('BTCUSDT',v_at);
  EXCEPTION WHEN OTHERS THEN
    v_failed := SQLERRM LIKE '%validated funding rate snapshot missing%';
  END;
  IF NOT v_failed OR (SELECT next_funding_at FROM public.perpetual_markets WHERE symbol='BTCUSDT')<>v_at THEN
    RAISE EXCEPTION 'missing funding snapshot did not fail closed without advancing boundary';
  END IF;

  -- A market with no positions must not advance its funding boundary on a
  -- stale or unversioned snapshot: no financial_operations row would exist to
  -- invoke the per-operation guard, so the snapshot settlement trigger is vital.
  v_at := clock_timestamp()-interval '1 second';
  v_ts := floor(extract(epoch from clock_timestamp())*1000)::text;
  INSERT INTO public.perpetual_markets(
    symbol,base_asset,quote_asset,enabled,status,price_tick,quantity_step,min_quantity,
    market_quantity_step,market_min_quantity,max_position_notional,
    maintenance_margin_rate,funding_interval_sec,funding_rate_cap,mark_price_stale_sec,next_funding_at
  ) VALUES ('SOLUSDT','SOL','USDT',true,'trading',0.001,0.001,0.001,0.001,0.001,1000000,0.005,28800,0.0075,300,v_at)
  ON CONFLICT(symbol) DO UPDATE SET enabled=true,status='trading',
    market_quantity_step=excluded.market_quantity_step,market_min_quantity=excluded.market_min_quantity,
    max_position_notional=excluded.max_position_notional,funding_interval_sec=28800,
    funding_rate_cap=0.0075,mark_price_stale_sec=300,next_funding_at=excluded.next_funding_at;
  IF EXISTS (SELECT 1 FROM public.perpetual_positions WHERE symbol='SOLUSDT' AND closed_at IS NULL) THEN
    RAISE EXCEPTION 'no-position funding guard fixture unexpectedly has an open position';
  END IF;
  INSERT INTO public.perpetual_funding_rates(
    symbol,funding_at,rate,premium_index,mark_price,index_price,sources,settled,
    formula_version,interest_rate,impact_bid_price,impact_ask_price,calculated_at
  ) VALUES ('SOLUSDT',v_at,0.001,0.0015,1000,1000,jsonb_build_array(
    jsonb_build_object('source','binance','price','1000','ts',v_ts),
    jsonb_build_object('source','okx','price','1001','ts',v_ts)),false,
    'btcbox-funding-v1',0.0001,1001,1002,clock_timestamp()-interval '3 minutes')
  ON CONFLICT(symbol,funding_at) DO UPDATE SET
    rate=excluded.rate,premium_index=excluded.premium_index,mark_price=excluded.mark_price,
    index_price=excluded.index_price,sources=excluded.sources,settled=false,
    formula_version=excluded.formula_version,interest_rate=excluded.interest_rate,
    impact_bid_price=excluded.impact_bid_price,impact_ask_price=excluded.impact_ask_price,
    calculated_at=excluded.calculated_at;
  v_failed := false;
  BEGIN
    PERFORM public.perp_settle_funding_market('SOLUSDT',v_at);
  EXCEPTION WHEN OTHERS THEN
    v_failed := SQLERRM LIKE '%fresh btcbox-funding-v1 snapshot%';
  END;
  IF NOT v_failed
     OR (SELECT next_funding_at FROM public.perpetual_markets WHERE symbol='SOLUSDT')<>v_at
     OR (SELECT settled FROM public.perpetual_funding_rates WHERE symbol='SOLUSDT' AND funding_at=v_at) IS TRUE THEN
    RAISE EXCEPTION 'no-position stale funding snapshot advanced or settled the market boundary';
  END IF;

  -- Liquidation must settle the due short-side funding credit first, then reload and close.
  v_at := clock_timestamp()-interval '1 second';
  v_ts := floor(extract(epoch from clock_timestamp())*1000)::text;
  INSERT INTO public.perpetual_markets(
    symbol,base_asset,quote_asset,enabled,status,price_tick,quantity_step,min_quantity,
    market_quantity_step,market_min_quantity,max_position_notional,
    maintenance_margin_rate,funding_interval_sec,funding_rate_cap,mark_price_stale_sec,next_funding_at
  ) VALUES ('ETHUSDT','ETH','USDT',true,'trading',0.01,0.001,0.001,0.001,0.001,1000000,0.005,28800,0.0075,300,v_at)
  ON CONFLICT(symbol) DO UPDATE SET enabled=true,status='trading',maintenance_margin_rate=0.005,
    market_quantity_step=excluded.market_quantity_step,market_min_quantity=excluded.market_min_quantity,
    max_position_notional=excluded.max_position_notional,
    funding_interval_sec=28800,funding_rate_cap=0.0075,mark_price_stale_sec=300,next_funding_at=excluded.next_funding_at;
  PERFORM pg_temp.test_credit('MD-PERP-LIQ','perp-liq-ci','USDT',100,'perp-liq-credit-0001','liq-ref','perp CI');
  UPDATE public.financial_accounts SET available=available-10,frozen=frozen+10 WHERE user_id='perp-liq-ci' AND asset='USDT';
  INSERT INTO public.perpetual_positions(user_id,symbol,side,quantity,entry_price,isolated_margin)
  VALUES ('perp-liq-ci','ETHUSDT','short',1,1000,10);
  INSERT INTO public.perpetual_funding_rates(
    symbol,funding_at,rate,premium_index,mark_price,index_price,sources,
    formula_version,interest_rate,impact_bid_price,impact_ask_price,calculated_at
  ) VALUES ('ETHUSDT',v_at,0.001,0.0015,1200,1000,jsonb_build_array(
    jsonb_build_object('source','binance','price','1000','ts',v_ts),
    jsonb_build_object('source','okx','price','1001','ts',v_ts)),
    'btcbox-funding-v1',0.0001,1001,1002,clock_timestamp());
  INSERT INTO public.perpetual_mark_price_feed(symbol,index_price,mark_price,sources,source_count,max_deviation_pct,status)
  VALUES ('ETHUSDT',1000,1200,jsonb_build_array(
    jsonb_build_object('source','binance','price','1000','ts',v_ts),
    jsonb_build_object('source','okx','price','1001','ts',v_ts)),2,20,'degraded');
  v_result := public.perp_liquidate_position('perp-liq-ci','ETHUSDT');
  IF v_result->>'ok'<>'true' OR v_result->>'liquidated'<>'true' THEN
    RAISE EXCEPTION 'funding-before-liquidation RPC failed: %',v_result;
  END IF;
  SELECT available,frozen INTO v_balance,v_frozen FROM public.financial_accounts WHERE user_id='perp-liq-ci' AND asset='USDT';
  IF v_balance<>91.2 OR v_frozen<>0 THEN RAISE EXCEPTION 'funding was not credited before liquidation: %, %',v_balance,v_frozen; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.perpetual_funding_history WHERE symbol='ETHUSDT' AND user_id='perp-liq-ci' AND payment_delta=1.2) THEN
    RAISE EXCEPTION 'liquidation path omitted funding settlement';
  END IF;
  SELECT bad_debt,insurance_cover INTO v_bad_debt,v_insurance FROM public.perpetual_liquidation_events WHERE user_id='perp-liq-ci' AND symbol='ETHUSDT';
  IF v_bad_debt<>190 OR v_insurance<>0 THEN RAISE EXCEPTION 'liquidation waterfall mismatch: %, %',v_bad_debt,v_insurance; END IF;
  SELECT coalesce(sum(j.debit),0),coalesce(sum(j.credit),0) INTO v_debit,v_credit
   FROM public.perpetual_liquidation_journal j JOIN public.perpetual_liquidation_events e ON e.id=j.event_id
   WHERE e.user_id='perp-liq-ci' AND e.symbol='ETHUSDT';
  IF v_debit<>200 OR v_credit<>200 THEN RAISE EXCEPTION 'liquidation journal not balanced: %, %',v_debit,v_credit; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.perpetual_position_history WHERE user_id='perp-liq-ci' AND symbol='ETHUSDT' AND funding_paid=-1.2 AND close_reason='liquidation') THEN
    RAISE EXCEPTION 'liquidation history did not retain funding result';
  END IF;
  RAISE NOTICE 'Perpetual PostgreSQL settlement, idempotency, fail-closed rollback and funding-before-liquidation checks passed';
END
$perpetual_settlement_tests$;

DO $perpetual_order_filter_tests$
DECLARE
  v_result jsonb;
  v_failed boolean;
BEGIN
  UPDATE public.perpetual_markets
     SET min_notional=20, market_quantity_step=0.01, market_min_quantity=0.01,
         max_position_notional=1000000
   WHERE symbol='BTCUSDT';
  PERFORM pg_temp.test_credit('MD-PERP-ORD','perp-order-ci','USDT',1000,'perp-order-credit-0001','order-ref','perp order filter CI');

  -- Opening market orders must follow MARKET_LOT_SIZE, not the limit LOT_SIZE.
  v_failed := false;
  BEGIN
    PERFORM public.perp_submit_order(
      'perp-market-bad-lot','perp-order-ci','BTCUSDT','market','buy',null,0.005,2,false,false,
      'perp-market-badlot-0001'
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := SQLERRM LIKE '%market quantity precision invalid%';
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'opening market order bypassed MARKET_LOT_SIZE step'; END IF;

  -- A correctly stepped market order still fails when mark-price notional is below min_notional.
  v_failed := false;
  BEGIN
    PERFORM public.perp_submit_order(
      'perp-market-below-notional','perp-order-ci','BTCUSDT','market','buy',null,0.01,2,false,false,
      'perp-market-minnotional-0001'
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := SQLERRM LIKE '%order notional below market minimum%';
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'opening market order bypassed minimum notional'; END IF;

  -- Limit orders use LOT_SIZE and are not forced to align with MARKET_LOT_SIZE.
  v_result := public.perp_submit_order(
    'perp-limit-valid','perp-order-ci','BTCUSDT','limit','buy',4000,0.005,2,false,false,
    'perp-limit-filter-0001'
  );
  IF v_result->>'ok'<>'true' OR NOT EXISTS (
    SELECT 1 FROM public.perpetual_orders WHERE id='perp-limit-valid' AND status='open'
  ) THEN
    RAISE EXCEPTION 'limit order did not use regular LOT_SIZE: %',v_result;
  END IF;

  -- Market order with valid market lot and notional is accepted (IOC may cancel unfilled remainder).
  v_result := public.perp_submit_order(
    'perp-market-valid','perp-order-ci','BTCUSDT','market','buy',null,0.02,2,false,false,
    'perp-market-valid-0001'
  );
  IF v_result->>'ok'<>'true' THEN RAISE EXCEPTION 'valid market order rejected: %',v_result; END IF;

  -- A paused/disabled market and a position smaller than MARKET_LOT_SIZE must
  -- still permit a full-position reduce-only close.
  INSERT INTO public.perpetual_positions(user_id,symbol,side,quantity,entry_price,isolated_margin)
  VALUES ('perp-order-ci','BTCUSDT','long',0.005,1000,0.05);
  UPDATE public.perpetual_markets SET enabled=false,status='paused' WHERE symbol='BTCUSDT';
  v_result := public.perp_submit_order(
    'perp-close-dust','perp-order-ci','BTCUSDT','market','sell',null,0.001,2,false,true,
    'perp-close-dust-0001'
  );
  IF v_result->>'ok'<>'true' THEN RAISE EXCEPTION 'full-position close was blocked by paused market or lot minimum: %',v_result; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.perpetual_orders
     WHERE id='perp-close-dust' AND quantity=0.005 AND close_position=true AND reduce_only=true
  ) THEN
    RAISE EXCEPTION 'full-position close did not persist exact position quantity';
  END IF;
  RAISE NOTICE 'Perpetual order filter, minimum notional, exposure cap and emergency close checks passed';
END
$perpetual_order_filter_tests$;

ROLLBACK;
