-- Atomic bridge between the verified Supabase Auth UUID and the BTCBOX
-- internal account ID. This migration is a repository draft only; do not apply
-- it to the production Supabase project until reviewed and explicitly approved.

create or replace function public.btcbox_register_auth_account_v1(
  p_supabase_user_id uuid,
  p_btcbox_user_id text,
  p_provider text,
  p_provider_subject text,
  p_email text,
  p_wallet_chain text,
  p_wallet_address text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if p_supabase_user_id is null
     or nullif(p_btcbox_user_id, '') is null
     or p_provider not in ('email', 'google', 'web3')
     or p_provider_subject is distinct from p_supabase_user_id::text
     or (p_provider in ('email', 'google') and (p_wallet_chain is not null or p_wallet_address is not null))
     or (p_provider = 'web3' and (
       p_wallet_chain is null
       or p_wallet_address is null
       or not (
         (p_wallet_chain = 'ethereum' and p_wallet_address ~* '^0x[a-f0-9]{40}$')
         or
         (p_wallet_chain = 'solana' and p_wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$')
       )
     )) then
    return false;
  end if;

  if exists (
    select 1 from public.btcbox_auth_conflicts c
    where c.supabase_user_id = p_supabase_user_id
  ) then
    return false;
  end if;

  -- Create only the Exchange account identity row; never write a password or
  -- seed data here. Wallet profile/account rows are initialized by auth.users.
  insert into public.btcbox_users (user_id, status)
  values (p_btcbox_user_id, 'active')
  on conflict (user_id) do nothing;

  select u.status into v_status
  from public.btcbox_users u
  where u.user_id = p_btcbox_user_id
  for update;

  if not found or v_status <> 'active' then
    return false;
  end if;

  -- Both operations run in this same PostgreSQL transaction. A rejected
  -- mapping raises and rolls back the btcbox_users insert as well.
  if not public.link_btcbox_auth_account(p_supabase_user_id, p_btcbox_user_id) then
    raise exception using errcode = 'P0001', message = 'BTCBOX auth account mapping rejected';
  end if;

  if not public.register_btcbox_auth_identity(
    p_supabase_user_id,
    p_btcbox_user_id,
    p_provider,
    p_provider_subject,
    p_email,
    p_wallet_chain,
    p_wallet_address
  ) then
    raise exception using errcode = 'P0001', message = 'BTCBOX auth identity registration rejected';
  end if;

  return true;
exception
  when unique_violation then
    return false;
end;
$$;

revoke all on function public.btcbox_register_auth_account_v1(uuid, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.btcbox_register_auth_account_v1(uuid, text, text, text, text, text, text) to service_role;
