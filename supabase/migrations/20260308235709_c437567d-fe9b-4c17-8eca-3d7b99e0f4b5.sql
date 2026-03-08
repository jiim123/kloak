-- Add slowmode and link blocking enforcement to send_message
CREATE OR REPLACE FUNCTION public.send_message(_user_id uuid, _channel_id uuid, _content text, _reply_to_id uuid DEFAULT NULL::uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  normalized_content := trim(_content);

  IF normalized_content IS NULL OR length(normalized_content) = 0 THEN
    RAISE EXCEPTION 'Message content cannot be empty.';
  END IF;

  IF length(normalized_content) > 2000 THEN
    RAISE EXCEPTION 'Message content cannot exceed 2000 characters.';
  END IF;

  SELECT u.created_at INTO sender_created_at
  FROM public.users u
  WHERE u.id = _user_id;

  IF sender_created_at IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF sender_created_at > now() - interval '2 minutes' THEN
    RAISE EXCEPTION 'Messaging is temporarily restricted for new accounts';
  END IF;

  -- Existing global burst limiter.
  IF NOT public.check_rate_limit(_user_id::text, 'send_message', 10, 5) THEN
    RAISE EXCEPTION 'You are sending messages too fast. Please slow down.';
  END IF;

  -- Additional anti-flood guards.
  SELECT count(*) INTO recent_count_10s
  FROM public.messages m
  WHERE m.user_id = _user_id
    AND m.channel_id = _channel_id
    AND m.created_at > now() - interval '10 seconds';

  IF recent_count_10s >= 6 THEN
    RAISE EXCEPTION 'Rate limited: too many messages in this channel';
  END IF;

  SELECT count(*) INTO recent_count_1m
  FROM public.messages m
  WHERE m.user_id = _user_id
    AND m.created_at > now() - interval '1 minute';

  IF recent_count_1m >= 30 THEN
    RAISE EXCEPTION 'Rate limited: minute message quota reached';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.messages m
    WHERE m.user_id = _user_id
      AND m.channel_id = _channel_id
      AND m.content = normalized_content
      AND m.created_at > now() - interval '15 seconds'
  ) THEN
    RAISE EXCEPTION 'Duplicate message blocked';
  END IF;

  -- Get channel settings including slowmode and link blocking
  SELECT server_id, is_read_only, slowmode_seconds, block_links, allowed_link_domains
  INTO channel_server_id, channel_is_read_only, channel_slowmode_seconds, channel_block_links, channel_allowed_domains
  FROM public.channels WHERE id = _channel_id;

  IF channel_server_id IS NULL THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;

  SELECT sm.is_muted, sm.role INTO is_muted, user_role
  FROM public.server_members sm
  WHERE sm.server_id = channel_server_id
    AND sm.user_id = _user_id
    AND sm.is_banned = false;

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

  -- SLOWMODE ENFORCEMENT
  IF channel_slowmode_seconds > 0 THEN
    -- Check if user has manage_messages permission (admins/mods bypass slowmode)
    IF NOT public.check_user_permission(_user_id, _channel_id, 'manage_messages') THEN
      -- Get the timestamp of user's last message in this channel
      SELECT m.created_at INTO last_message_time
      FROM public.messages m
      WHERE m.user_id = _user_id
        AND m.channel_id = _channel_id
      ORDER BY m.created_at DESC
      LIMIT 1;

      IF last_message_time IS NOT NULL THEN
        time_since_last_message := now() - last_message_time;
        
        IF time_since_last_message < make_interval(secs => channel_slowmode_seconds) THEN
          RAISE EXCEPTION 'Slowmode is active. Please wait % seconds before sending another message.', 
            channel_slowmode_seconds - EXTRACT(EPOCH FROM time_since_last_message)::integer;
        END IF;
      END IF;
    END IF;
  END IF;

  -- LINK BLOCKING ENFORCEMENT
  IF channel_block_links = true THEN
    -- Check if content contains URLs (simple regex check)
    has_url := normalized_content ~* 'https?://|www\.|[a-z0-9-]+\.(com|net|org|io|dev|app|gg|me|co|tv|fm|gg|xyz|ai|site|tech|online|store|blog|info|cc|biz)';
    
    IF has_url THEN
      -- Check if user has manage_messages permission (admins can post links)
      can_post_links := public.check_user_permission(_user_id, _channel_id, 'manage_messages');
      
      IF NOT can_post_links THEN
        -- If there's a whitelist, check if any whitelisted domain is in the content
        IF channel_allowed_domains IS NOT NULL AND array_length(channel_allowed_domains, 1) > 0 THEN
          -- Check each allowed domain
          DECLARE
            allowed_domain text;
            domain_found boolean := false;
          BEGIN
            FOREACH allowed_domain IN ARRAY channel_allowed_domains
            LOOP
              IF normalized_content ~* allowed_domain THEN
                domain_found := true;
                EXIT;
              END IF;
            END LOOP;
            
            IF NOT domain_found THEN
              RAISE EXCEPTION 'Links are not allowed in this channel';
            END IF;
          END;
        ELSE
          -- No whitelist, completely block links
          RAISE EXCEPTION 'Links are not allowed in this channel';
        END IF;
      END IF;
    END IF;
  END IF;

  IF _reply_to_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.messages
      WHERE id = _reply_to_id
        AND channel_id = _channel_id
    ) THEN
      RAISE EXCEPTION 'Invalid reply reference.';
    END IF;
  END IF;

  INSERT INTO public.messages (channel_id, user_id, content, reply_to_id)
  VALUES (_channel_id, _user_id, normalized_content, _reply_to_id)
  RETURNING id INTO new_message_id;

  SELECT json_build_object(
    'id', m.id,
    'channel_id', m.channel_id,
    'user_id', m.user_id,
    'content', m.content,
    'reply_to_id', m.reply_to_id,
    'is_pinned', m.is_pinned,
    'edited_at', m.edited_at,
    'created_at', m.created_at
  ) INTO result
  FROM public.messages m
  WHERE m.id = new_message_id;

  RETURN result;
END;
$function$;