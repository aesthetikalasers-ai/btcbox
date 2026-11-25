-- Read-only withdrawal approval/payout reconciliation report.
-- Run BEFORE rolling migration 0055 into any persistent environment.
-- SELECT only: this file never updates balances, requests, operations, ledger, or audit rows.
--
-- Interpretation:
--   approved_at_0055: approval has its own withdraw-approve operation and the
--     matching ledger consumed exactly amount + fee from frozen funds.
--   legacy_approved_requires_manual_reconciliation: approved row has no
--     matching approval debit. Under the 0039/0044 contract those funds may
--     still be frozen; do not mark it paid using the 0055 no-second-debit flow.
--   completed_at_0055: approval debit exists and no legacy payout debit is linked.
--   legacy_completed_with_payout_debit: old withdraw_paid/withdraw_settle
--     operation consumed frozen funds at payout completion.
--   needs_manual_review: the available evidence does not match either contract.
--
-- financial_accounts.frozen is the user's aggregate frozen balance, not an
-- amount attributable to this withdrawal. Never auto-correct from this report.

WITH operation_ledger AS (
  SELECT
    o.id,
    o.idempotency_key,
    o.operation_type,
    o.user_id,
    o.asset,
    count(l.operation_id)::integer AS ledger_rows,
    coalesce(sum(l.available_delta), 0) AS available_delta,
    coalesce(sum(l.frozen_delta), 0) AS frozen_delta
  FROM public.financial_operations o
  LEFT JOIN public.financial_ledger l ON l.operation_id = o.id
  GROUP BY o.id, o.idempotency_key, o.operation_type, o.user_id, o.asset
)
SELECT
  w.id AS withdrawal_id,
  w.user_id,
  w.asset,
  w.status,
  w.created_at,
  w.reviewed_at,
  w.amount,
  w.fee,
  w.settlement_amount AS reserved_total,
  w.freeze_operation_id,
  w.review_operation_id,
  freeze_op.operation_type AS freeze_operation_type,
  freeze_op.frozen_delta AS freeze_ledger_frozen_delta,
  approve_op.id AS approval_operation_id,
  approve_op.operation_type AS approval_operation_type,
  approve_op.frozen_delta AS approval_ledger_frozen_delta,
  payout_op.id AS payout_operation_id,
  payout_op.operation_type AS payout_operation_type,
  payout_op.frozen_delta AS payout_ledger_frozen_delta,
  account.frozen AS user_aggregate_frozen_balance,
  CASE
    WHEN w.status = 'approved'
      AND approve_op.id IS NOT NULL
      AND approve_op.operation_type = 'withdraw_approve'
      AND approve_op.ledger_rows = 1
      AND approve_op.frozen_delta = -w.settlement_amount
      THEN 'approved_at_0055'
    WHEN w.status = 'approved'
      AND (
        approve_op.id IS NULL
        OR approve_op.ledger_rows <> 1
        OR approve_op.frozen_delta <> -w.settlement_amount
      )
      THEN 'legacy_approved_requires_manual_reconciliation'
    WHEN w.status = 'completed'
      AND approve_op.id IS NOT NULL
      AND approve_op.operation_type = 'withdraw_approve'
      AND approve_op.ledger_rows = 1
      AND approve_op.frozen_delta = -(w.amount + w.fee)
      AND payout_op.id IS NULL
      THEN 'completed_at_0055'
    WHEN w.status = 'completed'
      AND payout_op.id IS NOT NULL
      AND payout_op.operation_type IN ('withdraw_paid','withdraw_settle')
      AND payout_op.ledger_rows = 1
      AND payout_op.frozen_delta = -w.settlement_amount
      THEN 'legacy_completed_with_payout_debit'
    ELSE 'needs_manual_review'
  END AS reconciliation_classification
FROM public.withdrawal_requests w
LEFT JOIN operation_ledger freeze_op
  ON freeze_op.id = w.freeze_operation_id
LEFT JOIN operation_ledger approve_op
  ON approve_op.idempotency_key = 'withdraw-approve:' || w.id
LEFT JOIN operation_ledger payout_op
  ON payout_op.id = w.payout_operation_id
LEFT JOIN public.financial_accounts account
  ON account.user_id = w.user_id AND account.asset = w.settlement_asset
WHERE w.status IN ('approved','completed')
ORDER BY w.created_at, w.id;

-- Summary counts by classification; retain the detailed result above as evidence.
WITH report AS (
  SELECT
    w.id,
    CASE
      WHEN w.status = 'approved'
        AND EXISTS (
          SELECT 1 FROM public.financial_operations o
          JOIN public.financial_ledger l ON l.operation_id = o.id
          WHERE o.idempotency_key = 'withdraw-approve:' || w.id
            AND o.operation_type = 'withdraw_approve'
          GROUP BY o.id
          HAVING count(*) = 1 AND sum(l.frozen_delta) = -w.settlement_amount
        )
        THEN 'approved_at_0055'
      WHEN w.status = 'approved'
        THEN 'legacy_approved_requires_manual_reconciliation'
      WHEN w.status = 'completed'
        AND EXISTS (
          SELECT 1 FROM public.financial_operations o
          JOIN public.financial_ledger l ON l.operation_id = o.id
          WHERE o.idempotency_key = 'withdraw-approve:' || w.id
            AND o.operation_type = 'withdraw_approve'
          GROUP BY o.id
          HAVING count(*) = 1 AND sum(l.frozen_delta) = -(w.amount + w.fee)
        )
        AND w.payout_operation_id IS NULL
        THEN 'completed_at_0055'
      WHEN w.status = 'completed'
        AND EXISTS (
          SELECT 1 FROM public.financial_operations o
          JOIN public.financial_ledger l ON l.operation_id = o.id
          WHERE o.id = w.payout_operation_id
            AND o.operation_type IN ('withdraw_paid','withdraw_settle')
          GROUP BY o.id
          HAVING count(*) = 1 AND sum(l.frozen_delta) = -(w.amount + w.fee)
        )
        THEN 'legacy_completed_with_payout_debit'
      ELSE 'needs_manual_review'
    END AS classification
  FROM public.withdrawal_requests w
  WHERE w.status IN ('approved','completed')
)
SELECT classification, count(*) AS withdrawal_count
FROM report
GROUP BY classification
ORDER BY classification;
