-- 0047_perpetual_liquidation_accounting_closure_v1.sql
-- Separate real user/insurance balance movements from non-cash platform bad debt.
-- All rows are appended atomically with the liquidation transaction.

begin;

alter table public.perpetual_liquidation_events
  add column if not exists insurance_operation_id uuid
  references public.financial_operations(id);

create table if not exists public.perpetual_liquidation_journal (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.perpetual_liquidation_events(id),
  operation_id uuid not null references public.financial_operations(id),
  line_no smallint not null check (line_no between 1 and 4),
  account_code text not null check (account_code in (
    'perp_liquidation_loss','user_isolated_margin','insurance_fund','platform_risk_absorption'
  )),
  debit numeric(38,18) not null default 0 check (debit >= 0),
  credit numeric(38,18) not null default 0 check (credit >= 0),
  created_at timestamptz not null default now(),
  unique (event_id,line_no),
  check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0))
);
create index if not exists perpetual_liquidation_journal_operation_idx
  on public.perpetual_liquidation_journal(operation_id);
create unique index if not exists perpetual_liquidation_events_insurance_operation_uidx
  on public.perpetual_liquidation_events(insurance_operation_id)
  where insurance_operation_id is not null;

-- Backfill prior liquidation events if this repair is applied after an earlier
-- 0041 deployment. The old event already contains the three loss-waterfall
-- amounts; no historical financial account or ledger row is rewritten.
insert into public.perpetual_liquidation_journal
  (event_id,operation_id,line_no,account_code,debit,credit)
select e.id,e.operation_id,1,'perp_liquidation_loss',
       e.margin_lost+e.insurance_cover+e.bad_debt,0
  from public.perpetual_liquidation_events e
 where e.margin_lost+e.insurance_cover+e.bad_debt > 0
union all
select e.id,e.operation_id,2,'user_isolated_margin',0,e.margin_lost
  from public.perpetual_liquidation_events e where e.margin_lost > 0
union all
select e.id,e.operation_id,3,'insurance_fund',0,e.insurance_cover
  from public.perpetual_liquidation_events e where e.insurance_cover > 0
union all
select e.id,e.operation_id,4,'platform_risk_absorption',0,e.bad_debt
  from public.perpetual_liquidation_events e where e.bad_debt > 0
on conflict (event_id,line_no) do nothing;

do $verify$
begin
  if exists (
    select event_id
      from public.perpetual_liquidation_journal
     group by event_id
    having sum(debit) <> sum(credit)
  ) then
    raise exception 'historical perpetual liquidation journal backfill is unbalanced';
  end if;
end;
$verify$;

alter table public.perpetual_liquidation_journal enable row level security;
revoke all on public.perpetual_liquidation_journal from public, anon, authenticated;
grant select, insert on public.perpetual_liquidation_journal to service_role;
do $$
declare v_sequence text := pg_get_serial_sequence('public.perpetual_liquidation_journal','id');
begin
  if v_sequence is not null then
    execute format('grant usage, select on sequence %s to service_role',v_sequence);
  end if;
end;
$$;

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
  v_margin_return numeric(38,18) := 0;
  v_insurance_cover numeric(38,18) := 0;
  v_bad_debt numeric(38,18) := 0;
  v_op uuid;
  v_insurance_op uuid;
  v_bad_debt_op uuid;
  v_event_id uuid;
  v_journal_debits numeric(38,18);
  v_journal_credits numeric(38,18);
  v_idem text;
  v_close_price numeric(38,18);
  v_orders_reserved numeric(38,18) := 0;
  v_total_frozen_release numeric(38,18);
  v_funding_result jsonb;
