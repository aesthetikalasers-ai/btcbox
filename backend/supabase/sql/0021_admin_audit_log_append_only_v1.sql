-- BTCBOX administrator audit append-only contract.
-- Reuse the canonical financial_audit_log schema created by 0002.
-- Apply to an isolated staging database first; never apply directly to production.

-- Stable event IDs make outbox delivery safe to retry after uncertain network/CAS outcomes.
alter table public.financial_audit_log
  add column if not exists event_id text;

create unique index if not exists financial_audit_event_id_uidx
  on public.financial_audit_log (event_id)
  where event_id is not null;

-- Replace the legacy non-idempotent RPC signature.
drop function if exists public.append_admin_audit_log(text, text, text, text, jsonb);

create or replace function public.block_audit_log_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'financial_audit_log is append-only; % is not allowed', tg_op;
end;
$$;

drop trigger if exists audit_log_append_only on public.financial_audit_log;
create trigger audit_log_append_only
  before update or delete on public.financial_audit_log
  for each row execute function public.block_audit_log_mutation();

-- Canonical indexes match the 0002 table columns.
create index if not exists financial_audit_action_created_idx
  on public.financial_audit_log (action, created_at desc);
create index if not exists financial_audit_actor_created_idx
  on public.financial_audit_log (actor_id, created_at desc);
create index if not exists financial_audit_subject_created_idx
  on public.financial_audit_log (subject_user_id, created_at desc);

-- Append one administrator audit event idempotently.
-- The durable outbox can retry this RPC until the state document records delivery.
create or replace function public.append_admin_audit_log(
  p_event_id text,
  p_action text,
  p_uid text default '',
  p_by text default 'admin',
  p_detail text default '',
  p_meta jsonb default '{}'::jsonb
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing public.financial_audit_log%rowtype;
  v_inserted integer;
  v_actor text := coalesce(nullif(p_by, ''), 'admin');
  v_subject text := nullif(p_uid, '');
  v_reason text := nullif(left(coalesce(p_detail, ''), 2000), '');
begin
  if coalesce(p_event_id, '') = '' or length(p_event_id) > 128
     or coalesce(p_action, '') = ''
     or p_meta is null or jsonb_typeof(p_meta) <> 'object' then
    raise exception 'invalid administrator audit event';
  end if;

  insert into public.financial_audit_log (
    event_id, actor_id, subject_user_id, action, object_type, object_id, reason, metadata
  ) values (
    p_event_id, v_actor, v_subject, p_action, 'admin_action', null, v_reason, p_meta
  )
  on conflict (event_id) where event_id is not null do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    select * into v_existing
    from public.financial_audit_log
    where event_id = p_event_id;

    -- Event identity is immutable. Reason text may differ on a retry when
    -- the application has upgraded its redaction rules; do not strand the
    -- outbox solely because the already-appended historical reason is older.
    if not found
       or v_existing.actor_id is distinct from v_actor
       or v_existing.subject_user_id is distinct from v_subject
       or v_existing.action is distinct from p_action
       or v_existing.object_type is distinct from 'admin_action'
       or v_existing.object_id is not null
       or v_existing.metadata is distinct from p_meta then
      raise exception 'administrator audit event idempotency conflict';
    end if;
  end if;

  return true;
end;
$$;

revoke all on function public.block_audit_log_mutation() from public, anon, authenticated;
revoke all on function public.append_admin_audit_log(text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.append_admin_audit_log(text, text, text, text, text, jsonb) to service_role;

-- Do not grant direct table mutation to browser roles. The financial ledger migration
-- already grants service_role the required table and sequence privileges.
revoke all on public.financial_audit_log from public, anon, authenticated;

-- Refresh PostgREST's function signature cache after replacing the RPC contract.
notify pgrst, 'reload schema';
