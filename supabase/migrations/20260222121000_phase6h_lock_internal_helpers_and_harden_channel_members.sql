-- Phase 6H:
-- 1) Lock internal helper/guard functions from direct client execution.
-- 2) Harden get_channel_members with caller identity + channel access checks.

-- -------------------------------------------------------------------
-- get_channel_members: caller-bound and access-gated.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_channel_members(_channel_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _caller uuid;
BEGIN
  _caller := public.requesting_user_id();
  IF _caller IS NULL OR NOT public.verify_request_identity(_caller) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.can_access_channel(_channel_id, _caller) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN (
    SELECT COALESCE(
      json_agg(
        json_build_object(
          'id', cm.id,
          'channel_id', cm.channel_id,
          'user_id', cm.user_id,
          'added_by', cm.added_by,
          'created_at', cm.created_at,
          'user', json_build_object(
            'id', u.id,
            'username', u.username,
            'display_name', u.display_name,
            'avatar_url', u.avatar_url,
            'status', u.status
          )
        )
      ),
      '[]'::json
    )
    FROM public.channel_members cm
    JOIN public.users u ON u.id = cm.user_id
    WHERE cm.channel_id = _channel_id
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_channel_members(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_channel_members(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_channel_members(uuid) TO authenticated;

-- -------------------------------------------------------------------
-- Lock internal helper/guard functions to service_role only.
-- -------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.audit_function_execute_surface() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assert_function_execute_surface_strict() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_table_dangerous_privileges() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assert_no_dangerous_table_privileges() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.request_client_identifier() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_request_user_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.close_poll(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.close_expired_polls(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.audit_function_execute_surface() TO service_role;
GRANT EXECUTE ON FUNCTION public.assert_function_execute_surface_strict() TO service_role;
GRANT EXECUTE ON FUNCTION public.audit_table_dangerous_privileges() TO service_role;
GRANT EXECUTE ON FUNCTION public.assert_no_dangerous_table_privileges() TO service_role;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.request_client_identifier() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_request_user_id() TO service_role;
GRANT EXECUTE ON FUNCTION public.close_poll(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.close_expired_polls(uuid) TO service_role;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
