-- Read-only withdrawal lifecycle reconciliation report.
-- Run BEFORE rolling migrations 0055/0056 into any persistent environment.
-- SELECT only: this file never updates balances, requests, operations, ledger, or audit rows.
--
-- The report validates operation identity AND ledger effects against the withdrawal's
-- settlement asset/amount. financial_accounts.frozen is aggregate per user/asset and
-- cannot be attributed to one request; it is shown as context only.
--
-- Classifications:
--   pending_frozen: request freeze is evidenced and no review transition exists.
--   approved_at_0055: approval operation consumed the exact settlement reservation.
--   legacy_approved_requires_manual_reconciliation: approved without a verified
--     approval debit. Do not mark paid through the 0055 flow.
--   rejected_released: rejection operation released the exact reservation.
--   completed_at_0055: approval debit exists; payout completion added no payout debit.
--   legacy_completed_with_payout_debit: historical payout operation consumed the
--     reservation at completion; do not debit it again.
--   needs_manual_review: missing, duplicate, mismatched, or contradictory evidence.
--
-- Do not auto-correct balances or statuses from this report.

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
),
evidence AS (
  SELECT
    w.*,
    freeze_op.id AS freeze_evidence_id,
    freeze_op.operation_type AS freeze_operation_type,
    freeze_op.user_id AS freeze_user_id,
    freeze_op.asset AS freeze_asset,
    freeze_op.ledger_rows AS freeze_ledger_rows,
    freeze_op.available_delta AS freeze_available_delta,
    freeze_op.frozen_delta AS freeze_frozen_delta,
    approve_op.id AS approval_evidence_id,
    approve_op.idempotency_key AS approval_idempotency_key,
    approve_op.operation_type AS approval_operation_type,
    approve_op.user_id AS approval_user_id,
    approve_op.asset AS approval_asset,
    approve_op.ledger_rows AS approval_ledger_rows,
    approve_op.available_delta AS approval_available_delta,
    approve_op.frozen_delta AS approval_frozen_delta,
    reject_op.id AS rejection_evidence_id,
    reject_op.idempotency_key AS rejection_idempotency_key,
    reject_op.operation_type AS rejection_operation_type,
    reject_op.user_id AS rejection_user_id,
    reject_op.asset AS rejection_asset,
    reject_op.ledger_rows AS rejection_ledger_rows,
    reject_op.available_delta AS rejection_available_delta,
    reject_op.frozen_delta AS rejection_frozen_delta,
    payout_op.id AS payout_evidence_id,
    payout_op.operation_type AS payout_operation_type,
    payout_op.user_id AS payout_user_id,
    payout_op.asset AS payout_asset,
    payout_op.ledger_rows AS payout_ledger_rows,
    payout_op.available_delta AS payout_available_delta,
    payout_op.frozen_delta AS payout_frozen_delta,
    account.frozen AS user_aggregate_frozen_balance
  FROM public.withdrawal_requests w
  LEFT JOIN operation_ledger freeze_op
    ON freeze_op.id = w.freeze_operation_id
  LEFT JOIN operation_ledger approve_op
    ON approve_op.id = w.review_operation_id
  LEFT JOIN operation_ledger reject_op
    ON reject_op.idempotency_key = 'withdraw-review:' || w.id
  LEFT JOIN operation_ledger payout_op
    ON payout_op.id = w.payout_operation_id
  LEFT JOIN public.financial_accounts account
    ON account.user_id = w.user_id AND account.asset = w.settlement_asset
),
classified AS (
  SELECT *,
    (
      freeze_operation_type = 'withdraw_freeze'
      AND freeze_user_id = user_id
      AND freeze_asset = settlement_asset
      AND freeze_ledger_rows = 1
      AND freeze_available_delta = -settlement_amount
      AND freeze_frozen_delta = settlement_amount
    ) AS freeze_is_valid,
    (
      approval_evidence_id IS NOT NULL
      AND approval_idempotency_key = 'withdraw-approve:' || id
      AND approval_operation_type = 'withdraw_approve'
      AND approval_user_id = user_id
      AND approval_asset = settlement_asset
      AND approval_ledger_rows = 1
      AND approval_available_delta = 0
      AND approval_frozen_delta = -settlement_amount
    ) AS approval_is_valid,
    (
      rejection_evidence_id IS NOT NULL
      AND rejection_idempotency_key = 'withdraw-review:' || id
      AND rejection_operation_type = 'withdraw_reject'
      AND rejection_user_id = user_id
      AND rejection_asset = settlement_asset
      AND rejection_ledger_rows = 1
      AND rejection_available_delta = settlement_amount
      AND rejection_frozen_delta = -settlement_amount
    ) AS rejection_is_valid,
    (
      payout_evidence_id IS NOT NULL
      AND payout_operation_type IN ('withdraw_paid','withdraw_settle')
      AND payout_user_id = user_id
      AND payout_asset = settlement_asset
      AND payout_ledger_rows = 1
      AND payout_available_delta = 0
      AND payout_frozen_delta = -settlement_amount
    ) AS payout_is_valid
  FROM evidence
)
SELECT
  id AS withdrawal_id,
  user_id,
  asset AS payout_asset,
  settlement_asset,
  status,
  created_at,
  reviewed_at,
  amount AS payout_amount,
  fee AS payout_fee,
  settlement_amount AS reserved_total,
  conversion_rate,
  freeze_operation_id,
  freeze_operation_type,
  freeze_ledger_rows,
  freeze_available_delta,
  freeze_frozen_delta,
  review_operation_id,
  approval_evidence_id,
  approval_operation_type,
  approval_ledger_rows,
  approval_available_delta,
  approval_frozen_delta,
  rejection_evidence_id,
  rejection_operation_type,
  rejection_ledger_rows,
  rejection_available_delta,
  rejection_frozen_delta,
  payout_operation_id,
  payout_operation_type,
  payout_ledger_rows,
  payout_available_delta,
  payout_frozen_delta,
  user_aggregate_frozen_balance,
  CASE
    WHEN status IN ('pending','pending_admin_review')
      AND freeze_is_valid
      AND approval_evidence_id IS NULL
      AND rejection_evidence_id IS NULL
      THEN 'pending_frozen'
    WHEN status = 'approved' AND approval_is_valid
      THEN 'approved_at_0055'
    WHEN status = 'approved' AND freeze_is_valid
      THEN 'legacy_approved_requires_manual_reconciliation'
    WHEN status = 'rejected' AND rejection_is_valid
      THEN 'rejected_released'
    WHEN status = 'completed' AND approval_is_valid AND payout_operation_id IS NULL
      THEN 'completed_at_0055'
    WHEN status = 'completed' AND payout_is_valid
      THEN 'legacy_completed_with_payout_debit'
    ELSE 'needs_manual_review'
  END AS reconciliation_classification
