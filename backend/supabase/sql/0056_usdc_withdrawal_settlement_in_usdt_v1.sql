-- 0056_usdc_withdrawal_settlement_in_usdt_v1.sql
-- USDC remains the payout asset/network. The user's reserved and debited asset
-- is USDT, using a server-fetched USDC/USDT spot rate locked at request creation.
-- Existing requests retain their original ledger asset and amount.

ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS settlement_asset text,
  ADD COLUMN IF NOT EXISTS settlement_amount numeric(38,18),
  ADD COLUMN IF NOT EXISTS conversion_rate numeric(38,18);

UPDATE public.withdrawal_requests
SET settlement_asset = asset,
    settlement_amount = amount + fee,
    conversion_rate = 1
WHERE settlement_asset IS NULL OR settlement_amount IS NULL OR conversion_rate IS NULL;

ALTER TABLE public.withdrawal_requests
  ALTER COLUMN settlement_asset SET NOT NULL,
  ALTER COLUMN settlement_amount SET NOT NULL,
  ALTER COLUMN conversion_rate SET NOT NULL;

DO $constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.withdrawal_requests'::regclass AND conname='withdrawal_requests_settlement_asset_check') THEN
    ALTER TABLE public.withdrawal_requests ADD CONSTRAINT withdrawal_requests_settlement_asset_check
      CHECK (settlement_asset ~ '^[A-Z0-9]{2,16}$') NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.withdrawal_requests'::regclass AND conname='withdrawal_requests_settlement_amount_check') THEN
    ALTER TABLE public.withdrawal_requests ADD CONSTRAINT withdrawal_requests_settlement_amount_check
      CHECK (settlement_amount > 0 AND conversion_rate > 0) NOT VALID;
  END IF;
END;
$constraints$;

ALTER TABLE public.withdrawal_requests VALIDATE CONSTRAINT withdrawal_requests_settlement_asset_check;
ALTER TABLE public.withdrawal_requests VALIDATE CONSTRAINT withdrawal_requests_settlement_amount_check;

DROP FUNCTION IF EXISTS public.create_withdrawal_atomic(text,text,text,text,numeric,numeric,text,text,text,boolean,numeric);

