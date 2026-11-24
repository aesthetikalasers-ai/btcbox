-- 0052_perpetual_two_source_median_bootstrap_v1.sql
-- Allow price-only bootstrap from two independent live providers.
-- Bootstrap remains non-tradable and is excluded from funding-rate production.
create or replace function public.perp_record_bootstrap_mark_price(
  p_symbol text,
  p_index_price numeric,
  p_sources jsonb,
  p_max_age_sec integer
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_market public.perpetual_markets%rowtype;
  v_src jsonb;
  v_seen text[] := array[]::text[];
  v_prices numeric[] := array[]::numeric[];
  v_count integer;
  v_median numeric;
  v_max_dev numeric(12,6) := 0;
  v_price numeric;
  v_ts numeric;
  i integer;
begin
  if coalesce(p_symbol,'') !~ '^[A-Z0-9]{3,20}$'
     or p_index_price is null or p_index_price <= 0
     or p_max_age_sec is null or p_max_age_sec <= 0
     or p_sources is null or jsonb_typeof(p_sources) <> 'array'
     or jsonb_array_length(p_sources) < 2
     or jsonb_array_length(p_sources) > 3 then
    raise exception 'bootstrap mark requires valid symbol, positive index and two or three sources';
  end if;

  select * into v_market from public.perpetual_markets where symbol=p_symbol and enabled=true;
  if not found then raise exception 'enabled perpetual market configuration missing'; end if;
  if p_max_age_sec <> v_market.mark_price_stale_sec then
    raise exception 'bootstrap freshness must match market configuration';
  end if;

  v_count := jsonb_array_length(p_sources);
  for i in 0..v_count-1 loop
    v_src := p_sources->i;
    if jsonb_typeof(v_src) <> 'object'
       or lower(coalesce(v_src->>'source','')) not in ('binance','okx','coingecko')
       or lower(v_src->>'source') = any(v_seen)
       or coalesce(v_src->>'price','') !~ '^[0-9]+([.][0-9]+)?$'
       or coalesce(v_src->>'ts','') !~ '^[0-9]+$' then
      raise exception 'bootstrap sources must be distinct trusted provider samples';
    end if;
    v_seen := array_append(v_seen,lower(v_src->>'source'));
    v_price := (v_src->>'price')::numeric;
    v_ts := (v_src->>'ts')::numeric;
    if v_price <= 0 or abs(extract(epoch from clock_timestamp())*1000-v_ts) > p_max_age_sec*1000 then
      raise exception 'bootstrap provider sample is invalid or stale';
    end if;
    v_prices := array_append(v_prices,v_price);
  end loop;

  select array_agg(x order by x) into v_prices from unnest(v_prices) as t(x);
  if v_count % 2 = 1 then
    v_median := v_prices[(v_count+1)/2];
  else
    v_median := (v_prices[v_count/2] + v_prices[v_count/2+1]) / 2;
  end if;
  if abs(p_index_price-v_median)/v_median > 0.00000001 then
    raise exception 'bootstrap index must equal validated provider median';
  end if;

  for i in 0..v_count-1 loop
    v_src := p_sources->i;
    v_max_dev := greatest(v_max_dev,
      abs(((v_src->>'price')::numeric-v_median)/v_median)*100);
  end loop;
  if v_max_dev >= 2 then
    raise exception 'bootstrap providers disagree beyond the 2 percent safety threshold';
  end if;

  insert into public.perpetual_mark_price_feed
    (symbol,index_price,mark_price,sources,source_count,max_deviation_pct,status)
  values
    (p_symbol,p_index_price,p_index_price,p_sources,v_count,v_max_dev,'bootstrap');

  return jsonb_build_object('ok',true,'status','bootstrap',
    'source_count',v_count,'max_deviation_pct',v_max_dev);
end;
$$;

revoke all on function public.perp_record_bootstrap_mark_price(text,numeric,jsonb,integer)
  from public, anon, authenticated;
grant execute on function public.perp_record_bootstrap_mark_price(text,numeric,jsonb,integer)
  to service_role;
