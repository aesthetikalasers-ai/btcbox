-- Resolve the quarantined legacy UUID collision without moving financial data.
-- BTCBOX 300102 is the canonical account; 100011 remains as an unlinked historical record.
-- This migration is safe to re-run after the live repair has already been applied.

do $$
declare
  v_supabase_id uuid := '65275844-54e5-437b-9e3d-1e592d1b91f5';
  v_email text;
  v_provider_subject text;
  v_linked_at timestamptz;
  v_state jsonb;
  v_old jsonb;
  v_official jsonb;
  v_financial_rows integer;
  v_existing_mapping text;
begin
  select a.btcbox_user_id into v_existing_mapping
  from public.btcbox_auth_accounts a
  where a.supabase_user_id = v_supabase_id;

  -- Already repaired: validate the canonical mapping and leave data untouched.
  if v_existing_mapping = '300102'
     and not exists (select 1 from public.btcbox_auth_conflicts c where c.supabase_user_id = v_supabase_id)
     and exists (select 1 from public.btcbox_auth_identities i
                 where i.supabase_user_id = v_supabase_id
                   and i.btcbox_user_id = '300102'
                   and i.provider = 'email') then
    return;
  end if;

  if v_existing_mapping is not null then
    raise exception 'UNEXPECTED_EXISTING_AUTH_MAPPING: %', v_existing_mapping;
  end if;

  if not exists (
    select 1 from public.btcbox_auth_conflicts c
    where c.supabase_user_id = v_supabase_id
      and c.candidate_btcbox_user_ids @> array['100011','300102']::text[]
  ) then raise exception 'EXPECTED_AUTH_CONFLICT_NOT_FOUND'; end if;

  select s.data into v_state
  from public.btcbox_state s
  where s.id = 'main'
  for update;
  if v_state is null then raise exception 'BTCBOX_STATE_MISSING'; end if;

  if not (v_state->'users' ? '100011' and v_state->'users' ? '300102') then
    raise exception 'EXPECTED_BTCBOX_USERS_MISSING';
  end if;

  if v_state->'users'->'100011'->>'supabase_user_id' <> v_supabase_id::text
     or v_state->'users'->'300102'->>'supabase_user_id' <> v_supabase_id::text then
    raise exception 'LEGACY_UUID_MAPPING_CHANGED';
  end if;

  select au.email, au.email_confirmed_at
  into v_email, v_linked_at
  from auth.users au where au.id = v_supabase_id;
  if v_email is null or v_linked_at is null then raise exception 'SUPABASE_EMAIL_NOT_CONFIRMED'; end if;

  select i.id::text, i.created_at
  into v_provider_subject, v_linked_at
  from auth.identities i
  where i.user_id = v_supabase_id and i.provider = 'email';
  if v_provider_subject is null then raise exception 'EMAIL_PROVIDER_IDENTITY_MISSING'; end if;

  select count(*) into v_financial_rows from (
    select user_id from public.financial_accounts
    union all select user_id from public.financial_operations
    union all select user_id from public.financial_ledger
    union all select user_id from public.withdrawal_requests
    union all select user_id from public.deposit_records
    union all select user_id from public.earn_positions
    union all select user_id from public.financial_spot_orders
    union all select user_id from public.financial_matching_orders
    union all select buyer_user_id from public.financial_matching_trades
    union all select seller_user_id from public.financial_matching_trades
    union all select user_id from public.seconds_contract_positions
    union all select subject_user_id from public.financial_audit_log where subject_user_id is not null
  ) f where f.user_id = '300102';
  if v_financial_rows <> 14 then
    raise exception 'OFFICIAL_ACCOUNT_FINANCIAL_ROW_COUNT_CHANGED: %', v_financial_rows;
  end if;

  v_old := v_state->'users'->'100011';
  v_official := v_state->'users'->'300102';

  insert into public.btcbox_auth_accounts (supabase_user_id, btcbox_user_id)
  values (v_supabase_id, '300102');

  insert into public.btcbox_auth_identities (
    btcbox_user_id, supabase_user_id, provider, provider_subject, email, created_at, updated_at
  ) values (
    '300102', v_supabase_id, 'email', v_provider_subject, lower(v_email),
    coalesce(v_linked_at, now()), now()
  );

  update public.btcbox_state
  set data = jsonb_set(
    jsonb_set(
      data,
      '{users,100011}',
      (
        (v_old - 'supabase_user_id' - 'supabase_user_ids' - 'auth_identities' - 'auth_providers')
        || jsonb_build_object(
          'legacy_supabase_user_id', v_old->'supabase_user_id',
          'legacy_supabase_user_ids', coalesce(v_old->'supabase_user_ids', '[]'::jsonb),
          'legacy_auth_identities', coalesce(v_old->'legacy_auth_identities', '[]'::jsonb) || coalesce(v_old->'auth_identities', '[]'::jsonb),
          'legacy_auth_providers', coalesce(v_old->'legacy_auth_providers', '[]'::jsonb) || coalesce(v_old->'auth_providers', '[]'::jsonb),
          'supabase_user_ids', '[]'::jsonb,
          'auth_identities', '[]'::jsonb,
          'auth_providers', '[]'::jsonb
        )
      ),
      true
    ),
    '{users,300102}',
    (
      (v_official - 'auth_identities')
      || jsonb_build_object(
        'legacy_email', v_official->'email',
        'legacy_auth_identities', coalesce(v_official->'legacy_auth_identities', '[]'::jsonb) || coalesce(v_official->'auth_identities', '[]'::jsonb),
        'email', lower(v_email),
        'email_verified', true,
        'supabase_user_id', v_supabase_id::text,
        'supabase_user_ids', jsonb_build_array(v_supabase_id::text),
        'auth_providers', jsonb_build_array('email'),
        'auth_identities', jsonb_build_array(jsonb_build_object(
          'supabase_user_id', v_supabase_id::text,
          'provider', 'email',
          'provider_subject', v_provider_subject,
          'email', lower(v_email),
          'wallet_chain', '',
          'wallet_address', '',
          'linked_at', coalesce(v_linked_at, now())::text
        ))
      )
    ),
    true
  ),
  revision = revision + 1,
  updated_at = now()
  where id = 'main';

  delete from public.btcbox_auth_conflicts where supabase_user_id = v_supabase_id;
end;
$$;
