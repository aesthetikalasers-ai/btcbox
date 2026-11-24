-- BTCBOX admin manual debit may create a negative available balance.
-- Scope is deliberately narrow: only the admin_adjustment_atomic manual-debit marker
-- may cross zero. Withdrawal/freeze/earn debits retain the insufficient-funds guard.
-- Existing negative balances may be reduced by a confirmed deposit credit.
ALTER TABLE public.financial_accounts
  DROP CONSTRAINT IF EXISTS financial_accounts_available_check;
ALTER TABLE public.financial_ledger
  DROP CONSTRAINT IF EXISTS financial_ledger_available_after_check;

CREATE OR REPLACE FUNCTION public.apply_financial_operation(
  p_idempotency_key text, p_user_id text, p_asset text, p_operation_type text,
  p_available_delta numeric, p_frozen_delta numeric, p_request_hash text,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_op public.financial_operations%rowtype;
  v_available numeric(38,18);
  v_frozen numeric(38,18);
BEGIN
  IF p_idempotency_key IS NULL OR length(p_idempotency_key) < 16 OR length(p_idempotency_key) > 128
     OR p_user_id IS NULL OR p_user_id = '' OR p_asset IS NULL OR p_asset !~ '^[A-Z0-9]{2,16}$'
     OR p_operation_type NOT IN ('deposit_credit','withdraw_freeze','withdraw_approve','withdraw_reject','earn_subscribe','earn_redeem','admin_adjustment')
     OR p_request_hash IS NULL OR p_request_hash = ''
     OR p_metadata IS NULL OR jsonb_typeof(p_metadata) <> 'object'
     OR p_available_delta IS NULL OR p_frozen_delta IS NULL
     OR (p_available_delta = 0 AND p_frozen_delta = 0) THEN
    RAISE EXCEPTION 'invalid financial operation';
  END IF;

  INSERT INTO public.financial_operations(idempotency_key,user_id,asset,operation_type,request_hash,metadata)
  VALUES (p_idempotency_key,p_user_id,p_asset,p_operation_type,p_request_hash,p_metadata)
  ON CONFLICT (idempotency_key) DO NOTHING;

  SELECT * INTO v_op FROM public.financial_operations
   WHERE idempotency_key = p_idempotency_key FOR UPDATE;
  IF v_op.user_id <> p_user_id OR v_op.asset <> p_asset
     OR v_op.operation_type <> p_operation_type OR v_op.request_hash <> p_request_hash THEN
    RAISE EXCEPTION 'idempotency key payload mismatch';
  END IF;

  IF EXISTS (SELECT 1 FROM public.financial_ledger WHERE operation_id = v_op.id) THEN
    SELECT available, frozen INTO v_available, v_frozen
      FROM public.financial_accounts WHERE user_id=p_user_id AND asset=p_asset;
    RETURN jsonb_build_object('ok',true,'duplicate',true,'operation_id',v_op.id,
      'available',v_available,'frozen',v_frozen);
  END IF;

  INSERT INTO public.financial_accounts(user_id,asset)
    VALUES (p_user_id,p_asset) ON CONFLICT DO NOTHING;
  SELECT available, frozen INTO v_available, v_frozen
    FROM public.financial_accounts
   WHERE user_id=p_user_id AND asset=p_asset FOR UPDATE;

  IF (
      v_available + p_available_delta < 0
      AND NOT (
        (p_operation_type = 'admin_adjustment' AND p_available_delta < 0
          AND p_frozen_delta = 0 AND p_metadata->>'reason' = 'admin_manual_debit')
        OR
        (v_available < 0 AND p_available_delta > 0
          AND p_operation_type = 'deposit_credit' AND p_frozen_delta = 0)
      )
     )
     OR v_frozen + p_frozen_delta < 0 THEN
    RAISE EXCEPTION 'insufficient funds';
  END IF;

  UPDATE public.financial_accounts
     SET available = available + p_available_delta,
         frozen = frozen + p_frozen_delta,
         version = version + 1, updated_at = now()
   WHERE user_id=p_user_id AND asset=p_asset
   RETURNING available, frozen INTO v_available, v_frozen;

  INSERT INTO public.financial_ledger(
    operation_id,user_id,asset,available_delta,frozen_delta,available_after,frozen_after
  ) VALUES (v_op.id,p_user_id,p_asset,p_available_delta,p_frozen_delta,v_available,v_frozen);

  RETURN jsonb_build_object('ok',true,'duplicate',false,'operation_id',v_op.id,
    'available',v_available,'frozen',v_frozen);
END;
$$;

COMMENT ON FUNCTION public.apply_financial_operation(text,text,text,text,numeric,numeric,text,jsonb)
  IS 'Atomic financial movement. Negative available balances are permitted only for marked admin manual debits; other debits remain guarded.';
