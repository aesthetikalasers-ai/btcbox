-- 0043_support_read_cursor_v1.sql
-- Track exactly which administrator message was included in a customer's
-- returned support history. Wall-clock read timestamps alone can clear a reply
-- that arrives concurrently in the same displayed second.
alter table public.btcbox_support_read_state
  add column if not exists last_read_message_id text;

create or replace function public.btcbox_mark_support_read_v2(p_uid text, p_message_id text, p_read_at text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_read_at timestamptz;
  v_state record;
begin
  if p_uid is null or length(p_uid) < 1 or length(p_uid) > 128 then raise exception 'invalid support user id'; end if;
  if p_message_id is null or length(p_message_id) < 1 or length(p_message_id) > 128 then raise exception 'invalid support message cursor'; end if;
  if p_read_at is null or length(p_read_at) <> 19 or
     p_read_at !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}$' or
     not pg_input_is_valid(p_read_at, 'timestamp without time zone') then
    raise exception 'invalid support read timestamp';
  end if;
  v_read_at := p_read_at::timestamp without time zone at time zone 'UTC';
  insert into public.btcbox_support_read_state (uid, last_read_at, last_read_message_id, updated_at)
  values (p_uid, v_read_at, p_message_id, now())
  on conflict (uid) do update
    set last_read_at = case
          when public.btcbox_support_read_state.last_read_message_id is null
            then greatest(public.btcbox_support_read_state.last_read_at, excluded.last_read_at)
          when excluded.last_read_message_id > public.btcbox_support_read_state.last_read_message_id
            then greatest(public.btcbox_support_read_state.last_read_at, excluded.last_read_at)
          else public.btcbox_support_read_state.last_read_at
        end,
        last_read_message_id = case
          when public.btcbox_support_read_state.last_read_message_id is null
               and excluded.last_read_at >= public.btcbox_support_read_state.last_read_at
            then excluded.last_read_message_id
          when excluded.last_read_message_id > public.btcbox_support_read_state.last_read_message_id
            then excluded.last_read_message_id
          else public.btcbox_support_read_state.last_read_message_id
        end,
        updated_at = now()
  returning last_read_at, last_read_message_id into v_state;
  return jsonb_build_object(
    'read_at', to_char(v_state.last_read_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
    'message_id', coalesce(v_state.last_read_message_id, '')
  );
end;
$$;

create or replace function public.btcbox_get_support_read_v2(p_uid text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (select jsonb_build_object(
       'read_at', to_char(last_read_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
       'message_id', coalesce(last_read_message_id, '')
     ) from public.btcbox_support_read_state where uid = p_uid),
    jsonb_build_object('read_at', '', 'message_id', '')
  );
$$;

revoke all on function public.btcbox_mark_support_read_v2(text, text, text) from public, anon, authenticated;
revoke all on function public.btcbox_get_support_read_v2(text) from public, anon, authenticated;
grant execute on function public.btcbox_mark_support_read_v2(text, text, text) to service_role;
grant execute on function public.btcbox_get_support_read_v2(text) to service_role;
