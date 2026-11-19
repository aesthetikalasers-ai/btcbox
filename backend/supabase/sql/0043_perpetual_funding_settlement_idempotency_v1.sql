-- 0043_perpetual_funding_settlement_idempotency_v1.sql
-- Serialize retries for the same funding interval/user, use the persisted rate as
-- the authority, and account margin-funded payments exactly once.
CREATE OR REPLACE FUNCTION public.perp_settle_funding_one(
  p_symbol text, p_funding_at timestamptz, p_rate numeric, p_user_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_pos public.perpetual_positions%rowtype;
  v_rate public.perpetual_funding_rates%rowtype;
  v_op uuid;
  v_notional numeric(38,18);
  v_payment numeric(38,18);
  v_idem text;
  v_avail_before numeric(38,18);
  v_avail_delta numeric(38,18) := 0;
  v_frozen_delta numeric(38,18) := 0;
BEGIN
  IF coalesce(p_symbol,'')='' OR p_funding_at IS NULL OR coalesce(p_user_id,'')='' THEN
    RAISE EXCEPTION 'invalid funding settlement request';
  END IF;

  SELECT * INTO v_rate
    FROM public.perpetual_funding_rates
   WHERE symbol=p_symbol AND funding_at=p_funding_at;
  IF NOT FOUND THEN RAISE EXCEPTION 'funding rate not recorded'; END IF;

  -- The persisted funding-rate row is authoritative. Do not let a service caller
  -- settle a different rate under the same symbol/interval idempotency key.
  IF p_rate IS NULL OR p_rate IS DISTINCT FROM v_rate.rate THEN
    RAISE EXCEPTION 'funding rate does not match persisted funding rate';
  END IF;

  v_idem := 'perp-funding-'||p_symbol||'-'||floor(extract(epoch from p_funding_at))::text||'-'||p_user_id;

  -- Serialize same-key requests before checking the operation table. Without this
  -- lock, concurrent retries can both pass EXISTS, then one fails on the unique key
  -- after waiting for the position row lock instead of returning duplicate=true.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_idem, 0));
  IF EXISTS (SELECT 1 FROM public.financial_operations WHERE idempotency_key=v_idem) THEN
    RETURN jsonb_build_object('ok',true,'duplicate',true);
  END IF;

  SELECT * INTO v_pos
    FROM public.perpetual_positions
   WHERE user_id=p_user_id AND symbol=p_symbol
   FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',true,'no_position',true); END IF;

  v_notional := v_pos.quantity * coalesce(v_rate.mark_price, v_pos.entry_price);
  v_payment := CASE WHEN v_pos.side='long' THEN -v_rate.rate ELSE v_rate.rate END * v_notional;

  INSERT INTO public.financial_accounts(user_id,asset)
  VALUES (p_user_id,'USDT') ON CONFLICT DO NOTHING;
  PERFORM 1 FROM public.financial_accounts
   WHERE user_id=p_user_id AND asset='USDT' FOR UPDATE;

  INSERT INTO public.financial_operations(idempotency_key,user_id,asset,operation_type,request_hash,metadata)
  VALUES (
    v_idem,p_user_id,'USDT','perp_funding',
    encode(extensions.digest(v_idem||':'||v_payment::text,'sha256'),'hex'),
    jsonb_build_object('symbol',p_symbol,'funding_at',p_funding_at,'rate',v_rate.rate)
  )
  RETURNING id INTO v_op;

  SELECT available INTO v_avail_before
    FROM public.financial_accounts
   WHERE user_id=p_user_id AND asset='USDT';

  IF v_payment < 0 THEN
    IF v_avail_before >= -v_payment THEN
      UPDATE public.financial_accounts
         SET available=available+v_payment, version=version+1, updated_at=now()
       WHERE user_id=p_user_id AND asset='USDT';
      v_avail_delta := v_payment;
      v_frozen_delta := 0;
    ELSE
      -- Debit the remainder from isolated margin. funding_paid is updated once
      -- below for the complete payment, not again in this branch.
      DECLARE
        v_from_avail numeric(38,18) := -v_avail_before;
        v_from_margin numeric(38,18) := v_payment - v_from_avail;
      BEGIN
        UPDATE public.financial_accounts
           SET available=0, frozen=frozen+v_from_margin, version=version+1, updated_at=now()
         WHERE user_id=p_user_id AND asset='USDT' AND frozen >= -v_from_margin;
        IF NOT FOUND THEN RAISE EXCEPTION 'funding debit invariant failed'; END IF;

        UPDATE public.perpetual_positions
           SET isolated_margin=greatest(isolated_margin + v_from_margin, 0), updated_at=now()
         WHERE id=v_pos.id;

        v_avail_delta := v_from_avail;
        v_frozen_delta := v_from_margin;
      END;
    END IF;
  ELSE
    UPDATE public.financial_accounts
       SET available=available+v_payment, version=version+1, updated_at=now()
     WHERE user_id=p_user_id AND asset='USDT';
    v_avail_delta := v_payment;
    v_frozen_delta := 0;
  END IF;

  INSERT INTO public.financial_ledger(operation_id,user_id,asset,available_delta,frozen_delta,available_after,frozen_after)
  SELECT v_op,p_user_id,'USDT',v_avail_delta,v_frozen_delta,available,frozen
    FROM public.financial_accounts
   WHERE user_id=p_user_id AND asset='USDT';

  UPDATE public.perpetual_positions
     SET funding_paid=funding_paid-v_payment, last_funding_at=p_funding_at, updated_at=now()
   WHERE id=v_pos.id;

  INSERT INTO public.perpetual_funding_history(
    symbol,funding_at,user_id,position_side,position_qty,notional,payment_delta,operation_id
  )
  VALUES (p_symbol,p_funding_at,p_user_id,v_pos.side,v_pos.quantity,v_notional,v_payment,v_op);

  RETURN jsonb_build_object('ok',true,'payment_delta',v_payment);
END;
$$;

REVOKE ALL ON FUNCTION public.perp_settle_funding_one(text,timestamptz,numeric,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.perp_settle_funding_one(text,timestamptz,numeric,text)
  TO service_role;