CREATE FUNCTION public.create_withdrawal_atomic(
  p_withdrawal_id text, p_user_id text, p_asset text, p_network text,
  p_amount numeric, p_fee numeric, p_destination text, p_request_id text,
  p_request_hash text, p_require_admin_review boolean, p_expected_fee numeric,
  p_settlement_asset text, p_settlement_amount numeric, p_conversion_rate numeric
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_existing public.withdrawal_requests%rowtype;
  v_result jsonb;
  v_operation_id uuid;
  v_status text;
  v_require_admin_review boolean;
  v_expected_settlement numeric(38,18);
BEGIN
  IF coalesce(p_withdrawal_id, '') = '' OR coalesce(p_user_id, '') = ''
     OR coalesce(p_asset, '') !~ '^[A-Z0-9]{2,16}$'
     OR coalesce(p_network, '') = ''
     OR p_amount IS NULL OR p_amount <= 0 OR p_fee IS NULL OR p_fee < 0
     OR p_expected_fee IS NULL OR p_expected_fee < 0
     OR length(coalesce(p_destination, '')) < 8
     OR length(coalesce(p_request_id, '')) < 16 OR length(coalesce(p_request_id, '')) > 128
     OR coalesce(p_request_hash, '') !~ '^[a-f0-9]{64}$'
     OR p_require_admin_review IS NULL THEN
    RAISE EXCEPTION 'invalid withdrawal request';
  END IF;

  -- Serialize first-use retries, including the absent-row case.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id, 0));
  SELECT * INTO v_existing FROM public.withdrawal_requests WHERE request_id = p_request_id FOR UPDATE;
  IF FOUND THEN
    IF v_existing.user_id IS DISTINCT FROM p_user_id
       OR v_existing.asset IS DISTINCT FROM p_asset
       OR v_existing.network IS DISTINCT FROM p_network
       OR v_existing.amount IS DISTINCT FROM p_amount
       OR v_existing.destination IS DISTINCT FROM p_destination
       OR (v_existing.request_hash IS NOT NULL AND v_existing.request_hash IS DISTINCT FROM p_request_hash) THEN
      RAISE EXCEPTION 'idempotency key payload mismatch';
    END IF;
    RETURN jsonb_build_object(
      'ok', true, 'duplicate', true, 'withdrawal_id', v_existing.id,
      'status', v_existing.status, 'fee', v_existing.fee,
      'require_admin_review', v_existing.require_admin_review,
      'settlement_asset', v_existing.settlement_asset,
      'settlement_amount', v_existing.settlement_amount,
      'conversion_rate', v_existing.conversion_rate
    );
  END IF;

  -- Idempotent retries are resolved before needing a fresh market quote.
  -- If the request already exists, return its originally locked settlement values.
  IF coalesce(p_settlement_asset, '') !~ '^[A-Z0-9]{2,16}

  -- Retain the database-authoritative first-successful-withdrawal review guard.
  v_require_admin_review := p_require_admin_review OR NOT EXISTS (
    SELECT 1 FROM public.withdrawal_requests
    WHERE user_id = p_user_id AND status IN ('completed', 'success', 'approved', 'broadcast')
  );
  v_status := CASE WHEN v_require_admin_review THEN 'pending_admin_review' ELSE 'pending' END;

  v_result := public.apply_financial_operation(
    'withdraw-freeze:' || p_request_id, p_user_id, p_settlement_asset,
    'withdraw_freeze', -p_settlement_amount, p_settlement_amount, p_request_hash,
    jsonb_build_object(
      'withdrawal_id', p_withdrawal_id, 'payout_asset', p_asset,
      'payout_amount', p_amount, 'payout_fee', p_fee,
      'settlement_asset', p_settlement_asset, 'settlement_amount', p_settlement_amount,
      'conversion_rate', p_conversion_rate, 'network', p_network,
      'require_admin_review', v_require_admin_review
    )
  );
  v_operation_id := (v_result->>'operation_id')::uuid;

  INSERT INTO public.withdrawal_requests (
    id, user_id, asset, network, amount, fee, destination, status,
    request_id, freeze_operation_id, require_admin_review, request_hash,
    settlement_asset, settlement_amount, conversion_rate
  ) VALUES (
    p_withdrawal_id, p_user_id, p_asset, p_network, p_amount, p_fee, p_destination, v_status,
    p_request_id, v_operation_id, v_require_admin_review, p_request_hash,
    p_settlement_asset, p_settlement_amount, p_conversion_rate
  );

  INSERT INTO public.financial_audit_log(actor_id, subject_user_id, action, object_type, object_id, reason, metadata)
  VALUES (
    'system', p_user_id, 'withdrawal_created', 'withdrawal', p_withdrawal_id, NULL,
    jsonb_build_object(
      'asset', p_asset, 'amount', p_amount, 'fee', p_fee, 'settlement_asset', p_settlement_asset,
      'settlement_amount', p_settlement_amount, 'conversion_rate', p_conversion_rate,
      'network', p_network, 'require_admin_review', v_require_admin_review, 'request_id', p_request_id
    )
  );

  RETURN jsonb_build_object(
    'ok', true, 'duplicate', false, 'withdrawal_id', p_withdrawal_id,
    'status', v_status, 'fee', p_fee, 'require_admin_review', v_require_admin_review,
    'settlement_asset', p_settlement_asset, 'settlement_amount', p_settlement_amount,
    'conversion_rate', p_conversion_rate
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_withdrawal_atomic(text,text,text,text,numeric,numeric,text,text,text,boolean,numeric,text,numeric,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_withdrawal_atomic(text,text,text,text,numeric,numeric,text,text,text,boolean,numeric,text,numeric,numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.review_withdrawal_atomic(
  p_withdrawal_id text, p_admin_id text, p_approve boolean, p_reason text DEFAULT ''
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
     OR p_approve IS NULL OR length(coalesce(p_reason, '')) > 200
     OR coalesce(p_reason, '') ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'invalid withdrawal review request';
  END IF;
  SELECT * INTO v_w FROM public.withdrawal_requests WHERE id = p_withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'withdrawal not found'; END IF;
  IF v_w.status NOT IN ('pending', 'pending_admin_review') THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'withdrawal_id', v_w.id, 'status', v_w.status);
  END IF;

  v_status := CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END;
  v_hash := encode(extensions.digest(v_w.id || ':' || v_status || ':' || coalesce(p_reason, ''), 'sha256'), 'hex');

  IF p_approve THEN
    v_result := public.apply_financial_operation(
      'withdraw-approve:' || v_w.id, v_w.user_id, v_w.settlement_asset,
      'withdraw_approve', 0, -v_w.settlement_amount, v_hash,
      jsonb_build_object(
        'withdrawal_id', v_w.id, 'admin_id', p_admin_id,
        'payout_asset', v_w.asset, 'payout_amount', v_w.amount, 'payout_fee', v_w.fee,
        'settlement_asset', v_w.settlement_asset, 'settlement_amount', v_w.settlement_amount,
        'conversion_rate', v_w.conversion_rate, 'reason', left(coalesce(p_reason, ''), 200),
        'freeze_operation_id', v_w.freeze_operation_id
      )
    );
  ELSE
    v_result := public.apply_financial_operation(
      'withdraw-review:' || v_w.id, v_w.user_id, v_w.settlement_asset,
      'withdraw_reject', v_w.settlement_amount, -v_w.settlement_amount, v_hash,
      jsonb_build_object(
        'withdrawal_id', v_w.id, 'admin_id', p_admin_id,
        'payout_asset', v_w.asset, 'payout_amount', v_w.amount, 'payout_fee', v_w.fee,
        'settlement_asset', v_w.settlement_asset, 'settlement_amount', v_w.settlement_amount,
        'conversion_rate', v_w.conversion_rate, 'reason', left(coalesce(p_reason, ''), 200),
        'freeze_operation_id', v_w.freeze_operation_id
      )
    );
  END IF;

  v_operation_id := (v_result->>'operation_id')::uuid;
  UPDATE public.withdrawal_requests
  SET status = v_status, reviewed_by = p_admin_id, reviewed_at = clock_timestamp(),
      rejection_reason = CASE WHEN p_approve THEN NULL ELSE left(coalesce(p_reason, ''), 200) END,
      review_operation_id = v_operation_id
  WHERE id = v_w.id;

  INSERT INTO public.financial_audit_log(actor_id, subject_user_id, action, object_type, object_id, reason, metadata)
  VALUES (
    p_admin_id, v_w.user_id, 'withdrawal_' || v_status, 'withdrawal', v_w.id,
    left(coalesce(p_reason, ''), 200),
    jsonb_build_object(
      'asset', v_w.asset, 'amount', v_w.amount, 'fee', v_w.fee, 'network', v_w.network,
      'settlement_asset', v_w.settlement_asset, 'settlement_amount', v_w.settlement_amount,
      'conversion_rate', v_w.conversion_rate, 'require_admin_review', v_w.require_admin_review,
      'freeze_operation_id', v_w.freeze_operation_id, 'review_operation_id', v_operation_id
    )
  );
  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'withdrawal_id', v_w.id,
    'status', v_status, 'review_operation_id', v_operation_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_withdrawal_paid_atomic(
  p_withdrawal_id text, p_admin_id text, p_reference text DEFAULT '', p_note text DEFAULT ''
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
     OR length(coalesce(p_note, '')) > 300 OR coalesce(p_note, '') ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'invalid manual payout completion request';
  END IF;
  SELECT * INTO v_w FROM public.withdrawal_requests WHERE id = p_withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'withdrawal not found'; END IF;

  IF v_w.status = 'completed' THEN
    IF coalesce(v_w.payout_reference, '') <> v_ref THEN
      RAISE EXCEPTION 'withdrawal already completed with a different internal payout reference';
    END IF;
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'withdrawal_id', v_w.id,
      'status', v_w.status, 'payout_reference', coalesce(v_w.payout_reference, ''), 'paid_at', v_w.paid_at);
  END IF;
  IF v_w.status <> 'approved' THEN RAISE EXCEPTION 'withdrawal must be approved before manual payout completion'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.financial_operations o
    JOIN public.financial_ledger l ON l.operation_id = o.id
    WHERE o.id = v_w.review_operation_id
      AND o.idempotency_key = 'withdraw-approve:' || v_w.id
      AND o.operation_type = 'withdraw_approve'
      AND o.user_id = v_w.user_id AND o.asset = v_w.settlement_asset
    GROUP BY o.id
    HAVING count(*) = 1 AND sum(l.available_delta) = 0
       AND sum(l.frozen_delta) = -v_w.settlement_amount
  ) THEN
    RAISE EXCEPTION 'withdrawal approval debit not verified; manual reconciliation required';
  END IF;

  -- Approval already consumed the locked settlement amount. This is status/audit only.
  v_paid_at := clock_timestamp();
  UPDATE public.withdrawal_requests
  SET status = 'completed', payout_reference = v_ref, payout_note = v_note,
      paid_by = p_admin_id, paid_at = v_paid_at, payout_operation_id = NULL
  WHERE id = v_w.id;

  INSERT INTO public.financial_audit_log(actor_id, subject_user_id, action, object_type, object_id, reason, metadata)
  VALUES (
    p_admin_id, v_w.user_id, 'withdrawal_manual_payout_completed', 'withdrawal', v_w.id, v_note,
    jsonb_build_object(
      'asset', v_w.asset, 'amount', v_w.amount, 'fee', v_w.fee,
      'settlement_asset', v_w.settlement_asset, 'settlement_amount', v_w.settlement_amount,
      'conversion_rate', v_w.conversion_rate, 'network', v_w.network,
      'destination', v_w.destination, 'internal_payout_reference', v_ref
    )
  );
  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'withdrawal_id', v_w.id,
    'status', 'completed', 'payout_reference', v_ref, 'paid_at', v_paid_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.read_admin_withdrawal_snapshot_v1()
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_count integer; v_review_count integer; v_withdrawals jsonb;
BEGIN
  SELECT count(*)::integer, count(*) FILTER (WHERE status = 'pending_admin_review')::integer
  INTO v_count, v_review_count FROM public.withdrawal_requests
  WHERE status IN ('pending', 'pending_admin_review');

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'uid', user_id, 'coin', asset, 'amount', amount, 'fee', fee,
    'settlement_asset', settlement_asset, 'settlement_amount', settlement_amount,
    'conversion_rate', conversion_rate, 'network', network, 'address', destination,
    'status', status, 'require_admin_review', require_admin_review, 'txid', '', 'time', created_at
  ) ORDER BY created_at DESC), '[]'::jsonb)
  INTO v_withdrawals
  FROM (
    SELECT id, user_id, asset, amount, fee, settlement_asset, settlement_amount,
      conversion_rate, network, destination, status, require_admin_review, created_at
    FROM public.withdrawal_requests
    WHERE status IN ('pending', 'pending_admin_review')
    ORDER BY created_at DESC LIMIT 200
  ) recent;

  RETURN jsonb_build_object('ok', true, 'pending_count', v_count,
    'pending_admin_review_count', v_review_count, 'withdrawals', v_withdrawals);
