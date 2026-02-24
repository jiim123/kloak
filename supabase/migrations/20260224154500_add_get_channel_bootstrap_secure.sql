-- Single channel bootstrap payload to reduce channel-switch request fan-out.
-- Security model mirrors hardened phase6c wrappers:
-- - verify_request_identity(_user_id)
-- - can_access_channel(_channel_id, _user_id)

CREATE OR REPLACE FUNCTION public.get_channel_bootstrap_secure(
  _channel_id uuid,
  _user_id uuid,
  _limit integer DEFAULT 50,
  _blocked_user_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _messages json;
  _channel_permissions json;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.can_access_channel(_channel_id, _user_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- Reuse the hardened messages wrapper (includes nested user/reactions/attachments).
  SELECT public.get_channel_messages_secure(
    _channel_id := _channel_id,
    _user_id := _user_id,
    _limit := _limit,
    _before := NULL,
    _blocked_user_ids := _blocked_user_ids
  )
  INTO _messages;

  SELECT COALESCE(
    (
      SELECT json_agg(row_to_json(cp) ORDER BY cp.created_at ASC)
      FROM (
        SELECT
          id,
          channel_id,
          role_id,
          role_name,
          user_id,
          permission,
          allowed,
          created_at
        FROM public.channel_permissions
        WHERE channel_id = _channel_id
      ) cp
    ),
    '[]'::json
  )
  INTO _channel_permissions;

  RETURN json_build_object(
    'messages', COALESCE(_messages, '[]'::json),
    'channel_permissions', COALESCE(_channel_permissions, '[]'::json)
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_channel_bootstrap_secure(uuid, uuid, integer, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_channel_bootstrap_secure(uuid, uuid, integer, uuid[]) TO anon, authenticated;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
