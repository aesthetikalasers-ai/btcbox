-- BTCBOX delegated administrator storage v1.
-- SOURCE ONLY: apply only to an isolated Supabase staging project after review.
-- This migration seeds permission definitions only; it does not create an admin.
-- Initial Super Admin provisioning is a separate owner-controlled SQL operation.
-- The trusted API role receives narrow function EXECUTE, never table DML.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE TABLE private.admin_permission_catalog (
  permission_key text PRIMARY KEY,
  module_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (permission_key ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$')
);

INSERT INTO private.admin_permission_catalog(permission_key,module_key) VALUES
 ('dashboard.read','dashboard'),
 ('users.read','users'),('users.manage','users'),('users.freeze','users'),
 ('kyc.read','kyc'),('kyc.review','kyc'),
 ('deposits.read','deposits'),('deposits.review','deposits'),
 ('withdrawals.read','withdrawals'),('withdrawals.review','withdrawals'),
 ('orders.read','orders'),
 ('support.read','support'),('support.reply','support'),('support.manage','support'),
 ('announcements.read','announcements'),('announcements.manage','announcements'),
 ('system_config.read','system_config'),('system_config.write','system_config'),
 ('seconds_policy.read','seconds_policy'),('seconds_policy.manage','seconds_policy'),
 ('financial_audit.read','financial_audit'),
 ('financial_adjustment.request','financial_adjustment');

CREATE TABLE private.admin_memberships (
  user_id uuid PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('active','suspended','revoked')),
  is_super_admin boolean NOT NULL DEFAULT false,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (NOT is_super_admin OR status='active')
);
CREATE UNIQUE INDEX admin_memberships_single_super_admin_idx
  ON private.admin_memberships(is_super_admin) WHERE is_super_admin=true;

-- Immutable grant/revoke events. Latest event per target+permission wins.
CREATE TABLE private.admin_permission_events (
  event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  target_user_id uuid NOT NULL,
  permission_key text NOT NULL REFERENCES private.admin_permission_catalog(permission_key),
  event_type text NOT NULL CHECK (event_type IN ('grant','revoke')),
  actor_user_id uuid NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 500),
  request_id text NOT NULL,
  membership_revision bigint NOT NULL CHECK (membership_revision > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX admin_permission_events_latest_idx
  ON private.admin_permission_events(target_user_id,permission_key,event_id DESC);

CREATE TABLE private.admin_security_audit (
  audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_kind text NOT NULL DEFAULT 'admin' CHECK (actor_kind IN ('admin','owner_bootstrap')),
  actor_user_id uuid,
  target_user_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('provision','set_permissions','suspend','reactivate','revoke')),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 500),
  request_id text NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  before_snapshot jsonb,
  after_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((actor_kind='admin' AND actor_user_id IS NOT NULL)
      OR (actor_kind='owner_bootstrap' AND actor_user_id IS NULL))
);
CREATE INDEX admin_security_audit_target_idx
  ON private.admin_security_audit(target_user_id,created_at DESC);

CREATE TABLE private.admin_request_idempotency (
  actor_user_id uuid NOT NULL,
  request_id text NOT NULL CHECK (request_id ~ '^[A-Za-z0-9_-]{16,100}$'),
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(actor_user_id,request_id)
);

CREATE OR REPLACE FUNCTION private.reject_admin_history_mutation_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'administrator permission and audit history is append-only';
END;
$$;

CREATE TRIGGER admin_permission_events_append_only
BEFORE UPDATE OR DELETE ON private.admin_permission_events
FOR EACH ROW EXECUTE FUNCTION private.reject_admin_history_mutation_v1();
CREATE TRIGGER admin_security_audit_append_only
BEFORE UPDATE OR DELETE ON private.admin_security_audit
FOR EACH ROW EXECUTE FUNCTION private.reject_admin_history_mutation_v1();

ALTER TABLE private.admin_permission_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.admin_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.admin_permission_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.admin_security_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.admin_request_idempotency ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA private FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA private FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA private
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA private
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role;