END;
$$;

CREATE OR REPLACE FUNCTION public.read_withdrawal_history_page_v1(
  p_user_id text, p_before_created_at timestamptz DEFAULT NULL,
  p_before_id text DEFAULT NULL, p_limit integer DEFAULT 20
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

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'coin', asset, 'amount', amount, 'fee', fee,
    'settlement_asset', settlement_asset, 'settlement_amount', settlement_amount,
    'conversion_rate', conversion_rate, 'network', network, 'address', destination,
    'status', status, 'time', created_at, 'reviewed_at', reviewed_at,
    'rejection_reason', rejection_reason
  ) ORDER BY created_at DESC, id DESC), '[]'::jsonb), count(*)::integer
  INTO v_rows, v_count
  FROM (
    SELECT id, asset, amount, fee, settlement_asset, settlement_amount, conversion_rate,
      network, destination, status, created_at, reviewed_at, rejection_reason
    FROM public.withdrawal_requests
    WHERE user_id = p_user_id
      AND (p_before_created_at IS NULL OR (created_at, id) < (p_before_created_at, p_before_id))
    ORDER BY created_at DESC, id DESC LIMIT v_limit + 1
  ) page_rows;

  v_has_more := v_count > v_limit;
  IF v_has_more THEN
    SELECT coalesce(jsonb_agg(value ORDER BY ordinality), '[]'::jsonb)
    INTO v_rows
    FROM jsonb_array_elements(v_rows) WITH ORDINALITY AS page(value, ordinality)
    WHERE ordinality <= v_limit;
    SELECT value->>'time', value->>'id' INTO v_last_created_at, v_last_id
    FROM jsonb_array_elements(v_rows) WITH ORDINALITY AS page(value, ordinality)
    ORDER BY ordinality DESC LIMIT 1;
  END IF;

  RETURN jsonb_build_object('ok', true, 'withdrawals', v_rows, 'has_more', v_has_more,
    'next_cursor', CASE WHEN v_has_more THEN jsonb_build_object('created_at', v_last_created_at, 'id', v_last_id) ELSE NULL END);
