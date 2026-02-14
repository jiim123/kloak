
-- ============================================================
-- Remove caller-identity parameters from RPC function signatures.
-- Identity is now derived server-side via require_auth().
-- ============================================================

-- Phase 1: Drop old/duplicate overloads
DROP FUNCTION IF EXISTS public.reset_user_secret_key(uuid, character);
DROP FUNCTION IF EXISTS public.join_server_by_invite(text, uuid);
DROP FUNCTION IF EXISTS public.create_category(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.create_channel(uuid, uuid, text, text, uuid, boolean, text);
DROP FUNCTION IF EXISTS public.update_server(uuid, uuid, text, text, text, text, boolean, uuid, boolean, boolean);
DROP FUNCTION IF EXISTS public.create_server_role(uuid, uuid, text, text);
DROP FUNCTION IF EXISTS public.set_role_permission(uuid, uuid, permission_type, boolean);

-- Phase 2: Recreate all functions without caller-identity params

-- ====== AUTH FUNCTIONS ======

DROP FUNCTION IF EXISTS public.update_user_profile(uuid, json);
CREATE OR REPLACE FUNCTION public.update_user_profile(_updates json)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result json; _u jsonb := _updates::jsonb; _user_id uuid;
BEGIN
  _user_id := public.require_auth();
  IF (_u ? 'display_name') AND char_length(COALESCE(_updates->>'display_name', '')) > 32 THEN RAISE EXCEPTION 'Display name must be 32 characters or less'; END IF;
  IF (_u ? 'bio') AND char_length(COALESCE(_updates->>'bio', '')) > 190 THEN RAISE EXCEPTION 'Bio must be 190 characters or less'; END IF;
  IF (_u ? 'custom_status') AND char_length(COALESCE(_updates->>'custom_status', '')) > 128 THEN RAISE EXCEPTION 'Custom status must be 128 characters or less'; END IF;
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
  SELECT json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'banner_url', u.banner_url, 'avatar_decoration', u.avatar_decoration, 'profile_effect', u.profile_effect, 'banner_color', u.banner_color, 'profile_theme_primary', u.profile_theme_primary, 'profile_theme_accent', u.profile_theme_accent, 'bio', u.bio, 'status', u.status, 'custom_status', u.custom_status, 'created_at', u.created_at, 'last_seen', u.last_seen) INTO result FROM users u WHERE u.id = _user_id;
  RETURN result;
END;
$$;

DROP FUNCTION IF EXISTS public.update_user_status(uuid, user_status);
CREATE OR REPLACE FUNCTION public.update_user_status(_status user_status)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid;
BEGIN
  _user_id := public.require_auth();
  IF _status = 'offline' THEN UPDATE users SET status = _status, last_seen = now() - interval '10 minutes' WHERE id = _user_id;
  ELSE UPDATE users SET status = _status, last_seen = now() WHERE id = _user_id; END IF;
  RETURN true;
END;
$$;

DROP FUNCTION IF EXISTS public.update_user_last_seen(uuid);
CREATE OR REPLACE FUNCTION public.update_user_last_seen()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid;
BEGIN
  _user_id := public.require_auth();
  UPDATE users SET last_seen = now() WHERE id = _user_id;
  RETURN true;
END;
$$;

