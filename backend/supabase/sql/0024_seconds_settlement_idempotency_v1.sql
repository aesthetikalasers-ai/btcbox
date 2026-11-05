-- BTCBOX seconds settlement idempotency correction.
-- Apply only in an isolated staging Supabase project after 0014/0015 and
-- verify financial ledger invariants before considering any production change.
-- Source-only in this workflow: this migration is NOT executed automatically.

create or replace function public.settle_seconds_position_v1(
  p_position_id text, p_user_id text, p_request_id text, p_request_hash text,
  p_symbol text, p_settle_price numeric, p_settle_price_source text, p_settle_price_ts timestamptz
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_pos public.seconds_contract_positions%rowtype; v_available numeric; v_frozen numeric;
        v_op_id uuid; v_pnl numeric; v_credit numeric; v_win boolean; v_tie boolean;
        v_now timestamptz := clock_timestamp();
begin
  if coalesce(p_user_id,'')='' or p_position_id !~ '^SC[A-Fa-f0-9]{30}$'
     or p_request_id !~ '^[A-Za-z0-9_-]{16,100}$'
     or coalesce(p_request_hash,'') !~ '^[0-9a-f]{64}$'
     or p_symbol not in ('BTC','ETH','SOL','BNB') or p_settle_price is null or p_settle_price<=0
     or coalesce(p_settle_price_source,'') not in ('coinbase','bybit') or p_settle_price_ts is null
     or p_settle_price_ts > v_now + interval '5 seconds' or p_settle_price_ts < v_now - interval '2 minutes' then
    return jsonb_build_object('ok',false,'code','INVALID_ARGUMENT');
  end if;
  select * into v_pos from public.seconds_contract_positions where position_id=p_position_id and user_id=p_user_id for update;
  if not found then return jsonb_build_object('ok',false,'code','POSITION_NOT_FOUND'); end if;
  if v_pos.symbol <> p_symbol then return jsonb_build_object('ok',false,'code','SYMBOL_MISMATCH'); end if;
  if v_pos.status='settled' then
    if v_pos.settle_request_id = p_request_id then
      if v_pos.settle_request_hash IS DISTINCT FROM p_request_hash then
        return jsonb_build_object('ok',false,'code','IDEMPOTENCY_CONFLICT');
      end if;
      return jsonb_build_object('ok',true,'duplicate',true,'settled',true,'position_id',v_pos.position_id,
        'win',v_pos.win,'tie',v_pos.tie,'pnl',v_pos.pnl,'settle_price',v_pos.settle_price);
    end if;
    return jsonb_build_object('ok',false,'code','POSITION_ALREADY_SETTLED');
  end if;
  if v_now < v_pos.settle_at then
    return jsonb_build_object('ok',true,'duplicate',false,'settled',false,'settle_at',extract(epoch from v_pos.settle_at)::bigint);
  end if;
  if p_settle_price_ts < v_pos.settle_at then
    return jsonb_build_object('ok',false,'code','SETTLEMENT_PRICE_BEFORE_MATURITY');
  end if;
  v_tie := p_settle_price = v_pos.open_price;
  v_win := (not v_tie) and ((v_pos.direction='up' and p_settle_price>v_pos.open_price)
    or (v_pos.direction='down' and p_settle_price<v_pos.open_price));
  v_pnl := case when v_tie then 0 when v_win then round(v_pos.amount*0.85,18) else -v_pos.amount end;
  v_credit := case when v_tie then v_pos.amount when v_win then v_pos.amount+v_pnl else 0 end;
  insert into public.financial_accounts(user_id,asset) values(p_user_id,'USDT') on conflict do nothing;
  select available,frozen into v_available,v_frozen from public.financial_accounts
    where user_id=p_user_id and asset='USDT' for update;
  if v_frozen < v_pos.amount then return jsonb_build_object('ok',false,'code','FROZEN_BALANCE_INVARIANT'); end if;
  insert into public.financial_operations(idempotency_key,user_id,asset,operation_type,request_hash,metadata)
    values(p_request_id,p_user_id,'USDT','seconds_settle',p_request_hash,
      jsonb_build_object('position_id',p_position_id,'symbol',p_symbol,'direction',v_pos.direction,
        'amount',v_pos.amount,'open_price',v_pos.open_price,'settle_price',p_settle_price,
        'settle_price_source',p_settle_price_source,'settle_price_ts',p_settle_price_ts,
        'pnl',v_pnl,'win',v_win,'tie',v_tie)) returning id into v_op_id;
  update public.financial_accounts set available=available+v_credit,frozen=frozen-v_pos.amount,
    version=version+1,updated_at=v_now where user_id=p_user_id and asset='USDT'
    returning available,frozen into v_available,v_frozen;
  insert into public.financial_ledger(operation_id,user_id,asset,available_delta,frozen_delta,available_after,frozen_after)
    values(v_op_id,p_user_id,'USDT',v_credit,-v_pos.amount,v_available,v_frozen);
  update public.seconds_contract_positions set status='settled',settle_price=p_settle_price,
    settle_price_source=p_settle_price_source,settle_price_ts=p_settle_price_ts,pnl=v_pnl,
    win=v_win,tie=v_tie,settle_request_id=p_request_id,settle_request_hash=p_request_hash,
    settle_operation_id=v_op_id,settled_at=v_now where position_id=p_position_id;
  return jsonb_build_object('ok',true,'duplicate',false,'settled',true,'position_id',p_position_id,
    'win',v_win,'tie',v_tie,'pnl',v_pnl,'settle_price',p_settle_price);
exception when unique_violation then
  return jsonb_build_object('ok',false,'code','IDEMPOTENCY_CONFLICT');
end; $$;



revoke all on function public.settle_seconds_position_v1(text,text,text,text,text,numeric,text,timestamptz) from public, anon, authenticated;
grant execute on function public.settle_seconds_position_v1(text,text,text,text,text,numeric,text,timestamptz) to service_role;
