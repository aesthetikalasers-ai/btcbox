#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
export PGCONNECT_TIMEOUT=10

echo "[race] Creating a committed disposable withdrawal fixture."
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
SELECT public.admin_manual_deposit_atomic(
  'MD-CI-RACE-0001',
  'admin-ci',
  'withdrawal-race-user',
  'USDT',
  50,
  'withdrawal-race-credit-0001',
  encode(extensions.digest(
    concat_ws('|','admin-ci','withdrawal-race-user','USDT','50','race-credit-ref','race-ci'),
    'sha256'
  ),'hex'),
  'race-credit-ref',
  'race-ci'
);

SELECT public.create_withdrawal_atomic(
  'WD-CI-RACE-0001',
  'withdrawal-race-user',
  'USDT',
  'TRC20',
  5,
  1,
  'T12345678',
  'withdrawal-race-request-0001',
  encode(extensions.digest(
    'withdrawal-race-user|USDT|TRC20|5|T12345678|withdrawal-race-request-0001',
    'sha256'
  ),'hex'),
  true,
  1,
  'USDT',
  6,
  1
);

-- Keep the winning transaction inside its row lock long enough for the other
-- independent psql session to reach SELECT ... FOR UPDATE and block behind it.
CREATE OR REPLACE FUNCTION public.ci_pause_withdrawal_race_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $race_pause$
BEGIN
  IF OLD.id = 'WD-CI-RACE-0001'
     AND OLD.status IN ('pending','pending_admin_review')
     AND NEW.status IN ('approved','rejected') THEN
    PERFORM pg_sleep(1.5);
  END IF;
  RETURN NEW;
END;
$race_pause$;

DROP TRIGGER IF EXISTS ci_pause_withdrawal_race_transition ON public.withdrawal_requests;
CREATE TRIGGER ci_pause_withdrawal_race_transition
BEFORE UPDATE OF status ON public.withdrawal_requests
FOR EACH ROW EXECUTE FUNCTION public.ci_pause_withdrawal_race_transition();
SQL

cleanup() {
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -q <<'SQL' || true
DROP TRIGGER IF EXISTS ci_pause_withdrawal_race_transition ON public.withdrawal_requests;
DROP FUNCTION IF EXISTS public.ci_pause_withdrawal_race_transition();
SQL
}
trap cleanup EXIT

echo "[race] Launching approve and reject from two independent PostgreSQL sessions."
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
  "SELECT public.review_withdrawal_atomic('WD-CI-RACE-0001','admin-race-approve',true,'parallel approve attempt');" \
  > /tmp/withdrawal-race-approve.log 2>&1 &
approve_pid=$!

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
  "SELECT public.review_withdrawal_atomic('WD-CI-RACE-0001','admin-race-reject',false,'parallel reject attempt');" \
  > /tmp/withdrawal-race-reject.log 2>&1 &
reject_pid=$!

wait "$approve_pid"
wait "$reject_pid"

echo "[race] Approve session: $(cat /tmp/withdrawal-race-approve.log)"
echo "[race] Reject session: $(cat /tmp/withdrawal-race-reject.log)"

echo "[race] Verifying exactly one decision and one financial transition."
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
DO $race_assert$
DECLARE
  v_status text;
  v_available numeric;
  v_frozen numeric;
  v_approve_ops integer;
  v_reject_ops integer;
  v_approve_ledger integer;
  v_reject_ledger integer;
  v_audits integer;
BEGIN
  SELECT status INTO v_status
  FROM public.withdrawal_requests
  WHERE id='WD-CI-RACE-0001';

  SELECT available,frozen INTO v_available,v_frozen
  FROM public.financial_accounts
  WHERE user_id='withdrawal-race-user' AND asset='USDT';

  SELECT count(*) INTO v_approve_ops
  FROM public.financial_operations
  WHERE idempotency_key='withdraw-approve:WD-CI-RACE-0001';

  SELECT count(*) INTO v_reject_ops
  FROM public.financial_operations
  WHERE idempotency_key='withdraw-review:WD-CI-RACE-0001';

  SELECT count(*) INTO v_approve_ledger
  FROM public.financial_ledger l
  JOIN public.financial_operations o ON o.id=l.operation_id
  WHERE o.idempotency_key='withdraw-approve:WD-CI-RACE-0001';

  SELECT count(*) INTO v_reject_ledger
  FROM public.financial_ledger l
  JOIN public.financial_operations o ON o.id=l.operation_id
  WHERE o.idempotency_key='withdraw-review:WD-CI-RACE-0001';

  SELECT count(*) INTO v_audits
  FROM public.financial_audit_log
  WHERE object_type='withdrawal' AND object_id='WD-CI-RACE-0001'
    AND action IN ('withdrawal_approved','withdrawal_rejected');

  IF v_status NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'parallel review left unexpected withdrawal status: %',v_status;
  END IF;
  IF v_frozen <> 0 THEN
    RAISE EXCEPTION 'parallel review left frozen funds: %',v_frozen;
  END IF;
  IF v_audits <> 1 THEN
    RAISE EXCEPTION 'parallel review wrote % decision audit rows, expected exactly one',v_audits;
  END IF;

  IF v_status='approved' THEN
    IF v_available<>44 OR v_approve_ops<>1 OR v_reject_ops<>0
       OR v_approve_ledger<>1 OR v_reject_ledger<>0 THEN
      RAISE EXCEPTION 'approve winner financial state mismatch: available %, approve ops %, reject ops %, approve ledger %, reject ledger %',
        v_available,v_approve_ops,v_reject_ops,v_approve_ledger,v_reject_ledger;
    END IF;
  ELSE
    IF v_available<>50 OR v_approve_ops<>0 OR v_reject_ops<>1
       OR v_approve_ledger<>0 OR v_reject_ledger<>1 THEN
      RAISE EXCEPTION 'reject winner financial state mismatch: available %, approve ops %, reject ops %, approve ledger %, reject ledger %',
        v_available,v_approve_ops,v_reject_ops,v_approve_ledger,v_reject_ledger;
    END IF;
  END IF;

  RAISE NOTICE 'Parallel approve/reject race passed: winner %, available %, frozen %, audit rows %',
    v_status,v_available,v_frozen,v_audits;
END
$race_assert$;
SQL

echo "[race] Parallel approve-versus-reject test passed."
