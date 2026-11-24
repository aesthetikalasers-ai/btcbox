-- BTCBOX Seconds policy duration alignment.
-- The active policy is the sole authority for supported durations. The base
-- schema's original fixed allowlist must not reject a duration accepted by
-- the immutable policy and admin RPC.
ALTER TABLE public.seconds_contract_positions
  DROP CONSTRAINT IF EXISTS seconds_contract_positions_duration_sec_check;

ALTER TABLE public.seconds_contract_positions
  ADD CONSTRAINT seconds_contract_positions_duration_sec_positive
  CHECK (duration_sec > 0);

COMMENT ON CONSTRAINT seconds_contract_positions_duration_sec_positive
  ON public.seconds_contract_positions IS
  'Positive duration; the active immutable Seconds policy controls allowed values.';
