-- 0040_consolidate_production_state_v1.sql
-- Consolidates all production-applied fixes (rounds 1-3) into one idempotent migration.
-- Supersedes the broken repo 0039. Safe to run on a fresh db reset to reproduce production.
-- Applied 2026-11-10. All statements idempotent (CREATE OR REPLACE / ADD IF NOT EXISTS / ON CONFLICT).

BEGIN;

-- 1. financial_operations operation_type CHECK constraint (recreated to include all direct-insert types)
ALTER TABLE public.financial_operations DROP CONSTRAINT IF EXISTS financial_operations_operation_type_check;
ALTER TABLE public.financial_operations ADD CONSTRAINT financial_operations_operation_type_check
  CHECK (operation_type = ANY (ARRAY[
    'deposit_credit','withdraw_freeze','withdraw_approve','withdraw_reject','withdraw_settle',
    'earn_subscribe','earn_redeem','admin_adjustment',
    'spot_order_reserve','spot_trade','spot_order_cancel',
    'seconds_open','seconds_settle'
  ]::text[]));

-- 2. apply_financial_operation: add withdraw_settle to allowed op types
CREATE OR REPLACE FUNCTION public.apply_financial_operation(
  p_idempotency_key text, p_user_id text, p_asset text, p_operation_type text,
  p_available_delta numeric, p_frozen_delta numeric, p_request_hash text,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
declare
  v_op public.financial_operations%rowtype;
  v_available numeric(38,18); v_frozen numeric(38,18); v_operation_id uuid;
begin
  if p_idempotency_key is null or length(p_idempotency_key) < 16 or length(p_idempotency_key) > 128
     or p_user_id is null or p_user_id = '' or p_asset is null or p_asset !~ '^[A-Z0-9]{2,16}$'
     or p_operation_type not in ('deposit_credit','withdraw_freeze','withdraw_approve','withdraw_reject','withdraw_settle','earn_subscribe','earn_redeem','admin_adjustment')
     or p_request_hash is null or p_request_hash = ''
     or p_metadata is null or jsonb_typeof(p_metadata) <> 'object'
     or p_available_delta is null or p_frozen_delta is null
     or (p_available_delta = 0 and p_frozen_delta = 0) then
    raise exception 'invalid financial operation';
  end if;
  insert into public.financial_operations(idempotency_key,user_id,asset,operation_type,request_hash,metadata)
  values (p_idempotency_key,p_user_id,p_asset,p_operation_type,p_request_hash,p_metadata)
  on conflict (idempotency_key) do nothing;
  select * into v_op from public.financial_operations where idempotency_key = p_idempotency_key for update;
  if v_op.user_id <> p_user_id or v_op.asset <> p_asset or v_op.operation_type <> p_operation_type or v_op.request_hash <> p_request_hash then
    raise exception 'idempotency key payload mismatch';
  end if;
  if exists (select 1 from public.financial_ledger where operation_id = v_op.id) then
    select available, frozen into v_available, v_frozen from public.financial_accounts where user_id=p_user_id and asset=p_asset;
    return jsonb_build_object('ok',true,'duplicate',true,'operation_id',v_op.id,'available',v_available,'frozen',v_frozen);
  end if;
  insert into public.financial_accounts(user_id,asset) values (p_user_id,p_asset) on conflict do nothing;
  select available, frozen into v_available, v_frozen from public.financial_accounts where user_id=p_user_id and asset=p_asset for update;
  if v_available + p_available_delta < 0 or v_frozen + p_frozen_delta < 0 then raise exception 'insufficient funds'; end if;
  update public.financial_accounts set available = available + p_available_delta, frozen = frozen + p_frozen_delta, version = version + 1, updated_at = now()
   where user_id=p_user_id and asset=p_asset returning available, frozen into v_available, v_frozen;
  insert into public.financial_ledger(operation_id,user_id,asset,available_delta,frozen_delta,available_after,frozen_after)
  values (v_op.id,p_user_id,p_asset,p_available_delta,p_frozen_delta,v_available,v_frozen);
  return jsonb_build_object('ok',true,'duplicate',false,'operation_id',v_op.id,'available',v_available,'frozen',v_frozen);
end;
$$;

-- 3. review_withdrawal_atomic: approve = status+audit only (funds stay frozen); reject = release frozen
CREATE OR REPLACE FUNCTION public.review_withdrawal_atomic(
  p_withdrawal_id text, p_admin_id text, p_approve boolean, p_reason text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
declare
  v_w public.withdrawal_requests%rowtype; v_result jsonb; v_operation_id uuid; v_status text; v_hash text;
begin
  if coalesce(p_admin_id, '') = '' or p_approve is null then raise exception 'admin identity and decision required'; end if;
  select * into v_w from public.withdrawal_requests where id = p_withdrawal_id for update;
  if not found then raise exception 'withdrawal not found'; end if;
  if v_w.status not in ('pending', 'pending_admin_review') then
    return jsonb_build_object('ok', true, 'duplicate', true, 'withdrawal_id', v_w.id, 'status', v_w.status);
  end if;
  v_status := case when p_approve then 'approved' else 'rejected' end;
  v_hash := encode(extensions.digest(v_w.id || ':' || v_status || ':' || coalesce(p_reason, ''), 'sha256'), 'hex');
  if p_approve then
    v_operation_id := null;  -- no balance movement on approve; funds remain frozen until payout
  else
    v_result := public.apply_financial_operation(
      'withdraw-review:' || v_w.id, v_w.user_id, v_w.asset, 'withdraw_reject',
      v_w.amount + v_w.fee, -(v_w.amount + v_w.fee), v_hash,
      jsonb_build_object('withdrawal_id', v_w.id, 'admin_id', p_admin_id, 'reason', left(coalesce(p_reason, ''), 200)));
    v_operation_id := (v_result->>'operation_id')::uuid;
  end if;
  update public.withdrawal_requests set status = v_status, reviewed_by = p_admin_id, reviewed_at = now(), review_operation_id = v_operation_id where id = v_w.id;
  insert into public.financial_audit_log (actor_id, subject_user_id, action, object_type, object_id, reason, metadata)
  values (p_admin_id, v_w.user_id, 'withdrawal_' || v_status, 'withdrawal', v_w.id, left(coalesce(p_reason, ''), 200),
          jsonb_build_object('asset', v_w.asset, 'amount', v_w.amount, 'fee', v_w.fee));
  return jsonb_build_object('ok', true, 'duplicate', false, 'withdrawal_id', v_w.id, 'status', v_status);
end;
$$;

-- 4. mark_withdrawal_paid_atomic: deduct frozen at payout confirmation (idempotent), then complete
CREATE OR REPLACE FUNCTION public.mark_withdrawal_paid_atomic(
  p_withdrawal_id text, p_admin_id text, p_reference text DEFAULT '', p_note text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_w public.withdrawal_requests%rowtype;
  v_ref text := left(btrim(coalesce(p_reference,'')),160);
  v_note text := left(btrim(coalesce(p_note,'')),300);
  v_result jsonb; v_hash text;
BEGIN
  IF coalesce(p_withdrawal_id,'')='' OR length(p_withdrawal_id)>100
     OR coalesce(p_admin_id,'')='' OR length(p_admin_id)>128
     OR coalesce(btrim(p_reference),'')='' OR length(coalesce(p_reference,''))>160
     OR coalesce(p_reference,'') ~ '[[:cntrl:]]' OR length(coalesce(p_note,''))>300 THEN
    RAISE EXCEPTION 'invalid manual payout completion request';
  END IF;
  SELECT * INTO v_w FROM public.withdrawal_requests WHERE id=p_withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'withdrawal not found'; END IF;
  IF v_w.status='completed' THEN
    IF coalesce(v_w.payout_reference,'')<>v_ref THEN RAISE EXCEPTION 'withdrawal already completed with a different payout reference'; END IF;
    RETURN jsonb_build_object('ok',true,'duplicate',true,'withdrawal_id',v_w.id,'status',v_w.status,'payout_reference',coalesce(v_w.payout_reference,''),'paid_at',v_w.paid_at);
  END IF;
  IF v_w.status<>'approved' THEN RAISE EXCEPTION 'withdrawal must be approved before manual payout completion'; END IF;
  v_hash := encode(extensions.digest(v_w.id || ':withdraw_settle:' || v_ref, 'sha256'), 'hex');
  v_result := public.apply_financial_operation(
    'withdraw-paid:' || v_w.id, v_w.user_id, v_w.asset, 'withdraw_settle',
    0, -(v_w.amount + v_w.fee), v_hash,
    jsonb_build_object('withdrawal_id', v_w.id, 'admin_id', p_admin_id, 'payout_reference', v_ref, 'network', v_w.network, 'destination', v_w.destination));
  UPDATE public.withdrawal_requests SET status='completed', payout_reference=v_ref, payout_note=v_note, paid_by=p_admin_id, paid_at=clock_timestamp() WHERE id=v_w.id;
  INSERT INTO public.financial_audit_log(actor_id,subject_user_id,action,object_type,object_id,reason,metadata)
  VALUES (p_admin_id,v_w.user_id,'withdrawal_manual_payout_completed','withdrawal',v_w.id,v_note,
    jsonb_build_object('asset',v_w.asset,'amount',v_w.amount,'fee',v_w.fee,'network',v_w.network,'destination',v_w.destination,'payout_reference',v_ref,'settle_operation_id',(v_result->>'operation_id')::uuid));
  RETURN jsonb_build_object('ok',true,'duplicate',(v_result->>'duplicate')::boolean,'withdrawal_id',v_w.id,'status','completed','payout_reference',v_ref,'paid_at',clock_timestamp(),'available_after',(v_result->>'available')::numeric,'frozen_after',(v_result->>'frozen')::numeric);
END;
$$;

-- 5. withdrawal_requests: add test_voided status + missing columns (require_admin_review, request_hash) from 0022/0038
ALTER TABLE public.withdrawal_requests ADD COLUMN IF NOT EXISTS require_admin_review boolean NOT NULL DEFAULT false;
ALTER TABLE public.withdrawal_requests ADD COLUMN IF NOT EXISTS request_hash text;
ALTER TABLE public.withdrawal_requests DROP CONSTRAINT IF EXISTS withdrawal_requests_status_check;
ALTER TABLE public.withdrawal_requests ADD CONSTRAINT withdrawal_requests_status_check
  CHECK (status = ANY (ARRAY['pending','pending_admin_review','approved','rejected','broadcast','failed','completed','test_voided']::text[]));

-- 6. 0038 first-withdrawal review guard (create_withdrawal_atomic 11-param) + drop old 9-param overload
DROP FUNCTION IF EXISTS public.create_withdrawal_atomic(text,text,text,text,numeric,numeric,text,text,text);
-- (0038 function body follows in repo file 0038_withdrawal_first_successful_review_guard_v1.sql; applied separately)

-- 7. private.admin_permission_catalog seed (0026 INSERT that was missing)
INSERT INTO private.admin_permission_catalog(permission_key,module_key) VALUES
 ('dashboard.read','dashboard'),
 ('users.read','users'),('users.manage','users'),('users.freeze','users'),
 ('kyc.read','kyc'),('kyc.review','kyc'),
 ('deposits.read','deposits'),('deposits.review','deposits'),
 ('payout_addresses.read_sensitive','payout_addresses'),('payout_addresses.manage','payout_addresses'),
 ('withdrawals.read','withdrawals'),('withdrawals.review','withdrawals'),
 ('orders.read','orders'),
 ('support.read','support'),('support.reply','support'),('support.manage','support'),
 ('announcements.read','announcements'),('announcements.manage','announcements'),
 ('system_config.read','system_config'),('system_config.write','system_config'),
 ('seconds_policy.read','seconds_policy'),('seconds_policy.manage','seconds_policy'),
 ('financial_audit.read','financial_audit'),
 ('financial_adjustment.request','financial_adjustment')
ON CONFLICT (permission_key) DO NOTHING;

-- 8. private.admin_list_memberships_v1: include super_admin in list (was filtered out by is_super_admin=false)
CREATE OR REPLACE FUNCTION private.admin_list_memberships_v1(p_actor_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','private' AS $$
DECLARE v_admins jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM private.admin_memberships WHERE user_id=p_actor_user_id AND status='active' AND is_super_admin=true) THEN
    RAISE EXCEPTION 'Super Admin authority required';
  END IF;
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'user_id',m.user_id,'status',m.status,'is_super_admin',m.is_super_admin,
      'revision',m.revision,'created_at',m.created_at,'updated_at',m.updated_at,
      'permissions', CASE WHEN m.is_super_admin THEN
        (SELECT coalesce(jsonb_agg(permission_key ORDER BY permission_key),'[]'::jsonb) FROM private.admin_permission_catalog)
      ELSE coalesce((
        SELECT jsonb_agg(latest.permission_key ORDER BY latest.permission_key)
        FROM (SELECT DISTINCT ON (e.permission_key) e.permission_key,e.event_type
              FROM private.admin_permission_events e WHERE e.target_user_id=m.user_id
              ORDER BY e.permission_key,e.event_id DESC) latest
        WHERE latest.event_type='grant'),'[]'::jsonb) END
    ) ORDER BY m.is_super_admin DESC, m.created_at DESC
  ),'[]'::jsonb) INTO v_admins FROM private.admin_memberships m;
  RETURN jsonb_build_object('ok',true,'admins',v_admins);
END;
$$;

COMMIT;
