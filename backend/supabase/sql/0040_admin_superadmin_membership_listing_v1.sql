-- 0040_admin_superadmin_membership_listing_v1.sql
-- Correct the private administrator listing so the Super Admin is visible
-- alongside delegated administrators. No financial or withdrawal RPCs are changed.

CREATE OR REPLACE FUNCTION private.admin_list_memberships_v1(p_actor_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private
AS $$
DECLARE
  v_admins jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM private.admin_memberships
    WHERE user_id = p_actor_user_id
      AND status = 'active'
      AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Super Admin authority required';
  END IF;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'user_id', m.user_id,
      'status', m.status,
      'is_super_admin', m.is_super_admin,
      'revision', m.revision,
      'created_at', m.created_at,
      'updated_at', m.updated_at,
      'permissions',
        CASE WHEN m.is_super_admin THEN
          (
            SELECT coalesce(
              jsonb_agg(permission_key ORDER BY permission_key),
              '[]'::jsonb
            )
            FROM private.admin_permission_catalog
          )
        ELSE
          coalesce((
            SELECT jsonb_agg(latest.permission_key ORDER BY latest.permission_key)
            FROM (
              SELECT DISTINCT ON (e.permission_key)
                e.permission_key, e.event_type
              FROM private.admin_permission_events e
              WHERE e.target_user_id = m.user_id
              ORDER BY e.permission_key, e.event_id DESC
            ) latest
            WHERE latest.event_type = 'grant'
          ), '[]'::jsonb)
        END
    )
    ORDER BY m.is_super_admin DESC, m.created_at DESC
  ), '[]'::jsonb)
  INTO v_admins
  FROM private.admin_memberships m;

  RETURN jsonb_build_object('ok', true, 'admins', v_admins);
END;
$$;

REVOKE ALL ON FUNCTION private.admin_list_memberships_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.admin_list_memberships_v1(uuid)
  TO service_role;
