-- BTCBOX withdrawal admin-review extension.
-- Extends the canonical withdrawal_requests lifecycle from 0003.
-- Staging-only until the complete migration chain and financial concurrency tests pass.

-- Preserve the existing table and add explicit, auditable idempotency metadata.
alter table public.withdrawal_requests
  add column if not exists require_admin_review boolean not null default false,
  add column if not exists request_hash text;

-- 0002 creates this canonical inline CHECK as withdrawal_requests_status_check.
-- Drop only that known constraint; never remove unrelated status-related checks.
alter table public.withdrawal_requests
  drop constraint if exists withdrawal_requests_status_check;
alter table public.withdrawal_requests
  add constraint withdrawal_requests_status_check
  check (status in ('pending', 'pending_admin_review', 'approved', 'rejected', 'broadcast', 'failed'));

create index if not exists withdrawal_requests_review_queue_idx
  on public.withdrawal_requests (status, created_at desc)
  where status in ('pending', 'pending_admin_review');

-- Remove the legacy 9-argument function before installing the single canonical
-- 10-argument signature. This prevents PostgREST overload ambiguity.
drop function if exists public.create_withdrawal_atomic(text,text,text,text,numeric,numeric,text,text,text);

create function public.create_withdrawal_atomic(
  p_withdrawal_id text,
  p_user_id text,
  p_asset text,
  p_network text,
  p_amount numeric,
  p_fee numeric,
  p_destination text,
  p_request_id text,
  p_request_hash text,
  p_require_admin_review boolean default false
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing public.withdrawal_requests%rowtype;
  v_result jsonb;
  v_operation_id uuid;
  v_status text;
begin
  if coalesce(p_withdrawal_id, '') = ''
     or coalesce(p_user_id, '') = ''
     or coalesce(p_asset, '') !~ '^[A-Z0-9]{2,16}$'
     or coalesce(p_network, '') = ''
     or p_amount is null or p_amount <= 0
     or p_fee is null or p_fee < 0
     or length(coalesce(p_destination, '')) < 8
     or length(coalesce(p_request_id, '')) < 16
     or length(coalesce(p_request_id, '')) > 128
     or coalesce(p_request_hash, '') !~ '^[a-f0-9]{64}$'
     or p_require_admin_review is null then
    raise exception 'invalid withdrawal request';
  end if;

  select * into v_existing
  from public.withdrawal_requests
  where request_id = p_request_id
  for update;

  if found then
    if v_existing.user_id is distinct from p_user_id
       or v_existing.asset is distinct from p_asset
       or v_existing.network is distinct from p_network
       or v_existing.amount is distinct from p_amount
       or v_existing.fee is distinct from p_fee
       or v_existing.destination is distinct from p_destination
       or (v_existing.request_hash is not null and v_existing.request_hash is distinct from p_request_hash)
       or v_existing.require_admin_review is distinct from p_require_admin_review then
      raise exception 'idempotency key payload mismatch';
    end if;

    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'withdrawal_id', v_existing.id,
      'status', v_existing.status,
      'require_admin_review', v_existing.require_admin_review
    );
  end if;

  v_status := case when p_require_admin_review then 'pending_admin_review' else 'pending' end;

  -- Balance freeze and withdrawal row creation remain in this same transaction.
  v_result := public.apply_financial_operation(
    'withdraw-freeze:' || p_request_id,
    p_user_id,
    p_asset,
    'withdraw_freeze',
    -(p_amount + p_fee),
    p_amount + p_fee,
    p_request_hash,
    jsonb_build_object(
      'withdrawal_id', p_withdrawal_id,
      'network', p_network,
      'require_admin_review', p_require_admin_review
    )
  );
  v_operation_id := (v_result->>'operation_id')::uuid;

  insert into public.withdrawal_requests (
    id, user_id, asset, network, amount, fee, destination, status,
    request_id, freeze_operation_id, require_admin_review, request_hash
  ) values (
    p_withdrawal_id, p_user_id, p_asset, p_network, p_amount, p_fee, p_destination,
    v_status, p_request_id, v_operation_id, p_require_admin_review, p_request_hash
  );

  insert into public.financial_audit_log (
    actor_id, subject_user_id, action, object_type, object_id, reason, metadata
  ) values (
    'system', p_user_id, 'withdrawal_created', 'withdrawal', p_withdrawal_id,
    null, jsonb_build_object(
      'asset', p_asset,
      'amount', p_amount,
      'fee', p_fee,
      'network', p_network,
      'require_admin_review', p_require_admin_review,
      'request_id', p_request_id
    )
  );

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'withdrawal_id', p_withdrawal_id,
    'status', v_status,
    'require_admin_review', p_require_admin_review
  );
end;
$$;

-- Replace review logic so both pending states enter the same atomic review flow.
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

  v_result := public.apply_financial_operation(
    'withdraw-review:' || v_w.id,
    v_w.user_id,
    v_w.asset,
    case when p_approve then 'withdraw_approve' else 'withdraw_reject' end,
    case when p_approve then 0 else v_w.amount + v_w.fee end,
    -(v_w.amount + v_w.fee),
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

revoke all on function public.create_withdrawal_atomic(text,text,text,text,numeric,numeric,text,text,text,boolean) from public, anon, authenticated;
revoke all on function public.review_withdrawal_atomic(text,text,boolean,text) from public, anon, authenticated;
grant execute on function public.create_withdrawal_atomic(text,text,text,text,numeric,numeric,text,text,text,boolean) to service_role;
grant execute on function public.review_withdrawal_atomic(text,text,boolean,text) to service_role;
