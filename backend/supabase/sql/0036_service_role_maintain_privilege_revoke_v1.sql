-- 0036_service_role_maintain_privilege_revoke_v1.sql
-- PostgreSQL 17 adds MAINTAIN to the table privilege set. Supabase default
-- ACLs may grant it to service_role; API RPC execution does not require it.
-- The canonical CI bootstrap currently also supports PostgreSQL 16, where
-- MAINTAIN is not a recognized privilege, so keep the statement version-gated.
DO $$
BEGIN
  IF current_setting('server_version_num')::integer >= 170000 THEN
    EXECUTE 'REVOKE MAINTAIN ON ALL TABLES IN SCHEMA public FROM service_role';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE MAINTAIN ON TABLES FROM service_role';
  END IF;
END;
$$;
