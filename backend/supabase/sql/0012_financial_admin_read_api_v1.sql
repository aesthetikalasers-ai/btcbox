-- BTCBOX normalized admin withdrawal reads v1.
-- Includes both normal pending and explicitly flagged admin-review requests.
-- Apply to staging first; service-role-only and read-only.

create or replace function public.read_admin_withdrawal_snapshot_v1()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
  v_review_count integer;
  v_withdrawals jsonb;
begin
  select count(*)::integer,
         count(*) filter (where status = 'pending_admin_review')::integer
  into v_count, v_review_count
  from public.withdrawal_requests
  where status in ('pending', 'pending_admin_review');

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'uid', user_id,
    'coin', asset,
    'amount', amount,
    'fee', fee,
    'network', network,
    'address', destination,
    'status', status,
    'require_admin_review', require_admin_review,
    'txid', '',
    'time', created_at
  ) order by created_at desc), '[]'::jsonb)
  into v_withdrawals
  from (
    select id, user_id, asset, amount, fee, network, destination,
           status, require_admin_review, created_at
    from public.withdrawal_requests
    where status in ('pending', 'pending_admin_review')
    order by created_at desc
    limit 200
  ) recent;

  return jsonb_build_object(
    'ok', true,
    'pending_count', v_count,
    'pending_admin_review_count', v_review_count,
    'withdrawals', v_withdrawals
  );
end;
$$;

revoke all on function public.read_admin_withdrawal_snapshot_v1() from public, anon, authenticated;
grant execute on function public.read_admin_withdrawal_snapshot_v1() to service_role;
