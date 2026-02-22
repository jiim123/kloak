-- Phase 6N:
-- Fix runtime 401s in custom anon-key model without reopening broad exposure.
-- 1) get_dm_conversation_id: make caller-bound, then grant execute to runtime roles.
-- 2) user_server_folders RPCs: allow anon (caller identity is verified in-function).
-- 3) close_expired_polls: add caller/channel access gate and restore runtime execute.
-- 4) list_server_invites: cast username columns to text to match declared return type.

-- -------------------------------------------------------------------
-- 1) get_dm_conversation_id: caller-bound helper to prevent direct probing.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_dm_conversation_id(_message_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _caller uuid;
  _conversation_id uuid;
BEGIN
  _caller := public.requesting_user_id();
  IF _caller IS NULL OR NOT public.verify_request_identity(_caller) THEN
    RETURN NULL;
  END IF;

  SELECT dm.conversation_id
    INTO _conversation_id
  FROM public.direct_messages dm
  WHERE dm.id = _message_id
    AND EXISTS (
      SELECT 1
      FROM public.dm_participants dp
      WHERE dp.conversation_id = dm.conversation_id
        AND dp.user_id = _caller
    )
  LIMIT 1;

  RETURN _conversation_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_dm_conversation_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dm_conversation_id(uuid) TO anon, authenticated, service_role;

-- -------------------------------------------------------------------
-- 2) user_server_folders: anon must be allowed in custom auth mode.
-- -------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.get_user_server_folders(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_server_folders(uuid) TO anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.save_user_server_folders(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_user_server_folders(uuid, jsonb) TO anon, authenticated, service_role;

-- -------------------------------------------------------------------
-- 3) close_expired_polls: runtime callable but access-gated.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.close_expired_polls(_channel_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _count integer := 0;
  _caller uuid;
  r record;
BEGIN
  _caller := public.requesting_user_id();
  IF _caller IS NULL OR NOT public.verify_request_identity(_caller) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.can_access_channel(_channel_id, _caller) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  FOR r IN
    SELECT id
    FROM public.polls
    WHERE channel_id = _channel_id
      AND is_closed = false
      AND ends_at <= now()
  LOOP
    UPDATE public.polls
    SET is_closed = true
    WHERE id = r.id;

    PERFORM public.recompute_poll_results(r.id);
    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.close_expired_polls(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_expired_polls(uuid) TO anon, authenticated, service_role;

-- -------------------------------------------------------------------
-- 4) list_server_invites: fix varchar/text return mismatch.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_server_invites(
  _server_id uuid,
  _user_id uuid
)
RETURNS TABLE(
  id uuid,
  code text,
  created_at timestamptz,
  created_by uuid,
  created_by_username text,
  expires_at timestamptz,
  max_uses integer,
  uses_count integer,
  revoked_at timestamptz,
  revoked_by uuid,
  revoked_by_username text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    si.id,
    trim(si.code::text) as code,
    si.created_at,
    si.created_by,
    u.username::text as created_by_username,
    si.expires_at,
    si.max_uses,
    si.uses_count,
    si.revoked_at,
    si.revoked_by,
    ru.username::text as revoked_by_username
  FROM public.server_invites si
  JOIN public.users u ON u.id = si.created_by
  LEFT JOIN public.users ru ON ru.id = si.revoked_by
  WHERE si.server_id = _server_id
    AND public.check_user_server_permission(_user_id, _server_id, 'manage_invites')
  ORDER BY si.created_at DESC
$function$;

REVOKE EXECUTE ON FUNCTION public.list_server_invites(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_server_invites(uuid, uuid) TO anon, authenticated, service_role;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
