-- BTCBOX Perpetual Contract (Contract / Perpetual) v1 — USDT-margined linear, isolated margin only.
-- Additive migration. Does NOT rewrite existing financial core (0002 ledger / 0008 spot matching).
-- Reuses public.financial_accounts / financial_operations / financial_ledger.
-- All money is numeric(38,18). Application layer MUST pass strings; never JS Number for settlement.
-- SAFETY: every write path is gated by the API-layer `perpetualEngineEnabled()` switch (default OFF).
--         Markets default enabled=false / status='paused'. No fake availability via UI.
-- Apply ONLY to a dedicated staging/test Supabase project first; run 0041 tests before any cutover.

create extension if not exists pgcrypto;

-- 1. Extend financial operation types (same pattern as 0008 / 0014).
alter table public.financial_operations drop constraint if exists financial_operations_operation_type_check;
alter table public.financial_operations add constraint financial_operations_operation_type_check
  check (operation_type in ('deposit_credit','withdraw_freeze','withdraw_approve','withdraw_reject',
    'earn_subscribe','earn_redeem','admin_adjustment','spot_trade','spot_order_reserve',
    'spot_order_cancel','migration_opening_balance',
    'perp_order_reserve','perp_trade','perp_order_cancel','perp_funding',
    'perp_liquidation','perp_insurance_cover','perp_bad_debt'));

-- Insurance fund is a normal financial account (platform-owned). Ensure it exists.
insert into public.financial_accounts(user_id, asset) values ('__perp_insurance__', 'USDT')
  on conflict do nothing;

-- 2. Markets / risk parameters (admin-managed).
create table if not exists public.perpetual_markets (
  symbol text primary key check (symbol ~ '^[A-Z0-9]{3,20}$'),
  base_asset text not null check (base_asset ~ '^[A-Z0-9]{2,16}$'),
  quote_asset text not null default 'USDT' check (quote_asset = 'USDT'),
  enabled boolean not null default false,
  status text not null default 'paused' check (status in ('trading','paused','open_only','liquidation_only')),
  price_tick numeric(38,18) not null check (price_tick > 0),
  quantity_step numeric(38,18) not null check (quantity_step > 0),
  min_quantity numeric(38,18) not null check (min_quantity > 0),
  max_quantity numeric(38,18) check (max_quantity is null or max_quantity > 0),
  max_position_notional numeric(38,18) check (max_position_notional is null or max_position_notional > 0),
  max_leverage integer not null default 10 check (max_leverage between 1 and 100), -- no unbounded leverage
  maintenance_margin_rate numeric(12,10) not null default 0.005 check (maintenance_margin_rate between 0 and 0.5),
  maker_fee_rate numeric(12,10) not null default 0 check (maker_fee_rate >= 0),
  taker_fee_rate numeric(12,10) not null default 0 check (taker_fee_rate >= 0),
  funding_interval_sec integer not null default 28800 check (funding_interval_sec > 0),
  funding_rate_cap numeric(12,10) not null default 0.0075 check (funding_rate_cap > 0),
  next_funding_at timestamptz,
  mark_price_stale_sec integer not null default 60 check (mark_price_stale_sec > 0),
  circuit_breaker_deviation_pct numeric(12,6) not null default 5 check (circuit_breaker_deviation_pct > 0),
  insurance_user_id text not null default '__perp_insurance__',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (base_asset <> quote_asset),
  check (max_quantity is null or min_quantity <= max_quantity)
);

-- 3. Orders (single authoritative order book lives here; price-time partial indexes below).
create table if not exists public.perpetual_orders (
  id text primary key,
  user_id text not null,
  symbol text not null,
  type text not null check (type in ('limit','market')),
  side text not null check (side in ('buy','sell')),
  price numeric(38,18) check (price is null or price > 0), -- null for market
  quantity numeric(38,18) not null check (quantity > 0),
  remaining_quantity numeric(38,18) not null check (remaining_quantity >= 0 and remaining_quantity <= quantity),
  leverage integer not null check (leverage >= 1),
  reduce_only boolean not null default false,
  close_position boolean not null default false,
  status text not null check (status in ('open','partially_filled','filled','cancelled','rejected')),
  client_order_id text not null check (length(client_order_id) between 16 and 100),
  reserve_operation_id uuid unique references public.financial_operations(id),
  reserved_margin numeric(38,18) not null default 0 check (reserved_margin >= 0),
  avg_fill_price numeric(38,18),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_order_id),
  check (type = 'market' or price is not null),
  check (not (close_position and not reduce_only)),
  check ((status in ('filled','cancelled','rejected') and remaining_quantity = 0)
      or (status in ('open','partially_filled') and remaining_quantity > 0))
);
create index if not exists perpetual_book_asks_idx
  on public.perpetual_orders(symbol, price asc, created_at asc, id)
  where side='sell' and status in ('open','partially_filled') and type='limit';
create index if not exists perpetual_book_bids_idx
  on public.perpetual_orders(symbol, price desc, created_at asc, id)
  where side='buy' and status in ('open','partially_filled') and type='limit';
create index if not exists perpetual_orders_user_idx on public.perpetual_orders(user_id, created_at desc);
create index if not exists perpetual_orders_symbol_status_idx on public.perpetual_orders(symbol, status);

-- 4. Net position per (user, symbol) — isolated margin, no hedge mode in v1.
create table if not exists public.perpetual_positions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  symbol text not null,
  side text not null check (side in ('long','short')),
  quantity numeric(38,18) not null check (quantity > 0),
  entry_price numeric(38,18) not null check (entry_price > 0),
  isolated_margin numeric(38,18) not null check (isolated_margin >= 0),
  realized_pnl numeric(38,18) not null default 0,
  funding_paid numeric(38,18) not null default 0,
  last_mark_price numeric(38,18),
  last_funding_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  unique (user_id, symbol)
);
create index if not exists perpetual_positions_symbol_idx on public.perpetual_positions(symbol);

-- 5. Fills / trades.
create table if not exists public.perpetual_trades (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  maker_order_id text not null references public.perpetual_orders(id),
  taker_order_id text not null references public.perpetual_orders(id),
  maker_user_id text not null,
  taker_user_id text not null,
  price numeric(38,18) not null check (price > 0),
  quantity numeric(38,18) not null check (quantity > 0),
  quote_amount numeric(38,18) not null check (quote_amount > 0),
  maker_fee numeric(38,18) not null check (maker_fee >= 0),
  taker_fee numeric(38,18) not null check (taker_fee >= 0),
  operation_id uuid not null unique references public.financial_operations(id),
  created_at timestamptz not null default now(),
  check (maker_user_id <> taker_user_id)
);
create index if not exists perpetual_trades_symbol_time_idx on public.perpetual_trades(symbol, created_at desc);
create index if not exists perpetual_trades_user_time_idx on public.perpetual_trades(taker_user_id, created_at desc);

