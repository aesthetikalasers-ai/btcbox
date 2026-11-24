-- 0035_service_role_privilege_minimization_v1.sql
-- The API uses SECURITY INVOKER RPCs, so service_role retains the
-- SELECT/INSERT/UPDATE privileges required by those routines. It does not
-- need direct table DELETE except for bounded rate-limit cleanup.
-- Remove unrelated destructive/DDL-adjacent table privileges that Supabase's
-- default ACLs otherwise grant automatically to service_role.

REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER
ON ALL TABLES IN SCHEMA public
FROM service_role;

-- The only current backend routine containing DELETE is the expired
-- rate-limit cleanup function. Keep its narrowly scoped table permission.
GRANT DELETE ON TABLE public.btcbox_rate_limits TO service_role;

-- Prevent future postgres-owned public tables from inheriting these
-- unnecessary service_role privileges. Existing SELECT/INSERT/UPDATE grants
-- are intentionally unchanged.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM service_role;
