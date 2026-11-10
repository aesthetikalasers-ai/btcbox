-- 0039_withdrawal_approve_no_burn_v1.sql
-- Approval is a decision only: it must not move balances. The original withdrawal
-- freeze remains reserved until staff records the external payout. Payout completion
-- then debits the frozen amount exactly once through the financial ledger.
-- Rejection releases the reservation exactly once.

ALTER TABLE public.financial_operations
  DROP CONSTRAINT IF EXISTS financial_operations_operation_type_check;
ALTER TABLE public.financial_operations
  ADD CONSTRAINT financial_operations_operation_type_check
  CHECK (operation_type IN (
    'deposit_credit','withdraw_freeze','withdraw_approve','withdraw_reject',
    'withdraw_paid','earn_subscribe','earn_redeem','admin_adjustment','migration_opening_balance'
  ));

ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS payout_operation_id uuid REFERENCES public.financial_operations(id);

CREATE OR REPLACE FUNCTION public.apply_financial_operation(
  p_idempotency_key text,
  p_user_id text,
  p_asset text,
  p_operation_type text,
  p_available_delta numeric,
  p_frozen_delta numeric,
  p_request_hash text,
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
     OR p_operation_type NOT IN ('deposit_credit','withdraw_freeze','withdraw_approve','withdraw_reject','withdraw_paid','earn_subscribe','earn_redeem','admin_adjustment')
     OR p_request_hash IS NULL OR p_request_hash = ''
     OR p_metadata IS NULL OR jsonb_typeof(p_metadata) <> 'object'
     OR p_available_delta IS NULL OR p_frozen_delta IS NULL
     OR (p_available_delta = 0 AND p_frozen_delta = 0) THEN
    RAISE EXCEPTION 'invalid financial operation';
  END IF;

  INSERT INTO public.financial_operations(idempotency_key,user_id,asset,operation_type,request_hash,metadata)
  VALUES (p_idempotency_key,p_user_id,p_asset,p_operation_type,p_request_hash,p_metadata)
  ON CONFLICT (idempotency_key) DO NOTHING;

  SELECT * INTO v_op FROM public.financial_operations WHERE idempotency_key = p_idempotency_key FOR UPDATE;
  IF v_op.user_id <> p_user_id OR v_op.asset <> p_asset OR v_op.operation_type <> p_operation_type OR v_op.request_hash <> p_request_hash THEN
    RAISE EXCEPTION 'idempotency key payload mismatch';
  END IF;
  IF EXISTS (SELECT 1 FROM public.financial_ledger WHERE operation_id = v_op.id) THEN
    SELECT available,frozen INTO v_available,v_frozen
    FROM public.financial_accounts WHERE user_id=p_user_id AND asset=p_asset;
    RETURN jsonb_build_object('ok',true,'duplicate',true,'operation_id',v_op.id,'available',v_available,'frozen',v_frozen);
  END IF;

  INSERT INTO public.financial_accounts(user_id,asset) VALUES (p_user_id,p_asset) ON CONFLICT DO NOTHING;
  SELECT available,frozen INTO v_available,v_frozen
  FROM public.financial_accounts WHERE user_id=p_user_id AND asset=p_asset FOR UPDATE;
  IF v_available + p_available_delta < 0 OR v_frozen + p_frozen_delta < 0 THEN
    RAISE EXCEPTION 'insufficient funds';
  END IF;
  UPDATE public.financial_accounts
  SET available=available+p_available_delta,
      frozen=frozen+p_frozen_delta,
      version=version+1,
      updated_at=now()
  WHERE user_id=p_user_id AND asset=p_asset
  RETURNING available,frozen INTO v_available,v_frozen;

  INSERT INTO public.financial_ledger(operation_id,user_id,asset,available_delta,frozen_delta,available_after,frozen_after)
  VALUES (v_op.id,p_user_id,p_asset,p_available_delta,p_frozen_delta,v_available,v_frozen);
  RETURN jsonb_build_object('ok',true,'duplicate',false,'operation_id',v_op.id,'available',v_available,'frozen',v_frozen);
END;
$$;

CREATE OR REPLACE FUNCTION public.review_withdrawal_atomic(
  p_withdrawal_id text,
  p_admin_id text,
  p_approve boolean,
  p_reason text DEFAULT ''
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_w public.withdrawal_requests%rowtype;
  v_result jsonb;
  v_operation_id uuid;
  v_status text;
  v_hash text;
BEGIN
  IF coalesce(p_admin_id,'')='' OR p_approve IS NULL THEN
    RAISE EXCEPTION 'admin identity and decision required';
  END IF;

  SELECT * INTO v_w FROM public.withdrawal_requests WHERE id=p_withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'withdrawal not found'; END IF;

  IF v_w.status NOT IN ('pending','pending_admin_review') THEN
    RETURN jsonb_build_object('ok',true,'duplicate',true,'withdrawal_id',v_w.id,'status',v_w.status);
  END IF;

  v_status := CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END;
  v_hash := encode(extensions.digest(v_w.id || ':' || v_status || ':' || coalesce(p_reason,''),'sha256'),'hex');

  IF p_approve THEN
    -- Approval is non-financial. Link the existing freeze operation for traceability;
    -- do not create a zero-delta ledger operation or release/debit the reservation.
    v_operation_id := v_w.freeze_operation_id;
    IF v_operation_id IS NULL THEN
      RAISE EXCEPTION 'withdrawal freeze operation missing';
    END IF;
  ELSE
    -- Rejection releases the exact reserved amount and fee in one idempotent operation.
    v_result := public.apply_financial_operation(
      'withdraw-review:' || v_w.id,v_w.user_id,v_w.asset,'withdraw_reject',
      v_w.amount+v_w.fee,-(v_w.amount+v_w.fee),v_hash,
      jsonb_build_object('withdrawal_id',v_w.id,'admin_id',p_admin_id,'reason',left(coalesce(p_reason,''),200))
    );
    v_operation_id := (v_result->>'operation_id')::uuid;
  END IF;

  UPDATE public.withdrawal_requests
  SET status=v_status,reviewed_by=p_admin_id,reviewed_at=now(),review_operation_id=v_operation_id
  WHERE id=v_w.id;

  INSERT INTO public.financial_audit_log(actor_id,subject_user_id,action,object_type,object_id,reason,metadata)
  VALUES(p_admin_id,v_w.user_id,'withdrawal_'||v_status,'withdrawal',v_w.id,
    left(coalesce(p_reason,''),200),
    jsonb_build_object('asset',v_w.asset,'amount',v_w.amount,'fee',v_w.fee,
      'require_admin_review',v_w.require_admin_review,'freeze_operation_id',v_w.freeze_operation_id));

  RETURN jsonb_build_object('ok',true,'duplicate',false,'withdrawal_id',v_w.id,'status',v_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_withdrawal_paid_atomic(
  p_withdrawal_id text,
  p_admin_id text,
  p_reference text DEFAULT '',
  p_note text DEFAULT ''
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_w public.withdrawal_requests%rowtype;
  v_ref text := left(btrim(coalesce(p_reference,'')),160);
  v_note text := left(btrim(coalesce(p_note,'')),300);
  v_result jsonb;
  v_operation_id uuid;
  v_hash text;
BEGIN
  IF coalesce(p_withdrawal_id,'')='' OR length(p_withdrawal_id)>100
     OR coalesce(p_admin_id,'')='' OR length(p_admin_id)>128
     OR coalesce(btrim(p_reference),'')='' OR length(coalesce(p_reference,''))>160
     OR coalesce(p_reference,'') ~ '[[:cntrl:]]'
     OR length(coalesce(p_note,''))>300 THEN
    RAISE EXCEPTION 'invalid manual payout completion request';
  END IF;

  SELECT * INTO v_w FROM public.withdrawal_requests WHERE id=p_withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'withdrawal not found'; END IF;

  IF v_w.status='completed' THEN
    IF coalesce(v_w.payout_reference,'')<>v_ref THEN
      RAISE EXCEPTION 'withdrawal already completed with a different payout reference';
    END IF;
    RETURN jsonb_build_object('ok',true,'duplicate',true,'withdrawal_id',v_w.id,
      'status',v_w.status,'payout_reference',coalesce(v_w.payout_reference,''),'paid_at',v_w.paid_at);
  END IF;
  IF v_w.status<>'approved' THEN
    RAISE EXCEPTION 'withdrawal must be approved before manual payout completion';
  END IF;

  v_hash := encode(extensions.digest(v_w.id || ':' || v_ref || ':' || v_note,'sha256'),'hex');
  v_result := public.apply_financial_operation(
    'withdraw-paid:' || v_w.id,v_w.user_id,v_w.asset,'withdraw_paid',
    0,-(v_w.amount+v_w.fee),v_hash,
    jsonb_build_object('withdrawal_id',v_w.id,'admin_id',p_admin_id,
      'payout_reference',v_ref,'payout_note',v_note)
  );
  v_operation_id := (v_result->>'operation_id')::uuid;

  UPDATE public.withdrawal_requests
  SET status='completed',payout_reference=v_ref,payout_note=v_note,
      paid_by=p_admin_id,paid_at=clock_timestamp(),payout_operation_id=v_operation_id
  WHERE id=v_w.id;

  INSERT INTO public.financial_audit_log(actor_id,subject_user_id,action,object_type,object_id,reason,metadata)
  VALUES(p_admin_id,v_w.user_id,'withdrawal_manual_payout_completed','withdrawal',v_w.id,v_note,
    jsonb_build_object('asset',v_w.asset,'amount',v_w.amount,'fee',v_w.fee,
      'network',v_w.network,'destination',v_w.destination,'payout_reference',v_ref,
      'payout_operation_id',v_operation_id));

  RETURN jsonb_build_object('ok',true,'duplicate',false,'withdrawal_id',v_w.id,
    'status','completed','payout_reference',v_ref,'paid_at',clock_timestamp());
END;
$$;

REVOKE ALL ON FUNCTION public.apply_financial_operation(text,text,text,text,numeric,numeric,text,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.review_withdrawal_atomic(text,text,boolean,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mark_withdrawal_paid_atomic(text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_financial_operation(text,text,text,text,numeric,numeric,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.review_withdrawal_atomic(text,text,boolean,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_withdrawal_paid_atomic(text,text,text,text) TO service_role;