-- 6. Idempotent cancellation.
create table if not exists public.perpetual_cancel_requests (
  user_id text not null,
  client_cancel_id text not null check (length(client_cancel_id) between 16 and 100 and client_cancel_id !~ '[^A-Za-z0-9_-]'),
  order_id text not null,
  request_hash text not null check (length(request_hash)=64 and request_hash !~ '[^0-9a-f]'),
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, client_cancel_id)
);

-- 7. Funding rates (auditable) + per-user settlement history (idempotent).
create table if not exists public.perpetual_funding_rates (
  symbol text not null,
  funding_at timestamptz not null,
  rate numeric(12,10) not null,
  premium_index numeric(12,10),
  mark_price numeric(38,18),
  index_price numeric(38,18),
  sources jsonb not null default '[]'::jsonb,
  settled boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (symbol, funding_at)
);
create table if not exists public.perpetual_funding_history (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  funding_at timestamptz not null,
  user_id text not null,
  position_side text not null check (position_side in ('long','short')),
  position_qty numeric(38,18) not null,
  notional numeric(38,18) not null,
  payment_delta numeric(38,18) not null, -- + = user receives, - = user pays
  operation_id uuid not null unique references public.financial_operations(id),
  created_at timestamptz not null default now(),
  unique (symbol, funding_at, user_id)
);

-- 8. Mark / index price feed (multi-source, auditable, stale-aware).
create table if not exists public.perpetual_mark_price_feed (
  id bigint generated always as identity primary key,
  symbol text not null,
  index_price numeric(38,18) not null check (index_price > 0),
  mark_price numeric(38,18) not null check (mark_price > 0),
  sources jsonb not null default '[]'::jsonb check (jsonb_typeof(sources) = 'array'),
  source_count integer not null check (source_count >= 1),
  max_deviation_pct numeric(12,6) not null check (max_deviation_pct >= 0),
  status text not null check (status in ('ok','degraded','stale')),
  created_at timestamptz not null default now()
);
create index if not exists perpetual_mark_feed_symbol_time_idx on public.perpetual_mark_price_feed(symbol, created_at desc);

-- 9. Liquidation events + position history (append-only audit).
create table if not exists public.perpetual_liquidation_events (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  symbol text not null,
  side text not null,
  quantity numeric(38,18) not null,
  entry_price numeric(38,18) not null,
  mark_price_at_liq numeric(38,18) not null,
  liquidation_price numeric(38,18) not null,
  bankruptcy_price numeric(38,18) not null,
  margin_lost numeric(38,18) not null,
  insurance_cover numeric(38,18) not null default 0,
  bad_debt numeric(38,18) not null default 0,
  operation_id uuid not null unique references public.financial_operations(id),
  created_at timestamptz not null default now()
);
create table if not exists public.perpetual_position_history (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  symbol text not null,
  side text not null,
  quantity numeric(38,18) not null,
  entry_price numeric(38,18) not null,
  close_price numeric(38,18) not null,
  realized_pnl numeric(38,18) not null,
  funding_paid numeric(38,18) not null,
  close_reason text not null check (close_reason in ('user_close','reduce_only','liquidation','flip')),
  closed_at timestamptz not null default now()
);

-- Privileges: service_role only (consistent with 0002/0008).
do $$
declare t text;
begin
  foreach t in array array['perpetual_markets','perpetual_orders','perpetual_positions','perpetual_trades',
    'perpetual_cancel_requests','perpetual_funding_rates','perpetual_funding_history',
    'perpetual_mark_price_feed','perpetual_liquidation_events','perpetual_position_history']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update on public.%I to service_role', t);
  end loop;
end $$;
grant usage, select on all sequences in schema public to service_role;
-- FIX (Critical-2): perp_apply_fill_to_position / liquidation delete positions; service_role needs DELETE.
grant delete on public.perpetual_positions to service_role;

-- ============================================================
-- Helper: latest fresh mark price for a symbol, or NULL if stale.
-- ============================================================
create or replace function public.perp_latest_mark_price(p_symbol text, p_max_age_sec integer)
returns table(mark_price numeric(38,18), index_price numeric(38,18), status text, age_sec numeric,
              source_count integer, max_deviation_pct numeric(12,6))
language sql security invoker set search_path = '' as $$
  select mark_price, index_price, f.status,
         extract(epoch from (now() - f.created_at))::numeric as age_sec,
         f.source_count, f.max_deviation_pct
  from public.perpetual_mark_price_feed f
  where f.symbol = p_symbol
    and (p_max_age_sec is null or f.created_at >= now() - (p_max_age_sec * interval '1 second'))
  order by f.created_at desc
  limit 1;
$$;

-- ============================================================
-- Helper: apply one fill to a user's net position (open/increase/decrease/close/flip).
-- Returns realized PnL settled this fill and the margin change (positive = lock more, negative = release).
-- p_fill_direction: 'buy' = +qty (long), 'sell' = -qty. Isolated margin target = notional/leverage.
-- ============================================================
create or replace function public.perp_apply_fill_to_position(
  p_user_id text, p_symbol text, p_fill_direction text, p_fill_qty numeric, p_fill_price numeric,
  p_leverage integer, p_mmr numeric
) returns table(realized_settled numeric(38,18), margin_delta numeric(38,18), closed boolean, close_reason text, new_side text, new_qty numeric(38,18))
language plpgsql security invoker set search_path = '' as $$
declare
  v_pos public.perpetual_positions%rowtype;
  v_dir integer := case when p_fill_direction='buy' then 1 else -1 end;
  v_new_signed numeric; -- signed qty: +long, -short
  v_existing_signed numeric := 0;
  v_realized numeric(38,18) := 0;
  v_margin_before numeric(38,18);
  v_margin_after numeric(38,18);
  v_close_reason text := null;
  v_closed boolean := false;
  v_entry numeric(38,18);
  v_side text;
  v_qty numeric(38,18);
