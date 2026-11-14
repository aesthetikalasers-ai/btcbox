-- 0035_financial_sequences_permission_fix.sql - Financial sequences permission fix
-- This migration REVOKEs unnecessary SELECT/USAGE rights from anon/authenticated
-- on financial audit log and ledger sequences.
--
-- PROBLEM: Sequences currently grant anon/authenticated SELECT, UPDATE, USAGE permissions,
-- which are not needed by clients and represent a security risk.
--
-- SOLUTION: Revoke client unnecessary rights while preserving service_role capabilities.
--
-- Step 1: Revoke USAGE and SELECT from anon and authenticated on audit log sequence
REVOKE USAGE ON SEQUENCE public.financial_audit_log_id_seq FROM anon, authenticated;
REVOKE SELECT ON SEQUENCE public.financial_audit_log_id_seq FROM anon, authenticated;

-- Step 2: Revoke USAGE and SELECT from anon and authenticated on ledger sequence
REVOKE USAGE ON SEQUENCE public.financial_ledger_id_seq FROM anon, authenticated;
REVOKE SELECT ON SEQUENCE public.financial_ledger_id_seq FROM anon, authenticated;

-- Step 3: Ensure service_role retains USAGE rights for normal operation
GRANT USAGE ON SEQUENCE public.financial_audit_log_id_seq TO service_role;
GRANT USAGE ON SEQUENCE public.financial_ledger_id_seq TO service_role;

-- Step 4: If service_role needs SELECT on sequences (for last_val / currval usage)
GRANT SELECT ON SEQUENCE public.financial_audit_log_id_seq TO service_role;
GRANT SELECT ON SEQUENCE public.financial_ledger_id_seq TO service_role;

-- Step 5: Verify and document - these sequences should only be accessed
-- through SECURITY DEFINER functions running as service_role
COMMENT ON SEQUENCE public.financial_audit_log_id_seq IS 'Used by service_role only via SECURITY DEFINER functions';
COMMENT ON SEQUENCE public.financial_ledger_id_seq IS 'Used by service_role only via SECURITY DEFINER functions';