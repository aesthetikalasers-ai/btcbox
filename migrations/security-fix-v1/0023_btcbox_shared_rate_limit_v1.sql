-- 0023_btcbox_shared_rate_limit_v1.sql - Rate limit table permission fix
-- This migration REVOKEs direct DML rights from anon/authenticated users
-- and grants appropriate rights only to service_role.
--
-- BEFORE (inconsistent with actual DB):
-- REVOKE ALL ON TABLE public.btcbox_rate_limits FROM public, anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.btcbox_rate_limits TO service_role;
--
-- AFTER - Apply the revoke that should have been applied:
-- Step 1: Revoke ALL existing permissions from public, anon, and authenticated
REVOKE ALL ON TABLE public.btcbox_rate_limits FROM public, anon, authenticated;

-- Step 2: Grant only SELECT (read-only) to authenticated users if needed for rate limit checking
-- If rate limit status needs to be read by clients, use SELECT only
-- GRANT SELECT ON TABLE public.btcbox_rate_limits TO authenticated;

-- Step 3: Ensure service_role has full access for server-side management
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.btcbox_rate_limits TO service_role;

-- Step 4: Optionally, revoke from public if not explicitly needed
-- (public role typically means unauthenticated connections)
REVOKE ALL ON TABLE public.btcbox_rate_limits FROM public;