begin
  select * into v_pos from public.perpetual_positions where user_id=p_user_id and symbol=p_symbol for update;
  if found then
    v_existing_signed := case when v_pos.side='long' then v_pos.quantity else -v_pos.quantity end;
  end if;
  v_new_signed := v_existing_signed + (v_dir * p_fill_qty);

  if v_existing_signed <> 0 and (v_new_signed = 0 or sign(v_new_signed) <> sign(v_existing_signed)) then
    -- fully or partially closes the existing position; realize PnL on the closed portion.
    declare v_closed_qty numeric(38,18) := least(abs(v_existing_signed), p_fill_qty);
            v_pnl_dir integer := case when v_pos.side='long' then 1 else -1 end;
    begin
      v_realized := v_pnl_dir * (p_fill_price - v_pos.entry_price) * v_closed_qty;
      if v_new_signed = 0 then
        v_closed := true; v_close_reason := 'user_close';
        insert into public.perpetual_position_history(user_id,symbol,side,quantity,entry_price,close_price,realized_pnl,funding_paid,close_reason)
        values (p_user_id,p_symbol,v_pos.side,v_pos.quantity,v_pos.entry_price,p_fill_price,v_pos.realized_pnl + v_realized,v_pos.funding_paid,'user_close');
        delete from public.perpetual_positions where id=v_pos.id;
        v_margin_before := v_pos.isolated_margin;
        v_margin_after := 0;
        return query select v_realized, (v_margin_after - v_margin_before), v_closed, v_close_reason, null::text, 0::numeric;
        return;
      else
        -- flip: close old, open opposite with remainder.
        v_closed := true; v_close_reason := 'flip';
        insert into public.perpetual_position_history(user_id,symbol,side,quantity,entry_price,close_price,realized_pnl,funding_paid,close_reason)
        values (p_user_id,p_symbol,v_pos.side,v_pos.quantity,v_pos.entry_price,p_fill_price,v_pos.realized_pnl + v_realized,v_pos.funding_paid,'flip');
        delete from public.perpetual_positions where id=v_pos.id;
        v_qty := abs(v_new_signed);
        v_side := case when v_new_signed > 0 then 'long' else 'short' end;
        v_entry := p_fill_price;
        v_margin_after := (v_qty * p_fill_price) / p_leverage;
        insert into public.perpetual_positions(user_id,symbol,side,quantity,entry_price,isolated_margin,realized_pnl,last_mark_price)
        values (p_user_id,p_symbol,v_side,v_qty,v_entry,v_margin_after,0,p_fill_price);
        return query select v_realized, (v_margin_after - v_pos.isolated_margin), true, 'flip', v_side, v_qty;
        return;
      end if;
    end;
  end if;

  if not found or v_existing_signed = 0 then
    -- open new.
    v_side := case when v_dir>0 then 'long' else 'short' end;
    v_qty := p_fill_qty; v_entry := p_fill_price;
    v_margin_after := (v_qty * p_fill_price) / p_leverage;
    insert into public.perpetual_positions(user_id,symbol,side,quantity,entry_price,isolated_margin,realized_pnl,last_mark_price)
    values (p_user_id,p_symbol,v_side,v_qty,v_entry,v_margin_after,0,p_fill_price);
    return query select 0::numeric, v_margin_after, false, null::text, v_side, v_qty;
    return;
  end if;

  -- same side: increase position, weighted-average entry; or reduce (but not close).
  if sign(v_existing_signed) = v_dir then
    v_qty := abs(v_new_signed);
    v_entry := (abs(v_existing_signed)*v_pos.entry_price + p_fill_qty*p_fill_price) / v_qty;
    v_margin_before := v_pos.isolated_margin;
    v_margin_after := (v_qty * p_fill_price) / p_leverage; -- re-mark margin at current fill price (conservative)
    update public.perpetual_positions set quantity=v_qty, entry_price=v_entry, isolated_margin=v_margin_after,
      last_mark_price=p_fill_price, updated_at=now() where id=v_pos.id;
    return query select 0::numeric, (v_margin_after - v_margin_before), false, null::text, v_pos.side, v_qty;
    return;
  else
    -- reduce only (partial).
    declare v_reduced_qty numeric(38,18) := p_fill_qty;
            v_pnl_dir integer := case when v_pos.side='long' then 1 else -1 end;
    begin
      v_realized := v_pnl_dir * (p_fill_price - v_pos.entry_price) * v_reduced_qty;
      v_qty := v_pos.quantity - v_reduced_qty;
      v_margin_before := v_pos.isolated_margin;
      v_margin_after := v_margin_before * (v_qty / v_pos.quantity); -- release margin pro-rata
      update public.perpetual_positions set quantity=v_qty, isolated_margin=v_margin_after,
        realized_pnl=realized_pnl + v_realized, last_mark_price=p_fill_price, updated_at=now() where id=v_pos.id;
      return query select v_realized, (v_margin_after - v_margin_before), false, null::text, v_pos.side, v_qty;
      return;
    end;
  end if;
end;
$$;

