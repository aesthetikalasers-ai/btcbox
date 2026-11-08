-- 0037_financial_write_rate_limit_scopes_v1.sql
-- Extend the shared atomic limiter to customer-facing financial write endpoints.
-- Every new scope is consumed before its corresponding financial RPC; no balance
-- or transaction behavior is changed by this migration.

ALTER TABLE public.btcbox_rate_limits
  DROP CONSTRAINT IF EXISTS btcbox_rate_limits_scope_check;
ALTER TABLE public.btcbox_rate_limits
  ADD CONSTRAINT btcbox_rate_limits_scope_check
  CHECK (scope IN (
    'login_2fa',
    'credential_reauth',
    'identity_link_reauth',
    'identity_link_target',
    'credential_recover',
    'twofa_setup_password',
    'twofa_setup_confirm',
    'twofa_disable',
    'seconds_order',
    'seconds_settle',
    'password_change',
    'fund_password_change',
    'withdraw_create',
    'spot_order',
    'spot_cancel',
    'earn_subscribe',
    'earn_redeem'
  ));

create or replace function public.btcbox_rate_limit_consume_v1(
  p_scope text,
  p_key_hash text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_limit integer;
  v_window_seconds integer;
  v_now_epoch bigint;
  v_window_start bigint;
  v_count integer;
  v_retry_after integer;
begin
  if p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid rate limit key';
  end if;

  case p_scope
    when 'login_2fa' then v_limit := 20; v_window_seconds := 900;
    when 'credential_reauth' then v_limit := 8; v_window_seconds := 900;
    when 'identity_link_reauth' then v_limit := 8; v_window_seconds := 900;
    when 'identity_link_target' then v_limit := 10; v_window_seconds := 900;
    when 'credential_recover' then v_limit := 5; v_window_seconds := 900;
    when 'twofa_setup_password' then v_limit := 10; v_window_seconds := 900;
    when 'twofa_setup_confirm' then v_limit := 10; v_window_seconds := 900;
    when 'twofa_disable' then v_limit := 10; v_window_seconds := 900;
    when 'seconds_order' then v_limit := 30; v_window_seconds := 300;
    when 'seconds_settle' then v_limit := 60; v_window_seconds := 300;
    when 'withdraw_create' then v_limit := 5; v_window_seconds := 900;
    when 'spot_order' then v_limit := 30; v_window_seconds := 300;
    when 'spot_cancel' then v_limit := 60; v_window_seconds := 300;
    when 'earn_subscribe' then v_limit := 10; v_window_seconds := 900;
    when 'earn_redeem' then v_limit := 20; v_window_seconds := 900;
    when 'password_change' then v_limit := 10; v_window_seconds := 900;
    when 'fund_password_change' then v_limit := 10; v_window_seconds := 900;
    else raise exception 'unsupported rate limit scope';
  end case;

  v_now_epoch := floor(extract(epoch from clock_timestamp()))::bigint;
  v_window_start := (v_now_epoch / v_window_seconds) * v_window_seconds;

  insert into public.btcbox_rate_limits
    (scope, key_hash, window_start, request_count, updated_at)
  values
    (p_scope, p_key_hash, v_window_start, 1, clock_timestamp())
  on conflict (scope, key_hash, window_start)
  do update set
    request_count = public.btcbox_rate_limits.request_count + 1,
    updated_at = clock_timestamp()
  returning request_count into v_count;

  v_retry_after := greatest(1, (v_window_start + v_window_seconds - v_now_epoch)::integer);

  return jsonb_build_object(
    'ok', true,
    'allowed', v_count <= v_limit,
    'limit', v_limit,
    'count', v_count,
    'remaining', greatest(0, v_limit - v_count),
    'retry_after_seconds', v_retry_after,
    'window_seconds', v_window_seconds,
    'window_start', v_window_start
  );
end;
$$;

REVOKE ALL ON FUNCTION public.btcbox_rate_limit_consume_v1(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.btcbox_rate_limit_consume_v1(text, text)
  TO service_role;