DROP FUNCTION IF EXISTS public.reset_user_secret_key(uuid, text);
CREATE OR REPLACE FUNCTION public.reset_user_secret_key(_new_key_hash text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; v_last_reset TIMESTAMP WITH TIME ZONE; v_cooldown_hours INT := 24; v_time_remaining INTERVAL;
BEGIN
  _user_id := public.require_auth();
  SELECT last_key_reset_at INTO v_last_reset FROM users WHERE id = _user_id;
  IF v_last_reset IS NOT NULL AND v_last_reset > (NOW() - (v_cooldown_hours || ' hours')::INTERVAL) THEN
    v_time_remaining := v_last_reset + (v_cooldown_hours || ' hours')::INTERVAL - NOW();
    RETURN json_build_object('success', false, 'error', 'cooldown', 'cooldown_ends_at', v_last_reset + (v_cooldown_hours || ' hours')::INTERVAL, 'hours_remaining', EXTRACT(EPOCH FROM v_time_remaining) / 3600);
  END IF;
  UPDATE users SET key_hash = _new_key_hash, last_key_reset_at = NOW() WHERE id = _user_id;
  RETURN json_build_object('success', true, 'last_key_reset_at', NOW());
END;
$$;

-- ====== MESSAGE FUNCTIONS ======

DROP FUNCTION IF EXISTS public.send_message(uuid, uuid, text, uuid);
CREATE OR REPLACE FUNCTION public.send_message(_channel_id uuid, _content text, _reply_to_id uuid DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; channel_server_id uuid; is_muted boolean; new_message_id uuid; result json;
BEGIN
  _user_id := public.require_auth();
  IF _content IS NULL OR trim(_content) = '' THEN RAISE EXCEPTION 'Message cannot be empty'; END IF;
  IF char_length(_content) > 2000 THEN RAISE EXCEPTION 'Message must be 2000 characters or less'; END IF;
  SELECT server_id INTO channel_server_id FROM channels WHERE id = _channel_id;
  SELECT sm.is_muted INTO is_muted FROM server_members sm WHERE sm.server_id = channel_server_id AND sm.user_id = _user_id AND sm.is_banned = false;
  IF is_muted IS NULL THEN RAISE EXCEPTION 'Not a member of this server'; END IF;
  IF is_muted THEN RAISE EXCEPTION 'You are muted in this server'; END IF;
  INSERT INTO messages (channel_id, user_id, content, reply_to_id) VALUES (_channel_id, _user_id, _content, _reply_to_id) RETURNING id INTO new_message_id;
  SELECT json_build_object('id', m.id, 'channel_id', m.channel_id, 'user_id', m.user_id, 'content', m.content, 'reply_to_id', m.reply_to_id, 'is_pinned', m.is_pinned, 'edited_at', m.edited_at, 'created_at', m.created_at) INTO result FROM messages m WHERE m.id = new_message_id;
  RETURN result;
END;
$$;

DROP FUNCTION IF EXISTS public.edit_message(uuid, uuid, text);
CREATE OR REPLACE FUNCTION public.edit_message(_message_id uuid, _content text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; result json; msg_channel_id uuid;
BEGIN
  _user_id := public.require_auth();
  IF _content IS NULL OR trim(_content) = '' THEN RAISE EXCEPTION 'Message cannot be empty'; END IF;
  IF char_length(_content) > 2000 THEN RAISE EXCEPTION 'Message must be 2000 characters or less'; END IF;
  IF NOT EXISTS (SELECT 1 FROM messages WHERE id = _message_id AND user_id = _user_id) THEN RAISE EXCEPTION 'Permission denied'; END IF;
  SELECT m.channel_id INTO msg_channel_id FROM messages m WHERE m.id = _message_id;
  IF NOT public.check_user_permission(_user_id, msg_channel_id, 'send_messages') THEN RAISE EXCEPTION 'You do not have permission to send messages in this channel'; END IF;
  UPDATE messages SET content = _content, edited_at = now() WHERE id = _message_id;
  SELECT json_build_object('id', m.id, 'channel_id', m.channel_id, 'user_id', m.user_id, 'content', m.content, 'reply_to_id', m.reply_to_id, 'is_pinned', m.is_pinned, 'edited_at', m.edited_at, 'created_at', m.created_at) INTO result FROM messages m WHERE m.id = _message_id;
  RETURN result;
END;
$$;

DROP FUNCTION IF EXISTS public.delete_message(uuid, uuid);
CREATE OR REPLACE FUNCTION public.delete_message(_message_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; _msg_user_id uuid; _channel_id uuid; _server_id uuid;
BEGIN
  _user_id := public.require_auth();
  SELECT user_id, channel_id INTO _msg_user_id, _channel_id FROM messages WHERE id = _message_id;
  IF _msg_user_id IS NULL THEN RAISE EXCEPTION 'Message not found'; END IF;
  IF _msg_user_id = _user_id THEN DELETE FROM messages WHERE id = _message_id; RETURN; END IF;
  SELECT server_id INTO _server_id FROM channels WHERE id = _channel_id;
  IF EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN DELETE FROM messages WHERE id = _message_id; RETURN; END IF;
  IF public.check_user_permission(_user_id, _channel_id, 'manage_messages'::permission_type) THEN DELETE FROM messages WHERE id = _message_id; RETURN; END IF;
  RAISE EXCEPTION 'You do not have permission to delete this message';
END;
$$;

DROP FUNCTION IF EXISTS public.pin_message(uuid, uuid, boolean);
CREATE OR REPLACE FUNCTION public.pin_message(_message_id uuid, _pinned boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; _channel_id uuid; _server_id uuid;
BEGIN
  _user_id := public.require_auth();
  SELECT channel_id INTO _channel_id FROM messages WHERE id = _message_id;
  IF _channel_id IS NULL THEN RAISE EXCEPTION 'Message not found'; END IF;
  SELECT server_id INTO _server_id FROM channels WHERE id = _channel_id;
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT public.check_user_permission(_user_id, _channel_id, 'pin_messages'::permission_type) THEN RAISE EXCEPTION 'You do not have permission to pin messages'; END IF;
  END IF;
  UPDATE messages SET is_pinned = _pinned WHERE id = _message_id;
END;
$$;

DROP FUNCTION IF EXISTS public.add_reaction(uuid, uuid, text);
CREATE OR REPLACE FUNCTION public.add_reaction(_message_id uuid, _emoji text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; channel_id uuid; channel_server_id uuid; new_reaction_id uuid; result json;
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
$$;

DROP FUNCTION IF EXISTS public.remove_reaction(uuid, uuid, text);
CREATE OR REPLACE FUNCTION public.remove_reaction(_message_id uuid, _emoji text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; channel_id uuid;
BEGIN
  _user_id := public.require_auth();
  SELECT m.channel_id INTO channel_id FROM messages m WHERE m.id = _message_id;
  IF channel_id IS NULL THEN RAISE EXCEPTION 'Message not found'; END IF;
  IF NOT public.check_user_permission(_user_id, channel_id, 'add_reactions') THEN RAISE EXCEPTION 'You do not have permission to remove reactions in this channel'; END IF;
  DELETE FROM reactions WHERE message_id = _message_id AND user_id = _user_id AND emoji = _emoji;
  RETURN true;
END;
$$;

DROP FUNCTION IF EXISTS public.set_message_embed_hidden(uuid, uuid, boolean);
CREATE OR REPLACE FUNCTION public.set_message_embed_hidden(_message_id uuid, _hidden boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; v_message_user_id UUID;
BEGIN
  _user_id := public.require_auth();
  SELECT user_id INTO v_message_user_id FROM messages WHERE id = _message_id;
  IF v_message_user_id IS NULL THEN RETURN false; END IF;
  IF v_message_user_id != _user_id THEN RETURN false; END IF;
  UPDATE messages SET embed_hidden = _hidden WHERE id = _message_id;
  RETURN true;
END;
$$;

DROP FUNCTION IF EXISTS public.send_poll(uuid, uuid, text, text[], boolean, integer, uuid);
CREATE OR REPLACE FUNCTION public.send_poll(_channel_id uuid, _question text, _options text[], _allow_multiple boolean DEFAULT false, _duration_seconds integer DEFAULT 1800, _reply_to_id uuid DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; channel_server_id uuid; is_muted boolean; new_message_id uuid; new_poll_id uuid; _ends_at timestamptz; _n integer; _results_init jsonb; result json;
BEGIN
  _user_id := public.require_auth();
  IF _question IS NULL OR length(trim(_question)) = 0 THEN RAISE EXCEPTION 'Poll question is required'; END IF;
  _n := COALESCE(array_length(_options, 1), 0);
  IF _n < 2 OR _n > 4 THEN RAISE EXCEPTION 'Poll must have 2-4 options'; END IF;
  IF _duration_seconds IS NULL OR _duration_seconds < 60 THEN RAISE EXCEPTION 'Poll duration must be at least 60 seconds'; END IF;
  SELECT server_id INTO channel_server_id FROM public.channels WHERE id = _channel_id;
  IF channel_server_id IS NULL THEN RAISE EXCEPTION 'Channel not found'; END IF;
  SELECT sm.is_muted INTO is_muted FROM public.server_members sm WHERE sm.server_id = channel_server_id AND sm.user_id = _user_id AND sm.is_banned = false;
  IF is_muted IS NULL THEN RAISE EXCEPTION 'Not a member of this server'; END IF;
  IF is_muted THEN RAISE EXCEPTION 'You are muted in this server'; END IF;
  IF NOT public.check_user_permission(_user_id, _channel_id, 'send_messages') THEN RAISE EXCEPTION 'You do not have permission to send messages in this channel'; END IF;
  IF (SELECT is_read_only FROM public.channels WHERE id = _channel_id) = true THEN
    IF NOT public.check_user_permission(_user_id, _channel_id, 'manage_messages') THEN RAISE EXCEPTION 'This channel is read-only'; END IF;
  END IF;
  _ends_at := now() + make_interval(secs => _duration_seconds);
  new_poll_id := gen_random_uuid();
  INSERT INTO public.messages (channel_id, user_id, content, reply_to_id) VALUES (_channel_id, _user_id, '__kloak_poll__:' || new_poll_id::text, _reply_to_id) RETURNING id INTO new_message_id;
  SELECT jsonb_agg(0) INTO _results_init FROM generate_series(1, _n);
  INSERT INTO public.polls (id, message_id, channel_id, created_by, question, options, allow_multiple, ends_at, is_closed, results, total_votes) VALUES (new_poll_id, new_message_id, _channel_id, _user_id, trim(_question), _options, COALESCE(_allow_multiple, false), _ends_at, false, COALESCE(_results_init, '[]'::jsonb), 0);
  SELECT json_build_object('id', m.id, 'channel_id', m.channel_id, 'user_id', m.user_id, 'content', m.content, 'reply_to_id', m.reply_to_id, 'is_pinned', m.is_pinned, 'edited_at', m.edited_at, 'created_at', m.created_at) INTO result FROM public.messages m WHERE m.id = new_message_id;
  RETURN result;
END;
$$;

-- ====== FRIEND FUNCTIONS ======

DROP FUNCTION IF EXISTS public.send_friend_request(uuid, text);
CREATE OR REPLACE FUNCTION public.send_friend_request(_addressee_username text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _requester_id uuid; _addressee_id uuid; _existing_friendship record; _declined_request record; _new_friendship record; _cooldown_minutes int := 5; _time_since_decline interval; _remaining_minutes int;
BEGIN
  _requester_id := public.require_auth();
  SELECT id INTO _addressee_id FROM users WHERE lower(username) = lower(_addressee_username);
  IF _addressee_id IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;
  IF _addressee_id = _requester_id THEN RAISE EXCEPTION 'Cannot send friend request to yourself'; END IF;
  SELECT * INTO _existing_friendship FROM friendships WHERE (requester_id = _requester_id AND addressee_id = _addressee_id) OR (requester_id = _addressee_id AND addressee_id = _requester_id);
  IF _existing_friendship IS NOT NULL THEN
    IF _existing_friendship.status = 'accepted' THEN RAISE EXCEPTION 'Already friends with this user'; END IF;
    IF _existing_friendship.status = 'blocked' THEN RAISE EXCEPTION 'Cannot send friend request'; END IF;
    IF _existing_friendship.status = 'pending' THEN
      IF _existing_friendship.requester_id = _requester_id THEN RAISE EXCEPTION 'Friend request already pending';
      ELSE UPDATE friendships SET status = 'accepted' WHERE id = _existing_friendship.id RETURNING * INTO _existing_friendship; RETURN json_build_object('id', _existing_friendship.id, 'status', 'accepted'); END IF;
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
  PERFORM create_notification(_user_id := _addressee_id, _type := 'friend_request', _title := 'New Friend Request', _body := (SELECT username FROM users WHERE id = _requester_id) || ' sent you a friend request', _link := '/app');
  RETURN json_build_object('id', _new_friendship.id, 'status', 'pending');
END;
$$;

DROP FUNCTION IF EXISTS public.accept_friend_request(uuid, uuid);
CREATE OR REPLACE FUNCTION public.accept_friend_request(_friendship_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; result json;
BEGIN
  _user_id := public.require_auth();
  IF NOT EXISTS (SELECT 1 FROM friendships WHERE id = _friendship_id AND addressee_id = _user_id AND status = 'pending') THEN RAISE EXCEPTION 'Cannot accept this friend request'; END IF;
  UPDATE friendships SET status = 'accepted' WHERE id = _friendship_id;
  SELECT json_build_object('id', f.id, 'requester_id', f.requester_id, 'addressee_id', f.addressee_id, 'status', f.status, 'created_at', f.created_at) INTO result FROM friendships f WHERE f.id = _friendship_id;
  RETURN result;
END;
$$;

DROP FUNCTION IF EXISTS public.decline_friend_request(uuid, uuid);
CREATE OR REPLACE FUNCTION public.decline_friend_request(_friendship_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; _friendship record;
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
$$;

DROP FUNCTION IF EXISTS public.remove_friend(uuid, uuid);
CREATE OR REPLACE FUNCTION public.remove_friend(_friendship_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid;
BEGIN
  _user_id := public.require_auth();
  DELETE FROM friendships WHERE id = _friendship_id AND (requester_id = _user_id OR addressee_id = _user_id) AND status = 'accepted';
  RETURN FOUND;
END;
$$;

DROP FUNCTION IF EXISTS public.block_user(uuid, uuid);
CREATE OR REPLACE FUNCTION public.block_user(_blocked_user_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; existing_friendship record; result json;
BEGIN
  _user_id := public.require_auth();
  IF _user_id = _blocked_user_id THEN RAISE EXCEPTION 'Cannot block yourself'; END IF;
  SELECT * INTO existing_friendship FROM friendships WHERE (requester_id = _user_id AND addressee_id = _blocked_user_id) OR (requester_id = _blocked_user_id AND addressee_id = _user_id);
  IF existing_friendship IS NOT NULL THEN
    UPDATE friendships SET status = 'blocked', requester_id = _user_id, addressee_id = _blocked_user_id WHERE id = existing_friendship.id;
    SELECT json_build_object('id', f.id, 'requester_id', f.requester_id, 'addressee_id', f.addressee_id, 'status', f.status, 'created_at', f.created_at) INTO result FROM friendships f WHERE f.id = existing_friendship.id;
  ELSE
    INSERT INTO friendships (requester_id, addressee_id, status) VALUES (_user_id, _blocked_user_id, 'blocked') RETURNING json_build_object('id', id, 'requester_id', requester_id, 'addressee_id', addressee_id, 'status', status, 'created_at', created_at) INTO result;
  END IF;
  RETURN result;
END;
$$;

DROP FUNCTION IF EXISTS public.unblock_user(uuid, uuid);
CREATE OR REPLACE FUNCTION public.unblock_user(_blocked_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid;
BEGIN
  _user_id := public.require_auth();
  DELETE FROM friendships WHERE requester_id = _user_id AND addressee_id = _blocked_user_id AND status = 'blocked';
  RETURN true;
END;
$$;

DROP FUNCTION IF EXISTS public.get_user_friends(uuid);
CREATE OR REPLACE FUNCTION public.get_user_friends()
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid;
BEGIN
  _user_id := public.require_auth();
  RETURN (SELECT json_agg(friend) FROM (
    SELECT json_build_object('id', f.id, 'status', f.status, 'created_at', f.created_at, 'user', CASE WHEN f.requester_id = _user_id THEN (SELECT json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'banner_color', u.banner_color, 'status', u.status, 'custom_status', u.custom_status) FROM users u WHERE u.id = f.addressee_id) ELSE (SELECT json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'banner_color', u.banner_color, 'status', u.status, 'custom_status', u.custom_status) FROM users u WHERE u.id = f.requester_id) END) as friend
    FROM friendships f WHERE (f.requester_id = _user_id OR f.addressee_id = _user_id) AND f.status = 'accepted') sub);
END;
$$;

DROP FUNCTION IF EXISTS public.get_pending_friend_requests(uuid);
CREATE OR REPLACE FUNCTION public.get_pending_friend_requests()
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid;
BEGIN
  _user_id := public.require_auth();
  RETURN (SELECT json_agg(request) FROM (
    SELECT json_build_object('id', f.id, 'status', f.status, 'created_at', f.created_at, 'user', (SELECT json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'banner_color', u.banner_color, 'status', u.status) FROM users u WHERE u.id = f.requester_id)) as request
    FROM friendships f WHERE f.addressee_id = _user_id AND f.status = 'pending' ORDER BY f.created_at DESC) sub);
END;
$$;

DROP FUNCTION IF EXISTS public.get_outgoing_friend_requests(uuid);
CREATE OR REPLACE FUNCTION public.get_outgoing_friend_requests()
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid;
BEGIN
  _user_id := public.require_auth();
  RETURN (SELECT json_agg(request) FROM (
    SELECT json_build_object('id', f.id, 'status', f.status, 'created_at', f.created_at, 'user', (SELECT json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'banner_color', u.banner_color, 'status', u.status) FROM users u WHERE u.id = f.addressee_id)) as request
    FROM friendships f WHERE f.requester_id = _user_id AND f.status = 'pending' ORDER BY f.created_at DESC) sub);
END;
$$;

DROP FUNCTION IF EXISTS public.get_blocked_users(uuid);
CREATE OR REPLACE FUNCTION public.get_blocked_users()
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid;
BEGIN
  _user_id := public.require_auth();
  RETURN (SELECT json_agg(blocked) FROM (
    SELECT json_build_object('id', f.id, 'created_at', f.created_at, 'user', (SELECT json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'banner_color', u.banner_color) FROM users u WHERE u.id = f.addressee_id)) as blocked
    FROM friendships f WHERE f.requester_id = _user_id AND f.status = 'blocked') sub);
END;
$$;

DROP FUNCTION IF EXISTS public.get_blocked_user_ids_for_visibility(uuid);
CREATE OR REPLACE FUNCTION public.get_blocked_user_ids_for_visibility()
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid;
BEGIN
  _user_id := public.require_auth();
  RETURN COALESCE((SELECT json_agg(x.other_user_id) FROM (
    SELECT DISTINCT CASE WHEN f.requester_id = _user_id THEN f.addressee_id ELSE f.requester_id END AS other_user_id
    FROM friendships f WHERE f.status = 'blocked' AND (f.requester_id = _user_id OR f.addressee_id = _user_id)) x), '[]'::json);
END;
$$;

-- ====== DM FUNCTIONS ======

DROP FUNCTION IF EXISTS public.get_user_dm_conversations(uuid);
CREATE OR REPLACE FUNCTION public.get_user_dm_conversations()
RETURNS TABLE(conversation json, participants json, last_message json) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid;
BEGIN
  _user_id := public.require_auth();
  RETURN QUERY
  SELECT json_build_object('id', c.id, 'created_at', c.created_at, 'is_group', c.is_group, 'name', c.name, 'created_by', c.created_by) as conversation,
    (SELECT json_agg(json_build_object('user_id', dp2.user_id, 'user', json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'avatar_decoration', u.avatar_decoration, 'status', u.status, 'custom_status', u.custom_status, 'banner_color', u.banner_color, 'last_seen', u.last_seen))) FROM dm_participants dp2 JOIN users u ON u.id = dp2.user_id WHERE dp2.conversation_id = c.id) as participants,
    (SELECT json_build_object('id', dm.id, 'content', dm.content, 'created_at', dm.created_at, 'sender_id', dm.sender_id) FROM direct_messages dm WHERE dm.conversation_id = c.id ORDER BY dm.created_at DESC LIMIT 1) as last_message
  FROM dm_conversations c JOIN dm_participants dp ON dp.conversation_id = c.id WHERE dp.user_id = _user_id
  ORDER BY (SELECT MAX(dm.created_at) FROM direct_messages dm WHERE dm.conversation_id = c.id) DESC NULLS LAST;
END;
$$;

DROP FUNCTION IF EXISTS public.open_dm_conversation(uuid, uuid);
CREATE OR REPLACE FUNCTION public.open_dm_conversation(_other_user_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; existing_conversation_id uuid; new_conversation_id uuid; result json;
BEGIN
  _user_id := public.require_auth();
  SELECT dp1.conversation_id INTO existing_conversation_id FROM dm_participants dp1 JOIN dm_participants dp2 ON dp1.conversation_id = dp2.conversation_id WHERE dp1.user_id = _user_id AND dp2.user_id = _other_user_id;
  IF existing_conversation_id IS NOT NULL THEN
    SELECT json_build_object('id', dc.id, 'created_at', dc.created_at) INTO result FROM dm_conversations dc WHERE dc.id = existing_conversation_id;
    RETURN result;
  END IF;
  IF EXISTS (SELECT 1 FROM friendships f WHERE f.status = 'blocked' AND ((f.requester_id = _user_id AND f.addressee_id = _other_user_id) OR (f.requester_id = _other_user_id AND f.addressee_id = _user_id))) THEN RAISE EXCEPTION 'Cannot message this user'; END IF;
  INSERT INTO dm_conversations DEFAULT VALUES RETURNING id INTO new_conversation_id;
  INSERT INTO dm_participants (conversation_id, user_id) VALUES (new_conversation_id, _user_id), (new_conversation_id, _other_user_id);
  SELECT json_build_object('id', dc.id, 'created_at', dc.created_at) INTO result FROM dm_conversations dc WHERE dc.id = new_conversation_id;
  RETURN result;
END;
$$;

DROP FUNCTION IF EXISTS public.create_group_dm(uuid, uuid[], text);
CREATE OR REPLACE FUNCTION public.create_group_dm(_participant_ids uuid[], _name text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _creator_id uuid; new_conv_id uuid; result json;
BEGIN
  _creator_id := public.require_auth();
  IF array_length(_participant_ids, 1) < 2 THEN RAISE EXCEPTION 'Groups require at least 2 other participants'; END IF;
  INSERT INTO dm_conversations (is_group, name) VALUES (true, _name) RETURNING id INTO new_conv_id;
  INSERT INTO dm_participants (conversation_id, user_id) VALUES (new_conv_id, _creator_id);
  INSERT INTO dm_participants (conversation_id, user_id) SELECT new_conv_id, unnest(_participant_ids);
  SELECT json_build_object('id', dc.id, 'created_at', dc.created_at, 'is_group', dc.is_group, 'name', dc.name,
    'participants', (SELECT json_agg(json_build_object('user_id', dp.user_id, 'user', json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'status', u.status, 'last_seen', u.last_seen))) FROM dm_participants dp JOIN users u ON u.id = dp.user_id WHERE dp.conversation_id = dc.id)
  ) INTO result FROM dm_conversations dc WHERE dc.id = new_conv_id;
  RETURN result;
END;
$$;

DROP FUNCTION IF EXISTS public.get_dm_messages(uuid, uuid, integer, uuid);
CREATE OR REPLACE FUNCTION public.get_dm_messages(_conversation_id uuid, _limit integer DEFAULT 50, _before_id uuid DEFAULT NULL)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid;
BEGIN
  _user_id := public.require_auth();
  IF NOT EXISTS (SELECT 1 FROM dm_participants WHERE conversation_id = _conversation_id AND user_id = _user_id) THEN RAISE EXCEPTION 'Not a participant in this conversation'; END IF;
  RETURN (SELECT json_agg(msg ORDER BY created_at DESC) FROM (
    SELECT json_build_object('id', dm.id, 'conversation_id', dm.conversation_id, 'sender_id', dm.sender_id, 'content', dm.content, 'reply_to_id', dm.reply_to_id, 'edited_at', dm.edited_at, 'created_at', dm.created_at,
      'sender', json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'banner_color', u.banner_color, 'status', u.status)) as msg, dm.created_at
    FROM direct_messages dm JOIN users u ON u.id = dm.sender_id
    WHERE dm.conversation_id = _conversation_id AND (_before_id IS NULL OR dm.created_at < (SELECT created_at FROM direct_messages WHERE id = _before_id))
      AND NOT EXISTS (SELECT 1 FROM friendships f WHERE f.status = 'blocked' AND ((f.requester_id = _user_id AND f.addressee_id = dm.sender_id) OR (f.requester_id = dm.sender_id AND f.addressee_id = _user_id)))
    ORDER BY dm.created_at DESC LIMIT _limit) sub);
END;
$$;

DROP FUNCTION IF EXISTS public.send_dm(uuid, uuid, text, uuid);
CREATE OR REPLACE FUNCTION public.send_dm(_conversation_id uuid, _content text, _reply_to_id uuid DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sender_id uuid; new_message_id uuid; other_user_id uuid; result json;
BEGIN
  _sender_id := public.require_auth();
  IF _content IS NULL OR trim(_content) = '' THEN RAISE EXCEPTION 'Message cannot be empty'; END IF;
  IF char_length(_content) > 2000 THEN RAISE EXCEPTION 'Message must be 2000 characters or less'; END IF;
  IF NOT EXISTS (SELECT 1 FROM dm_participants WHERE conversation_id = _conversation_id AND user_id = _sender_id) THEN RAISE EXCEPTION 'Not a participant in this conversation'; END IF;
  SELECT dp.user_id INTO other_user_id FROM dm_participants dp WHERE dp.conversation_id = _conversation_id AND dp.user_id <> _sender_id LIMIT 1;
  IF other_user_id IS NULL THEN RAISE EXCEPTION 'Conversation has no recipient'; END IF;
  IF EXISTS (SELECT 1 FROM friendships f WHERE f.status = 'blocked' AND ((f.requester_id = _sender_id AND f.addressee_id = other_user_id) OR (f.requester_id = other_user_id AND f.addressee_id = _sender_id))) THEN RAISE EXCEPTION 'Cannot send DM to this user'; END IF;
  INSERT INTO direct_messages (conversation_id, sender_id, content, reply_to_id) VALUES (_conversation_id, _sender_id, _content, _reply_to_id) RETURNING id INTO new_message_id;
  SELECT json_build_object('id', dm.id, 'conversation_id', dm.conversation_id, 'sender_id', dm.sender_id, 'content', dm.content, 'reply_to_id', dm.reply_to_id, 'created_at', dm.created_at, 'edited_at', dm.edited_at) INTO result FROM direct_messages dm WHERE dm.id = new_message_id;
  RETURN result;
END;
$$;

DROP FUNCTION IF EXISTS public.edit_dm(uuid, uuid, text);
CREATE OR REPLACE FUNCTION public.edit_dm(_message_id uuid, _content text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sender_id uuid; result json;
BEGIN
  _sender_id := public.require_auth();
  IF _content IS NULL OR trim(_content) = '' THEN RAISE EXCEPTION 'Message cannot be empty'; END IF;
  IF char_length(_content) > 2000 THEN RAISE EXCEPTION 'Message must be 2000 characters or less'; END IF;
  IF NOT EXISTS (SELECT 1 FROM direct_messages WHERE id = _message_id AND sender_id = _sender_id) THEN RAISE EXCEPTION 'Permission denied'; END IF;
  UPDATE direct_messages SET content = _content, edited_at = now() WHERE id = _message_id;
  SELECT json_build_object('id', dm.id, 'conversation_id', dm.conversation_id, 'sender_id', dm.sender_id, 'content', dm.content, 'reply_to_id', dm.reply_to_id, 'created_at', dm.created_at, 'edited_at', dm.edited_at) INTO result FROM direct_messages dm WHERE dm.id = _message_id;
  RETURN result;
END;
$$;

DROP FUNCTION IF EXISTS public.delete_dm(uuid, uuid);
CREATE OR REPLACE FUNCTION public.delete_dm(_message_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sender_id uuid;
BEGIN
  _sender_id := public.require_auth();
  IF NOT EXISTS (SELECT 1 FROM direct_messages WHERE id = _message_id AND sender_id = _sender_id) THEN RAISE EXCEPTION 'Permission denied'; END IF;
  DELETE FROM direct_messages WHERE id = _message_id;
  RETURN true;
END;
$$;

DROP FUNCTION IF EXISTS public.add_dm_reaction(uuid, uuid, text);
CREATE OR REPLACE FUNCTION public.add_dm_reaction(_message_id uuid, _emoji text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; msg_conversation_id uuid; new_reaction_id uuid; result json;
BEGIN
  _user_id := public.require_auth();
  SELECT conversation_id INTO msg_conversation_id FROM direct_messages WHERE id = _message_id;
  IF NOT EXISTS (SELECT 1 FROM dm_participants WHERE conversation_id = msg_conversation_id AND user_id = _user_id) THEN RAISE EXCEPTION 'Not a participant in this conversation'; END IF;
  INSERT INTO dm_reactions (message_id, user_id, emoji) VALUES (_message_id, _user_id, _emoji) ON CONFLICT (message_id, user_id, emoji) DO NOTHING RETURNING id INTO new_reaction_id;
  IF new_reaction_id IS NULL THEN SELECT id INTO new_reaction_id FROM dm_reactions WHERE message_id = _message_id AND user_id = _user_id AND emoji = _emoji; END IF;
  SELECT json_build_object('id', r.id, 'message_id', r.message_id, 'user_id', r.user_id, 'emoji', r.emoji) INTO result FROM dm_reactions r WHERE r.id = new_reaction_id;
  RETURN result;
END;
$$;

DROP FUNCTION IF EXISTS public.remove_dm_reaction(uuid, uuid, text);
CREATE OR REPLACE FUNCTION public.remove_dm_reaction(_message_id uuid, _emoji text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid;
BEGIN
  _user_id := public.require_auth();
  DELETE FROM dm_reactions WHERE message_id = _message_id AND user_id = _user_id AND emoji = _emoji;
  RETURN true;
END;
$$;

DROP FUNCTION IF EXISTS public.update_group_dm_name(uuid, uuid, text);
CREATE OR REPLACE FUNCTION public.update_group_dm_name(_conversation_id uuid, _new_name text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; v_is_group boolean; v_is_participant boolean;
BEGIN
  _user_id := public.require_auth();
  SELECT is_group INTO v_is_group FROM dm_conversations WHERE id = _conversation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conversation not found'; END IF;
  IF NOT COALESCE(v_is_group, false) THEN RAISE EXCEPTION 'Cannot rename a 1:1 conversation'; END IF;
  SELECT EXISTS (SELECT 1 FROM dm_participants WHERE conversation_id = _conversation_id AND user_id = _user_id) INTO v_is_participant;
  IF NOT v_is_participant THEN RAISE EXCEPTION 'User is not a participant'; END IF;
  UPDATE dm_conversations SET name = NULLIF(TRIM(_new_name), '') WHERE id = _conversation_id;
  RETURN json_build_object('success', true, 'name', NULLIF(TRIM(_new_name), ''));
END;
$$;

DROP FUNCTION IF EXISTS public.add_group_dm_members(uuid, uuid, uuid[]);
CREATE OR REPLACE FUNCTION public.add_group_dm_members(_conversation_id uuid, _new_member_ids uuid[])
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; v_is_group boolean; v_is_participant boolean; v_member_id uuid; v_added_count int := 0;
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
$$;

DROP FUNCTION IF EXISTS public.leave_group_dm(uuid, uuid);
CREATE OR REPLACE FUNCTION public.leave_group_dm(_conversation_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; v_is_group boolean; v_is_participant boolean; v_username text; v_display_name text; v_participant_count int;
BEGIN
  _user_id := public.require_auth();
  SELECT is_group INTO v_is_group FROM dm_conversations WHERE id = _conversation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conversation not found'; END IF;
  IF NOT COALESCE(v_is_group, false) THEN RAISE EXCEPTION 'Cannot leave a 1:1 conversation'; END IF;
  SELECT EXISTS (SELECT 1 FROM dm_participants WHERE conversation_id = _conversation_id AND user_id = _user_id) INTO v_is_participant;
  IF NOT v_is_participant THEN RAISE EXCEPTION 'User is not a participant'; END IF;
  SELECT username, display_name INTO v_username, v_display_name FROM users WHERE id = _user_id;
  INSERT INTO direct_messages (conversation_id, sender_id, content) VALUES (_conversation_id, _user_id, '📤 ' || COALESCE(v_display_name, v_username) || ' has left the group chat');
  DELETE FROM dm_participants WHERE conversation_id = _conversation_id AND user_id = _user_id;
  SELECT COUNT(*) INTO v_participant_count FROM dm_participants WHERE conversation_id = _conversation_id;
  IF v_participant_count <= 1 THEN DELETE FROM dm_conversations WHERE id = _conversation_id; END IF;
  RETURN json_build_object('success', true, 'left_user', COALESCE(v_display_name, v_username));
END;
$$;

-- ====== SERVER FUNCTIONS ======

DROP FUNCTION IF EXISTS public.get_user_servers(uuid);
CREATE OR REPLACE FUNCTION public.get_user_servers()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid;
BEGIN
  _user_id := public.require_auth();
  RETURN (SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
    SELECT s.id, s.name, s.owner_id, s.invite_code, s.icon_url, s.banner_url, s.is_published, s.about, s.system_channel_join_id, s.system_channel_leave_id, s.enable_join_messages, s.enable_leave_messages, s.created_at, sm.role, sm.nickname, sm.joined_at, sm.is_muted, sm.position
    FROM servers s INNER JOIN server_members sm ON sm.server_id = s.id WHERE sm.user_id = _user_id AND (sm.is_banned IS NULL OR sm.is_banned = false) ORDER BY sm.position ASC NULLS LAST, s.name ASC) t);
END;
$$;

DROP FUNCTION IF EXISTS public.create_server_with_owner(text, uuid);
CREATE OR REPLACE FUNCTION public.create_server_with_owner(_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner_id uuid; new_server_id uuid; new_invite_code text; new_category_id uuid; new_channel_id uuid; everyone_role_id uuid; result jsonb;
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
  FROM (VALUES ('send_messages'), ('add_reactions'), ('view_channels'), ('read_message_history'), ('attach_files'), ('embed_links'), ('use_external_emojis'), ('change_nickname'), ('create_instant_invite'), ('connect'), ('speak'), ('use_voice_activation'), ('use_application_commands'), ('mention_roles')) AS p(perm);
  SELECT jsonb_build_object('id', s.id, 'name', s.name, 'owner_id', s.owner_id, 'invite_code', s.invite_code, 'icon_url', s.icon_url, 'banner_url', s.banner_url, 'is_published', s.is_published, 'about', s.about, 'created_at', s.created_at) INTO result FROM servers s WHERE s.id = new_server_id;
  RETURN result;
END;
$$;

DROP FUNCTION IF EXISTS public.update_server(uuid, uuid, jsonb);
CREATE OR REPLACE FUNCTION public.update_server(_server_id uuid, _updates jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid;
BEGIN
  _user_id := public.require_auth();
  IF NOT EXISTS (SELECT 1 FROM server_members WHERE server_id = _server_id AND user_id = _user_id AND role IN ('owner', 'admin')) THEN RAISE EXCEPTION 'Not authorized'; END IF;
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
$$;

DROP FUNCTION IF EXISTS public.join_server_by_invite(text, uuid, text);
CREATE OR REPLACE FUNCTION public.join_server_by_invite(_invite_code text, _join_source text DEFAULT 'invite_link')
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; target_server_id uuid; existing_member record; result json; clean_code text; system_channel_id uuid; enable_join boolean; join_message_content text; invite_row_id uuid; invite_max_uses integer; invite_uses_count integer; invite_expires_at timestamptz; message_id uuid; message_inserted boolean := false; insert_error text;
BEGIN
  _user_id := public.require_auth();
  clean_code := upper(trim(_invite_code));
  SELECT id, system_channel_join_id, enable_join_messages INTO target_server_id, system_channel_id, enable_join FROM servers WHERE trim(invite_code::text) = clean_code;
  IF target_server_id IS NULL THEN
    SELECT si.id, si.server_id, si.max_uses, si.uses_count, si.expires_at INTO invite_row_id, target_server_id, invite_max_uses, invite_uses_count, invite_expires_at FROM public.server_invites si WHERE si.revoked_at IS NULL AND trim(si.code::text) = clean_code FOR UPDATE LIMIT 1;
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
$$;

DROP FUNCTION IF EXISTS public.leave_server(uuid, uuid);
CREATE OR REPLACE FUNCTION public.leave_server(_server_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; user_role text; system_channel_id uuid; enable_leave boolean; leave_message_content text; message_id uuid;
BEGIN
  _user_id := public.require_auth();
  SELECT role INTO user_role FROM server_members WHERE server_id = _server_id AND user_id = _user_id AND is_banned = false;
  IF user_role IS NULL THEN RAISE EXCEPTION 'Not a member of this server'; END IF;
  IF user_role = 'owner' THEN RAISE EXCEPTION 'Server owner cannot leave. Transfer ownership first or delete the server.'; END IF;
  SELECT system_channel_leave_id, enable_leave_messages INTO system_channel_id, enable_leave FROM servers WHERE id = _server_id;
  DELETE FROM server_members WHERE server_id = _server_id AND user_id = _user_id;
  IF system_channel_id IS NOT NULL THEN
    BEGIN leave_message_content := format('<@%s> left', _user_id); INSERT INTO messages (channel_id, user_id, content, is_system_message) VALUES (system_channel_id, _user_id, leave_message_content, TRUE) RETURNING id INTO message_id;
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Failed to post leave message: %', SQLERRM; END;
  END IF;
  RETURN true;
END;
$$;

DROP FUNCTION IF EXISTS public.delete_server(uuid, uuid);
CREATE OR REPLACE FUNCTION public.delete_server(_server_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid;
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
$$;

DROP FUNCTION IF EXISTS public.create_category(uuid, uuid, text, integer);
CREATE OR REPLACE FUNCTION public.create_category(_server_id uuid, _name text, _position integer DEFAULT 0)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; new_category_id uuid; result json;
BEGIN
  _user_id := public.require_auth();
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_channels') THEN RAISE EXCEPTION 'Permission denied'; END IF;
  INSERT INTO channel_categories (server_id, name, position) VALUES (_server_id, _name, _position) RETURNING id INTO new_category_id;
  SELECT json_build_object('id', cc.id, 'server_id', cc.server_id, 'name', cc.name, 'position', cc.position, 'is_collapsed', cc.is_collapsed, 'created_at', cc.created_at) INTO result FROM channel_categories cc WHERE cc.id = new_category_id;
  RETURN result;
END;
$$;

DROP FUNCTION IF EXISTS public.create_channel(uuid, text, text, uuid, uuid, integer, text, boolean, boolean);
CREATE OR REPLACE FUNCTION public.create_channel(_server_id uuid, _name text, _type text DEFAULT 'text', _category_id uuid DEFAULT NULL, _position integer DEFAULT NULL, _icon text DEFAULT NULL, _is_private boolean DEFAULT false, _ghost_mode boolean DEFAULT false)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; new_channel channels%ROWTYPE; final_position integer;
BEGIN
  _user_id := public.require_auth();
  IF NOT check_user_server_permission(_user_id, _server_id, 'manage_channels'::permission_type) THEN RETURN json_build_object('error', 'Permission denied'); END IF;
  IF _position IS NULL THEN SELECT COALESCE(MAX(position), -1) + 1 INTO final_position FROM channels WHERE server_id = _server_id AND ((_category_id IS NULL AND category_id IS NULL) OR category_id = _category_id);
  ELSE final_position := _position; END IF;
  INSERT INTO channels (server_id, name, type, category_id, position, icon, is_private, ghost_mode, is_read_only) VALUES (_server_id, _name, _type::channel_type, _category_id, final_position, _icon, _is_private, _ghost_mode, CASE WHEN _type = 'announcement' THEN false ELSE false END) RETURNING * INTO new_channel;
  IF _is_private AND _user_id IS NOT NULL THEN INSERT INTO channel_members (channel_id, user_id, added_by) VALUES (new_channel.id, _user_id, _user_id) ON CONFLICT DO NOTHING; END IF;
  RETURN row_to_json(new_channel);
END;
$$;

DROP FUNCTION IF EXISTS public.update_channel(uuid, uuid, text);
CREATE OR REPLACE FUNCTION public.update_channel(_channel_id uuid, _updates text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; _server_id uuid; _parsed jsonb; _result jsonb;
BEGIN
  _user_id := public.require_auth();
  SELECT server_id INTO _server_id FROM channels WHERE id = _channel_id;
  IF _server_id IS NULL THEN RAISE EXCEPTION 'Channel not found'; END IF;
  _parsed := _updates::jsonb;
  UPDATE channels SET name = COALESCE(_parsed->>'name', name), topic = CASE WHEN _parsed ? 'topic' THEN (_parsed->>'topic') ELSE topic END, is_nsfw = COALESCE((_parsed->>'is_nsfw')::boolean, is_nsfw), slowmode_seconds = COALESCE((_parsed->>'slowmode_seconds')::int, slowmode_seconds), is_read_only = COALESCE((_parsed->>'is_read_only')::boolean, is_read_only), is_private = COALESCE((_parsed->>'is_private')::boolean, is_private), block_links = COALESCE((_parsed->>'block_links')::boolean, block_links), allowed_link_domains = CASE WHEN _parsed ? 'allowed_link_domains' THEN ARRAY(SELECT jsonb_array_elements_text(_parsed->'allowed_link_domains')) ELSE allowed_link_domains END, ghost_mode = CASE WHEN (_parsed->>'ghost_mode')::boolean = true THEN true ELSE ghost_mode END, icon = CASE WHEN _parsed ? 'icon' THEN (_parsed->>'icon') ELSE icon END WHERE id = _channel_id;
  SELECT jsonb_build_object('id', c.id, 'server_id', c.server_id, 'category_id', c.category_id, 'name', c.name, 'topic', c.topic, 'type', c.type, 'position', c.position, 'is_nsfw', c.is_nsfw, 'slowmode_seconds', c.slowmode_seconds, 'is_read_only', c.is_read_only, 'is_private', c.is_private, 'block_links', c.block_links, 'allowed_link_domains', c.allowed_link_domains, 'ghost_mode', c.ghost_mode, 'icon', c.icon, 'created_at', c.created_at) INTO _result FROM channels c WHERE c.id = _channel_id;
  RETURN _result;
END;
$$;

DROP FUNCTION IF EXISTS public.delete_channel(uuid, uuid);
CREATE OR REPLACE FUNCTION public.delete_channel(_channel_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; _server_id uuid;
BEGIN
  _user_id := public.require_auth();
  SELECT server_id INTO _server_id FROM channels WHERE id = _channel_id;
  IF _server_id IS NULL THEN RAISE EXCEPTION 'Channel not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT EXISTS (SELECT 1 FROM role_permissions rp JOIN server_member_roles smr ON smr.role_id = rp.role_id JOIN server_members sm ON sm.id = smr.member_id WHERE sm.user_id = _user_id AND rp.server_id = _server_id AND rp.permission = 'manage_channels' AND rp.allowed = true) THEN RAISE EXCEPTION 'Only users with manage_channels permission can delete channels'; END IF;
  END IF;
  DELETE FROM messages WHERE channel_id = _channel_id;
  DELETE FROM channels WHERE id = _channel_id;
END;
$$;

DROP FUNCTION IF EXISTS public.update_category(uuid, uuid, text);
CREATE OR REPLACE FUNCTION public.update_category(_category_id uuid, _updates text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; _server_id uuid; _parsed jsonb; _result jsonb;
BEGIN
  _user_id := public.require_auth();
  SELECT server_id INTO _server_id FROM channel_categories WHERE id = _category_id;
  IF _server_id IS NULL THEN RAISE EXCEPTION 'Category not found'; END IF;
  _parsed := _updates::jsonb;
  UPDATE channel_categories SET name = COALESCE(_parsed->>'name', name) WHERE id = _category_id;
  SELECT jsonb_build_object('id', cc.id, 'server_id', cc.server_id, 'name', cc.name, 'position', cc.position, 'created_at', cc.created_at) INTO _result FROM channel_categories cc WHERE cc.id = _category_id;
  RETURN _result;
END;
$$;

DROP FUNCTION IF EXISTS public.delete_category(uuid, uuid);
CREATE OR REPLACE FUNCTION public.delete_category(_category_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; _server_id uuid;
BEGIN
  _user_id := public.require_auth();
  SELECT server_id INTO _server_id FROM channel_categories WHERE id = _category_id;
  IF _server_id IS NULL THEN RAISE EXCEPTION 'Category not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT EXISTS (SELECT 1 FROM role_permissions rp JOIN server_member_roles smr ON smr.role_id = rp.role_id JOIN server_members sm ON sm.id = smr.member_id WHERE sm.user_id = _user_id AND rp.server_id = _server_id AND rp.permission = 'manage_channels' AND rp.allowed = true) THEN RAISE EXCEPTION 'Only users with manage_channels permission can delete categories'; END IF;
  END IF;
  UPDATE channels SET category_id = NULL WHERE category_id = _category_id;
  DELETE FROM channel_categories WHERE id = _category_id;
END;
$$;

DROP FUNCTION IF EXISTS public.kick_member(uuid, uuid, uuid);
CREATE OR REPLACE FUNCTION public.kick_member(_server_id uuid, _target_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid;
BEGIN
  _user_id := public.require_auth();
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT EXISTS (SELECT 1 FROM role_permissions rp JOIN server_member_roles smr ON smr.role_id = rp.role_id JOIN server_members sm ON sm.id = smr.member_id WHERE sm.user_id = _user_id AND rp.server_id = _server_id AND rp.permission = 'kick_members' AND rp.allowed = true) THEN RAISE EXCEPTION 'You do not have permission to kick members'; END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _target_user_id) THEN RAISE EXCEPTION 'Cannot kick the server owner'; END IF;
  DELETE FROM server_member_roles WHERE member_id IN (SELECT id FROM server_members WHERE server_id = _server_id AND user_id = _target_user_id);
  DELETE FROM server_members WHERE server_id = _server_id AND user_id = _target_user_id;
END;
$$;

DROP FUNCTION IF EXISTS public.ban_member(uuid, uuid, uuid);
CREATE OR REPLACE FUNCTION public.ban_member(_server_id uuid, _target_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid;
BEGIN
  _user_id := public.require_auth();
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT EXISTS (SELECT 1 FROM role_permissions rp JOIN server_member_roles smr ON smr.role_id = rp.role_id JOIN server_members sm ON sm.id = smr.member_id WHERE sm.user_id = _user_id AND rp.server_id = _server_id AND rp.permission = 'ban_members' AND rp.allowed = true) THEN RAISE EXCEPTION 'You do not have permission to ban members'; END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _target_user_id) THEN RAISE EXCEPTION 'Cannot ban the server owner'; END IF;
  UPDATE server_members SET is_banned = true WHERE server_id = _server_id AND user_id = _target_user_id;
END;
$$;

DROP FUNCTION IF EXISTS public.create_server_invite(uuid, uuid, integer, integer);
CREATE OR REPLACE FUNCTION public.create_server_invite(_server_id uuid, _expires_in_seconds integer DEFAULT NULL, _max_uses integer DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; new_code char(8); try_count int := 0; expires_at_value timestamptz;
BEGIN
  _user_id := public.require_auth();
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_invites') THEN RAISE EXCEPTION 'Permission denied'; END IF;
  IF _max_uses IS NOT NULL AND _max_uses < 1 THEN RAISE EXCEPTION 'max_uses must be at least 1'; END IF;
  expires_at_value := CASE WHEN _expires_in_seconds IS NULL THEN NULL ELSE now() + make_interval(secs => _expires_in_seconds) END;
  LOOP try_count := try_count + 1; IF try_count > 25 THEN RAISE EXCEPTION 'Failed to generate a unique invite code'; END IF; new_code := public.generate_invite_code();
    BEGIN INSERT INTO public.server_invites (server_id, code, created_by, expires_at, max_uses, uses_count) VALUES (_server_id, new_code, _user_id, expires_at_value, _max_uses, 0); EXIT; EXCEPTION WHEN unique_violation THEN END;
  END LOOP;
  RETURN trim(new_code::text);
END;
$$;

DROP FUNCTION IF EXISTS public.add_channel_member(uuid, uuid, uuid);
CREATE OR REPLACE FUNCTION public.add_channel_member(_channel_id uuid, _target_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _added_by uuid; _channel RECORD;
BEGIN
  _added_by := public.require_auth();
  SELECT id, server_id, is_private INTO _channel FROM channels WHERE id = _channel_id;
  IF NOT FOUND OR NOT _channel.is_private THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM channel_members WHERE channel_id = _channel_id AND user_id = _added_by) AND NOT EXISTS (SELECT 1 FROM server_members WHERE server_id = _channel.server_id AND user_id = _added_by AND role IN ('owner', 'admin')) THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM server_members WHERE server_id = _channel.server_id AND user_id = _target_user_id AND is_banned = false) THEN RETURN false; END IF;
  INSERT INTO channel_members (channel_id, user_id, added_by) VALUES (_channel_id, _target_user_id, _added_by) ON CONFLICT (channel_id, user_id) DO NOTHING;
  RETURN true;
END;
$$;

DROP FUNCTION IF EXISTS public.remove_channel_member(uuid, uuid, uuid);
CREATE OR REPLACE FUNCTION public.remove_channel_member(_channel_id uuid, _target_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _removed_by uuid; _channel RECORD;
BEGIN
  _removed_by := public.require_auth();
  SELECT id, server_id, is_private INTO _channel FROM channels WHERE id = _channel_id;
  IF NOT FOUND OR NOT _channel.is_private THEN RETURN false; END IF;
  IF _removed_by != _target_user_id AND NOT EXISTS (SELECT 1 FROM server_members WHERE server_id = _channel.server_id AND user_id = _removed_by AND role IN ('owner', 'admin')) THEN RETURN false; END IF;
  DELETE FROM channel_members WHERE channel_id = _channel_id AND user_id = _target_user_id;
  RETURN true;
END;
$$;

DROP FUNCTION IF EXISTS public.transfer_ownership(uuid, uuid, uuid);
CREATE OR REPLACE FUNCTION public.transfer_ownership(_server_id uuid, _new_owner_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _current_owner_id uuid; current_owner_member_id uuid; new_owner_member_id uuid; server_actual_owner uuid;
BEGIN
  _current_owner_id := public.require_auth();
  SELECT owner_id INTO server_actual_owner FROM servers WHERE id = _server_id;
  IF server_actual_owner IS NULL OR server_actual_owner != _current_owner_id THEN RAISE EXCEPTION 'Permission denied: only the server owner can transfer ownership'; END IF;
  SELECT id INTO current_owner_member_id FROM server_members WHERE server_id = _server_id AND user_id = _current_owner_id;
  SELECT id INTO new_owner_member_id FROM server_members WHERE server_id = _server_id AND user_id = _new_owner_id AND is_banned = false;
  IF current_owner_member_id IS NULL OR new_owner_member_id IS NULL THEN RAISE EXCEPTION 'Member not found'; END IF;
  UPDATE server_members SET role = 'owner' WHERE id = new_owner_member_id;
  UPDATE server_members SET role = 'admin' WHERE id = current_owner_member_id;
  UPDATE servers SET owner_id = _new_owner_id WHERE id = _server_id;
  RETURN true;
END;
$$;

DROP FUNCTION IF EXISTS public.reorder_categories(uuid, uuid, uuid[]);
CREATE OR REPLACE FUNCTION public.reorder_categories(_server_id uuid, _category_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; i INTEGER;
BEGIN
  _user_id := public.require_auth();
  IF NOT EXISTS (SELECT 1 FROM server_members WHERE server_id = _server_id AND user_id = _user_id AND role IN ('owner', 'admin')) THEN RAISE EXCEPTION 'Permission denied'; END IF;
  FOR i IN 1..array_length(_category_ids, 1) LOOP UPDATE channel_categories SET position = i - 1 WHERE id = _category_ids[i] AND server_id = _server_id; END LOOP;
END;
$$;

DROP FUNCTION IF EXISTS public.reorder_channels(uuid, uuid, uuid, uuid, integer);
CREATE OR REPLACE FUNCTION public.reorder_channels(_server_id uuid, _channel_id uuid, _new_category_id uuid, _new_position integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; _old_category_id UUID; _old_position INTEGER; _rec RECORD; _pos INTEGER;
BEGIN
  _user_id := public.require_auth();
  IF NOT EXISTS (SELECT 1 FROM server_members WHERE server_id = _server_id AND user_id = _user_id AND role IN ('owner', 'admin')) THEN RAISE EXCEPTION 'Permission denied'; END IF;
  SELECT category_id, position INTO _old_category_id, _old_position FROM channels WHERE id = _channel_id AND server_id = _server_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Channel not found'; END IF;
  _pos := 0; FOR _rec IN SELECT id FROM channels WHERE server_id = _server_id AND category_id IS NOT DISTINCT FROM _old_category_id ORDER BY position, created_at LOOP UPDATE channels SET position = _pos WHERE id = _rec.id; _pos := _pos + 1; END LOOP;
  IF NOT (_old_category_id IS NOT DISTINCT FROM _new_category_id) THEN _pos := 0; FOR _rec IN SELECT id FROM channels WHERE server_id = _server_id AND category_id IS NOT DISTINCT FROM _new_category_id ORDER BY position, created_at LOOP UPDATE channels SET position = _pos WHERE id = _rec.id; _pos := _pos + 1; END LOOP; END IF;
  SELECT position INTO _old_position FROM channels WHERE id = _channel_id AND server_id = _server_id;
  IF (_old_category_id IS NOT DISTINCT FROM _new_category_id) THEN
    IF _new_position > _old_position THEN UPDATE channels SET position = position - 1 WHERE server_id = _server_id AND category_id IS NOT DISTINCT FROM _new_category_id AND position > _old_position AND position <= _new_position AND id != _channel_id;
    ELSIF _new_position < _old_position THEN UPDATE channels SET position = position + 1 WHERE server_id = _server_id AND category_id IS NOT DISTINCT FROM _new_category_id AND position >= _new_position AND position < _old_position AND id != _channel_id; END IF;
  ELSE
    UPDATE channels SET position = position - 1 WHERE server_id = _server_id AND category_id IS NOT DISTINCT FROM _old_category_id AND position > _old_position;
    UPDATE channels SET position = position + 1 WHERE server_id = _server_id AND category_id IS NOT DISTINCT FROM _new_category_id AND position >= _new_position;
  END IF;
  UPDATE channels SET category_id = _new_category_id, position = _new_position WHERE id = _channel_id AND server_id = _server_id;
END;
$$;

-- Role management
DROP FUNCTION IF EXISTS public.create_server_role(uuid, uuid, text, text, text);
CREATE OR REPLACE FUNCTION public.create_server_role(_server_id uuid, _name text, _color text, _icon text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; new_role_id uuid;
BEGIN
  _user_id := public.require_auth();
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_roles') THEN RAISE EXCEPTION 'Permission denied'; END IF;
  INSERT INTO server_roles (server_id, name, color, icon, position) VALUES (_server_id, _name, _color, _icon, COALESCE((SELECT MAX(position) FROM server_roles WHERE server_id = _server_id), 0) + 1) RETURNING id INTO new_role_id;
  RETURN (SELECT json_build_object('id', sr.id, 'server_id', sr.server_id, 'name', sr.name, 'color', sr.color, 'icon', sr.icon, 'position', sr.position, 'created_at', sr.created_at) FROM server_roles sr WHERE sr.id = new_role_id);
END;
$$;

DROP FUNCTION IF EXISTS public.update_server_role(uuid, uuid, text, text, text);
CREATE OR REPLACE FUNCTION public.update_server_role(_role_id uuid, _name text DEFAULT NULL, _color text DEFAULT NULL, _icon text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; _server_id uuid; result json;
BEGIN
  _user_id := public.require_auth();
  SELECT server_id INTO _server_id FROM server_roles WHERE id = _role_id;
  IF _server_id IS NULL THEN RAISE EXCEPTION 'Role not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT EXISTS (SELECT 1 FROM role_permissions rp JOIN server_member_roles smr ON smr.role_id = rp.role_id JOIN server_members sm ON sm.id = smr.member_id WHERE sm.user_id = _user_id AND rp.server_id = _server_id AND rp.permission = 'manage_roles' AND rp.allowed = true) THEN RAISE EXCEPTION 'Only users with manage_roles permission can update roles'; END IF;
  END IF;
  UPDATE server_roles SET name = COALESCE(_name, name), color = COALESCE(_color, color), icon = _icon WHERE id = _role_id;
  SELECT row_to_json(r) INTO result FROM server_roles r WHERE r.id = _role_id;
  RETURN result;
END;
$$;

DROP FUNCTION IF EXISTS public.delete_server_role(uuid, uuid);
CREATE OR REPLACE FUNCTION public.delete_server_role(_role_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; _server_id uuid; _role_name text;
BEGIN
  _user_id := public.require_auth();
  SELECT server_id, name INTO _server_id, _role_name FROM server_roles WHERE id = _role_id;
  IF _server_id IS NULL THEN RAISE EXCEPTION 'Role not found'; END IF;
  IF _role_name = '@everyone' THEN RAISE EXCEPTION 'Cannot delete the @everyone role'; END IF;
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT EXISTS (SELECT 1 FROM role_permissions rp JOIN server_member_roles smr ON smr.role_id = rp.role_id JOIN server_members sm ON sm.id = smr.member_id WHERE sm.user_id = _user_id AND rp.server_id = _server_id AND rp.permission = 'manage_roles' AND rp.allowed = true) THEN RAISE EXCEPTION 'Only users with manage_roles permission can delete roles'; END IF;
  END IF;
  DELETE FROM server_member_roles WHERE role_id = _role_id;
  DELETE FROM role_permissions WHERE role_id = _role_id;
  DELETE FROM server_roles WHERE id = _role_id;
END;
$$;

DROP FUNCTION IF EXISTS public.reorder_server_roles(uuid, uuid, uuid[]);
CREATE OR REPLACE FUNCTION public.reorder_server_roles(_server_id uuid, _ordered_role_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; i INT;
BEGIN
  _user_id := public.require_auth();
  IF NOT check_user_server_permission(_user_id, _server_id, 'manage_roles') THEN RAISE EXCEPTION 'Permission denied: cannot reorder roles'; END IF;
  FOR i IN 1..array_length(_ordered_role_ids, 1) LOOP UPDATE server_roles SET position = i - 1 WHERE id = _ordered_role_ids[i] AND server_id = _server_id; END LOOP;
END;
$$;

DROP FUNCTION IF EXISTS public.assign_role_to_member(uuid, uuid, uuid);
CREATE OR REPLACE FUNCTION public.assign_role_to_member(_member_id uuid, _role_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; _server_id uuid; _is_owner boolean; _has_manage_roles boolean;
BEGIN
  _user_id := public.require_auth();
  SELECT server_id INTO _server_id FROM server_members WHERE id = _member_id;
  IF _server_id IS NULL THEN RAISE EXCEPTION 'Member not found'; END IF;
  SELECT (owner_id = _user_id) INTO _is_owner FROM servers WHERE id = _server_id;
  IF _is_owner THEN INSERT INTO server_member_roles (member_id, role_id) VALUES (_member_id, _role_id) ON CONFLICT DO NOTHING; RETURN; END IF;
  SELECT EXISTS (SELECT 1 FROM server_member_roles smr JOIN server_members sm ON sm.id = smr.member_id JOIN role_permissions rp ON rp.role_id = smr.role_id AND rp.server_id = _server_id WHERE sm.user_id = _user_id AND sm.server_id = _server_id AND rp.permission = 'manage_roles' AND rp.allowed = true) INTO _has_manage_roles;
  IF NOT _has_manage_roles THEN RAISE EXCEPTION 'Only admins and owners can assign roles'; END IF;
  INSERT INTO server_member_roles (member_id, role_id) VALUES (_member_id, _role_id) ON CONFLICT DO NOTHING;
END;
$$;

DROP FUNCTION IF EXISTS public.remove_role_from_member(uuid, uuid, uuid);
CREATE OR REPLACE FUNCTION public.remove_role_from_member(_member_id uuid, _role_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; _server_id uuid; _is_owner boolean; _has_manage_roles boolean;
BEGIN
  _user_id := public.require_auth();
  SELECT server_id INTO _server_id FROM server_members WHERE id = _member_id;
  IF _server_id IS NULL THEN RAISE EXCEPTION 'Member not found'; END IF;
  SELECT (owner_id = _user_id) INTO _is_owner FROM servers WHERE id = _server_id;
  IF _is_owner THEN DELETE FROM server_member_roles WHERE member_id = _member_id AND role_id = _role_id; RETURN; END IF;
  SELECT EXISTS (SELECT 1 FROM server_member_roles smr JOIN server_members sm ON sm.id = smr.member_id JOIN role_permissions rp ON rp.role_id = smr.role_id AND rp.server_id = _server_id WHERE sm.user_id = _user_id AND sm.server_id = _server_id AND rp.permission = 'manage_roles' AND rp.allowed = true) INTO _has_manage_roles;
  IF NOT _has_manage_roles THEN RAISE EXCEPTION 'Only admins and owners can remove roles'; END IF;
  DELETE FROM server_member_roles WHERE member_id = _member_id AND role_id = _role_id;
END;
$$;

-- Permission management
DROP FUNCTION IF EXISTS public.set_role_permission(uuid, uuid, permission_type, uuid, text, boolean);
CREATE OR REPLACE FUNCTION public.set_role_permission(_server_id uuid, _permission permission_type, _role_id uuid DEFAULT NULL, _role_name text DEFAULT NULL, _allowed boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid;
BEGIN
  _user_id := public.require_auth();
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT EXISTS (SELECT 1 FROM role_permissions rp JOIN server_member_roles smr ON smr.role_id = rp.role_id JOIN server_members sm ON sm.id = smr.member_id WHERE sm.user_id = _user_id AND rp.server_id = _server_id AND rp.permission = 'manage_roles' AND rp.allowed = true) THEN RAISE EXCEPTION 'Only admins and owners can manage role permissions'; END IF;
  END IF;
  IF _role_id IS NOT NULL THEN INSERT INTO role_permissions (server_id, role_id, permission, allowed) VALUES (_server_id, _role_id, _permission, _allowed) ON CONFLICT (server_id, role_id, permission) WHERE role_id IS NOT NULL DO UPDATE SET allowed = EXCLUDED.allowed;
  ELSIF _role_name IS NOT NULL THEN INSERT INTO role_permissions (server_id, role_name, permission, allowed) VALUES (_server_id, _role_name, _permission, _allowed) ON CONFLICT (server_id, role_name, permission) WHERE role_name IS NOT NULL AND role_id IS NULL DO UPDATE SET allowed = EXCLUDED.allowed;
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.set_channel_permission(uuid, uuid, permission_type, boolean, uuid, text, uuid);
CREATE OR REPLACE FUNCTION public.set_channel_permission(_channel_id uuid, _permission permission_type, _allowed boolean, _role_id uuid DEFAULT NULL, _role_name text DEFAULT NULL, _target_user_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; _server_id uuid;
BEGIN
  _user_id := public.require_auth();
  SELECT server_id INTO _server_id FROM channels WHERE id = _channel_id;
  IF _server_id IS NULL THEN RAISE EXCEPTION 'Channel not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT check_user_server_permission(_user_id, _server_id, 'manage_channels'::permission_type) THEN RAISE EXCEPTION 'You do not have permission to manage channel permissions'; END IF;
  END IF;
  IF _target_user_id IS NOT NULL THEN INSERT INTO channel_permissions (channel_id, user_id, permission, allowed) VALUES (_channel_id, _target_user_id, _permission, _allowed) ON CONFLICT (channel_id, user_id, permission) WHERE user_id IS NOT NULL DO UPDATE SET allowed = EXCLUDED.allowed;
  ELSIF _role_id IS NOT NULL THEN INSERT INTO channel_permissions (channel_id, role_id, permission, allowed) VALUES (_channel_id, _role_id, _permission, _allowed) ON CONFLICT (channel_id, role_id, permission) WHERE role_id IS NOT NULL AND user_id IS NULL DO UPDATE SET allowed = EXCLUDED.allowed;
  ELSIF _role_name IS NOT NULL THEN INSERT INTO channel_permissions (channel_id, role_name, permission, allowed) VALUES (_channel_id, _role_name::server_role, _permission, _allowed) ON CONFLICT (channel_id, role_name, permission) WHERE role_name IS NOT NULL AND role_id IS NULL AND user_id IS NULL DO UPDATE SET allowed = EXCLUDED.allowed;
  ELSE RAISE EXCEPTION 'One of role_id, role_name, or target_user_id must be provided'; END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.delete_role_permission(uuid, uuid);
CREATE OR REPLACE FUNCTION public.delete_role_permission(_permission_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; _server_id uuid;
BEGIN
  _user_id := public.require_auth();
  SELECT server_id INTO _server_id FROM role_permissions WHERE id = _permission_id;
  IF _server_id IS NULL THEN RAISE EXCEPTION 'Permission not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT EXISTS (SELECT 1 FROM role_permissions rp JOIN server_member_roles smr ON smr.role_id = rp.role_id JOIN server_members sm ON sm.id = smr.member_id WHERE sm.user_id = _user_id AND rp.server_id = _server_id AND rp.permission = 'manage_roles' AND rp.allowed = true) THEN RAISE EXCEPTION 'Only admins and owners can manage role permissions'; END IF;
  END IF;
  DELETE FROM role_permissions WHERE id = _permission_id;
END;
$$;

DROP FUNCTION IF EXISTS public.delete_channel_permission(uuid, uuid);
CREATE OR REPLACE FUNCTION public.delete_channel_permission(_permission_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; _server_id uuid; _channel_id uuid;
BEGIN
  _user_id := public.require_auth();
  SELECT cp.channel_id INTO _channel_id FROM channel_permissions cp WHERE cp.id = _permission_id;
  IF _channel_id IS NULL THEN RAISE EXCEPTION 'Permission not found'; END IF;
  SELECT server_id INTO _server_id FROM channels WHERE id = _channel_id;
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT public.check_user_permission(_user_id, _channel_id, 'manage_channels'::permission_type) THEN RAISE EXCEPTION 'You do not have permission to manage channel permissions'; END IF;
  END IF;
  DELETE FROM channel_permissions WHERE id = _permission_id;
END;
$$;

-- Utility functions
DROP FUNCTION IF EXISTS public.reorder_user_servers(uuid, uuid[]);
CREATE OR REPLACE FUNCTION public.reorder_user_servers(_server_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid;
BEGIN
  _user_id := public.require_auth();
  FOR i IN 1..array_length(_server_ids, 1) LOOP UPDATE server_members SET position = i WHERE user_id = _user_id AND server_id = _server_ids[i]; END LOOP;
END;
$$;

DROP FUNCTION IF EXISTS public.get_user_server_folders(uuid);
CREATE OR REPLACE FUNCTION public.get_user_server_folders()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; result JSONB;
BEGIN
  _user_id := public.require_auth();
  SELECT folder_data INTO result FROM public.user_server_folders WHERE user_id = _user_id;
  IF result IS NULL THEN RETURN '{"folders":[],"serverToFolder":{}}'::jsonb; END IF;
  RETURN result;
END;
$$;

DROP FUNCTION IF EXISTS public.save_user_server_folders(uuid, jsonb);
CREATE OR REPLACE FUNCTION public.save_user_server_folders(_folder_data jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid;
BEGIN
  _user_id := public.require_auth();
  INSERT INTO public.user_server_folders (user_id, folder_data, updated_at) VALUES (_user_id, _folder_data, now()) ON CONFLICT (user_id) DO UPDATE SET folder_data = EXCLUDED.folder_data, updated_at = now();
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN RETURN FALSE;
END;
$$;
