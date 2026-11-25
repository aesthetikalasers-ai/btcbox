-- 0055_withdrawal_approval_debit_at_review_v1.sql
-- Forward-only correction: consume the frozen withdrawal principal + fee at approval.
-- Manual payout completion is status/audit only and MUST NOT move balances.
-- Apply only after reviewing the complete migration chain in disposable PostgreSQL.
-- Rollout note: approvals committed under 0044 may still hold frozen funds. Reconcile
-- those pre-existing approved rows against their ledger state before allowing payout
-- completion under this new contract. Use the SELECT-only report at
-- backend/supabase/diagnostics/withdrawal-approval-reconciliation-report.sql; this
-- migration intentionally does not guess or auto-debit historical rows. Do not apply
-- to production without an approved reconciliation.

ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS rejection_reason text;

CREATE INDEX IF NOT EXISTS withdrawal_requests_user_history_idx
  ON public.withdrawal_requests (user_id, created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION public.review_withdrawal_atomic(
  p_withdrawal_id text,
  p_admin_id text,
  p_approve boolean,
  p_reason text DEFAULT ''
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_w public.withdrawal_requests%rowtype;
  v_result jsonb;
  v_operation_id uuid;
  v_status text;
  v_hash text;
BEGIN
  IF coalesce(p_withdrawal_id, '') = '' OR length(p_withdrawal_id) > 100
     OR coalesce(p_admin_id, '') = '' OR length(p_admin_id) > 128
     OR p_approve IS NULL
     OR length(coalesce(p_reason, '')) > 200
     OR coalesce(p_reason, '') ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'invalid withdrawal review request';
  END IF;

  SELECT * INTO v_w
  FROM public.withdrawal_requests
  WHERE id = p_withdrawal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'withdrawal not found';
  END IF;

  -- The row lock serializes approve/reject races. Any retry after a committed
  -- transition returns its persisted state without creating another operation/audit.
  IF v_w.status NOT IN ('pending', 'pending_admin_review') THEN
    RETURN jsonb_build_object(
      'ok', true, 'duplicate', true,
      'withdrawal_id', v_w.id, 'status', v_w.status
    );
  END IF;

  v_status := CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END;
  v_hash := encode(
    extensions.digest(v_w.id || ':' || v_status || ':' || coalesce(p_reason, ''), 'sha256'),
    'hex'
  );

  IF p_approve THEN
    -- The request creation transaction already froze amount + fee. Approval
    -- consumes that exact reservation without touching available balance.
    v_result := public.apply_financial_operation(
      'withdraw-approve:' || v_w.id,
      v_w.user_id,
      v_w.asset,
      'withdraw_approve',
      0,
      -(v_w.amount + v_w.fee),
      v_hash,
      jsonb_build_object(
        'withdrawal_id', v_w.id,
        'admin_id', p_admin_id,
        'reason', left(coalesce(p_reason, ''), 200),
        'freeze_operation_id', v_w.freeze_operation_id
      )
    );
  ELSE
    -- Rejection releases the exact frozen principal + fee back to available.
    v_result := public.apply_financial_operation(
      'withdraw-review:' || v_w.id,
      v_w.user_id,
      v_w.asset,
      'withdraw_reject',
      v_w.amount + v_w.fee,
      -(v_w.amount + v_w.fee),
      v_hash,
      jsonb_build_object(
        'withdrawal_id', v_w.id,
        'admin_id', p_admin_id,
        'reason', left(coalesce(p_reason, ''), 200),
        'freeze_operation_id', v_w.freeze_operation_id
      )
    );
  END IF;

  v_operation_id := (v_result->>'operation_id')::uuid;

  UPDATE public.withdrawal_requests
  SET status = v_status,
      reviewed_by = p_admin_id,
      reviewed_at = clock_timestamp(),
      rejection_reason = CASE WHEN p_approve THEN NULL ELSE left(coalesce(p_reason, ''), 200) END,
      review_operation_id = v_operation_id
  WHERE id = v_w.id;

  INSERT INTO public.financial_audit_log(
    actor_id, subject_user_id, action, object_type, object_id, reason, metadata
  ) VALUES (
    p_admin_id, v_w.user_id, 'withdrawal_' || v_status,
    'withdrawal', v_w.id, left(coalesce(p_reason, ''), 200),
    jsonb_build_object(
      'asset', v_w.asset,
      'amount', v_w.amount,
      'fee', v_w.fee,
      'network', v_w.network,
      'require_admin_review', v_w.require_admin_review,
      'freeze_operation_id', v_w.freeze_operation_id,
      'review_operation_id', v_operation_id
    )
  );

  RETURN jsonb_build_object(
    'ok', true, 'duplicate', false,
    'withdrawal_id', v_w.id, 'status', v_status,
    'review_operation_id', v_operation_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_withdrawal_paid_atomic(
  p_withdrawal_id text,
  p_admin_id text,
  p_reference text DEFAULT '',
  p_note text DEFAULT ''
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_w public.withdrawal_requests%rowtype;
  v_ref text := left(btrim(coalesce(p_reference, '')), 160);
  v_note text := left(btrim(coalesce(p_note, '')), 300);
  v_paid_at timestamptz;
BEGIN
  IF coalesce(p_withdrawal_id, '') = '' OR length(p_withdrawal_id) > 100
     OR coalesce(p_admin_id, '') = '' OR length(p_admin_id) > 128
     OR v_ref = '' OR length(coalesce(p_reference, '')) > 160
     OR coalesce(p_reference, '') ~ '[[:cntrl:]]'
     OR length(coalesce(p_note, '')) > 300
     OR coalesce(p_note, '') ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'invalid manual payout completion request';
  END IF;

  SELECT * INTO v_w
  FROM public.withdrawal_requests
  WHERE id = p_withdrawal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'withdrawal not found';
  END IF;

  IF v_w.status = 'completed' THEN
    IF coalesce(v_w.payout_reference, '') <> v_ref THEN
      RAISE EXCEPTION 'withdrawal already completed with a different internal payout reference';
    END IF;
    RETURN jsonb_build_object(
      'ok', true, 'duplicate', true,
      'withdrawal_id', v_w.id, 'status', v_w.status,
      'payout_reference', coalesce(v_w.payout_reference, ''),
      'paid_at', v_w.paid_at
    );
  END IF;

  IF v_w.status <> 'approved' THEN
    RAISE EXCEPTION 'withdrawal must be approved before manual payout completion';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.financial_operations o
    JOIN public.financial_ledger l ON l.operation_id = o.id
    WHERE o.id = v_w.review_operation_id
      AND o.idempotency_key = 'withdraw-approve:' || v_w.id
      AND o.operation_type = 'withdraw_approve'
      AND o.user_id = v_w.user_id
      AND o.asset = v_w.asset
    GROUP BY o.id
    HAVING count(*) = 1
       AND sum(l.available_delta) = 0
       AND sum(l.frozen_delta) = -(v_w.amount + v_w.fee)
  ) THEN
    RAISE EXCEPTION 'withdrawal approval debit not verified; manual reconciliation required';
  END IF;

  -- IMPORTANT: approval already consumed the frozen funds. This function
  -- records staff-entered payout completion only; no financial operation,
  -- balance update, ledger debit, or chain broadcast belongs here.
  v_paid_at := clock_timestamp();

  UPDATE public.withdrawal_requests
  SET status = 'completed',
      payout_reference = v_ref,
      payout_note = v_note,
      paid_by = p_admin_id,
      paid_at = v_paid_at,
      payout_operation_id = NULL
  WHERE id = v_w.id;

  INSERT INTO public.financial_audit_log(
    actor_id, subject_user_id, action, object_type, object_id, reason, metadata
  ) VALUES (
    p_admin_id, v_w.user_id, 'withdrawal_manual_payout_completed',
    'withdrawal', v_w.id, v_note,
    jsonb_build_object(
      'asset', v_w.asset,
      'amount', v_w.amount,
      'fee', v_w.fee,
      'network', v_w.network,
      'destination', v_w.destination,
      'internal_payout_reference', v_ref
    )
  );

  RETURN jsonb_build_object(
    'ok', true, 'duplicate', false,
    'withdrawal_id', v_w.id, 'status', 'completed',
    'payout_reference', v_ref, 'paid_at', v_paid_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.read_withdrawal_history_page_v1(
  p_user_id text,
  p_before_created_at timestamptz DEFAULT NULL,
  p_before_id text DEFAULT NULL,
  p_limit integer DEFAULT 20
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $withdrawal_history$
DECLARE
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 50));
  v_rows jsonb := '[]'::jsonb;
  v_count integer := 0;
  v_has_more boolean := false;
  v_last_created_at text;
  v_last_id text;
BEGIN
  IF coalesce(p_user_id, '') = '' OR length(p_user_id) > 128
     OR ((p_before_created_at IS NULL) <> (p_before_id IS NULL))
     OR (p_before_id IS NOT NULL AND (p_before_id = '' OR length(p_before_id) > 100))
     OR p_limit IS NULL OR p_limit < 1 OR p_limit > 50 THEN
    RAISE EXCEPTION 'invalid withdrawal history page request';
  END IF;

  SELECT
    coalesce(jsonb_agg(jsonb_build_object(
      'id', id,
      'coin', asset,
      'amount', amount,
      'fee', fee,
      'network', network,
      'address', destination,
      'status', status,
      'time', created_at,
      'reviewed_at', reviewed_at,
      'rejection_reason', rejection_reason
    ) ORDER BY created_at DESC, id DESC), '[]'::jsonb),
    count(*)::integer
  INTO v_rows, v_count
  FROM (
    SELECT id, asset, amount, fee, network, destination, status,
      created_at, reviewed_at, rejection_reason
    FROM public.withdrawal_requests
    WHERE user_id = p_user_id
      AND (
        p_before_created_at IS NULL
        OR (created_at, id) < (p_before_created_at, p_before_id)
      )
    ORDER BY created_at DESC, id DESC
    LIMIT v_limit + 1
  ) page_rows;

  v_has_more := v_count > v_limit;
  IF v_has_more THEN
    SELECT coalesce(jsonb_agg(value ORDER BY ordinality), '[]'::jsonb)
    INTO v_rows
    FROM jsonb_array_elements(v_rows) WITH ORDINALITY AS page(value, ordinality)
    WHERE ordinality <= v_limit;

    SELECT value->>'time', value->>'id'
    INTO v_last_created_at, v_last_id
    FROM jsonb_array_elements(v_rows) WITH ORDINALITY AS page(value, ordinality)
    ORDER BY ordinality DESC
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'withdrawals', v_rows,
    'has_more', v_has_more,
    'next_cursor', CASE
      WHEN v_has_more THEN jsonb_build_object('created_at', v_last_created_at, 'id', v_last_id)
      ELSE NULL
    END
  );
END;
$withdrawal_history$;

REVOKE ALL ON FUNCTION public.read_withdrawal_history_page_v1(text, timestamptz, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_withdrawal_history_page_v1(text, timestamptz, text, integer)
  TO service_role;

REVOKE ALL ON FUNCTION public.review_withdrawal_atomic(text, text, boolean, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_withdrawal_paid_atomic(text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_withdrawal_atomic(text, text, boolean, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_withdrawal_paid_atomic(text, text, text, text)
  TO service_role;
