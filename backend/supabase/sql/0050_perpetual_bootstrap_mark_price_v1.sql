-- 0050_perpetual_bootstrap_mark_price_v1.sql
-- Resolve first-order startup deadlock without inventing a tradable premium.
-- Bootstrap marks are explicitly labelled and can seed order validation, but
-- the funding producer only accepts status='ok', so funding remains fail-closed.

alter table public.perpetual_mark_price_feed
  drop constraint if exists perpetual_mark_price_feed_status_check;
alter table public.perpetual_mark_price_feed
  add constraint perpetual_mark_price_feed_status_check
  check (status in ('ok','degraded','stale','bootstrap'));

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
  v_count integer;
  v_mean numeric := 0;
  v_max_dev numeric(12,6) := 0;
  v_price numeric;
  v_ts numeric;
  i integer;
begin
  if coalesce(p_symbol,'') !~ '^[A-Z0-9]{3,20}$'
     or p_index_price is null or p_index_price <= 0
     or p_max_age_sec is null or p_max_age_sec <= 0
     or p_sources is null or jsonb_typeof(p_sources) <> 'array'
     or jsonb_array_length(p_sources) < 3 then
    raise exception 'bootstrap mark requires valid symbol, positive index and at least three sources';
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
    v_mean := v_mean + v_price;
  end loop;
  v_mean := v_mean / v_count;
  if abs(p_index_price-v_mean)/v_mean > 0.0001 then
    raise exception 'bootstrap index must equal validated provider mean';
  end if;
  for i in 0..v_count-1 loop
    v_src := p_sources->i;
    v_max_dev := greatest(v_max_dev,
      abs(((v_src->>'price')::numeric-v_mean)/v_mean)*100);
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

do $$
begin
  if not has_function_privilege('service_role',
       'public.perp_record_bootstrap_mark_price(text,numeric,jsonb,integer)','EXECUTE')
     or has_function_privilege('anon',
       'public.perp_record_bootstrap_mark_price(text,numeric,jsonb,integer)','EXECUTE')
     or has_function_privilege('authenticated',
       'public.perp_record_bootstrap_mark_price(text,numeric,jsonb,integer)','EXECUTE') then
    raise exception 'bootstrap mark RPC grants are not service-role-only';
  end if;
end;
$$;
