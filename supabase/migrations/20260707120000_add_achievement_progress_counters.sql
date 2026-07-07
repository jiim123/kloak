-- Add live progress counters to the achievements payload.
-- The helper is internal-only and mirrors the trusted award trigger sources.

CREATE OR REPLACE FUNCTION public.achievement_progress_for_user(
  _user_id uuid,
  _slug text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _current integer := 0;
  _target integer := 1;
  _label text := 'Progress';
BEGIN
  IF _user_id IS NULL OR NULLIF(btrim(COALESCE(_slug, '')), '') IS NULL THEN
    RETURN NULL;
  END IF;

  CASE _slug
    WHEN 'profile_complete' THEN
      _label := 'Profile fields';
      _target := 4;
      SELECT
        (CASE WHEN NULLIF(btrim(COALESCE(u.display_name, '')), '') IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN NULLIF(btrim(COALESCE(u.bio, '')), '') IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN NULLIF(btrim(COALESCE(u.avatar_url, '')), '') IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN NULLIF(btrim(COALESCE(u.banner_url, '')), '') IS NOT NULL THEN 1 ELSE 0 END)
      INTO _current
      FROM public.users u
      WHERE u.id = _user_id;

    WHEN 'avatar_set' THEN
      _label := 'Avatar';
      SELECT CASE WHEN NULLIF(btrim(COALESCE(u.avatar_url, '')), '') IS NOT NULL THEN 1 ELSE 0 END
      INTO _current
      FROM public.users u
      WHERE u.id = _user_id;

    WHEN 'bio_written' THEN
      _label := 'Bio';
      SELECT CASE WHEN NULLIF(btrim(COALESCE(u.bio, '')), '') IS NOT NULL THEN 1 ELSE 0 END
      INTO _current
      FROM public.users u
      WHERE u.id = _user_id;

    WHEN 'tagline_written' THEN
      _label := 'Tagline';
      SELECT CASE WHEN NULLIF(btrim(COALESCE(u.tagline, '')), '') IS NOT NULL THEN 1 ELSE 0 END
      INTO _current
      FROM public.users u
      WHERE u.id = _user_id;

    WHEN 'profile_visited_50', 'profile_visited_500' THEN
      _label := 'Profile views';
      _target := CASE WHEN _slug = 'profile_visited_500' THEN 500 ELSE 50 END;
      SELECT count(*)::int INTO _current
      FROM public.user_profile_view_events e
      WHERE e.target_user_id = _user_id;

    WHEN 'first_msg', 'msg_10', 'msg_50', 'msg_100', 'msg_500' THEN
      _label := 'Messages';
      _target := CASE _slug
        WHEN 'msg_500' THEN 500
        WHEN 'msg_100' THEN 100
        WHEN 'msg_50' THEN 50
        WHEN 'msg_10' THEN 10
        ELSE 1
      END;
      SELECT
        (
          SELECT count(*)::int
          FROM public.messages m
          WHERE m.user_id = _user_id
            AND COALESCE(m.is_system_message, false) = false
        ) + (
          SELECT count(*)::int
          FROM public.direct_messages dm
          WHERE dm.sender_id = _user_id
        )
      INTO _current;

    WHEN 'viral_msg' THEN
      _label := 'Message reactions';
      _target := 100;
      SELECT COALESCE(max(reaction_count), 0)::int INTO _current
      FROM (
        SELECT count(r.id)::int AS reaction_count
        FROM public.messages m
        LEFT JOIN public.reactions r ON r.message_id = m.id
        WHERE m.user_id = _user_id
          AND COALESCE(m.is_system_message, false) = false
        GROUP BY m.id
      ) counts;

    WHEN 'first_profile_comment', 'comments_50' THEN
      _label := 'Profile comments';
      _target := CASE WHEN _slug = 'comments_50' THEN 50 ELSE 1 END;
      SELECT count(*)::int INTO _current
      FROM public.user_profile_post_comments c
      WHERE c.user_id = _user_id;

    WHEN 'media_post' THEN
      _label := 'Media posts';
      SELECT LEAST(count(*)::int, 1) INTO _current
      FROM public.media_items mi
      JOIN public.channels c ON c.id = mi.channel_id
      WHERE mi.user_id = _user_id
        AND c.type = 'media'::public.channel_type
        AND mi.media_type IN ('image', 'video', 'gif', 'youtube');

    WHEN 'thread_starter' THEN
      _label := 'Thread replies';
      _target := 10;
      SELECT COALESCE(max(reply_count), 0)::int INTO _current
      FROM (
        SELECT count(tm.id)::int AS reply_count
        FROM public.threads t
        LEFT JOIN public.thread_messages tm
          ON tm.thread_id = t.id
         AND tm.user_id <> t.created_by
        WHERE t.created_by = _user_id
        GROUP BY t.id
      ) counts;

    WHEN 'message_edited' THEN
      _label := 'Edited messages';
      SELECT LEAST((
        (
          SELECT count(*)::int
          FROM public.messages m
          WHERE m.user_id = _user_id
            AND m.edited_at IS NOT NULL
            AND COALESCE(m.is_system_message, false) = false
        ) + (
          SELECT count(*)::int
          FROM public.direct_messages dm
          WHERE dm.sender_id = _user_id
            AND dm.edited_at IS NOT NULL
        )
      ), 1) INTO _current;

    WHEN 'forum_regular' THEN
      _label := 'Forum threads';
      _target := 10;
      SELECT count(DISTINCT tm.thread_id)::int INTO _current
      FROM public.thread_messages tm
      JOIN public.threads t ON t.id = tm.thread_id
      JOIN public.channels c ON c.id = t.channel_id
      WHERE tm.user_id = _user_id
        AND t.created_by <> _user_id
        AND c.type = 'forum'::public.channel_type;

    WHEN 'early_reply' THEN
      _label := 'Fast forum replies';
      SELECT LEAST(count(*)::int, 1) INTO _current
      FROM public.thread_messages tm
      JOIN public.threads t ON t.id = tm.thread_id
      JOIN public.channels c ON c.id = t.channel_id
      WHERE tm.user_id = _user_id
        AND t.created_by <> _user_id
        AND c.type = 'forum'::public.channel_type
        AND tm.created_at <= t.created_at + interval '5 minutes';

    WHEN 'helpful_reply' THEN
      _label := 'Same reactions';
      _target := 10;
      SELECT COALESCE(max(reaction_count), 0)::int INTO _current
      FROM (
        SELECT count(tr.id)::int AS reaction_count
        FROM public.thread_messages tm
        JOIN public.thread_reactions tr
          ON tr.message_id = tm.id
         AND tr.user_id <> tm.user_id
        WHERE tm.user_id = _user_id
        GROUP BY tm.id, tr.emoji
      ) counts;

    WHEN 'poll_participant' THEN
      _label := 'Poll votes';
      SELECT LEAST(count(*)::int, 1) INTO _current
      FROM public.poll_votes pv
      WHERE pv.user_id = _user_id;

    WHEN 'pin_worthy' THEN
      _label := 'Pinned messages';
      SELECT LEAST(count(*)::int, 1) INTO _current
      FROM public.messages m
      WHERE m.user_id = _user_id
        AND COALESCE(m.is_pinned, false) = true
        AND COALESCE(m.is_system_message, false) = false
        AND (m.pinned_by IS NULL OR m.pinned_by <> m.user_id);

    WHEN 'distinct_days_active_30' THEN
      _label := 'Active days';
      _target := 30;
      SELECT count(*)::int INTO _current
      FROM (
        SELECT m.created_at::date AS active_day
        FROM public.messages m
        WHERE m.user_id = _user_id
          AND COALESCE(m.is_system_message, false) = false
        UNION
        SELECT dm.created_at::date AS active_day
        FROM public.direct_messages dm
        WHERE dm.sender_id = _user_id
        UNION
        SELECT tm.created_at::date AS active_day
        FROM public.thread_messages tm
        WHERE tm.user_id = _user_id
      ) days;

    WHEN 'first_friend', '10_friends', '100_friends', '1000_friends' THEN
      _label := 'Friends';
      _target := CASE _slug
        WHEN '1000_friends' THEN 1000
        WHEN '100_friends' THEN 100
        WHEN '10_friends' THEN 10
        ELSE 1
      END;
      SELECT count(*)::int INTO _current
      FROM public.friendships f
      WHERE f.status = 'accepted'::public.friendship_status
        AND (f.requester_id = _user_id OR f.addressee_id = _user_id);

    WHEN 'first_mention', 'mentioned_10_times' THEN
      _label := 'Mentions';
      _target := CASE WHEN _slug = 'mentioned_10_times' THEN 10 ELSE 1 END;
      SELECT count(*)::int INTO _current
      FROM public.mentions m
      WHERE m.user_id = _user_id;

    WHEN 'first_dm', 'dm_10', 'dm_100' THEN
      _label := 'Direct messages';
      _target := CASE _slug
        WHEN 'dm_100' THEN 100
        WHEN 'dm_10' THEN 10
        ELSE 1
      END;
      SELECT count(*)::int INTO _current
      FROM public.direct_messages dm
      WHERE dm.sender_id = _user_id;

    WHEN 'group_dm_started' THEN
      _label := 'Group DMs';
      SELECT LEAST(count(*)::int, 1) INTO _current
      FROM public.dm_conversations dc
      WHERE dc.created_by = _user_id
        AND COALESCE(dc.is_group, false) = true;

    WHEN 'voice_joined' THEN
      _label := 'Voice joins';

    WHEN 'join_a_server_from_explore_page' THEN
      _label := 'Explore joins';
      SELECT LEAST(count(*)::int, 1) INTO _current
      FROM public.server_members sm
      JOIN public.servers s ON s.id = sm.server_id
      WHERE sm.user_id = _user_id
        AND lower(COALESCE(sm.join_source, '')) = 'discover'
        AND COALESCE(sm.is_banned, false) = false
        AND COALESCE(s.is_published, false) = true;

    WHEN 'first_server_join', 'join_10_servers', 'join_50_servers' THEN
      _label := 'Servers joined';
      _target := CASE _slug
        WHEN 'join_50_servers' THEN 50
        WHEN 'join_10_servers' THEN 10
        ELSE 1
      END;
      SELECT count(*)::int INTO _current
      FROM public.server_members sm
      JOIN public.servers s ON s.id = sm.server_id
      WHERE sm.user_id = _user_id
        AND COALESCE(sm.is_banned, false) = false
        AND s.owner_id <> _user_id;

    WHEN 'create_first_server' THEN
      _label := 'Servers created';
      SELECT LEAST(count(*)::int, 1) INTO _current
      FROM public.servers s
      WHERE s.owner_id = _user_id;

    WHEN 'server_published' THEN
      _label := 'Published servers';
      SELECT LEAST(count(*)::int, 1) INTO _current
      FROM public.servers s
      WHERE s.owner_id = _user_id
        AND COALESCE(s.is_published, false) = true;

    WHEN 'emoji_uploaded' THEN
      _label := 'Uploaded emojis';
      SELECT LEAST(count(*)::int, 1) INTO _current
      FROM public.server_emojis se
      WHERE se.created_by = _user_id;

    WHEN 'first_invite_created' THEN
      _label := 'Server invites';
      SELECT LEAST(count(*)::int, 1) INTO _current
      FROM public.server_invites si
      WHERE si.created_by = _user_id;

    WHEN 'change_theme' THEN
      _label := 'Theme changed';
      SELECT CASE WHEN EXISTS (
        SELECT 1
        FROM public.user_preferences up
        WHERE up.user_id = _user_id
          AND NULLIF(btrim(COALESCE(up.theme, '')), '') IS NOT NULL
          AND up.theme <> 'default'
      ) THEN 1 ELSE 0 END
      INTO _current;

    WHEN 'custom_status_set' THEN
      _label := 'Custom status';
      SELECT CASE WHEN NULLIF(btrim(COALESCE(u.custom_status, '')), '') IS NOT NULL THEN 1 ELSE 0 END
      INTO _current
      FROM public.users u
      WHERE u.id = _user_id;

    WHEN 'profile_theme_changed' THEN
      _label := 'Profile colors';
      SELECT CASE
        WHEN NULLIF(btrim(COALESCE(u.profile_theme_primary, '')), '') IS NOT NULL
          OR NULLIF(btrim(COALESCE(u.profile_theme_accent, '')), '') IS NOT NULL
        THEN 1 ELSE 0 END
      INTO _current
      FROM public.users u
      WHERE u.id = _user_id;

    WHEN 'compact_mode_enabled' THEN
      _label := 'Compact mode';
      SELECT CASE WHEN EXISTS (
        SELECT 1
        FROM public.user_preferences up
        WHERE up.user_id = _user_id
          AND COALESCE(up.compact_mode, false) = true
      ) THEN 1 ELSE 0 END
      INTO _current;

    WHEN 'profile_post_created' THEN
      _label := 'Profile posts';
      SELECT LEAST(count(*)::int, 1) INTO _current
      FROM public.user_profile_posts p
      WHERE p.user_id = _user_id;

    ELSE
      RETURN NULL;
  END CASE;

  _current := GREATEST(COALESCE(_current, 0), 0);
  _target := GREATEST(COALESCE(_target, 1), 1);

  RETURN jsonb_build_object(
    'current', _current,
    'target', _target,
    'label', _label,
    'percent', LEAST(100, FLOOR((LEAST(_current, _target)::numeric / _target::numeric) * 100))::int
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.achievement_progress_for_user(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_achievements(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _completed_count integer;
  _total_count integer;
  _items jsonb;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.check_rate_limit(_user_id::text, 'my_achievements_read_burst', 60, 60) THEN
    RAISE EXCEPTION 'Rate limited: achievements are being read too quickly';
  END IF;

  SELECT count(*)::int INTO _total_count
  FROM public.achievement_definitions
  WHERE is_active = true;

  SELECT count(*)::int INTO _completed_count
  FROM public.user_achievements ua
  JOIN public.achievement_definitions ad ON ad.slug = ua.achievement_slug
  WHERE ua.user_id = _user_id
    AND ad.is_active = true;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'slug', ad.slug,
        'category', ad.category,
        'tier', ad.tier,
        'name', ad.name,
        'description', ad.description,
        'hint', ad.hint,
        'trigger_name', ad.trigger_name,
        'sort_order', ad.sort_order,
        'completed_at', ua.completed_at,
        'metadata', COALESCE(ua.metadata, '{}'::jsonb),
        'progress', public.achievement_progress_for_user(_user_id, ad.slug),
        'is_completed', ua.completed_at IS NOT NULL
      )
      ORDER BY ad.category, ad.sort_order
    ),
    '[]'::jsonb
  )
  INTO _items
  FROM public.achievement_definitions ad
  LEFT JOIN public.user_achievements ua
    ON ua.achievement_slug = ad.slug
   AND ua.user_id = _user_id
  WHERE ad.is_active = true;

  RETURN jsonb_build_object(
    'summary', public.get_aura_level(_completed_count, _total_count),
    'achievements', _items
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_my_achievements(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_achievements(uuid) TO anon, authenticated;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION WHEN OTHERS THEN
  NULL;
END
$$;
