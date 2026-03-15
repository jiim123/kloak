-- Harden coordinated raid detection for "same message + random suffix" spam
-- and make server bans aggressively clean up server spam history.

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
  prefix_len integer := 0;
  shortest_len integer;
  i integer;
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

  char_delta := abs(length(left_compact) - length(right_compact));
  shortest_len := least(length(left_compact), length(right_compact));

  -- Catch the common raid pattern of an identical leading phrase with a short
  -- randomized suffix, e.g. "spamphrase abc123" across many accounts.
  IF shortest_len >= 14 AND char_delta <= 12 THEN
    FOR i IN 1..shortest_len LOOP
      EXIT WHEN substr(left_compact, i, 1) <> substr(right_compact, i, 1);
      prefix_len := i;
    END LOOP;

    IF prefix_len >= 10
       AND (prefix_len::numeric / shortest_len::numeric) >= 0.65 THEN
      RETURN true;
    END IF;
  END IF;

  IF length(left_compact) < 18 OR length(right_compact) < 18 THEN
    RETURN false;
  END IF;

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
  matched_user_ids uuid[] := ARRAY[]::uuid[];
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
  low_trust_ban_targets AS (
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
    COALESCE((SELECT array_agg(user_id) FROM low_trust_ban_targets), ARRAY[]::uuid[]),
    COALESCE((SELECT array_agg(user_id) FROM matched_users), ARRAY[]::uuid[])
  INTO matched_user_count, purge_message_ids, ban_user_ids, matched_user_ids;

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

  -- Once three or more other matching accounts are present, treat the whole
  -- cluster as coordinated spam and ban all matched member accounts.
  IF matched_user_count >= 3 THEN
    ban_user_ids := ban_user_ids || matched_user_ids || ARRAY[_user_id];
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

CREATE OR REPLACE FUNCTION public.ban_member(_server_id uuid, _user_id uuid, _target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'ban_members') THEN
    RAISE EXCEPTION 'You do not have permission to ban members';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.servers
    WHERE id = _server_id
      AND owner_id = _target_user_id
  ) THEN
    RAISE EXCEPTION 'Cannot ban the server owner';
  END IF;

  UPDATE public.server_members
  SET is_banned = true
  WHERE server_id = _server_id
    AND user_id = _target_user_id;

  -- Remove the banned user's visible server spam immediately even if the
  -- membership purge trigger has not been applied yet in the target database.
  DELETE FROM public.messages
  WHERE user_id = _target_user_id
    AND COALESCE(is_system_message, false) = false
    AND channel_id IN (
      SELECT c.id
      FROM public.channels c
      WHERE c.server_id = _server_id
    );
END;
$$;
