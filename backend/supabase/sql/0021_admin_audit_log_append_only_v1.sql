-- BTCBOX administrator audit append-only contract.
-- Reuse the canonical financial_audit_log schema created by 0002.
-- Apply to an isolated staging database first; never apply directly to production.

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

-- Keep the existing API parameter contract while mapping it to canonical columns.
-- SECURITY INVOKER is sufficient: service_role already has INSERT on this table.
create or replace function public.append_admin_audit_log(
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
begin
  if coalesce(p_action, '') = '' or p_meta is null or jsonb_typeof(p_meta) <> 'object' then
    raise exception 'invalid administrator audit event';
  end if;

  insert into public.financial_audit_log (
    actor_id, subject_user_id, action, object_type, object_id, reason, metadata
  ) values (
    coalesce(nullif(p_by, ''), 'admin'),
    nullif(p_uid, ''),
    p_action,
    'admin_action',
    null,
    nullif(left(coalesce(p_detail, ''), 2000), ''),
    p_meta
  );
  return true;
end;
$$;

revoke all on function public.block_audit_log_mutation() from public, anon, authenticated;
revoke all on function public.append_admin_audit_log(text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.append_admin_audit_log(text, text, text, text, jsonb) to service_role;

-- Do not grant direct table mutation to browser roles. The financial ledger migration
-- already grants service_role the required table and sequence privileges.
revoke all on public.financial_audit_log from public, anon, authenticated;
