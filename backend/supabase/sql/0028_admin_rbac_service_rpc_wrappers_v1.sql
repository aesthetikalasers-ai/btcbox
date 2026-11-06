-- 0028_admin_rbac_service_rpc_wrappers_v1.sql
-- Expose narrowly scoped wrappers in public so the trusted backend can call
-- the private admin store through Supabase PostgREST without exposing schema
-- private or granting table access to anon/authenticated users.
CREATE OR REPLACE FUNCTION public.admin_get_membership_v1(p_actor_user_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.admin_get_membership_v1(p_actor_user_id);
$$;

CREATE OR REPLACE FUNCTION public.admin_manage_membership_v1(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_expected_revision bigint,
  p_action text,
  p_permissions text[],
  p_reason text,
  p_request_id text,
  p_target_status text
) RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.admin_manage_membership_v1(
    p_actor_user_id,p_target_user_id,p_expected_revision,p_action,
    p_permissions,p_reason,p_request_id,p_target_status
  );
$$;

REVOKE ALL ON FUNCTION public.admin_get_membership_v1(uuid)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.admin_manage_membership_v1(uuid,uuid,bigint,text,text[],text,text,text)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_membership_v1(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_manage_membership_v1(uuid,uuid,bigint,text,text[],text,text,text)
  TO service_role;

COMMENT ON FUNCTION public.admin_get_membership_v1(uuid) IS
  'Trusted backend only. Returns admin membership after the caller independently verifies the Supabase Auth access token.';
COMMENT ON FUNCTION public.admin_manage_membership_v1(uuid,uuid,bigint,text,text[],text,text,text) IS
  'Trusted backend only. Delegated administrator lifecycle; the private function enforces active Super Admin authority and optimistic revision.';
