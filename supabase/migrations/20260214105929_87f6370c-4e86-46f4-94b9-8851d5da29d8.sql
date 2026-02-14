
-- ============================================================
-- PHASE 1: Critical Security Fixes
-- V1: Hide key_hash, V2: Server-side auth for core RPCs
-- V3: Input validation on update_user_profile
-- ============================================================

-- 1. Auth helper function
CREATE OR REPLACE FUNCTION public.require_auth()
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid;
BEGIN
  uid := public.get_request_user_id();
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  RETURN uid;
END;
$$;

-- 2. users_public view (V1: hide key_hash and last_key_reset_at)
CREATE OR REPLACE VIEW public.users_public AS
SELECT id, username, display_name, avatar_url, banner_url, banner_color,
       bio, status, custom_status, created_at, last_seen,
       avatar_decoration, profile_theme_primary, profile_theme_accent,
       profile_effect, pronouns
FROM public.users;

GRANT SELECT ON public.users_public TO anon, authenticated;

-- 3. update_user_profile - V2 + V3
CREATE OR REPLACE FUNCTION public.update_user_profile(_user_id uuid, _updates json)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE result json; _u jsonb := _updates::jsonb;
BEGIN
  _user_id := public.require_auth();
  IF (_u ? 'display_name') AND char_length(COALESCE(_updates->>'display_name', '')) > 32 THEN
    RAISE EXCEPTION 'Display name must be 32 characters or less';
  END IF;
  IF (_u ? 'bio') AND char_length(COALESCE(_updates->>'bio', '')) > 190 THEN
    RAISE EXCEPTION 'Bio must be 190 characters or less';
  END IF;
  IF (_u ? 'custom_status') AND char_length(COALESCE(_updates->>'custom_status', '')) > 128 THEN
    RAISE EXCEPTION 'Custom status must be 128 characters or less';
  END IF;
  UPDATE users SET
    display_name = CASE WHEN (_u ? 'display_name') THEN (_updates->>'display_name') ELSE display_name END,
    bio = CASE WHEN (_u ? 'bio') THEN (_updates->>'bio') ELSE bio END,
    avatar_url = CASE WHEN (_u ? 'avatar_url') THEN (_updates->>'avatar_url') ELSE avatar_url END,
    banner_url = CASE WHEN (_u ? 'banner_url') THEN (_updates->>'banner_url') ELSE banner_url END,
    avatar_decoration = CASE WHEN (_u ? 'avatar_decoration') THEN (_updates->>'avatar_decoration') ELSE avatar_decoration END,
    profile_effect = CASE WHEN (_u ? 'profile_effect') THEN (_updates->>'profile_effect') ELSE profile_effect END,
    banner_color = COALESCE(_updates->>'banner_color', banner_color),
    profile_theme_primary = CASE WHEN (_u ? 'profile_theme_primary') THEN (_updates->>'profile_theme_primary') ELSE profile_theme_primary END,
    profile_theme_accent = CASE WHEN (_u ? 'profile_theme_accent') THEN (_updates->>'profile_theme_accent') ELSE profile_theme_accent END,
    custom_status = CASE WHEN (_u ? 'custom_status') THEN (_updates->>'custom_status') ELSE custom_status END
  WHERE id = _user_id;
  SELECT json_build_object(
    'id', u.id, 'username', u.username, 'display_name', u.display_name,
    'avatar_url', u.avatar_url, 'banner_url', u.banner_url,
    'avatar_decoration', u.avatar_decoration, 'profile_effect', u.profile_effect,
    'banner_color', u.banner_color, 'profile_theme_primary', u.profile_theme_primary,
    'profile_theme_accent', u.profile_theme_accent,
    'bio', u.bio, 'status', u.status, 'custom_status', u.custom_status,
    'created_at', u.created_at, 'last_seen', u.last_seen
  ) INTO result FROM users u WHERE u.id = _user_id;
  RETURN result;
END;
$function$;

-- 4. update_user_status
CREATE OR REPLACE FUNCTION public.update_user_status(_user_id uuid, _status user_status)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  _user_id := public.require_auth();
  IF _status = 'offline' THEN
    UPDATE users SET status = _status, last_seen = now() - interval '10 minutes' WHERE id = _user_id;
  ELSE
    UPDATE users SET status = _status, last_seen = now() WHERE id = _user_id;
  END IF;
  RETURN true;
END;
$function$;

-- 5. send_message
CREATE OR REPLACE FUNCTION public.send_message(_channel_id uuid, _user_id uuid, _content text, _reply_to_id uuid DEFAULT NULL::uuid)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE channel_server_id uuid; is_muted boolean; new_message_id uuid; result json;
BEGIN
  _user_id := public.require_auth();
  IF _content IS NULL OR trim(_content) = '' THEN RAISE EXCEPTION 'Message cannot be empty'; END IF;
  IF char_length(_content) > 2000 THEN RAISE EXCEPTION 'Message must be 2000 characters or less'; END IF;
  SELECT server_id INTO channel_server_id FROM channels WHERE id = _channel_id;
  SELECT sm.is_muted INTO is_muted FROM server_members sm
  WHERE sm.server_id = channel_server_id AND sm.user_id = _user_id AND sm.is_banned = false;
  IF is_muted IS NULL THEN RAISE EXCEPTION 'Not a member of this server'; END IF;
  IF is_muted THEN RAISE EXCEPTION 'You are muted in this server'; END IF;
  INSERT INTO messages (channel_id, user_id, content, reply_to_id)
  VALUES (_channel_id, _user_id, _content, _reply_to_id) RETURNING id INTO new_message_id;
  SELECT json_build_object('id', m.id, 'channel_id', m.channel_id, 'user_id', m.user_id,
    'content', m.content, 'reply_to_id', m.reply_to_id, 'is_pinned', m.is_pinned,
    'edited_at', m.edited_at, 'created_at', m.created_at
  ) INTO result FROM messages m WHERE m.id = new_message_id;
  RETURN result;
END;
$function$;

