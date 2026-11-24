-- 0048_perpetual_funding_rate_producer_v1.sql
-- Fixed, versioned BTCBOX funding formula and database-authoritative snapshot writer.
-- Additive only. Does not settle positions, move funds, enable markets or change balances.

alter table public.perpetual_funding_rates
  add column if not exists formula_version text,
  add column if not exists interest_rate numeric(12,10),
  add column if not exists impact_bid_price numeric(38,18),
  add column if not exists impact_ask_price numeric(38,18),
  add column if not exists calculated_at timestamptz;

comment on column public.perpetual_funding_rates.formula_version is
  'Formula identifier; btcbox-funding-v1 is the approved 8-hour fixed formula.';
comment on column public.perpetual_funding_rates.impact_bid_price is
  'Top-five-distinct-level quantity-weighted executable bid-side VWAP proxy.';
comment on column public.perpetual_funding_rates.impact_ask_price is
  'Top-five-distinct-level quantity-weighted executable ask-side VWAP proxy.';

create or replace function public.perp_record_funding_rate_snapshot(
  p_symbol text,
  p_funding_at timestamptz,
  p_impact_bid_price numeric,
  p_impact_ask_price numeric
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_market public.perpetual_markets%rowtype;
  v_feed public.perpetual_mark_price_feed%rowtype;
  v_mid numeric(38,18);
  v_premium numeric(12,10);
  v_interest constant numeric(12,10) := 0.0001; -- 0.01% per 8-hour interval
  v_adjustment constant numeric(12,10) := 0.0005; -- +/- 0.05%
  v_absolute_cap constant numeric(12,10) := 0.0075; -- +/- 0.75%
  v_rate numeric(12,10);
  v_cap numeric(12,10);
begin
  if p_symbol is null or p_symbol !~ '^[A-Z0-9]{3,20}$'
     or p_funding_at is null
     or p_impact_bid_price is null or p_impact_bid_price <= 0
     or p_impact_ask_price is null or p_impact_ask_price <= 0
     or p_impact_ask_price < p_impact_bid_price then
    raise exception 'invalid funding snapshot input';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('perp-market:'||p_symbol, 0));
  select * into v_market from public.perpetual_markets
   where symbol=p_symbol for update;
  if not found then raise exception 'perpetual market configuration missing'; end if;
  if v_market.funding_interval_sec <> 28800 then
    raise exception 'btcbox-funding-v1 requires an 8-hour funding interval';
  end if;
  if v_market.next_funding_at is null or v_market.next_funding_at <> p_funding_at then
    raise exception 'funding snapshot boundary is not the current market boundary';
  end if;

  select * into v_feed from public.perpetual_mark_price_feed
   where symbol=p_symbol order by created_at desc limit 1;
  if not found or v_feed.status <> 'ok'
     or v_feed.created_at < now() - (v_market.mark_price_stale_sec * interval '1 second')
     or v_feed.source_count < 2
     or v_feed.max_deviation_pct > v_market.circuit_breaker_deviation_pct then
    raise exception 'latest mark/index feed is missing, stale or degraded';
  end if;
  if v_feed.index_price <= 0 or v_feed.mark_price <= 0
     or jsonb_typeof(v_feed.sources) <> 'array'
     or jsonb_array_length(v_feed.sources) < 2 then
    raise exception 'latest mark/index feed is incomplete';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_feed.sources) s
     where coalesce(s->>'source','') not in ('binance','okx','coingecko')
        or not pg_input_is_valid(s->>'price','numeric')
        or not pg_input_is_valid(s->>'ts','numeric')
        or (s->>'price')::numeric <= 0
        or abs(extract(epoch from clock_timestamp())*1000 - (s->>'ts')::numeric)
             > v_market.mark_price_stale_sec*1000
  ) or (
    select count(distinct s->>'source')
      from jsonb_array_elements(v_feed.sources) s
  ) < 2 then
    raise exception 'latest mark/index provider samples are invalid, stale or duplicated';
  end if;

  v_mid := (p_impact_bid_price + p_impact_ask_price) / 2;
  v_premium := ((v_mid / v_feed.index_price) - 1)::numeric(12,10);
  -- FR = clamp(P + clamp(I - P, -0.0005, +0.0005), -0.0075, +0.0075)
  v_rate := least(v_absolute_cap,
             greatest(-v_absolute_cap,
               v_premium + least(v_adjustment,
                          greatest(-v_adjustment, v_interest - v_premium))));
  v_cap := least(v_absolute_cap, v_market.funding_rate_cap);
  v_rate := least(v_cap, greatest(-v_cap, v_rate));

  insert into public.perpetual_funding_rates
    (symbol,funding_at,rate,premium_index,mark_price,index_price,sources,settled,
     formula_version,interest_rate,impact_bid_price,impact_ask_price,calculated_at)
  values
    (p_symbol,p_funding_at,v_rate,v_premium,v_feed.mark_price,v_feed.index_price,
     v_feed.sources,false,'btcbox-funding-v1',v_interest,
     p_impact_bid_price,p_impact_ask_price,clock_timestamp())
  on conflict (symbol,funding_at) do update
    set rate=excluded.rate,
        premium_index=excluded.premium_index,
        mark_price=excluded.mark_price,
        index_price=excluded.index_price,
        sources=excluded.sources,
        formula_version=excluded.formula_version,
        interest_rate=excluded.interest_rate,
        impact_bid_price=excluded.impact_bid_price,
        impact_ask_price=excluded.impact_ask_price,
        calculated_at=excluded.calculated_at
    where public.perpetual_funding_rates.settled=false;

  if not found then
    raise exception 'funding snapshot is already settled and cannot be rewritten';
  end if;

  return jsonb_build_object(
    'ok',true,'symbol',p_symbol,'funding_at',p_funding_at,
    'formula_version','btcbox-funding-v1','rate',v_rate,
    'premium_index',v_premium,'interest_rate',v_interest,
    'mark_price',v_feed.mark_price,'index_price',v_feed.index_price,
    'impact_bid_price',p_impact_bid_price,'impact_ask_price',p_impact_ask_price,
    'calculated_at',clock_timestamp()
  );
