-- Default server-side raid protection.
-- Goals:
-- 1) detect coordinated near-duplicate spam across multiple accounts in the same server
-- 2) purge recent matching messages and auto-ban low-trust raiders
-- 3) reduce join-wave damage by auto-muting burst joins and suppressing join spam messages

CREATE OR REPLACE FUNCTION public.normalize_raid_message_content(_content text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  normalized text;
BEGIN
  normalized := lower(btrim(COALESCE(_content, '')));

  -- Strip URLs, mentions, and other high-variance tokens before comparison.
  normalized := regexp_replace(normalized, '(https?://\S+|www\.\S+)', ' ', 'gi');
  normalized := regexp_replace(normalized, '<@[0-9a-f-]{36}>', ' @user ', 'gi');
  normalized := regexp_replace(normalized, '<#[0-9a-f-]{36}>', ' #channel ', 'gi');
  normalized := regexp_replace(normalized, '<@&[0-9a-f-]{36}>', ' @role ', 'gi');

  -- Collapse repeated characters and discard punctuation / isolated numbers.
  normalized := regexp_replace(normalized, '(.)\1{2,}', '\1\1', 'g');
  normalized := regexp_replace(normalized, '[^a-z0-9\s]', ' ', 'g');
  normalized := regexp_replace(normalized, '\m[0-9]+\M', ' ', 'g');
  normalized := regexp_replace(normalized, '\s+', ' ', 'g');

  RETURN btrim(normalized);
END;
$$;

CREATE OR REPLACE FUNCTION public.are_messages_similar_for_raid(_left text, _right text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  left_normalized text;
  right_normalized text;
  left_compact text;
  right_compact text;
  shared_token_count integer;
  union_token_count integer;
  char_delta integer;
BEGIN
  left_normalized := public.normalize_raid_message_content(_left);
  right_normalized := public.normalize_raid_message_content(_right);

  IF left_normalized = '' OR right_normalized = '' THEN
    RETURN false;
  END IF;

  IF left_normalized = right_normalized THEN
    RETURN true;
  END IF;

  left_compact := regexp_replace(left_normalized, '\s+', '', 'g');
  right_compact := regexp_replace(right_normalized, '\s+', '', 'g');

  IF left_compact = right_compact THEN
    RETURN true;
  END IF;

  IF length(left_compact) < 18 OR length(right_compact) < 18 THEN
    RETURN false;
  END IF;

  char_delta := abs(length(left_compact) - length(right_compact));

  SELECT COUNT(*)::integer
  INTO shared_token_count
  FROM (
    SELECT token
    FROM unnest(string_to_array(left_normalized, ' ')) AS tokens(token)
    WHERE length(token) >= 4
    INTERSECT
    SELECT token
    FROM unnest(string_to_array(right_normalized, ' ')) AS tokens(token)
    WHERE length(token) >= 4
  ) shared_tokens;

  SELECT COUNT(*)::integer
  INTO union_token_count
  FROM (
    SELECT token
    FROM unnest(string_to_array(left_normalized, ' ')) AS tokens(token)
    WHERE length(token) >= 4
    UNION
    SELECT token
    FROM unnest(string_to_array(right_normalized, ' ')) AS tokens(token)
    WHERE length(token) >= 4
  ) union_tokens;

  IF union_token_count = 0 THEN
    RETURN false;
  END IF;

  RETURN (
    shared_token_count >= 5
    AND char_delta <= 24
    AND (shared_token_count::numeric / union_token_count::numeric) >= 0.72
  ) OR (
    char_delta <= 12
    AND length(left_compact) >= 36
    AND length(right_compact) >= 36
    AND left(left_compact, 28) = left(right_compact, 28)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_server_raid_protection(
  _user_id uuid,
  _channel_id uuid,
  _server_id uuid,
  _content text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_joined_at timestamptz;
  actor_created_at timestamptz;
  actor_role public.server_role;
  actor_is_low_trust boolean := false;
  matched_user_count integer := 0;
  purge_message_ids uuid[] := ARRAY[]::uuid[];
  ban_user_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  SELECT sm.joined_at, sm.role, u.created_at
  INTO actor_joined_at, actor_role, actor_created_at
  FROM public.server_members sm
  JOIN public.users u ON u.id = sm.user_id
  WHERE sm.server_id = _server_id
    AND sm.user_id = _user_id
    AND COALESCE(sm.is_banned, false) = false;

  IF actor_role IS NULL THEN
    RETURN;
  END IF;

  -- Never auto-ban privileged users through the raid path.
  IF actor_role <> 'member' THEN
    RETURN;
  END IF;

  actor_is_low_trust := (
    actor_joined_at >= now() - interval '30 minutes'
    OR actor_created_at >= now() - interval '7 days'
  );

  WITH matched_messages AS (
    SELECT
      m.id,
      m.user_id,
      sm.joined_at,
      u.created_at AS user_created_at
    FROM public.messages m
    JOIN public.channels c
      ON c.id = m.channel_id
    JOIN public.server_members sm
      ON sm.server_id = c.server_id
     AND sm.user_id = m.user_id
    JOIN public.users u
      ON u.id = m.user_id
    WHERE c.server_id = _server_id
      AND m.created_at >= now() - interval '2 minutes'
      AND COALESCE(m.is_system_message, false) = false
      AND m.user_id <> _user_id
      AND COALESCE(sm.is_banned, false) = false
      AND sm.role = 'member'
      AND public.are_messages_similar_for_raid(m.content, _content)
  ),
  matched_users AS (
    SELECT DISTINCT mm.user_id
    FROM matched_messages mm
  ),
  ban_targets AS (
    SELECT DISTINCT mm.user_id
    FROM matched_messages mm
    WHERE mm.joined_at >= now() - interval '30 minutes'
       OR mm.user_created_at >= now() - interval '7 days'
  ),
  purge_targets AS (
    SELECT m2.id
    FROM public.messages m2
    JOIN public.channels c2
      ON c2.id = m2.channel_id
    WHERE c2.server_id = _server_id
      AND COALESCE(m2.is_system_message, false) = false
      AND m2.created_at >= now() - interval '10 minutes'
      AND (
        m2.user_id = ANY(ARRAY(SELECT user_id FROM matched_users))
        OR m2.user_id = _user_id
      )
      AND public.are_messages_similar_for_raid(m2.content, _content)
  )
  SELECT
    COALESCE((SELECT COUNT(*) FROM matched_users), 0),
    COALESCE((SELECT array_agg(id) FROM purge_targets), ARRAY[]::uuid[]),
    COALESCE((SELECT array_agg(user_id) FROM ban_targets), ARRAY[]::uuid[])
  INTO matched_user_count, purge_message_ids, ban_user_ids;

  -- Require at least 3 coordinated accounts total unless the sender is low-trust,
  -- in which case 2 recent matching accounts is enough to trigger.
  IF matched_user_count < 2 THEN
    RETURN;
  END IF;

  IF matched_user_count < 3 AND NOT actor_is_low_trust THEN
    RETURN;
  END IF;

  IF array_length(purge_message_ids, 1) IS NOT NULL THEN
    DELETE FROM public.messages
    WHERE id = ANY(purge_message_ids);
  END IF;

  IF actor_is_low_trust THEN
    ban_user_ids := array_append(ban_user_ids, _user_id);
  END IF;

  ban_user_ids := ARRAY(
    SELECT DISTINCT user_id
    FROM unnest(COALESCE(ban_user_ids, ARRAY[]::uuid[])) AS user_id
    WHERE user_id IS NOT NULL
  );

  IF array_length(ban_user_ids, 1) IS NOT NULL THEN
    PERFORM set_config('app.moderation_bypass', 'ban', true);

    UPDATE public.server_members
    SET is_banned = true
    WHERE server_id = _server_id
      AND user_id = ANY(ban_user_ids)
      AND role = 'member'
      AND COALESCE(is_banned, false) = false;
  END IF;

  RAISE EXCEPTION 'Raid protection triggered: coordinated spam detected and removed';
END;
$$;

CREATE OR REPLACE FUNCTION public.send_message(
  _user_id uuid,
  _channel_id uuid,
  _content text,
  _reply_to_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  channel_server_id uuid;
  channel_is_read_only boolean;
  channel_slowmode_seconds integer;
  channel_block_links boolean;
  channel_allowed_domains text[];
  is_muted boolean;
  user_role server_role;
  new_message_id uuid;
  result json;
  sender_created_at timestamptz;
  recent_count_10s integer;
  recent_count_1m integer;
  normalized_content text;
  last_message_time timestamptz;
  time_since_last_message interval;
  has_url boolean;
  can_post_links boolean;
  allowed_domain text;
  domain_found boolean;
  mention_count integer;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  normalized_content := trim(_content);

  IF normalized_content IS NULL OR length(normalized_content) = 0 THEN
    RAISE EXCEPTION 'Message content cannot be empty.';
  END IF;

  IF length(normalized_content) > 4000 THEN
    RAISE EXCEPTION 'Message content cannot exceed 4000 characters.';
  END IF;

  SELECT count(*) INTO mention_count
  FROM regexp_matches(normalized_content, '<@[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>', 'gi');
  IF mention_count > 5 THEN
    RAISE EXCEPTION 'Too many mentions. Maximum 5 user mentions per message.';
  END IF;

  SELECT u.created_at INTO sender_created_at
  FROM public.users u WHERE u.id = _user_id;
  IF sender_created_at IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  IF sender_created_at > now() - interval '2 minutes' THEN
    RAISE EXCEPTION 'Messaging is temporarily restricted for new accounts';
  END IF;

  IF NOT public.check_rate_limit(_user_id::text, 'send_message', 10, 5) THEN
    RAISE EXCEPTION 'You are sending messages too fast. Please slow down.';
  END IF;

  SELECT count(*) INTO recent_count_10s
  FROM public.messages m
  WHERE m.user_id = _user_id AND m.channel_id = _channel_id AND m.created_at > now() - interval '10 seconds';
  IF recent_count_10s >= 6 THEN
    RAISE EXCEPTION 'Rate limited: too many messages in this channel';
  END IF;

  SELECT count(*) INTO recent_count_1m
  FROM public.messages m
  WHERE m.user_id = _user_id AND m.created_at > now() - interval '1 minute';
  IF recent_count_1m >= 30 THEN
    RAISE EXCEPTION 'Rate limited: minute message quota reached';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.user_id = _user_id AND m.channel_id = _channel_id
      AND m.content = normalized_content AND m.created_at > now() - interval '15 seconds'
  ) THEN
    RAISE EXCEPTION 'Duplicate message blocked';
  END IF;

  SELECT server_id, is_read_only, slowmode_seconds, block_links, allowed_link_domains
  INTO channel_server_id, channel_is_read_only, channel_slowmode_seconds, channel_block_links, channel_allowed_domains
  FROM public.channels WHERE id = _channel_id;
  IF channel_server_id IS NULL THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;

  SELECT sm.is_muted, sm.role INTO is_muted, user_role
  FROM public.server_members sm
  WHERE sm.server_id = channel_server_id AND sm.user_id = _user_id AND sm.is_banned = false;
  IF is_muted IS NULL THEN
    RAISE EXCEPTION 'Not a member of this server';
  END IF;
  IF is_muted THEN
    RAISE EXCEPTION 'You are muted in this server';
  END IF;

  IF NOT public.check_user_permission(_user_id, _channel_id, 'send_messages') THEN
    RAISE EXCEPTION 'You do not have permission to send messages in this channel';
  END IF;
  IF channel_is_read_only = true THEN
    IF NOT public.check_user_permission(_user_id, _channel_id, 'manage_messages') THEN
      RAISE EXCEPTION 'This channel is read-only';
    END IF;
  END IF;

  IF channel_slowmode_seconds > 0 THEN
    IF NOT public.check_user_permission(_user_id, _channel_id, 'manage_messages') THEN
      SELECT m.created_at INTO last_message_time
      FROM public.messages m
      WHERE m.user_id = _user_id AND m.channel_id = _channel_id
      ORDER BY m.created_at DESC LIMIT 1;
      IF last_message_time IS NOT NULL THEN
        time_since_last_message := now() - last_message_time;
        IF time_since_last_message < make_interval(secs => channel_slowmode_seconds) THEN
          RAISE EXCEPTION 'Slowmode is active. Please wait % seconds before sending another message.',
            channel_slowmode_seconds - EXTRACT(EPOCH FROM time_since_last_message)::integer;
        END IF;
      END IF;
    END IF;
  END IF;

  IF channel_block_links = true THEN
    has_url := normalized_content ~* 'https?://|www\.|[a-z0-9-]+\.(com|net|org|io|dev|app|gg|me|co|tv|fm|xyz|ai|site|tech|online|store|blog|info|cc|biz)(/|\s|$)';
    IF has_url THEN
      can_post_links := public.check_user_permission(_user_id, _channel_id, 'manage_messages');
      IF NOT can_post_links THEN
        IF channel_allowed_domains IS NOT NULL AND array_length(channel_allowed_domains, 1) > 0 THEN
          domain_found := false;
          FOREACH allowed_domain IN ARRAY channel_allowed_domains LOOP
            IF normalized_content ~* ('(^|://|www\.)' || regexp_replace(allowed_domain, '\.', '\\.', 'g') || '(/|\s|$)') THEN
              domain_found := true;
              EXIT;
            END IF;
          END LOOP;
          IF NOT domain_found THEN
            RAISE EXCEPTION 'Links from this domain are not allowed in this channel. Only whitelisted domains are permitted.';
          END IF;
        ELSE
          RAISE EXCEPTION 'Links are not allowed in this channel';
        END IF;
      END IF;
    END IF;
  END IF;

  IF _reply_to_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.messages WHERE id = _reply_to_id AND channel_id = _channel_id
    ) THEN
      RAISE EXCEPTION 'Invalid reply reference.';
    END IF;
  END IF;

  PERFORM public.enforce_server_raid_protection(_user_id, _channel_id, channel_server_id, normalized_content);

  INSERT INTO public.messages (channel_id, user_id, content, reply_to_id)
  VALUES (_channel_id, _user_id, normalized_content, _reply_to_id)
  RETURNING id INTO new_message_id;

  SELECT json_build_object(
    'id', m.id, 'channel_id', m.channel_id, 'user_id', m.user_id,
    'content', m.content, 'reply_to_id', m.reply_to_id,
    'is_pinned', m.is_pinned, 'edited_at', m.edited_at, 'created_at', m.created_at
  ) INTO result
  FROM public.messages m WHERE m.id = new_message_id;

  RETURN result;
END;
$$;

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

  INSERT INTO public.server_members (server_id, user_id, role, is_banned, is_muted)
  VALUES (target_server_id, _user_id, 'member', false, join_burst_protection)
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
