-- Support replying to multiple channel messages while preserving the existing
-- messages.reply_to_id compatibility path.

CREATE TABLE IF NOT EXISTS public.message_reply_targets (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  reply_to_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, reply_to_id),
  CONSTRAINT message_reply_targets_no_self_reply CHECK (message_id <> reply_to_id)
);

CREATE INDEX IF NOT EXISTS idx_message_reply_targets_reply_to_id
  ON public.message_reply_targets (reply_to_id);

ALTER TABLE public.message_reply_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Message reply targets viewable by channel members" ON public.message_reply_targets;
CREATE POLICY "Message reply targets viewable by channel members"
  ON public.message_reply_targets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.messages m
      WHERE m.id = message_reply_targets.message_id
        AND public.can_access_channel(m.channel_id, public.requesting_user_id())
    )
  );

REVOKE ALL ON public.message_reply_targets FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.message_reply_targets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_reply_targets TO service_role;

CREATE OR REPLACE FUNCTION public.get_message_reply_targets_secure(
  _message_ids uuid[],
  _user_id uuid,
  _blocked_user_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT
          mrt.message_id,
          mrt.reply_to_id,
          json_build_object(
            'id', replied.id,
            'content', replied.content,
            'user_id', replied.user_id,
            'user', row_to_json(u)
          ) AS reply_to
        FROM public.message_reply_targets mrt
        JOIN public.messages parent ON parent.id = mrt.message_id
        JOIN public.messages replied ON replied.id = mrt.reply_to_id
        JOIN public.users u ON u.id = replied.user_id
        WHERE mrt.message_id = ANY(_message_ids)
          AND public.can_access_channel(parent.channel_id, _user_id)
          AND parent.channel_id = replied.channel_id
          AND (
            COALESCE(array_length(_blocked_user_ids, 1), 0) = 0
            OR NOT (replied.user_id = ANY(_blocked_user_ids))
          )
        ORDER BY mrt.created_at ASC
      ) t
    ),
    '[]'::json
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_message_reply_targets_secure(uuid[], uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_message_reply_targets_secure(uuid[], uuid, uuid[]) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.send_message(uuid, uuid, text, uuid);

CREATE OR REPLACE FUNCTION public.send_message(
  _user_id uuid,
  _channel_id uuid,
  _content text,
  _reply_to_id uuid DEFAULT NULL,
  _reply_to_ids uuid[] DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  normalized_reply_to_ids uuid[];
  primary_reply_to_id uuid;
  new_message_id uuid;
  result json;
  channel_server_id uuid;
  channel_is_read_only boolean;
  channel_slowmode_seconds integer;
  channel_block_links boolean;
  channel_allowed_domains text[];
  is_muted boolean;
  user_role server_role;
  channel_name text;
  sender_username text;
  reply_to_list json;
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
  has_everyone_mention boolean;
  has_here_mention boolean;
  queued_types text[] := ARRAY[]::text[];
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

  has_everyone_mention := normalized_content ~* '(^|[^[:alnum:]_])@everyone([^[:alnum:]_]|$)';
  has_here_mention := normalized_content ~* '(^|[^[:alnum:]_])@here([^[:alnum:]_]|$)';

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

  SELECT server_id, is_read_only, slowmode_seconds, block_links, allowed_link_domains, name
  INTO channel_server_id, channel_is_read_only, channel_slowmode_seconds, channel_block_links, channel_allowed_domains, channel_name
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

  IF (has_everyone_mention OR has_here_mention)
     AND NOT public.check_user_permission(_user_id, _channel_id, 'mention_everyone') THEN
    RAISE EXCEPTION 'You do not have permission to mention @everyone in this channel';
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

  SELECT array_agg(DISTINCT reply_id)
  INTO normalized_reply_to_ids
  FROM unnest(COALESCE(_reply_to_ids, ARRAY[]::uuid[]) || ARRAY[_reply_to_id]) AS reply_ids(reply_id)
  WHERE reply_id IS NOT NULL;

  IF COALESCE(array_length(normalized_reply_to_ids, 1), 0) > 5 THEN
    RAISE EXCEPTION 'Too many reply references. Maximum 5 replies per message.';
  END IF;

  primary_reply_to_id := COALESCE(_reply_to_id, normalized_reply_to_ids[1]);

  IF COALESCE(array_length(normalized_reply_to_ids, 1), 0) > 0 THEN
    IF EXISTS (
      SELECT 1
      FROM unnest(normalized_reply_to_ids) AS reply_ids(reply_id)
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.messages m
        WHERE m.id = reply_id
          AND m.channel_id = _channel_id
      )
    ) THEN
      RAISE EXCEPTION 'Invalid reply reference.';
    END IF;
  END IF;

  PERFORM public.enforce_single_account_variant_spam(_user_id, _channel_id, channel_server_id, normalized_content);
  PERFORM public.enforce_server_raid_protection(_user_id, _channel_id, channel_server_id, normalized_content);

  INSERT INTO public.messages (channel_id, user_id, content, reply_to_id)
  VALUES (_channel_id, _user_id, normalized_content, primary_reply_to_id)
  RETURNING id INTO new_message_id;

  IF has_everyone_mention THEN
    INSERT INTO public.mass_mention_jobs (message_id, channel_id, server_id, sender_id, mention_type)
    VALUES (new_message_id, _channel_id, channel_server_id, _user_id, 'everyone'::public.mention_type)
    ON CONFLICT (message_id, mention_type) DO NOTHING;
    queued_types := array_append(queued_types, 'everyone');
  END IF;

  IF has_here_mention THEN
    INSERT INTO public.mass_mention_jobs (message_id, channel_id, server_id, sender_id, mention_type)
    VALUES (new_message_id, _channel_id, channel_server_id, _user_id, 'here'::public.mention_type)
    ON CONFLICT (message_id, mention_type) DO NOTHING;
    queued_types := array_append(queued_types, 'here');
  END IF;

  IF COALESCE(array_length(normalized_reply_to_ids, 1), 0) > 0 THEN
    INSERT INTO public.message_reply_targets (message_id, reply_to_id)
    SELECT new_message_id, reply_id
    FROM unnest(normalized_reply_to_ids) AS reply_ids(reply_id)
    ON CONFLICT DO NOTHING;

    SELECT u.username
    INTO sender_username
    FROM public.users u
    WHERE u.id = _user_id;

    INSERT INTO public.notifications (user_id, type, title, body, link)
    SELECT DISTINCT replied.user_id,
           'mention'::public.notification_type,
           'New reply',
           COALESCE(sender_username, 'Someone') || ' replied to you in #' || COALESCE(channel_name, 'channel'),
           '/app?server=' || channel_server_id || '&channel=' || _channel_id || '&message=' || new_message_id
    FROM public.messages replied
    WHERE replied.id = ANY(normalized_reply_to_ids)
      AND replied.user_id <> _user_id;

    INSERT INTO public.channel_reads (channel_id, user_id, mention_count)
    SELECT DISTINCT _channel_id, replied.user_id, 1
    FROM public.messages replied
    WHERE replied.id = ANY(normalized_reply_to_ids)
      AND replied.user_id <> _user_id
    ON CONFLICT (channel_id, user_id)
    DO UPDATE SET mention_count = COALESCE(public.channel_reads.mention_count, 0) + 1;
  END IF;

  SELECT COALESCE(json_agg(reply_preview), '[]'::json)
  INTO reply_to_list
  FROM (
    SELECT json_build_object(
      'id', replied.id,
      'content', replied.content,
      'user_id', replied.user_id,
      'user', row_to_json(u)
    ) AS reply_preview
    FROM public.message_reply_targets mrt
    JOIN public.messages replied ON replied.id = mrt.reply_to_id
    JOIN public.users u ON u.id = replied.user_id
    WHERE mrt.message_id = new_message_id
    ORDER BY mrt.created_at ASC
    ) replies;

  SELECT json_build_object(
    'id', m.id,
    'channel_id', m.channel_id,
    'user_id', m.user_id,
    'content', m.content,
    'reply_to_id', m.reply_to_id,
    'is_pinned', m.is_pinned,
    'is_system_message', COALESCE(m.is_system_message, false),
    'embed_hidden', COALESCE(m.embed_hidden, false),
    'edited_at', m.edited_at,
    'created_at', m.created_at,
    'mass_mentions_queued', array_length(queued_types, 1) IS NOT NULL,
    'queued_mention_types', queued_types
  ) INTO result
  FROM public.messages m WHERE m.id = new_message_id;

  RETURN (
    result::jsonb ||
    jsonb_build_object(
      'reply_to_ids', COALESCE(normalized_reply_to_ids, ARRAY[]::uuid[]),
      'reply_to_list', COALESCE(reply_to_list, '[]'::json)
    )
  )::json;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.send_message(uuid, uuid, text, uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_message(uuid, uuid, text, uuid, uuid[]) TO anon, authenticated, service_role;
