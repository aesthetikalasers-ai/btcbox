-- 0039_withdrawal_approve_no_burn_v1.sql
-- P0 财务 bug 修复：review_withdrawal_atomic 在 approve 时错误地将冻结资金直接扣减（available 不变、
-- frozen 减少，用户总资产凭空减少 amount+fee），而实际打款是独立的 mark_withdrawal_paid_atomic 第二步。
-- 修复：approve 仅更新状态+审计，不做任何余额变动（资金保持冻结，待 mark_withdrawal_paid_atomic 实扣）；
-- reject 维持原逻辑（冻结释放回可用）。

create or replace function public.review_withdrawal_atomic(
  p_withdrawal_id text,
  p_admin_id text,
  p_approve boolean,
  p_reason text default ''
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_w public.withdrawal_requests%rowtype;
  v_result jsonb;
  v_operation_id uuid;
  v_status text;
  v_hash text;
begin
  if coalesce(p_admin_id, '') = '' or p_approve is null then
    raise exception 'admin identity and decision required';
  end if;

  select * into v_w
  from public.withdrawal_requests
  where id = p_withdrawal_id
  for update;

  if not found then
    raise exception 'withdrawal not found';
  end if;

  if v_w.status not in ('pending', 'pending_admin_review') then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'withdrawal_id', v_w.id,
      'status', v_w.status
    );
  end if;

  v_status := case when p_approve then 'approved' else 'rejected' end;
  v_hash := encode(
    extensions.digest(v_w.id || ':' || v_status || ':' || coalesce(p_reason, ''), 'sha256'),
    'hex'
  );

  -- 修复点：approve 时 available/frozen 变动量均为 0（资金保持冻结，等待打款步骤实扣）；
  -- reject 时将冻结金额释放回可用（available += amount+fee, frozen -= amount+fee）。
  v_result := public.apply_financial_operation(
    'withdraw-review:' || v_w.id,
    v_w.user_id,
    v_w.asset,
    case when p_approve then 'withdraw_approve' else 'withdraw_reject' end,
    case when p_approve then 0 else v_w.amount + v_w.fee end,
    case when p_approve then 0 else -(v_w.amount + v_w.fee) end,
    v_hash,
    jsonb_build_object(
      'withdrawal_id', v_w.id,
      'admin_id', p_admin_id,
      'reason', left(coalesce(p_reason, ''), 200)
    )
  );
  v_operation_id := (v_result->>'operation_id')::uuid;

  update public.withdrawal_requests
  set status = v_status,
      reviewed_by = p_admin_id,
      reviewed_at = now(),
      review_operation_id = v_operation_id
  where id = v_w.id;

  insert into public.financial_audit_log (
    actor_id, subject_user_id, action, object_type, object_id, reason, metadata
  ) values (
    p_admin_id, v_w.user_id, 'withdrawal_' || v_status, 'withdrawal', v_w.id,
    left(coalesce(p_reason, ''), 200),
    jsonb_build_object(
      'asset', v_w.asset,
      'amount', v_w.amount,
      'fee', v_w.fee,
      'require_admin_review', v_w.require_admin_review
    )
  );

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'withdrawal_id', v_w.id,
    'status', v_status
  );
end;
$$;
