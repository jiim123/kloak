-- Fix Explore join achievements and make join-source attribution server-side.
--
-- A later join_server_by_invite rewrite stopped inserting server_members.join_source,
-- so Explore joins arrived with NULL join_source and never fired
-- trg_check_explore_join_achievement.  Keep attribution on the trusted RPC side:
-- - default server invite + _join_source = discover + published server => discover
-- - custom server_invites code => invite
-- - everything else through the default invite => invite_link

ALTER TABLE public.achievement_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievement_definitions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_achievements FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_achievements TO service_role;

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
    AND COALESCE(sm.is_banned, false) = false;

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

CREATE OR REPLACE FUNCTION public.check_server_join_achievements(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _server_count integer;
BEGIN
  IF _user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*)::int INTO _server_count
  FROM public.server_members sm
  JOIN public.servers s ON s.id = sm.server_id
  WHERE sm.user_id = _user_id
    AND COALESCE(sm.is_banned, false) = false
    AND s.owner_id <> _user_id;

  IF _server_count >= 1 THEN
    PERFORM public.award_achievement(_user_id, 'first_server_join', jsonb_build_object('server_count', _server_count));
  END IF;
  IF _server_count >= 10 THEN
    PERFORM public.award_achievement(_user_id, 'join_10_servers', jsonb_build_object('server_count', _server_count));
  END IF;
  IF _server_count >= 50 THEN
    PERFORM public.award_achievement(_user_id, 'join_50_servers', jsonb_build_object('server_count', _server_count));
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.check_server_join_achievements(uuid) FROM PUBLIC, anon, authenticated;

WITH non_owned_server_counts AS (
  SELECT sm.user_id, count(*)::int AS server_count
  FROM public.server_members sm
  JOIN public.servers s ON s.id = sm.server_id
  WHERE COALESCE(sm.is_banned, false) = false
    AND s.owner_id <> sm.user_id
  GROUP BY sm.user_id
),
join_thresholds AS (
  SELECT *
  FROM (
    VALUES
      ('first_server_join'::text, 1),
      ('join_10_servers'::text, 10),
      ('join_50_servers'::text, 50)
  ) AS thresholds(slug, required_count)
)
DELETE FROM public.user_achievements ua
USING join_thresholds jt
WHERE ua.achievement_slug = jt.slug
  AND COALESCE(
    (
      SELECT sc.server_count
      FROM non_owned_server_counts sc
      WHERE sc.user_id = ua.user_id
    ),
    0
  ) < jt.required_count;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END
$$;
