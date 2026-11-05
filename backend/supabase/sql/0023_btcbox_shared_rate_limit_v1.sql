-- 0023_btcbox_shared_rate_limit_v1.sql
-- Dedicated, atomic fixed-window limiter for BTCBOX serverless API routes.
-- PREPARED MIGRATION: review and apply only to an isolated staging database first.
-- Never apply this migration to production without explicit user approval.

create table if not exists public.btcbox_rate_limits (
  scope text not null check (scope in (
    'login_2fa',
    'credential_reauth',
    'identity_link_reauth',
    'credential_recover',
    'twofa_setup_password',
    'twofa_setup_confirm',
    'twofa_disable',
    'seconds_order',
    'seconds_settle',
    'password_change',
    'fund_password_change'
  )),
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  window_start bigint not null check (window_start >= 0),
  request_count integer not null check (request_count >= 1 and request_count <= 1000000),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (scope, key_hash, window_start)
);

create index if not exists btcbox_rate_limits_updated_at_idx
  on public.btcbox_rate_limits (updated_at);

alter table public.btcbox_rate_limits enable row level security;
revoke all on table public.btcbox_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.btcbox_rate_limits to service_role;

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
    when 'credential_recover' then v_limit := 5; v_window_seconds := 900;
    when 'twofa_setup_password' then v_limit := 10; v_window_seconds := 900;
    when 'twofa_setup_confirm' then v_limit := 10; v_window_seconds := 900;
    when 'twofa_disable' then v_limit := 10; v_window_seconds := 900;
    when 'seconds_order' then v_limit := 30; v_window_seconds := 300;
    when 'seconds_settle' then v_limit := 60; v_window_seconds := 300;
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

revoke all on function public.btcbox_rate_limit_consume_v1(text, text) from public, anon, authenticated;
grant execute on function public.btcbox_rate_limit_consume_v1(text, text) to service_role;

-- Bounded cleanup helper. Invoke from a trusted scheduled job or maintenance task.
-- It removes only windows older than 48 hours and caps each invocation to 5,000 rows.
create or replace function public.btcbox_rate_limit_cleanup_v1()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  with expired as (
    select ctid
      from public.btcbox_rate_limits
     where updated_at < clock_timestamp() - interval '48 hours'
     order by updated_at
     limit 5000
  )
  delete from public.btcbox_rate_limits r
   using expired e
   where r.ctid = e.ctid;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.btcbox_rate_limit_cleanup_v1() from public, anon, authenticated;
grant execute on function public.btcbox_rate_limit_cleanup_v1() to service_role;
