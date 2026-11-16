-- Draft: one-transaction Wallet <-> Exchange internal transfer.
-- Repository source only. Do NOT apply to the production database or expose
-- the route until the identity bridge, ledger reconciliation, and review gates pass.

alter table public.btcbox_wallet_operations
  drop constraint if exists btcbox_wallet_operations_operation_type_check;
alter table public.btcbox_wallet_operations
  add constraint btcbox_wallet_operations_operation_type_check
  check (operation_type = any (array[
    'deposit_credit','withdraw_freeze','withdraw_unfreeze','withdraw_debit',
    'trade_reserve','trade_release','trade_settlement','earn_subscribe',
    'earn_redeem','admin_adjustment','reversal','transfer_in','transfer_out'
  ]));

alter table public.financial_operations
  drop constraint if exists financial_operations_operation_type_check;
alter table public.financial_operations
  add constraint financial_operations_operation_type_check
  check (operation_type = any (array[
    'deposit_credit','withdraw_freeze','withdraw_approve','withdraw_reject',
    'withdraw_settle','earn_subscribe','earn_redeem','admin_adjustment',
    'spot_order_reserve','spot_trade','spot_order_cancel','seconds_open',
    'seconds_settle','wallet_transfer_in','wallet_transfer_out'
  ]));

create table if not exists public.btcbox_wallet_exchange_transfers (
  transfer_id uuid primary key default gen_random_uuid(),
  supabase_user_id uuid not null,
  btcbox_user_id text not null,
  asset_code text not null,
  direction text not null check (direction in ('wallet_to_exchange','exchange_to_wallet')),
  amount numeric(38,18) not null check (amount > 0),
  idempotency_key text not null check (length(idempotency_key) between 16 and 128),
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  wallet_operation_id uuid not null unique references public.btcbox_wallet_operations(operation_id) on delete restrict,
  exchange_operation_id uuid not null unique references public.financial_operations(id) on delete restrict,
  wallet_available_after numeric(38,18) not null check (wallet_available_after >= 0),
  exchange_available_after numeric(38,18) not null check (exchange_available_after >= 0),
  status text not null default 'completed' check (status = 'completed'),
  created_at timestamptz not null default now(),
  constraint btcbox_wallet_exchange_transfers_idempotency_unique
    unique (supabase_user_id, idempotency_key),
  constraint btcbox_wallet_exchange_transfers_auth_pair_fkey
    foreign key (supabase_user_id, btcbox_user_id)
    references public.btcbox_auth_accounts(supabase_user_id, btcbox_user_id) on delete restrict,
  constraint btcbox_wallet_exchange_transfers_asset_fkey
    foreign key (asset_code) references public.btcbox_assets(asset_code) on update restrict on delete restrict
);

create index if not exists btcbox_wallet_exchange_transfers_user_time_idx
  on public.btcbox_wallet_exchange_transfers(supabase_user_id, created_at desc);

alter table public.btcbox_wallet_exchange_transfers enable row level security;
revoke all on table public.btcbox_wallet_exchange_transfers from public, anon, authenticated;

