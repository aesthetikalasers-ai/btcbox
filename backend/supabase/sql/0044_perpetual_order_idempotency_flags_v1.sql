-- 0044_perpetual_order_idempotency_flags_v1.sql
-- Bind reduce_only and close_position into the persisted order idempotency payload.
-- Without these comparisons, reusing a client_order_id with a different order intent
-- could replay an earlier open/close request instead of rejecting the payload mismatch.
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
  p_reduce_only := coalesce(p_reduce_only,false);
  p_close_position := coalesce(p_close_position,false);
  if p_close_position then p_reduce_only := true; end if;

  perform pg_advisory_xact_lock(hashtextextended('perp-order:'||p_user_id||':'||p_client_order_id, 0));
  perform pg_advisory_xact_lock(hashtextextended('perp-market:'||p_symbol, 0));

  -- 1. Idempotency replay.
  select * into v_existing from public.perpetual_orders where user_id=p_user_id and client_order_id=p_client_order_id;
  if found then
    if v_existing.symbol<>p_symbol or v_existing.type<>p_type or v_existing.side<>p_side
       or v_existing.leverage<>p_leverage or v_existing.quantity<>p_quantity
       or (v_existing.price is distinct from p_price)
       or v_existing.reduce_only<>p_reduce_only
       or v_existing.close_position<>p_close_position then
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
      v_request_hash := encode(extensions.digest(concat_ws(':',p_user_id,p_symbol,p_side,p_type,coalesce(p_price,0)::text,p_quantity::text,p_leverage,p_reduce_only::text,p_close_position::text),'sha256'),'hex');
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

REVOKE ALL ON FUNCTION public.perp_submit_order(text,text,text,text,text,numeric,numeric,integer,boolean,boolean,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.perp_submit_order(text,text,text,text,text,numeric,numeric,integer,boolean,boolean,text)
  TO service_role;
