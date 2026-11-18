-- 0042_financial_operation_type_allowlist_reconciliation_v1.sql
-- 0039 retained withdrawal payout and the previously supported Seconds ledger
-- operation types. 0041 replaced the same CHECK constraint for Perpetual but
-- omitted withdraw_paid, seconds_open, and seconds_settle.
-- Replace the allow-list atomically with the union of all canonical paths.
ALTER TABLE public.financial_operations
  DROP CONSTRAINT IF EXISTS financial_operations_operation_type_check,
  ADD CONSTRAINT financial_operations_operation_type_check
  CHECK (operation_type IN (
    'deposit_credit',
    'withdraw_freeze',
    'withdraw_approve',
    'withdraw_reject',
    'withdraw_paid',
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