end;
$$;

-- Guard every actual perp_funding financial operation, including direct calls to
-- the lower-level settlement RPC. Legacy/unversioned snapshots cannot move funds.
create or replace function public.perp_guard_funding_operation_v1()
returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  v_symbol text;
  v_funding_at timestamptz;
  v_rate public.perpetual_funding_rates%rowtype;
begin
  if new.operation_type <> 'perp_funding' then return new; end if;
  v_symbol := new.metadata->>'symbol';
  begin
    v_funding_at := (new.metadata->>'funding_at')::timestamptz;
  exception when others then
    raise exception 'perp funding operation is missing a valid boundary';
  end;
  select * into v_rate from public.perpetual_funding_rates
   where symbol=v_symbol and funding_at=v_funding_at;
  if not found
     or v_rate.formula_version is distinct from 'btcbox-funding-v1'
     or v_rate.interest_rate is distinct from 0.0001::numeric
     or v_rate.impact_bid_price is null or v_rate.impact_bid_price <= 0
     or v_rate.impact_ask_price is null or v_rate.impact_ask_price < v_rate.impact_bid_price
     or v_rate.calculated_at is null
     or v_rate.calculated_at < now() - interval '2 minutes' then
    raise exception 'funding operation requires a fresh btcbox-funding-v1 snapshot';
  end if;
  return new;
end;
$$;

drop trigger if exists financial_operations_perp_funding_guard_v1 on public.financial_operations;
create trigger financial_operations_perp_funding_guard_v1
before insert on public.financial_operations
for each row execute function public.perp_guard_funding_operation_v1();

revoke all on function public.perp_record_funding_rate_snapshot(text,timestamptz,numeric,numeric) from public, anon, authenticated;
grant execute on function public.perp_record_funding_rate_snapshot(text,timestamptz,numeric,numeric) to service_role;
revoke all on function public.perp_guard_funding_operation_v1() from public, anon, authenticated;

do $$
begin
  if to_regprocedure('public.perp_record_funding_rate_snapshot(text,timestamp with time zone,numeric,numeric)') is null
     or not has_function_privilege('service_role',
       'public.perp_record_funding_rate_snapshot(text,timestamp with time zone,numeric,numeric)','EXECUTE')
     or has_function_privilege('anon',
       'public.perp_record_funding_rate_snapshot(text,timestamp with time zone,numeric,numeric)','EXECUTE')
     or has_function_privilege('authenticated',
       'public.perp_record_funding_rate_snapshot(text,timestamp with time zone,numeric,numeric)','EXECUTE') then
    raise exception 'funding snapshot producer RPC grants are not service-role-only';
  end if;
end;
$$;
