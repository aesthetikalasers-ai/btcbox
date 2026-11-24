-- 0046_perpetual_funding_atomic_clearing_v1.sql
-- Close the funding-worker race window and add an auditable counter-entry.
-- A market boundary is settled in one transaction while holding the same
-- advisory market lock used by order submission, cancellation and liquidation.
-- User balances continue to use the existing financial_accounts/ledger core.

create table if not exists public.perpetual_funding_clearing_ledger (
  id bigint generated always as identity primary key,
  operation_id uuid not null unique references public.financial_operations(id),
  symbol text not null,
  funding_at timestamptz not null,
  user_id text not null,
  payment_delta numeric(38,18) not null,
  clearing_delta numeric(38,18) not null,
  created_at timestamptz not null default now(),
  unique (symbol, funding_at, user_id),
  check (clearing_delta = -payment_delta)
);

-- Preserve an auditable counter-entry if any funding was settled by the
-- previous one-user worker before this migration was applied.
insert into public.perpetual_funding_clearing_ledger
  (operation_id, symbol, funding_at, user_id, payment_delta, clearing_delta)
select operation_id, symbol, funding_at, user_id, payment_delta, -payment_delta
  from public.perpetual_funding_history
on conflict do nothing;

alter table public.perpetual_funding_clearing_ledger enable row level security;
revoke all on public.perpetual_funding_clearing_ledger from public, anon, authenticated;
grant select, insert on public.perpetual_funding_clearing_ledger to service_role;
do $$
declare v_sequence text := pg_get_serial_sequence('public.perpetual_funding_clearing_ledger','id');
begin
  if v_sequence is not null then
    execute format('grant usage, select on sequence %s to service_role', v_sequence);
  end if;
end;
$$;