-- ============================================================
-- Submit order (limit or market) with matching. Isolated margin, reduce-only/close supported.
-- Locking order: (user,client_order_id) advisory lock, then (symbol) advisory lock -> single writer per market.
-- ============================================================
create or replace function public.perp_submit_order(
  p_order_id text, p_user_id text, p_symbol text, p_type text, p_side text,
  p_price numeric, p_quantity numeric, p_leverage integer,
  p_reduce_only boolean, p_close_position boolean, p_client_order_id text
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_market public.perpetual_markets%rowtype;
  v_existing public.perpetual_orders%rowtype;
  v_order public.perpetual_orders%rowtype;
  v_maker public.perpetual_orders%rowtype;
  v_mark record;
  v_request_hash text;
  v_operation_id uuid;
  v_fill_op_id uuid;
  v_reserve numeric(38,18);
  v_fill numeric(38,18);
  v_exec_price numeric(38,18);
  v_quote numeric(38,18);
  v_taker_fee numeric(38,18);
  v_maker_fee numeric(38,18);
  v_taker_pos record;
  v_maker_pos record;
  v_remaining numeric(38,18);
  v_filled_qty numeric(38,18) := 0;
  v_filled_quote numeric(38,18) := 0;
  v_pos_check record;
  v_reducible_remaining numeric(38,18); -- FIX (Medium): reduce-only fill cap = opposite position size; NULL = no cap.
begin
  -- 0. Input validation.
  if coalesce(p_order_id,'')='' or coalesce(p_user_id,'')='' or coalesce(p_symbol,'') !~ '^[A-Z0-9]{3,20}$'
     or p_type not in ('limit','market') or p_side not in ('buy','sell')
     or (p_type='limit' and (p_price is null or p_price<=0)) or p_quantity is null or p_quantity<=0
     or p_leverage is null or p_leverage < 1
     or coalesce(p_client_order_id,'') !~ '^[A-Za-z0-9_-]{16,100}$' then
    raise exception 'invalid perpetual order';
  end if;
  if p_close_position then p_reduce_only := true; end if;

  perform pg_advisory_xact_lock(hashtextextended('perp-order:'||p_user_id||':'||p_client_order_id, 0));
  perform pg_advisory_xact_lock(hashtextextended('perp-market:'||p_symbol, 0));

  -- 1. Idempotency replay.
  select * into v_existing from public.perpetual_orders where user_id=p_user_id and client_order_id=p_client_order_id;
  if found then
    if v_existing.symbol<>p_symbol or v_existing.type<>p_type or v_existing.side<>p_side
       or v_existing.leverage<>p_leverage or v_existing.quantity<>p_quantity
       or (v_existing.price is distinct from p_price) then
      raise exception 'client order id payload mismatch';
    end if;
    return jsonb_build_object('ok',true,'duplicate',true,'order_id',v_existing.id,'status',v_existing.status,
      'remaining_quantity',v_existing.remaining_quantity,'avg_fill_price',v_existing.avg_fill_price);
  end if;

  -- 2. Market & risk validation.
  select * into v_market from public.perpetual_markets where symbol=p_symbol and enabled=true;
  if not found then raise exception 'perpetual market disabled or unconfigured'; end if;
  if v_market.status not in ('trading','open_only') then raise exception 'perpetual market not accepting orders'; end if;
  if p_leverage > v_market.max_leverage then raise exception 'leverage exceeds market maximum'; end if;
  if mod(p_quantity, v_market.quantity_step) <> 0 then raise exception 'quantity precision invalid'; end if;
  if p_type='limit' and mod(p_price, v_market.price_tick) <> 0 then raise exception 'price precision invalid'; end if;
  if p_quantity < v_market.min_quantity then raise exception 'quantity below minimum'; end if;
  if v_market.max_quantity is not null and p_quantity > v_market.max_quantity then raise exception 'quantity above maximum'; end if;

  -- 3. Mark price freshness (circuit breaker): reject opens if feed stale/deviated.
  select * into v_mark from public.perp_latest_mark_price(p_symbol, v_market.mark_price_stale_sec);
  if v_mark is null or v_mark.status='stale'
     or (v_mark.age_sec > v_market.mark_price_stale_sec) then
    raise exception 'mark price unavailable or stale';
  end if;
  if v_mark.max_deviation_pct > v_market.circuit_breaker_deviation_pct and not p_reduce_only then
    raise exception 'price deviation circuit breaker active — reduce/close only';
  end if;

  -- 4. Reduce-only / close-position: validate opposite position exists; no margin reserve.
  if p_reduce_only or p_close_position then
    select * into v_pos_check from public.perpetual_positions where user_id=p_user_id and symbol=p_symbol for update;
    if not found or v_pos_check.quantity <= 0 then raise exception 'no position to reduce'; end if;
    if (v_pos_check.side='long' and p_side='buy') or (v_pos_check.side='short' and p_side='sell') then
      raise exception 'reduce-only order cannot increase position';
    end if;
    if p_close_position then p_quantity := v_pos_check.quantity; end if;
    v_reserve := 0;
    v_reducible_remaining := v_pos_check.quantity; -- FIX (Medium): reduce-only may fill at most the opposite position
  else
    -- 5. Opening/increasing: reserve initial margin + worst-case fee (over-reserve is safe).
    declare v_ref_price numeric(38,18) := coalesce(p_price, v_mark.mark_price);
    begin
      v_reducible_remaining := null; -- opening/increasing: no reduce cap
      v_reserve := (v_ref_price * p_quantity) / p_leverage
                 + (v_ref_price * p_quantity) * v_market.taker_fee_rate;
      if v_reserve <= 0 then raise exception 'invalid margin reserve'; end if;
      -- user max risk exposure check.
      if v_market.max_position_notional is not null then
        declare v_cur_notional numeric(38,18) := 0; begin
          select coalesce(sum(quantity*entry_price),0) into v_cur_notional
            from public.perpetual_positions where user_id=p_user_id and symbol=p_symbol;
          if v_cur_notional + v_ref_price*p_quantity > v_market.max_position_notional then
            raise exception 'position exceeds max risk exposure';
          end if;
        end;
      end if;
      -- atomic freeze via ledger.
      insert into public.financial_accounts(user_id,asset) values (p_user_id,'USDT') on conflict do nothing;
      perform 1 from public.financial_accounts where user_id=p_user_id and asset='USDT' for update;
      v_request_hash := encode(extensions.digest(concat_ws(':',p_user_id,p_symbol,p_side,p_type,coalesce(p_price,0)::text,p_quantity::text,p_leverage),'sha256'),'hex');
      insert into public.financial_operations(idempotency_key,user_id,asset,operation_type,request_hash,metadata)
      values ('perp-reserve-'||encode(extensions.digest(p_user_id||':'||p_client_order_id,'sha256'),'hex'),
        p_user_id,'USDT','perp_order_reserve',v_request_hash,
        jsonb_build_object('order_id',p_order_id,'symbol',p_symbol,'side',p_side,'leverage',p_leverage))
      returning id into v_operation_id;
      update public.financial_accounts set available=available-v_reserve, frozen=frozen+v_reserve,
        version=version+1, updated_at=now()
       where user_id=p_user_id and asset='USDT' and available >= v_reserve;
      if not found then raise exception 'insufficient margin'; end if;
      insert into public.financial_ledger(operation_id,user_id,asset,available_delta,frozen_delta,available_after,frozen_after)
      select v_operation_id, p_user_id, 'USDT', -v_reserve, v_reserve, available, frozen
        from public.financial_accounts where user_id=p_user_id and asset='USDT';
    end;
  end if;

  -- 6. Insert order.
  insert into public.perpetual_orders(id,user_id,symbol,type,side,price,quantity,remaining_quantity,leverage,
      reduce_only,close_position,status,client_order_id,reserve_operation_id,reserved_margin)
  values (p_order_id,p_user_id,p_symbol,p_type,p_side,p_price,p_quantity,p_quantity,p_leverage,
      coalesce(p_reduce_only,false), coalesce(p_close_position,false),'open',p_client_order_id,v_operation_id,v_reserve);

  -- 7. Matching loop (taker-driven, price-time priority).
  v_remaining := p_quantity;
  loop
    exit when v_remaining <= 0;
    select * into v_maker from public.perpetual_orders
      where symbol=p_symbol and type='limit' and side <> p_side
        and status in ('open','partially_filled') and user_id <> p_user_id
        and (p_type='market' or (p_side='buy' and price <= p_price) or (p_side='sell' and price >= p_price))
      order by case when p_side='buy' then price end asc,
               case when p_side='sell' then price end desc, created_at asc, id asc
      limit 1 for update;
    exit when not found;

    v_fill := least(v_remaining, v_maker.remaining_quantity, coalesce(v_reducible_remaining, v_remaining)); -- FIX (Medium): cap reduce-only fills at remaining position size
    v_exec_price := v_maker.price;
    v_quote := v_fill * v_exec_price;
    v_taker_fee := v_quote * v_market.taker_fee_rate;
    v_maker_fee := v_quote * v_market.maker_fee_rate;

    -- fill operation + ledger legs (taker & maker margin release / lock / realized pnl / fees).
    insert into public.financial_operations(idempotency_key,user_id,asset,operation_type,request_hash,metadata)
    values ('perp-fill-'||gen_random_uuid()::text, p_user_id, 'USDT','perp_trade',
      encode(extensions.digest(concat_ws(':',p_order_id,v_maker.id,v_fill::text,v_exec_price::text),'sha256'),'hex'),
      jsonb_build_object('symbol',p_symbol,'maker_order_id',v_maker.id,'taker_order_id',p_order_id))
    returning id into v_fill_op_id;

    -- apply to both positions; collect margin_delta & realized.
    select * into v_taker_pos from public.perp_apply_fill_to_position(p_user_id,p_symbol,p_side,v_fill,v_exec_price,p_leverage,v_market.maintenance_margin_rate);
    select * into v_maker_pos from public.perp_apply_fill_to_position(v_maker.user_id,p_symbol,v_maker.side,v_fill,v_exec_price,v_maker.leverage,v_market.maintenance_margin_rate);

    -- Taker: release reserved margin pro-rata against CURRENT remaining quantity; realized PnL & fees settle to available.
    declare v_taker_release numeric(38,18) := v_reserve * (v_fill / v_remaining);
            v_taker_net numeric(38,18);
    begin
      v_taker_net := v_taker_pos.realized_settled - v_taker_fee; -- +credit if profit
      -- FIX (Critical-1): isolated margin stays in frozen on open; released from frozen on close.
      -- frozen_delta = -v_release + margin_delta; available_delta = +v_release - margin_delta + v_net.
      -- Per-fill invariant: available_delta + frozen_delta = v_net (realized - fee); fees have their own insurance leg.
      update public.financial_accounts set frozen=frozen - v_taker_release + v_taker_pos.margin_delta,
        available=available + v_taker_release - v_taker_pos.margin_delta + v_taker_net,
        version=version+1, updated_at=now()
       where user_id=p_user_id and asset='USDT' and frozen >= v_taker_release - v_taker_pos.margin_delta;
      if not found then raise exception 'taker margin invariant failed'; end if;
      insert into public.financial_ledger(operation_id,user_id,asset,available_delta,frozen_delta,available_after,frozen_after)
      select v_fill_op_id, p_user_id, 'USDT', (v_taker_release - v_taker_pos.margin_delta + v_taker_net), (-v_taker_release + v_taker_pos.margin_delta), available, frozen
        from public.financial_accounts where user_id=p_user_id and asset='USDT';
      v_reserve := v_reserve - v_taker_release;
      -- keep taker order reserved_margin in sync with remaining reserve so cancel releases the correct amount.
      update public.perpetual_orders set reserved_margin=v_reserve, updated_at=now() where id=p_order_id;
    end;

    -- Maker: release its reserved margin pro-rata against its CURRENT remaining quantity; settle pnl-fee; credit fees to insurance fund.
    declare v_maker_release numeric(38,18) := v_maker.reserved_margin * (v_fill / v_maker.remaining_quantity);
            v_maker_net numeric(38,18);
    begin
      v_maker_net := v_maker_pos.realized_settled - v_maker_fee;
      -- FIX (Critical-1): same delta formula as taker — isolated margin moves within frozen, not vanished.
      update public.financial_accounts set frozen=frozen - v_maker_release + v_maker_pos.margin_delta,
        available=available + v_maker_release - v_maker_pos.margin_delta + v_maker_net,
        version=version+1, updated_at=now()
       where user_id=v_maker.user_id and asset='USDT' and frozen >= v_maker_release - v_maker_pos.margin_delta;
      if not found then raise exception 'maker margin invariant failed'; end if;
      insert into public.financial_ledger(operation_id,user_id,asset,available_delta,frozen_delta,available_after,frozen_after)
      select v_fill_op_id, v_maker.user_id, 'USDT', (v_maker_release - v_maker_pos.margin_delta + v_maker_net), (-v_maker_release + v_maker_pos.margin_delta), available, frozen
        from public.financial_accounts where user_id=v_maker.user_id and asset='USDT';
      update public.perpetual_orders set reserved_margin=reserved_margin-v_maker_release where id=v_maker.id;
    end;

    -- Fees -> insurance fund (platform account), same operation ledger leg.
    if v_taker_fee + v_maker_fee > 0 then
      update public.financial_accounts set available=available + (v_taker_fee + v_maker_fee),
        version=version+1, updated_at=now()
       where user_id=v_market.insurance_user_id and asset='USDT';
      insert into public.financial_ledger(operation_id,user_id,asset,available_delta,frozen_delta,available_after,frozen_after)
      select v_fill_op_id, v_market.insurance_user_id, 'USDT', (v_taker_fee+v_maker_fee), 0::numeric, available, frozen
        from public.financial_accounts where user_id=v_market.insurance_user_id and asset='USDT';
    end if;

    -- Persist fill.
    insert into public.perpetual_trades(symbol,maker_order_id,taker_order_id,maker_user_id,taker_user_id,
        price,quantity,quote_amount,maker_fee,taker_fee,operation_id)
    values (p_symbol,v_maker.id,p_order_id,v_maker.user_id,p_user_id,v_exec_price,v_fill,v_quote,v_maker_fee,v_taker_fee,v_fill_op_id);

    -- Update maker order.
    v_filled_qty := v_filled_qty + v_fill;
    v_filled_quote := v_filled_quote + v_quote;
    v_remaining := v_remaining - v_fill;
    update public.perpetual_orders set remaining_quantity=remaining_quantity-v_fill,
      status=case when remaining_quantity-v_fill<=0 then 'filled' else 'partially_filled' end,
      avg_fill_price=case when avg_fill_price is null then v_exec_price
                          else (avg_fill_price*(quantity-remaining_quantity)+v_exec_price*v_fill)/(quantity-remaining_quantity+v_fill) end,
      updated_at=now() where id=v_maker.id;
    if v_reducible_remaining is not null then -- FIX (Medium): reduce-only exhausted -> stop; never flip into reverse position
      v_reducible_remaining := v_reducible_remaining - v_fill;
      if v_reducible_remaining <= 0 then exit; end if;
    end if;
  end loop;

  -- 8. Finalize taker order.
  if v_remaining <= 0 then
    update public.perpetual_orders set remaining_quantity=0, status='filled', reserved_margin=0,
      avg_fill_price=case when v_filled_qty>0 then v_filled_quote/v_filled_qty else null end, updated_at=now()
      where id=p_order_id;
  elsif p_type='market' then
    -- market IOC: cancel unfilled remainder, release its reserve under a DEDICATED cancel operation
    -- (must not reuse v_operation_id: the reserve leg already holds unique(operation_id,user_id,asset)).
    if v_reserve > 0 then
      declare v_ioc_op uuid;
      begin
        insert into public.financial_operations(idempotency_key,user_id,asset,operation_type,request_hash,metadata)
        values ('perp-ioc-cancel-'||encode(extensions.digest(p_user_id||':'||p_order_id,'sha256'),'hex'),
          p_user_id,'USDT','perp_order_cancel',
          encode(extensions.digest(p_order_id||':'||v_reserve::text,'sha256'),'hex'),
          jsonb_build_object('order_id',p_order_id,'released',v_reserve,'reason','market_ioc_no_fill'))
        returning id into v_ioc_op;
        update public.financial_accounts set frozen=frozen-v_reserve, available=available+v_reserve, version=version+1, updated_at=now()
         where user_id=p_user_id and asset='USDT' and frozen >= v_reserve;
        if not found then raise exception 'market IOC margin release invariant failed'; end if;
        insert into public.financial_ledger(operation_id,user_id,asset,available_delta,frozen_delta,available_after,frozen_after)
        select v_ioc_op, p_user_id, 'USDT', v_reserve, -v_reserve, available, frozen
          from public.financial_accounts where user_id=p_user_id and asset='USDT';
      end;
    end if;
    update public.perpetual_orders set remaining_quantity=0, status='cancelled', reserved_margin=0, updated_at=now() where id=p_order_id;
  elsif p_reduce_only and v_reducible_remaining <= 0 then
    -- FIX (Medium): reduce-only limit order filled up to full position size; leftover quantity cancelled, never flips into reverse. v_reserve=0 for reduce-only so no margin to release.
    update public.perpetual_orders set remaining_quantity=0, status='cancelled', reserved_margin=0, updated_at=now() where id=p_order_id;
  else
    update public.perpetual_orders set remaining_quantity=v_remaining, reserved_margin=v_reserve,
      status=case when v_filled_qty>0 then 'partially_filled' else 'open' end,
      avg_fill_price=case when v_filled_qty>0 then v_filled_quote/v_filled_qty else null end, updated_at=now()
      where id=p_order_id;
  end if;

  return jsonb_build_object('ok',true,'duplicate',false,'order_id',p_order_id,
    'filled_quantity',v_filled_qty,'remaining_quantity',v_remaining,
    'avg_fill_price', case when v_filled_qty>0 then v_filled_quote/v_filled_qty else null end);
end;
$$;

-- ============================================================
-- Cancel order (idempotent). Releases reserved margin back to available.
-- ============================================================
create or replace function public.perp_cancel_order(
  p_user_id text, p_client_cancel_id text, p_order_id text
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_req public.perpetual_cancel_requests%rowtype;
  v_order public.perpetual_orders%rowtype;
  v_request_hash text;
  v_resp jsonb;
begin
  if coalesce(p_user_id,'')='' or coalesce(p_order_id,'')=''
     or coalesce(p_client_cancel_id,'') !~ '^[A-Za-z0-9_-]{16,100}$' then
    raise exception 'invalid cancel request';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('perp-cancel:'||p_user_id||':'||p_client_cancel_id, 0));
  select * into v_req from public.perpetual_cancel_requests where user_id=p_user_id and client_cancel_id=p_client_cancel_id;
  if found then
    if v_req.order_id <> p_order_id then raise exception 'cancel idempotency key payload mismatch'; end if;
    return v_req.response || jsonb_build_object('duplicate',true);
  end if;

  select * into v_order from public.perpetual_orders where id=p_order_id and user_id=p_user_id for update;
  if not found then
    v_resp := jsonb_build_object('ok',false,'error','order not found');
  elsif v_order.status in ('filled','cancelled','rejected') then
    v_resp := jsonb_build_object('ok',true,'duplicate',true,'order_id',p_order_id,'status',v_order.status);
  else
    -- release remaining reserved margin.
    if v_order.reserved_margin > 0 and v_order.reserve_operation_id is not null then
      update public.financial_accounts set frozen=frozen-v_order.reserved_margin,
        available=available+v_order.reserved_margin, version=version+1, updated_at=now()
       where user_id=p_user_id and asset='USDT' and frozen >= v_order.reserved_margin;
      if not found then raise exception 'cancel margin release invariant failed'; end if;
      insert into public.financial_operations(idempotency_key,user_id,asset,operation_type,request_hash,metadata)
      values ('perp-cancel-'||encode(extensions.digest(p_user_id||':'||p_client_cancel_id,'sha256'),'hex'),
        p_user_id,'USDT','perp_order_cancel',
        encode(extensions.digest(p_order_id||':'||v_order.remaining_quantity::text,'sha256'),'hex'),
        jsonb_build_object('order_id',p_order_id))
      returning id into v_order.reserve_operation_id;
      insert into public.financial_ledger(operation_id,user_id,asset,available_delta,frozen_delta,available_after,frozen_after)
      select v_order.reserve_operation_id, p_user_id, 'USDT', v_order.reserved_margin, -v_order.reserved_margin, available, frozen
        from public.financial_accounts where user_id=p_user_id and asset='USDT';
    end if;
    update public.perpetual_orders set status='cancelled', remaining_quantity=0, reserved_margin=0, updated_at=now() where id=p_order_id;
    v_resp := jsonb_build_object('ok',true,'order_id',p_order_id,'status','cancelled');
  end if;

  insert into public.perpetual_cancel_requests(user_id,client_cancel_id,order_id,request_hash,response)
  values (p_user_id,p_client_cancel_id,p_order_id,
    encode(extensions.digest(p_user_id||':'||p_order_id,'sha256'),'hex'), v_resp);
  return v_resp;
end;
$$;

-- ============================================================
-- Record mark/index price from aggregated sources (worker writes; RPC validates deviation).
-- ============================================================
create or replace function public.perp_record_mark_price(
  p_symbol text, p_index_price numeric, p_mark_price numeric, p_sources jsonb, p_max_age_sec integer
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_count integer;
  v_max_dev numeric(12,6);
  v_status text;
  v_src jsonb;
  v_prices numeric[];
  i integer;
  v_mean numeric;
begin
  if p_sources is null or jsonb_typeof(p_sources) <> 'array' or jsonb_array_length(p_sources) < 2 then
    raise exception 'mark price requires at least 2 sources';
  end if;
  v_count := jsonb_array_length(p_sources);
  v_mean := 0;
  for i in 0..v_count-1 loop
    v_src := p_sources->i;
    v_mean := v_mean + (v_src->>'price')::numeric;
  end loop;
  v_mean := v_mean / v_count;
  v_max_dev := 0;
  for i in 0..v_count-1 loop
    v_src := p_sources->i;
    v_max_dev := greatest(v_max_dev, abs(((v_src->>'price')::numeric - v_mean)/v_mean)*100);
  end loop;
  v_status := case when v_count >= 3 and v_max_dev < 2 then 'ok'
                   when v_count >= 2 then 'degraded' else 'stale' end;
  insert into public.perpetual_mark_price_feed(symbol,index_price,mark_price,sources,source_count,max_deviation_pct,status)
  values (p_symbol,p_index_price,p_mark_price,p_sources,v_count,v_max_dev,v_status);
  return jsonb_build_object('ok',true,'status',v_status,'source_count',v_count,'max_deviation_pct',v_max_dev);
end;
$$;

-- ============================================================
-- Settle funding for one user at one interval (idempotent). positive rate => long pays short.
-- ============================================================
create or replace function public.perp_settle_funding_one(
  p_symbol text, p_funding_at timestamptz, p_rate numeric, p_user_id text
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_pos public.perpetual_positions%rowtype;
  v_rate public.perpetual_funding_rates%rowtype;
  v_op uuid;
  v_notional numeric(38,18);
  v_payment numeric(38,18); -- signed: +receive, -pay
  v_idem text;
  v_avail_before numeric(38,18);
  v_frozen_before numeric(38,18);
  v_avail_delta numeric(38,18) := 0;
  v_frozen_delta numeric(38,18) := 0;
begin
  select * into v_rate from public.perpetual_funding_rates where symbol=p_symbol and funding_at=p_funding_at;
  if not found then raise exception 'funding rate not recorded'; end if;
  v_idem := 'perp-funding-'||p_symbol||'-'||floor(extract(epoch from p_funding_at))::text||'-'||p_user_id;
  if exists (select 1 from public.financial_operations where idempotency_key=v_idem) then
    return jsonb_build_object('ok',true,'duplicate',true);
  end if;
  select * into v_pos from public.perpetual_positions where user_id=p_user_id and symbol=p_symbol for update;
  if not found then return jsonb_build_object('ok',true,'no_position',true); end if;
  v_notional := v_pos.quantity * coalesce(v_rate.mark_price, v_pos.entry_price);
  -- long pays when rate>0: long payment = -rate*notional; short receives +rate*notional.
  v_payment := case when v_pos.side='long' then -p_rate else p_rate end * v_notional;

  insert into public.financial_accounts(user_id,asset) values (p_user_id,'USDT') on conflict do nothing;
  perform 1 from public.financial_accounts where user_id=p_user_id and asset='USDT' for update;
  insert into public.financial_operations(idempotency_key,user_id,asset,operation_type,request_hash,metadata)
  values (v_idem,p_user_id,'USDT','perp_funding',
    encode(extensions.digest(v_idem||':'||v_payment::text,'sha256'),'hex'),
    jsonb_build_object('symbol',p_symbol,'funding_at',p_funding_at,'rate',p_rate))
  returning id into v_op;
  select available, frozen into v_avail_before, v_frozen_before from public.financial_accounts where user_id=p_user_id and asset='USDT';
  if v_payment < 0 then
    if v_avail_before >= -v_payment then
      update public.financial_accounts set available=available+v_payment, version=version+1, updated_at=now()
       where user_id=p_user_id and asset='USDT';
      v_avail_delta := v_payment; v_frozen_delta := 0;
    else
      -- pay what you can from available, rest from isolated margin (frozen).
      declare v_from_avail numeric(38,18) := -v_avail_before; -- negative
              v_from_margin numeric(38,18) := v_payment - v_from_avail; -- negative
      begin
        update public.financial_accounts set available=0, frozen=frozen+v_from_margin, version=version+1, updated_at=now()
         where user_id=p_user_id and asset='USDT' and frozen >= -v_from_margin;
        if not found then raise exception 'funding debit invariant failed'; end if;
        update public.perpetual_positions set isolated_margin=greatest(isolated_margin + v_from_margin, 0), funding_paid=funding_paid - v_payment, updated_at=now()
         where id=v_pos.id;
        v_avail_delta := v_from_avail; v_frozen_delta := v_from_margin;
      end;
    end if;
  else
    update public.financial_accounts set available=available+v_payment, version=version+1, updated_at=now()
     where user_id=p_user_id and asset='USDT';
    v_avail_delta := v_payment; v_frozen_delta := 0;
  end if;
  insert into public.financial_ledger(operation_id,user_id,asset,available_delta,frozen_delta,available_after,frozen_after)
  select v_op, p_user_id, 'USDT', v_avail_delta, v_frozen_delta, available, frozen
    from public.financial_accounts where user_id=p_user_id and asset='USDT';
  update public.perpetual_positions set funding_paid=funding_paid - v_payment, last_funding_at=p_funding_at, updated_at=now() where id=v_pos.id;
  insert into public.perpetual_funding_history(symbol,funding_at,user_id,position_side,position_qty,notional,payment_delta,operation_id)
  values (p_symbol,p_funding_at,p_user_id,v_pos.side,v_pos.quantity,v_notional,v_payment,v_op);
  return jsonb_build_object('ok',true,'payment_delta',v_payment);
end;
$$;

-- ============================================================
-- Liquidation check + execute. Uses mark price; loss waterfall: margin -> insurance -> bad_debt logged.
-- Idempotent via operation id.
-- ============================================================
create or replace function public.perp_liquidate_position(p_user_id text, p_symbol text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_pos public.perpetual_positions%rowtype;
  v_market public.perpetual_markets%rowtype;
  v_mark record;
  v_liq_price numeric(38,18);
  v_bankruptcy numeric(38,18);
  v_notional numeric(38,18);
  v_mm numeric(38,18);
  v_loss numeric(38,18);
  v_insurance_cover numeric(38,18) := 0;
  v_bad_debt numeric(38,18) := 0;
  v_op uuid;
  v_idem text;
  v_close_price numeric(38,18);
  v_orders_reserved numeric(38,18) := 0;
  v_total_frozen_release numeric(38,18);
begin
  select * into v_pos from public.perpetual_positions where user_id=p_user_id and symbol=p_symbol for update;
  if not found then return jsonb_build_object('ok',true,'no_position',true); end if;
  select * into v_market from public.perpetual_markets where symbol=p_symbol;
  select * into v_mark from public.perp_latest_mark_price(p_symbol, v_market.mark_price_stale_sec);
  if v_mark is null or v_mark.status='stale' or v_mark.age_sec > v_market.mark_price_stale_sec then
    raise exception 'mark price stale — liquidation paused (positions protected)';
  end if;

  v_notional := v_pos.quantity * v_mark.mark_price;
  v_mm := v_notional * v_market.maintenance_margin_rate;
  -- liquidation price: where isolated_margin + unrealized = maintenance margin.
  if v_pos.side='long' then
    v_liq_price := v_pos.entry_price * (1 - (v_pos.isolated_margin - v_mm)/v_notional);
    if v_mark.mark_price > v_liq_price then return jsonb_build_object('ok',true,'liquidatable',false,'mark',v_mark.mark_price,'liq_price',v_liq_price); end if;
    v_bankruptcy := v_pos.entry_price * (1 - v_pos.isolated_margin/v_notional);
    v_close_price := greatest(v_mark.mark_price, v_bankruptcy);
    v_loss := (v_pos.entry_price - v_close_price) * v_pos.quantity; -- loss to margin
  else
    v_liq_price := v_pos.entry_price * (1 + (v_pos.isolated_margin - v_mm)/v_notional);
    if v_mark.mark_price < v_liq_price then return jsonb_build_object('ok',true,'liquidatable',false,'mark',v_mark.mark_price,'liq_price',v_liq_price); end if;
    v_bankruptcy := v_pos.entry_price * (1 + v_pos.isolated_margin/v_notional);
    v_close_price := least(v_mark.mark_price, v_bankruptcy);
    v_loss := (v_close_price - v_pos.entry_price) * v_pos.quantity;
  end if;

  v_idem := 'perp-liq-'||v_pos.id::text;
  if exists (select 1 from public.financial_operations where idempotency_key = v_idem) then
    return jsonb_build_object('ok',true,'duplicate',true);
  end if;

  -- Loss absorbed by isolated margin (already frozen). Excess loss beyond margin -> insurance -> bad debt.
  if v_loss > v_pos.isolated_margin then
    declare v_excess numeric(38,18) := v_loss - v_pos.isolated_margin;
            v_ins_bal numeric(38,18);
    begin
      select available into v_ins_bal from public.financial_accounts where user_id=v_market.insurance_user_id and asset='USDT' for update;
      v_insurance_cover := least(v_excess, coalesce(v_ins_bal,0));
      v_bad_debt := v_excess - v_insurance_cover;
      if v_insurance_cover > 0 then
        update public.financial_accounts set available=available-v_insurance_cover, version=version+1, updated_at=now()
         where user_id=v_market.insurance_user_id and asset='USDT';
      end if;
    end;
  end if;

  insert into public.financial_operations(idempotency_key,user_id,asset,operation_type,request_hash,metadata)
  values (v_idem, p_user_id,'USDT','perp_liquidation',
    encode(extensions.digest(v_idem,'sha256'),'hex'),
    jsonb_build_object('symbol',p_symbol,'mark_price',v_mark.mark_price,'liq_price',v_liq_price))
  returning id into v_op;
  -- release frozen margin: isolated position margin PLUS reserved margin on still-open orders (else funds stuck frozen).
  select coalesce(sum(reserved_margin),0) into v_orders_reserved
    from public.perpetual_orders where user_id=p_user_id and symbol=p_symbol and status in ('open','partially_filled');
  v_total_frozen_release := v_pos.isolated_margin + v_orders_reserved;
  -- loss is absorbed by frozen margin (no credit back); open-order reserved margin is simply released back to frozen->available? No:
  -- reserved margin was frozen for orders; on liquidation those orders cancel, so reserved margin returns to available (it was never lost).
  -- Accounting: isolated_margin is consumed (frozen down, no available up); orders' reserved margin returns to available.
  update public.financial_accounts set frozen=frozen-v_total_frozen_release,
    available=available + v_orders_reserved, version=version+1, updated_at=now()
   where user_id=p_user_id and asset='USDT' and frozen >= v_total_frozen_release;
  if not found then raise exception 'liquidation frozen release invariant failed'; end if;
  insert into public.financial_ledger(operation_id,user_id,asset,available_delta,frozen_delta,available_after,frozen_after)
  select v_op, p_user_id, 'USDT', v_orders_reserved, -v_total_frozen_release, available, frozen
    from public.financial_accounts where user_id=p_user_id and asset='USDT';
  if v_insurance_cover > 0 then
    insert into public.financial_ledger(operation_id,user_id,asset,available_delta,frozen_delta,available_after,frozen_after)
    select v_op, v_market.insurance_user_id, 'USDT', -v_insurance_cover, 0::numeric, available, frozen
      from public.financial_accounts where user_id=v_market.insurance_user_id and asset='USDT';
  end if;

  insert into public.perpetual_position_history(user_id,symbol,side,quantity,entry_price,close_price,realized_pnl,funding_paid,close_reason)
  values (p_user_id,p_symbol,v_pos.side,v_pos.quantity,v_pos.entry_price,v_close_price,v_pos.realized_pnl - v_loss,v_pos.funding_paid,'liquidation');
  insert into public.perpetual_liquidation_events(user_id,symbol,side,quantity,entry_price,mark_price_at_liq,liquidation_price,bankruptcy_price,margin_lost,insurance_cover,bad_debt,operation_id)
  values (p_user_id,p_symbol,v_pos.side,v_pos.quantity,v_pos.entry_price,v_mark.mark_price,v_liq_price,v_bankruptcy,v_pos.isolated_margin,v_insurance_cover,v_bad_debt,v_op);
  delete from public.perpetual_positions where id=v_pos.id;
  -- cancel any open orders for this user/symbol (reduce exposure); reserved margin already released above.
  update public.perpetual_orders set status='cancelled', remaining_quantity=0, reserved_margin=0, updated_at=now()
   where user_id=p_user_id and symbol=p_symbol and status in ('open','partially_filled');

  return jsonb_build_object('ok',true,'liquidated',true,'liq_price',v_liq_price,'mark_price',v_mark.mark_price,
    'margin_lost',v_pos.isolated_margin,'insurance_cover',v_insurance_cover,'bad_debt',v_bad_debt);
end;
$$;

revoke all on function public.perp_submit_order(text,text,text,text,text,numeric,numeric,integer,boolean,boolean,text) from public, anon, authenticated;
revoke all on function public.perp_cancel_order(text,text,text) from public, anon, authenticated;
revoke all on function public.perp_record_mark_price(text,numeric,numeric,jsonb,integer) from public, anon, authenticated;
revoke all on function public.perp_settle_funding_one(text,timestamptz,numeric,text) from public, anon, authenticated;
revoke all on function public.perp_liquidate_position(text,text) from public, anon, authenticated;
revoke all on function public.perp_latest_mark_price(text,integer) from public, anon, authenticated;
revoke all on function public.perp_apply_fill_to_position(text,text,text,numeric,numeric,integer,numeric) from public, anon, authenticated;
grant execute on function public.perp_submit_order(text,text,text,text,text,numeric,numeric,integer,boolean,boolean,text) to service_role;
grant execute on function public.perp_cancel_order(text,text,text) to service_role;
grant execute on function public.perp_record_mark_price(text,numeric,numeric,jsonb,integer) to service_role;
grant execute on function public.perp_settle_funding_one(text,timestamptz,numeric,text) to service_role;
grant execute on function public.perp_liquidate_position(text,text) to service_role;
grant execute on function public.perp_latest_mark_price(text,integer) to service_role;
grant execute on function public.perp_apply_fill_to_position(text,text,text,numeric,numeric,integer,numeric) to service_role;
