-- Read-only compatibility preflight for withdrawal settlement operation names.
-- Run separately in EACH target environment before applying migration 0042.
-- SELECT only: no schema, balance, ledger, withdrawal, or audit changes.
select operation_type, count(*) as operation_count
  from public.financial_operations
 where operation_type in ('withdraw_settle','withdraw_paid')
 group by operation_type
 order by operation_type;

-- Inspect historical settlement operations and their withdrawal linkage.
-- Keep every returned row unchanged; this is evidence for compatibility planning.
select o.id as operation_id,
       o.operation_type,
       o.user_id,
       o.asset,
       o.idempotency_key,
       o.metadata ->> 'withdrawal_id' as metadata_withdrawal_id,
       w.id as linked_withdrawal_id,
       w.status as withdrawal_status
  from public.financial_operations o
  left join public.withdrawal_requests w
    on w.id = o.metadata ->> 'withdrawal_id'
 where o.operation_type in ('withdraw_settle','withdraw_paid')
 order by o.created_at, o.id;

-- Summary of completed withdrawals whose payout operation is absent or unlinked.
select count(*) as completed_without_payout_operation
  from public.withdrawal_requests
 where status = 'completed'
   and payout_operation_id is null;
