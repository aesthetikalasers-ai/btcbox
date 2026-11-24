-- 0053_perpetual_two_source_live_mark_v1.sql
-- Promote a validated BTCBOX order-book mark to status=ok when two independent
-- spot-index providers agree within the same 2% bootstrap safety envelope.
-- The mark remains derived from the BTCBOX executable bid/ask book; providers
-- anchor Index Price only. No fixed funding rate or synthetic book is introduced.
create or replace function public.perp_record_mark_price(
  p_symbol text, p_index_price numeric, p_mark_price numeric, p_sources jsonb, p_max_age_sec integer
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_count integer;
  v_max_dev numeric(12,6);
  v_status text;
  v_src jsonb;
  v_source_name text;
  v_sources_seen text[] := ARRAY[]::text[];
  i integer;
  v_mean numeric;
  v_market public.perpetual_markets%rowtype;
  v_mark_deviation numeric(12,6);
begin
  if coalesce(p_symbol,'') !~ '^[A-Z0-9]{3,20}$'
     or p_index_price is null or p_index_price <= 0
     or p_mark_price is null or p_mark_price <= 0
     or p_max_age_sec is null or p_max_age_sec <= 0 then
    raise exception 'invalid mark price payload';
  end if;
  if p_sources is null or jsonb_typeof(p_sources) <> 'array' or jsonb_array_length(p_sources) < 2 then
    raise exception 'mark price requires at least 2 sources';
  end if;

  v_count := jsonb_array_length(p_sources);
  v_mean := 0;
  for i in 0..v_count-1 loop
    v_src := p_sources->i;
    if jsonb_typeof(v_src) <> 'object' then
      raise exception 'invalid mark price source object';
    end if;
    v_source_name := lower(coalesce(v_src->>'source',''));
    if v_source_name not in ('binance','okx','coingecko')
       or v_source_name = any(v_sources_seen) then
      raise exception 'mark price sources must be unique trusted providers';
    end if;
    v_sources_seen := array_append(v_sources_seen,v_source_name);
    if coalesce(v_src->>'price','') !~ '^[0-9]+([.][0-9]+)?$'
       or (v_src->>'price')::numeric <= 0
       or coalesce(v_src->>'ts','') !~ '^[0-9]+$'
       or abs(extract(epoch from now())*1000 - (v_src->>'ts')::numeric) > p_max_age_sec*1000 then
      raise exception 'invalid or stale mark price source';
    end if;
    v_mean := v_mean + (v_src->>'price')::numeric;
  end loop;

  v_mean := v_mean / v_count;
  if abs(p_index_price-v_mean)/v_mean > 0.0001 then
    raise exception 'index price must match the validated external spot source mean';
  end if;
  select * into v_market from public.perpetual_markets where symbol=p_symbol;
  if not found then raise exception 'perpetual market configuration missing for mark feed'; end if;
  v_mark_deviation := abs(p_mark_price-p_index_price)/p_index_price*100;

  v_max_dev := 0;
  for i in 0..v_count-1 loop
    v_src := p_sources->i;
    v_max_dev := greatest(v_max_dev, abs(((v_src->>'price')::numeric - v_mean)/v_mean)*100);
  end loop;
  v_max_dev := greatest(v_max_dev, v_mark_deviation);

  -- Two independent, fresh providers are sufficient only when they agree <2%
  -- and the BTCBOX book mark remains inside the market circuit-breaker limit.
  v_status := case
    when v_count >= 2 and v_max_dev < 2
         and v_mark_deviation <= v_market.circuit_breaker_deviation_pct then 'ok'
    else 'degraded'
  end;

  insert into public.perpetual_mark_price_feed(
    symbol,index_price,mark_price,sources,source_count,max_deviation_pct,status
  ) values (p_symbol,p_index_price,p_mark_price,p_sources,v_count,v_max_dev,v_status);
  return jsonb_build_object(
    'ok',true,'status',v_status,'source_count',v_count,'max_deviation_pct',v_max_dev
  );
end;
$$;

revoke all on function public.perp_record_mark_price(text,numeric,numeric,jsonb,integer)
  from public, anon, authenticated;
grant execute on function public.perp_record_mark_price(text,numeric,numeric,jsonb,integer)
  to service_role;