-- 6. edit_message
CREATE OR REPLACE FUNCTION public.edit_message(_message_id uuid, _user_id uuid, _content text)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE result json; msg_channel_id uuid;
BEGIN
  _user_id := public.require_auth();
  IF _content IS NULL OR trim(_content) = '' THEN RAISE EXCEPTION 'Message cannot be empty'; END IF;
  IF char_length(_content) > 2000 THEN RAISE EXCEPTION 'Message must be 2000 characters or less'; END IF;
  IF NOT EXISTS (SELECT 1 FROM messages WHERE id = _message_id AND user_id = _user_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  SELECT m.channel_id INTO msg_channel_id FROM messages m WHERE m.id = _message_id;
  IF NOT public.check_user_permission(_user_id, msg_channel_id, 'send_messages') THEN
    RAISE EXCEPTION 'You do not have permission to send messages in this channel';
  END IF;
  UPDATE messages SET content = _content, edited_at = now() WHERE id = _message_id;
  SELECT json_build_object('id', m.id, 'channel_id', m.channel_id, 'user_id', m.user_id,
    'content', m.content, 'reply_to_id', m.reply_to_id, 'is_pinned', m.is_pinned,
    'edited_at', m.edited_at, 'created_at', m.created_at
  ) INTO result FROM messages m WHERE m.id = _message_id;
  RETURN result;
END;
$function$;

-- 7. delete_message
CREATE OR REPLACE FUNCTION public.delete_message(_message_id uuid, _user_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _msg_user_id uuid; _channel_id uuid; _server_id uuid;
BEGIN
  _user_id := public.require_auth();
  SELECT user_id, channel_id INTO _msg_user_id, _channel_id FROM messages WHERE id = _message_id;
  IF _msg_user_id IS NULL THEN RAISE EXCEPTION 'Message not found'; END IF;
  IF _msg_user_id = _user_id THEN DELETE FROM messages WHERE id = _message_id; RETURN; END IF;
  SELECT server_id INTO _server_id FROM channels WHERE id = _channel_id;
  IF EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    DELETE FROM messages WHERE id = _message_id; RETURN;
  END IF;
  IF public.check_user_permission(_user_id, _channel_id, 'manage_messages'::permission_type) THEN
    DELETE FROM messages WHERE id = _message_id; RETURN;
  END IF;
  RAISE EXCEPTION 'You do not have permission to delete this message';
END;
$function$;

-- 8. send_dm
CREATE OR REPLACE FUNCTION public.send_dm(_conversation_id uuid, _sender_id uuid, _content text, _reply_to_id uuid DEFAULT NULL::uuid)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE new_message_id uuid; other_user_id uuid; result json;
BEGIN
  _sender_id := public.require_auth();
  IF _content IS NULL OR trim(_content) = '' THEN RAISE EXCEPTION 'Message cannot be empty'; END IF;
  IF char_length(_content) > 2000 THEN RAISE EXCEPTION 'Message must be 2000 characters or less'; END IF;
  IF NOT EXISTS (SELECT 1 FROM dm_participants WHERE conversation_id = _conversation_id AND user_id = _sender_id) THEN
    RAISE EXCEPTION 'Not a participant in this conversation';
  END IF;
  SELECT dp.user_id INTO other_user_id FROM dm_participants dp
  WHERE dp.conversation_id = _conversation_id AND dp.user_id <> _sender_id LIMIT 1;
  IF other_user_id IS NULL THEN RAISE EXCEPTION 'Conversation has no recipient'; END IF;
  IF EXISTS (SELECT 1 FROM friendships f WHERE f.status = 'blocked'
    AND ((f.requester_id = _sender_id AND f.addressee_id = other_user_id)
      OR (f.requester_id = other_user_id AND f.addressee_id = _sender_id))) THEN
    RAISE EXCEPTION 'Cannot send DM to this user';
  END IF;
  INSERT INTO direct_messages (conversation_id, sender_id, content, reply_to_id)
  VALUES (_conversation_id, _sender_id, _content, _reply_to_id) RETURNING id INTO new_message_id;
  SELECT json_build_object('id', dm.id, 'conversation_id', dm.conversation_id, 'sender_id', dm.sender_id,
    'content', dm.content, 'reply_to_id', dm.reply_to_id, 'created_at', dm.created_at, 'edited_at', dm.edited_at
  ) INTO result FROM direct_messages dm WHERE dm.id = new_message_id;
  RETURN result;
END;
$function$;

-- 9. edit_dm
CREATE OR REPLACE FUNCTION public.edit_dm(_message_id uuid, _sender_id uuid, _content text)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE result json;
BEGIN
  _sender_id := public.require_auth();
  IF _content IS NULL OR trim(_content) = '' THEN RAISE EXCEPTION 'Message cannot be empty'; END IF;
  IF char_length(_content) > 2000 THEN RAISE EXCEPTION 'Message must be 2000 characters or less'; END IF;
  IF NOT EXISTS (SELECT 1 FROM direct_messages WHERE id = _message_id AND sender_id = _sender_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  UPDATE direct_messages SET content = _content, edited_at = now() WHERE id = _message_id;
  SELECT json_build_object('id', dm.id, 'conversation_id', dm.conversation_id, 'sender_id', dm.sender_id,
    'content', dm.content, 'reply_to_id', dm.reply_to_id, 'created_at', dm.created_at, 'edited_at', dm.edited_at
  ) INTO result FROM direct_messages dm WHERE dm.id = _message_id;
  RETURN result;
END;
$function$;

-- 10. delete_dm
CREATE OR REPLACE FUNCTION public.delete_dm(_message_id uuid, _sender_id uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  _sender_id := public.require_auth();
  IF NOT EXISTS (SELECT 1 FROM direct_messages WHERE id = _message_id AND sender_id = _sender_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  DELETE FROM direct_messages WHERE id = _message_id;
  RETURN true;
END;
$function$;

-- 11. get_dm_messages
CREATE OR REPLACE FUNCTION public.get_dm_messages(_conversation_id uuid, _user_id uuid, _limit integer DEFAULT 50, _before_id uuid DEFAULT NULL::uuid)
 RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  _user_id := public.require_auth();
  IF NOT EXISTS (SELECT 1 FROM dm_participants WHERE conversation_id = _conversation_id AND user_id = _user_id) THEN
    RAISE EXCEPTION 'Not a participant in this conversation';
  END IF;
  RETURN (
    SELECT json_agg(msg ORDER BY created_at DESC) FROM (
      SELECT json_build_object(
        'id', dm.id, 'conversation_id', dm.conversation_id, 'sender_id', dm.sender_id,
        'content', dm.content, 'reply_to_id', dm.reply_to_id, 'edited_at', dm.edited_at,
        'created_at', dm.created_at,
        'sender', json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name,
          'avatar_url', u.avatar_url, 'banner_color', u.banner_color, 'status', u.status)
      ) as msg, dm.created_at
      FROM direct_messages dm JOIN users u ON u.id = dm.sender_id
      WHERE dm.conversation_id = _conversation_id
        AND (_before_id IS NULL OR dm.created_at < (SELECT created_at FROM direct_messages WHERE id = _before_id))
        AND NOT EXISTS (SELECT 1 FROM friendships f WHERE f.status = 'blocked'
          AND ((f.requester_id = _user_id AND f.addressee_id = dm.sender_id)
            OR (f.requester_id = dm.sender_id AND f.addressee_id = _user_id)))
      ORDER BY dm.created_at DESC LIMIT _limit
    ) sub
  );
END;
$function$;

-- 12. open_dm_conversation
CREATE OR REPLACE FUNCTION public.open_dm_conversation(_user_id uuid, _other_user_id uuid)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE existing_conversation_id uuid; new_conversation_id uuid; result json;
BEGIN
  _user_id := public.require_auth();
  SELECT dp1.conversation_id INTO existing_conversation_id
  FROM dm_participants dp1 JOIN dm_participants dp2 ON dp1.conversation_id = dp2.conversation_id
  WHERE dp1.user_id = _user_id AND dp2.user_id = _other_user_id;
  IF existing_conversation_id IS NOT NULL THEN
    SELECT json_build_object('id', dc.id, 'created_at', dc.created_at) INTO result FROM dm_conversations dc WHERE dc.id = existing_conversation_id;
    RETURN result;
  END IF;
  IF EXISTS (SELECT 1 FROM friendships f WHERE f.status = 'blocked'
    AND ((f.requester_id = _user_id AND f.addressee_id = _other_user_id) OR (f.requester_id = _other_user_id AND f.addressee_id = _user_id))
  ) THEN RAISE EXCEPTION 'Cannot message this user'; END IF;
  INSERT INTO dm_conversations DEFAULT VALUES RETURNING id INTO new_conversation_id;
  INSERT INTO dm_participants (conversation_id, user_id) VALUES (new_conversation_id, _user_id), (new_conversation_id, _other_user_id);
  SELECT json_build_object('id', dc.id, 'created_at', dc.created_at) INTO result FROM dm_conversations dc WHERE dc.id = new_conversation_id;
  RETURN result;
END;
$function$;

-- 13. create_server_with_owner
CREATE OR REPLACE FUNCTION public.create_server_with_owner(_name text, _owner_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE new_server_id uuid; new_invite_code text; new_category_id uuid; new_channel_id uuid; everyone_role_id uuid; result jsonb;
BEGIN
  _owner_id := public.require_auth();
  new_server_id := gen_random_uuid(); new_category_id := gen_random_uuid(); new_channel_id := gen_random_uuid(); everyone_role_id := gen_random_uuid();
  SELECT generate_invite_code() INTO new_invite_code;
  INSERT INTO servers (id, name, owner_id, invite_code) VALUES (new_server_id, _name, _owner_id, new_invite_code);
  INSERT INTO server_members (server_id, user_id, role) VALUES (new_server_id, _owner_id, 'owner');
  INSERT INTO channel_categories (id, server_id, name, position) VALUES (new_category_id, new_server_id, 'Text Channels', 0);
  INSERT INTO channels (id, server_id, category_id, name, type, position) VALUES (new_channel_id, new_server_id, new_category_id, 'general', 'text', 0);
  INSERT INTO server_roles (id, server_id, name, color, position, created_at) VALUES (everyone_role_id, new_server_id, '@everyone', '#99AAB5', 999, NOW());
  INSERT INTO role_permissions (id, server_id, role_id, permission, allowed, created_at)
  SELECT gen_random_uuid(), new_server_id, everyone_role_id, p.perm::permission_type, true, NOW()
  FROM (VALUES ('send_messages'), ('add_reactions'), ('view_channels'), ('read_message_history'),
    ('attach_files'), ('embed_links'), ('use_external_emojis'), ('change_nickname'),
    ('create_instant_invite'), ('connect'), ('speak'), ('use_voice_activation'),
    ('use_application_commands'), ('mention_roles')) AS p(perm);
  SELECT jsonb_build_object('id', s.id, 'name', s.name, 'owner_id', s.owner_id, 'invite_code', s.invite_code,
    'icon_url', s.icon_url, 'banner_url', s.banner_url, 'is_published', s.is_published, 'about', s.about, 'created_at', s.created_at
  ) INTO result FROM servers s WHERE s.id = new_server_id;
  RETURN result;
END;
$function$;

-- 14. join_server_by_invite (2-arg version)
CREATE OR REPLACE FUNCTION public.join_server_by_invite(_invite_code text, _user_id uuid)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE target_server_id uuid; existing_member record; result json; clean_code text;
  system_channel_id uuid; enable_join boolean; join_message_content text;
  invite_row_id uuid; invite_max_uses integer; invite_uses_count integer;
  invite_expires_at timestamptz; message_id uuid; message_inserted boolean := false; insert_error text;
BEGIN
  _user_id := public.require_auth();
  clean_code := upper(trim(_invite_code));
  SELECT id, system_channel_join_id, enable_join_messages INTO target_server_id, system_channel_id, enable_join FROM servers WHERE trim(invite_code::text) = clean_code;
  IF target_server_id IS NULL THEN
    SELECT si.id, si.server_id, si.max_uses, si.uses_count, si.expires_at INTO invite_row_id, target_server_id, invite_max_uses, invite_uses_count, invite_expires_at
    FROM public.server_invites si WHERE si.revoked_at IS NULL AND trim(si.code::text) = clean_code FOR UPDATE LIMIT 1;
    IF invite_row_id IS NOT NULL THEN
      IF invite_expires_at IS NOT NULL AND invite_expires_at <= now() THEN RAISE EXCEPTION 'Invalid invite code'; END IF;
      IF invite_max_uses IS NOT NULL AND invite_uses_count >= invite_max_uses THEN RAISE EXCEPTION 'Invalid invite code'; END IF;
      SELECT system_channel_join_id, enable_join_messages INTO system_channel_id, enable_join FROM servers WHERE id = target_server_id;
    END IF;
  END IF;
  IF target_server_id IS NULL THEN RAISE EXCEPTION 'Invalid invite code'; END IF;
  SELECT * INTO existing_member FROM server_members WHERE server_id = target_server_id AND user_id = _user_id;
  IF existing_member IS NOT NULL THEN
    IF existing_member.is_banned = true THEN RAISE EXCEPTION 'You are banned from this server'; END IF;
    SELECT json_build_object('id', s.id, 'name', s.name, 'owner_id', s.owner_id, 'invite_code', trim(s.invite_code::text), 'icon_url', s.icon_url, 'banner_url', s.banner_url, 'created_at', s.created_at, 'already_member', true) INTO result FROM servers s WHERE s.id = target_server_id;
    RETURN result;
  END IF;
  INSERT INTO server_members (server_id, user_id, role, is_banned) VALUES (target_server_id, _user_id, 'member', false) ON CONFLICT (server_id, user_id) DO NOTHING;
  IF invite_row_id IS NOT NULL THEN UPDATE public.server_invites SET uses_count = uses_count + 1 WHERE id = invite_row_id; END IF;
  IF system_channel_id IS NOT NULL AND enable_join THEN
    BEGIN
      join_message_content := format('<@%s> joined', _user_id);
      INSERT INTO messages (channel_id, user_id, content, is_system_message) VALUES (system_channel_id, _user_id, join_message_content, TRUE) RETURNING id INTO message_id;
      message_inserted := true;
    EXCEPTION WHEN OTHERS THEN insert_error := SQLERRM; message_inserted := false; RAISE WARNING 'Failed to insert join message: %', SQLERRM;
    END;
  END IF;
  SELECT json_build_object('id', s.id, 'name', s.name, 'owner_id', s.owner_id, 'invite_code', trim(s.invite_code::text), 'icon_url', s.icon_url, 'banner_url', s.banner_url, 'created_at', s.created_at, 'already_member', false) INTO result FROM servers s WHERE s.id = target_server_id;
  RETURN result;
END;
$function$;

-- 15. join_server_by_invite (3-arg version)
CREATE OR REPLACE FUNCTION public.join_server_by_invite(_invite_code text, _user_id uuid, _join_source text DEFAULT 'invite_link'::text)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE target_server_id uuid; existing_member record; result json; clean_code text;
  system_channel_id uuid; enable_join boolean; join_message_content text;
  invite_row_id uuid; invite_max_uses integer; invite_uses_count integer;
  invite_expires_at timestamptz; message_id uuid; message_inserted boolean := false; insert_error text;
BEGIN
  _user_id := public.require_auth();
  clean_code := upper(trim(_invite_code));
  SELECT id, system_channel_join_id, enable_join_messages INTO target_server_id, system_channel_id, enable_join FROM servers WHERE trim(invite_code::text) = clean_code;
  IF target_server_id IS NULL THEN
    SELECT si.id, si.server_id, si.max_uses, si.uses_count, si.expires_at INTO invite_row_id, target_server_id, invite_max_uses, invite_uses_count, invite_expires_at
    FROM public.server_invites si WHERE si.revoked_at IS NULL AND trim(si.code::text) = clean_code FOR UPDATE LIMIT 1;
    IF invite_row_id IS NOT NULL THEN
      IF invite_expires_at IS NOT NULL AND invite_expires_at <= now() THEN RAISE EXCEPTION 'Invalid invite code'; END IF;
      IF invite_max_uses IS NOT NULL AND invite_uses_count >= invite_max_uses THEN RAISE EXCEPTION 'Invalid invite code'; END IF;
      SELECT system_channel_join_id, enable_join_messages INTO system_channel_id, enable_join FROM servers WHERE id = target_server_id;
    END IF;
  END IF;
  IF target_server_id IS NULL THEN RAISE EXCEPTION 'Invalid invite code'; END IF;
  SELECT * INTO existing_member FROM server_members WHERE server_id = target_server_id AND user_id = _user_id;
  IF existing_member IS NOT NULL THEN
    IF existing_member.is_banned = true THEN RAISE EXCEPTION 'You are banned from this server'; END IF;
    SELECT json_build_object('id', s.id, 'name', s.name, 'owner_id', s.owner_id, 'invite_code', trim(s.invite_code::text), 'icon_url', s.icon_url, 'banner_url', s.banner_url, 'created_at', s.created_at, 'already_member', true) INTO result FROM servers s WHERE s.id = target_server_id;
    RETURN result;
  END IF;
  INSERT INTO server_members (server_id, user_id, role, is_banned, join_source, join_invite_code) VALUES (target_server_id, _user_id, 'member', false, _join_source, clean_code) ON CONFLICT (server_id, user_id) DO NOTHING;
  IF invite_row_id IS NOT NULL THEN UPDATE public.server_invites SET uses_count = uses_count + 1 WHERE id = invite_row_id; END IF;
  IF system_channel_id IS NOT NULL AND enable_join THEN
    BEGIN
      join_message_content := format('<@%s> joined', _user_id);
      INSERT INTO messages (channel_id, user_id, content, is_system_message) VALUES (system_channel_id, _user_id, join_message_content, TRUE) RETURNING id INTO message_id;
      message_inserted := true;
    EXCEPTION WHEN OTHERS THEN insert_error := SQLERRM; message_inserted := false; RAISE WARNING 'Failed to insert join message: %', SQLERRM;
    END;
  END IF;
  SELECT json_build_object('id', s.id, 'name', s.name, 'owner_id', s.owner_id, 'invite_code', trim(s.invite_code::text), 'icon_url', s.icon_url, 'banner_url', s.banner_url, 'created_at', s.created_at, 'already_member', false) INTO result FROM servers s WHERE s.id = target_server_id;
  RETURN result;
END;
$function$;

-- 16. leave_server
CREATE OR REPLACE FUNCTION public.leave_server(_user_id uuid, _server_id uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE user_role text; system_channel_id uuid; enable_leave boolean; leave_message_content text; message_id uuid;
BEGIN
  _user_id := public.require_auth();
  SELECT role INTO user_role FROM server_members WHERE server_id = _server_id AND user_id = _user_id AND is_banned = false;
  IF user_role IS NULL THEN RAISE EXCEPTION 'Not a member of this server'; END IF;
  IF user_role = 'owner' THEN RAISE EXCEPTION 'Server owner cannot leave. Transfer ownership first or delete the server.'; END IF;
  SELECT system_channel_leave_id, enable_leave_messages INTO system_channel_id, enable_leave FROM servers WHERE id = _server_id;
  DELETE FROM server_members WHERE server_id = _server_id AND user_id = _user_id;
  IF system_channel_id IS NOT NULL THEN
    BEGIN
      leave_message_content := format('<@%s> left', _user_id);
      INSERT INTO messages (channel_id, user_id, content, is_system_message) VALUES (system_channel_id, _user_id, leave_message_content, TRUE) RETURNING id INTO message_id;
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Failed to post leave message: %', SQLERRM;
    END;
  END IF;
  RETURN true;
END;
$function$;

-- 17. kick_member
CREATE OR REPLACE FUNCTION public.kick_member(_server_id uuid, _user_id uuid, _target_user_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  _user_id := public.require_auth();
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT EXISTS (SELECT 1 FROM role_permissions rp JOIN server_member_roles smr ON smr.role_id = rp.role_id JOIN server_members sm ON sm.id = smr.member_id
      WHERE sm.user_id = _user_id AND rp.server_id = _server_id AND rp.permission = 'kick_members' AND rp.allowed = true
    ) THEN RAISE EXCEPTION 'You do not have permission to kick members'; END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _target_user_id) THEN RAISE EXCEPTION 'Cannot kick the server owner'; END IF;
  DELETE FROM server_member_roles WHERE member_id IN (SELECT id FROM server_members WHERE server_id = _server_id AND user_id = _target_user_id);
  DELETE FROM server_members WHERE server_id = _server_id AND user_id = _target_user_id;
END;
$function$;

-- 18. ban_member
CREATE OR REPLACE FUNCTION public.ban_member(_server_id uuid, _user_id uuid, _target_user_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  _user_id := public.require_auth();
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT EXISTS (SELECT 1 FROM role_permissions rp JOIN server_member_roles smr ON smr.role_id = rp.role_id JOIN server_members sm ON sm.id = smr.member_id
      WHERE sm.user_id = _user_id AND rp.server_id = _server_id AND rp.permission = 'ban_members' AND rp.allowed = true
    ) THEN RAISE EXCEPTION 'You do not have permission to ban members'; END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _target_user_id) THEN RAISE EXCEPTION 'Cannot ban the server owner'; END IF;
  UPDATE server_members SET is_banned = true WHERE server_id = _server_id AND user_id = _target_user_id;
END;
$function$;

-- 19. unban_member
CREATE OR REPLACE FUNCTION public.unban_member(_server_id uuid, _user_id uuid, _target_user_id uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  _user_id := public.require_auth();
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'ban_members') THEN RAISE EXCEPTION 'Permission denied'; END IF;
  DELETE FROM server_members WHERE server_id = _server_id AND user_id = _target_user_id AND is_banned = true;
  RETURN true;
END;
$function$;

-- 20. update_server (jsonb version)
CREATE OR REPLACE FUNCTION public.update_server(_server_id uuid, _user_id uuid, _updates jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  _user_id := public.require_auth();
  IF NOT EXISTS (SELECT 1 FROM server_members WHERE server_id = _server_id AND user_id = _user_id AND role IN ('owner', 'admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE servers SET
    name = CASE WHEN _updates ? 'name' THEN _updates->>'name' ELSE name END,
    icon_url = CASE WHEN _updates ? 'icon_url' THEN _updates->>'icon_url' ELSE icon_url END,
    banner_url = CASE WHEN _updates ? 'banner_url' THEN _updates->>'banner_url' ELSE banner_url END,
    about = CASE WHEN _updates ? 'about' THEN _updates->>'about' ELSE about END,
    is_published = CASE WHEN _updates ? 'is_published' THEN (_updates->>'is_published')::boolean ELSE is_published END,
    enable_join_messages = CASE WHEN _updates ? 'enable_join_messages' THEN (_updates->>'enable_join_messages')::boolean ELSE enable_join_messages END,
    enable_leave_messages = CASE WHEN _updates ? 'enable_leave_messages' THEN (_updates->>'enable_leave_messages')::boolean ELSE enable_leave_messages END,
    system_channel_join_id = CASE WHEN _updates ? 'system_channel_join_id' THEN (_updates->>'system_channel_join_id')::uuid ELSE system_channel_join_id END,
    system_channel_leave_id = CASE WHEN _updates ? 'system_channel_leave_id' THEN (_updates->>'system_channel_leave_id')::uuid ELSE system_channel_leave_id END
  WHERE id = _server_id;
END;
$function$;

-- 21. delete_server
CREATE OR REPLACE FUNCTION public.delete_server(_server_id uuid, _user_id uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  _user_id := public.require_auth();
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_server') THEN RAISE EXCEPTION 'Permission denied'; END IF;
  DELETE FROM messages WHERE channel_id IN (SELECT id FROM channels WHERE server_id = _server_id);
  DELETE FROM channels WHERE server_id = _server_id;
  DELETE FROM channel_categories WHERE server_id = _server_id;
  DELETE FROM server_members WHERE server_id = _server_id;
  DELETE FROM servers WHERE id = _server_id;
  RETURN true;
END;
$function$;

-- 22. send_friend_request
CREATE OR REPLACE FUNCTION public.send_friend_request(_requester_id uuid, _addressee_username text)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _addressee_id uuid; _existing_friendship record; _declined_request record; _new_friendship record;
  _cooldown_minutes int := 5; _time_since_decline interval; _remaining_minutes int;
BEGIN
  _requester_id := public.require_auth();
  SELECT id INTO _addressee_id FROM users WHERE lower(username) = lower(_addressee_username);
  IF _addressee_id IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;
  IF _addressee_id = _requester_id THEN RAISE EXCEPTION 'Cannot send friend request to yourself'; END IF;
  SELECT * INTO _existing_friendship FROM friendships
  WHERE (requester_id = _requester_id AND addressee_id = _addressee_id) OR (requester_id = _addressee_id AND addressee_id = _requester_id);
  IF _existing_friendship IS NOT NULL THEN
    IF _existing_friendship.status = 'accepted' THEN RAISE EXCEPTION 'Already friends with this user'; END IF;
    IF _existing_friendship.status = 'blocked' THEN RAISE EXCEPTION 'Cannot send friend request'; END IF;
    IF _existing_friendship.status = 'pending' THEN
      IF _existing_friendship.requester_id = _requester_id THEN RAISE EXCEPTION 'Friend request already pending';
      ELSE
        UPDATE friendships SET status = 'accepted' WHERE id = _existing_friendship.id RETURNING * INTO _existing_friendship;
        RETURN json_build_object('id', _existing_friendship.id, 'status', 'accepted');
      END IF;
    END IF;
  END IF;
  SELECT * INTO _declined_request FROM declined_friend_requests WHERE requester_id = _requester_id AND addressee_id = _addressee_id;
  IF _declined_request IS NOT NULL THEN
    _time_since_decline := now() - _declined_request.declined_at;
    IF _time_since_decline < (_cooldown_minutes || ' minutes')::interval THEN
      _remaining_minutes := ceil(extract(epoch from ((_cooldown_minutes || ' minutes')::interval - _time_since_decline)) / 60);
      RAISE EXCEPTION 'You can send another request in % minute(s)', _remaining_minutes;
    END IF;
    DELETE FROM declined_friend_requests WHERE requester_id = _requester_id AND addressee_id = _addressee_id;
  END IF;
  INSERT INTO friendships (requester_id, addressee_id, status, created_at) VALUES (_requester_id, _addressee_id, 'pending', now()) RETURNING * INTO _new_friendship;
  PERFORM create_notification(_user_id := _addressee_id, _type := 'friend_request', _title := 'New Friend Request',
    _body := (SELECT username FROM users WHERE id = _requester_id) || ' sent you a friend request', _link := '/app');
  RETURN json_build_object('id', _new_friendship.id, 'status', 'pending');
END;
$function$;

-- 23. accept_friend_request
CREATE OR REPLACE FUNCTION public.accept_friend_request(_user_id uuid, _friendship_id uuid)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE result json;
BEGIN
  _user_id := public.require_auth();
  IF NOT EXISTS (SELECT 1 FROM friendships WHERE id = _friendship_id AND addressee_id = _user_id AND status = 'pending') THEN
    RAISE EXCEPTION 'Cannot accept this friend request';
  END IF;
  UPDATE friendships SET status = 'accepted' WHERE id = _friendship_id;
  SELECT json_build_object('id', f.id, 'requester_id', f.requester_id, 'addressee_id', f.addressee_id, 'status', f.status, 'created_at', f.created_at) INTO result FROM friendships f WHERE f.id = _friendship_id;
  RETURN result;
END;
$function$;

-- 24. decline_friend_request
CREATE OR REPLACE FUNCTION public.decline_friend_request(_user_id uuid, _friendship_id uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _friendship record;
BEGIN
  _user_id := public.require_auth();
  SELECT * INTO _friendship FROM friendships WHERE id = _friendship_id;
  IF _friendship IS NULL THEN RAISE EXCEPTION 'Friendship not found'; END IF;
  IF _friendship.addressee_id != _user_id THEN RAISE EXCEPTION 'You can only decline requests sent to you'; END IF;
  IF _friendship.status != 'pending' THEN RAISE EXCEPTION 'Can only decline pending requests'; END IF;
  INSERT INTO declined_friend_requests (requester_id, addressee_id, declined_at) VALUES (_friendship.requester_id, _friendship.addressee_id, now()) ON CONFLICT (requester_id, addressee_id) DO UPDATE SET declined_at = now();
  DELETE FROM friendships WHERE id = _friendship_id;
  RETURN true;
END;
$function$;

-- 25. remove_friend
CREATE OR REPLACE FUNCTION public.remove_friend(_user_id uuid, _friendship_id uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  _user_id := public.require_auth();
  DELETE FROM friendships WHERE id = _friendship_id AND (requester_id = _user_id OR addressee_id = _user_id) AND status = 'accepted';
  RETURN FOUND;
END;
$function$;

-- 26. block_user
CREATE OR REPLACE FUNCTION public.block_user(_user_id uuid, _blocked_user_id uuid)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE existing_friendship record; result json;
BEGIN
  _user_id := public.require_auth();
  IF _user_id = _blocked_user_id THEN RAISE EXCEPTION 'Cannot block yourself'; END IF;
  SELECT * INTO existing_friendship FROM friendships
  WHERE (requester_id = _user_id AND addressee_id = _blocked_user_id) OR (requester_id = _blocked_user_id AND addressee_id = _user_id);
  IF existing_friendship IS NOT NULL THEN
    UPDATE friendships SET status = 'blocked', requester_id = _user_id, addressee_id = _blocked_user_id WHERE id = existing_friendship.id;
    SELECT json_build_object('id', f.id, 'requester_id', f.requester_id, 'addressee_id', f.addressee_id, 'status', f.status, 'created_at', f.created_at) INTO result FROM friendships f WHERE f.id = existing_friendship.id;
  ELSE
    INSERT INTO friendships (requester_id, addressee_id, status) VALUES (_user_id, _blocked_user_id, 'blocked')
    RETURNING json_build_object('id', id, 'requester_id', requester_id, 'addressee_id', addressee_id, 'status', status, 'created_at', created_at) INTO result;
  END IF;
  RETURN result;
END;
$function$;

-- 27. unblock_user
CREATE OR REPLACE FUNCTION public.unblock_user(_user_id uuid, _blocked_user_id uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  _user_id := public.require_auth();
  DELETE FROM friendships WHERE requester_id = _user_id AND addressee_id = _blocked_user_id AND status = 'blocked';
  RETURN true;
END;
$function$;

-- 28. add_reaction
CREATE OR REPLACE FUNCTION public.add_reaction(_message_id uuid, _user_id uuid, _emoji text)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE channel_id uuid; channel_server_id uuid; new_reaction_id uuid; result json;
BEGIN
  _user_id := public.require_auth();
  SELECT m.channel_id, c.server_id INTO channel_id, channel_server_id FROM messages m JOIN channels c ON c.id = m.channel_id WHERE m.id = _message_id;
  IF channel_id IS NULL THEN RAISE EXCEPTION 'Message not found'; END IF;
  IF NOT public.check_user_permission(_user_id, channel_id, 'add_reactions') THEN RAISE EXCEPTION 'You do not have permission to add reactions in this channel'; END IF;
  IF EXISTS (SELECT 1 FROM reactions WHERE message_id = _message_id AND user_id = _user_id AND emoji = _emoji) THEN
    SELECT json_build_object('id', r.id, 'message_id', r.message_id, 'user_id', r.user_id, 'emoji', r.emoji) INTO result FROM reactions r WHERE r.message_id = _message_id AND r.user_id = _user_id AND r.emoji = _emoji LIMIT 1;
    RETURN result;
  END IF;
  INSERT INTO reactions (message_id, user_id, emoji) VALUES (_message_id, _user_id, _emoji) RETURNING id INTO new_reaction_id;
  SELECT json_build_object('id', r.id, 'message_id', r.message_id, 'user_id', r.user_id, 'emoji', r.emoji) INTO result FROM reactions r WHERE r.id = new_reaction_id;
  RETURN result;
END;
$function$;

-- 29. remove_reaction
CREATE OR REPLACE FUNCTION public.remove_reaction(_message_id uuid, _user_id uuid, _emoji text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE channel_id uuid;
BEGIN
  _user_id := public.require_auth();
  SELECT m.channel_id INTO channel_id FROM messages m WHERE m.id = _message_id;
  IF channel_id IS NULL THEN RAISE EXCEPTION 'Message not found'; END IF;
  IF NOT public.check_user_permission(_user_id, channel_id, 'add_reactions') THEN RAISE EXCEPTION 'You do not have permission to remove reactions in this channel'; END IF;
  DELETE FROM reactions WHERE message_id = _message_id AND user_id = _user_id AND emoji = _emoji;
  RETURN true;
END;
$function$;

-- 30. add_dm_reaction
CREATE OR REPLACE FUNCTION public.add_dm_reaction(_message_id uuid, _user_id uuid, _emoji text)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE msg_conversation_id uuid; new_reaction_id uuid; result json;
BEGIN
  _user_id := public.require_auth();
  SELECT conversation_id INTO msg_conversation_id FROM direct_messages WHERE id = _message_id;
  IF NOT EXISTS (SELECT 1 FROM dm_participants WHERE conversation_id = msg_conversation_id AND user_id = _user_id) THEN
    RAISE EXCEPTION 'Not a participant in this conversation';
  END IF;
  INSERT INTO dm_reactions (message_id, user_id, emoji) VALUES (_message_id, _user_id, _emoji) ON CONFLICT (message_id, user_id, emoji) DO NOTHING RETURNING id INTO new_reaction_id;
  IF new_reaction_id IS NULL THEN SELECT id INTO new_reaction_id FROM dm_reactions WHERE message_id = _message_id AND user_id = _user_id AND emoji = _emoji; END IF;
  SELECT json_build_object('id', r.id, 'message_id', r.message_id, 'user_id', r.user_id, 'emoji', r.emoji) INTO result FROM dm_reactions r WHERE r.id = new_reaction_id;
  RETURN result;
END;
$function$;

-- 31. remove_dm_reaction
CREATE OR REPLACE FUNCTION public.remove_dm_reaction(_message_id uuid, _user_id uuid, _emoji text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  _user_id := public.require_auth();
  DELETE FROM dm_reactions WHERE message_id = _message_id AND user_id = _user_id AND emoji = _emoji;
  RETURN true;
END;
$function$;

-- 32. toggle_pin_message
CREATE OR REPLACE FUNCTION public.toggle_pin_message(_message_id uuid, _user_id uuid)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE channel_id uuid; result json;
BEGIN
  _user_id := public.require_auth();
  SELECT m.channel_id INTO channel_id FROM messages m WHERE m.id = _message_id;
  IF channel_id IS NULL THEN RAISE EXCEPTION 'Message not found'; END IF;
  IF NOT public.check_user_permission(_user_id, channel_id, 'pin_messages') THEN RAISE EXCEPTION 'Permission denied'; END IF;
  UPDATE messages SET is_pinned = NOT is_pinned WHERE id = _message_id;
  SELECT json_build_object('id', m.id, 'channel_id', m.channel_id, 'user_id', m.user_id, 'content', m.content, 'is_pinned', m.is_pinned, 'edited_at', m.edited_at, 'created_at', m.created_at) INTO result FROM messages m WHERE m.id = _message_id;
  RETURN result;
END;
$function$;

-- 33. mark_channel_read
CREATE OR REPLACE FUNCTION public.mark_channel_read(_channel_id uuid, _user_id uuid, _last_read_message_id uuid, _last_read_at timestamp with time zone DEFAULT now())
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  _user_id := public.require_auth();
  INSERT INTO public.channel_reads (channel_id, user_id, last_read_message_id, last_read_at, mention_count) VALUES (_channel_id, _user_id, _last_read_message_id, _last_read_at, 0)
  ON CONFLICT (channel_id, user_id) DO UPDATE SET last_read_message_id = EXCLUDED.last_read_message_id, last_read_at = EXCLUDED.last_read_at, mention_count = 0;
  RETURN true;
END;
$function$;

-- 34. get_all_channel_unread_counts
CREATE OR REPLACE FUNCTION public.get_all_channel_unread_counts(_user_id uuid, _channel_ids uuid[], _blocked_user_ids uuid[] DEFAULT '{}'::uuid[])
 RETURNS TABLE(channel_id uuid, unread_count bigint, mention_count integer, last_read_at timestamp with time zone, last_read_message_id uuid, first_unread_message_id uuid)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  _user_id := public.require_auth();
  RETURN QUERY
  WITH channel_reads_data AS (
    SELECT cr.channel_id, cr.last_read_at, cr.last_read_message_id, COALESCE(cr.mention_count, 0) AS mention_count
    FROM channel_reads cr WHERE cr.user_id = _user_id AND cr.channel_id = ANY(_channel_ids)
  ),
  unread_messages AS (
    SELECT m.channel_id, m.id as message_id, m.created_at
    FROM messages m LEFT JOIN channel_reads_data crd ON crd.channel_id = m.channel_id
    WHERE m.channel_id = ANY(_channel_ids) AND m.user_id != _user_id
      AND (crd.last_read_at IS NULL OR m.created_at > crd.last_read_at)
      AND (array_length(_blocked_user_ids, 1) IS NULL OR m.user_id != ALL(_blocked_user_ids))
  ),
  unread_counts AS (SELECT um.channel_id, COUNT(*) AS unread_count FROM unread_messages um GROUP BY um.channel_id),
  first_unread AS (SELECT DISTINCT ON (um.channel_id) um.channel_id, um.message_id FROM unread_messages um ORDER BY um.channel_id, um.created_at ASC)
  SELECT c.id AS channel_id, COALESCE(uc.unread_count, 0)::BIGINT AS unread_count,
    COALESCE(crd.mention_count, 0)::INTEGER AS mention_count, crd.last_read_at, crd.last_read_message_id, fu.message_id AS first_unread_message_id
  FROM unnest(_channel_ids) AS c(id)
  LEFT JOIN channel_reads_data crd ON crd.channel_id = c.id
  LEFT JOIN unread_counts uc ON uc.channel_id = c.id
  LEFT JOIN first_unread fu ON fu.channel_id = c.id;
END;
$function$;

-- 35. vote_poll
CREATE OR REPLACE FUNCTION public.vote_poll(_poll_id uuid, _user_id uuid, _option_indexes integer[])
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE p record; channel_server_id uuid; is_muted boolean; _n integer; _distinct_indexes integer[];
  _min_idx integer; _max_idx integer; result json;
BEGIN
  _user_id := public.require_auth();
  SELECT * INTO p FROM public.polls WHERE id = _poll_id;
  IF p IS NULL THEN RAISE EXCEPTION 'Poll not found'; END IF;
  IF p.is_closed = true OR p.ends_at <= now() THEN
    UPDATE public.polls SET is_closed = true WHERE id = _poll_id AND is_closed = false;
    PERFORM public.recompute_poll_results(_poll_id);
    SELECT json_build_object('id', p.id, 'channel_id', p.channel_id, 'message_id', p.message_id, 'question', p.question, 'options', p.options, 'allow_multiple', p.allow_multiple, 'ends_at', p.ends_at, 'is_closed', true, 'results', (SELECT results FROM public.polls WHERE id = _poll_id), 'total_votes', (SELECT total_votes FROM public.polls WHERE id = _poll_id)) INTO result;
    RETURN result;
  END IF;
  _n := COALESCE(array_length(p.options, 1), 0);
  IF _n = 0 THEN RAISE EXCEPTION 'Poll has no options'; END IF;
  IF _option_indexes IS NULL OR COALESCE(array_length(_option_indexes, 1), 0) = 0 THEN RAISE EXCEPTION 'At least one option must be selected'; END IF;
  SELECT array_agg(DISTINCT x ORDER BY x) INTO _distinct_indexes FROM unnest(_option_indexes) AS x;
  IF p.allow_multiple = false AND COALESCE(array_length(_distinct_indexes, 1), 0) > 1 THEN RAISE EXCEPTION 'This poll only allows one vote'; END IF;
  SELECT min(x), max(x) INTO _min_idx, _max_idx FROM unnest(_distinct_indexes) AS x;
  IF _min_idx < 0 OR _max_idx > (_n - 1) THEN RAISE EXCEPTION 'Invalid poll option'; END IF;
  SELECT server_id INTO channel_server_id FROM public.channels WHERE id = p.channel_id;
  SELECT sm.is_muted INTO is_muted FROM public.server_members sm WHERE sm.server_id = channel_server_id AND sm.user_id = _user_id AND sm.is_banned = false;
  IF is_muted IS NULL THEN RAISE EXCEPTION 'Not a member of this server'; END IF;
  IF is_muted THEN RAISE EXCEPTION 'You are muted in this server'; END IF;
  IF NOT public.check_user_permission(_user_id, p.channel_id, 'send_messages') THEN RAISE EXCEPTION 'You do not have permission to vote in this channel'; END IF;
  DELETE FROM public.poll_votes WHERE poll_id = _poll_id AND user_id = _user_id;
  INSERT INTO public.poll_votes (poll_id, user_id, option_index) SELECT _poll_id, _user_id, x FROM unnest(_distinct_indexes) AS x ON CONFLICT (poll_id, user_id, option_index) DO NOTHING;
  PERFORM public.recompute_poll_results(_poll_id);
  SELECT json_build_object('id', p.id, 'channel_id', p.channel_id, 'message_id', p.message_id, 'question', p.question, 'options', p.options, 'allow_multiple', p.allow_multiple, 'ends_at', p.ends_at, 'is_closed', (SELECT is_closed FROM public.polls WHERE id = _poll_id), 'results', (SELECT results FROM public.polls WHERE id = _poll_id), 'total_votes', (SELECT total_votes FROM public.polls WHERE id = _poll_id)) INTO result;
  RETURN result;
END;
$function$;

-- 36. change_member_role
CREATE OR REPLACE FUNCTION public.change_member_role(_server_id uuid, _user_id uuid, _target_user_id uuid, _new_role server_role)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE user_role text; target_role text;
BEGIN
  _user_id := public.require_auth();
  SELECT role INTO user_role FROM server_members WHERE server_id = _server_id AND user_id = _user_id AND is_banned = false;
  SELECT role INTO target_role FROM server_members WHERE server_id = _server_id AND user_id = _target_user_id AND is_banned = false;
  IF user_role IS NULL THEN RAISE EXCEPTION 'Not a member of this server'; END IF;
  IF target_role IS NULL THEN RAISE EXCEPTION 'Target user is not a member of this server'; END IF;
  IF _new_role = 'owner' OR target_role = 'owner' THEN RAISE EXCEPTION 'Cannot change owner role. Use transfer ownership instead.'; END IF;
  IF _new_role = 'admin' AND user_role != 'owner' THEN RAISE EXCEPTION 'Only the server owner can promote to admin'; END IF;
  IF user_role NOT IN ('owner', 'admin') THEN RAISE EXCEPTION 'Permission denied'; END IF;
  IF user_role = 'admin' AND target_role = 'admin' THEN RAISE EXCEPTION 'Cannot change role of users with equal role'; END IF;
  UPDATE server_members SET role = _new_role WHERE server_id = _server_id AND user_id = _target_user_id;
  RETURN true;
END;
$function$;

-- 37. mute_member
CREATE OR REPLACE FUNCTION public.mute_member(_server_id uuid, _user_id uuid, _target_user_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  _user_id := public.require_auth();
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT EXISTS (SELECT 1 FROM role_permissions rp JOIN server_member_roles smr ON smr.role_id = rp.role_id JOIN server_members sm ON sm.id = smr.member_id
      WHERE sm.user_id = _user_id AND rp.server_id = _server_id AND rp.permission = 'mute_members' AND rp.allowed = true
    ) THEN RAISE EXCEPTION 'You do not have permission to mute members'; END IF;
  END IF;
  UPDATE server_members SET is_muted = true WHERE server_id = _server_id AND user_id = _target_user_id;
END;
$function$;

-- 38. unmute_member
CREATE OR REPLACE FUNCTION public.unmute_member(_server_id uuid, _user_id uuid, _target_user_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  _user_id := public.require_auth();
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT EXISTS (SELECT 1 FROM role_permissions rp JOIN server_member_roles smr ON smr.role_id = rp.role_id JOIN server_members sm ON sm.id = smr.member_id
      WHERE sm.user_id = _user_id AND rp.server_id = _server_id AND rp.permission = 'mute_members' AND rp.allowed = true
    ) THEN RAISE EXCEPTION 'You do not have permission to unmute members'; END IF;
  END IF;
  UPDATE server_members SET is_muted = false WHERE server_id = _server_id AND user_id = _target_user_id;
END;
$function$;

-- 39. update_member_nickname
CREATE OR REPLACE FUNCTION public.update_member_nickname(_server_id uuid, _user_id uuid, _target_user_id uuid, _nickname text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE user_role text; target_role text;
BEGIN
  _user_id := public.require_auth();
  IF _user_id = _target_user_id THEN
    UPDATE server_members SET nickname = _nickname WHERE server_id = _server_id AND user_id = _user_id;
    RETURN true;
  END IF;
  SELECT role INTO user_role FROM server_members WHERE server_id = _server_id AND user_id = _user_id AND is_banned = false;
  SELECT role INTO target_role FROM server_members WHERE server_id = _server_id AND user_id = _target_user_id AND is_banned = false;
  IF user_role IS NULL THEN RAISE EXCEPTION 'Not a member of this server'; END IF;
  IF target_role IS NULL THEN RAISE EXCEPTION 'Target user is not a member of this server'; END IF;
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_nicknames') THEN RAISE EXCEPTION 'Permission denied'; END IF;
  IF target_role = 'owner' AND user_role != 'owner' THEN RAISE EXCEPTION 'Cannot change the server owner nickname'; END IF;
  UPDATE server_members SET nickname = _nickname WHERE server_id = _server_id AND user_id = _target_user_id;
  RETURN true;
END;
$function$;

-- 40. create_channel (newer overload)
CREATE OR REPLACE FUNCTION public.create_channel(_server_id uuid, _name text, _type text DEFAULT 'text'::text, _user_id uuid DEFAULT NULL::uuid, _category_id uuid DEFAULT NULL::uuid, _position integer DEFAULT NULL::integer, _icon text DEFAULT NULL::text, _is_private boolean DEFAULT false, _ghost_mode boolean DEFAULT false)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE new_channel channels%ROWTYPE; final_position integer;
BEGIN
  _user_id := public.require_auth();
  IF NOT check_user_server_permission(_user_id, _server_id, 'manage_channels'::permission_type) THEN
    RETURN json_build_object('error', 'Permission denied');
  END IF;
  IF _position IS NULL THEN
    SELECT COALESCE(MAX(position), -1) + 1 INTO final_position FROM channels WHERE server_id = _server_id AND ((_category_id IS NULL AND category_id IS NULL) OR category_id = _category_id);
  ELSE final_position := _position; END IF;
  INSERT INTO channels (server_id, name, type, category_id, position, icon, is_private, ghost_mode, is_read_only)
  VALUES (_server_id, _name, _type::channel_type, _category_id, final_position, _icon, _is_private, _ghost_mode, CASE WHEN _type = 'announcement' THEN false ELSE false END) RETURNING * INTO new_channel;
  IF _is_private AND _user_id IS NOT NULL THEN
    INSERT INTO channel_members (channel_id, user_id, added_by) VALUES (new_channel.id, _user_id, _user_id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN row_to_json(new_channel);
END;
$function$;

-- 41. create_channel (older overload)
CREATE OR REPLACE FUNCTION public.create_channel(_server_id uuid, _user_id uuid, _name text, _type text DEFAULT 'text'::text, _category_id uuid DEFAULT NULL::uuid, _is_private boolean DEFAULT false, _topic text DEFAULT NULL::text)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE max_pos int; new_channel_id uuid; result json;
BEGIN
  _user_id := public.require_auth();
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT EXISTS (SELECT 1 FROM role_permissions rp JOIN server_member_roles smr ON smr.role_id = rp.role_id JOIN server_members sm ON sm.id = smr.member_id
      WHERE sm.user_id = _user_id AND rp.server_id = _server_id AND rp.permission = 'manage_channels' AND rp.allowed = true
    ) THEN RAISE EXCEPTION 'Only users with manage_channels permission can create channels'; END IF;
  END IF;
  SELECT COALESCE(MAX(position), -1) + 1 INTO max_pos FROM channels WHERE server_id = _server_id;
  INSERT INTO channels (server_id, name, type, category_id, position, is_private, topic) VALUES (_server_id, _name, _type, _category_id, max_pos, _is_private, _topic) RETURNING id INTO new_channel_id;
  SELECT row_to_json(c) INTO result FROM channels c WHERE c.id = new_channel_id;
  RETURN result;
END;
$function$;

-- 42. delete_channel
CREATE OR REPLACE FUNCTION public.delete_channel(_channel_id uuid, _user_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _server_id uuid;
BEGIN
  _user_id := public.require_auth();
  SELECT server_id INTO _server_id FROM channels WHERE id = _channel_id;
  IF _server_id IS NULL THEN RAISE EXCEPTION 'Channel not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT EXISTS (SELECT 1 FROM role_permissions rp JOIN server_member_roles smr ON smr.role_id = rp.role_id JOIN server_members sm ON sm.id = smr.member_id
      WHERE sm.user_id = _user_id AND rp.server_id = _server_id AND rp.permission = 'manage_channels' AND rp.allowed = true
    ) THEN RAISE EXCEPTION 'Only users with manage_channels permission can delete channels'; END IF;
  END IF;
  DELETE FROM messages WHERE channel_id = _channel_id;
  DELETE FROM channels WHERE id = _channel_id;
END;
$function$;

-- 43. update_channel
CREATE OR REPLACE FUNCTION public.update_channel(_channel_id uuid, _user_id uuid, _updates text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE _server_id uuid; _parsed jsonb; _result jsonb;
BEGIN
  _user_id := public.require_auth();
  SELECT server_id INTO _server_id FROM channels WHERE id = _channel_id;
  IF _server_id IS NULL THEN RAISE EXCEPTION 'Channel not found'; END IF;
  _parsed := _updates::jsonb;
  UPDATE channels SET
    name = COALESCE(_parsed->>'name', name),
    topic = CASE WHEN _parsed ? 'topic' THEN (_parsed->>'topic') ELSE topic END,
    is_nsfw = COALESCE((_parsed->>'is_nsfw')::boolean, is_nsfw),
    slowmode_seconds = COALESCE((_parsed->>'slowmode_seconds')::int, slowmode_seconds),
    is_read_only = COALESCE((_parsed->>'is_read_only')::boolean, is_read_only),
    is_private = COALESCE((_parsed->>'is_private')::boolean, is_private),
    block_links = COALESCE((_parsed->>'block_links')::boolean, block_links),
    allowed_link_domains = CASE WHEN _parsed ? 'allowed_link_domains' THEN ARRAY(SELECT jsonb_array_elements_text(_parsed->'allowed_link_domains')) ELSE allowed_link_domains END,
    ghost_mode = CASE WHEN (_parsed->>'ghost_mode')::boolean = true THEN true ELSE ghost_mode END,
    icon = CASE WHEN _parsed ? 'icon' THEN (_parsed->>'icon') ELSE icon END
  WHERE id = _channel_id;
  SELECT jsonb_build_object('id', c.id, 'server_id', c.server_id, 'category_id', c.category_id,
    'name', c.name, 'topic', c.topic, 'type', c.type, 'position', c.position,
    'is_nsfw', c.is_nsfw, 'slowmode_seconds', c.slowmode_seconds,
    'is_read_only', c.is_read_only, 'is_private', c.is_private,
    'block_links', c.block_links, 'allowed_link_domains', c.allowed_link_domains,
    'ghost_mode', c.ghost_mode, 'icon', c.icon, 'created_at', c.created_at
  ) INTO _result FROM channels c WHERE c.id = _channel_id;
  RETURN _result;
END;
$function$;

-- 44. create_category (newer overload)
CREATE OR REPLACE FUNCTION public.create_category(_server_id uuid, _user_id uuid, _name text, _position integer DEFAULT 0)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE new_category_id uuid; result json;
BEGIN
  _user_id := public.require_auth();
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_channels') THEN RAISE EXCEPTION 'Permission denied'; END IF;
  INSERT INTO channel_categories (server_id, name, position) VALUES (_server_id, _name, _position) RETURNING id INTO new_category_id;
  SELECT json_build_object('id', cc.id, 'server_id', cc.server_id, 'name', cc.name, 'position', cc.position, 'is_collapsed', cc.is_collapsed, 'created_at', cc.created_at) INTO result FROM channel_categories cc WHERE cc.id = new_category_id;
  RETURN result;
END;
$function$;

-- 45. create_category (older overload)
CREATE OR REPLACE FUNCTION public.create_category(_server_id uuid, _user_id uuid, _name text)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE max_pos int; new_cat_id uuid; result json;
BEGIN
  _user_id := public.require_auth();
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT EXISTS (SELECT 1 FROM role_permissions rp JOIN server_member_roles smr ON smr.role_id = rp.role_id JOIN server_members sm ON sm.id = smr.member_id
      WHERE sm.user_id = _user_id AND rp.server_id = _server_id AND rp.permission = 'manage_channels' AND rp.allowed = true
    ) THEN RAISE EXCEPTION 'Only users with manage_channels permission can create categories'; END IF;
  END IF;
  SELECT COALESCE(MAX(position), -1) + 1 INTO max_pos FROM channel_categories WHERE server_id = _server_id;
  INSERT INTO channel_categories (server_id, name, position) VALUES (_server_id, _name, max_pos) RETURNING id INTO new_cat_id;
  SELECT row_to_json(c) INTO result FROM channel_categories c WHERE c.id = new_cat_id;
  RETURN result;
END;
$function$;

-- 46. delete_category
CREATE OR REPLACE FUNCTION public.delete_category(_category_id uuid, _user_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _server_id uuid;
BEGIN
  _user_id := public.require_auth();
  SELECT server_id INTO _server_id FROM channel_categories WHERE id = _category_id;
  IF _server_id IS NULL THEN RAISE EXCEPTION 'Category not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT EXISTS (SELECT 1 FROM role_permissions rp JOIN server_member_roles smr ON smr.role_id = rp.role_id JOIN server_members sm ON sm.id = smr.member_id
      WHERE sm.user_id = _user_id AND rp.server_id = _server_id AND rp.permission = 'manage_channels' AND rp.allowed = true
    ) THEN RAISE EXCEPTION 'Only users with manage_channels permission can delete categories'; END IF;
  END IF;
  UPDATE channels SET category_id = NULL WHERE category_id = _category_id;
  DELETE FROM channel_categories WHERE id = _category_id;
END;
$function$;

-- 47. update_category
CREATE OR REPLACE FUNCTION public.update_category(_category_id uuid, _user_id uuid, _updates text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE _server_id uuid; _parsed jsonb; _result jsonb;
BEGIN
  _user_id := public.require_auth();
  SELECT server_id INTO _server_id FROM channel_categories WHERE id = _category_id;
  IF _server_id IS NULL THEN RAISE EXCEPTION 'Category not found'; END IF;
  _parsed := _updates::jsonb;
  UPDATE channel_categories SET name = COALESCE(_parsed->>'name', name) WHERE id = _category_id;
  SELECT jsonb_build_object('id', cc.id, 'server_id', cc.server_id, 'name', cc.name, 'position', cc.position, 'created_at', cc.created_at) INTO _result FROM channel_categories cc WHERE cc.id = _category_id;
  RETURN _result;
END;
$function$;

-- 48. create_server_role (newer)
CREATE OR REPLACE FUNCTION public.create_server_role(_server_id uuid, _user_id uuid, _name text, _color text, _icon text DEFAULT NULL::text)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE new_role_id uuid;
BEGIN
  _user_id := public.require_auth();
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_roles') THEN RAISE EXCEPTION 'Permission denied'; END IF;
  INSERT INTO server_roles (server_id, name, color, icon, position) VALUES (_server_id, _name, _color, _icon, COALESCE((SELECT MAX(position) FROM server_roles WHERE server_id = _server_id), 0) + 1) RETURNING id INTO new_role_id;
  RETURN (SELECT json_build_object('id', sr.id, 'server_id', sr.server_id, 'name', sr.name, 'color', sr.color, 'icon', sr.icon, 'position', sr.position, 'created_at', sr.created_at) FROM server_roles sr WHERE sr.id = new_role_id);
END;
$function$;

-- 49. create_server_role (older)
CREATE OR REPLACE FUNCTION public.create_server_role(_server_id uuid, _user_id uuid, _name text, _color text DEFAULT '#5865F2'::text)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE new_role_id uuid; result json;
BEGIN
  _user_id := public.require_auth();
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_roles') THEN RAISE EXCEPTION 'Permission denied'; END IF;
  INSERT INTO server_roles (server_id, name, color, position) VALUES (_server_id, _name, _color, COALESCE((SELECT MAX(position) FROM server_roles WHERE server_id = _server_id), 0) + 1) RETURNING id INTO new_role_id;
  RETURN (SELECT json_build_object('id', sr.id, 'server_id', sr.server_id, 'name', sr.name, 'color', sr.color, 'position', sr.position, 'created_at', sr.created_at) FROM server_roles sr WHERE sr.id = new_role_id);
END;
$function$;

-- 50. delete_server_role
CREATE OR REPLACE FUNCTION public.delete_server_role(_role_id uuid, _user_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _server_id uuid; _role_name text;
BEGIN
  _user_id := public.require_auth();
  SELECT server_id, name INTO _server_id, _role_name FROM server_roles WHERE id = _role_id;
  IF _server_id IS NULL THEN RAISE EXCEPTION 'Role not found'; END IF;
  IF _role_name = '@everyone' THEN RAISE EXCEPTION 'Cannot delete the @everyone role'; END IF;
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT EXISTS (SELECT 1 FROM role_permissions rp JOIN server_member_roles smr ON smr.role_id = rp.role_id JOIN server_members sm ON sm.id = smr.member_id
      WHERE sm.user_id = _user_id AND rp.server_id = _server_id AND rp.permission = 'manage_roles' AND rp.allowed = true
    ) THEN RAISE EXCEPTION 'Only users with manage_roles permission can delete roles'; END IF;
  END IF;
  DELETE FROM server_member_roles WHERE role_id = _role_id;
  DELETE FROM role_permissions WHERE role_id = _role_id;
  DELETE FROM server_roles WHERE id = _role_id;
END;
$function$;

-- 51. update_server_role
CREATE OR REPLACE FUNCTION public.update_server_role(_role_id uuid, _user_id uuid, _name text DEFAULT NULL::text, _color text DEFAULT NULL::text, _icon text DEFAULT NULL::text)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _server_id uuid; result json;
BEGIN
  _user_id := public.require_auth();
  SELECT server_id INTO _server_id FROM server_roles WHERE id = _role_id;
  IF _server_id IS NULL THEN RAISE EXCEPTION 'Role not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT EXISTS (SELECT 1 FROM role_permissions rp JOIN server_member_roles smr ON smr.role_id = rp.role_id JOIN server_members sm ON sm.id = smr.member_id
      WHERE sm.user_id = _user_id AND rp.server_id = _server_id AND rp.permission = 'manage_roles' AND rp.allowed = true
    ) THEN RAISE EXCEPTION 'Only users with manage_roles permission can update roles'; END IF;
  END IF;
  UPDATE server_roles SET name = COALESCE(_name, name), color = COALESCE(_color, color), icon = _icon WHERE id = _role_id;
  SELECT row_to_json(r) INTO result FROM server_roles r WHERE r.id = _role_id;
  RETURN result;
END;
$function$;

-- 52. assign_role_to_member
CREATE OR REPLACE FUNCTION public.assign_role_to_member(_user_id uuid, _member_id uuid, _role_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _server_id uuid; _is_owner boolean; _has_manage_roles boolean;
BEGIN
  _user_id := public.require_auth();
  SELECT server_id INTO _server_id FROM server_members WHERE id = _member_id;
  IF _server_id IS NULL THEN RAISE EXCEPTION 'Member not found'; END IF;
  SELECT (owner_id = _user_id) INTO _is_owner FROM servers WHERE id = _server_id;
  IF _is_owner THEN
    INSERT INTO server_member_roles (member_id, role_id) VALUES (_member_id, _role_id) ON CONFLICT DO NOTHING; RETURN;
  END IF;
  SELECT EXISTS (SELECT 1 FROM server_member_roles smr JOIN server_members sm ON sm.id = smr.member_id JOIN role_permissions rp ON rp.role_id = smr.role_id AND rp.server_id = _server_id
    WHERE sm.user_id = _user_id AND sm.server_id = _server_id AND rp.permission = 'manage_roles' AND rp.allowed = true) INTO _has_manage_roles;
  IF NOT _has_manage_roles THEN RAISE EXCEPTION 'Only admins and owners can assign roles'; END IF;
  INSERT INTO server_member_roles (member_id, role_id) VALUES (_member_id, _role_id) ON CONFLICT DO NOTHING;
END;
$function$;

-- 53. remove_role_from_member
CREATE OR REPLACE FUNCTION public.remove_role_from_member(_user_id uuid, _member_id uuid, _role_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _server_id uuid; _is_owner boolean; _has_manage_roles boolean;
BEGIN
  _user_id := public.require_auth();
  SELECT server_id INTO _server_id FROM server_members WHERE id = _member_id;
  IF _server_id IS NULL THEN RAISE EXCEPTION 'Member not found'; END IF;
  SELECT (owner_id = _user_id) INTO _is_owner FROM servers WHERE id = _server_id;
  IF _is_owner THEN DELETE FROM server_member_roles WHERE member_id = _member_id AND role_id = _role_id; RETURN; END IF;
  SELECT EXISTS (SELECT 1 FROM server_member_roles smr JOIN server_members sm ON sm.id = smr.member_id JOIN role_permissions rp ON rp.role_id = smr.role_id AND rp.server_id = _server_id
    WHERE sm.user_id = _user_id AND sm.server_id = _server_id AND rp.permission = 'manage_roles' AND rp.allowed = true) INTO _has_manage_roles;
  IF NOT _has_manage_roles THEN RAISE EXCEPTION 'Only admins and owners can remove roles'; END IF;
  DELETE FROM server_member_roles WHERE member_id = _member_id AND role_id = _role_id;
END;
$function$;

-- 54. set_channel_permission
CREATE OR REPLACE FUNCTION public.set_channel_permission(_channel_id uuid, _user_id uuid, _permission permission_type, _allowed boolean, _role_id uuid DEFAULT NULL::uuid, _role_name text DEFAULT NULL::text, _target_user_id uuid DEFAULT NULL::uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _server_id uuid;
BEGIN
  _user_id := public.require_auth();
  SELECT server_id INTO _server_id FROM channels WHERE id = _channel_id;
  IF _server_id IS NULL THEN RAISE EXCEPTION 'Channel not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT check_user_server_permission(_user_id, _server_id, 'manage_channels'::permission_type) THEN
      RAISE EXCEPTION 'You do not have permission to manage channel permissions';
    END IF;
  END IF;
  IF _target_user_id IS NOT NULL THEN
    INSERT INTO channel_permissions (channel_id, user_id, permission, allowed) VALUES (_channel_id, _target_user_id, _permission, _allowed)
    ON CONFLICT (channel_id, user_id, permission) WHERE user_id IS NOT NULL DO UPDATE SET allowed = EXCLUDED.allowed;
  ELSIF _role_id IS NOT NULL THEN
    INSERT INTO channel_permissions (channel_id, role_id, permission, allowed) VALUES (_channel_id, _role_id, _permission, _allowed)
    ON CONFLICT (channel_id, role_id, permission) WHERE role_id IS NOT NULL AND user_id IS NULL DO UPDATE SET allowed = EXCLUDED.allowed;
  ELSIF _role_name IS NOT NULL THEN
    INSERT INTO channel_permissions (channel_id, role_name, permission, allowed) VALUES (_channel_id, _role_name::server_role, _permission, _allowed)
    ON CONFLICT (channel_id, role_name, permission) WHERE role_name IS NOT NULL AND role_id IS NULL AND user_id IS NULL DO UPDATE SET allowed = EXCLUDED.allowed;
  ELSE RAISE EXCEPTION 'One of role_id, role_name, or target_user_id must be provided'; END IF;
END;
$function$;

-- 55. delete_channel_permission
CREATE OR REPLACE FUNCTION public.delete_channel_permission(_permission_id uuid, _user_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _server_id uuid; _channel_id uuid;
BEGIN
  _user_id := public.require_auth();
  SELECT cp.channel_id INTO _channel_id FROM channel_permissions cp WHERE cp.id = _permission_id;
  IF _channel_id IS NULL THEN RAISE EXCEPTION 'Permission not found'; END IF;
  SELECT server_id INTO _server_id FROM channels WHERE id = _channel_id;
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT public.check_user_permission(_user_id, _channel_id, 'manage_channels'::permission_type) THEN
      RAISE EXCEPTION 'You do not have permission to manage channel permissions';
    END IF;
  END IF;
  DELETE FROM channel_permissions WHERE id = _permission_id;
END;
$function$;

-- 56. set_role_permission (role_id version)
CREATE OR REPLACE FUNCTION public.set_role_permission(_user_id uuid, _role_id uuid, _permission permission_type, _allowed boolean)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _server_id uuid; _is_owner boolean; _has_perm boolean;
BEGIN
  _user_id := public.require_auth();
  SELECT server_id INTO _server_id FROM server_roles WHERE id = _role_id;
  IF _server_id IS NULL THEN RAISE EXCEPTION 'Role not found'; END IF;
  SELECT (owner_id = _user_id) INTO _is_owner FROM servers WHERE id = _server_id;
  IF NOT _is_owner THEN
    SELECT check_user_server_permission(_user_id, _server_id, 'manage_roles'::permission_type) INTO _has_perm;
    IF NOT _has_perm THEN RAISE EXCEPTION 'You do not have permission to manage roles'; END IF;
  END IF;
  INSERT INTO role_permissions (role_id, permission, allowed) VALUES (_role_id, _permission, _allowed) ON CONFLICT (role_id, permission) DO UPDATE SET allowed = EXCLUDED.allowed;
END;
$function$;

-- 57. set_role_permission (server_id version)
CREATE OR REPLACE FUNCTION public.set_role_permission(_server_id uuid, _user_id uuid, _permission permission_type, _role_id uuid DEFAULT NULL::uuid, _role_name text DEFAULT NULL::text, _allowed boolean DEFAULT true)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  _user_id := public.require_auth();
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT EXISTS (SELECT 1 FROM role_permissions rp JOIN server_member_roles smr ON smr.role_id = rp.role_id JOIN server_members sm ON sm.id = smr.member_id
      WHERE sm.user_id = _user_id AND rp.server_id = _server_id AND rp.permission = 'manage_roles' AND rp.allowed = true
    ) THEN RAISE EXCEPTION 'Only admins and owners can manage role permissions'; END IF;
  END IF;
  IF _role_id IS NOT NULL THEN
    INSERT INTO role_permissions (server_id, role_id, permission, allowed) VALUES (_server_id, _role_id, _permission, _allowed)
    ON CONFLICT (server_id, role_id, permission) WHERE role_id IS NOT NULL DO UPDATE SET allowed = EXCLUDED.allowed;
  ELSIF _role_name IS NOT NULL THEN
    INSERT INTO role_permissions (server_id, role_name, permission, allowed) VALUES (_server_id, _role_name, _permission, _allowed)
    ON CONFLICT (server_id, role_name, permission) WHERE role_name IS NOT NULL AND role_id IS NULL DO UPDATE SET allowed = EXCLUDED.allowed;
  END IF;
END;
$function$;

-- 58. delete_role_permission
CREATE OR REPLACE FUNCTION public.delete_role_permission(_permission_id uuid, _user_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _server_id uuid;
BEGIN
  _user_id := public.require_auth();
  SELECT server_id INTO _server_id FROM role_permissions WHERE id = _permission_id;
  IF _server_id IS NULL THEN RAISE EXCEPTION 'Permission not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT EXISTS (SELECT 1 FROM role_permissions rp JOIN server_member_roles smr ON smr.role_id = rp.role_id JOIN server_members sm ON sm.id = smr.member_id
      WHERE sm.user_id = _user_id AND rp.server_id = _server_id AND rp.permission = 'manage_roles' AND rp.allowed = true
    ) THEN RAISE EXCEPTION 'Only admins and owners can manage role permissions'; END IF;
  END IF;
  DELETE FROM role_permissions WHERE id = _permission_id;
END;
$function$;

-- 59. create_server_invite
CREATE OR REPLACE FUNCTION public.create_server_invite(_server_id uuid, _user_id uuid, _expires_in_seconds integer DEFAULT NULL::integer, _max_uses integer DEFAULT NULL::integer)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE new_code char(8); try_count int := 0; expires_at_value timestamptz;
BEGIN
  _user_id := public.require_auth();
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_invites') THEN RAISE EXCEPTION 'Permission denied'; END IF;
  IF _max_uses IS NOT NULL AND _max_uses < 1 THEN RAISE EXCEPTION 'max_uses must be at least 1'; END IF;
  expires_at_value := CASE WHEN _expires_in_seconds IS NULL THEN NULL ELSE now() + make_interval(secs => _expires_in_seconds) END;
  LOOP
    try_count := try_count + 1;
    IF try_count > 25 THEN RAISE EXCEPTION 'Failed to generate a unique invite code'; END IF;
    new_code := public.generate_invite_code();
    BEGIN
      INSERT INTO public.server_invites (server_id, code, created_by, expires_at, max_uses, uses_count) VALUES (_server_id, new_code, _user_id, expires_at_value, _max_uses, 0);
      EXIT;
    EXCEPTION WHEN unique_violation THEN END;
  END LOOP;
  RETURN trim(new_code::text);
END;
$function$;

-- 60. add_channel_member
CREATE OR REPLACE FUNCTION public.add_channel_member(_channel_id uuid, _target_user_id uuid, _added_by uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _channel RECORD;
BEGIN
  _added_by := public.require_auth();
  SELECT id, server_id, is_private INTO _channel FROM channels WHERE id = _channel_id;
  IF NOT FOUND OR NOT _channel.is_private THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM channel_members WHERE channel_id = _channel_id AND user_id = _added_by) AND NOT EXISTS (SELECT 1 FROM server_members WHERE server_id = _channel.server_id AND user_id = _added_by AND role IN ('owner', 'admin')) THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM server_members WHERE server_id = _channel.server_id AND user_id = _target_user_id AND is_banned = false) THEN RETURN false; END IF;
  INSERT INTO channel_members (channel_id, user_id, added_by) VALUES (_channel_id, _target_user_id, _added_by) ON CONFLICT (channel_id, user_id) DO NOTHING;
  RETURN true;
END;
$function$;

-- 61. remove_channel_member
CREATE OR REPLACE FUNCTION public.remove_channel_member(_channel_id uuid, _target_user_id uuid, _removed_by uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _channel RECORD;
BEGIN
  _removed_by := public.require_auth();
  SELECT id, server_id, is_private INTO _channel FROM channels WHERE id = _channel_id;
  IF NOT FOUND OR NOT _channel.is_private THEN RETURN false; END IF;
  IF _removed_by != _target_user_id AND NOT EXISTS (SELECT 1 FROM server_members WHERE server_id = _channel.server_id AND user_id = _removed_by AND role IN ('owner', 'admin')) THEN RETURN false; END IF;
  DELETE FROM channel_members WHERE channel_id = _channel_id AND user_id = _target_user_id;
  RETURN true;
END;
$function$;

-- 62. create_group_dm
CREATE OR REPLACE FUNCTION public.create_group_dm(_creator_id uuid, _participant_ids uuid[], _name text DEFAULT NULL::text)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE new_conv_id uuid; result json;
BEGIN
  _creator_id := public.require_auth();
  IF array_length(_participant_ids, 1) < 2 THEN RAISE EXCEPTION 'Groups require at least 2 other participants'; END IF;
  INSERT INTO dm_conversations (is_group, name) VALUES (true, _name) RETURNING id INTO new_conv_id;
  INSERT INTO dm_participants (conversation_id, user_id) VALUES (new_conv_id, _creator_id);
  INSERT INTO dm_participants (conversation_id, user_id) SELECT new_conv_id, unnest(_participant_ids);
  SELECT json_build_object('id', dc.id, 'created_at', dc.created_at, 'is_group', dc.is_group, 'name', dc.name,
    'participants', (SELECT json_agg(json_build_object('user_id', dp.user_id, 'user', json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'status', u.status, 'last_seen', u.last_seen)))
    FROM dm_participants dp JOIN users u ON u.id = dp.user_id WHERE dp.conversation_id = dc.id)
  ) INTO result FROM dm_conversations dc WHERE dc.id = new_conv_id;
  RETURN result;
END;
$function$;

-- 63. add_group_dm_members
CREATE OR REPLACE FUNCTION public.add_group_dm_members(_conversation_id uuid, _user_id uuid, _new_member_ids uuid[])
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_is_group boolean; v_is_participant boolean; v_member_id uuid; v_added_count int := 0;
BEGIN
  _user_id := public.require_auth();
  SELECT is_group INTO v_is_group FROM dm_conversations WHERE id = _conversation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conversation not found'; END IF;
  IF NOT COALESCE(v_is_group, false) THEN RAISE EXCEPTION 'Cannot add members to a 1:1 conversation'; END IF;
  SELECT EXISTS (SELECT 1 FROM dm_participants WHERE conversation_id = _conversation_id AND user_id = _user_id) INTO v_is_participant;
  IF NOT v_is_participant THEN RAISE EXCEPTION 'User is not a participant'; END IF;
  FOREACH v_member_id IN ARRAY _new_member_ids LOOP
    IF NOT EXISTS (SELECT 1 FROM dm_participants WHERE conversation_id = _conversation_id AND user_id = v_member_id) THEN
      INSERT INTO dm_participants (conversation_id, user_id) VALUES (_conversation_id, v_member_id);
      v_added_count := v_added_count + 1;
    END IF;
  END LOOP;
  RETURN json_build_object('success', true, 'added_count', v_added_count);
END;
$function$;

-- 64. create_task
CREATE OR REPLACE FUNCTION public.create_task(_channel_id uuid, _user_id uuid, _title text, _description text DEFAULT NULL::text, _priority text DEFAULT 'medium'::text, _due_date timestamp with time zone DEFAULT NULL::timestamp with time zone, _assignee_ids uuid[] DEFAULT ARRAY[]::uuid[])
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE new_task tasks; channel_record record; max_position integer; assignee_id uuid;
BEGIN
  _user_id := public.require_auth();
  SELECT c.id, c.server_id INTO channel_record FROM channels c WHERE c.id = _channel_id;
  IF channel_record IS NULL THEN RAISE EXCEPTION 'Channel not found'; END IF;
  SELECT COALESCE(MAX(task_position), -1) + 1 INTO max_position FROM tasks WHERE channel_id = _channel_id;
  INSERT INTO tasks (channel_id, server_id, created_by, title, description, priority, due_date, task_position)
  VALUES (_channel_id, channel_record.server_id, _user_id, _title, _description, _priority::task_priority, _due_date, max_position) RETURNING * INTO new_task;
  IF array_length(_assignee_ids, 1) > 0 THEN
    FOREACH assignee_id IN ARRAY _assignee_ids LOOP
      INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (new_task.id, assignee_id, _user_id) ON CONFLICT (task_id, user_id) DO NOTHING;
    END LOOP;
  END IF;
  RETURN jsonb_build_object('id', new_task.id, 'channel_id', new_task.channel_id, 'server_id', new_task.server_id, 'created_by', new_task.created_by,
    'title', new_task.title, 'description', new_task.description, 'priority', new_task.priority::text, 'status', new_task.status::text,
    'due_date', new_task.due_date, 'position', new_task.task_position, 'completed_by', new_task.completed_by, 'completed_at', new_task.completed_at,
    'created_at', new_task.created_at, 'updated_at', new_task.updated_at);
END;
$function$;

-- 65. update_task
CREATE OR REPLACE FUNCTION public.update_task(_task_id uuid, _user_id uuid, _title text DEFAULT NULL::text, _description text DEFAULT NULL::text, _priority text DEFAULT NULL::text, _status text DEFAULT NULL::text, _due_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  _user_id := public.require_auth();
  UPDATE public.tasks SET title = COALESCE(_title, title), description = COALESCE(_description, description),
    priority = COALESCE(_priority::task_priority, priority), status = COALESCE(_status::task_status, status),
    due_date = COALESCE(_due_date, due_date),
    completed_by = CASE WHEN _status = 'completed' AND status != 'completed' THEN _user_id WHEN _status = 'open' THEN NULL ELSE completed_by END,
    completed_at = CASE WHEN _status = 'completed' AND status != 'completed' THEN NOW() WHEN _status = 'open' THEN NULL ELSE completed_at END,
    updated_at = NOW()
  WHERE id = _task_id;
END;
$function$;

-- 66. delete_task
CREATE OR REPLACE FUNCTION public.delete_task(_task_id uuid, _user_id uuid)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE task_channel_id uuid; task_created_by uuid; can_delete boolean := false;
BEGIN
  _user_id := public.require_auth();
  SELECT channel_id, created_by INTO task_channel_id, task_created_by FROM tasks WHERE id = _task_id;
  IF task_channel_id IS NULL THEN RETURN json_build_object('error', 'Task not found'); END IF;
  IF task_created_by = _user_id THEN can_delete := check_user_permission(_user_id, task_channel_id, 'delete_tasks'::permission_type); END IF;
  IF NOT can_delete THEN can_delete := check_user_permission(_user_id, task_channel_id, 'delete_tasks'::permission_type); END IF;
  IF NOT can_delete THEN RETURN json_build_object('error', 'Permission denied: delete tasks'); END IF;
  DELETE FROM tasks WHERE id = _task_id;
  RETURN json_build_object('success', true);
END;
$function$;

-- 67. create_task_comment (with reply)
CREATE OR REPLACE FUNCTION public.create_task_comment(_task_id uuid, _user_id uuid, _content text, _reply_to_id uuid DEFAULT NULL::uuid)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE task_channel_id uuid; new_comment_id uuid; reply_to_task_id uuid; result json;
BEGIN
  _user_id := public.require_auth();
  SELECT channel_id INTO task_channel_id FROM tasks WHERE id = _task_id;
  IF task_channel_id IS NULL THEN RETURN json_build_object('error', 'Task not found'); END IF;
  IF _reply_to_id IS NOT NULL THEN
    SELECT task_id INTO reply_to_task_id FROM task_comments WHERE id = _reply_to_id;
    IF reply_to_task_id IS NULL THEN RETURN json_build_object('error', 'Reply target comment not found'); END IF;
    IF reply_to_task_id != _task_id THEN RETURN json_build_object('error', 'Reply target must be in the same task'); END IF;
  END IF;
  IF NOT check_user_permission(_user_id, task_channel_id, 'view_tasks'::permission_type) THEN RETURN json_build_object('error', 'Permission denied: view_tasks'); END IF;
  INSERT INTO task_comments (task_id, user_id, content, reply_to_id) VALUES (_task_id, _user_id, _content, _reply_to_id) RETURNING id INTO new_comment_id;
  SELECT json_build_object('id', tc.id, 'task_id', tc.task_id, 'user_id', tc.user_id, 'content', tc.content, 'created_at', tc.created_at, 'edited_at', tc.edited_at, 'reply_to_id', tc.reply_to_id) INTO result FROM task_comments tc WHERE tc.id = new_comment_id;
  RETURN result;
END;
$function$;

-- 68. create_task_comment (without reply)
CREATE OR REPLACE FUNCTION public.create_task_comment(_task_id uuid, _user_id uuid, _content text)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE task_channel_id uuid; new_comment_id uuid; result json;
BEGIN
  _user_id := public.require_auth();
  SELECT channel_id INTO task_channel_id FROM tasks WHERE id = _task_id;
  IF task_channel_id IS NULL THEN RETURN json_build_object('error', 'Task not found'); END IF;
  IF NOT check_user_permission(_user_id, task_channel_id, 'view_tasks'::permission_type) THEN RETURN json_build_object('error', 'Permission denied: view_tasks'); END IF;
  INSERT INTO task_comments (task_id, user_id, content) VALUES (_task_id, _user_id, _content) RETURNING id INTO new_comment_id;
  SELECT json_build_object('id', tc.id, 'task_id', tc.task_id, 'user_id', tc.user_id, 'content', tc.content, 'created_at', tc.created_at, 'edited_at', tc.edited_at) INTO result FROM task_comments tc WHERE tc.id = new_comment_id;
  RETURN result;
END;
$function$;

-- 69. assign_task_users
CREATE OR REPLACE FUNCTION public.assign_task_users(_task_id uuid, _user_id uuid, _assignee_ids uuid[])
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE task_channel_id uuid; assignee_id uuid;
BEGIN
  _user_id := public.require_auth();
  SELECT channel_id INTO task_channel_id FROM tasks WHERE id = _task_id;
  IF task_channel_id IS NULL THEN RETURN json_build_object('error', 'Task not found'); END IF;
  IF NOT check_user_permission(_user_id, task_channel_id, 'assign_tasks'::permission_type) THEN RETURN json_build_object('error', 'Permission denied: assign_tasks'); END IF;
  FOREACH assignee_id IN ARRAY _assignee_ids LOOP
    INSERT INTO task_assignees (task_id, user_id, assigned_by) VALUES (_task_id, assignee_id, _user_id) ON CONFLICT (task_id, user_id) DO NOTHING;
  END LOOP;
  RETURN json_build_object('success', true);
END;
$function$;

-- 70. create_thread
CREATE OR REPLACE FUNCTION public.create_thread(_message_id uuid, _user_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE message_channel_id uuid; message_user_id uuid; channel_server_id uuid; is_muted boolean; new_thread_id uuid;
BEGIN
  _user_id := public.require_auth();
  SELECT channel_id, user_id INTO message_channel_id, message_user_id FROM messages WHERE id = _message_id;
  IF message_channel_id IS NULL THEN RAISE EXCEPTION 'Message not found'; END IF;
  IF message_user_id != _user_id THEN
    SELECT server_id INTO channel_server_id FROM channels WHERE id = message_channel_id;
    SELECT sm.is_muted INTO is_muted FROM server_members sm WHERE sm.server_id = channel_server_id AND sm.user_id = _user_id AND sm.is_banned = false;
    IF is_muted IS NULL THEN RAISE EXCEPTION 'Not a member of this server'; END IF;
  END IF;
  SELECT id INTO new_thread_id FROM threads WHERE message_id = _message_id;
  IF new_thread_id IS NOT NULL THEN RETURN new_thread_id; END IF;
  INSERT INTO threads (channel_id, message_id, created_by) VALUES (message_channel_id, _message_id, _user_id) RETURNING id INTO new_thread_id;
  RETURN new_thread_id;
END;
$function$;

-- 71. delete_forum_thread
CREATE OR REPLACE FUNCTION public.delete_forum_thread(_thread_id uuid, _user_id uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_thread RECORD; v_member RECORD; v_can_manage BOOLEAN := FALSE;
BEGIN
  _user_id := public.require_auth();
  SELECT * INTO v_thread FROM threads WHERE id = _thread_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Thread not found'; END IF;
  IF v_thread.created_by = _user_id THEN v_can_manage := TRUE; END IF;
  IF NOT v_can_manage THEN
    DECLARE v_server_id UUID;
    BEGIN
      SELECT server_id INTO v_server_id FROM channels WHERE id = v_thread.channel_id;
      SELECT * INTO v_member FROM server_members WHERE server_id = v_server_id AND user_id = _user_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Not a server member'; END IF;
      IF v_member.role IN ('owner', 'admin') THEN v_can_manage := TRUE; END IF;
      IF NOT v_can_manage THEN SELECT EXISTS (SELECT 1 FROM role_permissions WHERE server_id = v_server_id AND role_name = v_member.role AND permission = 'manage_messages' AND allowed = TRUE) INTO v_can_manage; END IF;
      IF NOT v_can_manage THEN SELECT EXISTS (SELECT 1 FROM role_permissions rp JOIN server_member_roles smr ON smr.role_id = rp.role_id WHERE smr.member_id = v_member.id AND rp.permission = 'manage_messages' AND rp.allowed = TRUE) INTO v_can_manage; END IF;
    END;
  END IF;
  IF NOT v_can_manage THEN RAISE EXCEPTION 'Permission denied'; END IF;
  DELETE FROM thread_messages WHERE thread_id = _thread_id;
  DELETE FROM thread_reactions WHERE message_id = v_thread.message_id;
  DELETE FROM threads WHERE id = _thread_id;
  DELETE FROM reactions WHERE message_id = v_thread.message_id;
  DELETE FROM messages WHERE id = v_thread.message_id;
  RETURN TRUE;
END;
$function$;

-- 72. delete_announcement_comment
CREATE OR REPLACE FUNCTION public.delete_announcement_comment(_comment_id uuid, _user_id uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE comment_owner_id uuid; msg_channel_id uuid;
BEGIN
  _user_id := public.require_auth();
  SELECT ac.user_id, m.channel_id INTO comment_owner_id, msg_channel_id FROM announcement_comments ac JOIN messages m ON m.id = ac.message_id WHERE ac.id = _comment_id;
  IF comment_owner_id IS NULL THEN RAISE EXCEPTION 'Comment not found'; END IF;
  IF comment_owner_id != _user_id THEN
    IF NOT check_user_permission(_user_id, msg_channel_id, 'manage_messages') THEN RAISE EXCEPTION 'Permission denied: you can only delete your own comments'; END IF;
  END IF;
  DELETE FROM announcement_comments WHERE id = _comment_id;
  RETURN true;
END;
$function$;

-- 73. delete_media_comment
CREATE OR REPLACE FUNCTION public.delete_media_comment(_comment_id uuid, _user_id uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE comment_owner_id uuid; media_channel_id uuid;
BEGIN
  _user_id := public.require_auth();
  SELECT mc.user_id, mi.channel_id INTO comment_owner_id, media_channel_id FROM media_comments mc JOIN media_items mi ON mi.id = mc.media_id WHERE mc.id = _comment_id;
  IF comment_owner_id IS NULL THEN RAISE EXCEPTION 'Comment not found'; END IF;
  IF comment_owner_id != _user_id THEN
    IF NOT check_user_permission(_user_id, media_channel_id, 'manage_messages') THEN RAISE EXCEPTION 'Permission denied: you can only delete your own comments'; END IF;
  END IF;
  DELETE FROM media_comments WHERE id = _comment_id;
  RETURN true;
END;
$function$;

-- 74. delete_media_item
CREATE OR REPLACE FUNCTION public.delete_media_item(_item_id uuid, _user_id uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE item_channel_id uuid; item_owner_id uuid;
BEGIN
  _user_id := public.require_auth();
  SELECT channel_id, user_id INTO item_channel_id, item_owner_id FROM media_items WHERE id = _item_id;
  IF item_channel_id IS NULL THEN RAISE EXCEPTION 'Media item not found'; END IF;
  IF item_owner_id != _user_id THEN
    IF NOT check_user_permission(_user_id, item_channel_id, 'manage_messages') THEN RAISE EXCEPTION 'Permission denied: you can only delete your own media or need manage_messages permission'; END IF;
  END IF;
  DELETE FROM media_items WHERE id = _item_id;
  RETURN true;
END;
$function$;
