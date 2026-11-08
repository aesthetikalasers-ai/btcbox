-- 0038_withdrawal_first_successful_review_guard_v1.sql
-- First-withdrawal review is enforced from PostgreSQL's authoritative history,
-- never from the legacy btcbox_state document maintained by the API layer.

create or replace function public.create_withdrawal_atomic(
  p_withdrawal_id text,
  p_user_id text,
  p_asset text,
  p_network text,
  p_amount numeric,
  p_fee numeric,
  p_destination text,
  p_request_id text,
  p_request_hash text,
  p_require_admin_review boolean,
  p_expected_fee numeric
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
  v_require_admin_review boolean;
begin
  if coalesce(p_withdrawal_id, '') = ''
     or coalesce(p_user_id, '') = ''
     or coalesce(p_asset, '') !~ '^[A-Z0-9]{2,16}$'
     or coalesce(p_network, '') = ''
     or p_amount is null or p_amount <= 0
     or p_fee is null or p_fee < 0
     or p_expected_fee is null or p_expected_fee < 0
     or length(coalesce(p_destination, '')) < 8
     or length(coalesce(p_request_id, '')) < 16
     or length(coalesce(p_request_id, '')) > 128
     or coalesce(p_request_hash, '') !~ '^[a-f0-9]{64}$'
     or p_require_admin_review is null then
    raise exception 'invalid withdrawal request';
  end if;

  -- Serialize first-use retries, including the absent-row case.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id, 0));

  select * into v_existing
  from public.withdrawal_requests
  where request_id = p_request_id
  for update;

  if found then
    -- The fee and review flag are server-derived snapshots, not caller intent.
    -- Replaying the same user payload must return the original stored fee/status
    -- even if the admin changes the fee schedule or review threshold meanwhile.
    if v_existing.user_id is distinct from p_user_id
       or v_existing.asset is distinct from p_asset
       or v_existing.network is distinct from p_network
       or v_existing.amount is distinct from p_amount
       or v_existing.destination is distinct from p_destination
       or (v_existing.request_hash is not null and v_existing.request_hash is distinct from p_request_hash) then
      raise exception 'idempotency key payload mismatch';
    end if;

    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'withdrawal_id', v_existing.id,
      'status', v_existing.status,
      'fee', v_existing.fee,
      'require_admin_review', v_existing.require_admin_review
    );
  end if;

  -- Only a new request must match the current fee quote.
  if p_expected_fee is distinct from p_fee then
    raise exception 'withdrawal fee changed';
  end if;

  -- PostgreSQL is authoritative for whether this is the user's first
  -- successful withdrawal. The legacy btcbox_state snapshot is not consulted.
  v_require_admin_review := p_require_admin_review OR NOT EXISTS (
    select 1
    from public.withdrawal_requests
    where user_id = p_user_id
      and status in ('completed', 'success', 'approved', 'broadcast')
  );
  v_status := case when v_require_admin_review then 'pending_admin_review' else 'pending' end;

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
      'fee', p_fee,
      'require_admin_review', v_require_admin_review
    )
  );
  v_operation_id := (v_result->>'operation_id')::uuid;

  insert into public.withdrawal_requests (
    id, user_id, asset, network, amount, fee, destination, status,
    request_id, freeze_operation_id, require_admin_review, request_hash
  ) values (
    p_withdrawal_id, p_user_id, p_asset, p_network, p_amount, p_fee, p_destination,
    v_status, p_request_id, v_operation_id, v_require_admin_review, p_request_hash
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
      'require_admin_review', v_require_admin_review,
      'request_id', p_request_id
    )
  );

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'withdrawal_id', p_withdrawal_id,
    'status', v_status,
    'fee', p_fee,
    'require_admin_review', v_require_admin_review
  );
end;
$$;

revoke all on function public.create_withdrawal_atomic(
  text, text, text, text, numeric, numeric, text, text, text, boolean, numeric
) from public, anon, authenticated;
grant execute on function public.create_withdrawal_atomic(
  text, text, text, text, numeric, numeric, text, text, text, boolean, numeric
) to service_role;