-- Owner-only one-time bootstrap. Run manually in the project-owner SQL session
-- after independently verifying the exact UUID of an existing Supabase Auth user.
CREATE OR REPLACE FUNCTION private.bootstrap_super_admin_v1(
  p_auth_user_id uuid,
  p_reason text,
  p_change_reference text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private, auth
AS $$
BEGIN
  IF session_user <> 'postgres' THEN
    RAISE EXCEPTION 'owner-controlled bootstrap only';
  END IF;
  IF p_auth_user_id IS NULL
     OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 1 AND 500
     OR length(btrim(coalesce(p_change_reference,''))) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'invalid bootstrap arguments';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id=p_auth_user_id) THEN
    RAISE EXCEPTION 'Auth user does not exist';
  END IF;
  IF EXISTS (SELECT 1 FROM private.admin_memberships WHERE is_super_admin=true) THEN
    RAISE EXCEPTION 'Super Admin already bootstrapped';
  END IF;

  INSERT INTO private.admin_memberships(user_id,status,is_super_admin,revision,created_by)
  VALUES(p_auth_user_id,'active',true,1,NULL);

  INSERT INTO private.admin_security_audit(
    actor_kind,actor_user_id,target_user_id,action,reason,request_id,request_hash,
    before_snapshot,after_snapshot
  ) VALUES (
    'owner_bootstrap',NULL,p_auth_user_id,'provision',
    btrim(p_reason) || ' [owner bootstrap: ' || btrim(p_change_reference) || ']',
    'bootstrap-' || replace(gen_random_uuid()::text,'-',''),
    repeat('0',64),NULL,
    jsonb_build_object('status','active','is_super_admin',true,'revision',1)
  );

  RETURN jsonb_build_object('ok',true,'user_id',p_auth_user_id,'is_super_admin',true);
END;
$$;

