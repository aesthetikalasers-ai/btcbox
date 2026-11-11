-- BTCBOX unified authentication identity foundation.
-- Additive only: existing btcbox_state and financial user_id values are untouched.
create sequence if not exists public.btcbox_user_id_seq
  start with 15686 increment by 1 minvalue 15686 no maxvalue cache 1;

create table if not exists public.btcbox_users (
  user_id text primary key,
  status text not null default 'active' check (status in ('active','frozen','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.btcbox_auth_identities (
  id uuid primary key default gen_random_uuid(),
  btcbox_user_id text not null references public.btcbox_users(user_id) on delete restrict,
  supabase_user_id uuid not null,
  provider text not null check (provider in ('email','google','ethereum','solana')),
  provider_subject text not null,
  email text,
  wallet_chain text,
  wallet_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint btcbox_auth_identity_subject_unique unique (provider, provider_subject),
  constraint btcbox_auth_identity_user_provider_subject_unique unique (supabase_user_id, provider, provider_subject),
  constraint btcbox_auth_identity_wallet_shape check (
    (provider in ('ethereum','solana') and wallet_chain = provider and wallet_address is not null)
    or (provider in ('email','google') and wallet_chain is null and wallet_address is null)
  )
);

create index if not exists btcbox_auth_identities_user_idx
  on public.btcbox_auth_identities (btcbox_user_id);
create index if not exists btcbox_auth_identities_supabase_user_idx
  on public.btcbox_auth_identities (supabase_user_id);

create or replace function public.allocate_btcbox_user_id()
returns text
language sql
security definer
set search_path = ''
as $$
  with allocated as (
    select nextval('public.btcbox_user_id_seq'::regclass)::text as user_id
  ), inserted as (
    insert into public.btcbox_users (user_id)
    select user_id from allocated
    returning user_id
  )
  select user_id from inserted;
$$;

revoke all on function public.allocate_btcbox_user_id() from public, anon, authenticated;
grant execute on function public.allocate_btcbox_user_id() to service_role;

alter table public.btcbox_users enable row level security;
alter table public.btcbox_auth_identities enable row level security;
revoke all on public.btcbox_users, public.btcbox_auth_identities from anon, authenticated;
