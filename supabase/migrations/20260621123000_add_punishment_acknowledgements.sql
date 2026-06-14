-- Incremental patch for user-facing punishment acknowledgement notices.
-- Run this after 20260621120000_add_platform_admin_reports.sql has already created
-- message_reports/user_punishments/admin_moderation_actions.

ALTER TABLE public.user_punishments
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz;

CREATE OR REPLACE FUNCTION public.get_my_unacknowledged_punishments(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF _user_id IS NULL OR NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'action_type', p.action_type,
          'reason', p.reason,
          'details', p.details,
          'starts_at', p.starts_at,
          'expires_at', p.expires_at,
          'created_at', p.created_at,
          'report', CASE WHEN r.id IS NULL THEN NULL ELSE jsonb_build_object(
            'id', r.id,
            'reason', r.reason,
            'message_type', r.message_type,
            'created_at', r.created_at
          ) END
        )
        ORDER BY p.created_at ASC
      )
      FROM public.user_punishments p
      LEFT JOIN public.message_reports r ON r.id = p.report_id
      WHERE p.user_id = _user_id
        AND p.revoked_at IS NULL
        AND p.acknowledged_at IS NULL
        AND (
          p.action_type = 'warn'
          OR p.expires_at IS NULL
          OR p.expires_at > now()
        )
    ),
    '[]'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.acknowledge_my_punishments(_user_id uuid, _punishment_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _ids uuid[];
BEGIN
  IF _user_id IS NULL OR NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  _ids := COALESCE(_punishment_ids, ARRAY[]::uuid[]);

  UPDATE public.user_punishments
  SET acknowledged_at = now()
  WHERE user_id = _user_id
    AND acknowledged_at IS NULL
    AND id = ANY(_ids);

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.login_user(_key_hash text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $_$
DECLARE
  result json;
  _user_id uuid;
  _dummy_hash text := 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
  _client_id text;
  _key_bucket text;
  _punishment record;
BEGIN
  _client_id := public.request_client_identifier();

  IF _key_hash IS NULL OR length(_key_hash) != 64 OR _key_hash !~ '^[a-fA-F0-9]{64}$' THEN
    IF _client_id <> 'unknown'
       AND NOT public.check_rate_limit(_client_id, 'login_user_invalid', 30, 60) THEN
      RAISE EXCEPTION 'Rate limited: login temporarily blocked';
    END IF;
    PERFORM pg_sleep(0.1);
    RETURN NULL;
  END IF;

  _key_bucket := left(lower(_key_hash), 16);
  IF NOT public.check_rate_limit(_key_bucket, 'login_user_keyhash', 20, 60) THEN
    RAISE EXCEPTION 'Rate limited: too many login attempts';
  END IF;

  IF _client_id <> 'unknown'
     AND NOT public.check_rate_limit(_client_id, 'login_user_client', 60, 60) THEN
    RAISE EXCEPTION 'Rate limited: too many login attempts';
  END IF;

  SELECT ua.user_id INTO _user_id
  FROM public.user_auth ua
  WHERE ua.key_hash = _key_hash
  LIMIT 1;

  IF _user_id IS NULL THEN
    PERFORM key_hash FROM public.user_auth WHERE key_hash = _dummy_hash LIMIT 1;
    RETURN NULL;
  END IF;

  SELECT action_type, expires_at INTO _punishment
  FROM public.user_punishments
  WHERE user_id = _user_id
    AND revoked_at IS NULL
    AND action_type IN ('suspend', 'ban')
    AND acknowledged_at IS NOT NULL
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY starts_at DESC
  LIMIT 1;

  IF _punishment.action_type = 'ban' THEN
    RAISE EXCEPTION 'Account banned';
  ELSIF _punishment.action_type = 'suspend' THEN
    RAISE EXCEPTION 'Account suspended until %', _punishment.expires_at;
  END IF;

  SELECT json_build_object(
    'id', u.id,
    'username', u.username,
    'display_name', u.display_name,
    'avatar_url', u.avatar_url,
    'banner_url', u.banner_url,
    'avatar_decoration', u.avatar_decoration,
    'profile_effect', u.profile_effect,
    'banner_color', u.banner_color,
    'profile_theme_primary', u.profile_theme_primary,
    'profile_theme_accent', u.profile_theme_accent,
    'bio', u.bio,
    'status', u.status,
    'custom_status', u.custom_status,
    'allow_nsfw', u.allow_nsfw,
    'created_at', u.created_at,
    'last_seen', u.last_seen
  ) INTO result
  FROM public.users u
  WHERE u.id = _user_id;

  IF result IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.users
  SET status = 'online',
      last_seen = now()
  WHERE id = _user_id;

  RETURN result;
END;
$_$;

REVOKE EXECUTE ON FUNCTION public.get_my_unacknowledged_punishments(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.acknowledge_my_punishments(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_unacknowledged_punishments(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.acknowledge_my_punishments(uuid, uuid[]) TO anon, authenticated, service_role;
