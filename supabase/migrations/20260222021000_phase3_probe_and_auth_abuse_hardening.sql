-- Phase 3 hardening: close relationship-probing helpers and add
-- request-rate controls on login/username/invite join/create paths.

-- 1) Helper to derive a stable per-request limiter key.
CREATE OR REPLACE FUNCTION public.request_client_identifier()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  headers json;
  id_text text;
BEGIN
  BEGIN
    headers := current_setting('request.headers', true)::json;
  EXCEPTION WHEN OTHERS THEN
    RETURN 'unknown';
  END;

  id_text := COALESCE(
    NULLIF(headers->>'x-key-hash', ''),
    NULLIF(headers->>'x-real-ip', ''),
    NULLIF(headers->>'cf-connecting-ip', ''),
    NULLIF(split_part(COALESCE(headers->>'x-forwarded-for', ''), ',', 1), ''),
    'unknown'
  );

  id_text := left(trim(id_text), 128);
  IF id_text = '' THEN
    RETURN 'unknown';
  END IF;

  RETURN id_text;
END;
$function$;

-- 2) Prevent direct relationship-graph probing via helper RPCs.
-- Require _user_id to match header identity on client-originated requests.

CREATE OR REPLACE FUNCTION public.is_friend_with(_user_id uuid, _other_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    _user_id IS NOT NULL
    AND (
      public.requesting_user_id() IS NULL
      OR _user_id = public.requesting_user_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.friendships
      WHERE status = 'accepted'
      AND (
        (requester_id = _user_id AND addressee_id = _other_user_id)
        OR (requester_id = _other_user_id AND addressee_id = _user_id)
      )
    )
$function$;

CREATE OR REPLACE FUNCTION public.shares_server_with(_user_id uuid, _other_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    _user_id IS NOT NULL
    AND (
      public.requesting_user_id() IS NULL
      OR _user_id = public.requesting_user_id()
    )
    AND EXISTS (
      SELECT 1
      FROM public.server_members sm1
      JOIN public.server_members sm2 ON sm1.server_id = sm2.server_id
      WHERE sm1.user_id = _user_id
        AND sm2.user_id = _other_user_id
        AND sm1.is_banned = false
        AND sm2.is_banned = false
    )
$function$;

CREATE OR REPLACE FUNCTION public.shares_dm_with(_user_id uuid, _other_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    _user_id IS NOT NULL
    AND (
      public.requesting_user_id() IS NULL
      OR _user_id = public.requesting_user_id()
    )
    AND EXISTS (
      SELECT 1
      FROM public.dm_participants dp1
      JOIN public.dm_participants dp2 ON dp1.conversation_id = dp2.conversation_id
      WHERE dp1.user_id = _user_id
        AND dp2.user_id = _other_user_id
    )
$function$;

-- 3) Add abuse controls to username availability checks.
CREATE OR REPLACE FUNCTION public.check_username_available(_username text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _client_id text;
BEGIN
  _client_id := public.request_client_identifier();

  IF _client_id <> 'unknown'
     AND NOT public.check_rate_limit(_client_id, 'check_username_available', 90, 60) THEN
    RAISE EXCEPTION 'Rate limited: too many username checks';
  END IF;

  IF _username IS NULL THEN
    RETURN false;
  END IF;

  IF length(_username) < 3 OR length(_username) > 20 THEN
    RETURN false;
  END IF;

  IF _username !~ '^[a-z0-9_]+$' THEN
    RETURN false;
  END IF;

  RETURN NOT EXISTS (
    SELECT 1
    FROM public.users
    WHERE username = lower(_username)
  );
END;
$function$;

-- 4) Add abuse controls to login flow.
CREATE OR REPLACE FUNCTION public.login_user(_key_hash text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  result json;
  _user_id uuid;
  _dummy_hash text := 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
  _client_id text;
  _key_bucket text;
BEGIN
  _client_id := public.request_client_identifier();

  -- Input validation
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

  -- Lookup user
  SELECT ua.user_id INTO _user_id
  FROM public.user_auth ua
  WHERE ua.key_hash = _key_hash
  LIMIT 1;

  -- Timing attack mitigation
  IF _user_id IS NULL THEN
    PERFORM key_hash FROM public.user_auth WHERE key_hash = _dummy_hash LIMIT 1;
    RETURN NULL;
  END IF;

  -- Get user data
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
$function$;

-- 5) Add abuse controls to invite join/create RPCs.
CREATE OR REPLACE FUNCTION public.create_server_invite(
  _server_id uuid,
  _user_id uuid,
  _expires_in_seconds integer DEFAULT NULL::integer,
  _max_uses integer DEFAULT NULL::integer
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  new_code char(8);
  try_count int := 0;
  expires_at_value timestamptz;
  _scope text;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_invites') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  _scope := _user_id::text || ':' || _server_id::text;
  IF NOT public.check_rate_limit(_scope, 'create_server_invite_burst', 12, 60) THEN
    RAISE EXCEPTION 'Rate limited: too many invites created';
  END IF;
  IF NOT public.check_rate_limit(_scope, 'create_server_invite_hourly', 120, 3600) THEN
    RAISE EXCEPTION 'Rate limited: invite creation quota reached';
  END IF;

  IF _max_uses IS NOT NULL AND _max_uses < 1 THEN
    RAISE EXCEPTION 'max_uses must be at least 1';
  END IF;

  expires_at_value := CASE
    WHEN _expires_in_seconds IS NULL THEN NULL
    ELSE now() + make_interval(secs => _expires_in_seconds)
  END;

  LOOP
    try_count := try_count + 1;
    IF try_count > 25 THEN
      RAISE EXCEPTION 'Failed to generate a unique invite code';
    END IF;

    new_code := public.generate_invite_code();

    BEGIN
      INSERT INTO public.server_invites (server_id, code, created_by, expires_at, max_uses, uses_count)
      VALUES (_server_id, new_code, _user_id, expires_at_value, _max_uses, 0);
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- retry
    END;
  END LOOP;

  RETURN trim(new_code::text);
END;
$function$;

CREATE OR REPLACE FUNCTION public.join_server_by_invite(
  _invite_code text,
  _user_id uuid,
  _join_source text DEFAULT 'invite_link'::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  target_server_id uuid;
  existing_member record;
  result json;
  clean_code text;
  system_channel_id uuid;
  enable_join boolean;
  join_message_content text;
  invite_row_id uuid;
  invite_max_uses integer;
  invite_uses_count integer;
  invite_expires_at timestamptz;
  message_id uuid;
  message_inserted boolean := false;
  insert_error text;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.check_rate_limit(_user_id::text, 'join_server_by_invite_burst', 20, 60) THEN
    RAISE EXCEPTION 'Rate limited: too many join attempts';
  END IF;

  IF NOT public.check_rate_limit(_user_id::text, 'join_server_by_invite_hourly', 200, 3600) THEN
    RAISE EXCEPTION 'Rate limited: join quota reached';
  END IF;

  clean_code := upper(trim(_invite_code));

  SELECT id, system_channel_join_id, enable_join_messages
    INTO target_server_id, system_channel_id, enable_join
  FROM public.servers
  WHERE trim(invite_code::text) = clean_code;

  IF target_server_id IS NULL THEN
    SELECT si.id, si.server_id, si.max_uses, si.uses_count, si.expires_at
      INTO invite_row_id, target_server_id, invite_max_uses, invite_uses_count, invite_expires_at
    FROM public.server_invites si
    WHERE si.revoked_at IS NULL
      AND trim(si.code::text) = clean_code
    FOR UPDATE
    LIMIT 1;

    IF invite_row_id IS NOT NULL THEN
      IF invite_expires_at IS NOT NULL AND invite_expires_at <= now() THEN
        RAISE EXCEPTION 'Invalid invite code';
      END IF;
      IF invite_max_uses IS NOT NULL AND invite_uses_count >= invite_max_uses THEN
        RAISE EXCEPTION 'Invalid invite code';
      END IF;

      SELECT system_channel_join_id, enable_join_messages
        INTO system_channel_id, enable_join
      FROM public.servers
      WHERE id = target_server_id;
    END IF;
  END IF;

  IF target_server_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  SELECT * INTO existing_member
  FROM public.server_members
  WHERE server_id = target_server_id
    AND user_id = _user_id;

  IF existing_member IS NOT NULL THEN
    IF existing_member.is_banned = true THEN
      RAISE EXCEPTION 'You are banned from this server';
    END IF;

    SELECT json_build_object(
      'id', s.id,
      'name', s.name,
      'owner_id', s.owner_id,
      'invite_code', trim(s.invite_code::text),
      'icon_url', s.icon_url,
      'banner_url', s.banner_url,
      'created_at', s.created_at,
      'already_member', true
    ) INTO result
    FROM public.servers s
    WHERE s.id = target_server_id;

    RETURN result;
  END IF;

  INSERT INTO public.server_members (server_id, user_id, role, is_banned)
  VALUES (target_server_id, _user_id, 'member', false)
  ON CONFLICT (server_id, user_id) DO NOTHING;

  IF invite_row_id IS NOT NULL THEN
    UPDATE public.server_invites
    SET uses_count = uses_count + 1
    WHERE id = invite_row_id;
  END IF;

  IF system_channel_id IS NOT NULL AND enable_join THEN
    BEGIN
      join_message_content := format('<@%s> joined', _user_id);
      INSERT INTO public.messages (channel_id, user_id, content, is_system_message)
      VALUES (system_channel_id, _user_id, join_message_content, true)
      RETURNING id INTO message_id;
      message_inserted := true;
    EXCEPTION WHEN OTHERS THEN
      insert_error := SQLERRM;
      message_inserted := false;
      RAISE WARNING 'Failed to insert join message: %', SQLERRM;
    END;
  END IF;

  SELECT json_build_object(
    'id', s.id,
    'name', s.name,
    'owner_id', s.owner_id,
    'invite_code', trim(s.invite_code::text),
    'icon_url', s.icon_url,
    'banner_url', s.banner_url,
    'created_at', s.created_at,
    'already_member', false
  ) INTO result
  FROM public.servers s
  WHERE s.id = target_server_id;

  RETURN result;
END;
$function$;

-- 6) Explicitly remove PUBLIC execute grants from hardened endpoints.
REVOKE EXECUTE ON FUNCTION public.check_username_available(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.login_user(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_server_invite(uuid, uuid, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.join_server_by_invite(text, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_friend_with(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.shares_server_with(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.shares_dm_with(uuid, uuid) FROM PUBLIC;

-- Keep intended app access.
GRANT EXECUTE ON FUNCTION public.check_username_available(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.login_user(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_server_invite(uuid, uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_server_by_invite(text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_friend_with(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_server_with(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_dm_with(uuid, uuid) TO authenticated;
