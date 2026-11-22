-- 0042_support_read_state_v1.sql
-- Keep support read markers outside the monolithic BTCBOX state document.
-- This prevents harmless support polling from competing with financial/user writes.

create table if not exists public.btcbox_support_read_state (
  uid text primary key check (length(uid) between 1 and 128),
  last_read_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.btcbox_support_read_state enable row level security;
revoke all on table public.btcbox_support_read_state from public, anon, authenticated;
grant select, insert, update on table public.btcbox_support_read_state to service_role;

-- Preserve existing unread state. Legacy nowStr() values are UTC strings
-- formatted as YYYY-MM-DD HH24:MI:SS (without a timezone suffix).
insert into public.btcbox_support_read_state (uid, last_read_at)
select u.key,
       ((u.value->>'last_read_chat_at')::timestamp without time zone at time zone 'UTC')
  from public.btcbox_state s
 cross join lateral jsonb_each(s.data->'users') as u(key, value)
 where s.id = 'main'
   and coalesce(u.value->>'last_read_chat_at', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}
on conflict (uid) do update
  set last_read_at = greatest(public.btcbox_support_read_state.last_read_at, excluded.last_read_at),
      updated_at = now();

create or replace function public.btcbox_mark_support_read(p_uid text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_read_at timestamptz;
begin
  if p_uid is null or length(p_uid) < 1 or length(p_uid) > 128 then
    raise exception 'invalid support user id';
  end if;

  insert into public.btcbox_support_read_state (uid, last_read_at, updated_at)
  values (p_uid, now(), now())
  on conflict (uid) do update
    set last_read_at = greatest(public.btcbox_support_read_state.last_read_at, excluded.last_read_at),
        updated_at = now()
  returning last_read_at into v_read_at;

  return to_char(v_read_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS');
end;
$$;

create or replace function public.btcbox_get_support_read(p_uid text)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (select to_char(last_read_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')
       from public.btcbox_support_read_state
      where uid = p_uid),
    ''
  );
$$;

revoke all on function public.btcbox_mark_support_read(text) from public, anon, authenticated;
revoke all on function public.btcbox_get_support_read(text) from public, anon, authenticated;
grant execute on function public.btcbox_mark_support_read(text) to service_role;
grant execute on function public.btcbox_get_support_read(text) to service_role;

on conflict (uid) do update
  set last_read_at = greatest(public.btcbox_support_read_state.last_read_at, excluded.last_read_at),
      updated_at = now();

create or replace function public.btcbox_mark_support_read(p_uid text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_read_at timestamptz;
begin
  if p_uid is null or length(p_uid) < 1 or length(p_uid) > 128 then
    raise exception 'invalid support user id';
  end if;

  insert into public.btcbox_support_read_state (uid, last_read_at, updated_at)
  values (p_uid, now(), now())
  on conflict (uid) do update
    set last_read_at = greatest(public.btcbox_support_read_state.last_read_at, excluded.last_read_at),
        updated_at = now()
  returning last_read_at into v_read_at;

  return to_char(v_read_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS');
end;
$$;

create or replace function public.btcbox_get_support_read(p_uid text)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (select to_char(last_read_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')
       from public.btcbox_support_read_state
      where uid = p_uid),
    ''
  );
$$;

revoke all on function public.btcbox_mark_support_read(text) from public, anon, authenticated;
revoke all on function public.btcbox_get_support_read(text) from public, anon, authenticated;
grant execute on function public.btcbox_mark_support_read(text) to service_role;
grant execute on function public.btcbox_get_support_read(text) to service_role;
