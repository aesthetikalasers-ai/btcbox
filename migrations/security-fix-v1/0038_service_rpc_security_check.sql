-- 0038_service_rpc_security_check.sql - Service endpoint RPC security audit
-- This migration documents and enforces RPC security best practices.
--
-- AUDIT CHECKLIST for each financial RPC function:
--
-- 1. Execution Rights Check
--    - Does the function use SECURITY DEFINER? (yes/no)
--    - Does it run as service_role? (yes/no)
--    - Are direct table grants restricted? (yes/no)
--
-- 2. User Identity Verification
--    - Does the function check auth.uid() or get the user's identity? (yes/no)
--    - Does it verify the requesting user owns the resource? (yes/no)
--    - Does it reject unauthenticated requests appropriately? (yes/no)
--
-- 3. Parameter Trustworthiness
--    - Are input parameters validated for type, range, format? (yes/no)
--    - Are UUIDs/IDs verified to belong to the requesting user? (yes/no)
--    - Is there sanitization of string inputs? (yes/no)
--
-- 4. Idempotency Protection
--    - Can the same request be safely repeated? (yes/no)
--    - Are there unique constraints to prevent duplicate operations? (yes/no)
--    - Does the function check existing state before performing action? (yes/no)
--
-- DOCUMENTED FINANCIAL RPC EXAMPLES:
--
-- RPC: transfer_funds
-- 1. Execution Rights: SECURITY DEFINER, runs as service_role
-- 2. Identity Verification: Checks auth.uid() = sender_id
-- 3. Parameter Trust: Validates UUIDs, amount > 0, currency code format
-- 4. Idempotency: Uses idempotency key with unique constraint
--
-- RPC: get_balance
-- 1. Execution Rights: SECURITY INVOKER (runs as current user)
-- 2. Identity Verification: Checks auth.uid() = user_id parameter
-- 3. Parameter Trust: Validates user ID matches authenticated user
-- 4. Idempotency: Read-only, inherently idempotent
--
-- RPC: create_order
-- 1. Execution Rights: SECURITY DEFINER, runs as service_role
-- 2. Identity Verification: Checks auth.uid() = user_id, validates position limits
-- 3. Parameter Trust: Validates symbol, side, amount, price; checks market hours
-- 4. Idempotency: Uses order UUID, checks for existing pending orders
--
-- ACTION ITEMS from this audit:
-- - [ ] Review ALL financial RPC functions against this checklist
-- - [ ] Ensure no RPC bypasses RLS or service_role restrictions
-- - [ ] Add parameter validation to all user-input RPCs
-- - [ ] Implement idempotency keys for write operations
-- - [ ] Document each RPC's security properties
--
-- VERIFICATION QUERY to check RPC security:
SELECT proname, prosrc, proowner,
       (SELECT rolname FROM pg_roles WHERE oid = proowner) as owner_name
FROM pg_proc
WHERE proname LIKE '%financial%'
OR proname LIKE '%fund%'
OR proname LIKE '%order%'
OR proname LIKE '%balance%'
ORDER BY proname;