END;
$withdrawal_history$;

REVOKE ALL ON FUNCTION public.read_admin_withdrawal_snapshot_v1() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_admin_withdrawal_snapshot_v1() TO service_role;
REVOKE ALL ON FUNCTION public.review_withdrawal_atomic(text,text,boolean,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_withdrawal_paid_atomic(text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_withdrawal_atomic(text,text,boolean,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_withdrawal_paid_atomic(text,text,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.read_withdrawal_history_page_v1(text,timestamptz,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_withdrawal_history_page_v1(text,timestamptz,text,integer) TO service_role;

     OR p_settlement_amount IS NULL OR p_settlement_amount <= 0
     OR p_conversion_rate IS NULL OR p_conversion_rate <= 0 THEN
    RAISE EXCEPTION 'USDC conversion rate unavailable or invalid settlement quote';
  END IF;
  IF p_asset = 'USDC' THEN
    IF p_settlement_asset <> 'USDT' THEN RAISE EXCEPTION 'USDC withdrawals must settle in USDT'; END IF;
    v_expected_settlement := ceil((p_amount + p_fee) * p_conversion_rate * 1000000000000000000) / 1000000000000000000;
  ELSE
    IF p_settlement_asset <> p_asset OR p_conversion_rate <> 1 THEN
      RAISE EXCEPTION 'non-USDC withdrawals must settle in their payout asset';
    END IF;
    v_expected_settlement := p_amount + p_fee;
  END IF;
  IF p_settlement_amount IS DISTINCT FROM v_expected_settlement THEN
    RAISE EXCEPTION 'withdrawal settlement amount does not match locked conversion';
  END IF;

  IF p_expected_fee IS DISTINCT FROM p_fee THEN RAISE EXCEPTION 'withdrawal fee changed'; END IF;

  -- Retain the database-authoritative first-successful-withdrawal review guard.
  v_require_admin_review := p_require_admin_review OR NOT EXISTS (
    SELECT 1 FROM public.withdrawal_requests
    WHERE user_id = p_user_id AND status IN ('completed', 'success', 'approved', 'broadcast')
  );
  v_status := CASE WHEN v_require_admin_review THEN 'pending_admin_review' ELSE 'pending' END;

  v_result := public.apply_financial_operation(
    'withdraw-freeze:' || p_request_id, p_user_id, p_settlement_asset,
    'withdraw_freeze', -p_settlement_amount, p_settlement_amount, p_request_hash,
    jsonb_build_object(
      'withdrawal_id', p_withdrawal_id, 'payout_asset', p_asset,
      'payout_amount', p_amount, 'payout_fee', p_fee,
      'settlement_asset', p_settlement_asset, 'settlement_amount', p_settlement_amount,
      'conversion_rate', p_conversion_rate, 'network', p_network,
      'require_admin_review', v_require_admin_review
    )
  );
  v_operation_id := (v_result->>'operation_id')::uuid;

  INSERT INTO public.withdrawal_requests (
    id, user_id, asset, network, amount, fee, destination, status,
    request_id, freeze_operation_id, require_admin_review, request_hash,
    settlement_asset, settlement_amount, conversion_rate
  ) VALUES (
    p_withdrawal_id, p_user_id, p_asset, p_network, p_amount, p_fee, p_destination, v_status,
    p_request_id, v_operation_id, v_require_admin_review, p_request_hash,
    p_settlement_asset, p_settlement_amount, p_conversion_rate
  );

  INSERT INTO public.financial_audit_log(actor_id, subject_user_id, action, object_type, object_id, reason, metadata)
  VALUES (
    'system', p_user_id, 'withdrawal_created', 'withdrawal', p_withdrawal_id, NULL,
    jsonb_build_object(
      'asset', p_asset, 'amount', p_amount, 'fee', p_fee, 'settlement_asset', p_settlement_asset,
      'settlement_amount', p_settlement_amount, 'conversion_rate', p_conversion_rate,
      'network', p_network, 'require_admin_review', v_require_admin_review, 'request_id', p_request_id
    )
  );

  RETURN jsonb_build_object(
    'ok', true, 'duplicate', false, 'withdrawal_id', p_withdrawal_id,
    'status', v_status, 'fee', p_fee, 'require_admin_review', v_require_admin_review,
    'settlement_asset', p_settlement_asset, 'settlement_amount', p_settlement_amount,
    'conversion_rate', p_conversion_rate
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_withdrawal_atomic(text,text,text,text,numeric,numeric,text,text,text,boolean,numeric,text,numeric,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_withdrawal_atomic(text,text,text,text,numeric,numeric,text,text,text,boolean,numeric,text,numeric,numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.review_withdrawal_atomic(
  p_withdrawal_id text, p_admin_id text, p_approve boolean, p_reason text DEFAULT ''
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
     OR p_approve IS NULL OR length(coalesce(p_reason, '')) > 200
     OR coalesce(p_reason, '') ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'invalid withdrawal review request';
  END IF;
  SELECT * INTO v_w FROM public.withdrawal_requests WHERE id = p_withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'withdrawal not found'; END IF;
  IF v_w.status NOT IN ('pending', 'pending_admin_review') THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'withdrawal_id', v_w.id, 'status', v_w.status);
  END IF;

  v_status := CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END;
  v_hash := encode(extensions.digest(v_w.id || ':' || v_status || ':' || coalesce(p_reason, ''), 'sha256'), 'hex');

  IF p_approve THEN
    v_result := public.apply_financial_operation(
      'withdraw-approve:' || v_w.id, v_w.user_id, v_w.settlement_asset,
      'withdraw_approve', 0, -v_w.settlement_amount, v_hash,
      jsonb_build_object(
        'withdrawal_id', v_w.id, 'admin_id', p_admin_id,
        'payout_asset', v_w.asset, 'payout_amount', v_w.amount, 'payout_fee', v_w.fee,
        'settlement_asset', v_w.settlement_asset, 'settlement_amount', v_w.settlement_amount,
        'conversion_rate', v_w.conversion_rate, 'reason', left(coalesce(p_reason, ''), 200),
        'freeze_operation_id', v_w.freeze_operation_id
      )
    );
  ELSE
    v_result := public.apply_financial_operation(
      'withdraw-review:' || v_w.id, v_w.user_id, v_w.settlement_asset,
      'withdraw_reject', v_w.settlement_amount, -v_w.settlement_amount, v_hash,
      jsonb_build_object(
        'withdrawal_id', v_w.id, 'admin_id', p_admin_id,
        'payout_asset', v_w.asset, 'payout_amount', v_w.amount, 'payout_fee', v_w.fee,
        'settlement_asset', v_w.settlement_asset, 'settlement_amount', v_w.settlement_amount,
        'conversion_rate', v_w.conversion_rate, 'reason', left(coalesce(p_reason, ''), 200),
        'freeze_operation_id', v_w.freeze_operation_id
      )
    );
  END IF;

  v_operation_id := (v_result->>'operation_id')::uuid;
  UPDATE public.withdrawal_requests
  SET status = v_status, reviewed_by = p_admin_id, reviewed_at = clock_timestamp(),
      rejection_reason = CASE WHEN p_approve THEN NULL ELSE left(coalesce(p_reason, ''), 200) END,
      review_operation_id = v_operation_id
  WHERE id = v_w.id;

  INSERT INTO public.financial_audit_log(actor_id, subject_user_id, action, object_type, object_id, reason, metadata)
  VALUES (
    p_admin_id, v_w.user_id, 'withdrawal_' || v_status, 'withdrawal', v_w.id,
    left(coalesce(p_reason, ''), 200),
    jsonb_build_object(
      'asset', v_w.asset, 'amount', v_w.amount, 'fee', v_w.fee, 'network', v_w.network,
      'settlement_asset', v_w.settlement_asset, 'settlement_amount', v_w.settlement_amount,
      'conversion_rate', v_w.conversion_rate, 'require_admin_review', v_w.require_admin_review,
      'freeze_operation_id', v_w.freeze_operation_id, 'review_operation_id', v_operation_id
    )
  );
  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'withdrawal_id', v_w.id,
    'status', v_status, 'review_operation_id', v_operation_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_withdrawal_paid_atomic(
  p_withdrawal_id text, p_admin_id text, p_reference text DEFAULT '', p_note text DEFAULT ''
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
     OR length(coalesce(p_note, '')) > 300 OR coalesce(p_note, '') ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'invalid manual payout completion request';
  END IF;
  SELECT * INTO v_w FROM public.withdrawal_requests WHERE id = p_withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'withdrawal not found'; END IF;

  IF v_w.status = 'completed' THEN
    IF coalesce(v_w.payout_reference, '') <> v_ref THEN
      RAISE EXCEPTION 'withdrawal already completed with a different internal payout reference';
    END IF;
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'withdrawal_id', v_w.id,
      'status', v_w.status, 'payout_reference', coalesce(v_w.payout_reference, ''), 'paid_at', v_w.paid_at);
  END IF;
  IF v_w.status <> 'approved' THEN RAISE EXCEPTION 'withdrawal must be approved before manual payout completion'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.financial_operations o
    JOIN public.financial_ledger l ON l.operation_id = o.id
    WHERE o.id = v_w.review_operation_id
      AND o.idempotency_key = 'withdraw-approve:' || v_w.id
      AND o.operation_type = 'withdraw_approve'
      AND o.user_id = v_w.user_id AND o.asset = v_w.settlement_asset
    GROUP BY o.id
    HAVING count(*) = 1 AND sum(l.available_delta) = 0
       AND sum(l.frozen_delta) = -v_w.settlement_amount
  ) THEN
    RAISE EXCEPTION 'withdrawal approval debit not verified; manual reconciliation required';
  END IF;

  -- Approval already consumed the locked settlement amount. This is status/audit only.
  v_paid_at := clock_timestamp();
  UPDATE public.withdrawal_requests
  SET status = 'completed', payout_reference = v_ref, payout_note = v_note,
      paid_by = p_admin_id, paid_at = v_paid_at, payout_operation_id = NULL
  WHERE id = v_w.id;

  INSERT INTO public.financial_audit_log(actor_id, subject_user_id, action, object_type, object_id, reason, metadata)
  VALUES (
    p_admin_id, v_w.user_id, 'withdrawal_manual_payout_completed', 'withdrawal', v_w.id, v_note,
    jsonb_build_object(
      'asset', v_w.asset, 'amount', v_w.amount, 'fee', v_w.fee,
      'settlement_asset', v_w.settlement_asset, 'settlement_amount', v_w.settlement_amount,
      'conversion_rate', v_w.conversion_rate, 'network', v_w.network,
      'destination', v_w.destination, 'internal_payout_reference', v_ref
    )
  );
  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'withdrawal_id', v_w.id,
    'status', 'completed', 'payout_reference', v_ref, 'paid_at', v_paid_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.read_admin_withdrawal_snapshot_v1()
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_count integer; v_review_count integer; v_withdrawals jsonb;
BEGIN
  SELECT count(*)::integer, count(*) FILTER (WHERE status = 'pending_admin_review')::integer
  INTO v_count, v_review_count FROM public.withdrawal_requests
  WHERE status IN ('pending', 'pending_admin_review');

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'uid', user_id, 'coin', asset, 'amount', amount, 'fee', fee,
    'settlement_asset', settlement_asset, 'settlement_amount', settlement_amount,
    'conversion_rate', conversion_rate, 'network', network, 'address', destination,
    'status', status, 'require_admin_review', require_admin_review, 'txid', '', 'time', created_at
  ) ORDER BY created_at DESC), '[]'::jsonb)
  INTO v_withdrawals
  FROM (
    SELECT id, user_id, asset, amount, fee, settlement_asset, settlement_amount,
      conversion_rate, network, destination, status, require_admin_review, created_at
    FROM public.withdrawal_requests
    WHERE status IN ('pending', 'pending_admin_review')
    ORDER BY created_at DESC LIMIT 200
  ) recent;

  RETURN jsonb_build_object('ok', true, 'pending_count', v_count,
    'pending_admin_review_count', v_review_count, 'withdrawals', v_withdrawals);
END;
$$;

CREATE OR REPLACE FUNCTION public.read_withdrawal_history_page_v1(
  p_user_id text, p_before_created_at timestamptz DEFAULT NULL,
  p_before_id text DEFAULT NULL, p_limit integer DEFAULT 20
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

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'coin', asset, 'amount', amount, 'fee', fee,
    'settlement_asset', settlement_asset, 'settlement_amount', settlement_amount,
    'conversion_rate', conversion_rate, 'network', network, 'address', destination,
    'status', status, 'time', created_at, 'reviewed_at', reviewed_at,
    'rejection_reason', rejection_reason
  ) ORDER BY created_at DESC, id DESC), '[]'::jsonb), count(*)::integer
  INTO v_rows, v_count
  FROM (
    SELECT id, asset, amount, fee, settlement_asset, settlement_amount, conversion_rate,
      network, destination, status, created_at, reviewed_at, rejection_reason
    FROM public.withdrawal_requests
    WHERE user_id = p_user_id
      AND (p_before_created_at IS NULL OR (created_at, id) < (p_before_created_at, p_before_id))
    ORDER BY created_at DESC, id DESC LIMIT v_limit + 1
  ) page_rows;

  v_has_more := v_count > v_limit;
  IF v_has_more THEN
    SELECT coalesce(jsonb_agg(value ORDER BY ordinality), '[]'::jsonb)
    INTO v_rows
    FROM jsonb_array_elements(v_rows) WITH ORDINALITY AS page(value, ordinality)
    WHERE ordinality <= v_limit;
    SELECT value->>'time', value->>'id' INTO v_last_created_at, v_last_id
    FROM jsonb_array_elements(v_rows) WITH ORDINALITY AS page(value, ordinality)
    ORDER BY ordinality DESC LIMIT 1;
  END IF;

  RETURN jsonb_build_object('ok', true, 'withdrawals', v_rows, 'has_more', v_has_more,
    'next_cursor', CASE WHEN v_has_more THEN jsonb_build_object('created_at', v_last_created_at, 'id', v_last_id) ELSE NULL END);
END;
$withdrawal_history$;

REVOKE ALL ON FUNCTION public.read_admin_withdrawal_snapshot_v1() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_admin_withdrawal_snapshot_v1() TO service_role;
REVOKE ALL ON FUNCTION public.review_withdrawal_atomic(text,text,boolean,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_withdrawal_paid_atomic(text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_withdrawal_atomic(text,text,boolean,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_withdrawal_paid_atomic(text,text,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.read_withdrawal_history_page_v1(text,timestamptz,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_withdrawal_history_page_v1(text,timestamptz,text,integer) TO service_role;
