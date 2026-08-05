-- Fix statement timeout on join_server_by_invite for large server counts.
-- Root cause: invite_code and code are character(8) (blank-padded fixed-length),
-- but the function compared via trim(col::text) which prevents index usage,
-- forcing a sequential scan on every join attempt.  As the servers table
-- grows past ~thousands of rows, the scan exceeds the statement_timeout.
--
-- Fix: cast the cleaned input to char(8) so the btree index can be used.
-- The char(8) cast right-pads the value with spaces, matching the stored
-- blank-padded representation exactly.

CREATE OR REPLACE FUNCTION public.join_server_by_invite(
  _invite_code text,
  _user_id uuid,
  _join_source text DEFAULT 'invite_link'::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  inserted_member_count integer := 0;
  new_member_id uuid;
  everyone_role_id uuid;
  recent_join_count integer := 0;
  join_burst_protection boolean := false;
  target_is_published boolean := false;
  member_join_source text := 'invite_link';
  member_join_invite_code text := NULL;
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

  SELECT id, system_channel_join_id, enable_join_messages, COALESCE(is_published, false)
    INTO target_server_id, system_channel_id, enable_join, target_is_published
  FROM public.servers
  WHERE invite_code = clean_code::char(8);

  IF target_server_id IS NULL THEN
    SELECT si.id, si.server_id, si.max_uses, si.uses_count, si.expires_at
      INTO invite_row_id, target_server_id, invite_max_uses, invite_uses_count, invite_expires_at
    FROM public.server_invites si
    WHERE si.revoked_at IS NULL
      AND si.code = clean_code::char(8)
    FOR UPDATE
    LIMIT 1;

    IF invite_row_id IS NOT NULL THEN
      IF invite_expires_at IS NOT NULL AND invite_expires_at <= now() THEN
        RAISE EXCEPTION 'Invalid invite code';
      END IF;
      IF invite_max_uses IS NOT NULL AND invite_uses_count >= invite_max_uses THEN
        RAISE EXCEPTION 'Invalid invite code';
      END IF;

      SELECT system_channel_join_id, enable_join_messages, COALESCE(is_published, false)
        INTO system_channel_id, enable_join, target_is_published
      FROM public.servers
      WHERE id = target_server_id;
    END IF;
  END IF;

  IF target_server_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  IF invite_row_id IS NOT NULL THEN
    member_join_source := 'invite';
    member_join_invite_code := clean_code;
  ELSIF lower(COALESCE(_join_source, '')) = 'discover' AND target_is_published THEN
    member_join_source := 'discover';
  ELSE
    member_join_source := 'invite_link';
  END IF;

  SELECT * INTO existing_member
  FROM public.server_members
  WHERE server_id = target_server_id
    AND user_id = _user_id;

  IF existing_member IS NOT NULL THEN
    IF COALESCE(existing_member.is_banned, false) = true THEN
      RAISE EXCEPTION 'You are banned from this server';
    END IF;

    SELECT json_build_object(
      'id', s.id,
      'name', s.name,
      'owner_id', s.owner_id,
      'invite_code', trim(s.invite_code::text),
      'icon_url', s.icon_url,
      'banner_url', s.banner_url,
      'is_published', s.is_published,
      'is_verified', s.is_verified,
      'about', s.about,
      'created_at', s.created_at,
      'already_member', true,
      'is_banned', COALESCE(existing_member.is_banned, false)
    ) INTO result
    FROM public.servers s
    WHERE s.id = target_server_id;

    RETURN result;
  END IF;

  SELECT COUNT(*)
  INTO recent_join_count
  FROM public.server_members sm
  WHERE sm.server_id = target_server_id
    AND sm.joined_at >= now() - interval '2 minutes'
    AND sm.is_banned = false;

  join_burst_protection := recent_join_count >= 8;

  INSERT INTO public.server_members (
    server_id,
    user_id,
    role,
    is_banned,
    is_muted,
    join_source,
    join_invite_code
  )
  VALUES (
    target_server_id,
    _user_id,
    'member',
    false,
    join_burst_protection,
    member_join_source,
    member_join_invite_code
  )
  ON CONFLICT (server_id, user_id) DO NOTHING
  RETURNING id INTO new_member_id;

  GET DIAGNOSTICS inserted_member_count = ROW_COUNT;

  IF inserted_member_count = 0 THEN
    SELECT * INTO existing_member
    FROM public.server_members
    WHERE server_id = target_server_id
      AND user_id = _user_id;

    IF existing_member IS NOT NULL AND COALESCE(existing_member.is_banned, false) = true THEN
      RAISE EXCEPTION 'You are banned from this server';
    END IF;

    SELECT json_build_object(
      'id', s.id,
      'name', s.name,
      'owner_id', s.owner_id,
      'invite_code', trim(s.invite_code::text),
      'icon_url', s.icon_url,
      'banner_url', s.banner_url,
      'is_published', s.is_published,
      'is_verified', s.is_verified,
      'about', s.about,
      'created_at', s.created_at,
      'already_member', true,
      'is_banned', COALESCE(existing_member.is_banned, false)
    ) INTO result
    FROM public.servers s
    WHERE s.id = target_server_id;

    RETURN result;
  END IF;

  SELECT sr.id INTO everyone_role_id
  FROM public.server_roles sr
  WHERE sr.server_id = target_server_id AND sr.name = '@everyone';

  IF everyone_role_id IS NOT NULL AND new_member_id IS NOT NULL THEN
    INSERT INTO public.server_member_roles (member_id, role_id)
    VALUES (new_member_id, everyone_role_id)
    ON CONFLICT DO NOTHING;
  END IF;

  IF invite_row_id IS NOT NULL THEN
    UPDATE public.server_invites
    SET uses_count = uses_count + 1
    WHERE id = invite_row_id;
  END IF;

  IF system_channel_id IS NOT NULL AND enable_join AND NOT join_burst_protection THEN
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
    'is_published', s.is_published,
    'is_verified', s.is_verified,
    'about', s.about,
    'created_at', s.created_at,
    'already_member', false,
    'is_banned', false,
    'raid_protection_muted', join_burst_protection
  ) INTO result
  FROM public.servers s
  WHERE s.id = target_server_id;

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.join_server_by_invite(text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_server_by_invite(text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_server_by_invite(text, uuid, text) TO service_role;

-- Fix the same issue in get_invite_details_by_code (used for invite embed previews).
-- Same root cause: trim(col::text) prevents index usage on character(8) columns.

CREATE OR REPLACE FUNCTION public.get_invite_details_by_code(_invite_code text)
RETURNS TABLE(
  id uuid,
  name varchar,
  icon_url text,
  banner_url text,
  about text,
  invite_code char(8),
  inviter_username text,
  member_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _client_id text;
  _clean_code text;
BEGIN
  _clean_code := upper(trim(_invite_code));
  IF _clean_code IS NULL OR _clean_code = '' THEN
    RETURN;
  END IF;

  _client_id := public.request_client_identifier();
  IF _client_id = 'unknown' THEN
    _client_id := COALESCE(
      'user:' || public.requesting_user_id()::text,
      'invite_lookup:unknown'
    );
  END IF;

  IF NOT public.check_rate_limit(_client_id, 'invite_lookup', 60, 60) THEN
    RAISE EXCEPTION 'Rate limited: too many invite lookups';
  END IF;

  RETURN QUERY
  WITH clean AS (
    SELECT _clean_code AS code
  )
  SELECT
    s.id,
    s.name,
    s.icon_url,
    s.banner_url,
    s.about,
    s.invite_code::char(8) AS invite_code,
    ou.username::text AS inviter_username,
    (
      SELECT COUNT(*)::integer
      FROM public.server_members sm
      WHERE sm.server_id = s.id
        AND COALESCE(sm.is_banned, false) = false
    ) AS member_count
  FROM public.servers s
  JOIN clean ON true
  JOIN public.users ou ON ou.id = s.owner_id
  WHERE s.invite_code = clean.code::char(8)

  UNION ALL

  SELECT
    s.id,
    s.name,
    s.icon_url,
    s.banner_url,
    s.about,
    clean.code::char(8) AS invite_code,
    cu.username::text AS inviter_username,
    (
      SELECT COUNT(*)::integer
      FROM public.server_members sm
      WHERE sm.server_id = s.id
        AND COALESCE(sm.is_banned, false) = false
    ) AS member_count
  FROM public.server_invites si
  JOIN clean ON true
  JOIN public.servers s ON s.id = si.server_id
  JOIN public.users cu ON cu.id = si.created_by
  WHERE si.revoked_at IS NULL
    AND (si.expires_at IS NULL OR si.expires_at > now())
    AND (si.max_uses IS NULL OR si.uses_count < si.max_uses)
    AND si.code = clean.code::char(8)
  LIMIT 1;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_invite_details_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invite_details_by_code(text) TO anon, authenticated;

-- Fix the same issue in get_server_by_invite_code.

CREATE OR REPLACE FUNCTION public.get_server_by_invite_code(_invite_code text)
RETURNS TABLE(id uuid, name character varying, icon_url text, invite_code character)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  WITH clean AS (
    SELECT upper(trim(_invite_code)) as code
  )
  SELECT s.id, s.name, s.icon_url, s.invite_code
  FROM public.servers s
  JOIN clean ON true
  WHERE s.invite_code = clean.code::char(8)

  UNION ALL

  SELECT s.id, s.name, s.icon_url, (clean.code)::char(8)
  FROM public.server_invites si
  JOIN clean ON true
  JOIN public.servers s ON s.id = si.server_id
  WHERE si.revoked_at IS NULL
    AND (si.expires_at IS NULL OR si.expires_at > now())
    AND (si.max_uses IS NULL OR si.uses_count < si.max_uses)
    AND si.code = clean.code::char(8)
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_server_by_invite_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_server_by_invite_code(text) TO anon, authenticated;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END
$$;