create or replace function public.btcbox_transfer_wallet_exchange_v1(
  p_supabase_user_id uuid,
  p_asset_code text,
  p_direction text,
  p_amount numeric,
  p_idempotency_key text,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_btcbox_user_id text;
  v_user_status text;
  v_profile_status text;
  v_transfer public.btcbox_wallet_exchange_transfers%rowtype;
  v_wallet_account public.btcbox_wallet_accounts%rowtype;
  v_exchange_account public.financial_accounts%rowtype;
  v_transfer_id uuid := gen_random_uuid();
  v_wallet_operation_id uuid := gen_random_uuid();
  v_exchange_operation_id uuid := gen_random_uuid();
  v_wallet_available_after numeric(38,18);
  v_wallet_frozen_after numeric(38,18);
  v_exchange_available_after numeric(38,18);
  v_exchange_frozen_after numeric(38,18);
  v_wallet_operation_type text;
  v_exchange_operation_type text;
begin
  if p_supabase_user_id is null
     or coalesce(p_asset_code, '') !~ '^[A-Z0-9]{2,16}$'
     or p_direction not in ('wallet_to_exchange','exchange_to_wallet')
     or p_amount is null or p_amount <= 0
     or p_amount >= 100000000000000000000
     or scale(p_amount) > 18
     or length(coalesce(p_idempotency_key, '')) not between 16 and 128
     or coalesce(p_request_hash, '') !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid internal transfer request' using errcode = '22023';
  end if;

  -- Serialize same-user/same-asset transfers. Every transfer locks Wallet
  -- first and Exchange second, regardless of direction, to avoid deadlocks.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_supabase_user_id::text || ':' || p_asset_code, 0)
  );

  select a.btcbox_user_id into v_btcbox_user_id
  from public.btcbox_auth_accounts a
  where a.supabase_user_id = p_supabase_user_id
  for update;
  if not found then
    raise exception 'Verified BTCBOX account mapping not found' using errcode = '42501';
  end if;

  select u.status into v_user_status
  from public.btcbox_users u
  where u.user_id = v_btcbox_user_id
  for update;
  if not found or v_user_status <> 'active' then
    raise exception 'BTCBOX account is not active' using errcode = '42501';
  end if;

  select p.account_status into v_profile_status
  from public.btcbox_user_profiles p
  where p.user_id = p_supabase_user_id
  for update;
  if not found or v_profile_status <> 'active' then
    raise exception 'Wallet profile is not active' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.btcbox_assets a
    where a.asset_code = p_asset_code and a.active = true
  ) then
    raise exception 'Asset is not active' using errcode = '22023';
  end if;

  select * into v_transfer
  from public.btcbox_wallet_exchange_transfers t
  where t.supabase_user_id = p_supabase_user_id
    and t.idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_transfer.request_hash is distinct from p_request_hash
       or v_transfer.asset_code is distinct from p_asset_code
       or v_transfer.direction is distinct from p_direction
       or v_transfer.amount is distinct from p_amount then
      raise exception 'Transfer idempotency key payload mismatch' using errcode = '22023';
    end if;
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'transfer_id', v_transfer.transfer_id,
      'asset', v_transfer.asset_code,
      'direction', v_transfer.direction,
      'amount', v_transfer.amount,
      'wallet_available', v_transfer.wallet_available_after,
      'exchange_available', v_transfer.exchange_available_after,
      'wallet_operation_id', v_transfer.wallet_operation_id,
      'exchange_operation_id', v_transfer.exchange_operation_id
    );
  end if;

  -- Lock the Wallet account first for both directions. Never create a missing
  -- Wallet account here: auth initialization owns that lifecycle.
  select * into v_wallet_account
  from public.btcbox_wallet_accounts w
  where w.user_id = p_supabase_user_id and w.asset_code = p_asset_code
  for update;
  if not found then
    raise exception 'Wallet account not found' using errcode = 'P0002';
  end if;

  -- Exchange account rows may not exist until the first internal credit.
  insert into public.financial_accounts(user_id, asset)
  values (v_btcbox_user_id, p_asset_code)
  on conflict (user_id, asset) do nothing;

  select * into v_exchange_account
  from public.financial_accounts e
  where e.user_id = v_btcbox_user_id and e.asset = p_asset_code
  for update;
  if not found then
    raise exception 'Exchange account not found' using errcode = 'P0002';
  end if;

  if p_direction = 'wallet_to_exchange' then
    if v_wallet_account.available < p_amount then
      raise exception 'Insufficient Wallet available balance' using errcode = '22003';
    end if;
    v_wallet_operation_type := 'transfer_out';
    v_exchange_operation_type := 'wallet_transfer_in';
  else
    if v_exchange_account.available < p_amount then
      raise exception 'Insufficient Exchange available balance' using errcode = '22003';
    end if;
    v_wallet_operation_type := 'transfer_in';
    v_exchange_operation_type := 'wallet_transfer_out';
  end if;

  insert into public.btcbox_wallet_operations (
    operation_id, user_id, asset_code, operation_type, idempotency_key,
    request_hash, reference_type, reference_id, metadata
  ) values (
    v_wallet_operation_id, p_supabase_user_id, p_asset_code, v_wallet_operation_type,
    p_idempotency_key, p_request_hash, 'wallet_exchange_transfer', v_transfer_id::text,
    jsonb_build_object('direction', p_direction, 'transfer_id', v_transfer_id)
  );

  insert into public.financial_operations (
    id, idempotency_key, user_id, asset, operation_type, request_hash, metadata
  ) values (
    v_exchange_operation_id, 'wallet-exchange-transfer:' || v_transfer_id::text,
    v_btcbox_user_id, p_asset_code, v_exchange_operation_type, p_request_hash,
    jsonb_build_object('direction', p_direction, 'transfer_id', v_transfer_id)
  );

  if p_direction = 'wallet_to_exchange' then
    update public.btcbox_wallet_accounts
    set available = available - p_amount, version = version + 1, updated_at = now()
    where wallet_account_id = v_wallet_account.wallet_account_id
    returning available, frozen into v_wallet_available_after, v_wallet_frozen_after;

    update public.financial_accounts
    set available = available + p_amount, version = version + 1, updated_at = now()
    where user_id = v_btcbox_user_id and asset = p_asset_code
    returning available, frozen into v_exchange_available_after, v_exchange_frozen_after;
  else
    update public.btcbox_wallet_accounts
    set available = available + p_amount, version = version + 1, updated_at = now()
    where wallet_account_id = v_wallet_account.wallet_account_id
    returning available, frozen into v_wallet_available_after, v_wallet_frozen_after;

    update public.financial_accounts
    set available = available - p_amount, version = version + 1, updated_at = now()
    where user_id = v_btcbox_user_id and asset = p_asset_code
    returning available, frozen into v_exchange_available_after, v_exchange_frozen_after;
  end if;

  insert into public.btcbox_wallet_ledger (
    operation_id, wallet_account_id, user_id, asset_code,
    available_delta, frozen_delta, available_after, frozen_after
  ) values (
    v_wallet_operation_id, v_wallet_account.wallet_account_id, p_supabase_user_id, p_asset_code,
    case when p_direction = 'wallet_to_exchange' then -p_amount else p_amount end,
    0, v_wallet_available_after, v_wallet_frozen_after
  );

  insert into public.financial_ledger (
    operation_id, user_id, asset, available_delta, frozen_delta, available_after, frozen_after
  ) values (
    v_exchange_operation_id, v_btcbox_user_id, p_asset_code,
    case when p_direction = 'wallet_to_exchange' then p_amount else -p_amount end,
    0, v_exchange_available_after, v_exchange_frozen_after
  );

  insert into public.btcbox_wallet_exchange_transfers (
    transfer_id, supabase_user_id, btcbox_user_id, asset_code, direction,
    amount, idempotency_key, request_hash, wallet_operation_id,
    exchange_operation_id, wallet_available_after, exchange_available_after
  ) values (
    v_transfer_id, p_supabase_user_id, v_btcbox_user_id, p_asset_code, p_direction,
    p_amount, p_idempotency_key, p_request_hash, v_wallet_operation_id,
    v_exchange_operation_id, v_wallet_available_after, v_exchange_available_after
  );

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'transfer_id', v_transfer_id,
    'asset', p_asset_code,
    'direction', p_direction,
    'amount', p_amount,
    'wallet_available', v_wallet_available_after,
    'exchange_available', v_exchange_available_after,
    'wallet_operation_id', v_wallet_operation_id,
    'exchange_operation_id', v_exchange_operation_id
  );
end;
$$;

revoke all on function public.btcbox_transfer_wallet_exchange_v1(uuid, text, text, numeric, text, text) from public, anon, authenticated;
grant execute on function public.btcbox_transfer_wallet_exchange_v1(uuid, text, text, numeric, text, text) to service_role;
