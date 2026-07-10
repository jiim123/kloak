CREATE OR REPLACE FUNCTION public.get_server_audit_log(
  _server_id uuid,
  _user_id uuid,
  _limit integer DEFAULT 100,
  _before timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  server_id uuid,
  actor_id uuid,
  action text,
  target_type text,
  target_id uuid,
  summary text,
  metadata jsonb,
  created_at timestamptz,
  actor_username text,
  actor_display_name text,
  actor_avatar_url text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _safe_limit integer := LEAST(GREATEST(COALESCE(_limit, 100), 1), 200);
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.server_members sm
    WHERE sm.server_id = _server_id
      AND sm.user_id = _user_id
      AND COALESCE(sm.is_banned, false) = false
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.servers s
    WHERE s.id = _server_id
      AND s.owner_id = _user_id
  ) THEN
    RAISE EXCEPTION 'Not a member of this server';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'view_audit_log'::public.permission_type)
     AND NOT EXISTS (
       SELECT 1
       FROM public.server_members sm
       WHERE sm.server_id = _server_id
         AND sm.user_id = _user_id
         AND sm.role = 'admin'::public.server_role
         AND COALESCE(sm.is_banned, false) = false
     ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.server_id,
    e.actor_id,
    e.action,
    e.target_type,
    e.target_id,
    e.summary,
    e.metadata,
    e.created_at,
    u.username::text AS actor_username,
    u.display_name::text AS actor_display_name,
    u.avatar_url::text AS actor_avatar_url
  FROM public.server_audit_log_entries e
  LEFT JOIN public.users u ON u.id = e.actor_id
  WHERE e.server_id = _server_id
    AND (_before IS NULL OR e.created_at < _before)
  ORDER BY e.created_at DESC, e.id DESC
  LIMIT _safe_limit;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_server_audit_log(uuid, uuid, integer, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_server_audit_log(uuid, uuid, integer, timestamptz) TO anon, authenticated, service_role;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END
$$;
