-- Phase 6P:
-- Restore runtime execute for get_thread_messages while hardening it with
-- caller identity + channel access checks.

CREATE OR REPLACE FUNCTION public.get_thread_messages(
  _thread_id uuid,
  _limit integer DEFAULT 50,
  _before text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _caller uuid;
  _channel_id uuid;
  result json;
BEGIN
  _caller := public.requesting_user_id();
  IF _caller IS NULL OR NOT public.verify_request_identity(_caller) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT t.channel_id
    INTO _channel_id
  FROM public.threads t
  WHERE t.id = _thread_id;

  IF _channel_id IS NULL THEN
    RETURN '[]'::json;
  END IF;

  IF NOT public.can_access_channel(_channel_id, _caller) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  WITH ordered_messages AS (
    SELECT tm.*
    FROM public.thread_messages tm
    WHERE tm.thread_id = _thread_id
      AND (_before IS NULL OR tm.created_at < _before::timestamptz)
    ORDER BY tm.created_at DESC
    LIMIT _limit
  )
  SELECT json_agg(
    json_build_object(
      'id', om.id,
      'thread_id', om.thread_id,
      'user_id', om.user_id,
      'content', om.content,
      'reply_to_id', om.reply_to_id,
      'edited_at', om.edited_at,
      'created_at', om.created_at,
      'user', (
        SELECT json_build_object(
          'id', u.id,
          'username', u.username,
          'display_name', u.display_name,
          'avatar_url', u.avatar_url,
          'avatar_decoration', u.avatar_decoration,
          'profile_effect', u.profile_effect,
          'banner_color', u.banner_color,
          'banner_url', u.banner_url,
          'profile_theme_primary', u.profile_theme_primary,
          'profile_theme_accent', u.profile_theme_accent,
          'bio', u.bio,
          'status', u.status,
          'custom_status', u.custom_status
        )
        FROM public.users u
        WHERE u.id = om.user_id
      ),
      'reply_to', CASE
        WHEN om.reply_to_id IS NOT NULL THEN (
          SELECT json_build_object(
            'id', rt.id,
            'user_id', rt.user_id,
            'content', rt.content,
            'created_at', rt.created_at,
            'user', (
              SELECT json_build_object(
                'id', ru.id,
                'username', ru.username,
                'display_name', ru.display_name,
                'avatar_url', ru.avatar_url
              )
              FROM public.users ru
              WHERE ru.id = rt.user_id
            )
          )
          FROM public.thread_messages rt
          WHERE rt.id = om.reply_to_id
        )
        ELSE NULL
      END
    )
    ORDER BY om.created_at ASC
  )
  INTO result
  FROM ordered_messages om;

  RETURN COALESCE(result, '[]'::json);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_thread_messages(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_thread_messages(uuid, integer, text) TO anon, authenticated, service_role;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