begin
  if coalesce(p_user_id,'') = '' or p_symbol is null or p_symbol !~ '^[A-Z0-9]{3,20}$' then
    raise exception 'invalid perpetual liquidation identity';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('perp-market:'||p_symbol, 0));
  select * into v_market from public.perpetual_markets where symbol=p_symbol for update;
  if not found then
    raise exception 'perpetual market configuration missing';
  end if;

  -- Funding due at this boundary must settle before liquidation equity is tested.
  -- The funding RPC takes the same transaction-scoped advisory lock; PostgreSQL
  -- permits the same transaction to reacquire it. Any missing/invalid rate
  -- snapshot raises and rolls the entire liquidation back (fail closed).
  if v_market.next_funding_at is not null
     and v_market.next_funding_at <= clock_timestamp() then
    v_funding_result := public.perp_settle_funding_market(p_symbol, v_market.next_funding_at);
    if coalesce((v_funding_result->>'ok')::boolean,false) is not true
       or coalesce((v_funding_result->>'stale_boundary')::boolean,false) then
      raise exception 'due funding boundary could not be settled before liquidation';
    end if;
  end if;

  -- Reload after funding settlement: isolated_margin and account balances may
  -- have changed. Risk calculations below must never use the pre-funding row.
  select * into v_pos from public.perpetual_positions
   where user_id=p_user_id and symbol=p_symbol and closed_at is null for update;
  if not found then
    return jsonb_build_object('ok',true,'no_position',true);
  end if;
  select * into v_mark from public.perp_latest_mark_price(p_symbol, v_market.mark_price_stale_sec);
  if v_mark is null or v_mark.status='stale' or v_mark.age_sec > v_market.mark_price_stale_sec then
    raise exception 'mark price stale — liquidation paused (positions protected)';
  end if;

  v_notional := v_pos.quantity * v_mark.mark_price;
  v_mm := v_notional * v_market.maintenance_margin_rate;
  -- Solve equity = maintenance margin for the liquidation threshold.
  if v_pos.side='long' then
    v_liq_price := greatest(0, (v_pos.entry_price*v_pos.quantity-v_pos.isolated_margin) /
      (v_pos.quantity*(1-v_market.maintenance_margin_rate)));
    if v_mark.mark_price > v_liq_price then return jsonb_build_object('ok',true,'liquidatable',false,'mark',v_mark.mark_price,'liq_price',v_liq_price); end if;
    v_bankruptcy := greatest(0, (v_pos.entry_price*v_pos.quantity-v_pos.isolated_margin)/v_pos.quantity);
    v_close_price := v_mark.mark_price;
    v_loss := greatest(0, (v_pos.entry_price-v_close_price)*v_pos.quantity);
  else
    v_liq_price := (v_pos.entry_price*v_pos.quantity+v_pos.isolated_margin) /
      (v_pos.quantity*(1+v_market.maintenance_margin_rate));
    if v_mark.mark_price < v_liq_price then return jsonb_build_object('ok',true,'liquidatable',false,'mark',v_mark.mark_price,'liq_price',v_liq_price); end if;
    v_bankruptcy := (v_pos.entry_price*v_pos.quantity+v_pos.isolated_margin)/v_pos.quantity;
    v_close_price := v_mark.mark_price;
    v_loss := greatest(0, (v_close_price-v_pos.entry_price)*v_pos.quantity);
  end if;

  v_idem := 'perp-liq-'||v_pos.id::text;
  if exists (select 1 from public.financial_operations where idempotency_key = v_idem) then
    return jsonb_build_object('ok',true,'duplicate',true);
  end if;

  -- Loss absorbed by isolated margin (already frozen). Excess loss beyond margin -> insurance -> bad debt.
  v_margin_return := greatest(v_pos.isolated_margin - v_loss, 0);
  if v_loss > v_pos.isolated_margin then
    declare v_excess numeric(38,18) := v_loss - v_pos.isolated_margin;
            v_ins_bal numeric(38,18);
    begin
      insert into public.financial_accounts(user_id,asset) values (v_market.insurance_user_id,'USDT') on conflict do nothing;
      select available into v_ins_bal from public.financial_accounts where user_id=v_market.insurance_user_id and asset='USDT' for update;
      v_insurance_cover := least(v_excess, coalesce(v_ins_bal,0));
      v_bad_debt := v_excess - v_insurance_cover;
      if v_insurance_cover > 0 then
        update public.financial_accounts set available=available-v_insurance_cover, version=version+1, updated_at=now()
         where user_id=v_market.insurance_user_id and asset='USDT' and available >= v_insurance_cover;
        if not found then raise exception 'insurance liquidation debit invariant failed'; end if;
      end if;
    end;
  end if;

  insert into public.financial_operations(idempotency_key,user_id,asset,operation_type,request_hash,metadata)
  values (v_idem, p_user_id,'USDT','perp_liquidation',
    encode(extensions.digest(v_idem,'sha256'),'hex'),
    jsonb_build_object('symbol',p_symbol,'mark_price',v_mark.mark_price,'liq_price',v_liq_price))
  returning id into v_op;
  -- Release the position margin plus remaining open-order reserves; return only unused position collateral.
  select coalesce(sum(reserved_margin),0) into v_orders_reserved
    from public.perpetual_orders where user_id=p_user_id and symbol=p_symbol and status in ('open','partially_filled');
  v_total_frozen_release := v_pos.isolated_margin + v_orders_reserved;
  -- User loses min(actual adverse PnL, isolated margin); unused isolated collateral and order reserves return to available.
  update public.financial_accounts set frozen=frozen-v_total_frozen_release,
    available=available + v_orders_reserved + v_margin_return, version=version+1, updated_at=now()
   where user_id=p_user_id and asset='USDT' and frozen >= v_total_frozen_release;
  if not found then raise exception 'liquidation frozen release invariant failed'; end if;
  insert into public.financial_ledger(operation_id,user_id,asset,available_delta,frozen_delta,available_after,frozen_after)
  select v_op, p_user_id, 'USDT', (v_orders_reserved + v_margin_return), -v_total_frozen_release, available, frozen
    from public.financial_accounts where user_id=p_user_id and asset='USDT';
  if v_insurance_cover > 0 then
    insert into public.financial_operations(idempotency_key,user_id,asset,operation_type,request_hash,metadata)
    values ('perp-insurance-cover-'||v_pos.id::text,v_market.insurance_user_id,'USDT','perp_insurance_cover',
      encode(extensions.digest(v_idem||':insurance:'||v_insurance_cover::text,'sha256'),'hex'),
      jsonb_build_object('symbol',p_symbol,'liquidation_operation_id',v_op,'amount',v_insurance_cover))
    returning id into v_insurance_op;
    insert into public.financial_ledger(operation_id,user_id,asset,available_delta,frozen_delta,available_after,frozen_after)
    select v_insurance_op,v_market.insurance_user_id,'USDT',-v_insurance_cover,0::numeric,available,frozen
      from public.financial_accounts where user_id=v_market.insurance_user_id and asset='USDT';
  end if;

  insert into public.perpetual_position_history(user_id,symbol,side,quantity,entry_price,close_price,realized_pnl,funding_paid,close_reason)
  values (p_user_id,p_symbol,v_pos.side,v_pos.quantity,v_pos.entry_price,v_close_price,v_pos.realized_pnl - v_loss,v_pos.funding_paid,'liquidation');
  insert into public.perpetual_liquidation_events(user_id,symbol,side,quantity,entry_price,mark_price_at_liq,liquidation_price,bankruptcy_price,margin_lost,insurance_cover,bad_debt,operation_id,insurance_operation_id)
  values (p_user_id,p_symbol,v_pos.side,v_pos.quantity,v_pos.entry_price,v_mark.mark_price,v_liq_price,v_bankruptcy,least(v_loss,v_pos.isolated_margin),v_insurance_cover,v_bad_debt,v_op,v_insurance_op)
  returning id into v_event_id;
  if v_bad_debt > 0 then
    insert into public.financial_operations(idempotency_key,user_id,asset,operation_type,request_hash,metadata)
    values ('perp-bad-debt-'||v_pos.id::text,'__perp_platform__','USDT','perp_bad_debt',
      encode(extensions.digest(v_idem||':bad-debt:'||v_bad_debt::text,'sha256'),'hex'),
      jsonb_build_object('symbol',p_symbol,'affected_user_id',p_user_id,'liquidation_operation_id',v_op,'amount',v_bad_debt,'insurance_cover',v_insurance_cover))
    returning id into v_bad_debt_op;
    insert into public.perpetual_bad_debt_events(user_id,symbol,liquidation_operation_id,bad_debt_operation_id,amount,insurance_cover)
    values (p_user_id,p_symbol,v_op,v_bad_debt_op,v_bad_debt,v_insurance_cover);
  end if;
  -- Balanced liquidation risk journal. financial_ledger records only real
  -- financial_accounts movements; uncovered bad debt is a platform loss, not
  -- a fabricated customer balance movement or negative customer receivable.
  if v_loss > 0 then
    insert into public.perpetual_liquidation_journal
      (event_id,operation_id,line_no,account_code,debit,credit)
    values (v_event_id,v_op,1,'perp_liquidation_loss',v_loss,0);
    if least(v_loss,v_pos.isolated_margin) > 0 then
      insert into public.perpetual_liquidation_journal
        (event_id,operation_id,line_no,account_code,debit,credit)
      values (v_event_id,v_op,2,'user_isolated_margin',0,least(v_loss,v_pos.isolated_margin));
    end if;
    if v_insurance_cover > 0 then
      insert into public.perpetual_liquidation_journal
        (event_id,operation_id,line_no,account_code,debit,credit)
      values (v_event_id,v_op,3,'insurance_fund',0,v_insurance_cover);
    end if;
    if v_bad_debt > 0 then
      insert into public.perpetual_liquidation_journal
        (event_id,operation_id,line_no,account_code,debit,credit)
      values (v_event_id,v_op,4,'platform_risk_absorption',0,v_bad_debt);
    end if;
    select coalesce(sum(debit),0),coalesce(sum(credit),0)
      into v_journal_debits,v_journal_credits
      from public.perpetual_liquidation_journal where event_id=v_event_id;
    if v_journal_debits <> v_journal_credits or v_journal_debits <> v_loss then
      raise exception 'perpetual liquidation journal is not balanced';
    end if;
  end if;
  delete from public.perpetual_positions where id=v_pos.id;
  -- cancel any open orders for this user/symbol (reduce exposure); reserved margin already released above.
  update public.perpetual_orders set status='cancelled', remaining_quantity=0, reserved_margin=0, updated_at=now()
   where user_id=p_user_id and symbol=p_symbol and status in ('open','partially_filled');

  return jsonb_build_object('ok',true,'liquidated',true,'liq_price',v_liq_price,'mark_price',v_mark.mark_price,
    'margin_lost',least(v_loss,v_pos.isolated_margin),'insurance_cover',v_insurance_cover,'bad_debt',v_bad_debt);
end;
$$;


revoke all on function public.perp_liquidate_position(text,text) from public, anon, authenticated;
grant execute on function public.perp_liquidate_position(text,text) to service_role;

do $$
begin
  if not has_column_privilege('service_role','public.perpetual_liquidation_events','insurance_operation_id','INSERT')
     or not has_table_privilege('service_role','public.perpetual_liquidation_journal','INSERT')
     or has_table_privilege('anon','public.perpetual_liquidation_journal','SELECT')
     or has_table_privilege('authenticated','public.perpetual_liquidation_journal','SELECT') then
    raise exception 'perpetual liquidation accounting journal grants are invalid';
  end if;
end;
$$;

commit;