create or replace function public.perp_settle_funding_one(
  p_symbol text, p_funding_at timestamptz, p_rate numeric, p_user_id text
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_pos public.perpetual_positions%rowtype;
  v_rate public.perpetual_funding_rates%rowtype;
  v_market public.perpetual_markets%rowtype;
  v_op uuid;
  v_notional numeric(38,18);
  v_payment numeric(38,18);
  v_idem text;
  v_avail_before numeric(38,18);
  v_frozen_before numeric(38,18);
  v_avail_delta numeric(38,18) := 0;
  v_frozen_delta numeric(38,18) := 0;
begin
  if coalesce(p_user_id,'') = '' or p_symbol is null
     or p_symbol !~ '^[A-Z0-9]{3,20}$' or p_funding_at is null then
    raise exception 'invalid perpetual funding settlement identity';
  end if;

  -- Match the market lock used by order entry/cancel/liquidation. The batch
  -- wrapper holds it for the whole boundary; this also protects direct RPC use.
  perform pg_advisory_xact_lock(hashtextextended('perp-market:'||p_symbol, 0));

  select * into v_market from public.perpetual_markets where symbol=p_symbol for update;
  if not found then raise exception 'perpetual market configuration missing'; end if;
  if v_market.next_funding_at is null or v_market.next_funding_at <> p_funding_at
     or p_funding_at > now() then
    raise exception 'funding boundary is not current and due';
  end if;

  select * into v_rate from public.perpetual_funding_rates
   where symbol=p_symbol and funding_at=p_funding_at;
  if not found then raise exception 'funding rate not recorded'; end if;
  if abs(v_rate.rate) > v_market.funding_rate_cap then
    raise exception 'funding rate exceeds market cap';
  end if;
  if p_rate is null or p_rate is distinct from v_rate.rate then
    raise exception 'funding rate argument does not match the persisted snapshot';
  end if;
  if v_rate.settled then
    raise exception 'funding rate snapshot is already settled';
  end if;
  if v_rate.mark_price is null or v_rate.mark_price <= 0
     or v_rate.index_price is null or v_rate.index_price <= 0
     or v_rate.premium_index is null then
    raise exception 'funding requires a validated premium/index/mark snapshot';
  end if;
  if jsonb_typeof(v_rate.sources) <> 'array'
     or jsonb_array_length(v_rate.sources) < 2 then
    raise exception 'funding requires at least two recorded source samples';
  end if;
  if exists (
    select 1
      from jsonb_array_elements(v_rate.sources) s
     where coalesce(s->>'source','') not in ('binance','okx','coingecko')
  ) or (
    select count(distinct s->>'source')
      from jsonb_array_elements(v_rate.sources) s
  ) < 2 then
    raise exception 'funding source samples are invalid or duplicated';
  end if;

  v_idem := 'perp-funding-'||p_symbol||'-'||floor(extract(epoch from p_funding_at))::text||'-'||p_user_id;
  if exists (select 1 from public.financial_operations where idempotency_key=v_idem) then
    return jsonb_build_object('ok',true,'duplicate',true);
  end if;

  select * into v_pos from public.perpetual_positions
   where user_id=p_user_id and symbol=p_symbol and closed_at is null for update;
  if not found then return jsonb_build_object('ok',true,'no_position',true); end if;

  v_notional := v_pos.quantity * coalesce(v_rate.mark_price, v_pos.entry_price);
  -- Positive rate: long pays, short receives. The persisted rate is authoritative.
  v_payment := case when v_pos.side='long' then -v_rate.rate else v_rate.rate end * v_notional;

  -- A live position must already have its canonical USDT financial account.
  -- Never create a zero-balance account during settlement; missing account is corruption.
  insert into public.financial_operations(idempotency_key,user_id,asset,operation_type,request_hash,metadata)
  values (v_idem,p_user_id,'USDT','perp_funding',
    encode(extensions.digest(v_idem||':'||v_payment::text,'sha256'),'hex'),
    jsonb_build_object('symbol',p_symbol,'funding_at',p_funding_at,'rate',v_rate.rate))
  returning id into v_op;

  select available, frozen into v_avail_before, v_frozen_before
    from public.financial_accounts where user_id=p_user_id and asset='USDT' for update;
  if not found then
    raise exception 'funding financial account missing for existing position';
  end if;

  if v_payment < 0 then
    if v_avail_before >= -v_payment then
      update public.financial_accounts set available=available+v_payment, version=version+1, updated_at=now()
       where user_id=p_user_id and asset='USDT';
      v_avail_delta := v_payment;
    else
      -- Consume only this isolated position's collateral for the shortfall.
      declare v_from_avail numeric(38,18) := -v_avail_before;
              v_from_margin numeric(38,18) := v_payment - v_from_avail;
      begin
        update public.financial_accounts set available=0, frozen=frozen+v_from_margin, version=version+1, updated_at=now()
         where user_id=p_user_id and asset='USDT' and frozen >= -v_from_margin;
        if not found then raise exception 'funding debit invariant failed'; end if;
        update public.perpetual_positions
           set isolated_margin=isolated_margin + v_from_margin, updated_at=now()
         where id=v_pos.id and isolated_margin >= -v_from_margin;
        if not found then raise exception 'funding isolated margin invariant failed'; end if;
        v_avail_delta := v_from_avail;
        v_frozen_delta := v_from_margin;
      end;
    end if;
  elsif v_payment > 0 then
    update public.financial_accounts set available=available+v_payment, version=version+1, updated_at=now()
     where user_id=p_user_id and asset='USDT';
    v_avail_delta := v_payment;
  end if;

  insert into public.financial_ledger(operation_id,user_id,asset,available_delta,frozen_delta,available_after,frozen_after)
  select v_op, p_user_id, 'USDT', v_avail_delta, v_frozen_delta, available, frozen
    from public.financial_accounts where user_id=p_user_id and asset='USDT';

  -- Signed counter-entry: every user credit/debit has an equal opposite
  -- clearing movement. This is an auditable subledger, not a customer account.
  insert into public.perpetual_funding_clearing_ledger
    (operation_id,symbol,funding_at,user_id,payment_delta,clearing_delta)
  values (v_op,p_symbol,p_funding_at,p_user_id,v_payment,-v_payment);

  update public.perpetual_positions
     set funding_paid=funding_paid - v_payment, last_funding_at=p_funding_at, updated_at=now()
   where id=v_pos.id;
  insert into public.perpetual_funding_history(symbol,funding_at,user_id,position_side,position_qty,notional,payment_delta,operation_id)
  values (p_symbol,p_funding_at,p_user_id,v_pos.side,v_pos.quantity,v_notional,v_payment,v_op);
  return jsonb_build_object('ok',true,'payment_delta',v_payment);
end;
$$;

create or replace function public.perp_settle_funding_market(
  p_symbol text, p_funding_at timestamptz
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_market public.perpetual_markets%rowtype;
  v_rate public.perpetual_funding_rates%rowtype;
  v_pos record;
  v_result jsonb;
  v_settled integer := 0;
  v_duplicates integer := 0;
  v_no_position integer := 0;
begin
  if p_symbol is null or p_symbol !~ '^[A-Z0-9]{3,20}$' or p_funding_at is null then
    raise exception 'invalid perpetual market funding boundary';
  end if;
  if p_funding_at > now() then
    raise exception 'funding boundary is not due';
  end if;

  -- Same lock key as perp_submit_order/perp_cancel_order/perp_liquidate_position.
  -- No order can open or change a position while the boundary is being settled.
  perform pg_advisory_xact_lock(hashtextextended('perp-market:'||p_symbol, 0));

  select * into v_market from public.perpetual_markets
   where symbol=p_symbol for update;
  if not found then raise exception 'perpetual market configuration missing'; end if;
  if v_market.next_funding_at is null or v_market.next_funding_at <> p_funding_at then
    return jsonb_build_object('ok',true,'stale_boundary',true,'symbol',p_symbol,
      'expected_funding_at',v_market.next_funding_at);
  end if;

  -- A due boundary is never converted into a synthetic zero-rate event.
  -- A separate trusted rate producer must persist a complete premium/index/mark
  -- snapshot first. Missing or stale samples fail closed and do not advance time.
  select * into v_rate from public.perpetual_funding_rates
   where symbol=p_symbol and funding_at=p_funding_at for update;
  if not found then raise exception 'validated funding rate snapshot missing'; end if;
  if v_rate.settled then raise exception 'funding rate snapshot already settled'; end if;
  if abs(v_rate.rate) > v_market.funding_rate_cap then
    raise exception 'funding rate exceeds market cap';
  end if;
  if v_rate.mark_price is null or v_rate.mark_price <= 0
     or v_rate.index_price is null or v_rate.index_price <= 0
     or v_rate.premium_index is null then
    raise exception 'funding snapshot is incomplete';
  end if;
  if jsonb_typeof(v_rate.sources) <> 'array'
     or jsonb_array_length(v_rate.sources) < 2 then
    raise exception 'funding snapshot has insufficient source samples';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_rate.sources) s
     where coalesce(s->>'source','') not in ('binance','okx','coingecko')
  ) or (
    select count(distinct s->>'source')
      from jsonb_array_elements(v_rate.sources) s
  ) < 2 then
    raise exception 'funding snapshot sources are invalid or duplicated';
  end if;

  for v_pos in
    select user_id from public.perpetual_positions
     where symbol=p_symbol and closed_at is null
     order by user_id
     for update
  loop
    v_result := public.perp_settle_funding_one(p_symbol,p_funding_at,v_rate.rate,v_pos.user_id);
    if coalesce((v_result->>'ok')::boolean,false) is not true then
      raise exception 'funding settlement failed for market %', p_symbol;
    end if;
    if coalesce((v_result->>'duplicate')::boolean,false) then
      v_duplicates := v_duplicates + 1;
    elsif coalesce((v_result->>'no_position')::boolean,false) then
      v_no_position := v_no_position + 1;
    else
      v_settled := v_settled + 1;
    end if;
  end loop;

  update public.perpetual_funding_rates set settled=true
   where symbol=p_symbol and funding_at=p_funding_at;
  update public.perpetual_markets
     set next_funding_at=p_funding_at + (v_market.funding_interval_sec * interval '1 second'),
         updated_at=now()
   where symbol=p_symbol;

  return jsonb_build_object('ok',true,'symbol',p_symbol,'funding_at',p_funding_at,
    'settled',v_settled,'duplicates',v_duplicates,'no_position',v_no_position,
    'next_funding_at',p_funding_at + (v_market.funding_interval_sec * interval '1 second'));
end;
$$;

revoke all on function public.perp_settle_funding_market(text,timestamptz) from public, anon, authenticated;
grant execute on function public.perp_settle_funding_market(text,timestamptz) to service_role;
revoke all on function public.perp_settle_funding_one(text,timestamptz,numeric,text) from public, anon, authenticated;
grant execute on function public.perp_settle_funding_one(text,timestamptz,numeric,text) to service_role;

do $$
begin
  if to_regprocedure('public.perp_settle_funding_market(text,timestamp with time zone)') is null then
    raise exception 'atomic perpetual funding RPC was not installed';
  end if;
  if not has_function_privilege('service_role',
       'public.perp_settle_funding_market(text,timestamp with time zone)','EXECUTE')
     or has_function_privilege('anon',
       'public.perp_settle_funding_market(text,timestamp with time zone)','EXECUTE')
     or has_function_privilege('authenticated',
       'public.perp_settle_funding_market(text,timestamp with time zone)','EXECUTE') then
    raise exception 'atomic perpetual funding RPC grants are not service-role-only';
  end if;
end;
$$;