FROM classified
ORDER BY created_at, id;

-- Summary counts. The detailed result above is the evidence record for each row.
WITH operation_ledger AS (
  SELECT o.id, o.idempotency_key, o.operation_type, o.user_id, o.asset,
    count(l.operation_id)::integer AS ledger_rows,
    coalesce(sum(l.available_delta),0) AS available_delta,
    coalesce(sum(l.frozen_delta),0) AS frozen_delta
  FROM public.financial_operations o
  LEFT JOIN public.financial_ledger l ON l.operation_id=o.id
  GROUP BY o.id,o.idempotency_key,o.operation_type,o.user_id,o.asset
),
evidence AS (
  SELECT w.*,
    freeze_op.id AS freeze_id, freeze_op.operation_type AS freeze_type,
    freeze_op.user_id AS freeze_user, freeze_op.asset AS freeze_asset,
    freeze_op.ledger_rows AS freeze_rows, freeze_op.available_delta AS freeze_available,
    freeze_op.frozen_delta AS freeze_frozen,
    approve_op.id AS approve_id, approve_op.idempotency_key AS approve_key,
    approve_op.operation_type AS approve_type, approve_op.user_id AS approve_user,
    approve_op.asset AS approve_asset, approve_op.ledger_rows AS approve_rows,
    approve_op.available_delta AS approve_available, approve_op.frozen_delta AS approve_frozen,
    reject_op.id AS reject_id, reject_op.idempotency_key AS reject_key,
    reject_op.operation_type AS reject_type, reject_op.user_id AS reject_user,
    reject_op.asset AS reject_asset, reject_op.ledger_rows AS reject_rows,
    reject_op.available_delta AS reject_available, reject_op.frozen_delta AS reject_frozen,
    payout_op.id AS payout_id, payout_op.operation_type AS payout_type,
    payout_op.user_id AS payout_user, payout_op.asset AS payout_asset,
    payout_op.ledger_rows AS payout_rows, payout_op.available_delta AS payout_available,
    payout_op.frozen_delta AS payout_frozen
  FROM public.withdrawal_requests w
  LEFT JOIN operation_ledger freeze_op ON freeze_op.id=w.freeze_operation_id
  LEFT JOIN operation_ledger approve_op ON approve_op.id=w.review_operation_id
  LEFT JOIN operation_ledger reject_op ON reject_op.idempotency_key='withdraw-review:'||w.id
  LEFT JOIN operation_ledger payout_op ON payout_op.id=w.payout_operation_id
),
classified AS (
  SELECT *,
    (freeze_type='withdraw_freeze' AND freeze_user=user_id AND freeze_asset=settlement_asset
      AND freeze_rows=1 AND freeze_available=-settlement_amount AND freeze_frozen=settlement_amount) AS freeze_ok,
    (approve_id IS NOT NULL AND approve_key='withdraw-approve:'||id AND approve_type='withdraw_approve'
      AND approve_user=user_id AND approve_asset=settlement_asset AND approve_rows=1
      AND approve_available=0 AND approve_frozen=-settlement_amount) AS approve_ok,
    (reject_id IS NOT NULL AND reject_key='withdraw-review:'||id AND reject_type='withdraw_reject'
      AND reject_user=user_id AND reject_asset=settlement_asset AND reject_rows=1
      AND reject_available=settlement_amount AND reject_frozen=-settlement_amount) AS reject_ok,
    (payout_id IS NOT NULL AND payout_type IN ('withdraw_paid','withdraw_settle')
      AND payout_user=user_id AND payout_asset=settlement_asset AND payout_rows=1
      AND payout_available=0 AND payout_frozen=-settlement_amount) AS payout_ok
  FROM evidence
)
SELECT classification, count(*) AS withdrawal_count
FROM (
  SELECT CASE
    WHEN status IN ('pending','pending_admin_review') AND freeze_ok AND approve_id IS NULL AND reject_id IS NULL
      THEN 'pending_frozen'
    WHEN status='approved' AND approve_ok THEN 'approved_at_0055'
    WHEN status='approved' AND freeze_ok THEN 'legacy_approved_requires_manual_reconciliation'
    WHEN status='rejected' AND reject_ok THEN 'rejected_released'
    WHEN status='completed' AND approve_ok AND payout_operation_id IS NULL THEN 'completed_at_0055'
    WHEN status='completed' AND payout_ok THEN 'legacy_completed_with_payout_debit'
    ELSE 'needs_manual_review'
  END AS classification
  FROM classified
) report
GROUP BY classification
ORDER BY classification;
