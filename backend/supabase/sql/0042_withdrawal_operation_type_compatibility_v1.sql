-- 0042_withdrawal_operation_type_compatibility_v1.sql
-- Forward-only compatibility repair after 0041_perpetual_contract_v1.sql.
-- 0041 replaced the operation_type CHECK and accidentally omitted withdrawal
-- operation types. Preserve historical withdraw_settle while new payouts use
-- withdraw_paid. Do not rewrite historical rows or move customer balances.
--
-- Before applying this migration, run the SELECT-only
-- diagnostics/withdrawal-settle-compatibility-preflight.sql in every target
-- environment and retain its output. Both operation names remain accepted.
-- 0039 already links approval review_operation_id to freeze_operation_id and
-- writes payout_operation_id on payout completion; this migration deliberately
-- does not repeat those financial state transitions.

alter table public.financial_operations
  drop constraint if exists financial_operations_operation_type_check;

alter table public.financial_operations
  add constraint financial_operations_operation_type_check
  check (operation_type in (
    'deposit_credit',
    'withdraw_freeze',
    'withdraw_approve',
    'withdraw_reject',
    'withdraw_settle', -- legacy historical operation name; retained for compatibility
    'withdraw_paid',   -- canonical operation name for new manual payout settlements
    'earn_subscribe',
    'earn_redeem',
    'admin_adjustment',
    'spot_trade',
    'spot_order_reserve',
    'spot_order_cancel',
    'seconds_open',
    'seconds_settle',
    'migration_opening_balance',
    'perp_order_reserve',
    'perp_trade',
    'perp_order_cancel',
    'perp_funding',
    'perp_liquidation',
    'perp_insurance_cover',
    'perp_bad_debt'
  ));

-- Fail loudly if the effective constraint does not retain both withdrawal
-- operation names. This is a metadata assertion only; no customer data changes.
do $$
declare
  v_definition text;
begin
  select pg_get_constraintdef(oid)
    into v_definition
    from pg_constraint
   where conrelid = 'public.financial_operations'::regclass
     and conname = 'financial_operations_operation_type_check';

  if v_definition is null
     or position('withdraw_settle' in v_definition) = 0
     or position('withdraw_paid' in v_definition) = 0
     or position('perp_trade' in v_definition) = 0 then
    raise exception 'financial operation type compatibility constraint verification failed';
  end if;
end;
$$;
