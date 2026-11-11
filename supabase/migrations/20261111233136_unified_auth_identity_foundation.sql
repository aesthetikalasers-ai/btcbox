-- BTCBOX unified authentication identity foundation.
-- Additive only: existing btcbox_state and financial user_id values remain unchanged.
-- New BTCBOX IDs begin at 15686; current legacy IDs are preserved and checked before backfill.

create sequence if not exists public.btcbox_user_id_seq
  start with 15686 increment by 1 minvalue 15686 no maxvalue cache 1;

create table if not exists public.btcbox_users (
  user_id text primary key,
  status text not null default 'active'
    check (status in ('active', 'frozen', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One Supabase Auth UUID maps to exactly one BTCBOX account.
-- A BTCBOX account may have multiple Supabase UUIDs only after explicit identity linking.
create table if not exists public.btcbox_auth_accounts (
  supabase_user_id uuid primary key,
  btcbox_user_id text not null references public.btcbox_users(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint btcbox_auth_accounts_pair_unique unique (supabase_user_id, btcbox_user_id)
);

-- Legacy duplicate mappings are quarantined; they are never silently merged by email.
create table if not exists public.btcbox_auth_conflicts (
  supabase_user_id uuid primary key,
  candidate_btcbox_user_ids text[] not null,
  reason text not null,
  detected_at timestamptz not null default now(),
  check (cardinality(candidate_btcbox_user_ids) > 1)
);

create table if not exists public.btcbox_auth_identities (
  id uuid primary key default gen_random_uuid(),
  btcbox_user_id text not null,
  supabase_user_id uuid not null,
  provider text not null check (provider in ('email', 'google', 'web3')),
  -- Supabase Auth identity row UUID; not an email address or user-editable metadata.
  provider_subject text not null check (length(provider_subject) between 1 and 255),
  email text,
  wallet_chain text,
  wallet_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint btcbox_auth_identity_account_fkey
    foreign key (supabase_user_id, btcbox_user_id)
    references public.btcbox_auth_accounts(supabase_user_id, btcbox_user_id)
    on delete restrict,
  constraint btcbox_auth_identity_subject_unique unique (provider, provider_subject),
  constraint btcbox_auth_identity_user_provider_subject_unique
    unique (supabase_user_id, provider, provider_subject),
  constraint btcbox_auth_identity_wallet_shape check (
    (provider in ('email', 'google') and wallet_chain is null and wallet_address is null)
    or
    (provider = 'web3' and (
      (wallet_chain = 'ethereum' and wallet_address ~* '^0x[a-f0-9]{40}$')
      or
      (wallet_chain = 'solana' and wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$')
    ))
  )
);

create index if not exists btcbox_auth_identities_user_idx
  on public.btcbox_auth_identities (btcbox_user_id);
create index if not exists btcbox_auth_identities_supabase_user_idx
  on public.btcbox_auth_identities (supabase_user_id);
create unique index if not exists btcbox_auth_identity_ethereum_wallet_unique
  on public.btcbox_auth_identities (lower(wallet_address))
  where provider = 'web3' and wallet_chain = 'ethereum';
create unique index if not exists btcbox_auth_identity_solana_wallet_unique
  on public.btcbox_auth_identities (wallet_address)
  where provider = 'web3' and wallet_chain = 'solana';

-- Backfill BTCBOX account rows from the current canonical JSON state only.
-- Financial tables and their existing user_id values are intentionally untouched.
insert into public.btcbox_users (user_id, status)
select distinct
  coalesce(nullif(u.value->>'uid', ''), u.key) as user_id,
  case when coalesce((u.value->>'frozen')::boolean, false) then 'frozen' else 'active' end
from public.btcbox_state s
cross join lateral jsonb_each(s.data->'users') as u(key, value)
where s.id = 'main'
on conflict (user_id) do nothing;

-- Collect every legacy Supabase UUID recorded against each BTCBOX user.
with state_map as (
  select distinct
    coalesce(nullif(u.value->>'uid', ''), u.key) as btcbox_user_id,
    ids.supabase_user_id
  from public.btcbox_state s
  cross join lateral jsonb_each(s.data->'users') as u(key, value)
  cross join lateral (
    select nullif(u.value->>'supabase_user_id', '')::uuid as supabase_user_id
    union
    select nullif(v.value, '')::uuid
    from jsonb_array_elements_text(
      case when jsonb_typeof(u.value->'supabase_user_ids') = 'array'
        then u.value->'supabase_user_ids' else '[]'::jsonb end
    ) as v(value)
    union
    select nullif(ai.value->>'supabase_user_id', '')::uuid
    from jsonb_array_elements(
      case when jsonb_typeof(u.value->'auth_identities') = 'array'
        then u.value->'auth_identities' else '[]'::jsonb end
    ) as ai(value)
  ) ids
  where s.id = 'main' and ids.supabase_user_id is not null
),
conflicts as (
  select supabase_user_id, array_agg(distinct btcbox_user_id order by btcbox_user_id) as candidates
  from state_map
  group by supabase_user_id
  having count(distinct btcbox_user_id) > 1
)
insert into public.btcbox_auth_conflicts (supabase_user_id, candidate_btcbox_user_ids, reason)
select supabase_user_id, candidates, 'multiple_legacy_btcbox_accounts_for_one_supabase_user'
from conflicts
on conflict (supabase_user_id) do nothing;

-- Backfill only unambiguous mappings. Conflicting UUIDs remain quarantined.
with state_map as (
  select distinct
    coalesce(nullif(u.value->>'uid', ''), u.key) as btcbox_user_id,
    ids.supabase_user_id
  from public.btcbox_state s
  cross join lateral jsonb_each(s.data->'users') as u(key, value)
  cross join lateral (
    select nullif(u.value->>'supabase_user_id', '')::uuid as supabase_user_id
    union
    select nullif(v.value, '')::uuid
    from jsonb_array_elements_text(
      case when jsonb_typeof(u.value->'supabase_user_ids') = 'array'
        then u.value->'supabase_user_ids' else '[]'::jsonb end
    ) as v(value)
    union
    select nullif(ai.value->>'supabase_user_id', '')::uuid
    from jsonb_array_elements(
      case when jsonb_typeof(u.value->'auth_identities') = 'array'
        then u.value->'auth_identities' else '[]'::jsonb end
    ) as ai(value)
  ) ids
  where s.id = 'main' and ids.supabase_user_id is not null
)
insert into public.btcbox_auth_accounts (supabase_user_id, btcbox_user_id)
select m.supabase_user_id, min(m.btcbox_user_id)
from state_map m
group by m.supabase_user_id
having count(distinct m.btcbox_user_id) = 1
on conflict (supabase_user_id) do nothing;

-- Backfill only provider identities that still exist in Supabase Auth and map
-- unambiguously to a BTCBOX account. Missing/ambiguous legacy identities are
-- intentionally left for verified login or explicit account-link recovery.
insert into public.btcbox_auth_identities (
  btcbox_user_id, supabase_user_id, provider, provider_subject,
  email, wallet_chain, wallet_address, created_at, updated_at
)
select
  a.btcbox_user_id,
  i.user_id,
  i.provider,
  i.id::text,
  coalesce(nullif(i.identity_data->>'email', ''), au.email),
  case when i.provider = 'web3' then lower(i.identity_data->'custom_claims'->>'chain') else null end,
  case
    when i.provider = 'web3' and lower(i.identity_data->'custom_claims'->>'chain') = 'ethereum'
      then lower(i.identity_data->'custom_claims'->>'address')
    when i.provider = 'web3' then i.identity_data->'custom_claims'->>'address'
    else null
  end,
  coalesce(i.created_at, now()),
  coalesce(i.updated_at, now())
from auth.identities i
join public.btcbox_auth_accounts a on a.supabase_user_id = i.user_id
left join auth.users au on au.id = i.user_id
where i.provider in ('email', 'google', 'web3')
  and (
    i.provider in ('email', 'google')
    or (
      lower(i.identity_data->'custom_claims'->>'chain') = 'ethereum'
      and i.identity_data->'custom_claims'->>'address' ~* '^0x[a-f0-9]{40}$'
    )
    or (
      lower(i.identity_data->'custom_claims'->>'chain') = 'solana'
      and i.identity_data->'custom_claims'->>'address' ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    )
  )
on conflict (provider, provider_subject) do nothing;

-- Atomic allocator. Repeated calls for the same verified Supabase UUID return
-- the same BTCBOX ID; quarantined legacy mappings fail closed.
create or replace function public.allocate_btcbox_user_id(p_supabase_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id text;
begin
  if p_supabase_user_id is null then
    raise exception 'SUPABASE_USER_ID_REQUIRED' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.btcbox_auth_conflicts c
    where c.supabase_user_id = p_supabase_user_id
  ) then
    raise exception 'BTCBOX_AUTH_MAPPING_CONFLICT' using errcode = '23505';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_supabase_user_id::text, 0));

  select a.btcbox_user_id into v_user_id
  from public.btcbox_auth_accounts a
  where a.supabase_user_id = p_supabase_user_id;
  if v_user_id is not null then
    return v_user_id;
  end if;

  -- Skip IDs already present in the legacy user set (for example 100006+).
  loop
    v_user_id := nextval('public.btcbox_user_id_seq'::regclass)::text;
    exit when not exists (
      select 1 from public.btcbox_users u where u.user_id = v_user_id
    );
  end loop;

  insert into public.btcbox_users (user_id) values (v_user_id);
  insert into public.btcbox_auth_accounts (supabase_user_id, btcbox_user_id)
  values (p_supabase_user_id, v_user_id);
  return v_user_id;
end;
$$;

-- Explicit linking is allowed only when the UUID is not quarantined and is
-- either unmapped or already mapped to the same BTCBOX account.
create or replace function public.link_btcbox_auth_account(
  p_supabase_user_id uuid,
  p_btcbox_user_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing text;
begin
  if p_supabase_user_id is null or nullif(p_btcbox_user_id, '') is null then
    return false;
  end if;
  if exists (
    select 1 from public.btcbox_auth_conflicts c
    where c.supabase_user_id = p_supabase_user_id
  ) then
    return false;
  end if;
  if not exists (
    select 1 from public.btcbox_users u where u.user_id = p_btcbox_user_id
  ) then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_supabase_user_id::text, 0));
  select a.btcbox_user_id into v_existing
  from public.btcbox_auth_accounts a
  where a.supabase_user_id = p_supabase_user_id;
  if found then
    return v_existing = p_btcbox_user_id;
  end if;

  insert into public.btcbox_auth_accounts (supabase_user_id, btcbox_user_id)
  values (p_supabase_user_id, p_btcbox_user_id);
  return true;
end;
$$;

-- Persist a provider identity only after the backend has verified the Supabase
-- session and confirmed the Supabase UUID -> BTCBOX account mapping.
create or replace function public.register_btcbox_auth_identity(
  p_supabase_user_id uuid,
  p_btcbox_user_id text,
  p_provider text,
  p_provider_subject text,
  p_email text default null,
  p_wallet_chain text default null,
  p_wallet_address text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.btcbox_auth_identities%rowtype;
begin
  if p_supabase_user_id is null
     or nullif(p_btcbox_user_id, '') is null
     or p_provider is null
     or p_provider not in ('email', 'google', 'web3')
     or nullif(p_provider_subject, '') is null
     or length(p_provider_subject) > 255 then
    return false;
  end if;
  if exists (
    select 1 from public.btcbox_auth_conflicts c
    where c.supabase_user_id = p_supabase_user_id
  ) then
    return false;
  end if;
  if not exists (
    select 1 from public.btcbox_auth_accounts a
    where a.supabase_user_id = p_supabase_user_id
      and a.btcbox_user_id = p_btcbox_user_id
  ) then
    return false;
  end if;

  insert into public.btcbox_auth_identities as existing (
    btcbox_user_id, supabase_user_id, provider, provider_subject,
    email, wallet_chain, wallet_address
  ) values (
    p_btcbox_user_id, p_supabase_user_id, p_provider, p_provider_subject,
    nullif(p_email, ''), nullif(p_wallet_chain, ''), nullif(p_wallet_address, '')
  )
  on conflict (provider, provider_subject) do update
    set email = excluded.email,
        wallet_chain = excluded.wallet_chain,
        wallet_address = excluded.wallet_address,
        updated_at = now()
    where existing.supabase_user_id = excluded.supabase_user_id
      and existing.btcbox_user_id = excluded.btcbox_user_id;

  select * into v_existing
  from public.btcbox_auth_identities i
  where i.provider = p_provider and i.provider_subject = p_provider_subject;

  return found
    and v_existing.supabase_user_id = p_supabase_user_id
    and v_existing.btcbox_user_id = p_btcbox_user_id;
exception
  when unique_violation then
    return false;
end;
$$;

alter table public.btcbox_users enable row level security;
alter table public.btcbox_auth_accounts enable row level security;
alter table public.btcbox_auth_conflicts enable row level security;
alter table public.btcbox_auth_identities enable row level security;

revoke all on public.btcbox_users, public.btcbox_auth_accounts,
  public.btcbox_auth_conflicts, public.btcbox_auth_identities
  from public, anon, authenticated;
grant select, insert, update, delete on public.btcbox_users,
  public.btcbox_auth_accounts, public.btcbox_auth_identities to service_role;
grant select on public.btcbox_auth_conflicts to service_role;
revoke all on sequence public.btcbox_user_id_seq from public, anon, authenticated;
grant usage, select on sequence public.btcbox_user_id_seq to service_role;

revoke all on function public.allocate_btcbox_user_id(uuid) from public, anon, authenticated;
revoke all on function public.link_btcbox_auth_account(uuid, text) from public, anon, authenticated;
revoke all on function public.register_btcbox_auth_identity(uuid, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.allocate_btcbox_user_id(uuid) to service_role;
grant execute on function public.link_btcbox_auth_account(uuid, text) to service_role;
grant execute on function public.register_btcbox_auth_identity(uuid, text, text, text, text, text, text) to service_role;
