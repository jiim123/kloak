-- Phase 2 hardening: restore and secure group DM creation,
-- tighten channel message anti-spam, and add server-creation abuse controls.

-- 1) Ensure sensitive user-action RPCs are authenticated-only.
REVOKE EXECUTE ON FUNCTION public.open_dm_conversation(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.open_dm_conversation(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.send_dm(uuid, uuid, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.send_dm(uuid, uuid, text, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.send_message(uuid, uuid, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.send_message(uuid, uuid, text, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.send_friend_request(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.send_friend_request(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_server_with_owner(text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_server_with_owner(text, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.join_server_by_invite(text, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.join_server_by_invite(text, uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_group_dm(uuid, uuid[], text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_group_dm(uuid, uuid[], text) TO authenticated;

-- 2) Restore + harden create_group_dm (current live version is a stub).
CREATE OR REPLACE FUNCTION public.create_group_dm(
  _creator_id uuid,
  _participant_ids uuid[],
  _name text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  new_conv_id uuid;
  result json;
  normalized_ids uuid[];
  missing_count integer;
  recent_groups_10m integer;
  recent_groups_1d integer;
  creator_created_at timestamptz;
  final_name text;
BEGIN
  IF NOT public.verify_request_identity(_creator_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  -- Normalize participant list: remove nulls, duplicates, and self.
  SELECT COALESCE(array_agg(DISTINCT pid), ARRAY[]::uuid[])
    INTO normalized_ids
  FROM unnest(COALESCE(_participant_ids, ARRAY[]::uuid[])) AS pid
  WHERE pid IS NOT NULL
    AND pid <> _creator_id;

  IF cardinality(normalized_ids) < 2 THEN
    RAISE EXCEPTION 'Groups require at least 2 other participants';
  END IF;

  IF cardinality(normalized_ids) > 25 THEN
    RAISE EXCEPTION 'Group DM participant limit exceeded';
  END IF;

  SELECT u.created_at INTO creator_created_at
  FROM public.users u
  WHERE u.id = _creator_id;

  IF creator_created_at IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF creator_created_at > now() - interval '10 minutes' THEN
    RAISE EXCEPTION 'Group DMs are temporarily restricted for new accounts';
  END IF;

  -- Anti-abuse caps on group creation.
  SELECT count(*) INTO recent_groups_10m
  FROM public.dm_conversations dc
  WHERE dc.created_by = _creator_id
    AND COALESCE(dc.is_group, false) = true
    AND dc.created_at > now() - interval '10 minutes';

  IF recent_groups_10m >= 3 THEN
    RAISE EXCEPTION 'Rate limited: too many new group DMs';
  END IF;

  SELECT count(*) INTO recent_groups_1d
  FROM public.dm_conversations dc
  WHERE dc.created_by = _creator_id
    AND COALESCE(dc.is_group, false) = true
    AND dc.created_at > now() - interval '1 day';

  IF recent_groups_1d >= 10 THEN
    RAISE EXCEPTION 'Rate limited: group DM daily limit reached';
  END IF;

  -- Validate all participants exist.
  SELECT count(*) INTO missing_count
  FROM unnest(normalized_ids) pid
  LEFT JOIN public.users u ON u.id = pid
  WHERE u.id IS NULL;

  IF missing_count > 0 THEN
    RAISE EXCEPTION 'One or more users not found';
  END IF;

  -- Prevent contacting blocked users in bulk.
  IF EXISTS (
    SELECT 1
    FROM unnest(normalized_ids) pid
    JOIN public.friendships f
      ON f.status = 'blocked'
     AND (
       (f.requester_id = _creator_id AND f.addressee_id = pid)
       OR (f.requester_id = pid AND f.addressee_id = _creator_id)
     )
  ) THEN
    RAISE EXCEPTION 'Cannot include blocked users in group DM';
  END IF;

  -- Require some relationship context (friend or shared server) for each added user.
  IF EXISTS (
    SELECT 1
    FROM unnest(normalized_ids) pid
    WHERE NOT public.is_friend_with(_creator_id, pid)
      AND NOT public.shares_server_with(_creator_id, pid)
  ) THEN
    RAISE EXCEPTION 'Cannot create group DM with unrelated users';
  END IF;

  final_name := NULLIF(btrim(COALESCE(_name, '')), '');
  IF final_name IS NOT NULL AND char_length(final_name) > 80 THEN
    RAISE EXCEPTION 'Group DM name too long';
  END IF;

  INSERT INTO public.dm_conversations (is_group, name, created_by)
  VALUES (true, final_name, _creator_id)
  RETURNING id INTO new_conv_id;

  INSERT INTO public.dm_participants (conversation_id, user_id)
  VALUES (new_conv_id, _creator_id);

  INSERT INTO public.dm_participants (conversation_id, user_id)
  SELECT new_conv_id, pid
  FROM unnest(normalized_ids) AS pid;

  SELECT json_build_object(
    'id', dc.id,
    'created_at', dc.created_at,
    'is_group', dc.is_group,
    'name', dc.name,
    'created_by', dc.created_by,
    'participants', (
      SELECT json_agg(
        json_build_object(
          'user_id', dp.user_id,
          'user', json_build_object(
            'id', u.id,
            'username', u.username,
            'display_name', u.display_name,
            'avatar_url', u.avatar_url,
            'status', u.status,
            'last_seen', CASE WHEN u.id = _creator_id THEN u.last_seen ELSE NULL END
          )
        )
      )
      FROM public.dm_participants dp
      JOIN public.users u ON u.id = dp.user_id
      WHERE dp.conversation_id = dc.id
    )
  ) INTO result
  FROM public.dm_conversations dc
  WHERE dc.id = new_conv_id;

  RETURN result;
END;
$function$;

-- 3) Harden send_message against channel spam bursts and duplicates.
CREATE OR REPLACE FUNCTION public.send_message(_channel_id uuid, _user_id uuid, _content text, _reply_to_id uuid DEFAULT NULL::uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  channel_server_id uuid;
  channel_is_read_only boolean;
  is_muted boolean;
  user_role server_role;
  new_message_id uuid;
  result json;
  sender_created_at timestamptz;
  recent_count_10s integer;
  recent_count_1m integer;
  normalized_content text;
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

  SELECT server_id, is_read_only INTO channel_server_id, channel_is_read_only
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

-- 4) Add server creation abuse controls.
CREATE OR REPLACE FUNCTION public.create_server_with_owner(_name text, _owner_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  new_server_id uuid;
  new_invite_code text;
  new_category_id uuid;
  new_channel_id uuid;
  everyone_role_id uuid;
  result jsonb;
  owner_created_at timestamptz;
  recent_servers_10m integer;
  recent_servers_1d integer;
  safe_name text;
BEGIN
  IF NOT public.verify_request_identity(_owner_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  safe_name := btrim(COALESCE(_name, ''));
  IF safe_name = '' THEN
    RAISE EXCEPTION 'Server name cannot be empty';
  END IF;
  IF char_length(safe_name) > 100 THEN
    RAISE EXCEPTION 'Server name is too long';
  END IF;

  SELECT u.created_at INTO owner_created_at
  FROM public.users u
  WHERE u.id = _owner_id;

  IF owner_created_at IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF owner_created_at > now() - interval '10 minutes' THEN
    RAISE EXCEPTION 'Server creation is temporarily restricted for new accounts';
  END IF;

  SELECT count(*) INTO recent_servers_10m
  FROM public.servers s
  WHERE s.owner_id = _owner_id
    AND s.created_at > now() - interval '10 minutes';

  IF recent_servers_10m >= 3 THEN
    RAISE EXCEPTION 'Rate limited: too many servers created recently';
  END IF;

  SELECT count(*) INTO recent_servers_1d
  FROM public.servers s
  WHERE s.owner_id = _owner_id
    AND s.created_at > now() - interval '1 day';

  IF recent_servers_1d >= 10 THEN
    RAISE EXCEPTION 'Rate limited: daily server creation limit reached';
  END IF;

  new_server_id := gen_random_uuid();
  new_category_id := gen_random_uuid();
  new_channel_id := gen_random_uuid();
  everyone_role_id := gen_random_uuid();

  SELECT public.generate_invite_code() INTO new_invite_code;

  INSERT INTO public.servers (id, name, owner_id, invite_code)
  VALUES (new_server_id, safe_name, _owner_id, new_invite_code);

  INSERT INTO public.server_members (server_id, user_id, role)
  VALUES (new_server_id, _owner_id, 'owner');

  INSERT INTO public.channel_categories (id, server_id, name, position)
  VALUES (new_category_id, new_server_id, 'Text Channels', 0);

  INSERT INTO public.channels (id, server_id, category_id, name, type, position)
  VALUES (new_channel_id, new_server_id, new_category_id, 'general', 'text', 0);

  INSERT INTO public.server_roles (id, server_id, name, color, position, created_at)
  VALUES (everyone_role_id, new_server_id, '@everyone', '#99AAB5', 999, now());

  INSERT INTO public.role_permissions (id, server_id, role_id, permission, allowed, created_at)
  SELECT gen_random_uuid(), new_server_id, everyone_role_id, p.perm::permission_type, true, now()
  FROM (
    VALUES
      ('send_messages'), ('add_reactions'), ('view_channels'), ('read_message_history'),
      ('attach_files'), ('embed_links'), ('use_external_emojis'), ('change_nickname'),
      ('create_instant_invite'), ('connect'), ('speak'), ('use_voice_activation'),
      ('use_application_commands'), ('mention_roles')
  ) AS p(perm);

  SELECT jsonb_build_object(
    'id', s.id,
    'name', s.name,
    'owner_id', s.owner_id,
    'invite_code', s.invite_code,
    'icon_url', s.icon_url,
    'banner_url', s.banner_url,
    'is_published', s.is_published,
    'about', s.about,
    'created_at', s.created_at
  ) INTO result
  FROM public.servers s
  WHERE s.id = new_server_id;

  RETURN result;
END;
$function$;

-- 5) Index for channel-level anti-flood checks.
CREATE INDEX IF NOT EXISTS idx_messages_user_channel_created_at
  ON public.messages (user_id, channel_id, created_at DESC);
