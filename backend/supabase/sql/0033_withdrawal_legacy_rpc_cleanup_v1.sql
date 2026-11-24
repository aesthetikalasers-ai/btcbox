-- 0033_withdrawal_legacy_rpc_cleanup_v1.sql
-- Reconcile installations that still carry the original 9-argument RPC.
-- 0022 removes the 9-argument overload and installs the 10-argument contract;
-- 0029 replaces the 10-argument contract with the fee-snapshot 11-argument RPC.
-- This final guard removes either legacy overload if an installation's migration
-- history was incomplete, then asserts that only the canonical 11-argument
-- function remains. It never changes withdrawal rows or financial balances.

DROP FUNCTION IF EXISTS public.create_withdrawal_atomic(
  text, text, text, text, numeric, numeric, text, text, text
);
DROP FUNCTION IF EXISTS public.create_withdrawal_atomic(
  text, text, text, text, numeric, numeric, text, text, text, boolean
);

DO $$
DECLARE
  v_function regprocedure;
  v_overloads integer;
BEGIN
  v_function := to_regprocedure(
    'public.create_withdrawal_atomic(text,text,text,text,numeric,numeric,text,text,text,boolean,numeric)'
  );
  IF v_function IS NULL THEN
    RAISE EXCEPTION 'canonical 11-argument create_withdrawal_atomic is missing; apply 0029 before 0033';
  END IF;

  SELECT count(*) INTO v_overloads
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'create_withdrawal_atomic';
  IF v_overloads <> 1 THEN
    RAISE EXCEPTION 'expected exactly one canonical create_withdrawal_atomic overload, found %', v_overloads;
  END IF;

  IF NOT has_function_privilege('service_role', v_function, 'EXECUTE')
     OR has_function_privilege('anon', v_function, 'EXECUTE')
     OR has_function_privilege('authenticated', v_function, 'EXECUTE') THEN
    RAISE EXCEPTION 'create_withdrawal_atomic must be executable only by service_role';
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
