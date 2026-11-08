-- 0036_service_role_maintain_privilege_revoke_v1.sql
-- PostgreSQL 17 adds MAINTAIN to the table privilege set. Supabase default
-- ACLs may grant it to service_role; API RPC execution does not require it.
REVOKE MAINTAIN ON ALL TABLES IN SCHEMA public FROM service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
REVOKE MAINTAIN ON TABLES FROM service_role;