-- Called only after the backend has verified the caller with Supabase Auth.
-- The caller UUID must come from /auth/v1/user, never from request JSON.
CREATE OR REPLACE FUNCTION private.admin_get_membership_v1(p_actor_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private
AS $$
DECLARE
  v_membership private.admin_memberships%rowtype;
  v_permissions jsonb;
BEGIN
  SELECT * INTO v_membership
  FROM private.admin_memberships
  WHERE user_id=p_actor_user_id;

  IF NOT FOUND OR v_membership.status <> 'active' THEN
    RETURN jsonb_build_object('found',false,'active',false);
  END IF;

  IF v_membership.is_super_admin THEN
    SELECT coalesce(jsonb_agg(permission_key ORDER BY permission_key),'[]'::jsonb)
      INTO v_permissions FROM private.admin_permission_catalog;
  ELSE
    SELECT coalesce(jsonb_agg(permission_key ORDER BY permission_key),'[]'::jsonb)
      INTO v_permissions
    FROM (
      SELECT DISTINCT ON (e.permission_key) e.permission_key,e.event_type
      FROM private.admin_permission_events e
      WHERE e.target_user_id=p_actor_user_id
      ORDER BY e.permission_key,e.event_id DESC
    ) latest
    WHERE latest.event_type='grant';
  END IF;

  RETURN jsonb_build_object(
    'found',true,'active',true,'user_id',v_membership.user_id,
    'is_super_admin',v_membership.is_super_admin,
    'revision',v_membership.revision,'permissions',v_permissions
  );
END;
$$;

-- Atomic delegated-admin lifecycle. The verified Auth actor UUID is supplied
-- only by the trusted backend; service_role cannot directly write any table.
CREATE OR REPLACE FUNCTION private.admin_manage_membership_v1(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_expected_revision bigint,
  p_action text,
  p_permissions text[],
  p_reason text,
  p_request_id text,
  p_request_hash text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private, auth
AS $$
DECLARE
  v_actor private.admin_memberships%rowtype;
  v_target private.admin_memberships%rowtype;
  v_target_found boolean;
  v_before jsonb;
  v_after jsonb;
  v_response jsonb;
  v_existing private.admin_request_idempotency%rowtype;
  v_allowed text[];
  v_revision bigint;
  v_status text;
BEGIN
  IF p_actor_user_id IS NULL OR p_target_user_id IS NULL
     OR p_expected_revision IS NULL OR p_expected_revision<0
     OR p_actor_user_id=p_target_user_id
     OR p_action IS NULL OR p_action NOT IN ('provision','set_permissions','suspend','reactivate','revoke')
     OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 1 AND 500
     OR p_request_id IS NULL OR p_request_id !~ '^[A-Za-z0-9_-]{16,100}$'
     OR p_request_hash IS NULL OR p_request_hash !~ '^[0-9a-f]{64}$'
     OR coalesce(array_length(p_permissions,1),0)>64 THEN
    RAISE EXCEPTION 'invalid administrator change request';
  END IF;

  SELECT * INTO v_actor FROM private.admin_memberships
    WHERE user_id=p_actor_user_id AND status='active' AND is_super_admin=true
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Super Admin authority required'; END IF;

  -- Serialize repeated request IDs before checking the idempotency record.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_actor_user_id::text || ':' || p_request_id,0)
  );
  SELECT * INTO v_existing FROM private.admin_request_idempotency
    WHERE actor_user_id=p_actor_user_id AND request_id=p_request_id;
  IF FOUND THEN
    IF v_existing.request_hash<>p_request_hash THEN
      RAISE EXCEPTION 'idempotency conflict';
    END IF;
    RETURN v_existing.response || jsonb_build_object('replayed',true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id=p_target_user_id) THEN
    RAISE EXCEPTION 'target Auth user does not exist';
  END IF;
  IF EXISTS (SELECT 1 FROM private.admin_memberships
      WHERE user_id=p_target_user_id AND is_super_admin=true) THEN
    RAISE EXCEPTION 'Super Admin authority cannot be changed through this API';
  END IF;

  SELECT coalesce(array_agg(permission_key ORDER BY permission_key),'{}'::text[])
    INTO v_allowed
  FROM (
    SELECT DISTINCT input.permission_key
    FROM unnest(coalesce(p_permissions,'{}'::text[])) AS input(permission_key)
    JOIN private.admin_permission_catalog c USING(permission_key)
  ) allowed_permissions;
  IF cardinality(v_allowed) <> cardinality(coalesce(p_permissions,'{}'::text[])) THEN
    RAISE EXCEPTION 'unknown or duplicate permission key';
  END IF;
  IF p_action IN ('suspend','revoke') AND cardinality(v_allowed)<>0 THEN
    RAISE EXCEPTION 'suspend/revoke cannot carry permissions';
  END IF;
  IF p_action IN ('provision','reactivate') AND cardinality(v_allowed)=0 THEN
    RAISE EXCEPTION 'provision/reactivate requires explicit permissions';
  END IF;

  SELECT * INTO v_target FROM private.admin_memberships
    WHERE user_id=p_target_user_id FOR UPDATE;
  v_target_found := FOUND;
  IF v_target_found THEN
    v_before:=jsonb_build_object('status',v_target.status,'revision',v_target.revision);
  END IF;

  IF p_action='provision' THEN
    IF p_expected_revision<>0 THEN RAISE EXCEPTION 'stale membership revision'; END IF;
    IF v_target_found THEN RAISE EXCEPTION 'administrator membership already exists'; END IF;
    INSERT INTO private.admin_memberships(user_id,status,is_super_admin,revision,created_by)
      VALUES(p_target_user_id,'active',false,1,p_actor_user_id)
      RETURNING revision INTO v_revision;
  ELSE
    IF NOT v_target_found THEN RAISE EXCEPTION 'administrator membership not found'; END IF;
    IF p_expected_revision<>v_target.revision THEN RAISE EXCEPTION 'stale membership revision'; END IF;
    IF v_target.is_super_admin OR v_target.status='revoked' THEN
      RAISE EXCEPTION 'target administrator cannot be modified';
    END IF;
    IF p_action='set_permissions' AND v_target.status NOT IN ('active','suspended') THEN
      RAISE EXCEPTION 'invalid membership state';
    ELSIF p_action='suspend' AND v_target.status<>'active' THEN
      RAISE EXCEPTION 'only active administrators can be suspended';
    ELSIF p_action='reactivate' AND v_target.status<>'suspended' THEN
      RAISE EXCEPTION 'only suspended administrators can be reactivated';
    ELSIF p_action='revoke' AND v_target.status NOT IN ('active','suspended') THEN
      RAISE EXCEPTION 'invalid membership state';
    END IF;

    UPDATE private.admin_memberships
      SET status=CASE
        WHEN p_action='suspend' THEN 'suspended'
        WHEN p_action='reactivate' THEN 'active'
        WHEN p_action='revoke' THEN 'revoked'
        ELSE status END,
        revision=revision+1,updated_at=clock_timestamp()
      WHERE user_id=p_target_user_id
      RETURNING revision,status INTO v_revision,v_status;
  END IF;

  IF p_action IN ('provision','set_permissions','reactivate') THEN
    -- Complete desired permission snapshot: omitted grants become revocations.
    INSERT INTO private.admin_permission_events(
      target_user_id,permission_key,event_type,actor_user_id,reason,request_id,membership_revision
    )
    SELECT p_target_user_id,c.permission_key,
      CASE WHEN c.permission_key=ANY(v_allowed) THEN 'grant' ELSE 'revoke' END,
      p_actor_user_id,btrim(p_reason),p_request_id,v_revision
    FROM private.admin_permission_catalog c;
  ELSIF p_action IN ('suspend','revoke') THEN
    INSERT INTO private.admin_permission_events(
      target_user_id,permission_key,event_type,actor_user_id,reason,request_id,membership_revision
    )
    SELECT p_target_user_id,permission_key,'revoke',p_actor_user_id,btrim(p_reason),p_request_id,v_revision
    FROM private.admin_permission_catalog;
  END IF;

  IF v_status IS NULL THEN
    SELECT status INTO v_status FROM private.admin_memberships WHERE user_id=p_target_user_id;
  END IF;
  v_after:=jsonb_build_object('status',v_status,'revision',v_revision,'permissions',to_jsonb(v_allowed));

  INSERT INTO private.admin_security_audit(
    actor_user_id,target_user_id,action,reason,request_id,request_hash,before_snapshot,after_snapshot
  ) VALUES (
    p_actor_user_id,p_target_user_id,p_action,btrim(p_reason),p_request_id,p_request_hash,v_before,v_after
  );

  v_response:=jsonb_build_object(
    'ok',true,'action',p_action,'target_user_id',p_target_user_id,
    'revision',v_revision,'status',v_status,'permissions',to_jsonb(v_allowed)
  );
  INSERT INTO private.admin_request_idempotency(actor_user_id,request_id,request_hash,response)
    VALUES(p_actor_user_id,p_request_id,p_request_hash,v_response);

  RETURN v_response || jsonb_build_object('replayed',false);
END;
$$;

REVOKE ALL ON FUNCTION private.reject_admin_history_mutation_v1() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.bootstrap_super_admin_v1(uuid,text,text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.admin_get_membership_v1(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.admin_manage_membership_v1(uuid,uuid,bigint,text,text[],text,text,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.bootstrap_super_admin_v1(uuid,text,text) TO postgres;
GRANT EXECUTE ON FUNCTION private.admin_get_membership_v1(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.admin_manage_membership_v1(uuid,uuid,bigint,text,text[],text,text,text) TO service_role;

COMMENT ON SCHEMA private IS 'Non-exposed BTCBOX administrator identity, grants, and audit storage. Never add to Data API exposed schemas.';
COMMENT ON FUNCTION private.bootstrap_super_admin_v1(uuid,text,text) IS 'Owner-only one-time Super Admin bootstrap; never expose through HTTP/PostgREST.';
COMMENT ON FUNCTION private.admin_manage_membership_v1(uuid,uuid,bigint,text,text[],text,text,text) IS 'Trusted-server-only Super Admin delegated-admin lifecycle transition; actor UUID must come from verified Supabase Auth.';


-- Narrow PostgREST bridge for the trusted backend only. The private schema remains
-- unexposed; this public SECURITY DEFINER wrapper returns only the caller's
-- server-verified membership snapshot and grants EXECUTE to service_role only.
CREATE OR REPLACE FUNCTION public.admin_get_membership_v1(p_actor_user_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, private
AS $$
  SELECT private.admin_get_membership_v1(p_actor_user_id);
$$;

REVOKE ALL ON FUNCTION public.admin_get_membership_v1(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_membership_v1(uuid) TO service_role;

COMMENT ON FUNCTION public.admin_get_membership_v1(uuid) IS
  'Trusted-backend-only bridge to private administrator membership. Requires server-verified Auth UUID; never callable by anon/authenticated clients.';
