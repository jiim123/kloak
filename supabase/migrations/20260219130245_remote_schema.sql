


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "hypopg" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "index_advisor" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."channel_type" AS ENUM (
    'text',
    'voice',
    'announcement',
    'forum',
    'tasks',
    'media'
);


ALTER TYPE "public"."channel_type" OWNER TO "postgres";


CREATE TYPE "public"."friendship_status" AS ENUM (
    'pending',
    'accepted',
    'blocked',
    'declined'
);


ALTER TYPE "public"."friendship_status" OWNER TO "postgres";


CREATE TYPE "public"."mention_type" AS ENUM (
    'user',
    'everyone',
    'here',
    'role'
);


ALTER TYPE "public"."mention_type" OWNER TO "postgres";


CREATE TYPE "public"."notification_type" AS ENUM (
    'mention',
    'dm',
    'friend_request',
    'server_invite',
    'task_assignment'
);


ALTER TYPE "public"."notification_type" OWNER TO "postgres";


CREATE TYPE "public"."permission_type" AS ENUM (
    'manage_server',
    'manage_roles',
    'manage_channels',
    'kick_members',
    'ban_members',
    'mute_members',
    'manage_nicknames',
    'manage_messages',
    'pin_messages',
    'send_messages',
    'add_reactions',
    'view_channels',
    'transfer_ownership',
    'manage_invites',
    'manage_emojis',
    'attach_files',
    'embed_links',
    'read_message_history',
    'mention_everyone',
    'mention_roles',
    'change_nickname',
    'use_external_emojis',
    'manage_webhooks',
    'manage_threads',
    'create_instant_invite',
    'connect',
    'speak',
    'use_voice_activation',
    'deafen_members',
    'move_members',
    'use_application_commands',
    'view_tasks',
    'create_tasks',
    'edit_own_tasks',
    'edit_all_tasks',
    'assign_tasks',
    'change_task_status',
    'delete_tasks'
);


ALTER TYPE "public"."permission_type" OWNER TO "postgres";


CREATE TYPE "public"."server_role" AS ENUM (
    'owner',
    'admin',
    'moderator',
    'member'
);


ALTER TYPE "public"."server_role" OWNER TO "postgres";


CREATE TYPE "public"."task_priority" AS ENUM (
    'low',
    'medium',
    'high'
);


ALTER TYPE "public"."task_priority" OWNER TO "postgres";


CREATE TYPE "public"."task_status" AS ENUM (
    'open',
    'in_progress',
    'completed',
    'archived'
);


ALTER TYPE "public"."task_status" OWNER TO "postgres";


CREATE TYPE "public"."user_status" AS ENUM (
    'online',
    'idle',
    'dnd',
    'offline'
);


ALTER TYPE "public"."user_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_friend_request"("_friendship_id" "uuid", "_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _caller_id uuid;
  _friendship record;
BEGIN
  _caller_id := public.get_request_user_id();
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _user_id IS DISTINCT FROM _caller_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO _friendship
  FROM friendships
  WHERE id = _friendship_id;

  IF _friendship IS NULL THEN
    RAISE EXCEPTION 'Friendship not found';
  END IF;

  IF _friendship.status <> 'pending' THEN
    RAISE EXCEPTION 'Can only accept pending requests';
  END IF;

  -- Only the addressee can accept
  IF _friendship.addressee_id <> _caller_id THEN
    RAISE EXCEPTION 'You can only accept requests sent to you';
  END IF;

  UPDATE friendships SET status = 'accepted' WHERE id = _friendship_id;

  RETURN json_build_object(
    'id', _friendship.id,
    'requester_id', _friendship.requester_id,
    'addressee_id', _friendship.addressee_id,
    'status', 'accepted',
    'created_at', _friendship.created_at
  );
END;
$$;


ALTER FUNCTION "public"."accept_friend_request"("_friendship_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_channel_member"("_channel_id" "uuid", "_target_user_id" "uuid", "_added_by" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _channel RECORD;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_added_by) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get channel info
  SELECT id, server_id, is_private INTO _channel
  FROM channels WHERE id = _channel_id;
  
  IF NOT FOUND OR NOT _channel.is_private THEN
    RETURN false;
  END IF;
  
  -- Check if adder has access to the channel (must be existing member or admin)
  IF NOT EXISTS (
    SELECT 1 FROM channel_members WHERE channel_id = _channel_id AND user_id = _added_by
  ) AND NOT EXISTS (
    SELECT 1 FROM server_members 
    WHERE server_id = _channel.server_id 
    AND user_id = _added_by 
    AND role IN ('owner', 'admin')
  ) THEN
    RETURN false;
  END IF;
  
  -- Check if target is a server member
  IF NOT EXISTS (
    SELECT 1 FROM server_members 
    WHERE server_id = _channel.server_id 
    AND user_id = _target_user_id 
    AND is_banned = false
  ) THEN
    RETURN false;
  END IF;
  
  -- Insert member
  INSERT INTO channel_members (channel_id, user_id, added_by)
  VALUES (_channel_id, _target_user_id, _added_by)
  ON CONFLICT (channel_id, user_id) DO NOTHING;
  
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."add_channel_member"("_channel_id" "uuid", "_target_user_id" "uuid", "_added_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_dm_reaction"("_message_id" "uuid", "_user_id" "uuid", "_emoji" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  msg_conversation_id uuid;
  new_reaction_id uuid;
  result json;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT conversation_id INTO msg_conversation_id FROM direct_messages WHERE id = _message_id;
  
  IF NOT EXISTS (
    SELECT 1 FROM dm_participants 
    WHERE conversation_id = msg_conversation_id AND user_id = _user_id
  ) THEN
    RAISE EXCEPTION 'Not a participant in this conversation';
  END IF;
  
  INSERT INTO dm_reactions (message_id, user_id, emoji)
  VALUES (_message_id, _user_id, _emoji)
  ON CONFLICT (message_id, user_id, emoji) DO NOTHING
  RETURNING id INTO new_reaction_id;
  
  IF new_reaction_id IS NULL THEN
    SELECT id INTO new_reaction_id FROM dm_reactions 
    WHERE message_id = _message_id AND user_id = _user_id AND emoji = _emoji;
  END IF;
  
  SELECT json_build_object('id', r.id, 'message_id', r.message_id, 'user_id', r.user_id, 'emoji', r.emoji)
  INTO result FROM dm_reactions r WHERE r.id = new_reaction_id;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."add_dm_reaction"("_message_id" "uuid", "_user_id" "uuid", "_emoji" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_group_dm_members"("_conversation_id" "uuid", "_user_id" "uuid", "_new_member_ids" "uuid"[]) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_is_group boolean;
  v_is_participant boolean;
  v_member_id uuid;
  v_added_count int := 0;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Check if conversation exists and is a group
  SELECT is_group INTO v_is_group
  FROM dm_conversations
  WHERE id = _conversation_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;
  
  IF NOT COALESCE(v_is_group, false) THEN
    RAISE EXCEPTION 'Cannot add members to a 1:1 conversation';
  END IF;
  
  -- Check if user is a participant
  SELECT EXISTS (
    SELECT 1 FROM dm_participants
    WHERE conversation_id = _conversation_id AND user_id = _user_id
  ) INTO v_is_participant;
  
  IF NOT v_is_participant THEN
    RAISE EXCEPTION 'User is not a participant';
  END IF;
  
  -- Add each new member if not already in the group
  FOREACH v_member_id IN ARRAY _new_member_ids
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM dm_participants
      WHERE conversation_id = _conversation_id AND user_id = v_member_id
    ) THEN
      INSERT INTO dm_participants (conversation_id, user_id)
      VALUES (_conversation_id, v_member_id);
      v_added_count := v_added_count + 1;
    END IF;
  END LOOP;
  
  RETURN json_build_object(
    'success', true,
    'added_count', v_added_count
  );
END;
$$;


ALTER FUNCTION "public"."add_group_dm_members"("_conversation_id" "uuid", "_user_id" "uuid", "_new_member_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_reaction"("_message_id" "uuid", "_user_id" "uuid", "_emoji" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  channel_id uuid;
  channel_server_id uuid;
  new_reaction_id uuid;
  result json;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get the channel_id from the message
  SELECT m.channel_id, c.server_id INTO channel_id, channel_server_id
  FROM messages m
  JOIN channels c ON c.id = m.channel_id
  WHERE m.id = _message_id;
  
  IF channel_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;
  
  -- Check permission using database-backed permission system
  IF NOT public.check_user_permission(_user_id, channel_id, 'add_reactions') THEN
    RAISE EXCEPTION 'You do not have permission to add reactions in this channel';
  END IF;
  
  -- Check if reaction already exists
  IF EXISTS (
    SELECT 1 FROM reactions
    WHERE message_id = _message_id AND user_id = _user_id AND emoji = _emoji
  ) THEN
    -- Reaction already exists, return existing
    SELECT json_build_object(
      'id', r.id,
      'message_id', r.message_id,
      'user_id', r.user_id,
      'emoji', r.emoji
    ) INTO result
    FROM reactions r
    WHERE r.message_id = _message_id AND r.user_id = _user_id AND r.emoji = _emoji
    LIMIT 1;
    
    RETURN result;
  END IF;
  
  -- Insert new reaction
  INSERT INTO reactions (message_id, user_id, emoji)
  VALUES (_message_id, _user_id, _emoji)
  RETURNING id INTO new_reaction_id;
  
  -- Return the reaction
  SELECT json_build_object(
    'id', r.id,
    'message_id', r.message_id,
    'user_id', r.user_id,
    'emoji', r.emoji
  ) INTO result
  FROM reactions r
  WHERE r.id = new_reaction_id;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."add_reaction"("_message_id" "uuid", "_user_id" "uuid", "_emoji" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assert_request_user"("_expected_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _caller_id uuid;
BEGIN
  _caller_id := public.get_request_user_id();
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _expected_user_id IS DISTINCT FROM _caller_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN _caller_id;
END;
$$;


ALTER FUNCTION "public"."assert_request_user"("_expected_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_role_to_member"("_user_id" "uuid", "_member_id" "uuid", "_role_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _server_id uuid;
  _is_owner boolean;
  _has_manage_roles boolean;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get the server from the member
  SELECT server_id INTO _server_id FROM server_members WHERE id = _member_id;
  IF _server_id IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  -- Check if user is server owner
  SELECT (owner_id = _user_id) INTO _is_owner FROM servers WHERE id = _server_id;

  IF _is_owner THEN
    -- Owner can always assign roles
    INSERT INTO server_member_roles (member_id, role_id)
    VALUES (_member_id, _role_id)
    ON CONFLICT DO NOTHING;
    RETURN;
  END IF;

  -- Check manage_roles permission via role_permissions
  SELECT EXISTS (
    SELECT 1
    FROM server_member_roles smr
    JOIN server_members sm ON sm.id = smr.member_id
    JOIN role_permissions rp ON rp.role_id = smr.role_id AND rp.server_id = _server_id
    WHERE sm.user_id = _user_id AND sm.server_id = _server_id
      AND rp.permission = 'manage_roles' AND rp.allowed = true
  ) INTO _has_manage_roles;

  IF NOT _has_manage_roles THEN
    RAISE EXCEPTION 'Only admins and owners can assign roles';
  END IF;

  INSERT INTO server_member_roles (member_id, role_id)
  VALUES (_member_id, _role_id)
  ON CONFLICT DO NOTHING;
END;
$$;


ALTER FUNCTION "public"."assign_role_to_member"("_user_id" "uuid", "_member_id" "uuid", "_role_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_task_users"("_task_id" "uuid", "_user_id" "uuid", "_assignee_ids" "uuid"[]) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  task_channel_id uuid;
  assignee_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get task channel
  SELECT channel_id INTO task_channel_id
  FROM tasks
  WHERE id = _task_id;
  
  IF task_channel_id IS NULL THEN
    RETURN json_build_object('error', 'Task not found');
  END IF;
  
  -- Check permission: assign_tasks
  IF NOT check_user_permission(_user_id, task_channel_id, 'assign_tasks'::permission_type) THEN
    RETURN json_build_object('error', 'Permission denied: assign_tasks');
  END IF;
  
  -- Add assignees
  FOREACH assignee_id IN ARRAY _assignee_ids
  LOOP
    INSERT INTO task_assignees (task_id, user_id, assigned_by)
    VALUES (_task_id, assignee_id, _user_id)
    ON CONFLICT (task_id, user_id) DO NOTHING;
  END LOOP;
  
  RETURN json_build_object('success', true);
END;
$$;


ALTER FUNCTION "public"."assign_task_users"("_task_id" "uuid", "_user_id" "uuid", "_assignee_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ban_member"("_server_id" "uuid", "_user_id" "uuid", "_target_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN server_member_roles smr ON smr.role_id = rp.role_id
      JOIN server_members sm ON sm.id = smr.member_id
      WHERE sm.user_id = _user_id AND rp.server_id = _server_id
        AND rp.permission = 'ban_members' AND rp.allowed = true
    ) THEN
      RAISE EXCEPTION 'You do not have permission to ban members';
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _target_user_id) THEN
    RAISE EXCEPTION 'Cannot ban the server owner';
  END IF;
  UPDATE server_members SET is_banned = true WHERE server_id = _server_id AND user_id = _target_user_id;
END;
$$;


ALTER FUNCTION "public"."ban_member"("_server_id" "uuid", "_user_id" "uuid", "_target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."block_user"("_user_id" "uuid", "_blocked_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _caller_id uuid;
  existing_friendship record;
  result json;
BEGIN
  _caller_id := public.get_request_user_id();
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _user_id IS DISTINCT FROM _caller_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF _caller_id = _blocked_user_id THEN
    RAISE EXCEPTION 'Cannot block yourself';
  END IF;

  -- Check for existing friendship
  SELECT * INTO existing_friendship FROM friendships
  WHERE (requester_id = _caller_id AND addressee_id = _blocked_user_id)
     OR (requester_id = _blocked_user_id AND addressee_id = _caller_id);

  IF existing_friendship IS NOT NULL THEN
    -- Update to blocked status (normalize direction: blocker -> blocked)
    UPDATE friendships
    SET status = 'blocked', requester_id = _caller_id, addressee_id = _blocked_user_id
    WHERE id = existing_friendship.id;

    SELECT json_build_object(
      'id', f.id, 'requester_id', f.requester_id, 'addressee_id', f.addressee_id,
      'status', f.status, 'created_at', f.created_at
    ) INTO result FROM friendships f WHERE f.id = existing_friendship.id;
  ELSE
    -- Create new blocked record
    INSERT INTO friendships (requester_id, addressee_id, status)
    VALUES (_caller_id, _blocked_user_id, 'blocked')
    RETURNING json_build_object(
      'id', id, 'requester_id', requester_id, 'addressee_id', addressee_id, 'status', status, 'created_at', created_at
    )
    INTO result;
  END IF;

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."block_user"("_user_id" "uuid", "_blocked_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_access_channel"("_channel_id" "uuid", "_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _channel RECORD;
  _server_id uuid;
BEGIN
  -- Get channel info
  SELECT id, server_id, is_private INTO _channel
  FROM channels WHERE id = _channel_id;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- If channel is not private, check if user is server member
  IF NOT _channel.is_private THEN
    RETURN EXISTS (
      SELECT 1 FROM server_members 
      WHERE server_id = _channel.server_id 
      AND user_id = _user_id 
      AND is_banned = false
    );
  END IF;
  
  -- If channel is private, check if user is in channel_members
  RETURN EXISTS (
    SELECT 1 FROM channel_members 
    WHERE channel_id = _channel_id 
    AND user_id = _user_id
  );
END;
$$;


ALTER FUNCTION "public"."can_access_channel"("_channel_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."change_member_role"("_server_id" "uuid", "_user_id" "uuid", "_target_user_id" "uuid", "_new_role" "public"."server_role") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  user_role text;
  target_role text;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT role INTO user_role FROM server_members 
  WHERE server_id = _server_id AND user_id = _user_id AND is_banned = false;
  
  SELECT role INTO target_role FROM server_members 
  WHERE server_id = _server_id AND user_id = _target_user_id AND is_banned = false;
  
  IF user_role IS NULL THEN
    RAISE EXCEPTION 'Not a member of this server';
  END IF;
  
  IF target_role IS NULL THEN
    RAISE EXCEPTION 'Target user is not a member of this server';
  END IF;
  
  -- Cannot change to or from owner role (use transfer ownership instead)
  IF _new_role = 'owner' OR target_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot change owner role. Use transfer ownership instead.';
  END IF;
  
  -- Only owner can promote to admin
  IF _new_role = 'admin' AND user_role != 'owner' THEN
    RAISE EXCEPTION 'Only the server owner can promote to admin';
  END IF;
  
  -- Owner and admin can change roles (within their permission)
  IF user_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  -- Admins cannot change other admins' roles
  IF user_role = 'admin' AND target_role = 'admin' THEN
    RAISE EXCEPTION 'Cannot change role of users with equal role';
  END IF;
  
  UPDATE server_members SET role = _new_role WHERE server_id = _server_id AND user_id = _target_user_id;
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."change_member_role"("_server_id" "uuid", "_user_id" "uuid", "_target_user_id" "uuid", "_new_role" "public"."server_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_e2e_status"("_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM user_identity_keys
    WHERE user_id = _user_id
  );
END;
$$;


ALTER FUNCTION "public"."check_e2e_status"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_server_membership"("_server_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _user_id uuid;
  _is_member boolean;
  _server jsonb;
BEGIN
  _user_id := public.requesting_user_id();
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('is_member', false);
  END IF;

  _is_member := public.is_server_member(_server_id, _user_id);
  IF NOT _is_member THEN
    RETURN jsonb_build_object('is_member', false);
  END IF;

  SELECT jsonb_build_object(
    'id', s.id,
    'name', s.name,
    'owner_id', s.owner_id,
    'icon_url', s.icon_url,
    'banner_url', s.banner_url,
    'invite_code', s.invite_code,
    'is_published', s.is_published,
    'about', s.about,
    'created_at', s.created_at,
    'system_channel_join_id', s.system_channel_join_id,
    'system_channel_leave_id', s.system_channel_leave_id,
    'enable_join_messages', s.enable_join_messages,
    'enable_leave_messages', s.enable_leave_messages
  ) INTO _server
  FROM servers s
  WHERE s.id = _server_id;

  RETURN jsonb_build_object('is_member', true, 'server', _server);
END;
$$;


ALTER FUNCTION "public"."check_server_membership"("_server_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_user_permission"("_user_id" "uuid", "_channel_id" "uuid", "_permission" "public"."permission_type") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _server_id uuid;
  _is_owner boolean;
BEGIN
  SELECT server_id INTO _server_id FROM channels WHERE id = _channel_id;
  IF _server_id IS NULL THEN RETURN false; END IF;
  
  _is_owner := EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id);
  IF _is_owner THEN RETURN true; END IF;

  -- Check user-specific channel override
  IF EXISTS (
    SELECT 1 FROM channel_permissions
    WHERE channel_id = _channel_id AND user_id = _user_id AND permission = _permission AND allowed = true
  ) THEN RETURN true; END IF;
  IF EXISTS (
    SELECT 1 FROM channel_permissions
    WHERE channel_id = _channel_id AND user_id = _user_id AND permission = _permission AND allowed = false
  ) THEN RETURN false; END IF;

  -- Check role-based channel overrides
  IF EXISTS (
    SELECT 1 FROM channel_permissions cp
    JOIN server_member_roles smr ON smr.role_id = cp.role_id
    JOIN server_members sm ON sm.id = smr.member_id
    WHERE cp.channel_id = _channel_id AND sm.user_id = _user_id AND cp.permission = _permission AND cp.allowed = false
  ) THEN RETURN false; END IF;
  IF EXISTS (
    SELECT 1 FROM channel_permissions cp
    JOIN server_member_roles smr ON smr.role_id = cp.role_id
    JOIN server_members sm ON sm.id = smr.member_id
    WHERE cp.channel_id = _channel_id AND sm.user_id = _user_id AND cp.permission = _permission AND cp.allowed = true
  ) THEN RETURN true; END IF;

  -- Check @everyone channel overrides
  IF EXISTS (
    SELECT 1 FROM channel_permissions cp
    JOIN server_roles sr ON sr.id = cp.role_id
    WHERE cp.channel_id = _channel_id AND sr.name = '@everyone' AND sr.server_id = _server_id
      AND cp.permission = _permission AND cp.allowed = false
  ) THEN RETURN false; END IF;
  IF EXISTS (
    SELECT 1 FROM channel_permissions cp
    JOIN server_roles sr ON sr.id = cp.role_id
    WHERE cp.channel_id = _channel_id AND sr.name = '@everyone' AND sr.server_id = _server_id
      AND cp.permission = _permission AND cp.allowed = true
  ) THEN RETURN true; END IF;

  -- Check server-wide role permissions
  IF EXISTS (
    SELECT 1 FROM role_permissions rp
    JOIN server_member_roles smr ON smr.role_id = rp.role_id
    JOIN server_members sm ON sm.id = smr.member_id
    WHERE sm.user_id = _user_id AND rp.server_id = _server_id
      AND rp.permission = _permission AND rp.allowed = false
  ) THEN RETURN false; END IF;
  IF EXISTS (
    SELECT 1 FROM role_permissions rp
    JOIN server_member_roles smr ON smr.role_id = rp.role_id
    JOIN server_members sm ON sm.id = smr.member_id
    WHERE sm.user_id = _user_id AND rp.server_id = _server_id
      AND rp.permission = _permission AND rp.allowed = true
  ) THEN RETURN true; END IF;

  -- Check @everyone server-wide permissions
  IF EXISTS (
    SELECT 1 FROM role_permissions rp
    JOIN server_roles sr ON sr.id = rp.role_id
    WHERE sr.name = '@everyone' AND rp.server_id = _server_id
      AND rp.permission = _permission AND rp.allowed = false
  ) THEN RETURN false; END IF;
  IF EXISTS (
    SELECT 1 FROM role_permissions rp
    JOIN server_roles sr ON sr.id = rp.role_id
    WHERE sr.name = '@everyone' AND rp.server_id = _server_id
      AND rp.permission = _permission AND rp.allowed = true
  ) THEN RETURN true; END IF;

  RETURN false;
END; $$;


ALTER FUNCTION "public"."check_user_permission"("_user_id" "uuid", "_channel_id" "uuid", "_permission" "public"."permission_type") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_user_server_permission"("_user_id" "uuid", "_server_id" "uuid", "_permission" "public"."permission_type") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _is_owner boolean;
  _everyone_role_id uuid;
  _member_id uuid;
  _result boolean;
BEGIN
  SELECT (owner_id = _user_id) INTO _is_owner FROM servers WHERE id = _server_id;
  IF _is_owner THEN RETURN true; END IF;

  SELECT id INTO _member_id FROM server_members WHERE server_id = _server_id AND user_id = _user_id;
  IF _member_id IS NULL THEN RETURN false; END IF;

  SELECT id INTO _everyone_role_id FROM server_roles WHERE server_id = _server_id AND name = '@everyone';

  -- 1. Custom role permissions (DENY wins)
  SELECT CASE
    WHEN bool_or(allowed = false) THEN false
    WHEN bool_or(allowed = true) THEN true
    ELSE NULL
  END INTO _result
  FROM role_permissions rp
  JOIN server_member_roles smr ON smr.role_id = rp.role_id AND smr.member_id = _member_id
  WHERE rp.permission = _permission;
  IF _result IS NOT NULL THEN RETURN _result; END IF;

  -- 2. @everyone role permission
  IF _everyone_role_id IS NOT NULL THEN
    SELECT allowed INTO _result FROM role_permissions
    WHERE role_id = _everyone_role_id AND permission = _permission
    LIMIT 1;
    IF _result IS NOT NULL THEN RETURN _result; END IF;
  END IF;

  RETURN false;
END;
$$;


ALTER FUNCTION "public"."check_user_server_permission"("_user_id" "uuid", "_server_id" "uuid", "_permission" "public"."permission_type") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_username_available"("_username" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM users WHERE username = lower(_username)
  );
$$;


ALTER FUNCTION "public"."check_username_available"("_username" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."close_expired_polls"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- 🛡️ Gatekeeper
  IF public.is_maintenance_active() THEN
    RAISE EXCEPTION 'MAINTENANCE_MODE_ACTIVE' USING ERRCODE = 'P0001';
  END IF;

  -- Your original logic
  UPDATE polls 
  SET is_active = false 
  WHERE expires_at < NOW() AND is_active = true;
END;
$$;


ALTER FUNCTION "public"."close_expired_polls"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."close_expired_polls"("_channel_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  r       record;
  closed  int := 0;
BEGIN
  -- GUARD: Maintenance Mode
  IF is_maintenance_active() THEN
    RETURN 0;
  END IF;

  FOR r IN
    SELECT id FROM polls
     WHERE channel_id = _channel_id
       AND is_closed = false
       AND ends_at <= now()
  LOOP
    PERFORM close_poll(r.id);
    closed := closed + 1;
  END LOOP;

  RETURN closed;
END;
$$;


ALTER FUNCTION "public"."close_expired_polls"("_channel_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."close_poll"("_poll_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  poll_row  record;
  opt_count int;
  i         int;
  v         int;
  max_votes int := 0;
  winner    text := '';
  result_text text;
BEGIN
  UPDATE polls
     SET is_closed = true
   WHERE id = _poll_id
     AND is_closed = false
  RETURNING * INTO poll_row;

  IF poll_row IS NULL THEN
    RETURN true;
  END IF;

  opt_count := jsonb_array_length(COALESCE(poll_row.results, '[]'::jsonb));

  IF opt_count > 0 AND COALESCE(poll_row.total_votes, 0) > 0 THEN
    FOR i IN 0..(opt_count - 1) LOOP
      v := COALESCE((poll_row.results ->> i)::int, 0);
      IF v > max_votes THEN
        max_votes := v;
        winner := COALESCE(poll_row.options[i + 1], 'Option ' || (i + 1));
      END IF;
    END LOOP;

    result_text := 'Poll ended: "' || poll_row.question || '" — Winner: ' || winner || ' (' || max_votes || ' vote' || CASE WHEN max_votes = 1 THEN '' ELSE 's' END || ')';
  ELSE
    result_text := 'Poll ended: "' || poll_row.question || '" — No votes were cast';
  END IF;

  INSERT INTO messages (channel_id, user_id, content, is_system_message, reply_to_id)
  VALUES (poll_row.channel_id, poll_row.created_by, result_text, true, poll_row.message_id);

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."close_poll"("_poll_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."count_available_prekeys"("_user_id" "uuid", "_device_id" integer) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  key_count INTEGER;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT COUNT(*) INTO key_count
  FROM user_prekeys
  WHERE user_id = _user_id
    AND device_id = _device_id
    AND is_used = FALSE;

  RETURN key_count;
END;
$$;


ALTER FUNCTION "public"."count_available_prekeys"("_user_id" "uuid", "_device_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_category"("_server_id" "uuid", "_user_id" "uuid", "_name" "text", "_position" integer DEFAULT 0) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  new_category_id uuid;
  result json;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Check permission using database-backed permission system
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_channels') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  INSERT INTO channel_categories (server_id, name, position)
  VALUES (_server_id, _name, _position)
  RETURNING id INTO new_category_id;
  
  SELECT json_build_object(
    'id', cc.id, 'server_id', cc.server_id, 'name', cc.name,
    'position', cc.position, 'is_collapsed', cc.is_collapsed, 'created_at', cc.created_at
  ) INTO result FROM channel_categories cc WHERE cc.id = new_category_id;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."create_category"("_server_id" "uuid", "_user_id" "uuid", "_name" "text", "_position" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_channel"("_server_id" "uuid", "_name" "text", "_type" "text" DEFAULT 'text'::"text", "_user_id" "uuid" DEFAULT NULL::"uuid", "_category_id" "uuid" DEFAULT NULL::"uuid", "_position" integer DEFAULT NULL::integer, "_icon" "text" DEFAULT NULL::"text", "_is_private" boolean DEFAULT false, "_ghost_mode" boolean DEFAULT false) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  new_channel channels%ROWTYPE;
  final_position integer;
BEGIN
  -- Identity verification (conditional for optional user_id)
  IF _user_id IS NOT NULL AND NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Check permission if user_id provided
  IF _user_id IS NOT NULL THEN
    IF NOT check_user_server_permission(_user_id, _server_id, 'manage_channels'::permission_type) THEN
      RETURN json_build_object('error', 'Permission denied');
    END IF;
  END IF;

  -- Calculate position if not provided
  IF _position IS NULL THEN
    SELECT COALESCE(MAX(position), -1) + 1 INTO final_position
    FROM channels
    WHERE server_id = _server_id
      AND ((_category_id IS NULL AND category_id IS NULL) OR category_id = _category_id);
  ELSE
    final_position := _position;
  END IF;

  -- Insert the channel
  -- Ensure announcement channels are NOT read-only by default
  INSERT INTO channels (server_id, name, type, category_id, position, icon, is_private, ghost_mode, is_read_only)
  VALUES (
    _server_id, 
    _name, 
    _type::channel_type, 
    _category_id, 
    final_position, 
    _icon, 
    _is_private, 
    _ghost_mode,
    CASE WHEN _type = 'announcement' THEN false ELSE false END  -- Explicitly set to false for all types
  )
  RETURNING * INTO new_channel;

  -- If private channel and user_id provided, add creator as first member
  IF _is_private AND _user_id IS NOT NULL THEN
    INSERT INTO channel_members (channel_id, user_id, added_by)
    VALUES (new_channel.id, _user_id, _user_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN row_to_json(new_channel);
END;
$$;


ALTER FUNCTION "public"."create_channel"("_server_id" "uuid", "_name" "text", "_type" "text", "_user_id" "uuid", "_category_id" "uuid", "_position" integer, "_icon" "text", "_is_private" boolean, "_ghost_mode" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_group_dm"("_creator_id" "uuid", "_participant_ids" "uuid"[], "_name" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  existing_func_body TEXT;
BEGIN
  IF NOT verify_request_identity(_creator_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
END $$;


ALTER FUNCTION "public"."create_group_dm"("_creator_id" "uuid", "_participant_ids" "uuid"[], "_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_notification"("_user_id" "uuid", "_type" "public"."notification_type", "_title" "text", "_body" "text" DEFAULT NULL::"text", "_link" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  notification_id uuid;
BEGIN
  INSERT INTO notifications (user_id, type, title, body, link)
  VALUES (_user_id, _type, _title, _body, _link)
  RETURNING id INTO notification_id;
  RETURN notification_id;
END;
$$;


ALTER FUNCTION "public"."create_notification"("_user_id" "uuid", "_type" "public"."notification_type", "_title" "text", "_body" "text", "_link" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_server_invite"("_server_id" "uuid", "_user_id" "uuid", "_expires_in_seconds" integer DEFAULT NULL::integer, "_max_uses" integer DEFAULT NULL::integer) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  new_code char(8);
  try_count int := 0;
  expires_at_value timestamptz;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_invites') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF _max_uses IS NOT NULL AND _max_uses < 1 THEN
    RAISE EXCEPTION 'max_uses must be at least 1';
  END IF;

  expires_at_value := CASE
    WHEN _expires_in_seconds IS NULL THEN NULL
    ELSE now() + make_interval(secs => _expires_in_seconds)
  END;

  LOOP
    try_count := try_count + 1;
    IF try_count > 25 THEN
      RAISE EXCEPTION 'Failed to generate a unique invite code';
    END IF;

    new_code := public.generate_invite_code();

    BEGIN
      INSERT INTO public.server_invites (server_id, code, created_by, expires_at, max_uses, uses_count)
      VALUES (_server_id, new_code, _user_id, expires_at_value, _max_uses, 0);
      EXIT;
    EXCEPTION WHEN unique_violation THEN
    END;
  END LOOP;

  RETURN trim(new_code::text);
END;
$$;


ALTER FUNCTION "public"."create_server_invite"("_server_id" "uuid", "_user_id" "uuid", "_expires_in_seconds" integer, "_max_uses" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_server_role"("_server_id" "uuid", "_user_id" "uuid", "_name" "text", "_color" "text", "_icon" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE new_role_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_roles') THEN RAISE EXCEPTION 'Permission denied'; END IF;
  INSERT INTO server_roles (server_id, name, color, icon, position)
  VALUES (_server_id, _name, _color, _icon, COALESCE((SELECT MAX(position) FROM server_roles WHERE server_id = _server_id), 0) + 1)
  RETURNING id INTO new_role_id;
  RETURN (SELECT json_build_object('id', sr.id, 'server_id', sr.server_id, 'name', sr.name, 'color', sr.color, 'icon', sr.icon, 'position', sr.position, 'created_at', sr.created_at) FROM server_roles sr WHERE sr.id = new_role_id);
END; $$;


ALTER FUNCTION "public"."create_server_role"("_server_id" "uuid", "_user_id" "uuid", "_name" "text", "_color" "text", "_icon" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_server_with_owner"("_name" "text", "_owner_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  new_server_id uuid;
  new_invite_code text;
  new_category_id uuid;
  new_channel_id uuid;
  everyone_role_id uuid;
  result jsonb;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_owner_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  new_server_id := gen_random_uuid();
  new_category_id := gen_random_uuid();
  new_channel_id := gen_random_uuid();
  everyone_role_id := gen_random_uuid();
  
  SELECT generate_invite_code() INTO new_invite_code;
  
  INSERT INTO servers (id, name, owner_id, invite_code)
  VALUES (new_server_id, _name, _owner_id, new_invite_code);
  
  INSERT INTO server_members (server_id, user_id, role)
  VALUES (new_server_id, _owner_id, 'owner');
  
  INSERT INTO channel_categories (id, server_id, name, position)
  VALUES (new_category_id, new_server_id, 'Text Channels', 0);
  
  INSERT INTO channels (id, server_id, category_id, name, type, position)
  VALUES (new_channel_id, new_server_id, new_category_id, 'general', 'text', 0);

  -- Create @everyone role with default permissions
  INSERT INTO server_roles (id, server_id, name, color, position, created_at)
  VALUES (everyone_role_id, new_server_id, '@everyone', '#99AAB5', 999, NOW());

  INSERT INTO role_permissions (id, server_id, role_id, permission, allowed, created_at)
  SELECT
    gen_random_uuid(), new_server_id, everyone_role_id, p.perm::permission_type, true, NOW()
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
  FROM servers s WHERE s.id = new_server_id;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."create_server_with_owner"("_name" "text", "_owner_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_task"("_channel_id" "uuid", "_user_id" "uuid", "_title" "text", "_description" "text" DEFAULT NULL::"text", "_priority" "text" DEFAULT 'medium'::"text", "_due_date" timestamp with time zone DEFAULT NULL::timestamp with time zone, "_assignee_ids" "uuid"[] DEFAULT ARRAY[]::"uuid"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  new_task record;
  channel_record record;
  max_position integer;
  assignee_id uuid;
BEGIN
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT c.id, c.server_id INTO channel_record
  FROM channels c WHERE c.id = _channel_id;

  IF channel_record IS NULL THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;

  SELECT COALESCE(MAX(task_position), -1) + 1 INTO max_position
  FROM tasks WHERE channel_id = _channel_id;

  INSERT INTO tasks (channel_id, server_id, created_by, title, description, priority, due_date, task_position)
  VALUES (_channel_id, channel_record.server_id, _user_id, _title, _description, _priority::task_priority, _due_date, max_position)
  RETURNING * INTO new_task;

  IF array_length(_assignee_ids, 1) > 0 THEN
    FOREACH assignee_id IN ARRAY _assignee_ids LOOP
      INSERT INTO task_assignees (task_id, user_id, assigned_by)
      VALUES (new_task.id, assignee_id, _user_id)
      ON CONFLICT (task_id, user_id) DO NOTHING;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'id', new_task.id,
    'channel_id', new_task.channel_id,
    'server_id', new_task.server_id,
    'created_by', new_task.created_by,
    'title', new_task.title,
    'description', new_task.description,
    'priority', new_task.priority::text,
    'status', new_task.status::text,
    'due_date', new_task.due_date,
    'position', new_task.task_position,
    'completed_by', new_task.completed_by,
    'completed_at', new_task.completed_at,
    'created_at', new_task.created_at,
    'updated_at', new_task.updated_at
  );
END;
$$;


ALTER FUNCTION "public"."create_task"("_channel_id" "uuid", "_user_id" "uuid", "_title" "text", "_description" "text", "_priority" "text", "_due_date" timestamp with time zone, "_assignee_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_task_comment"("_task_id" "uuid", "_user_id" "uuid", "_content" "text", "_reply_to_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  task_channel_id uuid;
  new_comment_id uuid;
  reply_to_task_id uuid;
  result json;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get task channel
  SELECT channel_id INTO task_channel_id
  FROM tasks
  WHERE id = _task_id;
  
  IF task_channel_id IS NULL THEN
    RETURN json_build_object('error', 'Task not found');
  END IF;
  
  -- If replying, verify the reply_to comment belongs to the same task
  IF _reply_to_id IS NOT NULL THEN
    SELECT task_id INTO reply_to_task_id
    FROM task_comments
    WHERE id = _reply_to_id;
    
    IF reply_to_task_id IS NULL THEN
      RETURN json_build_object('error', 'Reply target comment not found');
    END IF;
    
    IF reply_to_task_id != _task_id THEN
      RETURN json_build_object('error', 'Reply target must be in the same task');
    END IF;
  END IF;
  
  -- Check permission: view_tasks (need to view to comment)
  IF NOT check_user_permission(_user_id, task_channel_id, 'view_tasks'::permission_type) THEN
    RETURN json_build_object('error', 'Permission denied: view_tasks');
  END IF;
  
  -- Insert comment
  INSERT INTO task_comments (task_id, user_id, content, reply_to_id)
  VALUES (_task_id, _user_id, _content, _reply_to_id)
  RETURNING id INTO new_comment_id;
  
  -- Return the created comment
  SELECT json_build_object(
    'id', tc.id,
    'task_id', tc.task_id,
    'user_id', tc.user_id,
    'content', tc.content,
    'created_at', tc.created_at,
    'edited_at', tc.edited_at,
    'reply_to_id', tc.reply_to_id
  ) INTO result
  FROM task_comments tc
  WHERE tc.id = new_comment_id;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."create_task_comment"("_task_id" "uuid", "_user_id" "uuid", "_content" "text", "_reply_to_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_thread"("_message_id" "uuid", "_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  message_channel_id uuid;
  message_user_id uuid;
  channel_server_id uuid;
  is_muted boolean;
  new_thread_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get message details
  SELECT channel_id, user_id INTO message_channel_id, message_user_id
  FROM messages
  WHERE id = _message_id;

  IF message_channel_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  -- Verify the user is the message author or has permission
  IF message_user_id != _user_id THEN
    -- Check if user has permission to create threads (could be extended for moderation)
    SELECT server_id INTO channel_server_id
    FROM channels
    WHERE id = message_channel_id;

    SELECT sm.is_muted INTO is_muted
    FROM server_members sm
    WHERE sm.server_id = channel_server_id
      AND sm.user_id = _user_id
      AND sm.is_banned = false;

    IF is_muted IS NULL THEN
      RAISE EXCEPTION 'Not a member of this server';
    END IF;
  END IF;

  -- Check if thread already exists for this message
  SELECT id INTO new_thread_id
  FROM threads
  WHERE message_id = _message_id;

  IF new_thread_id IS NOT NULL THEN
    RETURN new_thread_id;
  END IF;

  -- Create the thread
  INSERT INTO threads (channel_id, message_id, created_by)
  VALUES (message_channel_id, _message_id, _user_id)
  RETURNING id INTO new_thread_id;

  RETURN new_thread_id;
END;
$$;


ALTER FUNCTION "public"."create_thread"("_message_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."debug_channel_permissions"("_channel_id" "uuid", "_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  channel_server_id uuid;
  user_base_role server_role;
  user_custom_role_ids uuid[];
  result json;
BEGIN
  -- Get channel's server
  SELECT server_id INTO channel_server_id
  FROM channels
  WHERE id = _channel_id;
  
  IF channel_server_id IS NULL THEN
    RETURN json_build_object('error', 'Channel not found');
  END IF;
  
  -- Get user's base role
  SELECT sm.role INTO user_base_role
  FROM server_members sm
  WHERE sm.server_id = channel_server_id AND sm.user_id = _user_id AND sm.is_banned = false;
  
  -- Get user's custom role IDs
  SELECT COALESCE(ARRAY_AGG(DISTINCT smr.role_id) FILTER (WHERE smr.role_id IS NOT NULL), ARRAY[]::uuid[]) 
  INTO user_custom_role_ids
  FROM server_member_roles smr
  JOIN server_members sm ON sm.id = smr.member_id
  WHERE sm.user_id = _user_id AND sm.server_id = channel_server_id;
  
  -- Get all channel permissions for this channel
  -- Get channel permissions that match this user's roles
  RETURN json_build_object(
    'channel_id', _channel_id,
    'user_id', _user_id,
    'base_role', user_base_role,
    'custom_role_ids', user_custom_role_ids,
    'channel_permissions', (
      SELECT json_agg(
        json_build_object(
          'id', cp.id,
          'role_id', cp.role_id,
          'role_name', cp.role_name,
          'permission', cp.permission,
          'allowed', cp.allowed
        )
      )
      FROM channel_permissions cp
      WHERE cp.channel_id = _channel_id
        AND (
          (cp.role_name = user_base_role AND cp.role_id IS NULL) OR
          (cp.role_id = ANY(COALESCE(user_custom_role_ids, ARRAY[]::uuid[])))
        )
    ),
    'all_channel_permissions', (
      SELECT json_agg(
        json_build_object(
          'id', cp.id,
          'role_id', cp.role_id,
          'role_name', cp.role_name,
          'permission', cp.permission,
          'allowed', cp.allowed
        )
      )
      FROM channel_permissions cp
      WHERE cp.channel_id = _channel_id
    )
  );
END;
$$;


ALTER FUNCTION "public"."debug_channel_permissions"("_channel_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."debug_request_headers"() RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN json_build_object(
    'raw_header', current_setting('request.headers', true)::json->>'x-key-hash',
    'header_exists', (current_setting('request.headers', true)::json->>'x-key-hash') IS NOT NULL
  );
END;
$$;


ALTER FUNCTION "public"."debug_request_headers"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."debug_server_system_messages"("_server_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  server_data record;
  result json;
BEGIN
  SELECT 
    id,
    name,
    system_channel_join_id,
    system_channel_leave_id,
    enable_join_messages,
    enable_leave_messages,
    invite_code
  INTO server_data
  FROM servers
  WHERE id = _server_id;
  
  IF server_data IS NULL THEN
    RETURN json_build_object('error', 'Server not found');
  END IF;
  
  RETURN json_build_object(
    'server_id', server_data.id,
    'server_name', server_data.name,
    'system_channel_join_id', server_data.system_channel_join_id,
    'system_channel_leave_id', server_data.system_channel_leave_id,
    'enable_join_messages', server_data.enable_join_messages,
    'enable_leave_messages', server_data.enable_leave_messages,
    'invite_code', server_data.invite_code,
    'join_channel_exists', EXISTS(SELECT 1 FROM channels WHERE id = server_data.system_channel_join_id),
    'leave_channel_exists', EXISTS(SELECT 1 FROM channels WHERE id = server_data.system_channel_leave_id)
  );
END;
$$;


ALTER FUNCTION "public"."debug_server_system_messages"("_server_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."debug_user_permission"("_user_id" "uuid", "_channel_id" "uuid", "_permission" "public"."permission_type") RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  channel_server_id uuid;
  user_base_role server_role;
  user_custom_role_ids uuid[];
  channel_override_allowed boolean;
  channel_override_source text;
  role_permission_allowed boolean;
  role_permission_source text;
  final_result boolean;
BEGIN
  -- 1. Context
  SELECT server_id INTO channel_server_id FROM channels WHERE id = _channel_id;
  IF channel_server_id IS NULL THEN
    RETURN json_build_object('error', 'Channel not found', 'has_permission', false);
  END IF;

  SELECT sm.role INTO user_base_role
  FROM server_members sm
  WHERE sm.server_id = channel_server_id AND sm.user_id = _user_id AND sm.is_banned = false;
  
  IF user_base_role IS NULL THEN
    RETURN json_build_object('error', 'User not a member', 'has_permission', false);
  END IF;

  -- 2. Owner
  IF user_base_role = 'owner' THEN
    RETURN json_build_object(
      'has_permission', true,
      'source', 'owner_override',
      'base_role', user_base_role,
      'custom_roles', '[]'::json
    );
  END IF;

  -- 3. Custom Roles
  SELECT COALESCE(ARRAY_AGG(DISTINCT smr.role_id) FILTER (WHERE smr.role_id IS NOT NULL), ARRAY[]::uuid[]) 
  INTO user_custom_role_ids
  FROM server_member_roles smr
  JOIN server_members sm ON sm.id = smr.member_id
  WHERE sm.user_id = _user_id AND sm.server_id = channel_server_id;

  -- 4. Channel Check
  SELECT cp.allowed, 
         CASE WHEN cp.role_id IS NOT NULL THEN 'custom_role' ELSE 'base_role' END || ': ' || COALESCE(sr.name, user_base_role::text)
  INTO channel_override_allowed, channel_override_source
  FROM channel_permissions cp
  LEFT JOIN server_roles sr ON sr.id = cp.role_id
  WHERE cp.channel_id = _channel_id
    AND cp.permission = _permission
    AND (
      (cp.role_id = ANY(user_custom_role_ids)) OR
      (cp.role_name = user_base_role AND cp.role_id IS NULL)
    )
  ORDER BY 
    CASE WHEN cp.role_id IS NOT NULL THEN 1 ELSE 2 END,
    CASE WHEN cp.allowed = false THEN 1 ELSE 2 END,
    cp.created_at DESC
  LIMIT 1;

  IF channel_override_allowed IS NOT NULL THEN
    RETURN json_build_object(
      'has_permission', channel_override_allowed,
      'source', 'channel_override',
      'channel_override', json_build_object('allowed', channel_override_allowed, 'source', channel_override_source),
      'base_role', user_base_role
    );
  END IF;

  -- 5. Role Check
  SELECT rp.allowed,
         CASE WHEN rp.role_id IS NOT NULL THEN 'custom_role' ELSE 'base_role' END || ': ' || COALESCE(sr.name, user_base_role::text)
  INTO role_permission_allowed, role_permission_source
  FROM role_permissions rp
  LEFT JOIN server_roles sr ON sr.id = rp.role_id
  WHERE rp.server_id = channel_server_id
    AND rp.permission = _permission
    AND (
      (rp.role_id = ANY(user_custom_role_ids)) OR
      (rp.role_name = user_base_role AND rp.role_id IS NULL)
    )
  ORDER BY 
    CASE WHEN rp.role_id IS NOT NULL THEN 1 ELSE 2 END,
    CASE WHEN rp.allowed = false THEN 1 ELSE 2 END,
    rp.created_at DESC
  LIMIT 1;

  IF role_permission_allowed IS NOT NULL THEN
    RETURN json_build_object(
      'has_permission', role_permission_allowed,
      'source', 'role_permission',
      'role_permission', json_build_object('allowed', role_permission_allowed, 'source', role_permission_source),
      'base_role', user_base_role
    );
  END IF;

  -- 6. Default Fallback
  CASE _permission
    WHEN 'view_channels' THEN final_result := true;
    WHEN 'send_messages' THEN final_result := user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'add_reactions' THEN final_result := user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'manage_messages' THEN final_result := user_base_role IN ('owner', 'admin', 'moderator');
    -- ... add others for complete debug info ...
    ELSE final_result := false;
  END CASE;

  RETURN json_build_object(
    'has_permission', final_result,
    'source', 'default_permission',
    'base_role', user_base_role
  );
END;
$$;


ALTER FUNCTION "public"."debug_user_permission"("_user_id" "uuid", "_channel_id" "uuid", "_permission" "public"."permission_type") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decline_friend_request"("_friendship_id" "uuid", "_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _caller_id uuid;
  _friendship record;
BEGIN
  _caller_id := public.get_request_user_id();
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _user_id IS DISTINCT FROM _caller_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Get the friendship
  SELECT * INTO _friendship
  FROM friendships
  WHERE id = _friendship_id;

  IF _friendship IS NULL THEN
    RAISE EXCEPTION 'Friendship not found';
  END IF;

  -- Only decline/cancel pending requests
  IF _friendship.status <> 'pending' THEN
    RAISE EXCEPTION 'Can only decline pending requests';
  END IF;

  IF _friendship.addressee_id = _caller_id THEN
    -- Record the decline with timestamp (cooldown for requester)
    INSERT INTO declined_friend_requests (requester_id, addressee_id, declined_at)
    VALUES (_friendship.requester_id, _friendship.addressee_id, now())
    ON CONFLICT (requester_id, addressee_id)
    DO UPDATE SET declined_at = now();

    DELETE FROM friendships WHERE id = _friendship_id;
    RETURN true;
  ELSIF _friendship.requester_id = _caller_id THEN
    -- Requester cancels outgoing request (no cooldown)
    DELETE FROM friendships WHERE id = _friendship_id;
    RETURN true;
  ELSE
    RAISE EXCEPTION 'Not authorized to decline/cancel this request';
  END IF;
END;
$$;


ALTER FUNCTION "public"."decline_friend_request"("_friendship_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_announcement_comment"("_comment_id" "uuid", "_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  comment_owner_id uuid;
  msg_channel_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT ac.user_id, m.channel_id INTO comment_owner_id, msg_channel_id
  FROM announcement_comments ac
  JOIN messages m ON m.id = ac.message_id
  WHERE ac.id = _comment_id;
  IF comment_owner_id IS NULL THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;
  IF comment_owner_id != _user_id THEN
    IF NOT check_user_permission(_user_id, msg_channel_id, 'manage_messages') THEN
      RAISE EXCEPTION 'Permission denied: you can only delete your own comments';
    END IF;
  END IF;
  DELETE FROM announcement_comments WHERE id = _comment_id;
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."delete_announcement_comment"("_comment_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_category"("_category_id" "uuid", "_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE _server_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT server_id INTO _server_id FROM channel_categories WHERE id = _category_id;
  IF _server_id IS NULL THEN RAISE EXCEPTION 'Category not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN server_member_roles smr ON smr.role_id = rp.role_id
      JOIN server_members sm ON sm.id = smr.member_id
      WHERE sm.user_id = _user_id AND rp.server_id = _server_id
        AND rp.permission = 'manage_channels' AND rp.allowed = true
    ) THEN RAISE EXCEPTION 'Only users with manage_channels permission can delete categories'; END IF;
  END IF;
  UPDATE channels SET category_id = NULL WHERE category_id = _category_id;
  DELETE FROM channel_categories WHERE id = _category_id;
END; $$;


ALTER FUNCTION "public"."delete_category"("_category_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_category_permission"("_permission_id" "uuid", "_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _server_id uuid;
  _category_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT cp.category_id INTO _category_id FROM category_permissions cp WHERE cp.id = _permission_id;
  IF _category_id IS NULL THEN
    RAISE EXCEPTION 'Permission not found';
  END IF;

  SELECT server_id INTO _server_id FROM channel_categories WHERE id = _category_id;
  IF _server_id IS NULL THEN
    RAISE EXCEPTION 'Category not found';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT check_user_server_permission(_user_id, _server_id, 'manage_channels'::permission_type) THEN
      RAISE EXCEPTION 'You do not have permission to manage category permissions';
    END IF;
  END IF;

  DELETE FROM category_permissions WHERE id = _permission_id;
END;
$$;


ALTER FUNCTION "public"."delete_category_permission"("_permission_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_channel"("_channel_id" "uuid", "_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE _server_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT server_id INTO _server_id FROM channels WHERE id = _channel_id;
  IF _server_id IS NULL THEN RAISE EXCEPTION 'Channel not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN server_member_roles smr ON smr.role_id = rp.role_id
      JOIN server_members sm ON sm.id = smr.member_id
      WHERE sm.user_id = _user_id AND rp.server_id = _server_id
        AND rp.permission = 'manage_channels' AND rp.allowed = true
    ) THEN RAISE EXCEPTION 'Only users with manage_channels permission can delete channels'; END IF;
  END IF;
  DELETE FROM messages WHERE channel_id = _channel_id;
  DELETE FROM channels WHERE id = _channel_id;
END; $$;


ALTER FUNCTION "public"."delete_channel"("_channel_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_channel_permission"("_permission_id" "uuid", "_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _server_id uuid;
  _channel_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT cp.channel_id INTO _channel_id FROM channel_permissions cp WHERE cp.id = _permission_id;
  IF _channel_id IS NULL THEN
    RAISE EXCEPTION 'Permission not found';
  END IF;
  SELECT server_id INTO _server_id FROM channels WHERE id = _channel_id;
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT public.check_user_permission(_user_id, _channel_id, 'manage_channels'::permission_type) THEN
      RAISE EXCEPTION 'You do not have permission to manage channel permissions';
    END IF;
  END IF;
  DELETE FROM channel_permissions WHERE id = _permission_id;
END;
$$;


ALTER FUNCTION "public"."delete_channel_permission"("_permission_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_dm"("_message_id" "uuid", "_sender_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_sender_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Only sender can delete their message
  IF NOT EXISTS (SELECT 1 FROM direct_messages WHERE id = _message_id AND sender_id = _sender_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  DELETE FROM direct_messages WHERE id = _message_id;
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."delete_dm"("_message_id" "uuid", "_sender_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_forum_thread"("_thread_id" "uuid", "_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_thread RECORD;
  v_member RECORD;
  v_can_manage BOOLEAN := FALSE;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get the thread
  SELECT * INTO v_thread FROM threads WHERE id = _thread_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Thread not found';
  END IF;

  -- Check if user is the thread creator
  IF v_thread.created_by = _user_id THEN
    v_can_manage := TRUE;
  END IF;

  -- If not creator, check if user has manage_messages permission (owner/admin/moderator with permission)
  IF NOT v_can_manage THEN
    -- Get channel's server_id
    DECLARE
      v_server_id UUID;
    BEGIN
      SELECT server_id INTO v_server_id FROM channels WHERE id = v_thread.channel_id;
      
      -- Get member role
      SELECT * INTO v_member FROM server_members 
        WHERE server_id = v_server_id AND user_id = _user_id;
      
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Not a server member';
      END IF;

      -- Owner and admin always can
      IF v_member.role IN ('owner', 'admin') THEN
        v_can_manage := TRUE;
      END IF;

      -- Check role_permissions for manage_messages
      IF NOT v_can_manage THEN
        SELECT EXISTS (
          SELECT 1 FROM role_permissions 
          WHERE server_id = v_server_id 
            AND role_name = v_member.role 
            AND permission = 'manage_messages' 
            AND allowed = TRUE
        ) INTO v_can_manage;
      END IF;

      -- Check custom roles
      IF NOT v_can_manage THEN
        SELECT EXISTS (
          SELECT 1 FROM role_permissions rp
          JOIN server_member_roles smr ON smr.role_id = rp.role_id
          WHERE smr.member_id = v_member.id
            AND rp.permission = 'manage_messages'
            AND rp.allowed = TRUE
        ) INTO v_can_manage;
      END IF;
    END;
  END IF;

  IF NOT v_can_manage THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Delete thread replies (thread_messages)
  DELETE FROM thread_messages WHERE thread_id = _thread_id;

  -- Delete thread reactions for the original message
  DELETE FROM thread_reactions WHERE message_id = v_thread.message_id;

  -- Delete the thread record
  DELETE FROM threads WHERE id = _thread_id;

  -- Delete the original message's reactions
  DELETE FROM reactions WHERE message_id = v_thread.message_id;

  -- Delete the original message
  DELETE FROM messages WHERE id = v_thread.message_id;

  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."delete_forum_thread"("_thread_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_media_comment"("_comment_id" "uuid", "_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  comment_owner_id uuid;
  media_channel_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT mc.user_id, mi.channel_id INTO comment_owner_id, media_channel_id
  FROM media_comments mc
  JOIN media_items mi ON mi.id = mc.media_id
  WHERE mc.id = _comment_id;
  IF comment_owner_id IS NULL THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;
  IF comment_owner_id != _user_id THEN
    IF NOT check_user_permission(_user_id, media_channel_id, 'manage_messages') THEN
      RAISE EXCEPTION 'Permission denied: you can only delete your own comments';
    END IF;
  END IF;
  DELETE FROM media_comments WHERE id = _comment_id;
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."delete_media_comment"("_comment_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_media_item"("_item_id" "uuid", "_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  item_channel_id uuid;
  item_owner_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT channel_id, user_id INTO item_channel_id, item_owner_id FROM media_items WHERE id = _item_id;
  IF item_channel_id IS NULL THEN
    RAISE EXCEPTION 'Media item not found';
  END IF;
  IF item_owner_id != _user_id THEN
    IF NOT check_user_permission(_user_id, item_channel_id, 'manage_messages') THEN
      RAISE EXCEPTION 'Permission denied: you can only delete your own media or need manage_messages permission';
    END IF;
  END IF;
  DELETE FROM media_items WHERE id = _item_id;
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."delete_media_item"("_item_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_message"("_message_id" "uuid", "_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _msg_user_id uuid;
  _channel_id uuid;
  _server_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT user_id, channel_id INTO _msg_user_id, _channel_id FROM messages WHERE id = _message_id;
  IF _msg_user_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;
  IF _msg_user_id = _user_id THEN
    DELETE FROM messages WHERE id = _message_id;
    RETURN;
  END IF;
  SELECT server_id INTO _server_id FROM channels WHERE id = _channel_id;
  IF EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    DELETE FROM messages WHERE id = _message_id;
    RETURN;
  END IF;
  IF public.check_user_permission(_user_id, _channel_id, 'manage_messages'::permission_type) THEN
    DELETE FROM messages WHERE id = _message_id;
    RETURN;
  END IF;
  RAISE EXCEPTION 'You do not have permission to delete this message';
END;
$$;


ALTER FUNCTION "public"."delete_message"("_message_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_old_declined_requests"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Delete declined friendships older than 30 minutes (table has created_at, not updated_at)
  DELETE FROM public.friendships
  WHERE status = 'declined'
  AND created_at < (NOW() - INTERVAL '30 minutes');

  -- Clean up declined_friend_requests log (column is declined_at)
  DELETE FROM public.declined_friend_requests
  WHERE declined_at < (NOW() - INTERVAL '30 minutes');

  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."delete_old_declined_requests"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_role_permission"("_permission_id" "uuid", "_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE _server_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT server_id INTO _server_id FROM role_permissions WHERE id = _permission_id;
  IF _server_id IS NULL THEN RAISE EXCEPTION 'Permission not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN server_member_roles smr ON smr.role_id = rp.role_id
      JOIN server_members sm ON sm.id = smr.member_id
      WHERE sm.user_id = _user_id AND rp.server_id = _server_id
        AND rp.permission = 'manage_roles' AND rp.allowed = true
    ) THEN RAISE EXCEPTION 'Only admins and owners can manage role permissions'; END IF;
  END IF;
  DELETE FROM role_permissions WHERE id = _permission_id;
END; $$;


ALTER FUNCTION "public"."delete_role_permission"("_permission_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_server"("_server_id" "uuid", "_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Check permission using database-backed permission system
  -- Only users with manage_server permission (which only owner has by default) can delete
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_server') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  -- Delete in order: messages -> channels -> categories -> members -> server
  DELETE FROM messages WHERE channel_id IN (SELECT id FROM channels WHERE server_id = _server_id);
  DELETE FROM channels WHERE server_id = _server_id;
  DELETE FROM channel_categories WHERE server_id = _server_id;
  DELETE FROM server_members WHERE server_id = _server_id;
  DELETE FROM servers WHERE id = _server_id;
  
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."delete_server"("_server_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_server_emoji"("_emoji_id" "uuid", "_user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  emoji_server_id uuid;
  emoji_file_path text;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT server_id, file_path INTO emoji_server_id, emoji_file_path FROM server_emojis WHERE id = _emoji_id;
  IF emoji_server_id IS NULL THEN
    RAISE EXCEPTION 'Emoji not found';
  END IF;
  IF NOT check_user_server_permission(_user_id, emoji_server_id, 'manage_emojis') THEN
    RAISE EXCEPTION 'Permission denied: you do not have permission to manage emojis';
  END IF;
  DELETE FROM server_emojis WHERE id = _emoji_id;
  RETURN emoji_file_path;
END;
$$;


ALTER FUNCTION "public"."delete_server_emoji"("_emoji_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_server_role"("_role_id" "uuid", "_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE _server_id uuid; _role_name text;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT server_id, name INTO _server_id, _role_name FROM server_roles WHERE id = _role_id;
  IF _server_id IS NULL THEN RAISE EXCEPTION 'Role not found'; END IF;
  IF _role_name = '@everyone' THEN RAISE EXCEPTION 'Cannot delete the @everyone role'; END IF;
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN server_member_roles smr ON smr.role_id = rp.role_id
      JOIN server_members sm ON sm.id = smr.member_id
      WHERE sm.user_id = _user_id AND rp.server_id = _server_id
        AND rp.permission = 'manage_roles' AND rp.allowed = true
    ) THEN RAISE EXCEPTION 'Only users with manage_roles permission can delete roles'; END IF;
  END IF;
  DELETE FROM server_member_roles WHERE role_id = _role_id;
  DELETE FROM role_permissions WHERE role_id = _role_id;
  DELETE FROM server_roles WHERE id = _role_id;
END; $$;


ALTER FUNCTION "public"."delete_server_role"("_role_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_task"("_task_id" "uuid", "_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  task_channel_id uuid;
  task_created_by uuid;
  can_delete boolean := false;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get task info
  SELECT channel_id, created_by
  INTO task_channel_id, task_created_by
  FROM tasks
  WHERE id = _task_id;
  
  IF task_channel_id IS NULL THEN
    RETURN json_build_object('error', 'Task not found');
  END IF;
  
  -- Check delete permission - only check delete_tasks, no fallbacks
  IF task_created_by = _user_id THEN
    -- Can delete own tasks if has delete_tasks permission
    can_delete := check_user_permission(_user_id, task_channel_id, 'delete_tasks'::permission_type);
  END IF;
  
  -- Can delete all tasks if has delete_tasks permission
  IF NOT can_delete THEN
    can_delete := check_user_permission(_user_id, task_channel_id, 'delete_tasks'::permission_type);
  END IF;
  
  IF NOT can_delete THEN
    RETURN json_build_object('error', 'Permission denied: delete tasks');
  END IF;
  
  -- Delete task (cascade will handle assignees and comments)
  DELETE FROM tasks WHERE id = _task_id;
  
  RETURN json_build_object('success', true);
END;
$$;


ALTER FUNCTION "public"."delete_task"("_task_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_task_comment"("_comment_id" "uuid", "_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  comment_user_id uuid;
  task_channel_id uuid;
  can_delete boolean := false;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get comment info
  SELECT tc.user_id, t.channel_id
  INTO comment_user_id, task_channel_id
  FROM task_comments tc
  JOIN tasks t ON t.id = tc.task_id
  WHERE tc.id = _comment_id;
  
  IF comment_user_id IS NULL THEN
    RETURN json_build_object('error', 'Comment not found');
  END IF;
  
  -- Comment owner can delete
  IF comment_user_id = _user_id THEN
    can_delete := true;
  END IF;
  
  -- Users with manage_messages can delete any comment
  IF NOT can_delete AND task_channel_id IS NOT NULL THEN
    can_delete := check_user_permission(_user_id, task_channel_id, 'manage_messages'::permission_type);
  END IF;
  
  IF NOT can_delete THEN
    RETURN json_build_object('error', 'Permission denied: delete comment');
  END IF;
  
  -- Delete comment
  DELETE FROM task_comments WHERE id = _comment_id;
  
  RETURN json_build_object('success', true);
END;
$$;


ALTER FUNCTION "public"."delete_task_comment"("_comment_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_thread_message"("_message_id" "uuid", "_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  msg_user_id uuid;
  thread_channel_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get message details
  SELECT tm.user_id, t.channel_id INTO msg_user_id, thread_channel_id
  FROM thread_messages tm
  JOIN threads t ON t.id = tm.thread_id
  WHERE tm.id = _message_id;
  
  IF msg_user_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;
  
  -- Author can always delete their own messages
  IF msg_user_id = _user_id THEN
    DELETE FROM thread_messages WHERE id = _message_id;
    RETURN true;
  END IF;
  
  -- Check if user has manage_messages permission (uses full permission hierarchy)
  IF public.check_user_permission(_user_id, thread_channel_id, 'manage_messages') THEN
    DELETE FROM thread_messages WHERE id = _message_id;
    RETURN true;
  END IF;
  
  RAISE EXCEPTION 'Permission denied';
END;
$$;


ALTER FUNCTION "public"."delete_thread_message"("_message_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_user_account"("_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  owned_server RECORD;
  new_owner_id uuid;
  member_count integer;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Verify the user exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = _user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Handle servers owned by this user
  FOR owned_server IN SELECT id FROM servers WHERE owner_id = _user_id LOOP
    -- Count other members in the server
    SELECT COUNT(*) INTO member_count 
    FROM server_members 
    WHERE server_id = owned_server.id AND user_id != _user_id AND is_banned = false;
    
    IF member_count = 0 THEN
      -- No other members, delete the entire server and related data
      DELETE FROM channel_permissions WHERE channel_id IN (SELECT id FROM channels WHERE server_id = owned_server.id);
      DELETE FROM channel_reads WHERE channel_id IN (SELECT id FROM channels WHERE server_id = owned_server.id);
      DELETE FROM reactions WHERE message_id IN (SELECT id FROM messages WHERE channel_id IN (SELECT id FROM channels WHERE server_id = owned_server.id));
      DELETE FROM mentions WHERE message_id IN (SELECT id FROM messages WHERE channel_id IN (SELECT id FROM channels WHERE server_id = owned_server.id));
      DELETE FROM message_attachments WHERE message_id IN (SELECT id FROM messages WHERE channel_id IN (SELECT id FROM channels WHERE server_id = owned_server.id));
      DELETE FROM messages WHERE channel_id IN (SELECT id FROM channels WHERE server_id = owned_server.id);
      DELETE FROM channels WHERE server_id = owned_server.id;
      DELETE FROM channel_categories WHERE server_id = owned_server.id;
      DELETE FROM role_permissions WHERE server_id = owned_server.id;
      DELETE FROM server_member_roles WHERE member_id IN (SELECT id FROM server_members WHERE server_id = owned_server.id);
      DELETE FROM server_members WHERE server_id = owned_server.id;
      DELETE FROM server_roles WHERE server_id = owned_server.id;
      DELETE FROM servers WHERE id = owned_server.id;
    ELSE
      -- Find a new owner: first try to find someone with transfer_ownership permission
      SELECT sm.user_id INTO new_owner_id
      FROM server_members sm
      WHERE sm.server_id = owned_server.id 
        AND sm.user_id != _user_id 
        AND sm.is_banned = false
        AND sm.role IN ('admin', 'owner')
      ORDER BY sm.joined_at ASC
      LIMIT 1;
      
      -- If no admin found, get the oldest member
      IF new_owner_id IS NULL THEN
        SELECT sm.user_id INTO new_owner_id
        FROM server_members sm
        WHERE sm.server_id = owned_server.id 
          AND sm.user_id != _user_id 
          AND sm.is_banned = false
        ORDER BY sm.joined_at ASC
        LIMIT 1;
      END IF;
      
      -- Transfer ownership
      IF new_owner_id IS NOT NULL THEN
        UPDATE servers SET owner_id = new_owner_id WHERE id = owned_server.id;
        UPDATE server_members SET role = 'owner' WHERE server_id = owned_server.id AND user_id = new_owner_id;
      END IF;
    END IF;
  END LOOP;

  -- Delete user's reactions (on regular messages)
  DELETE FROM reactions WHERE user_id = _user_id;
  
  -- Delete user's DM reactions
  DELETE FROM dm_reactions WHERE user_id = _user_id;
  
  -- Delete mentions of this user
  DELETE FROM mentions WHERE user_id = _user_id;
  
  -- Delete user's notifications
  DELETE FROM notifications WHERE user_id = _user_id;
  
  -- Delete user's channel reads
  DELETE FROM channel_reads WHERE user_id = _user_id;
  
  -- Delete message attachments for user's messages
  DELETE FROM message_attachments WHERE message_id IN (SELECT id FROM messages WHERE user_id = _user_id);
  
  -- Delete user's messages (set to deleted or actually delete)
  DELETE FROM messages WHERE user_id = _user_id;
  
  -- Delete DM attachments for user's DMs
  DELETE FROM dm_attachments WHERE message_id IN (SELECT id FROM direct_messages WHERE sender_id = _user_id);
  
  -- Delete user's direct messages
  DELETE FROM direct_messages WHERE sender_id = _user_id;
  
  -- Delete DM participants entries for this user
  DELETE FROM dm_participants WHERE user_id = _user_id;
  
  -- Clean up empty DM conversations (no participants left)
  DELETE FROM dm_conversations WHERE id NOT IN (SELECT DISTINCT conversation_id FROM dm_participants);
  
  -- Delete friendships involving this user
  DELETE FROM friendships WHERE requester_id = _user_id OR addressee_id = _user_id;
  
  -- Delete user's server member roles
  DELETE FROM server_member_roles WHERE member_id IN (SELECT id FROM server_members WHERE user_id = _user_id);
  
  -- Delete user from all servers (as member)
  DELETE FROM server_members WHERE user_id = _user_id;
  
  -- Delete user preferences
  DELETE FROM user_preferences WHERE user_id = _user_id;
  
  -- Finally delete the user
  DELETE FROM users WHERE id = _user_id;
  
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."delete_user_account"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."edit_announcement_comment"("_comment_id" "uuid", "_user_id" "uuid", "_content" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  comment_owner_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT user_id INTO comment_owner_id FROM announcement_comments WHERE id = _comment_id;
  IF comment_owner_id IS NULL THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;
  IF comment_owner_id != _user_id THEN
    RAISE EXCEPTION 'Permission denied: you can only edit your own comments';
  END IF;
  UPDATE announcement_comments SET content = _content, edited_at = now() WHERE id = _comment_id;
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."edit_announcement_comment"("_comment_id" "uuid", "_user_id" "uuid", "_content" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."edit_dm"("_message_id" "uuid", "_sender_id" "uuid", "_content" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result json;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_sender_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  IF _content IS NULL OR trim(_content) = '' THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;
  IF char_length(_content) > 2000 THEN
    RAISE EXCEPTION 'Message must be 2000 characters or less';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM direct_messages WHERE id = _message_id AND sender_id = _sender_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE direct_messages SET content = _content, edited_at = now() WHERE id = _message_id;

  SELECT json_build_object(
    'id', dm.id, 'conversation_id', dm.conversation_id, 'sender_id', dm.sender_id,
    'content', dm.content, 'reply_to_id', dm.reply_to_id,
    'created_at', dm.created_at, 'edited_at', dm.edited_at
  ) INTO result FROM direct_messages dm WHERE dm.id = _message_id;

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."edit_dm"("_message_id" "uuid", "_sender_id" "uuid", "_content" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."edit_media_comment"("_comment_id" "uuid", "_user_id" "uuid", "_content" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  comment_owner_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT user_id INTO comment_owner_id FROM media_comments WHERE id = _comment_id;
  IF comment_owner_id IS NULL THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;
  IF comment_owner_id != _user_id THEN
    RAISE EXCEPTION 'Permission denied: you can only edit your own comments';
  END IF;
  UPDATE media_comments SET content = _content, edited_at = now() WHERE id = _comment_id;
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."edit_media_comment"("_comment_id" "uuid", "_user_id" "uuid", "_content" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."edit_message"("_message_id" "uuid", "_user_id" "uuid", "_content" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result json;
  msg_channel_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  IF _content IS NULL OR trim(_content) = '' THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;
  IF char_length(_content) > 2000 THEN
    RAISE EXCEPTION 'Message must be 2000 characters or less';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM messages WHERE id = _message_id AND user_id = _user_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT m.channel_id INTO msg_channel_id FROM messages m WHERE m.id = _message_id;

  IF NOT public.check_user_permission(_user_id, msg_channel_id, 'send_messages') THEN
    RAISE EXCEPTION 'You do not have permission to send messages in this channel';
  END IF;
  
  UPDATE messages SET content = _content, edited_at = now() WHERE id = _message_id;
  
  SELECT json_build_object(
    'id', m.id, 'channel_id', m.channel_id, 'user_id', m.user_id,
    'content', m.content, 'reply_to_id', m.reply_to_id, 'is_pinned', m.is_pinned,
    'edited_at', m.edited_at, 'created_at', m.created_at
  ) INTO result FROM messages m WHERE m.id = _message_id;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."edit_message"("_message_id" "uuid", "_user_id" "uuid", "_content" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_server_emoji_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  emoji_count integer;
BEGIN
  SELECT COUNT(*) INTO emoji_count
  FROM public.server_emojis
  WHERE server_id = NEW.server_id;

  IF emoji_count >= 30 THEN
    RAISE EXCEPTION 'server emoji limit reached';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_server_emoji_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fetch_key_backup"("_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
    SELECT json_build_object(
        'encrypted_identity_private_key', kb.encrypted_identity_private_key,
        'iv', kb.iv,
        'salt', kb.salt,
        'version', kb.version,
        'registration_id', ik.registration_id,
        'public_key', ik.public_key,
        'key_fingerprint', ik.key_fingerprint
    ) INTO result
    FROM user_key_backups kb
    JOIN user_identity_keys ik ON ik.user_id = kb.user_id
    WHERE kb.user_id = _user_id;

    RETURN result;
END;
$$;


ALTER FUNCTION "public"."fetch_key_backup"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fetch_prekey_bundle"("_target_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result JSON;
  _prekey_id INTEGER;
  _prekey_public TEXT;
BEGIN
  IF public.requesting_user_id() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE user_prekeys
  SET is_used = TRUE
  WHERE id = (
    SELECT id FROM user_prekeys
    WHERE user_id = _target_user_id
      AND is_used = FALSE
    ORDER BY key_id ASC
    LIMIT 1
  )
  RETURNING key_id, public_key INTO _prekey_id, _prekey_public;

  SELECT json_build_object(
    'registration_id', ik.registration_id,
    'identity_public_key', ik.public_key,
    'signed_prekey_id', sp.key_id,
    'signed_prekey_public', sp.public_key,
    'signed_prekey_signature', sp.signature,
    'prekey_id', _prekey_id,
    'prekey_public', _prekey_public
  ) INTO result
  FROM user_identity_keys ik
  LEFT JOIN user_signed_prekeys sp
    ON sp.user_id = ik.user_id AND sp.is_active = TRUE
  WHERE ik.user_id = _target_user_id;

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."fetch_prekey_bundle"("_target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_invite_code"() RETURNS character
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."generate_invite_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_all_channel_unread_counts"("_user_id" "uuid", "_channel_ids" "uuid"[], "_blocked_user_ids" "uuid"[] DEFAULT '{}'::"uuid"[]) RETURNS TABLE("channel_id" "uuid", "unread_count" bigint, "mention_count" integer, "last_read_at" timestamp with time zone, "last_read_message_id" "uuid", "first_unread_message_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  RETURN QUERY
  WITH channel_reads_data AS (
    SELECT 
      cr.channel_id,
      cr.last_read_at,
      cr.last_read_message_id,
      COALESCE(cr.mention_count, 0) AS mention_count
    FROM channel_reads cr
    WHERE cr.user_id = _user_id
      AND cr.channel_id = ANY(_channel_ids)
  ),
  unread_messages AS (
    SELECT 
      m.channel_id,
      m.id as message_id,
      m.created_at
    FROM messages m
    LEFT JOIN channel_reads_data crd ON crd.channel_id = m.channel_id
    WHERE m.channel_id = ANY(_channel_ids)
      AND m.user_id != _user_id
      AND (crd.last_read_at IS NULL OR m.created_at > crd.last_read_at)
      AND (array_length(_blocked_user_ids, 1) IS NULL 
           OR m.user_id != ALL(_blocked_user_ids))
  ),
  unread_counts AS (
    SELECT 
      um.channel_id,
      COUNT(*) AS unread_count
    FROM unread_messages um
    GROUP BY um.channel_id
  ),
  first_unread AS (
    SELECT DISTINCT ON (um.channel_id)
      um.channel_id,
      um.message_id
    FROM unread_messages um
    ORDER BY um.channel_id, um.created_at ASC
  )
  SELECT 
    c.id AS channel_id,
    COALESCE(uc.unread_count, 0)::BIGINT AS unread_count,
    COALESCE(crd.mention_count, 0)::INTEGER AS mention_count,
    crd.last_read_at,
    crd.last_read_message_id,
    fu.message_id AS first_unread_message_id
  FROM unnest(_channel_ids) AS c(id)
  LEFT JOIN channel_reads_data crd ON crd.channel_id = c.id
  LEFT JOIN unread_counts uc ON uc.channel_id = c.id
  LEFT JOIN first_unread fu ON fu.channel_id = c.id;
END;
$$;


ALTER FUNCTION "public"."get_all_channel_unread_counts"("_user_id" "uuid", "_channel_ids" "uuid"[], "_blocked_user_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_banned_members"("_server_id" "uuid", "_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Check permission using database-backed permission system
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'ban_members') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  RETURN (
    SELECT json_agg(
      json_build_object(
        'id', sm.id,
        'user_id', sm.user_id,
        'joined_at', sm.joined_at,
        'user', json_build_object(
          'id', u.id,
          'username', u.username,
          'display_name', u.display_name,
          'avatar_url', u.avatar_url
        )
      )
    )
    FROM server_members sm
    JOIN users u ON u.id = sm.user_id
    WHERE sm.server_id = _server_id AND sm.is_banned = true
  );
END;
$$;


ALTER FUNCTION "public"."get_banned_members"("_server_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_blocked_user_ids_for_visibility"("_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _caller_id uuid;
BEGIN
  _caller_id := public.get_request_user_id();
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _user_id IS DISTINCT FROM _caller_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(x.other_user_id)
      FROM (
        SELECT DISTINCT
          CASE
            WHEN f.requester_id = _caller_id THEN f.addressee_id
            ELSE f.requester_id
          END AS other_user_id
        FROM friendships f
        WHERE f.status = 'blocked'
          AND (f.requester_id = _caller_id OR f.addressee_id = _caller_id)
      ) x
    ),
    '[]'::json
  );
END;
$$;


ALTER FUNCTION "public"."get_blocked_user_ids_for_visibility"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_blocked_users"("_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _caller_id uuid;
BEGIN
  _caller_id := public.get_request_user_id();
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _user_id IS DISTINCT FROM _caller_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN (
    SELECT json_agg(blocked)
    FROM (
      SELECT json_build_object(
        'id', f.id,
        'created_at', f.created_at,
        'user', (
          SELECT json_build_object(
            'id', u.id, 'username', u.username, 'display_name', u.display_name,
            'avatar_url', u.avatar_url, 'banner_color', u.banner_color
          ) FROM users u WHERE u.id = f.addressee_id
        )
      ) as blocked
      FROM friendships f
      WHERE f.requester_id = _caller_id AND f.status = 'blocked'
    ) sub
  );
END;
$$;


ALTER FUNCTION "public"."get_blocked_users"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_channel_members"("_channel_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(
      json_build_object(
        'id', cm.id,
        'channel_id', cm.channel_id,
        'user_id', cm.user_id,
        'added_by', cm.added_by,
        'created_at', cm.created_at,
        'user', json_build_object(
          'id', u.id,
          'username', u.username,
          'display_name', u.display_name,
          'avatar_url', u.avatar_url,
          'status', u.status
        )
      )
    ), '[]'::json)
    FROM channel_members cm
    JOIN users u ON u.id = cm.user_id
    WHERE cm.channel_id = _channel_id
  );
END;
$$;


ALTER FUNCTION "public"."get_channel_members"("_channel_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_channel_messages"("_channel_id" "uuid", "_user_id" "uuid", "_limit" integer DEFAULT 50, "_before_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  channel_server_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT server_id INTO channel_server_id FROM channels WHERE id = _channel_id;

  IF NOT EXISTS (
    SELECT 1 FROM server_members
    WHERE server_id = channel_server_id AND user_id = _user_id AND is_banned = false
  ) THEN
    RAISE EXCEPTION 'Not a member of this server';
  END IF;

  RETURN (
    SELECT json_agg(msg ORDER BY msg.created_at DESC)
    FROM (
      SELECT json_build_object(
        'id', m.id,
        'channel_id', m.channel_id,
        'user_id', m.user_id,
        'content', m.content,
        'reply_to_id', m.reply_to_id,
        'is_pinned', m.is_pinned,
        'edited_at', m.edited_at,
        'created_at', m.created_at,
        'user', json_build_object(
          'id', u.id, 'username', u.username, 'display_name', u.display_name,
          'avatar_url', u.avatar_url, 'banner_color', u.banner_color, 'status', u.status
        )
      ) as msg, m.created_at
      FROM messages m
      JOIN users u ON u.id = m.user_id
      WHERE m.channel_id = _channel_id
        AND (_before_id IS NULL OR m.created_at < (SELECT created_at FROM messages WHERE id = _before_id))
        AND NOT EXISTS (
          SELECT 1
          FROM friendships f
          WHERE f.status = 'blocked'
            AND ((f.requester_id = _user_id AND f.addressee_id = m.user_id)
              OR (f.requester_id = m.user_id AND f.addressee_id = _user_id))
        )
      ORDER BY m.created_at DESC
      LIMIT _limit
    ) sub
  );
END;
$$;


ALTER FUNCTION "public"."get_channel_messages"("_channel_id" "uuid", "_user_id" "uuid", "_limit" integer, "_before_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_channel_permissions"("_channel_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', cp.id,
          'channel_id', cp.channel_id,
          'role_id', cp.role_id,
          'role_name', cp.role_name,
          'user_id', cp.user_id,
          'permission', cp.permission,
          'allowed', cp.allowed,
          'created_at', cp.created_at
        ) ORDER BY cp.created_at ASC
      )
      FROM channel_permissions cp
      WHERE cp.channel_id = _channel_id
    ),
    '[]'::json
  );
END;
$$;


ALTER FUNCTION "public"."get_channel_permissions"("_channel_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_channel_server_id"("_channel_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT server_id FROM channels WHERE id = _channel_id
$$;


ALTER FUNCTION "public"."get_channel_server_id"("_channel_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_channel_tasks"("_channel_id" "uuid", "_user_id" "uuid", "_status_filter" "text" DEFAULT NULL::"text", "_sort_by" "text" DEFAULT 'position'::"text", "_sort_order" "text" DEFAULT 'asc'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    result jsonb;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
    WITH task_data AS (
        SELECT 
            t.id,
            t.channel_id,
            t.server_id,
            t.created_by,
            t.title,
            t.description,
            t.priority::text AS priority,
            t.status::text AS status,
            t.due_date,
            t.task_position AS position,
            t.completed_by,
            t.completed_at,
            t.created_at,
            t.updated_at,
            jsonb_build_object(
                'id', creator.id,
                'username', creator.username,
                'display_name', creator.display_name,
                'avatar_url', creator.avatar_url,
                'banner_color', creator.banner_color
            ) AS creator,
            CASE WHEN t.completed_by IS NOT NULL THEN
                jsonb_build_object(
                    'id', completer.id,
                    'username', completer.username,
                    'display_name', completer.display_name,
                    'avatar_url', completer.avatar_url,
                    'banner_color', completer.banner_color
                )
            ELSE NULL END AS completer,
            COALESCE(
                (SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', ta.id,
                        'task_id', ta.task_id,
                        'user_id', ta.user_id,
                        'assigned_by', ta.assigned_by,
                        'assigned_at', ta.assigned_at,
                        'user', jsonb_build_object(
                            'id', au.id,
                            'username', au.username,
                            'display_name', au.display_name,
                            'avatar_url', au.avatar_url,
                            'banner_color', au.banner_color
                        )
                    )
                ) FROM task_assignees ta
                JOIN users au ON au.id = ta.user_id
                WHERE ta.task_id = t.id),
                '[]'::jsonb
            ) AS assignees
        FROM tasks t
        JOIN users creator ON creator.id = t.created_by
        LEFT JOIN users completer ON completer.id = t.completed_by
        WHERE t.channel_id = _channel_id
            AND (_status_filter IS NULL OR t.status::text = _status_filter)
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', td.id,
            'channel_id', td.channel_id,
            'server_id', td.server_id,
            'created_by', td.created_by,
            'title', td.title,
            'description', td.description,
            'priority', td.priority,
            'status', td.status,
            'due_date', td.due_date,
            'position', td.position,
            'completed_by', td.completed_by,
            'completed_at', td.completed_at,
            'created_at', td.created_at,
            'updated_at', td.updated_at,
            'creator', td.creator,
            'completer', td.completer,
            'assignees', td.assignees
        )
        ORDER BY 
            CASE WHEN _sort_order = 'asc' THEN
                CASE _sort_by 
                    WHEN 'position' THEN td.position::text
                    WHEN 'created_at' THEN td.created_at::text
                    WHEN 'due_date' THEN COALESCE(td.due_date::text, '9999-12-31')
                    ELSE td.position::text
                END
            END ASC,
            CASE WHEN _sort_order = 'desc' THEN
                CASE _sort_by 
                    WHEN 'position' THEN td.position::text
                    WHEN 'created_at' THEN td.created_at::text
                    WHEN 'due_date' THEN COALESCE(td.due_date::text, '9999-12-31')
                    ELSE td.position::text
                END
            END DESC
    )
    INTO result
    FROM task_data td;
    
    RETURN COALESCE(result, '[]'::jsonb);
END;
$$;


ALTER FUNCTION "public"."get_channel_tasks"("_channel_id" "uuid", "_user_id" "uuid", "_status_filter" "text", "_sort_by" "text", "_sort_order" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_deletion_preview"("_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result json;
  owned_servers_count integer;
  servers_to_transfer json;
  servers_to_delete json;
  message_count integer;
  dm_count integer;
  reaction_count integer;
  friendship_count integer;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Verify the user exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = _user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Count messages in server channels
  SELECT COUNT(*) INTO message_count FROM messages WHERE user_id = _user_id;
  
  -- Count direct messages
  SELECT COUNT(*) INTO dm_count FROM direct_messages WHERE sender_id = _user_id;
  
  -- Count reactions
  SELECT COUNT(*) INTO reaction_count FROM reactions WHERE user_id = _user_id;
  SELECT reaction_count + COUNT(*) INTO reaction_count FROM dm_reactions WHERE user_id = _user_id;
  
  -- Count friendships
  SELECT COUNT(*) INTO friendship_count FROM friendships 
  WHERE (requester_id = _user_id OR addressee_id = _user_id) AND status = 'accepted';

  -- Get servers to transfer (owned servers with other members)
  SELECT json_agg(json_build_object(
    'id', s.id,
    'name', s.name,
    'member_count', (SELECT COUNT(*) FROM server_members sm WHERE sm.server_id = s.id AND sm.user_id != _user_id AND sm.is_banned = false),
    'new_owner', (
      SELECT json_build_object('id', u.id, 'username', u.username)
      FROM server_members sm
      JOIN users u ON u.id = sm.user_id
      WHERE sm.server_id = s.id 
        AND sm.user_id != _user_id 
        AND sm.is_banned = false
        AND sm.role IN ('admin', 'owner')
      ORDER BY sm.joined_at ASC
      LIMIT 1
    )
  ))
  INTO servers_to_transfer
  FROM servers s
  WHERE s.owner_id = _user_id
    AND EXISTS (
      SELECT 1 FROM server_members sm 
      WHERE sm.server_id = s.id AND sm.user_id != _user_id AND sm.is_banned = false
    );

  -- Get servers to delete (owned servers with no other members)
  SELECT json_agg(json_build_object(
    'id', s.id,
    'name', s.name
  ))
  INTO servers_to_delete
  FROM servers s
  WHERE s.owner_id = _user_id
    AND NOT EXISTS (
      SELECT 1 FROM server_members sm 
      WHERE sm.server_id = s.id AND sm.user_id != _user_id AND sm.is_banned = false
    );

  -- Build the result
  SELECT json_build_object(
    'message_count', message_count,
    'dm_count', dm_count,
    'reaction_count', reaction_count,
    'friendship_count', friendship_count,
    'servers_to_transfer', COALESCE(servers_to_transfer, '[]'::json),
    'servers_to_delete', COALESCE(servers_to_delete, '[]'::json)
  ) INTO result;

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_deletion_preview"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_dm_conversation_id"("_message_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT conversation_id FROM direct_messages WHERE id = _message_id
$$;


ALTER FUNCTION "public"."get_dm_conversation_id"("_message_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_dm_messages"("_conversation_id" "uuid", "_user_id" "uuid", "_limit" integer DEFAULT 50, "_before_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM dm_participants
    WHERE conversation_id = _conversation_id AND user_id = _user_id
  ) THEN
    RAISE EXCEPTION 'Not a participant in this conversation';
  END IF;

  RETURN (
    SELECT json_agg(msg ORDER BY created_at DESC)
    FROM (
      SELECT json_build_object(
        'id', dm.id,
        'conversation_id', dm.conversation_id,
        'sender_id', dm.sender_id,
        'content', dm.content,
        'reply_to_id', dm.reply_to_id,
        'edited_at', dm.edited_at,
        'created_at', dm.created_at,
        'sender', json_build_object(
          'id', u.id, 'username', u.username, 'display_name', u.display_name,
          'avatar_url', u.avatar_url, 'banner_color', u.banner_color, 'status', u.status
        )
      ) as msg, dm.created_at
      FROM direct_messages dm
      JOIN users u ON u.id = dm.sender_id
      WHERE dm.conversation_id = _conversation_id
        AND (_before_id IS NULL OR dm.created_at < (SELECT created_at FROM direct_messages WHERE id = _before_id))
        AND NOT EXISTS (
          SELECT 1
          FROM friendships f
          WHERE f.status = 'blocked'
            AND ((f.requester_id = _user_id AND f.addressee_id = dm.sender_id)
              OR (f.requester_id = dm.sender_id AND f.addressee_id = _user_id))
        )
      ORDER BY dm.created_at DESC
      LIMIT _limit
    ) sub
  );
END;
$$;


ALTER FUNCTION "public"."get_dm_messages"("_conversation_id" "uuid", "_user_id" "uuid", "_limit" integer, "_before_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_dm_unread_counts"("_user_id" "uuid") RETURNS TABLE("conversation_id" "uuid", "unread_count" bigint, "last_read_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- GUARD: Maintenance Mode (Return empty table instead of error to prevent frontend crashes)
  IF is_maintenance_active() THEN
    RETURN;
  END IF;

  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN QUERY
  SELECT 
    dp.conversation_id,
    COALESCE(COUNT(dm.id) FILTER (
      WHERE dm.sender_id != _user_id 
      AND (dp.last_read_at IS NULL OR dm.created_at > dp.last_read_at)
    ), 0) as unread_count,
    dp.last_read_at
  FROM dm_participants dp
  LEFT JOIN direct_messages dm ON dm.conversation_id = dp.conversation_id
  WHERE dp.user_id = _user_id
  GROUP BY dp.conversation_id, dp.last_read_at;
END;
$$;


ALTER FUNCTION "public"."get_dm_unread_counts"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_invite_details_by_code"("_invite_code" "text") RETURNS TABLE("id" "uuid", "name" character varying, "icon_url" "text", "banner_url" "text", "about" "text", "invite_code" character, "inviter_username" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH clean AS (
    SELECT upper(trim(_invite_code)) as code
  )
  SELECT
    s.id,
    s.name,
    s.icon_url,
    s.banner_url,
    s.about,
    s.invite_code,
    ou.username as inviter_username
  FROM public.servers s
  JOIN clean ON true
  JOIN public.users ou ON ou.id = s.owner_id
  WHERE trim(s.invite_code::text) = clean.code

  UNION ALL

  SELECT
    s.id,
    s.name,
    s.icon_url,
    s.banner_url,
    s.about,
    (clean.code)::char(8) as invite_code,
    cu.username as inviter_username
  FROM public.server_invites si
  JOIN clean ON true
  JOIN public.servers s ON s.id = si.server_id
  JOIN public.users cu ON cu.id = si.created_by
  WHERE si.revoked_at IS NULL
    AND (si.expires_at IS NULL OR si.expires_at > now())
    AND (si.max_uses IS NULL OR si.uses_count < si.max_uses)
    AND trim(si.code::text) = clean.code
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_invite_details_by_code"("_invite_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_maintenance_mode"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE((value->>'enabled')::boolean, false) FROM public.app_config WHERE key = 'maintenance_mode';
$$;


ALTER FUNCTION "public"."get_maintenance_mode"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_outgoing_friend_requests"("_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _caller_id uuid;
BEGIN
  _caller_id := public.get_request_user_id();
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _user_id IS DISTINCT FROM _caller_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN (
    SELECT json_agg(request)
    FROM (
      SELECT json_build_object(
        'id', f.id,
        'status', f.status,
        'created_at', f.created_at,
        'user', (
          SELECT json_build_object(
            'id', u.id, 'username', u.username, 'display_name', u.display_name,
            'avatar_url', u.avatar_url, 'banner_color', u.banner_color, 'status', u.status
          ) FROM users u WHERE u.id = f.addressee_id
        )
      ) as request
      FROM friendships f
      WHERE f.requester_id = _caller_id AND f.status = 'pending'
      ORDER BY f.created_at DESC
    ) sub
  );
END;
$$;


ALTER FUNCTION "public"."get_outgoing_friend_requests"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_pending_friend_requests"("_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _caller_id uuid;
BEGIN
  _caller_id := public.get_request_user_id();
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _user_id IS DISTINCT FROM _caller_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN (
    SELECT json_agg(request)
    FROM (
      SELECT json_build_object(
        'id', f.id,
        'status', f.status,
        'created_at', f.created_at,
        'user', (
          SELECT json_build_object(
            'id', u.id, 'username', u.username, 'display_name', u.display_name,
            'avatar_url', u.avatar_url, 'banner_color', u.banner_color, 'status', u.status
          ) FROM users u WHERE u.id = f.requester_id
        )
      ) as request
      FROM friendships f
      WHERE f.addressee_id = _caller_id AND f.status = 'pending'
      ORDER BY f.created_at DESC
    ) sub
  );
END;
$$;


ALTER FUNCTION "public"."get_pending_friend_requests"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_request_user_id"() RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _key_hash text;
  _user_id uuid;
BEGIN
  _key_hash := current_setting('request.headers', true)::json->>'x-key-hash';
  IF _key_hash IS NULL OR _key_hash = '' THEN
    RETURN NULL;
  END IF;
  SELECT ua.user_id INTO _user_id FROM user_auth ua WHERE ua.key_hash = _key_hash LIMIT 1;
  RETURN _user_id;
END;
$$;


ALTER FUNCTION "public"."get_request_user_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_role_permissions"("_server_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', rp.id,
          'server_id', rp.server_id,
          'role_id', rp.role_id,
          'role_name', rp.role_name,
          'permission', rp.permission,
          'allowed', rp.allowed,
          'created_at', rp.created_at
        ) ORDER BY rp.created_at ASC
      )
      FROM role_permissions rp
      WHERE rp.server_id = _server_id
    ),
    '[]'::json
  );
END;
$$;


ALTER FUNCTION "public"."get_role_permissions"("_server_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_server_by_invite_code"("_invite_code" "text") RETURNS TABLE("id" "uuid", "name" character varying, "icon_url" "text", "invite_code" character)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH clean AS (
    SELECT upper(trim(_invite_code)) as code
  )
  SELECT s.id, s.name, s.icon_url, s.invite_code
  FROM public.servers s
  JOIN clean ON true
  WHERE trim(s.invite_code::text) = clean.code

  UNION ALL

  SELECT s.id, s.name, s.icon_url, (clean.code)::char(8)
  FROM public.server_invites si
  JOIN clean ON true
  JOIN public.servers s ON s.id = si.server_id
  WHERE si.revoked_at IS NULL
    AND (si.expires_at IS NULL OR si.expires_at > now())
    AND (si.max_uses IS NULL OR si.uses_count < si.max_uses)
    AND trim(si.code::text) = clean.code
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_server_by_invite_code"("_invite_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_server_categories"("_server_id" "uuid", "_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _is_member boolean := false;
BEGIN
  -- Identity verification (conditional for optional user_id)
  IF _user_id IS NOT NULL AND NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- If user_id provided, verify they are a non-banned member
  IF _user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM server_members 
      WHERE server_id = _server_id 
      AND user_id = _user_id 
      AND is_banned = false
    ) INTO _is_member;

    IF NOT _is_member THEN
      RETURN '[]'::json;
    END IF;
  END IF;

  RETURN (
    SELECT COALESCE(json_agg(
      json_build_object(
        'id', cc.id,
        'server_id', cc.server_id,
        'name', cc.name,
        'position', cc.position,
        'is_collapsed', cc.is_collapsed,
        'created_at', cc.created_at
      ) ORDER BY cc.position
    ), '[]'::json)
    FROM channel_categories cc
    WHERE cc.server_id = _server_id
  );
END;
$$;


ALTER FUNCTION "public"."get_server_categories"("_server_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_server_channels"("_server_id" "uuid", "_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _is_admin boolean := false;
  _is_member boolean := false;
BEGIN
  -- Identity verification (conditional for optional user_id)
  IF _user_id IS NOT NULL AND NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- If user_id provided, verify they are a non-banned member
  IF _user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM server_members 
      WHERE server_id = _server_id 
      AND user_id = _user_id 
      AND is_banned = false
    ) INTO _is_member;

    -- If not a non-banned member, return empty array
    IF NOT _is_member THEN
      RETURN '[]'::json;
    END IF;

    -- Check if admin/owner
    SELECT EXISTS (
      SELECT 1 FROM server_members 
      WHERE server_id = _server_id 
      AND user_id = _user_id 
      AND role IN ('owner', 'admin')
    ) INTO _is_admin;
  END IF;

  RETURN (
    SELECT COALESCE(json_agg(
      json_build_object(
        'id', c.id,
        'server_id', c.server_id,
        'category_id', c.category_id,
        'name', c.name,
        'topic', c.topic,
        'type', c.type,
        'position', c.position,
        'is_nsfw', c.is_nsfw,
        'slowmode_seconds', c.slowmode_seconds,
        'is_read_only', c.is_read_only,
        'icon', c.icon,
        'is_private', c.is_private,
        'block_links', c.block_links,
        'allowed_link_domains', c.allowed_link_domains,
        'ghost_mode', c.ghost_mode,
        'created_at', c.created_at
      ) ORDER BY c.position
    ), '[]'::json)
    FROM channels c
    WHERE c.server_id = _server_id
    AND (
      NOT c.is_private
      OR _is_admin
      OR (_user_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM channel_members cm 
        WHERE cm.channel_id = c.id AND cm.user_id = _user_id
      ))
    )
  );
END;
$$;


ALTER FUNCTION "public"."get_server_channels"("_server_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_server_members"("_server_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', sm.id,
          'server_id', sm.server_id,
          'user_id', sm.user_id,
          'role', sm.role,
          'nickname', sm.nickname,
          'is_banned', sm.is_banned,
          'is_muted', sm.is_muted,
          'joined_at', sm.joined_at,
          'join_source', sm.join_source,
          'join_invite_code', sm.join_invite_code,
          'user', json_build_object(
            'id', u.id,
            'username', u.username,
            'display_name', u.display_name,
            'avatar_url', u.avatar_url,
            'banner_url', u.banner_url,
            'avatar_decoration', u.avatar_decoration,
            'profile_effect', u.profile_effect,
            'banner_color', u.banner_color,
            'profile_theme_primary', u.profile_theme_primary,
            'profile_theme_accent', u.profile_theme_accent,
            'bio', u.bio,
            'status', u.status,
            'custom_status', u.custom_status,
            'created_at', u.created_at,
            'last_seen', u.last_seen
          ),
          'roles', COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', sr.id,
                  'name', sr.name,
                  'color', sr.color,
                  'position', sr.position
                ) ORDER BY sr.position ASC
              )
              FROM server_member_roles smr
              JOIN server_roles sr ON sr.id = smr.role_id
              WHERE smr.member_id = sm.id
            ),
            '[]'::json
          )
        )
      )
      FROM server_members sm
      JOIN users u ON u.id = sm.user_id
      WHERE sm.server_id = _server_id
    ),
    '[]'::json
  );
END;
$$;


ALTER FUNCTION "public"."get_server_members"("_server_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_server_roles"("_server_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', sr.id,
          'server_id', sr.server_id,
          'name', sr.name,
          'color', sr.color,
          'position', sr.position,
          'created_at', sr.created_at
        ) ORDER BY sr.position ASC, sr.created_at ASC
      )
      FROM server_roles sr
      WHERE sr.server_id = _server_id
    ),
    '[]'::json
  );
END;
$$;


ALTER FUNCTION "public"."get_server_roles"("_server_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_task_comments"("_task_id" "uuid", "_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  task_channel_id uuid;
  result json;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get task channel
  SELECT channel_id INTO task_channel_id
  FROM tasks
  WHERE id = _task_id;
  
  IF task_channel_id IS NULL THEN
    RETURN json_build_object('error', 'Task not found');
  END IF;
  
  -- Check permission: view_tasks
  IF NOT check_user_permission(_user_id, task_channel_id, 'view_tasks'::permission_type) THEN
    RETURN json_build_object('error', 'Permission denied: view_tasks');
  END IF;
  
  -- Get top-level comments (no reply_to_id) with their replies
  SELECT json_agg(
    json_build_object(
      'id', tc.id,
      'task_id', tc.task_id,
      'user_id', tc.user_id,
      'content', tc.content,
      'created_at', tc.created_at,
      'edited_at', tc.edited_at,
      'reply_to_id', tc.reply_to_id,
      'replies', (
        SELECT json_agg(
          json_build_object(
            'id', r.id,
            'task_id', r.task_id,
            'user_id', r.user_id,
            'content', r.content,
            'created_at', r.created_at,
            'edited_at', r.edited_at,
            'reply_to_id', r.reply_to_id
          )
          ORDER BY r.created_at ASC
        )
        FROM task_comments r
        WHERE r.reply_to_id = tc.id
      )
    )
    ORDER BY tc.created_at ASC
  ) INTO result
  FROM task_comments tc
  WHERE tc.task_id = _task_id AND tc.reply_to_id IS NULL;
  
  RETURN COALESCE(result, '[]'::json);
END;
$$;


ALTER FUNCTION "public"."get_task_comments"("_task_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_thread_by_message_id"("_message_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result json;
BEGIN
  SELECT row_to_json(t) INTO result
  FROM threads t
  WHERE t.message_id = _message_id;

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_thread_by_message_id"("_message_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_thread_info"("_message_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'id', t.id,
    'channel_id', t.channel_id,
    'message_id', t.message_id,
    'created_by', t.created_by,
    'created_at', t.created_at,
    'message_count', (
      SELECT COUNT(*)
      FROM thread_messages
      WHERE thread_id = t.id
    )
  ) INTO result
  FROM threads t
  WHERE t.message_id = _message_id;

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_thread_info"("_message_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_thread_message_count"("_message_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  thread_id_val uuid;
  message_count integer;
BEGIN
  -- Get thread ID from message
  SELECT id INTO thread_id_val
  FROM threads
  WHERE message_id = _message_id;

  IF thread_id_val IS NULL THEN
    RETURN 0;
  END IF;

  -- Count messages in thread
  SELECT COUNT(*) INTO message_count
  FROM thread_messages
  WHERE thread_id = thread_id_val;

  RETURN message_count;
END;
$$;


ALTER FUNCTION "public"."get_thread_message_count"("_message_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_thread_messages"("_thread_id" "uuid", "_limit" integer DEFAULT 50, "_before" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result json;
BEGIN
  WITH ordered_messages AS (
    SELECT tm.*
    FROM thread_messages tm
    WHERE tm.thread_id = _thread_id
      AND (_before IS NULL OR tm.created_at < _before::timestamptz)
    ORDER BY tm.created_at DESC
    LIMIT _limit
  )
  SELECT json_agg(
    json_build_object(
      'id', om.id,
      'thread_id', om.thread_id,
      'user_id', om.user_id,
      'content', om.content,
      'reply_to_id', om.reply_to_id,
      'edited_at', om.edited_at,
      'created_at', om.created_at,
      'user', (
        SELECT json_build_object(
          'id', u.id,
          'username', u.username,
          'display_name', u.display_name,
          'avatar_url', u.avatar_url,
          'avatar_decoration', u.avatar_decoration,
          'profile_effect', u.profile_effect,
          'banner_color', u.banner_color,
          'banner_url', u.banner_url,
          'profile_theme_primary', u.profile_theme_primary,
          'profile_theme_accent', u.profile_theme_accent,
          'bio', u.bio,
          'status', u.status,
          'custom_status', u.custom_status
        )
        FROM users u
        WHERE u.id = om.user_id
      ),
      'reply_to', CASE
        WHEN om.reply_to_id IS NOT NULL THEN (
          SELECT json_build_object(
            'id', rt.id,
            'user_id', rt.user_id,
            'content', rt.content,
            'created_at', rt.created_at,
            'user', (
              SELECT json_build_object(
                'id', ru.id,
                'username', ru.username,
                'display_name', ru.display_name,
                'avatar_url', ru.avatar_url
              )
              FROM users ru
              WHERE ru.id = rt.user_id
            )
          )
          FROM thread_messages rt
          WHERE rt.id = om.reply_to_id
        )
        ELSE NULL
      END
    )
    ORDER BY om.created_at ASC
  ) INTO result
  FROM ordered_messages om;

  RETURN COALESCE(result, '[]'::json);
END;
$$;


ALTER FUNCTION "public"."get_thread_messages"("_thread_id" "uuid", "_limit" integer, "_before" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_thread_summaries"("_thread_ids" "uuid"[]) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result json;
BEGIN
  IF _thread_ids IS NULL OR array_length(_thread_ids, 1) IS NULL THEN
    RETURN '[]'::json;
  END IF;

  WITH input AS (
    SELECT DISTINCT unnest(_thread_ids) AS thread_id
  ),
  counts AS (
    SELECT tm.thread_id, COUNT(*)::int AS message_count
    FROM thread_messages tm
    WHERE tm.thread_id = ANY(_thread_ids)
    GROUP BY tm.thread_id
  ),
  last_tm AS (
    SELECT DISTINCT ON (tm.thread_id)
      tm.thread_id,
      tm.created_at AS last_activity,
      tm.user_id AS last_user_id
    FROM thread_messages tm
    WHERE tm.thread_id = ANY(_thread_ids)
    ORDER BY tm.thread_id, tm.created_at DESC
  )
  SELECT json_agg(
    json_build_object(
      'thread_id', i.thread_id,
      'message_count', COALESCE(c.message_count, 0),
      'last_activity', COALESCE(l.last_activity, t.created_at),
      'last_message_author', CASE
        WHEN l.last_user_id IS NULL THEN NULL
        ELSE (
          SELECT json_build_object(
            'id', u.id,
            'username', u.username,
            'display_name', u.display_name,
            'avatar_url', u.avatar_url,
            'avatar_decoration', u.avatar_decoration,
            'profile_effect', u.profile_effect,
            'banner_color', u.banner_color,
            'banner_url', u.banner_url,
            'profile_theme_primary', u.profile_theme_primary,
            'profile_theme_accent', u.profile_theme_accent,
            'bio', u.bio,
            'status', u.status,
            'custom_status', u.custom_status
          )
          FROM users u
          WHERE u.id = l.last_user_id
        )
      END
    )
    ORDER BY COALESCE(l.last_activity, t.created_at) DESC NULLS LAST
  ) INTO result
  FROM input i
  LEFT JOIN threads t ON t.id = i.thread_id
  LEFT JOIN counts c ON c.thread_id = i.thread_id
  LEFT JOIN last_tm l ON l.thread_id = i.thread_id;

  RETURN COALESCE(result, '[]'::json);
END;
$$;


ALTER FUNCTION "public"."get_thread_summaries"("_thread_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_by_id"("_user_id" "uuid") RETURNS json
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT json_build_object(
    'id', u.id,
    'username', u.username,
    'display_name', u.display_name,
    'avatar_url', u.avatar_url,
    'banner_url', u.banner_url,
    'avatar_decoration', u.avatar_decoration,
    'profile_effect', u.profile_effect,
    'banner_color', u.banner_color,
    'profile_theme_primary', u.profile_theme_primary,
    'profile_theme_accent', u.profile_theme_accent,
    'bio', u.bio,
    'status', u.status,
    'custom_status', u.custom_status,
    'created_at', u.created_at,
    'last_seen', u.last_seen
  )
  FROM users u WHERE u.id = _user_id;
$$;


ALTER FUNCTION "public"."get_user_by_id"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_dm_conversations"("_user_id" "uuid") RETURNS TABLE("conversation" json, "participants" json, "last_message" json)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN QUERY
  SELECT
    json_build_object(
      'id', c.id,
      'created_at', c.created_at,
      'is_group', c.is_group,
      'name', c.name,
      'created_by', c.created_by
    ) as conversation,
    (
      SELECT json_agg(
        json_build_object(
          'user_id', dp2.user_id,
          'user', json_build_object(
            'id', u.id,
            'username', u.username,
            'display_name', u.display_name,
            'avatar_url', u.avatar_url,
            'avatar_decoration', u.avatar_decoration,
            'status', u.status,
            'custom_status', u.custom_status,
            'banner_color', u.banner_color,
            'last_seen', CASE WHEN u.id = _user_id THEN u.last_seen ELSE NULL END
          )
        )
      )
      FROM dm_participants dp2
      JOIN users u ON u.id = dp2.user_id
      WHERE dp2.conversation_id = c.id
    ) as participants,
    (
      SELECT json_build_object(
        'id', dm.id,
        'content', dm.content,
        'created_at', dm.created_at,
        'sender_id', dm.sender_id
      )
      FROM direct_messages dm
      WHERE dm.conversation_id = c.id
      ORDER BY dm.created_at DESC
      LIMIT 1
    ) as last_message
  FROM dm_conversations c
  JOIN dm_participants dp ON dp.conversation_id = c.id
  WHERE dp.user_id = _user_id
  ORDER BY (
    SELECT MAX(dm.created_at)
    FROM direct_messages dm
    WHERE dm.conversation_id = c.id
  ) DESC NULLS LAST;
END;
$$;


ALTER FUNCTION "public"."get_user_dm_conversations"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_friends"("_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _caller_id uuid;
BEGIN
  _caller_id := public.get_request_user_id();
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _user_id IS DISTINCT FROM _caller_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN (
    SELECT json_agg(friend)
    FROM (
      SELECT json_build_object(
        'id', f.id,
        'status', f.status,
        'created_at', f.created_at,
        'user', CASE
          WHEN f.requester_id = _caller_id THEN (
            SELECT json_build_object(
              'id', u.id, 'username', u.username, 'display_name', u.display_name,
              'avatar_url', u.avatar_url, 'banner_color', u.banner_color, 'status', u.status,
              'custom_status', u.custom_status
            ) FROM users u WHERE u.id = f.addressee_id
          )
          ELSE (
            SELECT json_build_object(
              'id', u.id, 'username', u.username, 'display_name', u.display_name,
              'avatar_url', u.avatar_url, 'banner_color', u.banner_color, 'status', u.status,
              'custom_status', u.custom_status
            ) FROM users u WHERE u.id = f.requester_id
          )
        END
      ) as friend
      FROM friendships f
      WHERE (f.requester_id = _caller_id OR f.addressee_id = _caller_id)
      AND f.status = 'accepted'
    ) sub
  );
END;
$$;


ALTER FUNCTION "public"."get_user_friends"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_poll_votes"("_poll_id" "uuid", "_user_id" "uuid") RETURNS integer[]
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  votes integer[];
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT ARRAY_AGG(option_index ORDER BY option_index)
  INTO votes
  FROM poll_votes
  WHERE poll_id = _poll_id AND user_id = _user_id;
  
  RETURN COALESCE(votes, ARRAY[]::integer[]);
END;
$$;


ALTER FUNCTION "public"."get_user_poll_votes"("_poll_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_server_folders"("_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result JSONB;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT folder_data INTO result
  FROM public.user_server_folders
  WHERE user_id = _user_id;
  
  -- Return default structure if no data found
  IF result IS NULL THEN
    RETURN '{"folders":[],"serverToFolder":{}}'::jsonb;
  END IF;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_user_server_folders"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_server_tabs"("_user_id" "uuid") RETURNS "text"[]
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  RETURN COALESCE(
    (SELECT tab_order FROM user_server_tabs WHERE user_id = _user_id),
    '{}'::TEXT[]
  );
END;
$$;


ALTER FUNCTION "public"."get_user_server_tabs"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_servers"("_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
    FROM (
      SELECT 
        s.id,
        s.name,
        s.owner_id,
        s.invite_code,
        s.icon_url,
        s.banner_url,
        s.is_published,
        s.about,
        s.system_channel_join_id,
        s.system_channel_leave_id,
        s.enable_join_messages,
        s.enable_leave_messages,
        s.created_at,
        sm.role,
        sm.nickname,
        sm.joined_at,
        sm.is_muted,
        sm.position
      FROM servers s
      INNER JOIN server_members sm ON sm.server_id = s.id
      WHERE sm.user_id = _user_id
        AND (sm.is_banned IS NULL OR sm.is_banned = false)
      ORDER BY sm.position ASC NULLS LAST, s.name ASC
    ) t
  );
END;
$$;


ALTER FUNCTION "public"."get_user_servers"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_voice_settings"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result JSONB;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(p_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT settings INTO result
  FROM user_voice_settings
  WHERE user_id = p_user_id;
  
  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;


ALTER FUNCTION "public"."get_user_voice_settings"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_message_mentions"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- 1. Automatically populate the mentions table by parsing the text
  -- It looks for the <@UUID> pattern we create in React
  INSERT INTO public.mentions (message_id, user_id, mention_type)
  SELECT DISTINCT NEW.id, (m[1])::uuid, 'user'
  FROM regexp_matches(NEW.content, '<@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})>', 'g') AS m
  ON CONFLICT DO NOTHING;

  -- 2. Update the mention counts for the recipients
  UPDATE public.channel_reads
  SET mention_count = mention_count + 1
  WHERE channel_id = NEW.channel_id
    AND user_id IN (
      SELECT user_id FROM public.mentions WHERE message_id = NEW.id
    )
    AND user_id != NEW.user_id; -- Don't ping yourself

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_message_mentions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_mention_ping"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- We look at the 'mentions' table (which should be populated when a message is sent)
  -- and increment the count for those specific users in that channel.
  UPDATE public.channel_reads
  SET mention_count = mention_count + 1
  WHERE channel_id = NEW.channel_id
    AND user_id IN (
      SELECT user_id 
      FROM public.mentions 
      WHERE message_id = NEW.id
    );
    
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_mention_ping"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_channel_access"("_channel_id" "uuid", "_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM channels c
    WHERE c.id = _channel_id
    AND (
      c.is_private = false
      OR EXISTS (SELECT 1 FROM channel_members cm WHERE cm.channel_id = _channel_id AND cm.user_id = _user_id)
    )
  );
$$;


ALTER FUNCTION "public"."has_channel_access"("_channel_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_private_channel_access"("_channel_id" "uuid", "_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM channel_members
    WHERE channel_id = _channel_id AND user_id = _user_id
  );
$$;


ALTER FUNCTION "public"."has_private_channel_access"("_channel_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_mention_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  _channel_id UUID;
BEGIN
  -- Get the channel_id from the message
  SELECT channel_id INTO _channel_id
  FROM public.messages
  WHERE id = NEW.message_id;

  IF _channel_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Upsert channel_reads record and increment mention_count
  INSERT INTO public.channel_reads (user_id, channel_id, mention_count)
  VALUES (NEW.user_id, _channel_id, 1)
  ON CONFLICT (user_id, channel_id)
  DO UPDATE SET mention_count = COALESCE(channel_reads.mention_count, 0) + 1;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."increment_mention_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_announcement_comment"("_message_id" "uuid", "_user_id" "uuid", "_content" "text", "_reply_to_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  msg_channel_id uuid;
  new_comment announcement_comments%ROWTYPE;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT channel_id INTO msg_channel_id FROM messages WHERE id = _message_id;
  IF msg_channel_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;
  IF NOT check_user_permission(_user_id, msg_channel_id, 'send_messages') THEN
    RAISE EXCEPTION 'Permission denied: you do not have permission to comment';
  END IF;
  INSERT INTO announcement_comments (message_id, user_id, content, reply_to_id)
  VALUES (_message_id, _user_id, _content, _reply_to_id)
  RETURNING * INTO new_comment;
  RETURN row_to_json(new_comment);
END;
$$;


ALTER FUNCTION "public"."insert_announcement_comment"("_message_id" "uuid", "_user_id" "uuid", "_content" "text", "_reply_to_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_media_comment"("_media_id" "uuid", "_user_id" "uuid", "_content" "text", "_reply_to_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  media_channel_id uuid;
  new_comment media_comments%ROWTYPE;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT channel_id INTO media_channel_id FROM media_items WHERE id = _media_id;
  IF media_channel_id IS NULL THEN
    RAISE EXCEPTION 'Media item not found';
  END IF;
  IF NOT check_user_permission(_user_id, media_channel_id, 'send_messages') THEN
    RAISE EXCEPTION 'Permission denied: you do not have permission to comment';
  END IF;
  INSERT INTO media_comments (media_id, user_id, content, reply_to_id)
  VALUES (_media_id, _user_id, _content, _reply_to_id)
  RETURNING * INTO new_comment;
  RETURN row_to_json(new_comment);
END;
$$;


ALTER FUNCTION "public"."insert_media_comment"("_media_id" "uuid", "_user_id" "uuid", "_content" "text", "_reply_to_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_media_item"("_channel_id" "uuid", "_user_id" "uuid", "_title" "text" DEFAULT NULL::"text", "_description" "text" DEFAULT NULL::"text", "_media_url" "text" DEFAULT ''::"text", "_media_type" "text" DEFAULT 'image'::"text", "_thumbnail_url" "text" DEFAULT NULL::"text", "_youtube_video_id" "text" DEFAULT NULL::"text", "_width" integer DEFAULT NULL::integer, "_height" integer DEFAULT NULL::integer, "_file_size" integer DEFAULT NULL::integer) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  new_item media_items%ROWTYPE;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  IF NOT check_user_permission(_user_id, _channel_id, 'send_messages') THEN
    RAISE EXCEPTION 'Permission denied: you do not have permission to send messages in this channel';
  END IF;
  IF NOT check_user_permission(_user_id, _channel_id, 'attach_files') THEN
    RAISE EXCEPTION 'Permission denied: you do not have permission to attach files in this channel';
  END IF;
  INSERT INTO media_items (channel_id, user_id, title, description, media_url, media_type, thumbnail_url, youtube_video_id, width, height, file_size)
  VALUES (_channel_id, _user_id, _title, _description, _media_url, _media_type, _thumbnail_url, _youtube_video_id, _width, _height, _file_size)
  RETURNING * INTO new_item;
  RETURN row_to_json(new_item);
END;
$$;


ALTER FUNCTION "public"."insert_media_item"("_channel_id" "uuid", "_user_id" "uuid", "_title" "text", "_description" "text", "_media_url" "text", "_media_type" "text", "_thumbnail_url" "text", "_youtube_video_id" "text", "_width" integer, "_height" integer, "_file_size" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_mentions"("_user_id" "uuid", "_mentions" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  INSERT INTO mentions (message_id, user_id, mention_type)
  SELECT
    (m->>'message_id')::uuid,
    (m->>'user_id')::uuid,
    (m->>'mention_type')::mention_type
  FROM jsonb_array_elements(_mentions) AS m
  ON CONFLICT DO NOTHING;
END;
$$;


ALTER FUNCTION "public"."insert_mentions"("_user_id" "uuid", "_mentions" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_category_server_member"("_category_id" "uuid", "_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM channel_categories cc
    JOIN server_members sm ON sm.server_id = cc.server_id
    WHERE cc.id = _category_id AND sm.user_id = _user_id
  );
$$;


ALTER FUNCTION "public"."is_category_server_member"("_category_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_channel_server_member"("_channel_id" "uuid", "_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM channels c
    WHERE c.id = _channel_id
    AND EXISTS (
      SELECT 1 FROM server_members sm
      WHERE sm.server_id = c.server_id AND sm.user_id = _user_id
    )
  );
$$;


ALTER FUNCTION "public"."is_channel_server_member"("_channel_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_dm_message_participant"("_message_id" "uuid", "_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM direct_messages dm
    JOIN dm_participants dp ON dp.conversation_id = dm.conversation_id
    WHERE dm.id = _message_id AND dp.user_id = _user_id
  );
$$;


ALTER FUNCTION "public"."is_dm_message_participant"("_message_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_dm_participant"("_conversation_id" "uuid", "_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM dm_participants
    WHERE conversation_id = _conversation_id AND user_id = _user_id
  );
$$;


ALTER FUNCTION "public"."is_dm_participant"("_conversation_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_friend_with"("_user_id" "uuid", "_other_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM friendships
    WHERE status = 'accepted'
    AND (
      (requester_id = _user_id AND addressee_id = _other_user_id)
      OR (requester_id = _other_user_id AND addressee_id = _user_id)
    )
  )
$$;


ALTER FUNCTION "public"."is_friend_with"("_user_id" "uuid", "_other_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_maintenance_active"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN COALESCE(
    (SELECT (value::jsonb->>'enabled')::boolean 
     FROM public.app_config 
     WHERE key = 'maintenance_mode'), 
    false
  );
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;


ALTER FUNCTION "public"."is_maintenance_active"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_media_channel_member"("_media_id" "uuid", "_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM media_items mi
    JOIN server_members sm ON sm.server_id = (
      SELECT c.server_id FROM channels c WHERE c.id = mi.channel_id
    ) AND sm.user_id = _user_id AND sm.is_banned = false
    WHERE mi.id = _media_id
  );
$$;


ALTER FUNCTION "public"."is_media_channel_member"("_media_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_member_in_same_server"("_member_id" "uuid", "_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM server_members sm1
    JOIN server_members sm2 ON sm1.server_id = sm2.server_id
    WHERE sm1.id = _member_id AND sm2.user_id = _user_id
  );
$$;


ALTER FUNCTION "public"."is_member_in_same_server"("_member_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_message_channel_member"("_message_id" "uuid", "_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM messages m
    JOIN server_members sm ON sm.server_id = (
      SELECT c.server_id FROM channels c WHERE c.id = m.channel_id
    ) AND sm.user_id = _user_id AND sm.is_banned = false
    WHERE m.id = _message_id
  );
$$;


ALTER FUNCTION "public"."is_message_channel_member"("_message_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_server_member"("_server_id" "uuid", "_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM server_members
    WHERE server_id = _server_id AND user_id = _user_id
  );
$$;


ALTER FUNCTION "public"."is_server_member"("_server_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_thread_channel_member"("_thread_id" "uuid", "_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM threads t
    JOIN server_members sm ON sm.server_id = (
      SELECT c.server_id FROM channels c WHERE c.id = t.channel_id
    ) AND sm.user_id = _user_id AND sm.is_banned = false
    WHERE t.id = _thread_id
  );
$$;


ALTER FUNCTION "public"."is_thread_channel_member"("_thread_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_username_blocked"("username" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  normalized_username TEXT;
  blocked_words TEXT[] := ARRAY[
    -- Kloak brand
    'kloak', 'kloakapp', 'kloakofficial', 'kloakhq', 'kloakteam', 'kloaksupport',
    'kloakhelp', 'kloakadmin', 'kloakmod', 'kloakbot', 'kloakstaff', 'kloaksecurity',
    -- Administrative
    'admin', 'administrator', 'moderator', 'owner', 'staff', 'official', 'manager',
    'supervisor', 'superuser', 'sysadmin', 'systemadmin', 'root', 'sudo', 'operator',
    -- Support
    'support', 'helpdesk', 'customerservice', 'customersupport', 'contact', 'billing',
    -- System
    'system', 'server', 'bot', 'robot', 'automated', 'api', 'webhook', 'database',
    'localhost', 'null', 'undefined', 'void', 'none', 'test', 'testing',
    -- Security
    'security', 'abuse', 'spam', 'phishing', 'hack', 'hacker', 'exploit',
    'noreply', 'donotreply', 'postmaster', 'webmaster',
    -- Identity
    'everyone', 'anybody', 'someone', 'nobody', 'anonymous', 'anon', 'guest',
    'unknown', 'default', 'user', 'member', 'all',
    -- Platform
    'login', 'logout', 'signup', 'register', 'account', 'profile', 'settings',
    'dashboard', 'home', 'password', 'auth'
  ];
  blocked_substrings TEXT[] := ARRAY[
    'admin', 'moderator', 'support', 'official', 'staff', 'kloak', 'system',
    'security', 'hack', 'phish', 'spam', 'abuse', 'root', 'sudo', 'owner'
  ];
  word TEXT;
BEGIN
  -- Normalize: lowercase, remove underscores/hyphens, decode basic leet speak
  normalized_username := lower(username);
  normalized_username := regexp_replace(normalized_username, '[-_]', '', 'g');
  -- Basic leet speak decoding
  normalized_username := replace(normalized_username, '0', 'o');
  normalized_username := replace(normalized_username, '1', 'i');
  normalized_username := replace(normalized_username, '3', 'e');
  normalized_username := replace(normalized_username, '4', 'a');
  normalized_username := replace(normalized_username, '5', 's');
  normalized_username := replace(normalized_username, '7', 't');
  normalized_username := replace(normalized_username, '@', 'a');
  normalized_username := replace(normalized_username, '$', 's');

  -- Check exact match against blocked list
  FOREACH word IN ARRAY blocked_words LOOP
    IF normalized_username = word THEN
      RETURN TRUE;
    END IF;
  END LOOP;

  -- Check if contains blocked substrings
  FOREACH word IN ARRAY blocked_substrings LOOP
    IF position(word IN normalized_username) > 0 THEN
      RETURN TRUE;
    END IF;
  END LOOP;

  RETURN FALSE;
END;
$_$;


ALTER FUNCTION "public"."is_username_blocked"("username" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."join_server_by_invite"("_invite_code" "text", "_user_id" "uuid", "_join_source" "text" DEFAULT 'invite_link'::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  clean_code := upper(trim(_invite_code));
  
  SELECT id, system_channel_join_id, enable_join_messages INTO target_server_id, system_channel_id, enable_join
  FROM servers
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
      SELECT system_channel_join_id, enable_join_messages INTO system_channel_id, enable_join
      FROM servers WHERE id = target_server_id;
    END IF;
  END IF;
  
  IF target_server_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;
  
  -- Single lookup for existing membership
  SELECT * INTO existing_member
  FROM server_members
  WHERE server_id = target_server_id AND user_id = _user_id;
  
  IF existing_member IS NOT NULL THEN
    -- BANNED CHECK FIRST
    IF existing_member.is_banned = true THEN
      RAISE EXCEPTION 'You are banned from this server';
    END IF;
    
    -- Already a non-banned member
    SELECT json_build_object(
      'id', s.id,
      'name', s.name,
      'owner_id', s.owner_id,
      'invite_code', trim(s.invite_code::text),
      'icon_url', s.icon_url,
      'banner_url', s.banner_url,
      'created_at', s.created_at,
      'already_member', true
    ) INTO result
    FROM servers s WHERE s.id = target_server_id;
    
    RETURN result;
  END IF;
  
  -- New member - insert with ON CONFLICT safety net for race conditions
  INSERT INTO server_members (server_id, user_id, role, is_banned)
  VALUES (target_server_id, _user_id, 'member', false)
  ON CONFLICT (server_id, user_id) DO NOTHING;
  
  IF invite_row_id IS NOT NULL THEN
    UPDATE public.server_invites SET uses_count = uses_count + 1 WHERE id = invite_row_id;
  END IF;
  
  IF system_channel_id IS NOT NULL AND enable_join THEN
    BEGIN
      join_message_content := format('<@%s> joined', _user_id);
      INSERT INTO messages (channel_id, user_id, content, is_system_message)
      VALUES (system_channel_id, _user_id, join_message_content, TRUE)
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
    'already_member', false
  ) INTO result
  FROM servers s WHERE s.id = target_server_id;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."join_server_by_invite"("_invite_code" "text", "_user_id" "uuid", "_join_source" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kick_group_dm_member"("_conversation_id" "uuid", "_kicker_id" "uuid", "_target_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_is_group boolean;
  v_is_kicker_participant boolean;
  v_is_target_participant boolean;
  v_creator_id uuid;
  v_kicker_username text;
  v_kicker_display_name text;
  v_target_username text;
  v_target_display_name text;
  v_participant_count int;
BEGIN
  IF NOT public.verify_request_identity(_kicker_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT is_group, created_by INTO v_is_group, v_creator_id
  FROM dm_conversations
  WHERE id = _conversation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;

  IF NOT COALESCE(v_is_group, false) THEN
    RAISE EXCEPTION 'Cannot kick members from a 1:1 conversation';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM dm_participants
    WHERE conversation_id = _conversation_id AND user_id = _kicker_id
  ) INTO v_is_kicker_participant;

  IF NOT v_is_kicker_participant THEN
    RAISE EXCEPTION 'You are not a participant in this conversation';
  END IF;

  IF _kicker_id != v_creator_id THEN
    RAISE EXCEPTION 'Only the group creator can kick members';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM dm_participants
    WHERE conversation_id = _conversation_id AND user_id = _target_user_id
  ) INTO v_is_target_participant;

  IF NOT v_is_target_participant THEN
    RAISE EXCEPTION 'Target user is not a participant in this conversation';
  END IF;

  IF _kicker_id = _target_user_id THEN
    RAISE EXCEPTION 'Cannot kick yourself. Use leave group instead.';
  END IF;

  SELECT username, display_name INTO v_kicker_username, v_kicker_display_name
  FROM users WHERE id = _kicker_id;

  SELECT username, display_name INTO v_target_username, v_target_display_name
  FROM users WHERE id = _target_user_id;

  INSERT INTO direct_messages (conversation_id, sender_id, content)
  VALUES (
    _conversation_id,
    _kicker_id,
    '👢 ' || COALESCE(v_target_display_name, v_target_username) || ' was removed from the group by ' || COALESCE(v_kicker_display_name, v_kicker_username)
  );

  DELETE FROM dm_participants
  WHERE conversation_id = _conversation_id AND user_id = _target_user_id;

  SELECT COUNT(*) INTO v_participant_count
  FROM dm_participants
  WHERE conversation_id = _conversation_id;

  IF v_participant_count <= 1 THEN
    DELETE FROM dm_conversations WHERE id = _conversation_id;
  END IF;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."kick_group_dm_member"("_conversation_id" "uuid", "_kicker_id" "uuid", "_target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kick_member"("_server_id" "uuid", "_user_id" "uuid", "_target_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN server_member_roles smr ON smr.role_id = rp.role_id
      JOIN server_members sm ON sm.id = smr.member_id
      WHERE sm.user_id = _user_id AND rp.server_id = _server_id
        AND rp.permission = 'kick_members' AND rp.allowed = true
    ) THEN
      RAISE EXCEPTION 'You do not have permission to kick members';
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _target_user_id) THEN
    RAISE EXCEPTION 'Cannot kick the server owner';
  END IF;
  -- Delete role assignments via member_id
  DELETE FROM server_member_roles WHERE member_id IN (
    SELECT id FROM server_members WHERE server_id = _server_id AND user_id = _target_user_id
  );
  DELETE FROM server_members WHERE server_id = _server_id AND user_id = _target_user_id;
END;
$$;


ALTER FUNCTION "public"."kick_member"("_server_id" "uuid", "_user_id" "uuid", "_target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."leave_group_dm"("_conversation_id" "uuid", "_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_is_group boolean;
  v_is_participant boolean;
  v_username text;
  v_display_name text;
  v_participant_count int;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Check if conversation exists and is a group
  SELECT is_group INTO v_is_group
  FROM dm_conversations
  WHERE id = _conversation_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;
  
  IF NOT COALESCE(v_is_group, false) THEN
    RAISE EXCEPTION 'Cannot leave a 1:1 conversation';
  END IF;
  
  -- Check if user is a participant
  SELECT EXISTS (
    SELECT 1 FROM dm_participants
    WHERE conversation_id = _conversation_id AND user_id = _user_id
  ) INTO v_is_participant;
  
  IF NOT v_is_participant THEN
    RAISE EXCEPTION 'User is not a participant';
  END IF;
  
  -- Get username for the system message
  SELECT username, display_name INTO v_username, v_display_name
  FROM users
  WHERE id = _user_id;
  
  -- Send system message about leaving
  INSERT INTO direct_messages (conversation_id, sender_id, content)
  VALUES (
    _conversation_id,
    _user_id,
    '📤 ' || COALESCE(v_display_name, v_username) || ' has left the group chat'
  );
  
  -- Remove user from participants
  DELETE FROM dm_participants
  WHERE conversation_id = _conversation_id AND user_id = _user_id;
  
  -- Check remaining participant count
  SELECT COUNT(*) INTO v_participant_count
  FROM dm_participants
  WHERE conversation_id = _conversation_id;
  
  -- If only 1 or 0 participants left, delete the conversation
  IF v_participant_count <= 1 THEN
    DELETE FROM dm_conversations WHERE id = _conversation_id;
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'left_user', COALESCE(v_display_name, v_username)
  );
END;
$$;


ALTER FUNCTION "public"."leave_group_dm"("_conversation_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."leave_server"("_user_id" "uuid", "_server_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE user_role text; system_channel_id uuid; enable_leave boolean; leave_message_content text; message_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
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
END; $$;


ALTER FUNCTION "public"."leave_server"("_user_id" "uuid", "_server_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_server_invites"("_server_id" "uuid", "_user_id" "uuid") RETURNS TABLE("id" "uuid", "code" "text", "created_at" timestamp with time zone, "created_by" "uuid", "created_by_username" "text", "expires_at" timestamp with time zone, "max_uses" integer, "uses_count" integer, "revoked_at" timestamp with time zone, "revoked_by" "uuid", "revoked_by_username" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN QUERY
  SELECT
    si.id,
    trim(si.code::text) as code,
    si.created_at,
    si.created_by,
    u.username as created_by_username,
    si.expires_at,
    si.max_uses,
    si.uses_count,
    si.revoked_at,
    si.revoked_by,
    ru.username as revoked_by_username
  FROM server_invites si
  JOIN users u ON u.id = si.created_by
  LEFT JOIN users ru ON ru.id = si.revoked_by
  WHERE si.server_id = _server_id
    AND check_user_server_permission(_user_id, _server_id, 'manage_invites')
  ORDER BY si.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."list_server_invites"("_server_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."login_user"("_key_hash" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result json;
  _user_id uuid;
BEGIN
  -- First, get the user_id from user_auth table
  SELECT ua.user_id INTO _user_id
  FROM user_auth ua
  WHERE ua.key_hash = _key_hash
  LIMIT 1;
  
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Then get the user data
  SELECT json_build_object(
    'id', u.id,
    'username', u.username,
    'display_name', u.display_name,
    'avatar_url', u.avatar_url,
    'banner_url', u.banner_url,
    'avatar_decoration', u.avatar_decoration,
    'profile_effect', u.profile_effect,
    'banner_color', u.banner_color,
    'profile_theme_primary', u.profile_theme_primary,
    'profile_theme_accent', u.profile_theme_accent,
    'bio', u.bio,
    'status', u.status,
    'custom_status', u.custom_status,
    'created_at', u.created_at,
    'last_seen', u.last_seen
  ) INTO result
  FROM users u
  WHERE u.id = _user_id;
  
  IF result IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Update status to online
  UPDATE users SET status = 'online', last_seen = now() WHERE id = _user_id;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."login_user"("_key_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_channel_read"("_channel_id" "uuid", "_user_id" "uuid", "_last_read_message_id" "uuid", "_last_read_at" timestamp with time zone DEFAULT "now"()) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  INSERT INTO public.channel_reads (channel_id, user_id, last_read_message_id, last_read_at, mention_count)
  VALUES (_channel_id, _user_id, _last_read_message_id, _last_read_at, 0)
  ON CONFLICT (channel_id, user_id)
  DO UPDATE SET
    last_read_message_id = EXCLUDED.last_read_message_id,
    last_read_at = EXCLUDED.last_read_at,
    mention_count = 0;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."mark_channel_read"("_channel_id" "uuid", "_user_id" "uuid", "_last_read_message_id" "uuid", "_last_read_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_channels_read"("_channel_ids" "uuid"[], "_user_id" "uuid", "_last_read_at" timestamp with time zone DEFAULT "now"()) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  WITH latest AS (
    SELECT DISTINCT ON (m.channel_id)
      m.channel_id,
      m.id AS last_message_id
    FROM public.messages m
    WHERE m.channel_id = ANY(_channel_ids)
    ORDER BY m.channel_id, m.created_at DESC
  )
  INSERT INTO public.channel_reads (channel_id, user_id, last_read_message_id, last_read_at, mention_count)
  SELECT l.channel_id, _user_id, l.last_message_id, _last_read_at, 0
  FROM latest l
  ON CONFLICT (channel_id, user_id)
  DO UPDATE SET
    last_read_message_id = EXCLUDED.last_read_message_id,
    last_read_at = EXCLUDED.last_read_at,
    mention_count = 0;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."mark_channels_read"("_channel_ids" "uuid"[], "_user_id" "uuid", "_last_read_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_dm_read"("_conversation_id" "uuid", "_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  UPDATE dm_participants 
  SET last_read_at = now()
  WHERE conversation_id = _conversation_id AND user_id = _user_id;
  
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."mark_dm_read"("_conversation_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."move_channel_to_category"("_channel_id" "uuid", "_server_id" "uuid", "_category_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE new_position integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM channels WHERE id = _channel_id AND server_id = _server_id) THEN
    RAISE EXCEPTION 'Channel not found in server';
  END IF;
  SELECT COALESCE(MAX(position), -1) + 1 INTO new_position 
  FROM channels WHERE server_id = _server_id AND category_id IS NOT DISTINCT FROM _category_id;
  UPDATE channels SET category_id = _category_id, position = new_position WHERE id = _channel_id AND server_id = _server_id;
  RETURN true;
END; $$;


ALTER FUNCTION "public"."move_channel_to_category"("_channel_id" "uuid", "_server_id" "uuid", "_category_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mute_member"("_server_id" "uuid", "_user_id" "uuid", "_target_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN server_member_roles smr ON smr.role_id = rp.role_id
      JOIN server_members sm ON sm.id = smr.member_id
      WHERE sm.user_id = _user_id AND rp.server_id = _server_id
        AND rp.permission = 'mute_members' AND rp.allowed = true
    ) THEN RAISE EXCEPTION 'You do not have permission to mute members'; END IF;
  END IF;
  UPDATE server_members SET is_muted = true WHERE server_id = _server_id AND user_id = _target_user_id;
END; $$;


ALTER FUNCTION "public"."mute_member"("_server_id" "uuid", "_user_id" "uuid", "_target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."open_dm_conversation"("_user_id" "uuid", "_other_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE existing_conversation_id uuid; new_conversation_id uuid; result json;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT dp1.conversation_id INTO existing_conversation_id
  FROM dm_participants dp1 JOIN dm_participants dp2 ON dp1.conversation_id = dp2.conversation_id
  WHERE dp1.user_id = _user_id AND dp2.user_id = _other_user_id;
  IF existing_conversation_id IS NOT NULL THEN
    SELECT json_build_object('id', dc.id, 'created_at', dc.created_at) INTO result FROM dm_conversations dc WHERE dc.id = existing_conversation_id;
    RETURN result;
  END IF;
  IF EXISTS (
    SELECT 1 FROM friendships f WHERE f.status = 'blocked'
    AND ((f.requester_id = _user_id AND f.addressee_id = _other_user_id) OR (f.requester_id = _other_user_id AND f.addressee_id = _user_id))
  ) THEN RAISE EXCEPTION 'Cannot message this user'; END IF;
  INSERT INTO dm_conversations DEFAULT VALUES RETURNING id INTO new_conversation_id;
  INSERT INTO dm_participants (conversation_id, user_id) VALUES (new_conversation_id, _user_id), (new_conversation_id, _other_user_id);
  SELECT json_build_object('id', dc.id, 'created_at', dc.created_at) INTO result FROM dm_conversations dc WHERE dc.id = new_conversation_id;
  RETURN result;
END; $$;


ALTER FUNCTION "public"."open_dm_conversation"("_user_id" "uuid", "_other_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pin_message"("_message_id" "uuid", "_user_id" "uuid", "_pinned" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _channel_id uuid;
  _server_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT channel_id INTO _channel_id FROM messages WHERE id = _message_id;
  IF _channel_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;
  SELECT server_id INTO _server_id FROM channels WHERE id = _channel_id;
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT public.check_user_permission(_user_id, _channel_id, 'pin_messages'::permission_type) THEN
      RAISE EXCEPTION 'You do not have permission to pin messages';
    END IF;
  END IF;
  UPDATE messages SET is_pinned = _pinned WHERE id = _message_id;
END;
$$;


ALTER FUNCTION "public"."pin_message"("_message_id" "uuid", "_user_id" "uuid", "_pinned" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."post_system_message"("_channel_id" "uuid", "_user_id" "uuid", "_content" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _message_id UUID;
  channel_exists boolean;
  user_exists boolean;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT EXISTS(SELECT 1 FROM channels WHERE id = _channel_id) INTO channel_exists;
  IF NOT channel_exists THEN
    RAISE EXCEPTION 'Channel not found: %', _channel_id;
  END IF;

  SELECT EXISTS(SELECT 1 FROM users WHERE id = _user_id) INTO user_exists;
  IF NOT user_exists THEN
    RAISE EXCEPTION 'User not found: %', _user_id;
  END IF;

  INSERT INTO messages (channel_id, user_id, content, is_system_message)
  VALUES (_channel_id, _user_id, _content, TRUE)
  RETURNING id INTO _message_id;

  RETURN _message_id;
END;
$$;


ALTER FUNCTION "public"."post_system_message"("_channel_id" "uuid", "_user_id" "uuid", "_content" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."publish_e2e_key_bundle"("_user_id" "uuid", "_public_key" "text", "_key_fingerprint" character varying, "_registration_id" integer, "_encrypted_private_key" "text", "_backup_iv" "text", "_backup_salt" "text", "_device_id" integer, "_device_name" character varying, "_prekeys" "jsonb", "_signed_prekey_id" integer, "_signed_prekey_public" "text", "_signed_prekey_signature" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
    -- Insert identity key (or update if re-registering device)
    INSERT INTO user_identity_keys (user_id, public_key, key_fingerprint, registration_id)
    VALUES (_user_id, _public_key, _key_fingerprint, _registration_id)
    ON CONFLICT (user_id) DO UPDATE SET
        public_key = EXCLUDED.public_key,
        key_fingerprint = EXCLUDED.key_fingerprint,
        registration_id = EXCLUDED.registration_id;

    -- Insert encrypted key backup
    INSERT INTO user_key_backups (user_id, encrypted_identity_private_key, iv, salt)
    VALUES (_user_id, _encrypted_private_key, _backup_iv, _backup_salt)
    ON CONFLICT (user_id) DO UPDATE SET
        encrypted_identity_private_key = EXCLUDED.encrypted_identity_private_key,
        iv = EXCLUDED.iv,
        salt = EXCLUDED.salt,
        updated_at = NOW();

    -- Register device
    INSERT INTO user_devices (user_id, device_id, device_name, identity_public_key)
    VALUES (_user_id, _device_id, _device_name, _public_key)
    ON CONFLICT (user_id, device_id) DO UPDATE SET
        device_name = EXCLUDED.device_name,
        identity_public_key = EXCLUDED.identity_public_key,
        last_active = NOW();

    -- Insert one-time pre-keys
    INSERT INTO user_prekeys (user_id, device_id, key_id, public_key)
    SELECT _user_id, _device_id, 
           (item->>'key_id')::INTEGER, 
           item->>'public_key'
    FROM jsonb_array_elements(_prekeys) AS item
    ON CONFLICT (user_id, device_id, key_id) DO NOTHING;

    -- Insert signed pre-key
    INSERT INTO user_signed_prekeys (user_id, device_id, key_id, public_key, signature)
    VALUES (_user_id, _device_id, _signed_prekey_id, _signed_prekey_public, _signed_prekey_signature)
    ON CONFLICT (user_id, device_id, key_id) DO UPDATE SET
        public_key = EXCLUDED.public_key,
        signature = EXCLUDED.signature,
        is_active = TRUE;

    RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."publish_e2e_key_bundle"("_user_id" "uuid", "_public_key" "text", "_key_fingerprint" character varying, "_registration_id" integer, "_encrypted_private_key" "text", "_backup_iv" "text", "_backup_salt" "text", "_device_id" integer, "_device_name" character varying, "_prekeys" "jsonb", "_signed_prekey_id" integer, "_signed_prekey_public" "text", "_signed_prekey_signature" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recompute_poll_results"("_poll_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _options text[];
  _n integer;
  _results jsonb;
  _total integer;
BEGIN
  SELECT options INTO _options FROM public.polls WHERE id = _poll_id;
  IF _options IS NULL THEN
    RAISE EXCEPTION 'Poll not found';
  END IF;

  _n := COALESCE(array_length(_options, 1), 0);

  SELECT jsonb_agg(COALESCE(v.cnt, 0) ORDER BY s.i)
  INTO _results
  FROM generate_series(0, GREATEST(_n - 1, 0)) AS s(i)
  LEFT JOIN (
    SELECT option_index, COUNT(*)::int AS cnt
    FROM public.poll_votes
    WHERE poll_id = _poll_id
    GROUP BY option_index
  ) v ON v.option_index = s.i;

  SELECT COUNT(*)::int INTO _total FROM public.poll_votes WHERE poll_id = _poll_id;

  UPDATE public.polls
  SET results = COALESCE(_results, '[]'::jsonb),
      total_votes = COALESCE(_total, 0)
  WHERE id = _poll_id;
END;
$$;


ALTER FUNCTION "public"."recompute_poll_results"("_poll_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."regenerate_invite_code"("_server_id" "uuid", "_user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  new_code text;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Check permission using database-backed permission system
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_invites') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  -- Generate new invite code (8 characters, alphanumeric, excluding ambiguous chars)
  new_code := upper(
    substring(
      md5(random()::text || clock_timestamp()::text) 
      from 1 for 8
    )
  );
  
  -- Update server with new invite code
  UPDATE servers 
  SET invite_code = new_code 
  WHERE id = _server_id;
  
  RETURN new_code;
END;
$$;


ALTER FUNCTION "public"."regenerate_invite_code"("_server_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."register_user"("_username" "text", "_key_hash" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN public.register_user(_username, _key_hash, '#5865F2');
END;
$$;


ALTER FUNCTION "public"."register_user"("_username" "text", "_key_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."register_user"("_username" "text", "_key_hash" "text", "_banner_color" "text" DEFAULT '#5865F2'::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  new_user_id uuid;
  result json;
BEGIN
  IF public.get_maintenance_mode() THEN
    RAISE EXCEPTION 'Registration is temporarily disabled. Please try again later.';
  END IF;

  IF length(_username) < 3 OR length(_username) > 20 THEN
    RAISE EXCEPTION 'Username must be between 3 and 20 characters';
  END IF;

  IF _username !~ '^[a-z0-9_]+$' THEN
    RAISE EXCEPTION 'Username can only contain lowercase letters, numbers, and underscores';
  END IF;

  IF _username IN ('admin', 'administrator', 'moderator', 'user', 'system', 'root', 'support', 'help') THEN
    RAISE EXCEPTION 'This username is reserved';
  END IF;

  IF EXISTS (SELECT 1 FROM users WHERE username = lower(trim(_username))) THEN
    RAISE EXCEPTION 'Username already taken';
  END IF;

  -- Insert user row (no key_hash; it lives in user_auth)
  INSERT INTO users (username, status, banner_color)
  VALUES (lower(trim(_username)), 'online', COALESCE(NULLIF(trim(_banner_color), ''), '#5865F2'))
  RETURNING id INTO new_user_id;

  -- Store key hash in user_auth for login / x-key-hash resolution
  INSERT INTO user_auth (user_id, key_hash)
  VALUES (new_user_id, _key_hash);

  SELECT json_build_object(
    'id', u.id,
    'username', u.username,
    'display_name', u.display_name,
    'avatar_url', u.avatar_url,
    'banner_url', u.banner_url,
    'avatar_decoration', u.avatar_decoration,
    'profile_effect', u.profile_effect,
    'banner_color', u.banner_color,
    'profile_theme_primary', u.profile_theme_primary,
    'profile_theme_accent', u.profile_theme_accent,
    'bio', u.bio,
    'status', u.status,
    'custom_status', u.custom_status,
    'created_at', u.created_at,
    'last_seen', u.last_seen
  ) INTO result
  FROM users u
  WHERE u.id = new_user_id;

  RETURN result;
END;
$_$;


ALTER FUNCTION "public"."register_user"("_username" "text", "_key_hash" "text", "_banner_color" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_channel_member"("_channel_id" "uuid", "_target_user_id" "uuid", "_removed_by" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _channel RECORD;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get channel info
  SELECT id, server_id, is_private INTO _channel
  FROM channels WHERE id = _channel_id;
  
  IF NOT FOUND OR NOT _channel.is_private THEN
    RETURN false;
  END IF;
  
  -- Check if remover has permission (admin/owner or removing self)
  IF _removed_by != _target_user_id AND NOT EXISTS (
    SELECT 1 FROM server_members 
    WHERE server_id = _channel.server_id 
    AND user_id = _removed_by 
    AND role IN ('owner', 'admin')
  ) THEN
    RETURN false;
  END IF;
  
  -- Delete member
  DELETE FROM channel_members 
  WHERE channel_id = _channel_id AND user_id = _target_user_id;
  
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."remove_channel_member"("_channel_id" "uuid", "_target_user_id" "uuid", "_removed_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_dm_reaction"("_message_id" "uuid", "_user_id" "uuid", "_emoji" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  DELETE FROM dm_reactions WHERE message_id = _message_id AND user_id = _user_id AND emoji = _emoji;
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."remove_dm_reaction"("_message_id" "uuid", "_user_id" "uuid", "_emoji" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_friend"("_friendship_id" "uuid", "_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _caller_id uuid;
BEGIN
  _caller_id := public.get_request_user_id();
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _user_id IS DISTINCT FROM _caller_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Delete the friendship if the user is either the requester or addressee
  DELETE FROM friendships
  WHERE id = _friendship_id
    AND (requester_id = _caller_id OR addressee_id = _caller_id)
    AND status = 'accepted';

  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."remove_friend"("_friendship_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_reaction"("_message_id" "uuid", "_user_id" "uuid", "_emoji" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  channel_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get the channel_id from the message
  SELECT m.channel_id INTO channel_id
  FROM messages m
  WHERE m.id = _message_id;
  
  IF channel_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;
  
  -- Check permission using database-backed permission system
  IF NOT public.check_user_permission(_user_id, channel_id, 'add_reactions') THEN
    RAISE EXCEPTION 'You do not have permission to remove reactions in this channel';
  END IF;
  
  DELETE FROM reactions WHERE message_id = _message_id AND user_id = _user_id AND emoji = _emoji;
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."remove_reaction"("_message_id" "uuid", "_user_id" "uuid", "_emoji" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_role_from_member"("_user_id" "uuid", "_member_id" "uuid", "_role_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _server_id uuid;
  _is_owner boolean;
  _has_manage_roles boolean;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT server_id INTO _server_id FROM server_members WHERE id = _member_id;
  IF _server_id IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  SELECT (owner_id = _user_id) INTO _is_owner FROM servers WHERE id = _server_id;

  IF _is_owner THEN
    DELETE FROM server_member_roles WHERE member_id = _member_id AND role_id = _role_id;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM server_member_roles smr
    JOIN server_members sm ON sm.id = smr.member_id
    JOIN role_permissions rp ON rp.role_id = smr.role_id AND rp.server_id = _server_id
    WHERE sm.user_id = _user_id AND sm.server_id = _server_id
      AND rp.permission = 'manage_roles' AND rp.allowed = true
  ) INTO _has_manage_roles;

  IF NOT _has_manage_roles THEN
    RAISE EXCEPTION 'Only admins and owners can remove roles';
  END IF;

  DELETE FROM server_member_roles WHERE member_id = _member_id AND role_id = _role_id;
END;
$$;


ALTER FUNCTION "public"."remove_role_from_member"("_user_id" "uuid", "_member_id" "uuid", "_role_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rename_server_emoji"("_emoji_id" "uuid", "_user_id" "uuid", "_new_name" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  _server_id UUID;
  _role TEXT;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get the server this emoji belongs to
  SELECT server_id INTO _server_id
  FROM server_emojis
  WHERE id = _emoji_id;

  IF _server_id IS NULL THEN
    RAISE EXCEPTION 'Emoji not found';
  END IF;

  -- Check user's role in the server
  SELECT role INTO _role
  FROM server_members
  WHERE server_id = _server_id AND user_id = _user_id;

  IF _role IS NULL THEN
    RAISE EXCEPTION 'Not a member of this server';
  END IF;

  IF _role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- Validate name format
  IF _new_name !~ '^[a-z0-9_]{2,32}$' THEN
    RAISE EXCEPTION 'Invalid emoji name format';
  END IF;

  -- Update the emoji name
  UPDATE server_emojis
  SET name = _new_name
  WHERE id = _emoji_id AND server_id = _server_id;
END;
$_$;


ALTER FUNCTION "public"."rename_server_emoji"("_emoji_id" "uuid", "_user_id" "uuid", "_new_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reorder_categories"("_server_id" "uuid", "_user_id" "uuid", "_category_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  i INTEGER;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Verify user is admin/owner of the server
  IF NOT EXISTS (
    SELECT 1 FROM server_members
    WHERE server_id = _server_id AND user_id = _user_id
      AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Update positions
  FOR i IN 1..array_length(_category_ids, 1) LOOP
    UPDATE channel_categories
    SET position = i - 1
    WHERE id = _category_ids[i] AND server_id = _server_id;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."reorder_categories"("_server_id" "uuid", "_user_id" "uuid", "_category_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reorder_channels"("_server_id" "uuid", "_user_id" "uuid", "_channel_id" "uuid", "_new_category_id" "uuid", "_new_position" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _old_category_id UUID;
  _old_position INTEGER;
  _rec RECORD;
  _pos INTEGER;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Verify user is admin/owner
  IF NOT EXISTS (
    SELECT 1 FROM server_members
    WHERE server_id = _server_id AND user_id = _user_id
      AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Get current channel info
  SELECT category_id, position INTO _old_category_id, _old_position
  FROM channels
  WHERE id = _channel_id AND server_id = _server_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;

  -- Normalize positions in the old category (fix duplicate positions like all-zeros)
  _pos := 0;
  FOR _rec IN
    SELECT id FROM channels
    WHERE server_id = _server_id
      AND category_id IS NOT DISTINCT FROM _old_category_id
    ORDER BY position, created_at
  LOOP
    UPDATE channels SET position = _pos WHERE id = _rec.id;
    _pos := _pos + 1;
  END LOOP;

  -- If moving to a different category, also normalize the target category
  IF NOT (_old_category_id IS NOT DISTINCT FROM _new_category_id) THEN
    _pos := 0;
    FOR _rec IN
      SELECT id FROM channels
      WHERE server_id = _server_id
        AND category_id IS NOT DISTINCT FROM _new_category_id
      ORDER BY position, created_at
    LOOP
      UPDATE channels SET position = _pos WHERE id = _rec.id;
      _pos := _pos + 1;
    END LOOP;
  END IF;

  -- Re-read the channel's position after normalization
  SELECT position INTO _old_position
  FROM channels
  WHERE id = _channel_id AND server_id = _server_id;

  -- If moving within the same category
  IF (_old_category_id IS NOT DISTINCT FROM _new_category_id) THEN
    IF _new_position > _old_position THEN
      UPDATE channels
      SET position = position - 1
      WHERE server_id = _server_id
        AND category_id IS NOT DISTINCT FROM _new_category_id
        AND position > _old_position AND position <= _new_position
        AND id != _channel_id;
    ELSIF _new_position < _old_position THEN
      UPDATE channels
      SET position = position + 1
      WHERE server_id = _server_id
        AND category_id IS NOT DISTINCT FROM _new_category_id
        AND position >= _new_position AND position < _old_position
        AND id != _channel_id;
    END IF;
  ELSE
    -- Moving to different category: close gap in old category
    UPDATE channels
    SET position = position - 1
    WHERE server_id = _server_id
      AND category_id IS NOT DISTINCT FROM _old_category_id
      AND position > _old_position;

    -- Make room in new category
    UPDATE channels
    SET position = position + 1
    WHERE server_id = _server_id
      AND category_id IS NOT DISTINCT FROM _new_category_id
      AND position >= _new_position;
  END IF;

  -- Set the channel's new category and position
  UPDATE channels
  SET category_id = _new_category_id, position = _new_position
  WHERE id = _channel_id AND server_id = _server_id;
END;
$$;


ALTER FUNCTION "public"."reorder_channels"("_server_id" "uuid", "_user_id" "uuid", "_channel_id" "uuid", "_new_category_id" "uuid", "_new_position" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reorder_server_roles"("_server_id" "uuid", "_user_id" "uuid", "_ordered_role_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  i INT;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Verify user has permission (correct parameter order: user_id, server_id, permission)
  IF NOT check_user_server_permission(_user_id, _server_id, 'manage_roles') THEN
    RAISE EXCEPTION 'Permission denied: cannot reorder roles';
  END IF;

  -- Update positions based on array order
  FOR i IN 1..array_length(_ordered_role_ids, 1) LOOP
    UPDATE server_roles
    SET position = i - 1
    WHERE id = _ordered_role_ids[i]
      AND server_id = _server_id;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."reorder_server_roles"("_server_id" "uuid", "_user_id" "uuid", "_ordered_role_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reorder_user_servers"("_user_id" "uuid", "_server_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  FOR i IN 1..array_length(_server_ids, 1) LOOP
    UPDATE server_members 
    SET position = i
    WHERE user_id = _user_id AND server_id = _server_ids[i];
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."reorder_user_servers"("_user_id" "uuid", "_server_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."replenish_prekeys"("_user_id" "uuid", "_device_id" integer, "_prekeys" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    inserted_count INTEGER;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
    WITH inserted AS (
        INSERT INTO user_prekeys (user_id, device_id, key_id, public_key)
        SELECT _user_id, _device_id,
               (item->>'key_id')::INTEGER,
               item->>'public_key'
        FROM jsonb_array_elements(_prekeys) AS item
        ON CONFLICT (user_id, device_id, key_id) DO NOTHING
        RETURNING id
    )
    SELECT COUNT(*) INTO inserted_count FROM inserted;

    RETURN inserted_count;
END;
$$;


ALTER FUNCTION "public"."replenish_prekeys"("_user_id" "uuid", "_device_id" integer, "_prekeys" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."requesting_user_id"() RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  BEGIN
    RETURN public.get_request_user_id();
  EXCEPTION
    WHEN OTHERS THEN
      RETURN NULL;
  END;
END;
$$;


ALTER FUNCTION "public"."requesting_user_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_mention_count_on_read"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- If the user is updating their last_read_message_id, reset pings to 0
  IF NEW.last_read_message_id IS DISTINCT FROM OLD.last_read_message_id THEN
    NEW.mention_count := 0;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."reset_mention_count_on_read"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_user_secret_key"("_user_id" "uuid", "_new_key_hash" character) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_last_reset TIMESTAMP WITH TIME ZONE;
  v_cooldown_hours INT := 24;
  v_time_remaining INTERVAL;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT last_key_reset_at INTO v_last_reset
  FROM user_auth
  WHERE user_id = _user_id;

  IF v_last_reset IS NOT NULL AND
     v_last_reset > (NOW() - (v_cooldown_hours || ' hours')::INTERVAL) THEN
    v_time_remaining := v_last_reset + (v_cooldown_hours || ' hours')::INTERVAL - NOW();
    RETURN json_build_object(
      'success', false,
      'error', 'cooldown',
      'cooldown_ends_at', v_last_reset + (v_cooldown_hours || ' hours')::INTERVAL,
      'hours_remaining', EXTRACT(EPOCH FROM v_time_remaining) / 3600
    );
  END IF;

  UPDATE user_auth
  SET key_hash = _new_key_hash,
      last_key_reset_at = NOW()
  WHERE user_id = _user_id;

  RETURN json_build_object(
    'success', true,
    'last_key_reset_at', NOW()
  );
END;
$$;


ALTER FUNCTION "public"."reset_user_secret_key"("_user_id" "uuid", "_new_key_hash" character) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revoke_server_invite"("_invite_id" "uuid", "_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  target_server_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT si.server_id INTO target_server_id
  FROM public.server_invites si
  WHERE si.id = _invite_id;

  IF target_server_id IS NULL THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, target_server_id, 'manage_invites') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.server_invites
  SET revoked_at = now(),
      revoked_by = _user_id
  WHERE id = _invite_id
    AND revoked_at IS NULL;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."revoke_server_invite"("_invite_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_user_server_folders"("_user_id" "uuid", "_folder_data" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Upsert the folder data
  INSERT INTO public.user_server_folders (user_id, folder_data, updated_at)
  VALUES (_user_id, _folder_data, now())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    folder_data = EXCLUDED.folder_data,
    updated_at = now();
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."save_user_server_folders"("_user_id" "uuid", "_folder_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_user_server_tabs"("_user_id" "uuid", "_tab_data" "text"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  INSERT INTO user_server_tabs (user_id, tab_order, updated_at)
  VALUES (_user_id, _tab_data, now())
  ON CONFLICT (user_id) 
  DO UPDATE SET tab_order = _tab_data, updated_at = now();
END;
$$;


ALTER FUNCTION "public"."save_user_server_tabs"("_user_id" "uuid", "_tab_data" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_messages"("search_query" "text", "server_filter" "uuid" DEFAULT NULL::"uuid", "channel_filter" "uuid" DEFAULT NULL::"uuid", "user_filter" "uuid" DEFAULT NULL::"uuid", "result_limit" integer DEFAULT 50) RETURNS TABLE("message_id" "uuid", "channel_id" "uuid", "user_id" "uuid", "content" "text", "created_at" timestamp with time zone, "rank" real)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _current_user_id uuid;
BEGIN
  _current_user_id := public.requesting_user_id();

  IF _current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify user is member of the server if filtering by server
  IF server_filter IS NOT NULL THEN
    IF NOT public.is_server_member(server_filter, _current_user_id) THEN
      RAISE EXCEPTION 'Access denied: not a member of this server';
    END IF;
  END IF;

  -- Only return messages from servers the user is a member of
  RETURN QUERY
  SELECT
    m.id AS message_id,
    m.channel_id,
    m.user_id,
    m.content,
    m.created_at,
    ts_rank(to_tsvector('english', m.content), plainto_tsquery('english', search_query)) AS rank
  FROM public.messages m
  JOIN public.channels c ON m.channel_id = c.id
  WHERE
    to_tsvector('english', m.content) @@ plainto_tsquery('english', search_query)
    AND (server_filter IS NULL OR c.server_id = server_filter)
    AND (channel_filter IS NULL OR m.channel_id = channel_filter)
    AND (user_filter IS NULL OR m.user_id = user_filter)
    AND public.is_server_member(c.server_id, _current_user_id)
  ORDER BY rank DESC, m.created_at DESC
  LIMIT result_limit;
END;
$$;


ALTER FUNCTION "public"."search_messages"("search_query" "text", "server_filter" "uuid", "channel_filter" "uuid", "user_filter" "uuid", "result_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_dm"("_conversation_id" "uuid", "_sender_id" "uuid", "_content" "text", "_reply_to_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  new_message_id uuid;
  other_user_id uuid;
  result json;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_sender_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  IF _content IS NULL OR trim(_content) = '' THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;
  IF char_length(_content) > 2000 THEN
    RAISE EXCEPTION 'Message must be 2000 characters or less';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM dm_participants
    WHERE conversation_id = _conversation_id AND user_id = _sender_id
  ) THEN
    RAISE EXCEPTION 'Not a participant in this conversation';
  END IF;

  SELECT dp.user_id INTO other_user_id
  FROM dm_participants dp
  WHERE dp.conversation_id = _conversation_id
    AND dp.user_id <> _sender_id
  LIMIT 1;

  IF other_user_id IS NULL THEN
    RAISE EXCEPTION 'Conversation has no recipient';
  END IF;

  IF EXISTS (
    SELECT 1 FROM friendships f
    WHERE f.status = 'blocked'
      AND ((f.requester_id = _sender_id AND f.addressee_id = other_user_id)
        OR (f.requester_id = other_user_id AND f.addressee_id = _sender_id))
  ) THEN
    RAISE EXCEPTION 'Cannot send DM to this user';
  END IF;

  INSERT INTO direct_messages (conversation_id, sender_id, content, reply_to_id)
  VALUES (_conversation_id, _sender_id, _content, _reply_to_id)
  RETURNING id INTO new_message_id;

  SELECT json_build_object(
    'id', dm.id, 'conversation_id', dm.conversation_id, 'sender_id', dm.sender_id,
    'content', dm.content, 'reply_to_id', dm.reply_to_id,
    'created_at', dm.created_at, 'edited_at', dm.edited_at
  ) INTO result FROM direct_messages dm WHERE dm.id = new_message_id;

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."send_dm"("_conversation_id" "uuid", "_sender_id" "uuid", "_content" "text", "_reply_to_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_friend_request"("_requester_id" "uuid", "_addressee_username" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _caller_id uuid;
  _addressee_id uuid;
  _existing_friendship record;
  _declined_request record;
  _new_friendship record;
  _cooldown_minutes int := 5;
  _time_since_decline interval;
  _remaining_minutes int;
BEGIN
  _caller_id := public.get_request_user_id();
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _requester_id IS DISTINCT FROM _caller_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Find the addressee by username
  SELECT id INTO _addressee_id
  FROM users
  WHERE lower(username) = lower(_addressee_username);

  IF _addressee_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Check if trying to friend self
  IF _addressee_id = _requester_id THEN
    RAISE EXCEPTION 'Cannot send friend request to yourself';
  END IF;

  -- Check for existing friendship in either direction
  SELECT * INTO _existing_friendship
  FROM friendships
  WHERE (requester_id = _requester_id AND addressee_id = _addressee_id)
     OR (requester_id = _addressee_id AND addressee_id = _requester_id);

  IF _existing_friendship IS NOT NULL THEN
    -- Already friends
    IF _existing_friendship.status = 'accepted' THEN
      RAISE EXCEPTION 'Already friends with this user';
    END IF;

    -- Blocked by either party
    IF _existing_friendship.status = 'blocked' THEN
      RAISE EXCEPTION 'Cannot send friend request';
    END IF;

    -- Pending request exists
    IF _existing_friendship.status = 'pending' THEN
      IF _existing_friendship.requester_id = _requester_id THEN
        RAISE EXCEPTION 'Friend request already pending';
      ELSE
        -- The other user sent me a request, I can accept by sending one back
        UPDATE friendships
        SET status = 'accepted'
        WHERE id = _existing_friendship.id
        RETURNING * INTO _existing_friendship;

        RETURN json_build_object('id', _existing_friendship.id, 'status', 'accepted');
      END IF;
    END IF;
  END IF;

  -- Check for recently declined request with cooldown
  SELECT * INTO _declined_request
  FROM declined_friend_requests
  WHERE requester_id = _requester_id AND addressee_id = _addressee_id;

  IF _declined_request IS NOT NULL THEN
    _time_since_decline := now() - _declined_request.declined_at;

    IF _time_since_decline < (_cooldown_minutes || ' minutes')::interval THEN
      _remaining_minutes := ceil(extract(epoch from ((_cooldown_minutes || ' minutes')::interval - _time_since_decline)) / 60);
      RAISE EXCEPTION 'You can send another request in % minute(s)', _remaining_minutes;
    END IF;

    -- Cooldown passed, remove the declined record
    DELETE FROM declined_friend_requests
    WHERE requester_id = _requester_id AND addressee_id = _addressee_id;
  END IF;

  -- Create new friendship request
  INSERT INTO friendships (requester_id, addressee_id, status, created_at)
  VALUES (_requester_id, _addressee_id, 'pending', now())
  RETURNING * INTO _new_friendship;

  -- Create notification for addressee
  PERFORM create_notification(
    _user_id := _addressee_id,
    _type := 'friend_request',
    _title := 'New Friend Request',
    _body := (SELECT username FROM users WHERE id = _requester_id) || ' sent you a friend request',
    _link := '/app'
  );

  RETURN json_build_object('id', _new_friendship.id, 'status', 'pending');
END;
$$;


ALTER FUNCTION "public"."send_friend_request"("_requester_id" "uuid", "_addressee_username" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_message"("_channel_id" "uuid", "_user_id" "uuid", "_content" "text", "_reply_to_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  channel_server_id uuid;
  is_muted boolean;
  new_message_id uuid;
  result json;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  IF _content IS NULL OR trim(_content) = '' THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;
  IF char_length(_content) > 2000 THEN
    RAISE EXCEPTION 'Message must be 2000 characters or less';
  END IF;

  SELECT server_id INTO channel_server_id FROM channels WHERE id = _channel_id;
  
  SELECT sm.is_muted INTO is_muted FROM server_members sm
  WHERE sm.server_id = channel_server_id AND sm.user_id = _user_id AND sm.is_banned = false;
  
  IF is_muted IS NULL THEN
    RAISE EXCEPTION 'Not a member of this server';
  END IF;
  
  IF is_muted THEN
    RAISE EXCEPTION 'You are muted in this server';
  END IF;
  
  INSERT INTO messages (channel_id, user_id, content, reply_to_id)
  VALUES (_channel_id, _user_id, _content, _reply_to_id)
  RETURNING id INTO new_message_id;
  
  SELECT json_build_object(
    'id', m.id, 'channel_id', m.channel_id, 'user_id', m.user_id,
    'content', m.content, 'reply_to_id', m.reply_to_id, 'is_pinned', m.is_pinned,
    'edited_at', m.edited_at, 'created_at', m.created_at
  ) INTO result FROM messages m WHERE m.id = new_message_id;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."send_message"("_channel_id" "uuid", "_user_id" "uuid", "_content" "text", "_reply_to_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_poll"("_channel_id" "uuid", "_user_id" "uuid", "_question" "text", "_options" "text"[], "_allow_multiple" boolean DEFAULT false, "_duration_seconds" integer DEFAULT 1800, "_reply_to_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  channel_server_id uuid;
  is_muted boolean;
  new_message_id uuid;
  new_poll_id uuid;
  _ends_at timestamptz;
  _n integer;
  _results_init jsonb;
  result json;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  IF _question IS NULL OR length(trim(_question)) = 0 THEN
    RAISE EXCEPTION 'Poll question is required';
  END IF;

  _n := COALESCE(array_length(_options, 1), 0);
  IF _n < 2 OR _n > 4 THEN
    RAISE EXCEPTION 'Poll must have 2-4 options';
  END IF;

  IF _duration_seconds IS NULL OR _duration_seconds < 60 THEN
    RAISE EXCEPTION 'Poll duration must be at least 60 seconds';
  END IF;

  -- Permissions/membership checks (mirror send_message behaviour)
  SELECT server_id INTO channel_server_id FROM public.channels WHERE id = _channel_id;
  IF channel_server_id IS NULL THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;

  SELECT sm.is_muted INTO is_muted FROM public.server_members sm
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

  IF (SELECT is_read_only FROM public.channels WHERE id = _channel_id) = true THEN
    IF NOT public.check_user_permission(_user_id, _channel_id, 'manage_messages') THEN
      RAISE EXCEPTION 'This channel is read-only';
    END IF;
  END IF;

  _ends_at := now() + make_interval(secs => _duration_seconds);

  new_poll_id := gen_random_uuid();

  -- Create message with final poll marker content (avoids realtime INSERT then UPDATE flicker)
  INSERT INTO public.messages (channel_id, user_id, content, reply_to_id)
  VALUES (_channel_id, _user_id, '__kloak_poll__:' || new_poll_id::text, _reply_to_id)
  RETURNING id INTO new_message_id;

  SELECT jsonb_agg(0) INTO _results_init FROM generate_series(1, _n);

  INSERT INTO public.polls (
    id,
    message_id,
    channel_id,
    created_by,
    question,
    options,
    allow_multiple,
    ends_at,
    is_closed,
    results,
    total_votes
  ) VALUES (
    new_poll_id,
    new_message_id,
    _channel_id,
    _user_id,
    trim(_question),
    _options,
    COALESCE(_allow_multiple, false),
    _ends_at,
    false,
    COALESCE(_results_init, '[]'::jsonb),
    0
  );

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
  FROM public.messages m WHERE m.id = new_message_id;

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."send_poll"("_channel_id" "uuid", "_user_id" "uuid", "_question" "text", "_options" "text"[], "_allow_multiple" boolean, "_duration_seconds" integer, "_reply_to_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_thread_message"("_thread_id" "uuid", "_user_id" "uuid", "_content" "text", "_reply_to_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  thread_channel_id uuid;
  channel_server_id uuid;
  is_muted boolean;
  new_message_id uuid;
  result json;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get thread's channel
  SELECT channel_id INTO thread_channel_id
  FROM threads
  WHERE id = _thread_id;

  IF thread_channel_id IS NULL THEN
    RAISE EXCEPTION 'Thread not found';
  END IF;

  -- Get channel's server
  SELECT server_id INTO channel_server_id
  FROM channels
  WHERE id = thread_channel_id;

  -- Check membership and muted status
  SELECT sm.is_muted INTO is_muted
  FROM server_members sm
  WHERE sm.server_id = channel_server_id
    AND sm.user_id = _user_id
    AND sm.is_banned = false;

  IF is_muted IS NULL THEN
    RAISE EXCEPTION 'Not a member of this server';
  END IF;

  IF is_muted THEN
    RAISE EXCEPTION 'You are muted in this server';
  END IF;

  -- Insert thread message
  INSERT INTO thread_messages (thread_id, user_id, content, reply_to_id)
  VALUES (_thread_id, _user_id, _content, _reply_to_id)
  RETURNING id INTO new_message_id;

  -- Return the message
  SELECT json_build_object(
    'id', tm.id,
    'thread_id', tm.thread_id,
    'user_id', tm.user_id,
    'content', tm.content,
    'reply_to_id', tm.reply_to_id,
    'edited_at', tm.edited_at,
    'created_at', tm.created_at
  ) INTO result
  FROM thread_messages tm
  WHERE tm.id = new_message_id;

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."send_thread_message"("_thread_id" "uuid", "_user_id" "uuid", "_content" "text", "_reply_to_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_category_permission"("_category_id" "uuid", "_user_id" "uuid", "_permission" "text", "_allowed" boolean, "_role_id" "uuid" DEFAULT NULL::"uuid", "_role_name" "text" DEFAULT NULL::"text", "_target_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _server_id uuid;
BEGIN
  -- Identity verification (conditional for optional user_id)
  IF _user_id IS NOT NULL AND NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get category's server
  SELECT server_id INTO _server_id FROM channel_categories WHERE id = _category_id;
  IF _server_id IS NULL THEN
    RAISE EXCEPTION 'Category not found';
  END IF;

  -- Permission check: owner bypass or manage_channels
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT check_user_server_permission(_user_id, _server_id, 'manage_channels'::permission_type) THEN
      RAISE EXCEPTION 'You do not have permission to manage category permissions';
    END IF;
  END IF;

  -- Upsert based on target type
  IF _target_user_id IS NOT NULL THEN
    INSERT INTO category_permissions (category_id, user_id, permission, allowed)
    VALUES (_category_id, _target_user_id, _permission, _allowed)
    ON CONFLICT (category_id, role_id, role_name, user_id, permission)
    DO UPDATE SET allowed = EXCLUDED.allowed;
  ELSIF _role_id IS NOT NULL THEN
    INSERT INTO category_permissions (category_id, role_id, permission, allowed)
    VALUES (_category_id, _role_id, _permission, _allowed)
    ON CONFLICT (category_id, role_id, role_name, user_id, permission)
    DO UPDATE SET allowed = EXCLUDED.allowed;
  ELSIF _role_name IS NOT NULL THEN
    INSERT INTO category_permissions (category_id, role_name, permission, allowed)
    VALUES (_category_id, _role_name, _permission, _allowed)
    ON CONFLICT (category_id, role_id, role_name, user_id, permission)
    DO UPDATE SET allowed = EXCLUDED.allowed;
  ELSE
    RAISE EXCEPTION 'One of role_id, role_name, or target_user_id must be provided';
  END IF;
END;
$$;


ALTER FUNCTION "public"."set_category_permission"("_category_id" "uuid", "_user_id" "uuid", "_permission" "text", "_allowed" boolean, "_role_id" "uuid", "_role_name" "text", "_target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_channel_permission"("_channel_id" "uuid", "_user_id" "uuid", "_permission" "public"."permission_type", "_allowed" boolean, "_role_id" "uuid" DEFAULT NULL::"uuid", "_role_name" "text" DEFAULT NULL::"text", "_target_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _server_id uuid;
BEGIN
  -- Identity verification (conditional for optional user_id)
  IF _user_id IS NOT NULL AND NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get channel's server
  SELECT server_id INTO _server_id FROM channels WHERE id = _channel_id;
  IF _server_id IS NULL THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;

  -- Permission check: owner bypass or manage_channels
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT check_user_server_permission(_user_id, _server_id, 'manage_channels'::permission_type) THEN
      RAISE EXCEPTION 'You do not have permission to manage channel permissions';
    END IF;
  END IF;

  -- Upsert based on target type
  IF _target_user_id IS NOT NULL THEN
    INSERT INTO channel_permissions (channel_id, user_id, permission, allowed)
    VALUES (_channel_id, _target_user_id, _permission, _allowed)
    ON CONFLICT (channel_id, user_id, permission) WHERE user_id IS NOT NULL
    DO UPDATE SET allowed = EXCLUDED.allowed;
  ELSIF _role_id IS NOT NULL THEN
    INSERT INTO channel_permissions (channel_id, role_id, permission, allowed)
    VALUES (_channel_id, _role_id, _permission, _allowed)
    ON CONFLICT (channel_id, role_id, permission) WHERE role_id IS NOT NULL AND user_id IS NULL
    DO UPDATE SET allowed = EXCLUDED.allowed;
  ELSIF _role_name IS NOT NULL THEN
    INSERT INTO channel_permissions (channel_id, role_name, permission, allowed)
    VALUES (_channel_id, _role_name::server_role, _permission, _allowed)
    ON CONFLICT (channel_id, role_name, permission) WHERE role_name IS NOT NULL AND role_id IS NULL AND user_id IS NULL
    DO UPDATE SET allowed = EXCLUDED.allowed;
  ELSE
    RAISE EXCEPTION 'One of role_id, role_name, or target_user_id must be provided';
  END IF;
END;
$$;


ALTER FUNCTION "public"."set_channel_permission"("_channel_id" "uuid", "_user_id" "uuid", "_permission" "public"."permission_type", "_allowed" boolean, "_role_id" "uuid", "_role_name" "text", "_target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_message_embed_hidden"("_message_id" "uuid", "_user_id" "uuid", "_hidden" boolean) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_message_user_id UUID;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get the message owner
  SELECT user_id INTO v_message_user_id
  FROM messages
  WHERE id = _message_id;
  
  -- Only allow the message author to change embed visibility
  IF v_message_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  IF v_message_user_id != _user_id THEN
    RETURN false;
  END IF;
  
  -- Update the embed_hidden flag
  UPDATE messages
  SET embed_hidden = _hidden
  WHERE id = _message_id;
  
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."set_message_embed_hidden"("_message_id" "uuid", "_user_id" "uuid", "_hidden" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_reaction_channel_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Derive channel_id from messages table
  IF NEW.message_id IS NOT NULL THEN
    SELECT m.channel_id INTO NEW.channel_id FROM public.messages m WHERE m.id = NEW.message_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_reaction_channel_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_role_permission"("_server_id" "uuid", "_user_id" "uuid", "_permission" "public"."permission_type", "_role_id" "uuid" DEFAULT NULL::"uuid", "_role_name" "text" DEFAULT NULL::"text", "_allowed" boolean DEFAULT true) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN server_member_roles smr ON smr.role_id = rp.role_id
      JOIN server_members sm ON sm.id = smr.member_id
      WHERE sm.user_id = _user_id AND rp.server_id = _server_id
        AND rp.permission = 'manage_roles' AND rp.allowed = true
    ) THEN RAISE EXCEPTION 'Only admins and owners can manage role permissions'; END IF;
  END IF;
  IF _role_id IS NOT NULL THEN
    INSERT INTO role_permissions (server_id, role_id, permission, allowed)
    VALUES (_server_id, _role_id, _permission, _allowed)
    ON CONFLICT (server_id, role_id, permission) WHERE role_id IS NOT NULL
    DO UPDATE SET allowed = EXCLUDED.allowed;
  ELSIF _role_name IS NOT NULL THEN
    INSERT INTO role_permissions (server_id, role_name, permission, allowed)
    VALUES (_server_id, _role_name, _permission, _allowed)
    ON CONFLICT (server_id, role_name, permission) WHERE role_name IS NOT NULL AND role_id IS NULL
    DO UPDATE SET allowed = EXCLUDED.allowed;
  END IF;
END; $$;


ALTER FUNCTION "public"."set_role_permission"("_server_id" "uuid", "_user_id" "uuid", "_permission" "public"."permission_type", "_role_id" "uuid", "_role_name" "text", "_allowed" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."shares_dm_with"("_user_id" "uuid", "_other_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM dm_participants dp1
    JOIN dm_participants dp2 ON dp1.conversation_id = dp2.conversation_id
    WHERE dp1.user_id = _user_id 
    AND dp2.user_id = _other_user_id
  )
$$;


ALTER FUNCTION "public"."shares_dm_with"("_user_id" "uuid", "_other_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."shares_server_with"("_user_id" "uuid", "_other_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM server_members sm1
    JOIN server_members sm2 ON sm1.server_id = sm2.server_id
    WHERE sm1.user_id = _user_id 
    AND sm2.user_id = _other_user_id
    AND sm1.is_banned = false 
    AND sm2.is_banned = false
  )
$$;


ALTER FUNCTION "public"."shares_server_with"("_user_id" "uuid", "_other_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_category_permissions_to_channels"("_category_id" "uuid", "_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _server_id uuid;
  _channel record;
  _perm record;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get category's server
  SELECT server_id INTO _server_id FROM channel_categories WHERE id = _category_id;
  IF _server_id IS NULL THEN
    RAISE EXCEPTION 'Category not found';
  END IF;

  -- Permission check
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT check_user_server_permission(_user_id, _server_id, 'manage_channels'::permission_type) THEN
      RAISE EXCEPTION 'You do not have permission to sync category permissions';
    END IF;
  END IF;

  -- For each channel in this category, sync permissions
  FOR _channel IN SELECT id FROM channels WHERE category_id = _category_id LOOP
    -- Delete existing channel permissions that came from category sync
    DELETE FROM channel_permissions WHERE channel_id = _channel.id;

    -- Copy category permissions to channel
    FOR _perm IN SELECT * FROM category_permissions WHERE category_id = _category_id LOOP
      INSERT INTO channel_permissions (channel_id, role_id, role_name, user_id, permission, allowed)
      VALUES (_channel.id, _perm.role_id, _perm.role_name::server_role, _perm.user_id, _perm.permission::permission_type, _perm.allowed)
      ON CONFLICT (channel_id, role_id, permission) WHERE role_id IS NOT NULL AND user_id IS NULL
      DO UPDATE SET allowed = EXCLUDED.allowed;
    END LOOP;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."sync_category_permissions_to_channels"("_category_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."test_channel_permission"("_channel_id" "uuid", "_user_id" "uuid", "_permission" "public"."permission_type") RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  channel_server_id uuid;
  user_base_role server_role;
  user_custom_role_ids uuid[];
  result json;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get channel's server
  SELECT server_id INTO channel_server_id
  FROM channels WHERE id = _channel_id;
  
  -- Get user's base role
  SELECT sm.role INTO user_base_role
  FROM server_members sm
  WHERE sm.server_id = channel_server_id AND sm.user_id = _user_id AND sm.is_banned = false;
  
  -- Get user's custom role IDs
  SELECT COALESCE(ARRAY_AGG(DISTINCT smr.role_id) FILTER (WHERE smr.role_id IS NOT NULL), ARRAY[]::uuid[]) 
  INTO user_custom_role_ids
  FROM server_member_roles smr
  JOIN server_members sm ON sm.id = smr.member_id
  WHERE sm.user_id = _user_id AND sm.server_id = channel_server_id;
  
  -- Get matching channel permissions
  RETURN json_build_object(
    'channel_id', _channel_id,
    'user_id', _user_id,
    'permission', _permission,
    'base_role', user_base_role,
    'custom_role_ids', user_custom_role_ids,
    'has_permission', public.check_user_permission(_user_id, _channel_id, _permission),
    'base_role_overrides', (
      SELECT json_agg(
        json_build_object(
          'id', cp.id,
          'role_name', cp.role_name,
          'permission', cp.permission,
          'allowed', cp.allowed
        )
      )
      FROM channel_permissions cp
      WHERE cp.channel_id = _channel_id
        AND cp.permission = _permission
        AND cp.role_name = user_base_role
        AND cp.role_id IS NULL
    ),
    'custom_role_overrides', (
      SELECT json_agg(
        json_build_object(
          'id', cp.id,
          'role_id', cp.role_id,
          'permission', cp.permission,
          'allowed', cp.allowed
        )
      )
      FROM channel_permissions cp
      WHERE cp.channel_id = _channel_id
        AND cp.permission = _permission
        AND cp.role_id = ANY(COALESCE(user_custom_role_ids, ARRAY[]::uuid[]))
        AND cp.role_name IS NULL
    ),
    'all_channel_permissions', (
      SELECT json_agg(
        json_build_object(
          'id', cp.id,
          'role_id', cp.role_id,
          'role_name', cp.role_name,
          'permission', cp.permission,
          'allowed', cp.allowed
        )
      )
      FROM channel_permissions cp
      WHERE cp.channel_id = _channel_id
        AND cp.permission = _permission
    )
  );
END;
$$;


ALTER FUNCTION "public"."test_channel_permission"("_channel_id" "uuid", "_user_id" "uuid", "_permission" "public"."permission_type") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_announcement_comment_reaction"("_comment_id" "uuid", "_user_id" "uuid", "_emoji" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  msg_channel_id uuid;
  existing_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT m.channel_id INTO msg_channel_id
  FROM announcement_comments ac
  JOIN messages m ON m.id = ac.message_id
  WHERE ac.id = _comment_id;
  IF msg_channel_id IS NULL THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;
  IF NOT check_user_permission(_user_id, msg_channel_id, 'add_reactions') THEN
    RAISE EXCEPTION 'Permission denied: you do not have permission to add reactions';
  END IF;
  SELECT id INTO existing_id FROM announcement_comment_reactions 
  WHERE comment_id = _comment_id AND user_id = _user_id AND emoji = _emoji;
  IF existing_id IS NOT NULL THEN
    DELETE FROM announcement_comment_reactions WHERE id = existing_id;
  ELSE
    INSERT INTO announcement_comment_reactions (comment_id, user_id, emoji) VALUES (_comment_id, _user_id, _emoji);
  END IF;
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."toggle_announcement_comment_reaction"("_comment_id" "uuid", "_user_id" "uuid", "_emoji" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_media_comment_reaction"("_comment_id" "uuid", "_user_id" "uuid", "_emoji" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  media_channel_id uuid;
  existing_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT mi.channel_id INTO media_channel_id
  FROM media_comments mc
  JOIN media_items mi ON mi.id = mc.media_id
  WHERE mc.id = _comment_id;
  IF media_channel_id IS NULL THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;
  IF NOT check_user_permission(_user_id, media_channel_id, 'add_reactions') THEN
    RAISE EXCEPTION 'Permission denied: you do not have permission to add reactions';
  END IF;
  SELECT id INTO existing_id FROM media_comment_reactions 
  WHERE comment_id = _comment_id AND user_id = _user_id AND emoji = _emoji;
  IF existing_id IS NOT NULL THEN
    DELETE FROM media_comment_reactions WHERE id = existing_id;
  ELSE
    INSERT INTO media_comment_reactions (comment_id, user_id, emoji) VALUES (_comment_id, _user_id, _emoji);
  END IF;
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."toggle_media_comment_reaction"("_comment_id" "uuid", "_user_id" "uuid", "_emoji" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_mute_member"("_server_id" "uuid", "_user_id" "uuid", "_target_user_id" "uuid", "_muted" boolean) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  user_role text;
  target_role text;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT role INTO user_role FROM server_members 
  WHERE server_id = _server_id AND user_id = _user_id AND is_banned = false;
  
  SELECT role INTO target_role FROM server_members 
  WHERE server_id = _server_id AND user_id = _target_user_id AND is_banned = false;
  
  IF user_role IS NULL THEN
    RAISE EXCEPTION 'Not a member of this server';
  END IF;
  
  IF target_role IS NULL THEN
    RAISE EXCEPTION 'Target user is not a member of this server';
  END IF;
  
  -- Check permission using database-backed permission system
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'mute_members') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  -- Cannot mute owner
  IF target_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot mute the server owner';
  END IF;
  
  -- Check role hierarchy
  IF user_role = 'moderator' AND target_role IN ('admin', 'moderator', 'owner') THEN
    RAISE EXCEPTION 'Cannot mute users with equal or higher role';
  END IF;
  
  IF user_role = 'admin' AND target_role IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Cannot mute users with equal or higher role';
  END IF;
  
  UPDATE server_members SET is_muted = _muted WHERE server_id = _server_id AND user_id = _target_user_id;
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."toggle_mute_member"("_server_id" "uuid", "_user_id" "uuid", "_target_user_id" "uuid", "_muted" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_pin_message"("_message_id" "uuid", "_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  channel_id uuid;
  result json;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get the channel_id from the message
  SELECT m.channel_id INTO channel_id
  FROM messages m
  WHERE m.id = _message_id;
  
  IF channel_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;
  
  -- Check permission using database-backed permission system
  IF NOT public.check_user_permission(_user_id, channel_id, 'pin_messages') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  -- Toggle pin status
  UPDATE messages SET is_pinned = NOT is_pinned WHERE id = _message_id;
  
  -- Return updated message
  SELECT json_build_object(
    'id', m.id,
    'channel_id', m.channel_id,
    'user_id', m.user_id,
    'content', m.content,
    'is_pinned', m.is_pinned,
    'edited_at', m.edited_at,
    'created_at', m.created_at
  ) INTO result
  FROM messages m
  WHERE m.id = _message_id;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."toggle_pin_message"("_message_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transfer_ownership"("_server_id" "uuid", "_current_owner_id" "uuid", "_new_owner_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  current_owner_member_id uuid;
  new_owner_member_id uuid;
  server_actual_owner uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_current_owner_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT owner_id INTO server_actual_owner FROM servers WHERE id = _server_id;
  IF server_actual_owner IS NULL OR server_actual_owner != _current_owner_id THEN
    RAISE EXCEPTION 'Permission denied: only the server owner can transfer ownership';
  END IF;
  SELECT id INTO current_owner_member_id FROM server_members WHERE server_id = _server_id AND user_id = _current_owner_id;
  SELECT id INTO new_owner_member_id FROM server_members WHERE server_id = _server_id AND user_id = _new_owner_id AND is_banned = false;
  IF current_owner_member_id IS NULL OR new_owner_member_id IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;
  UPDATE server_members SET role = 'owner' WHERE id = new_owner_member_id;
  UPDATE server_members SET role = 'admin' WHERE id = current_owner_member_id;
  UPDATE servers SET owner_id = _new_owner_id WHERE id = _server_id;
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."transfer_ownership"("_server_id" "uuid", "_current_owner_id" "uuid", "_new_owner_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_dm_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  sender_username text;
  recipient_id uuid;
BEGIN
  -- Get sender username
  SELECT username INTO sender_username FROM users WHERE id = NEW.sender_id;
  
  -- Get recipient (the other participant in the conversation)
  SELECT user_id INTO recipient_id 
  FROM dm_participants 
  WHERE conversation_id = NEW.conversation_id AND user_id != NEW.sender_id
  LIMIT 1;
  
  -- Create notification for recipient with conversation_id in link
  IF recipient_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (
      recipient_id,
      'dm',
      'New message from ' || sender_username,
      LEFT(NEW.content, 100),
      '/app?conversation=' || NEW.conversation_id::text
    );
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_dm_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_mention_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  channel_server_id uuid;
  channel_name text;
  channel_id uuid;
  sender_username text;
  message_id uuid;
BEGIN
  -- Get message_id
  message_id := NEW.message_id;
  
  -- Get channel info
  SELECT c.server_id, c.name, c.id INTO channel_server_id, channel_name, channel_id
  FROM channels c
  JOIN messages m ON m.channel_id = c.id
  WHERE m.id = NEW.message_id;
  
  -- Get sender username
  SELECT u.username INTO sender_username
  FROM messages m
  JOIN users u ON u.id = m.user_id
  WHERE m.id = NEW.message_id;
  
  -- Create notification for the mentioned user with full link including message_id
  PERFORM public.create_notification(
    NEW.user_id,
    'mention'::notification_type,
    'You were mentioned',
    sender_username || ' mentioned you in #' || COALESCE(channel_name, 'channel'),
    '/app?server=' || channel_server_id || '&channel=' || channel_id || '&message=' || message_id
  );
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_mention_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_task_assignment_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  task_title text;
  task_channel_id uuid;
  assigner_username text;
BEGIN
  -- Get task info
  SELECT t.title, t.channel_id, u.username
  INTO task_title, task_channel_id, assigner_username
  FROM tasks t
  JOIN users u ON u.id = NEW.assigned_by
  WHERE t.id = NEW.task_id;
  
  -- Create notification for assigned user
  IF task_title IS NOT NULL AND assigner_username IS NOT NULL THEN
    PERFORM public.create_notification(
      NEW.user_id,
      'mention'::notification_type, -- Reuse mention type for task notifications
      'Task Assigned',
      assigner_username || ' assigned you to task: ' || task_title,
      '/app' -- Link will be updated by frontend to include channel/task
    );
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_task_assignment_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_task_comment_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  task_title text;
  task_created_by uuid;
  commenter_username text;
  assignee_id uuid;
  commenter_id uuid;
BEGIN
  -- Get task info
  SELECT t.title, t.created_by INTO task_title, task_created_by
  FROM tasks t
  WHERE t.id = NEW.task_id;
  
  -- Get commenter username
  SELECT username INTO commenter_username
  FROM users
  WHERE id = NEW.user_id;
  
  commenter_id := NEW.user_id;
  
  -- Notify task creator (if not the commenter)
  IF task_created_by IS NOT NULL AND task_created_by != commenter_id THEN
    PERFORM public.create_notification(
      task_created_by,
      'mention'::notification_type,
      'New Task Comment',
      commenter_username || ' commented on task: ' || task_title,
      '/app'
    );
  END IF;
  
  -- Notify all assignees (except commenter)
  FOR assignee_id IN
    SELECT user_id FROM task_assignees
    WHERE task_id = NEW.task_id AND user_id != commenter_id
  LOOP
    PERFORM public.create_notification(
      assignee_id,
      'mention'::notification_type,
      'New Task Comment',
      commenter_username || ' commented on task: ' || task_title,
      '/app'
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_task_comment_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_task_status_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  assignee_id uuid;
  updater_username text;
BEGIN
  -- Only notify if status actually changed
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Get updater username (we'll need to pass user_id somehow, for now use system)
  SELECT username INTO updater_username
  FROM users
  WHERE id = NEW.created_by; -- Fallback to creator, ideally should be passed
  
  -- Notify all assignees
  FOR assignee_id IN
    SELECT user_id FROM task_assignees WHERE task_id = NEW.id
  LOOP
    PERFORM public.create_notification(
      assignee_id,
      'mention'::notification_type,
      'Task Status Changed',
      'Task "' || NEW.title || '" status changed to ' || NEW.status,
      '/app'
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_task_status_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."unassign_task_users"("_task_id" "uuid", "_user_id" "uuid", "_assignee_ids" "uuid"[]) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  task_channel_id uuid;
  assignee_id uuid;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get task channel
  SELECT channel_id INTO task_channel_id
  FROM tasks
  WHERE id = _task_id;
  
  IF task_channel_id IS NULL THEN
    RETURN json_build_object('error', 'Task not found');
  END IF;
  
  -- Check permission: assign_tasks (same permission for unassign)
  IF NOT check_user_permission(_user_id, task_channel_id, 'assign_tasks'::permission_type) THEN
    RETURN json_build_object('error', 'Permission denied: assign_tasks');
  END IF;
  
  -- Remove assignees
  DELETE FROM task_assignees
  WHERE task_id = _task_id
    AND user_id = ANY(_assignee_ids);
  
  RETURN json_build_object('success', true);
END;
$$;


ALTER FUNCTION "public"."unassign_task_users"("_task_id" "uuid", "_user_id" "uuid", "_assignee_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."unban_member"("_server_id" "uuid", "_user_id" "uuid", "_target_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Check permission using database-backed permission system
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'ban_members') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  DELETE FROM server_members WHERE server_id = _server_id AND user_id = _target_user_id AND is_banned = true;
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."unban_member"("_server_id" "uuid", "_user_id" "uuid", "_target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."unblock_user"("_user_id" "uuid", "_blocked_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _caller_id uuid;
BEGIN
  _caller_id := public.get_request_user_id();
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _user_id IS DISTINCT FROM _caller_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Only the blocker can unblock (blocked rows are normalized requester_id=blocker)
  DELETE FROM friendships
  WHERE requester_id = _caller_id
    AND addressee_id = _blocked_user_id
    AND status = 'blocked';

  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."unblock_user"("_user_id" "uuid", "_blocked_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."unmute_member"("_server_id" "uuid", "_user_id" "uuid", "_target_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN server_member_roles smr ON smr.role_id = rp.role_id
      JOIN server_members sm ON sm.id = smr.member_id
      WHERE sm.user_id = _user_id AND rp.server_id = _server_id
        AND rp.permission = 'mute_members' AND rp.allowed = true
    ) THEN RAISE EXCEPTION 'You do not have permission to unmute members'; END IF;
  END IF;
  UPDATE server_members SET is_muted = false WHERE server_id = _server_id AND user_id = _target_user_id;
END; $$;


ALTER FUNCTION "public"."unmute_member"("_server_id" "uuid", "_user_id" "uuid", "_target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_category"("_category_id" "uuid", "_user_id" "uuid", "_updates" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _server_id uuid;
  _parsed jsonb;
  _result jsonb;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT server_id INTO _server_id FROM channel_categories WHERE id = _category_id;
  IF _server_id IS NULL THEN
    RAISE EXCEPTION 'Category not found';
  END IF;

  _parsed := _updates::jsonb;

  UPDATE channel_categories SET
    name = COALESCE(_parsed->>'name', name)
  WHERE id = _category_id;

  SELECT jsonb_build_object(
    'id', cc.id, 'server_id', cc.server_id,
    'name', cc.name, 'position', cc.position, 'created_at', cc.created_at
  ) INTO _result FROM channel_categories cc WHERE cc.id = _category_id;

  RETURN _result;
END;
$$;


ALTER FUNCTION "public"."update_category"("_category_id" "uuid", "_user_id" "uuid", "_updates" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_channel"("_channel_id" "uuid", "_user_id" "uuid", "_updates" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _server_id uuid;
  _parsed jsonb;
  _result jsonb;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT server_id INTO _server_id FROM channels WHERE id = _channel_id;
  IF _server_id IS NULL THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;

  _parsed := _updates::jsonb;

  UPDATE channels SET
    name = COALESCE(_parsed->>'name', name),
    topic = CASE WHEN _parsed ? 'topic' THEN (_parsed->>'topic') ELSE topic END,
    is_nsfw = COALESCE((_parsed->>'is_nsfw')::boolean, is_nsfw),
    slowmode_seconds = COALESCE((_parsed->>'slowmode_seconds')::int, slowmode_seconds),
    is_read_only = COALESCE((_parsed->>'is_read_only')::boolean, is_read_only),
    is_private = COALESCE((_parsed->>'is_private')::boolean, is_private),
    block_links = COALESCE((_parsed->>'block_links')::boolean, block_links),
    allowed_link_domains = CASE 
      WHEN _parsed ? 'allowed_link_domains' THEN 
        ARRAY(SELECT jsonb_array_elements_text(_parsed->'allowed_link_domains'))
      ELSE allowed_link_domains 
    END,
    ghost_mode = CASE 
      WHEN (_parsed->>'ghost_mode')::boolean = true THEN true 
      ELSE ghost_mode 
    END,
    icon = CASE WHEN _parsed ? 'icon' THEN (_parsed->>'icon') ELSE icon END
  WHERE id = _channel_id;

  SELECT jsonb_build_object(
    'id', c.id, 'server_id', c.server_id, 'category_id', c.category_id,
    'name', c.name, 'topic', c.topic, 'type', c.type, 'position', c.position,
    'is_nsfw', c.is_nsfw, 'slowmode_seconds', c.slowmode_seconds,
    'is_read_only', c.is_read_only, 'is_private', c.is_private,
    'block_links', c.block_links, 'allowed_link_domains', c.allowed_link_domains,
    'ghost_mode', c.ghost_mode, 'icon', c.icon, 'created_at', c.created_at
  ) INTO _result FROM channels c WHERE c.id = _channel_id;

  RETURN _result;
END;
$$;


ALTER FUNCTION "public"."update_channel"("_channel_id" "uuid", "_user_id" "uuid", "_updates" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_group_dm_name"("_conversation_id" "uuid", "_user_id" "uuid", "_new_name" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_is_group boolean;
  v_is_participant boolean;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Check if conversation exists and is a group
  SELECT is_group INTO v_is_group
  FROM dm_conversations
  WHERE id = _conversation_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;
  
  IF NOT COALESCE(v_is_group, false) THEN
    RAISE EXCEPTION 'Cannot rename a 1:1 conversation';
  END IF;
  
  -- Check if user is a participant
  SELECT EXISTS (
    SELECT 1 FROM dm_participants
    WHERE conversation_id = _conversation_id AND user_id = _user_id
  ) INTO v_is_participant;
  
  IF NOT v_is_participant THEN
    RAISE EXCEPTION 'User is not a participant';
  END IF;
  
  -- Update the name (NULL or empty string removes the name)
  UPDATE dm_conversations
  SET name = NULLIF(TRIM(_new_name), '')
  WHERE id = _conversation_id;
  
  RETURN json_build_object(
    'success', true,
    'name', NULLIF(TRIM(_new_name), '')
  );
END;
$$;


ALTER FUNCTION "public"."update_group_dm_name"("_conversation_id" "uuid", "_user_id" "uuid", "_new_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_member_nickname"("_server_id" "uuid", "_user_id" "uuid", "_target_user_id" "uuid", "_nickname" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  user_role text;
  target_role text;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Users can always change their own nickname
  IF _user_id = _target_user_id THEN
    UPDATE server_members SET nickname = _nickname WHERE server_id = _server_id AND user_id = _user_id;
    RETURN true;
  END IF;
  
  SELECT role INTO user_role FROM server_members 
  WHERE server_id = _server_id AND user_id = _user_id AND is_banned = false;
  
  SELECT role INTO target_role FROM server_members 
  WHERE server_id = _server_id AND user_id = _target_user_id AND is_banned = false;
  
  IF user_role IS NULL THEN
    RAISE EXCEPTION 'Not a member of this server';
  END IF;
  
  IF target_role IS NULL THEN
    RAISE EXCEPTION 'Target user is not a member of this server';
  END IF;
  
  -- Check permission using database-backed permission system
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_nicknames') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  -- Cannot change owner's nickname unless you are the owner
  IF target_role = 'owner' AND user_role != 'owner' THEN
    RAISE EXCEPTION 'Cannot change the server owner nickname';
  END IF;
  
  UPDATE server_members SET nickname = _nickname WHERE server_id = _server_id AND user_id = _target_user_id;
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."update_member_nickname"("_server_id" "uuid", "_user_id" "uuid", "_target_user_id" "uuid", "_nickname" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_modified_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_modified_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_own_profile"("_display_name" character varying DEFAULT NULL::character varying, "_avatar_url" "text" DEFAULT NULL::"text", "_bio" "text" DEFAULT NULL::"text", "_status" "public"."user_status" DEFAULT NULL::"public"."user_status", "_custom_status" character varying DEFAULT NULL::character varying, "_banner_color" character DEFAULT NULL::"bpchar", "_pronouns" character varying DEFAULT NULL::character varying) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE users SET
    display_name = COALESCE(_display_name, display_name),
    avatar_url = COALESCE(_avatar_url, avatar_url),
    bio = COALESCE(_bio, bio),
    status = COALESCE(_status, status),
    custom_status = COALESCE(_custom_status, custom_status),
    banner_color = COALESCE(_banner_color, banner_color),
    pronouns = COALESCE(_pronouns, pronouns)
  WHERE id = auth.uid();
END;
$$;


ALTER FUNCTION "public"."update_own_profile"("_display_name" character varying, "_avatar_url" "text", "_bio" "text", "_status" "public"."user_status", "_custom_status" character varying, "_banner_color" character, "_pronouns" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_server"("_server_id" "uuid", "_user_id" "uuid", "_updates" "jsonb") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _user_role server_role;
  _updated_server servers%ROWTYPE;
BEGIN
  -- Verify the caller is who they claim to be (custom auth: x-key-hash)
  IF NOT public.verify_request_identity(_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Check user's role in server
  SELECT role INTO _user_role
  FROM server_members
  WHERE server_id = _server_id AND user_id = _user_id AND is_banned = false;

  IF _user_role IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not a member of this server');
  END IF;

  -- Only owner and admin can update server settings
  IF _user_role NOT IN ('owner', 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;

  -- TEMPORARY: Reject attempts to publish (set is_published to true) while rebuilding Explore page
  IF (_updates ? 'is_published') AND ((_updates->>'is_published')::boolean = true) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'We''re rebuilding the Explore page. Publishing will be available soon.'
    );
  END IF;

  -- Update server with provided fields
  UPDATE servers
  SET
    name = COALESCE(_updates->>'name', name),
    icon_url = CASE 
      WHEN _updates ? 'icon_url' THEN _updates->>'icon_url'
      ELSE icon_url
    END,
    banner_url = CASE 
      WHEN _updates ? 'banner_url' THEN _updates->>'banner_url'
      ELSE banner_url
    END,
    about = CASE
      WHEN _updates ? 'about' THEN NULLIF(_updates->>'about', '')
      WHEN _updates ? 'about' THEN about
      ELSE about
    END,
    is_published = CASE
      WHEN _updates ? 'is_published' THEN (_updates->>'is_published')::boolean
      ELSE is_published
    END,
    system_channel_join_id = CASE
      WHEN _updates ? 'system_channel_join_id' THEN 
        CASE 
          WHEN _updates->'system_channel_join_id' IS NULL 
            OR _updates->>'system_channel_join_id' = 'null' 
            OR _updates->>'system_channel_join_id' = '' 
            OR _updates->>'system_channel_join_id' = 'none' THEN NULL
          ELSE (_updates->>'system_channel_join_id')::uuid
        END
      ELSE system_channel_join_id
    END,
    system_channel_leave_id = CASE
      WHEN _updates ? 'system_channel_leave_id' THEN 
        CASE 
          WHEN _updates->'system_channel_leave_id' IS NULL 
            OR _updates->>'system_channel_leave_id' = 'null' 
            OR _updates->>'system_channel_leave_id' = '' 
            OR _updates->>'system_channel_leave_id' = 'none' THEN NULL
          ELSE (_updates->>'system_channel_leave_id')::uuid
        END
      ELSE system_channel_leave_id
    END,
    enable_join_messages = CASE
      WHEN _updates ? 'enable_join_messages' THEN (_updates->>'enable_join_messages')::boolean
      ELSE enable_join_messages
    END,
    enable_leave_messages = CASE
      WHEN _updates ? 'enable_leave_messages' THEN (_updates->>'enable_leave_messages')::boolean
      ELSE enable_leave_messages
    END
  WHERE id = _server_id
  RETURNING * INTO _updated_server;

  IF _updated_server.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Server not found');
  END IF;

  RETURN json_build_object(
    'success', true,
    'server', json_build_object(
      'id', _updated_server.id,
      'name', _updated_server.name,
      'icon_url', _updated_server.icon_url,
      'banner_url', _updated_server.banner_url,
      'about', _updated_server.about,
      'is_published', _updated_server.is_published,
      'owner_id', _updated_server.owner_id,
      'invite_code', _updated_server.invite_code,
      'created_at', _updated_server.created_at,
      'system_channel_join_id', _updated_server.system_channel_join_id,
      'system_channel_leave_id', _updated_server.system_channel_leave_id,
      'enable_join_messages', _updated_server.enable_join_messages,
      'enable_leave_messages', _updated_server.enable_leave_messages
    )
  );
END;
$$;


ALTER FUNCTION "public"."update_server"("_server_id" "uuid", "_user_id" "uuid", "_updates" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_server_role"("_role_id" "uuid", "_user_id" "uuid", "_name" "text" DEFAULT NULL::"text", "_color" "text" DEFAULT NULL::"text", "_icon" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE _server_id uuid; result json;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT server_id INTO _server_id FROM server_roles WHERE id = _role_id;
  IF _server_id IS NULL THEN RAISE EXCEPTION 'Role not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN server_member_roles smr ON smr.role_id = rp.role_id
      JOIN server_members sm ON sm.id = smr.member_id
      WHERE sm.user_id = _user_id AND rp.server_id = _server_id
        AND rp.permission = 'manage_roles' AND rp.allowed = true
    ) THEN RAISE EXCEPTION 'Only users with manage_roles permission can update roles'; END IF;
  END IF;
  UPDATE server_roles SET name = COALESCE(_name, name), color = COALESCE(_color, color), icon = _icon WHERE id = _role_id;
  SELECT row_to_json(r) INTO result FROM server_roles r WHERE r.id = _role_id;
  RETURN result;
END; $$;


ALTER FUNCTION "public"."update_server_role"("_role_id" "uuid", "_user_id" "uuid", "_name" "text", "_color" "text", "_icon" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_task"("_task_id" "uuid", "_user_id" "uuid", "_title" "text" DEFAULT NULL::"text", "_description" "text" DEFAULT NULL::"text", "_priority" "text" DEFAULT NULL::"text", "_status" "text" DEFAULT NULL::"text", "_due_date" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  UPDATE public.tasks
  SET
    title = COALESCE(_title, title),
    description = COALESCE(_description, description),
    priority = COALESCE(_priority::task_priority, priority),
    status = COALESCE(_status::task_status, status),
    due_date = COALESCE(_due_date, due_date),
    completed_by = CASE 
      WHEN _status = 'completed' AND status != 'completed' THEN _user_id
      WHEN _status = 'open' THEN NULL
      ELSE completed_by
    END,
    completed_at = CASE 
      WHEN _status = 'completed' AND status != 'completed' THEN NOW()
      WHEN _status = 'open' THEN NULL
      ELSE completed_at
    END,
    updated_at = NOW()
  WHERE id = _task_id;
END;
$$;


ALTER FUNCTION "public"."update_task"("_task_id" "uuid", "_user_id" "uuid", "_title" "text", "_description" "text", "_priority" "text", "_status" "text", "_due_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_task_comment"("_comment_id" "uuid", "_user_id" "uuid", "_content" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  comment_user_id uuid;
  result json;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get comment owner
  SELECT user_id INTO comment_user_id
  FROM task_comments
  WHERE id = _comment_id;
  
  IF comment_user_id IS NULL THEN
    RETURN json_build_object('error', 'Comment not found');
  END IF;
  
  -- Only the comment owner can edit
  IF comment_user_id != _user_id THEN
    RETURN json_build_object('error', 'Permission denied: can only edit own comments');
  END IF;
  
  -- Update comment
  UPDATE task_comments
  SET content = _content, edited_at = now()
  WHERE id = _comment_id;
  
  -- Return updated comment
  SELECT json_build_object(
    'id', tc.id,
    'task_id', tc.task_id,
    'user_id', tc.user_id,
    'content', tc.content,
    'created_at', tc.created_at,
    'edited_at', tc.edited_at
  ) INTO result
  FROM task_comments tc
  WHERE tc.id = _comment_id;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."update_task_comment"("_comment_id" "uuid", "_user_id" "uuid", "_content" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_task_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_task_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_last_seen"("_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- GUARD: Maintenance Mode
  IF is_maintenance_active() THEN
    RAISE EXCEPTION 'MAINTENANCE_MODE_ACTIVE';
  END IF;

  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  UPDATE users SET last_seen = now() WHERE id = _user_id;
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."update_user_last_seen"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_preferences_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_user_preferences_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_presence"("_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  UPDATE public.users
  SET last_seen = now()
  WHERE id = _user_id
  AND status NOT IN ('offline', 'invisible');
END;
$$;


ALTER FUNCTION "public"."update_user_presence"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_profile"("_user_id" "uuid", "_updates" json) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result json;
BEGIN
  PERFORM public.assert_request_user(_user_id);

  UPDATE users SET
    display_name = COALESCE(_updates->>'display_name', display_name),
    bio = COALESCE(_updates->>'bio', bio),
    avatar_url = COALESCE(_updates->>'avatar_url', avatar_url),
    banner_color = COALESCE(_updates->>'banner_color', banner_color),
    custom_status = COALESCE(_updates->>'custom_status', custom_status)
  WHERE id = _user_id;
  
  SELECT json_build_object(
    'id', u.id,
    'username', u.username,
    'display_name', u.display_name,
    'avatar_url', u.avatar_url,
    'banner_color', u.banner_color,
    'bio', u.bio,
    'status', u.status,
    'custom_status', u.custom_status,
    'created_at', u.created_at,
    'last_seen', u.last_seen
  ) INTO result FROM users u WHERE u.id = _user_id;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."update_user_profile"("_user_id" "uuid", "_updates" json) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_status"("_user_id" "uuid", "_status" "public"."user_status") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- GUARD: Maintenance Mode
  IF is_maintenance_active() THEN
    RAISE EXCEPTION 'MAINTENANCE_MODE_ACTIVE';
  END IF;

  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF _status = 'offline' THEN
    UPDATE users SET status = _status, last_seen = now() - interval '10 minutes' WHERE id = _user_id;
  ELSE
    UPDATE users SET status = _status, last_seen = now() WHERE id = _user_id;
  END IF;
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."update_user_status"("_user_id" "uuid", "_status" "public"."user_status") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_voice_settings_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_voice_settings_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upload_server_emoji"("_server_id" "uuid", "_user_id" "uuid", "_name" "text", "_file_path" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  new_emoji server_emojis%ROWTYPE;
  emoji_count integer;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  IF NOT check_user_server_permission(_user_id, _server_id, 'manage_emojis') THEN
    RAISE EXCEPTION 'Permission denied: you do not have permission to manage emojis';
  END IF;

  -- Enforce 1000 emoji slot limit per server
  SELECT count(*) INTO emoji_count FROM server_emojis WHERE server_id = _server_id;
  IF emoji_count >= 1000 THEN
    RAISE EXCEPTION 'Server emoji limit reached (1000)';
  END IF;

  INSERT INTO server_emojis (server_id, name, file_path, created_by)
  VALUES (_server_id, _name, _file_path, _user_id)
  RETURNING * INTO new_emoji;
  RETURN row_to_json(new_emoji);
END;
$$;


ALTER FUNCTION "public"."upload_server_emoji"("_server_id" "uuid", "_user_id" "uuid", "_name" "text", "_file_path" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_channel_read"("_user_id" "uuid", "_channel_id" "uuid", "_last_read_at" timestamp with time zone) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Authentication failed';
  END IF;

  INSERT INTO channel_reads (user_id, channel_id, last_read_at)
  VALUES (_user_id, _channel_id, _last_read_at)
  ON CONFLICT (user_id, channel_id)
  DO UPDATE SET last_read_at = _last_read_at;
END;
$$;


ALTER FUNCTION "public"."upsert_channel_read"("_user_id" "uuid", "_channel_id" "uuid", "_last_read_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_user_preferences"("_user_id" "uuid", "_prefs" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  INSERT INTO user_preferences (
    user_id, theme, link_previews_enabled,
    desktop_notifications_enabled, browser_notifications_enabled,
    notification_sound_enabled, notification_sound_server_mentions,
    notification_sound_user_mentions, notification_sound_replies,
    notification_volume, show_message_preview,
    show_preview_server_mentions, show_preview_user_mentions,
    show_preview_replies, compact_mode, show_timestamps, animate_emojis,
    updated_at
  ) VALUES (
    _user_id,
    COALESCE(_prefs->>'theme', 'default'),
    COALESCE((_prefs->>'link_previews_enabled')::BOOLEAN, TRUE),
    COALESCE((_prefs->>'desktop_notifications_enabled')::BOOLEAN, TRUE),
    COALESCE((_prefs->>'browser_notifications_enabled')::BOOLEAN, TRUE),
    COALESCE((_prefs->>'notification_sound_enabled')::BOOLEAN, TRUE),
    COALESCE((_prefs->>'notification_sound_server_mentions')::BOOLEAN, TRUE),
    COALESCE((_prefs->>'notification_sound_user_mentions')::BOOLEAN, TRUE),
    COALESCE((_prefs->>'notification_sound_replies')::BOOLEAN, TRUE),
    COALESCE((_prefs->>'notification_volume')::NUMERIC, 0.5),
    COALESCE((_prefs->>'show_message_preview')::BOOLEAN, TRUE),
    COALESCE((_prefs->>'show_preview_server_mentions')::BOOLEAN, TRUE),
    COALESCE((_prefs->>'show_preview_user_mentions')::BOOLEAN, TRUE),
    COALESCE((_prefs->>'show_preview_replies')::BOOLEAN, TRUE),
    COALESCE((_prefs->>'compact_mode')::BOOLEAN, FALSE),
    COALESCE((_prefs->>'show_timestamps')::BOOLEAN, TRUE),
    COALESCE((_prefs->>'animate_emojis')::BOOLEAN, TRUE),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    theme = COALESCE(_prefs->>'theme', user_preferences.theme),
    link_previews_enabled = COALESCE((_prefs->>'link_previews_enabled')::BOOLEAN, user_preferences.link_previews_enabled),
    desktop_notifications_enabled = COALESCE((_prefs->>'desktop_notifications_enabled')::BOOLEAN, user_preferences.desktop_notifications_enabled),
    browser_notifications_enabled = COALESCE((_prefs->>'browser_notifications_enabled')::BOOLEAN, user_preferences.browser_notifications_enabled),
    notification_sound_enabled = COALESCE((_prefs->>'notification_sound_enabled')::BOOLEAN, user_preferences.notification_sound_enabled),
    notification_sound_server_mentions = COALESCE((_prefs->>'notification_sound_server_mentions')::BOOLEAN, user_preferences.notification_sound_server_mentions),
    notification_sound_user_mentions = COALESCE((_prefs->>'notification_sound_user_mentions')::BOOLEAN, user_preferences.notification_sound_user_mentions),
    notification_sound_replies = COALESCE((_prefs->>'notification_sound_replies')::BOOLEAN, user_preferences.notification_sound_replies),
    notification_volume = COALESCE((_prefs->>'notification_volume')::NUMERIC, user_preferences.notification_volume),
    show_message_preview = COALESCE((_prefs->>'show_message_preview')::BOOLEAN, user_preferences.show_message_preview),
    show_preview_server_mentions = COALESCE((_prefs->>'show_preview_server_mentions')::BOOLEAN, user_preferences.show_preview_server_mentions),
    show_preview_user_mentions = COALESCE((_prefs->>'show_preview_user_mentions')::BOOLEAN, user_preferences.show_preview_user_mentions),
    show_preview_replies = COALESCE((_prefs->>'show_preview_replies')::BOOLEAN, user_preferences.show_preview_replies),
    compact_mode = COALESCE((_prefs->>'compact_mode')::BOOLEAN, user_preferences.compact_mode),
    show_timestamps = COALESCE((_prefs->>'show_timestamps')::BOOLEAN, user_preferences.show_timestamps),
    animate_emojis = COALESCE((_prefs->>'animate_emojis')::BOOLEAN, user_preferences.animate_emojis),
    updated_at = NOW();
END;
$$;


ALTER FUNCTION "public"."upsert_user_preferences"("_user_id" "uuid", "_prefs" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_user_voice_settings"("p_user_id" "uuid", "p_settings" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result JSONB;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  INSERT INTO user_voice_settings (user_id, settings)
  VALUES (p_user_id, p_settings)
  ON CONFLICT (user_id)
  DO UPDATE SET settings = p_settings
  RETURNING settings INTO result;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."upsert_user_voice_settings"("p_user_id" "uuid", "p_settings" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_username_on_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
BEGIN
  -- Check if username is blocked
  IF public.is_username_blocked(NEW.username) THEN
    RAISE EXCEPTION 'Username is reserved or contains restricted words';
  END IF;

  -- Check length (3-32 characters)
  IF length(NEW.username) < 3 OR length(NEW.username) > 32 THEN
    RAISE EXCEPTION 'Username must be between 3 and 32 characters';
  END IF;

  -- Check allowed characters (alphanumeric, underscores, hyphens)
  IF NEW.username !~ '^[a-zA-Z0-9_-]+$' THEN
    RAISE EXCEPTION 'Username can only contain letters, numbers, underscores, and hyphens';
  END IF;

  -- Cannot start or end with underscore or hyphen
  IF NEW.username ~ '^[-_]' OR NEW.username ~ '[-_]$' THEN
    RAISE EXCEPTION 'Username cannot start or end with an underscore or hyphen';
  END IF;

  -- No consecutive special characters
  IF NEW.username ~ '[-_]{2,}' THEN
    RAISE EXCEPTION 'Username cannot contain consecutive special characters';
  END IF;

  -- Cannot be only numbers
  IF NEW.username ~ '^\d+$' THEN
    RAISE EXCEPTION 'Username cannot be only numbers';
  END IF;

  RETURN NEW;
END;
$_$;


ALTER FUNCTION "public"."validate_username_on_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_request_identity"("_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  header_hash text;
  stored_hash text;
BEGIN
  BEGIN
    header_hash := (current_setting('request.headers', true)::json->>'x-key-hash');
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;

  IF header_hash IS NULL OR header_hash = '' THEN
    RETURN false;
  END IF;

  SELECT ua.key_hash INTO stored_hash FROM user_auth ua WHERE ua.user_id = _user_id;

  IF stored_hash IS NULL THEN
    RETURN false;
  END IF;

  RETURN header_hash = stored_hash;
END;
$$;


ALTER FUNCTION "public"."verify_request_identity"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."vote_poll"("_poll_id" "uuid", "_user_id" "uuid", "_option_indexes" integer[]) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  p record;
  channel_server_id uuid;
  is_muted boolean;
  _n integer;
  _distinct_indexes integer[];
  _min_idx integer;
  _max_idx integer;
  result json;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  SELECT * INTO p FROM public.polls WHERE id = _poll_id;
  IF p IS NULL THEN
    RAISE EXCEPTION 'Poll not found';
  END IF;

  IF p.is_closed = true OR p.ends_at <= now() THEN
    -- Close and recompute just in case, then return closed poll state
    UPDATE public.polls SET is_closed = true WHERE id = _poll_id AND is_closed = false;
    PERFORM public.recompute_poll_results(_poll_id);
    SELECT json_build_object(
      'id', p.id,
      'channel_id', p.channel_id,
      'message_id', p.message_id,
      'question', p.question,
      'options', p.options,
      'allow_multiple', p.allow_multiple,
      'ends_at', p.ends_at,
      'is_closed', true,
      'results', (SELECT results FROM public.polls WHERE id = _poll_id),
      'total_votes', (SELECT total_votes FROM public.polls WHERE id = _poll_id)
    ) INTO result;
    RETURN result;
  END IF;

  _n := COALESCE(array_length(p.options, 1), 0);
  IF _n = 0 THEN
    RAISE EXCEPTION 'Poll has no options';
  END IF;

  IF _option_indexes IS NULL OR COALESCE(array_length(_option_indexes, 1), 0) = 0 THEN
    RAISE EXCEPTION 'At least one option must be selected';
  END IF;

  -- normalize to distinct selection
  SELECT array_agg(DISTINCT x ORDER BY x) INTO _distinct_indexes
  FROM unnest(_option_indexes) AS x;

  IF p.allow_multiple = false AND COALESCE(array_length(_distinct_indexes, 1), 0) > 1 THEN
    RAISE EXCEPTION 'This poll only allows one vote';
  END IF;

  SELECT min(x), max(x) INTO _min_idx, _max_idx FROM unnest(_distinct_indexes) AS x;
  IF _min_idx < 0 OR _max_idx > (_n - 1) THEN
    RAISE EXCEPTION 'Invalid poll option';
  END IF;

  -- Membership/permission checks (mirror send_message)
  SELECT server_id INTO channel_server_id FROM public.channels WHERE id = p.channel_id;

  SELECT sm.is_muted INTO is_muted FROM public.server_members sm
  WHERE sm.server_id = channel_server_id AND sm.user_id = _user_id AND sm.is_banned = false;

  IF is_muted IS NULL THEN
    RAISE EXCEPTION 'Not a member of this server';
  END IF;

  IF is_muted THEN
    RAISE EXCEPTION 'You are muted in this server';
  END IF;

  IF NOT public.check_user_permission(_user_id, p.channel_id, 'send_messages') THEN
    RAISE EXCEPTION 'You do not have permission to vote in this channel';
  END IF;

  -- Replace existing votes for this user
  DELETE FROM public.poll_votes WHERE poll_id = _poll_id AND user_id = _user_id;

  INSERT INTO public.poll_votes (poll_id, user_id, option_index)
  SELECT _poll_id, _user_id, x
  FROM unnest(_distinct_indexes) AS x
  ON CONFLICT (poll_id, user_id, option_index) DO NOTHING;

  PERFORM public.recompute_poll_results(_poll_id);

  SELECT json_build_object(
    'id', p.id,
    'channel_id', p.channel_id,
    'message_id', p.message_id,
    'question', p.question,
    'options', p.options,
    'allow_multiple', p.allow_multiple,
    'ends_at', p.ends_at,
    'is_closed', (SELECT is_closed FROM public.polls WHERE id = _poll_id),
    'results', (SELECT results FROM public.polls WHERE id = _poll_id),
    'total_votes', (SELECT total_votes FROM public.polls WHERE id = _poll_id)
  ) INTO result;

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."vote_poll"("_poll_id" "uuid", "_user_id" "uuid", "_option_indexes" integer[]) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."announcement_comment_reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comment_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "emoji" character varying(32) NOT NULL
);

ALTER TABLE ONLY "public"."announcement_comment_reactions" REPLICA IDENTITY FULL;


ALTER TABLE "public"."announcement_comment_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."announcement_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "reply_to_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "edited_at" timestamp with time zone
);

ALTER TABLE ONLY "public"."announcement_comments" REPLICA IDENTITY FULL;


ALTER TABLE "public"."announcement_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_config" (
    "key" "text" NOT NULL,
    "value" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."app_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."badges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "icon_url" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."badges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."category_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "uuid" NOT NULL,
    "role_id" "uuid",
    "role_name" "text",
    "user_id" "uuid",
    "permission" "text" NOT NULL,
    "allowed" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "category_permissions_role_name_check" CHECK (("role_name" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'moderator'::"text", 'member'::"text"]))),
    CONSTRAINT "category_permissions_target_check" CHECK ((("role_id" IS NOT NULL) OR ("role_name" IS NOT NULL) OR ("user_id" IS NOT NULL)))
);

ALTER TABLE ONLY "public"."category_permissions" REPLICA IDENTITY FULL;


ALTER TABLE "public"."category_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."channel_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "server_id" "uuid" NOT NULL,
    "name" character varying(100) NOT NULL,
    "position" integer DEFAULT 0,
    "is_collapsed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."channel_categories" REPLICA IDENTITY FULL;


ALTER TABLE "public"."channel_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."channel_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "added_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."channel_members" REPLICA IDENTITY FULL;


ALTER TABLE "public"."channel_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."channel_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "uuid" NOT NULL,
    "role_id" "uuid",
    "role_name" "public"."server_role",
    "permission" "public"."permission_type" NOT NULL,
    "allowed" boolean NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    CONSTRAINT "channel_permissions_target_check" CHECK (((("role_id" IS NOT NULL) AND ("role_name" IS NULL) AND ("user_id" IS NULL)) OR (("role_id" IS NULL) AND ("role_name" IS NOT NULL) AND ("user_id" IS NULL)) OR (("role_id" IS NULL) AND ("role_name" IS NULL) AND ("user_id" IS NOT NULL))))
);


ALTER TABLE "public"."channel_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."channel_reads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "last_read_message_id" "uuid",
    "last_read_at" timestamp with time zone,
    "mention_count" integer DEFAULT 0
);


ALTER TABLE "public"."channel_reads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."channel_user_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "is_muted" boolean DEFAULT false,
    "is_hidden" boolean DEFAULT false,
    "is_pinned" boolean DEFAULT false,
    "notification_level" "text" DEFAULT 'all'::"text",
    "mute_until" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "channel_user_settings_notification_level_check" CHECK (("notification_level" = ANY (ARRAY['all'::"text", 'mentions'::"text", 'nothing'::"text"])))
);

ALTER TABLE ONLY "public"."channel_user_settings" REPLICA IDENTITY FULL;


ALTER TABLE "public"."channel_user_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."channels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "server_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "name" character varying(100) NOT NULL,
    "topic" "text",
    "type" "public"."channel_type" DEFAULT 'text'::"public"."channel_type",
    "position" integer DEFAULT 0,
    "is_nsfw" boolean DEFAULT false,
    "slowmode_seconds" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "icon" "text",
    "is_read_only" boolean DEFAULT false,
    "is_private" boolean DEFAULT false NOT NULL,
    "block_links" boolean DEFAULT false NOT NULL,
    "allowed_link_domains" "text"[] DEFAULT '{}'::"text"[],
    "ghost_mode" boolean DEFAULT false NOT NULL
);

ALTER TABLE ONLY "public"."channels" REPLICA IDENTITY FULL;


ALTER TABLE "public"."channels" OWNER TO "postgres";


COMMENT ON COLUMN "public"."channels"."icon" IS 'Noto Emoji character used as channel icon';



COMMENT ON COLUMN "public"."channels"."block_links" IS 'When true, only admins/owners can post links';



COMMENT ON COLUMN "public"."channels"."allowed_link_domains" IS 'Whitelisted domains when block_links is true (e.g. github.com)';



COMMENT ON COLUMN "public"."channels"."ghost_mode" IS 'When true, hides user avatars and usernames (except for admins/owners)';



CREATE TABLE IF NOT EXISTS "public"."declined_friend_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "requester_id" "uuid" NOT NULL,
    "addressee_id" "uuid" NOT NULL,
    "declined_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."declined_friend_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."direct_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "reply_to_id" "uuid",
    "content" "text" NOT NULL,
    "edited_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."direct_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dm_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_type" "text",
    "file_size" integer,
    "width" integer,
    "height" integer
);


ALTER TABLE "public"."dm_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dm_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_group" boolean DEFAULT false,
    "name" "text",
    "created_by" "uuid"
);

ALTER TABLE ONLY "public"."dm_conversations" REPLICA IDENTITY FULL;


ALTER TABLE "public"."dm_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dm_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "last_read_at" timestamp with time zone
);

ALTER TABLE ONLY "public"."dm_participants" REPLICA IDENTITY FULL;


ALTER TABLE "public"."dm_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dm_reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "emoji" character varying(64) NOT NULL
);

ALTER TABLE ONLY "public"."dm_reactions" REPLICA IDENTITY FULL;


ALTER TABLE "public"."dm_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."friendships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "requester_id" "uuid" NOT NULL,
    "addressee_id" "uuid" NOT NULL,
    "status" "public"."friendship_status" DEFAULT 'pending'::"public"."friendship_status",
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."friendships" REPLICA IDENTITY FULL;


ALTER TABLE "public"."friendships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."media_comment_reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comment_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "emoji" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."media_comment_reactions" REPLICA IDENTITY FULL;


ALTER TABLE "public"."media_comment_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."media_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "media_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "reply_to_id" "uuid",
    "edited_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."media_comments" REPLICA IDENTITY FULL;


ALTER TABLE "public"."media_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."media_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text",
    "description" "text",
    "media_url" "text" NOT NULL,
    "media_type" "text" NOT NULL,
    "thumbnail_url" "text",
    "width" integer,
    "height" integer,
    "file_size" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "youtube_video_id" "text",
    CONSTRAINT "media_items_media_type_check" CHECK (("media_type" = ANY (ARRAY['image'::"text", 'video'::"text", 'gif'::"text", 'youtube'::"text"])))
);

ALTER TABLE ONLY "public"."media_items" REPLICA IDENTITY FULL;


ALTER TABLE "public"."media_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mentions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "mention_type" "public"."mention_type" DEFAULT 'user'::"public"."mention_type"
);


ALTER TABLE "public"."mentions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."message_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_type" "text",
    "file_size" integer,
    "width" integer,
    "height" integer
);


ALTER TABLE "public"."message_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "reply_to_id" "uuid",
    "content" "text" NOT NULL,
    "is_pinned" boolean DEFAULT false,
    "edited_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_system_message" boolean DEFAULT false,
    "embed_hidden" boolean DEFAULT false NOT NULL
);

ALTER TABLE ONLY "public"."messages" REPLICA IDENTITY FULL;


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "public"."notification_type" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "link" "text",
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."notifications" REPLICA IDENTITY FULL;


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."poll_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "poll_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "option_index" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."poll_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."polls" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "channel_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "question" "text" NOT NULL,
    "options" "text"[] NOT NULL,
    "allow_multiple" boolean DEFAULT false NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "is_closed" boolean DEFAULT false NOT NULL,
    "results" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "total_votes" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."polls" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "emoji" character varying(64) NOT NULL,
    "channel_id" "uuid" NOT NULL
);

ALTER TABLE ONLY "public"."reactions" REPLICA IDENTITY FULL;


ALTER TABLE "public"."reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "server_id" "uuid" NOT NULL,
    "role_id" "uuid",
    "role_name" "public"."server_role",
    "permission" "public"."permission_type" NOT NULL,
    "allowed" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "role_permissions_role_check" CHECK (((("role_id" IS NOT NULL) AND ("role_name" IS NULL)) OR (("role_id" IS NULL) AND ("role_name" IS NOT NULL))))
);


ALTER TABLE "public"."role_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."server_emojis" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "server_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."server_emojis" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."server_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "server_id" "uuid" NOT NULL,
    "code" character(8) NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone,
    "revoked_by" "uuid",
    "expires_at" timestamp with time zone,
    "max_uses" integer,
    "uses_count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."server_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."server_member_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "member_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."server_member_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."server_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "server_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."server_role" DEFAULT 'member'::"public"."server_role",
    "nickname" character varying(32),
    "is_banned" boolean DEFAULT false NOT NULL,
    "is_muted" boolean DEFAULT false,
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "join_source" "text",
    "join_invite_code" "text",
    "position" integer
);

ALTER TABLE ONLY "public"."server_members" REPLICA IDENTITY FULL;


ALTER TABLE "public"."server_members" OWNER TO "postgres";


COMMENT ON COLUMN "public"."server_members"."join_source" IS 'How the member joined: discover, invite_link, or invite (custom server_invites code)';



COMMENT ON COLUMN "public"."server_members"."join_invite_code" IS 'When join_source = invite, the invite code that was used';



CREATE TABLE IF NOT EXISTS "public"."server_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "server_id" "uuid" NOT NULL,
    "name" character varying(100) NOT NULL,
    "color" character varying(255) DEFAULT '#5865F2'::character varying NOT NULL,
    "position" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "icon" "text"
);


ALTER TABLE "public"."server_roles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."server_roles"."color" IS 'Role color - can be a hex color (#5865F2) or a CSS gradient (linear-gradient(135deg, #667eea, #764ba2))';



CREATE TABLE IF NOT EXISTS "public"."servers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "icon_url" "text",
    "banner_url" "text",
    "owner_id" "uuid" NOT NULL,
    "invite_code" character(8) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_published" boolean DEFAULT false NOT NULL,
    "about" "text",
    "system_channel_join_id" "uuid",
    "system_channel_leave_id" "uuid",
    "enable_join_messages" boolean DEFAULT true,
    "enable_leave_messages" boolean DEFAULT true
);

ALTER TABLE ONLY "public"."servers" REPLICA IDENTITY FULL;


ALTER TABLE "public"."servers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."thread_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_type" "text",
    "file_size" integer,
    "width" integer,
    "height" integer
);


ALTER TABLE "public"."thread_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."thread_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "thread_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "reply_to_id" "uuid",
    "edited_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."thread_messages" REPLICA IDENTITY FULL;


ALTER TABLE "public"."thread_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."thread_reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "emoji" character varying(64) NOT NULL
);

ALTER TABLE ONLY "public"."thread_reactions" REPLICA IDENTITY FULL;


ALTER TABLE "public"."thread_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."threads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "uuid" NOT NULL,
    "message_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."threads" REPLICA IDENTITY FULL;


ALTER TABLE "public"."threads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_auth" (
    "user_id" "uuid" NOT NULL,
    "key_hash" "text" NOT NULL,
    "last_key_reset_at" timestamp with time zone
);


ALTER TABLE "public"."user_auth" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_badges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "badge_id" "uuid" NOT NULL,
    "awarded_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_badges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_devices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "device_id" integer NOT NULL,
    "device_name" character varying(100),
    "identity_public_key" "text" NOT NULL,
    "last_active" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_devices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "theme" "text" DEFAULT 'default'::"text" NOT NULL,
    "link_previews_enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "desktop_notifications_enabled" boolean DEFAULT true NOT NULL,
    "notification_sound_enabled" boolean DEFAULT true NOT NULL,
    "show_message_preview" boolean DEFAULT true NOT NULL,
    "compact_mode" boolean DEFAULT false NOT NULL,
    "show_timestamps" boolean DEFAULT true NOT NULL,
    "animate_emojis" boolean DEFAULT true NOT NULL,
    "browser_notifications_enabled" boolean DEFAULT true,
    "notification_sound_server_mentions" boolean DEFAULT true,
    "notification_sound_user_mentions" boolean DEFAULT true,
    "notification_sound_replies" boolean DEFAULT true,
    "notification_volume" integer DEFAULT 50,
    "show_preview_server_mentions" boolean DEFAULT true,
    "show_preview_user_mentions" boolean DEFAULT true,
    "show_preview_replies" boolean DEFAULT true,
    CONSTRAINT "notification_volume_range" CHECK ((("notification_volume" >= 0) AND ("notification_volume" <= 100)))
);


ALTER TABLE "public"."user_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_server_folders" (
    "user_id" "uuid" NOT NULL,
    "folder_data" "jsonb" DEFAULT '{"folders": [], "serverToFolder": {}}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_server_folders" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_server_folders" IS 'Stores each user''s server folder organization (synced across devices)';



CREATE TABLE IF NOT EXISTS "public"."user_server_tabs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tab_order" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_server_tabs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_voice_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "check_settings_shape" CHECK ((("jsonb_typeof"("settings") = 'object'::"text") AND ((("settings" ->> 'inputGain'::"text") IS NULL) OR (((("settings" ->> 'inputGain'::"text"))::integer >= 0) AND ((("settings" ->> 'inputGain'::"text"))::integer <= 200))) AND ((("settings" ->> 'outputVolume'::"text") IS NULL) OR (((("settings" ->> 'outputVolume'::"text"))::integer >= 0) AND ((("settings" ->> 'outputVolume'::"text"))::integer <= 200))) AND ((("settings" ->> 'voiceMode'::"text") IS NULL) OR (("settings" ->> 'voiceMode'::"text") = ANY (ARRAY['voice_activity'::"text", 'push_to_talk'::"text"]))) AND ((("settings" ->> 'voiceActivityThreshold'::"text") IS NULL) OR (((("settings" ->> 'voiceActivityThreshold'::"text"))::integer >= 0) AND ((("settings" ->> 'voiceActivityThreshold'::"text"))::integer <= 100))) AND ((("settings" ->> 'autoDisconnectMinutes'::"text") IS NULL) OR (((("settings" ->> 'autoDisconnectMinutes'::"text"))::integer >= 0) AND ((("settings" ->> 'autoDisconnectMinutes'::"text"))::integer <= 60)))))
);


ALTER TABLE "public"."user_voice_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "username" character varying(20) NOT NULL,
    "display_name" character varying(32),
    "avatar_url" "text",
    "banner_color" character(7) DEFAULT '#5865F2'::"bpchar",
    "bio" "text",
    "status" "public"."user_status" DEFAULT 'online'::"public"."user_status",
    "custom_status" character varying(128),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_seen" timestamp with time zone DEFAULT "now"(),
    "avatar_decoration" "text",
    "profile_theme_primary" character(7),
    "profile_theme_accent" character(7),
    "banner_url" "text",
    "profile_effect" "text",
    "pronouns" character varying(25) DEFAULT NULL::character varying,
    CONSTRAINT "check_avatar_decoration_is_key" CHECK (("avatar_decoration" !~~ 'http%'::"text")),
    CONSTRAINT "check_profile_effect_is_key" CHECK (("profile_effect" !~~ 'http%'::"text"))
);

ALTER TABLE ONLY "public"."users" REPLICA IDENTITY FULL;


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON COLUMN "public"."users"."avatar_decoration" IS 'Stores asset key only (e.g. sparkle), frontend maps to URL.';



COMMENT ON COLUMN "public"."users"."profile_effect" IS 'Stores asset key only (e.g. fire_border), frontend maps to URL.';



CREATE OR REPLACE VIEW "public"."users_public" WITH ("security_invoker"='true') AS
 SELECT "id",
    "username",
    "display_name",
    "avatar_url",
    "banner_color",
    "bio",
    "status",
    "custom_status",
    "created_at",
    "avatar_decoration",
    "profile_theme_primary",
    "profile_theme_accent",
    "banner_url",
    "profile_effect",
    "pronouns",
        CASE
            WHEN ("id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")) THEN "last_seen"
            ELSE NULL::timestamp with time zone
        END AS "last_seen"
   FROM "public"."users";


ALTER VIEW "public"."users_public" OWNER TO "postgres";


ALTER TABLE ONLY "public"."announcement_comment_reactions"
    ADD CONSTRAINT "announcement_comment_reactions_comment_id_user_id_emoji_key" UNIQUE ("comment_id", "user_id", "emoji");



ALTER TABLE ONLY "public"."announcement_comment_reactions"
    ADD CONSTRAINT "announcement_comment_reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."announcement_comments"
    ADD CONSTRAINT "announcement_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_config"
    ADD CONSTRAINT "app_config_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."badges"
    ADD CONSTRAINT "badges_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."badges"
    ADD CONSTRAINT "badges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."category_permissions"
    ADD CONSTRAINT "category_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."category_permissions"
    ADD CONSTRAINT "category_permissions_unique" UNIQUE ("category_id", "role_id", "role_name", "user_id", "permission");



ALTER TABLE ONLY "public"."channel_categories"
    ADD CONSTRAINT "channel_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."channel_members"
    ADD CONSTRAINT "channel_members_channel_id_user_id_key" UNIQUE ("channel_id", "user_id");



ALTER TABLE ONLY "public"."channel_members"
    ADD CONSTRAINT "channel_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."channel_permissions"
    ADD CONSTRAINT "channel_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."channel_reads"
    ADD CONSTRAINT "channel_reads_channel_id_user_id_key" UNIQUE ("channel_id", "user_id");



ALTER TABLE ONLY "public"."channel_reads"
    ADD CONSTRAINT "channel_reads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."channel_reads"
    ADD CONSTRAINT "channel_reads_user_channel_unique" UNIQUE ("user_id", "channel_id");



ALTER TABLE ONLY "public"."channel_user_settings"
    ADD CONSTRAINT "channel_user_settings_channel_id_user_id_key" UNIQUE ("channel_id", "user_id");



ALTER TABLE ONLY "public"."channel_user_settings"
    ADD CONSTRAINT "channel_user_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."channels"
    ADD CONSTRAINT "channels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."declined_friend_requests"
    ADD CONSTRAINT "declined_friend_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."declined_friend_requests"
    ADD CONSTRAINT "declined_friend_requests_requester_id_addressee_id_key" UNIQUE ("requester_id", "addressee_id");



ALTER TABLE ONLY "public"."direct_messages"
    ADD CONSTRAINT "direct_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dm_attachments"
    ADD CONSTRAINT "dm_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dm_conversations"
    ADD CONSTRAINT "dm_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dm_participants"
    ADD CONSTRAINT "dm_participants_conversation_id_user_id_key" UNIQUE ("conversation_id", "user_id");



ALTER TABLE ONLY "public"."dm_participants"
    ADD CONSTRAINT "dm_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dm_reactions"
    ADD CONSTRAINT "dm_reactions_message_id_user_id_emoji_key" UNIQUE ("message_id", "user_id", "emoji");



ALTER TABLE ONLY "public"."dm_reactions"
    ADD CONSTRAINT "dm_reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_requester_id_addressee_id_key" UNIQUE ("requester_id", "addressee_id");



ALTER TABLE ONLY "public"."media_comment_reactions"
    ADD CONSTRAINT "media_comment_reactions_comment_id_user_id_emoji_key" UNIQUE ("comment_id", "user_id", "emoji");



ALTER TABLE ONLY "public"."media_comment_reactions"
    ADD CONSTRAINT "media_comment_reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."media_comments"
    ADD CONSTRAINT "media_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."media_items"
    ADD CONSTRAINT "media_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mentions"
    ADD CONSTRAINT "mentions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_attachments"
    ADD CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."poll_votes"
    ADD CONSTRAINT "poll_votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."poll_votes"
    ADD CONSTRAINT "poll_votes_poll_id_user_id_option_index_key" UNIQUE ("poll_id", "user_id", "option_index");



ALTER TABLE ONLY "public"."polls"
    ADD CONSTRAINT "polls_message_id_key" UNIQUE ("message_id");



ALTER TABLE ONLY "public"."polls"
    ADD CONSTRAINT "polls_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reactions"
    ADD CONSTRAINT "reactions_message_id_user_id_emoji_key" UNIQUE ("message_id", "user_id", "emoji");



ALTER TABLE ONLY "public"."reactions"
    ADD CONSTRAINT "reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."server_emojis"
    ADD CONSTRAINT "server_emojis_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."server_emojis"
    ADD CONSTRAINT "server_emojis_server_id_name_key" UNIQUE ("server_id", "name");



ALTER TABLE ONLY "public"."server_invites"
    ADD CONSTRAINT "server_invites_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."server_invites"
    ADD CONSTRAINT "server_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."server_member_roles"
    ADD CONSTRAINT "server_member_roles_member_id_role_id_key" UNIQUE ("member_id", "role_id");



ALTER TABLE ONLY "public"."server_member_roles"
    ADD CONSTRAINT "server_member_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."server_members"
    ADD CONSTRAINT "server_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."server_members"
    ADD CONSTRAINT "server_members_server_id_user_id_key" UNIQUE ("server_id", "user_id");



ALTER TABLE ONLY "public"."server_roles"
    ADD CONSTRAINT "server_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."server_roles"
    ADD CONSTRAINT "server_roles_server_id_name_key" UNIQUE ("server_id", "name");



ALTER TABLE ONLY "public"."servers"
    ADD CONSTRAINT "servers_invite_code_key" UNIQUE ("invite_code");



ALTER TABLE ONLY "public"."servers"
    ADD CONSTRAINT "servers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."thread_attachments"
    ADD CONSTRAINT "thread_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."thread_messages"
    ADD CONSTRAINT "thread_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."thread_reactions"
    ADD CONSTRAINT "thread_reactions_message_id_user_id_emoji_key" UNIQUE ("message_id", "user_id", "emoji");



ALTER TABLE ONLY "public"."thread_reactions"
    ADD CONSTRAINT "thread_reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."threads"
    ADD CONSTRAINT "threads_message_id_key" UNIQUE ("message_id");



ALTER TABLE ONLY "public"."threads"
    ADD CONSTRAINT "threads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_auth"
    ADD CONSTRAINT "user_auth_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_user_id_badge_id_key" UNIQUE ("user_id", "badge_id");



ALTER TABLE ONLY "public"."user_devices"
    ADD CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_devices"
    ADD CONSTRAINT "user_devices_user_id_device_id_key" UNIQUE ("user_id", "device_id");



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_server_folders"
    ADD CONSTRAINT "user_server_folders_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_server_tabs"
    ADD CONSTRAINT "user_server_tabs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_server_tabs"
    ADD CONSTRAINT "user_server_tabs_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_voice_settings"
    ADD CONSTRAINT "user_voice_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_voice_settings"
    ADD CONSTRAINT "user_voice_settings_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_username_key" UNIQUE ("username");



CREATE UNIQUE INDEX "channel_permissions_role_perm_idx" ON "public"."channel_permissions" USING "btree" ("channel_id", "role_id", "permission") WHERE (("role_id" IS NOT NULL) AND ("user_id" IS NULL));



CREATE UNIQUE INDEX "channel_permissions_rolename_perm_idx" ON "public"."channel_permissions" USING "btree" ("channel_id", "role_name", "permission") WHERE (("role_name" IS NOT NULL) AND ("role_id" IS NULL) AND ("user_id" IS NULL));



CREATE UNIQUE INDEX "channel_permissions_user_perm_idx" ON "public"."channel_permissions" USING "btree" ("channel_id", "user_id", "permission") WHERE ("user_id" IS NOT NULL);



CREATE UNIQUE INDEX "cp_base_role_unique" ON "public"."channel_permissions" USING "btree" ("channel_id", "role_name", "permission") WHERE ("role_name" IS NOT NULL);



CREATE UNIQUE INDEX "cp_custom_role_unique" ON "public"."channel_permissions" USING "btree" ("channel_id", "role_id", "permission") WHERE ("role_id" IS NOT NULL);



CREATE INDEX "idx_announcement_comment_reactions_comment" ON "public"."announcement_comment_reactions" USING "btree" ("comment_id");



CREATE INDEX "idx_announcement_comment_reactions_user_id" ON "public"."announcement_comment_reactions" USING "btree" ("user_id");



CREATE INDEX "idx_announcement_comments_message" ON "public"."announcement_comments" USING "btree" ("message_id");



CREATE INDEX "idx_announcement_comments_reply_to_id" ON "public"."announcement_comments" USING "btree" ("reply_to_id") WHERE ("reply_to_id" IS NOT NULL);



CREATE INDEX "idx_announcement_comments_user" ON "public"."announcement_comments" USING "btree" ("user_id");



CREATE INDEX "idx_category_permissions_category_id" ON "public"."category_permissions" USING "btree" ("category_id");



CREATE INDEX "idx_category_permissions_role_id" ON "public"."category_permissions" USING "btree" ("role_id");



CREATE INDEX "idx_category_permissions_user_id" ON "public"."category_permissions" USING "btree" ("user_id");



CREATE INDEX "idx_channel_categories_server_id" ON "public"."channel_categories" USING "btree" ("server_id");



CREATE INDEX "idx_channel_members_added_by" ON "public"."channel_members" USING "btree" ("added_by") WHERE ("added_by" IS NOT NULL);



CREATE INDEX "idx_channel_members_channel_id" ON "public"."channel_members" USING "btree" ("channel_id");



CREATE INDEX "idx_channel_members_channel_user" ON "public"."channel_members" USING "btree" ("channel_id", "user_id");



CREATE INDEX "idx_channel_members_user_id" ON "public"."channel_members" USING "btree" ("user_id");



CREATE INDEX "idx_channel_permissions_channel" ON "public"."channel_permissions" USING "btree" ("channel_id");



CREATE INDEX "idx_channel_permissions_channel_user" ON "public"."channel_permissions" USING "btree" ("channel_id", "user_id");



CREATE INDEX "idx_channel_permissions_role_id" ON "public"."channel_permissions" USING "btree" ("role_id");



CREATE INDEX "idx_channel_permissions_role_name" ON "public"."channel_permissions" USING "btree" ("channel_id", "role_name");



CREATE INDEX "idx_channel_permissions_user_id" ON "public"."channel_permissions" USING "btree" ("user_id");



CREATE INDEX "idx_channel_reads_channel" ON "public"."channel_reads" USING "btree" ("channel_id");



CREATE INDEX "idx_channel_reads_last_read_message_id" ON "public"."channel_reads" USING "btree" ("last_read_message_id") WHERE ("last_read_message_id" IS NOT NULL);



CREATE INDEX "idx_channel_reads_user" ON "public"."channel_reads" USING "btree" ("user_id");



CREATE INDEX "idx_channel_user_settings_channel" ON "public"."channel_user_settings" USING "btree" ("channel_id");



CREATE INDEX "idx_channel_user_settings_user" ON "public"."channel_user_settings" USING "btree" ("user_id");



CREATE INDEX "idx_channels_category" ON "public"."channels" USING "btree" ("category_id");



CREATE INDEX "idx_channels_server_id" ON "public"."channels" USING "btree" ("server_id");



CREATE INDEX "idx_declined_friend_requests_addressee_id" ON "public"."declined_friend_requests" USING "btree" ("addressee_id");



CREATE INDEX "idx_devices_user" ON "public"."user_devices" USING "btree" ("user_id");



CREATE INDEX "idx_direct_messages_content_search" ON "public"."direct_messages" USING "gin" ("to_tsvector"('"english"'::"regconfig", "content"));



CREATE INDEX "idx_direct_messages_conv_created" ON "public"."direct_messages" USING "btree" ("conversation_id", "created_at" DESC);



CREATE INDEX "idx_direct_messages_conversation" ON "public"."direct_messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_direct_messages_created_at" ON "public"."direct_messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_direct_messages_reply_to_id" ON "public"."direct_messages" USING "btree" ("reply_to_id") WHERE ("reply_to_id" IS NOT NULL);



CREATE INDEX "idx_direct_messages_sender_id" ON "public"."direct_messages" USING "btree" ("sender_id");



CREATE INDEX "idx_dm_attachments_message_id" ON "public"."dm_attachments" USING "btree" ("message_id");



CREATE INDEX "idx_dm_conversations_created_by" ON "public"."dm_conversations" USING "btree" ("created_by") WHERE ("created_by" IS NOT NULL);



CREATE INDEX "idx_dm_participants_conv_user" ON "public"."dm_participants" USING "btree" ("conversation_id", "user_id");



CREATE INDEX "idx_dm_participants_conversation" ON "public"."dm_participants" USING "btree" ("conversation_id");



CREATE INDEX "idx_dm_participants_user" ON "public"."dm_participants" USING "btree" ("user_id");



CREATE INDEX "idx_dm_participants_user_conv" ON "public"."dm_participants" USING "btree" ("user_id", "conversation_id");



CREATE INDEX "idx_dm_reactions_user_id" ON "public"."dm_reactions" USING "btree" ("user_id");



CREATE INDEX "idx_friendships_addressee" ON "public"."friendships" USING "btree" ("addressee_id");



CREATE INDEX "idx_friendships_requester" ON "public"."friendships" USING "btree" ("requester_id");



CREATE INDEX "idx_media_comment_reactions_comment_id" ON "public"."media_comment_reactions" USING "btree" ("comment_id");



CREATE INDEX "idx_media_comment_reactions_user_id" ON "public"."media_comment_reactions" USING "btree" ("user_id");



CREATE INDEX "idx_media_comments_media_id" ON "public"."media_comments" USING "btree" ("media_id");



CREATE INDEX "idx_media_comments_reply_to_id" ON "public"."media_comments" USING "btree" ("reply_to_id") WHERE ("reply_to_id" IS NOT NULL);



CREATE INDEX "idx_media_comments_user_id" ON "public"."media_comments" USING "btree" ("user_id");



CREATE INDEX "idx_media_items_channel_id" ON "public"."media_items" USING "btree" ("channel_id");



CREATE INDEX "idx_media_items_created_at" ON "public"."media_items" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_media_items_user_id" ON "public"."media_items" USING "btree" ("user_id");



CREATE INDEX "idx_mentions_message" ON "public"."mentions" USING "btree" ("message_id");



CREATE INDEX "idx_mentions_user" ON "public"."mentions" USING "btree" ("user_id");



CREATE INDEX "idx_message_attachments_message_id" ON "public"."message_attachments" USING "btree" ("message_id");



CREATE INDEX "idx_messages_channel_created" ON "public"."messages" USING "btree" ("channel_id", "created_at" DESC);



CREATE INDEX "idx_messages_channel_id" ON "public"."messages" USING "btree" ("channel_id");



CREATE INDEX "idx_messages_content_search" ON "public"."messages" USING "gin" ("to_tsvector"('"english"'::"regconfig", "content"));



CREATE INDEX "idx_messages_created_at" ON "public"."messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_messages_is_system_message" ON "public"."messages" USING "btree" ("is_system_message") WHERE ("is_system_message" = true);



CREATE INDEX "idx_messages_reply_to" ON "public"."messages" USING "btree" ("reply_to_id") WHERE ("reply_to_id" IS NOT NULL);



CREATE INDEX "idx_messages_user" ON "public"."messages" USING "btree" ("user_id");



CREATE INDEX "idx_notifications_unread" ON "public"."notifications" USING "btree" ("user_id") WHERE ("is_read" = false);



CREATE INDEX "idx_notifications_user" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_poll_votes_poll_id" ON "public"."poll_votes" USING "btree" ("poll_id");



CREATE INDEX "idx_poll_votes_user_id" ON "public"."poll_votes" USING "btree" ("user_id");



CREATE INDEX "idx_polls_channel_id" ON "public"."polls" USING "btree" ("channel_id");



CREATE INDEX "idx_polls_created_by" ON "public"."polls" USING "btree" ("created_by");



CREATE INDEX "idx_polls_ends_at" ON "public"."polls" USING "btree" ("ends_at");



CREATE INDEX "idx_polls_message_id" ON "public"."polls" USING "btree" ("message_id");



CREATE INDEX "idx_reactions_channel_id" ON "public"."reactions" USING "btree" ("channel_id");



CREATE INDEX "idx_reactions_message_id" ON "public"."reactions" USING "btree" ("message_id");



CREATE INDEX "idx_reactions_user_id" ON "public"."reactions" USING "btree" ("user_id");



CREATE INDEX "idx_role_permissions_role_id" ON "public"."role_permissions" USING "btree" ("role_id");



CREATE INDEX "idx_role_permissions_role_name" ON "public"."role_permissions" USING "btree" ("server_id", "role_name");



CREATE INDEX "idx_role_permissions_server_id" ON "public"."role_permissions" USING "btree" ("server_id");



CREATE INDEX "idx_server_emojis_created_by" ON "public"."server_emojis" USING "btree" ("created_by") WHERE ("created_by" IS NOT NULL);



CREATE INDEX "idx_server_invites_code" ON "public"."server_invites" USING "btree" ("code");



CREATE INDEX "idx_server_invites_created_by" ON "public"."server_invites" USING "btree" ("created_by") WHERE ("created_by" IS NOT NULL);



CREATE INDEX "idx_server_invites_revoked_by" ON "public"."server_invites" USING "btree" ("revoked_by") WHERE ("revoked_by" IS NOT NULL);



CREATE INDEX "idx_server_invites_server_id" ON "public"."server_invites" USING "btree" ("server_id");



CREATE INDEX "idx_server_member_roles_member" ON "public"."server_member_roles" USING "btree" ("member_id");



CREATE INDEX "idx_server_member_roles_role" ON "public"."server_member_roles" USING "btree" ("role_id");



CREATE INDEX "idx_server_members_server" ON "public"."server_members" USING "btree" ("server_id");



CREATE INDEX "idx_server_members_user" ON "public"."server_members" USING "btree" ("user_id");



CREATE INDEX "idx_server_members_user_position" ON "public"."server_members" USING "btree" ("user_id", "position");



CREATE INDEX "idx_server_members_user_server" ON "public"."server_members" USING "btree" ("user_id", "server_id");



CREATE INDEX "idx_server_roles_position" ON "public"."server_roles" USING "btree" ("server_id", "position");



CREATE INDEX "idx_server_roles_server_id" ON "public"."server_roles" USING "btree" ("server_id");



CREATE INDEX "idx_servers_invite_code" ON "public"."servers" USING "btree" ("invite_code");



CREATE INDEX "idx_servers_is_published" ON "public"."servers" USING "btree" ("is_published") WHERE ("is_published" = true);



CREATE INDEX "idx_servers_owner_id" ON "public"."servers" USING "btree" ("owner_id");



CREATE INDEX "idx_servers_published_created" ON "public"."servers" USING "btree" ("created_at" DESC) WHERE ("is_published" = true);



CREATE INDEX "idx_servers_system_channel_join_id" ON "public"."servers" USING "btree" ("system_channel_join_id") WHERE ("system_channel_join_id" IS NOT NULL);



CREATE INDEX "idx_servers_system_channel_leave_id" ON "public"."servers" USING "btree" ("system_channel_leave_id") WHERE ("system_channel_leave_id" IS NOT NULL);



CREATE INDEX "idx_thread_attachments_message_id" ON "public"."thread_attachments" USING "btree" ("message_id");



CREATE INDEX "idx_thread_messages_created_at" ON "public"."thread_messages" USING "btree" ("created_at");



CREATE INDEX "idx_thread_messages_reply_to_id" ON "public"."thread_messages" USING "btree" ("reply_to_id") WHERE ("reply_to_id" IS NOT NULL);



CREATE INDEX "idx_thread_messages_thread_id" ON "public"."thread_messages" USING "btree" ("thread_id");



CREATE INDEX "idx_thread_messages_user_id" ON "public"."thread_messages" USING "btree" ("user_id");



CREATE INDEX "idx_thread_reactions_message_id" ON "public"."thread_reactions" USING "btree" ("message_id");



CREATE INDEX "idx_thread_reactions_user_id" ON "public"."thread_reactions" USING "btree" ("user_id");



CREATE INDEX "idx_threads_channel_id" ON "public"."threads" USING "btree" ("channel_id");



CREATE INDEX "idx_threads_created_by" ON "public"."threads" USING "btree" ("created_by");



CREATE INDEX "idx_threads_message_id" ON "public"."threads" USING "btree" ("message_id");



CREATE INDEX "idx_user_badges_badge_id" ON "public"."user_badges" USING "btree" ("badge_id");



CREATE INDEX "idx_user_server_folders_user_id" ON "public"."user_server_folders" USING "btree" ("user_id");



CREATE INDEX "idx_user_voice_settings_user_id" ON "public"."user_voice_settings" USING "btree" ("user_id");



CREATE INDEX "idx_users_username" ON "public"."users" USING "btree" ("username");



CREATE UNIQUE INDEX "role_permissions_server_role_perm_idx" ON "public"."role_permissions" USING "btree" ("server_id", "role_id", "permission") WHERE ("role_id" IS NOT NULL);



CREATE UNIQUE INDEX "role_permissions_server_rolename_perm_idx" ON "public"."role_permissions" USING "btree" ("server_id", "role_name", "permission") WHERE (("role_name" IS NOT NULL) AND ("role_id" IS NULL));



CREATE UNIQUE INDEX "rp_base_role_unique" ON "public"."role_permissions" USING "btree" ("server_id", "role_name", "permission") WHERE ("role_name" IS NOT NULL);



CREATE INDEX "server_emojis_server_id_idx" ON "public"."server_emojis" USING "btree" ("server_id");



CREATE INDEX "servers_created_at_idx" ON "public"."servers" USING "btree" ("created_at");



CREATE OR REPLACE TRIGGER "dm_notification_trigger" AFTER INSERT ON "public"."direct_messages" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_dm_notification"();



CREATE OR REPLACE TRIGGER "mention_notification_trigger" AFTER INSERT ON "public"."mentions" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_mention_notification"();



CREATE OR REPLACE TRIGGER "trg_enforce_server_emoji_limit" BEFORE INSERT ON "public"."server_emojis" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_server_emoji_limit"();



CREATE OR REPLACE TRIGGER "trg_set_reaction_channel_id" BEFORE INSERT OR UPDATE OF "message_id" ON "public"."reactions" FOR EACH ROW EXECUTE FUNCTION "public"."set_reaction_channel_id"();



CREATE OR REPLACE TRIGGER "trg_update_voice_settings_timestamp" BEFORE UPDATE ON "public"."user_voice_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_voice_settings_timestamp"();



CREATE OR REPLACE TRIGGER "trigger_cleanup_declined" AFTER UPDATE ON "public"."friendships" FOR EACH STATEMENT EXECUTE FUNCTION "public"."delete_old_declined_requests"();



CREATE OR REPLACE TRIGGER "trigger_increment_mention_count" AFTER INSERT ON "public"."mentions" FOR EACH ROW EXECUTE FUNCTION "public"."increment_mention_count"();



CREATE OR REPLACE TRIGGER "update_app_config_timestamp" BEFORE UPDATE ON "public"."app_config" FOR EACH ROW EXECUTE FUNCTION "public"."update_modified_column"();



CREATE OR REPLACE TRIGGER "update_user_preferences_updated_at" BEFORE UPDATE ON "public"."user_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_preferences_updated_at"();



CREATE OR REPLACE TRIGGER "validate_username_trigger" BEFORE INSERT ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."validate_username_on_insert"();



ALTER TABLE ONLY "public"."announcement_comment_reactions"
    ADD CONSTRAINT "announcement_comment_reactions_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."announcement_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."announcement_comment_reactions"
    ADD CONSTRAINT "announcement_comment_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."announcement_comments"
    ADD CONSTRAINT "announcement_comments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."announcement_comments"
    ADD CONSTRAINT "announcement_comments_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "public"."announcement_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."announcement_comments"
    ADD CONSTRAINT "announcement_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."category_permissions"
    ADD CONSTRAINT "category_permissions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."channel_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."category_permissions"
    ADD CONSTRAINT "category_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."server_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."category_permissions"
    ADD CONSTRAINT "category_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_categories"
    ADD CONSTRAINT "channel_categories_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_members"
    ADD CONSTRAINT "channel_members_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."channel_members"
    ADD CONSTRAINT "channel_members_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_members"
    ADD CONSTRAINT "channel_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_permissions"
    ADD CONSTRAINT "channel_permissions_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_permissions"
    ADD CONSTRAINT "channel_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."server_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_permissions"
    ADD CONSTRAINT "channel_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_reads"
    ADD CONSTRAINT "channel_reads_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_reads"
    ADD CONSTRAINT "channel_reads_last_read_message_id_fkey" FOREIGN KEY ("last_read_message_id") REFERENCES "public"."messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."channel_reads"
    ADD CONSTRAINT "channel_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_user_settings"
    ADD CONSTRAINT "channel_user_settings_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_user_settings"
    ADD CONSTRAINT "channel_user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channels"
    ADD CONSTRAINT "channels_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."channel_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."channels"
    ADD CONSTRAINT "channels_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."declined_friend_requests"
    ADD CONSTRAINT "declined_friend_requests_addressee_id_fkey" FOREIGN KEY ("addressee_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."declined_friend_requests"
    ADD CONSTRAINT "declined_friend_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."direct_messages"
    ADD CONSTRAINT "direct_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."dm_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."direct_messages"
    ADD CONSTRAINT "direct_messages_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "public"."direct_messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."direct_messages"
    ADD CONSTRAINT "direct_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dm_attachments"
    ADD CONSTRAINT "dm_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."direct_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dm_conversations"
    ADD CONSTRAINT "dm_conversations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."dm_participants"
    ADD CONSTRAINT "dm_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."dm_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dm_participants"
    ADD CONSTRAINT "dm_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dm_reactions"
    ADD CONSTRAINT "dm_reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."direct_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dm_reactions"
    ADD CONSTRAINT "dm_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_addressee_id_fkey" FOREIGN KEY ("addressee_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."media_comment_reactions"
    ADD CONSTRAINT "media_comment_reactions_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."media_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."media_comment_reactions"
    ADD CONSTRAINT "media_comment_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."media_comments"
    ADD CONSTRAINT "media_comments_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "public"."media_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."media_comments"
    ADD CONSTRAINT "media_comments_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "public"."media_comments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."media_comments"
    ADD CONSTRAINT "media_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."media_items"
    ADD CONSTRAINT "media_items_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."media_items"
    ADD CONSTRAINT "media_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mentions"
    ADD CONSTRAINT "mentions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mentions"
    ADD CONSTRAINT "mentions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_attachments"
    ADD CONSTRAINT "message_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "public"."messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."poll_votes"
    ADD CONSTRAINT "poll_votes_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."poll_votes"
    ADD CONSTRAINT "poll_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."polls"
    ADD CONSTRAINT "polls_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."polls"
    ADD CONSTRAINT "polls_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."polls"
    ADD CONSTRAINT "polls_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reactions"
    ADD CONSTRAINT "reactions_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reactions"
    ADD CONSTRAINT "reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reactions"
    ADD CONSTRAINT "reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."server_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."server_emojis"
    ADD CONSTRAINT "server_emojis_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."server_emojis"
    ADD CONSTRAINT "server_emojis_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."server_invites"
    ADD CONSTRAINT "server_invites_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."server_invites"
    ADD CONSTRAINT "server_invites_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."server_invites"
    ADD CONSTRAINT "server_invites_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."server_member_roles"
    ADD CONSTRAINT "server_member_roles_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."server_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."server_member_roles"
    ADD CONSTRAINT "server_member_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."server_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."server_members"
    ADD CONSTRAINT "server_members_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."server_members"
    ADD CONSTRAINT "server_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."server_roles"
    ADD CONSTRAINT "server_roles_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."servers"
    ADD CONSTRAINT "servers_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."servers"
    ADD CONSTRAINT "servers_system_channel_join_id_fkey" FOREIGN KEY ("system_channel_join_id") REFERENCES "public"."channels"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."servers"
    ADD CONSTRAINT "servers_system_channel_leave_id_fkey" FOREIGN KEY ("system_channel_leave_id") REFERENCES "public"."channels"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."thread_attachments"
    ADD CONSTRAINT "thread_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."thread_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."thread_messages"
    ADD CONSTRAINT "thread_messages_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "public"."thread_messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."thread_messages"
    ADD CONSTRAINT "thread_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."thread_messages"
    ADD CONSTRAINT "thread_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."thread_reactions"
    ADD CONSTRAINT "thread_reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."thread_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."thread_reactions"
    ADD CONSTRAINT "thread_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."threads"
    ADD CONSTRAINT "threads_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."threads"
    ADD CONSTRAINT "threads_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."threads"
    ADD CONSTRAINT "threads_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_auth"
    ADD CONSTRAINT "user_auth_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_devices"
    ADD CONSTRAINT "user_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_server_folders"
    ADD CONSTRAINT "user_server_folders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_server_tabs"
    ADD CONSTRAINT "user_server_tabs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_voice_settings"
    ADD CONSTRAINT "user_voice_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Addressee can decline" ON "public"."declined_friend_requests" FOR INSERT WITH CHECK (("addressee_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Addressee can delete rejected requests" ON "public"."friendships" FOR DELETE USING (("addressee_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Addressee can manage received requests" ON "public"."friendships" FOR UPDATE USING (("addressee_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id"))) WITH CHECK ((("addressee_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")) AND ("status" = ANY (ARRAY['accepted'::"public"."friendship_status", 'blocked'::"public"."friendship_status", 'declined'::"public"."friendship_status"]))));



CREATE POLICY "Allow users to read messages" ON "public"."messages" FOR SELECT USING (("public"."is_maintenance_active"() = false));



CREATE POLICY "Announcement comment reactions viewable by channel members" ON "public"."announcement_comment_reactions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."announcement_comments" "ac"
  WHERE (("ac"."id" = "announcement_comment_reactions"."comment_id") AND "public"."is_message_channel_member"("ac"."message_id", ( SELECT "public"."requesting_user_id"() AS "requesting_user_id"))))));



CREATE POLICY "Announcement comments viewable by channel members" ON "public"."announcement_comments" FOR SELECT USING ("public"."is_message_channel_member"("message_id", ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "App config read only" ON "public"."app_config" FOR SELECT USING (true);



CREATE POLICY "Attachments can be deleted" ON "public"."message_attachments" FOR DELETE USING (("message_id" IN ( SELECT "messages"."id"
   FROM "public"."messages"
  WHERE ("messages"."user_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")))));



CREATE POLICY "Attachments insert by message sender" ON "public"."message_attachments" FOR INSERT WITH CHECK (((( SELECT "public"."requesting_user_id"() AS "requesting_user_id") IS NOT NULL) AND "public"."is_message_channel_member"("message_id", ( SELECT "public"."requesting_user_id"() AS "requesting_user_id"))));



CREATE POLICY "Attachments viewable by channel members" ON "public"."message_attachments" FOR SELECT USING ("public"."is_message_channel_member"("message_id", ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Attachments viewable by channel members only" ON "public"."message_attachments" FOR SELECT USING ("public"."is_message_channel_member"("message_id", ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Badges are publicly readable" ON "public"."badges" FOR SELECT USING (true);



CREATE POLICY "Category permissions viewable by members" ON "public"."category_permissions" FOR SELECT USING ("public"."is_category_server_member"("category_id", ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Channel permissions viewable by members" ON "public"."channel_permissions" FOR SELECT USING ("public"."is_channel_server_member"("channel_id", ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Channels viewable by server members" ON "public"."channels" FOR SELECT USING (("public"."is_server_member"("server_id", ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")) AND (("is_private" = false) OR "public"."has_private_channel_access"("id", ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")))));



CREATE POLICY "DM conversations via RPC only" ON "public"."dm_conversations" FOR INSERT WITH CHECK (false);



CREATE POLICY "DM participants via RPC only" ON "public"."dm_participants" FOR INSERT WITH CHECK (false);



CREATE POLICY "Devices are readable" ON "public"."user_devices" FOR SELECT USING (true);



CREATE POLICY "Invites are viewable if valid" ON "public"."server_invites" FOR SELECT TO "authenticated", "anon" USING ((("revoked_at" IS NULL) AND (("expires_at" IS NULL) OR ("expires_at" > "now"())) AND (("max_uses" IS NULL) OR ("uses_count" < "max_uses"))));



CREATE POLICY "Involved users can delete" ON "public"."friendships" FOR DELETE USING ((("requester_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")) OR ("addressee_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id"))));



CREATE POLICY "Involved users can delete declined requests" ON "public"."declined_friend_requests" FOR DELETE USING ((("requester_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")) OR ("addressee_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id"))));



CREATE POLICY "Involved users can update" ON "public"."friendships" FOR UPDATE USING ((("requester_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")) OR ("addressee_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id"))));



CREATE POLICY "Involved users see declined requests" ON "public"."declined_friend_requests" FOR SELECT USING ((("requester_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")) OR ("addressee_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id"))));



CREATE POLICY "Media comment reactions viewable by channel members" ON "public"."media_comment_reactions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."media_comments" "mc"
  WHERE (("mc"."id" = "media_comment_reactions"."comment_id") AND "public"."is_media_channel_member"("mc"."media_id", ( SELECT "public"."requesting_user_id"() AS "requesting_user_id"))))));



CREATE POLICY "Media comments viewable by channel members" ON "public"."media_comments" FOR SELECT USING ("public"."is_media_channel_member"("media_id", ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Media viewable by members" ON "public"."media_items" FOR SELECT USING ("public"."is_channel_server_member"("channel_id", ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Member roles viewable by server members" ON "public"."server_member_roles" FOR SELECT USING ("public"."is_member_in_same_server"("member_id", ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Members view categories" ON "public"."channel_categories" FOR SELECT USING ("public"."is_server_member"("server_id", ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Members view fellow members" ON "public"."server_members" FOR SELECT USING (((( SELECT "public"."requesting_user_id"() AS "requesting_user_id") IS NULL) OR "public"."is_server_member"("server_id", ( SELECT "public"."requesting_user_id"() AS "requesting_user_id"))));



CREATE POLICY "Members view server invites" ON "public"."server_invites" FOR SELECT USING ("public"."is_server_member"("server_id", ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Mentions insert via trigger only" ON "public"."mentions" FOR INSERT WITH CHECK (false);



CREATE POLICY "Mentions viewable by channel members" ON "public"."mentions" FOR SELECT USING ("public"."is_message_channel_member"("message_id", ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Notifications are private and permission-based" ON "public"."notifications" FOR SELECT TO "authenticated" USING ((("user_id" = "public"."requesting_user_id"()) AND (("link" !~~ '/channels/%'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."channels" "c"
  WHERE (("notifications"."link" ~~ (('/channels/'::"text" || "c"."id") || '%'::"text")) AND (("c"."is_private" = false) OR (EXISTS ( SELECT 1
           FROM "public"."channel_members" "cm"
          WHERE (("cm"."channel_id" = "c"."id") AND ("cm"."user_id" = "public"."requesting_user_id"())))))))))));



CREATE POLICY "Owner can delete server" ON "public"."servers" FOR DELETE USING (("owner_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Owner or admin can update server settings" ON "public"."servers" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."server_members" "sm"
  WHERE (("sm"."server_id" = "servers"."id") AND ("sm"."user_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")) AND ("sm"."is_banned" = false) AND ("sm"."role" = ANY (ARRAY['owner'::"public"."server_role", 'admin'::"public"."server_role"]))))));



CREATE POLICY "Participants add DM attachments" ON "public"."dm_attachments" FOR INSERT WITH CHECK (((( SELECT "public"."requesting_user_id"() AS "requesting_user_id") IS NOT NULL) AND "public"."is_dm_message_participant"("message_id", ( SELECT "public"."requesting_user_id"() AS "requesting_user_id"))));



CREATE POLICY "Participants can view conversations" ON "public"."dm_conversations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."dm_participants"
  WHERE (("dm_participants"."conversation_id" = "dm_conversations"."id") AND ("dm_participants"."user_id" = "public"."requesting_user_id"())))));



CREATE POLICY "Participants can view dm attachments" ON "public"."dm_attachments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."direct_messages" "m"
     JOIN "public"."dm_participants" "p" ON (("m"."conversation_id" = "p"."conversation_id")))
  WHERE (("m"."id" = "dm_attachments"."message_id") AND ("p"."user_id" = "public"."requesting_user_id"())))));



CREATE POLICY "Participants can view messages" ON "public"."direct_messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."dm_participants"
  WHERE (("dm_participants"."conversation_id" = "direct_messages"."conversation_id") AND ("dm_participants"."user_id" = "public"."requesting_user_id"())))));



CREATE POLICY "Participants send messages" ON "public"."direct_messages" FOR INSERT WITH CHECK ((("sender_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")) AND "public"."is_dm_participant"("conversation_id", ( SELECT "public"."requesting_user_id"() AS "requesting_user_id"))));



CREATE POLICY "Participants view DM attachments" ON "public"."dm_attachments" FOR SELECT USING ("public"."is_dm_message_participant"("message_id", ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Participants view DM reactions" ON "public"."dm_reactions" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM ("public"."direct_messages" "dm"
     JOIN "public"."dm_participants" "dp" ON (("dp"."conversation_id" = "dm"."conversation_id")))
  WHERE (("dm"."id" = "dm_reactions"."message_id") AND ("dp"."user_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id"))))) OR (CURRENT_USER = 'realtime'::"name") OR (( SELECT "public"."requesting_user_id"() AS "requesting_user_id") IS NULL)));



CREATE POLICY "Participants view conversation members" ON "public"."dm_participants" FOR SELECT USING (("public"."is_dm_participant"("conversation_id", ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")) OR (CURRENT_USER = 'realtime'::"name") OR (( SELECT "public"."requesting_user_id"() AS "requesting_user_id") IS NULL)));



CREATE POLICY "Participants view messages" ON "public"."direct_messages" FOR SELECT USING (("public"."is_dm_participant"("conversation_id", ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")) OR (CURRENT_USER = 'realtime'::"name") OR (( SELECT "public"."requesting_user_id"() AS "requesting_user_id") IS NULL)));



CREATE POLICY "Participants view own conversations" ON "public"."dm_conversations" FOR SELECT USING (("public"."is_dm_participant"("id", ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")) OR (CURRENT_USER = 'realtime'::"name") OR (( SELECT "public"."requesting_user_id"() AS "requesting_user_id") IS NULL)));



CREATE POLICY "Poll votes viewable by channel members" ON "public"."poll_votes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."polls" "p"
  WHERE (("p"."id" = "poll_votes"."poll_id") AND "public"."is_channel_server_member"("p"."channel_id", ( SELECT "public"."requesting_user_id"() AS "requesting_user_id"))))));



CREATE POLICY "Polls viewable by channel members" ON "public"."polls" FOR SELECT USING ("public"."is_channel_server_member"("channel_id", ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Public profiles are viewable by everyone" ON "public"."users" FOR SELECT USING (true);



CREATE POLICY "Reactions are viewable" ON "public"."reactions" FOR SELECT USING (("public"."is_channel_server_member"("channel_id", ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")) OR (CURRENT_USER = 'realtime'::"name") OR (( SELECT "public"."requesting_user_id"() AS "requesting_user_id") IS NULL)));



CREATE POLICY "Role permissions viewable by members" ON "public"."role_permissions" FOR SELECT USING ("public"."is_server_member"("server_id", ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Server emojis are viewable by everyone" ON "public"."server_emojis" FOR SELECT USING (true);



CREATE POLICY "Server members can be added to channels" ON "public"."channel_members" FOR INSERT WITH CHECK ("public"."is_channel_server_member"("channel_id", ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Server members view channel members" ON "public"."channel_members" FOR SELECT USING ("public"."is_channel_server_member"("channel_id", ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Server members view channel messages" ON "public"."messages" FOR SELECT USING (("public"."is_channel_server_member"("channel_id", ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")) OR (CURRENT_USER = 'realtime'::"name") OR (( SELECT "public"."requesting_user_id"() AS "requesting_user_id") IS NULL)));



CREATE POLICY "Server roles viewable by members" ON "public"."server_roles" FOR SELECT USING ("public"."is_server_member"("server_id", ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Servers select by membership or published" ON "public"."servers" FOR SELECT USING (((( SELECT "public"."requesting_user_id"() AS "requesting_user_id") IS NULL) OR ("is_published" = true) OR "public"."is_server_member"("id", ( SELECT "public"."requesting_user_id"() AS "requesting_user_id"))));



CREATE POLICY "Thread attachments can be deleted" ON "public"."thread_attachments" FOR DELETE USING (("message_id" IN ( SELECT "thread_messages"."id"
   FROM "public"."thread_messages"
  WHERE ("thread_messages"."user_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")))));



CREATE POLICY "Thread attachments insert by message author" ON "public"."thread_attachments" FOR INSERT WITH CHECK (((( SELECT "public"."requesting_user_id"() AS "requesting_user_id") IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."thread_messages" "tm"
  WHERE (("tm"."id" = "thread_attachments"."message_id") AND ("tm"."user_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")))))));



CREATE POLICY "Thread attachments viewable by channel members" ON "public"."thread_attachments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."thread_messages" "tm"
  WHERE (("tm"."id" = "thread_attachments"."message_id") AND "public"."is_thread_channel_member"("tm"."thread_id", ( SELECT "public"."requesting_user_id"() AS "requesting_user_id"))))));



CREATE POLICY "Thread messages can be deleted" ON "public"."thread_messages" FOR DELETE USING (("user_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Thread messages can be inserted" ON "public"."thread_messages" FOR INSERT WITH CHECK (("user_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Thread messages can be updated" ON "public"."thread_messages" FOR UPDATE USING (("user_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Thread messages viewable by channel members" ON "public"."thread_messages" FOR SELECT USING ("public"."is_thread_channel_member"("thread_id", ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Thread reactions can be deleted" ON "public"."thread_reactions" FOR DELETE USING (("user_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Thread reactions can be inserted" ON "public"."thread_reactions" FOR INSERT WITH CHECK (("user_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Thread reactions viewable by channel members" ON "public"."thread_reactions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."thread_messages" "tm"
  WHERE (("tm"."id" = "thread_reactions"."message_id") AND "public"."is_thread_channel_member"("tm"."thread_id", ( SELECT "public"."requesting_user_id"() AS "requesting_user_id"))))));



CREATE POLICY "Threads are viewable" ON "public"."threads" FOR SELECT USING ("public"."is_channel_server_member"("channel_id", ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Threads can be deleted" ON "public"."threads" FOR DELETE USING (("created_by" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Threads can be inserted" ON "public"."threads" FOR INSERT WITH CHECK (("created_by" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Threads can be updated" ON "public"."threads" FOR UPDATE USING (("created_by" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "User badges are publicly readable" ON "public"."user_badges" FOR SELECT USING (true);



CREATE POLICY "Users add own DM reactions" ON "public"."dm_reactions" FOR INSERT WITH CHECK (("user_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Users add own reactions" ON "public"."reactions" FOR INSERT WITH CHECK (("user_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Users are discoverable via mutual servers" ON "public"."users" FOR SELECT TO "authenticated" USING ((("id" = "public"."requesting_user_id"()) OR ("id" IN ( SELECT "server_members"."user_id"
   FROM "public"."server_members"
  WHERE ("server_members"."server_id" IN ( SELECT "server_members_1"."server_id"
           FROM "public"."server_members" "server_members_1"
          WHERE ("server_members_1"."user_id" = "public"."requesting_user_id"())))))));



CREATE POLICY "Users are viewable" ON "public"."users" FOR SELECT USING (true);



CREATE POLICY "Users can leave servers" ON "public"."server_members" FOR DELETE USING (("user_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Users can only read messages in accessible channels" ON "public"."messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."channels"
  WHERE ("channels"."id" = "messages"."channel_id"))));



CREATE POLICY "Users can read messages with permission" ON "public"."messages" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM ("public"."channels" "c"
     JOIN "public"."servers" "s" ON (("c"."server_id" = "s"."id")))
  WHERE (("c"."id" = "messages"."channel_id") AND ("s"."owner_id" = "public"."requesting_user_id"())))) OR (EXISTS ( SELECT 1
   FROM "public"."channel_permissions" "cp"
  WHERE (("cp"."channel_id" = "messages"."channel_id") AND ("cp"."user_id" = "public"."requesting_user_id"()) AND ("cp"."permission" = 'view_channels'::"public"."permission_type") AND ("cp"."allowed" = true)))) OR (EXISTS ( SELECT 1
   FROM ((("public"."server_member_roles" "smr"
     JOIN "public"."role_permissions" "rp" ON (("smr"."role_id" = "rp"."role_id")))
     JOIN "public"."server_members" "sm" ON (("smr"."member_id" = "sm"."id")))
     JOIN "public"."channels" "ch" ON (("ch"."id" = "messages"."channel_id")))
  WHERE (("sm"."user_id" = "public"."requesting_user_id"()) AND ("sm"."server_id" = "ch"."server_id") AND ("rp"."permission" = 'view_channels'::"public"."permission_type") AND ("rp"."allowed" = true))))));



CREATE POLICY "Users can remove themselves from channels" ON "public"."channel_members" FOR DELETE USING (("user_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Users can update their own data" ON "public"."users" FOR UPDATE USING (("id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Users create servers as owner" ON "public"."servers" FOR INSERT WITH CHECK (("owner_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Users delete own DM attachments" ON "public"."dm_attachments" FOR DELETE USING ("public"."is_dm_message_participant"("message_id", ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Users delete own DMs" ON "public"."direct_messages" FOR DELETE USING (("sender_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Users edit own DMs" ON "public"."direct_messages" FOR UPDATE USING (("sender_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Users join as member" ON "public"."server_members" FOR INSERT WITH CHECK (("user_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Users manage own channel settings" ON "public"."channel_user_settings" USING (("user_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id"))) WITH CHECK (("user_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Users manage own folders" ON "public"."user_server_folders" USING (("user_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id"))) WITH CHECK (("user_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Users manage own media comment reactions" ON "public"."media_comment_reactions" USING ((( SELECT "public"."requesting_user_id"() AS "requesting_user_id") = "user_id")) WITH CHECK ((( SELECT "public"."requesting_user_id"() AS "requesting_user_id") = "user_id"));



CREATE POLICY "Users manage own media comments" ON "public"."media_comments" USING ((( SELECT "public"."requesting_user_id"() AS "requesting_user_id") = "user_id")) WITH CHECK ((( SELECT "public"."requesting_user_id"() AS "requesting_user_id") = "user_id"));



CREATE POLICY "Users manage own notifications" ON "public"."notifications" USING (("user_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id"))) WITH CHECK (("user_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Users manage own preferences" ON "public"."user_preferences" USING (("user_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id"))) WITH CHECK (("user_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Users manage own read state" ON "public"."channel_reads" USING (("user_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id"))) WITH CHECK (("user_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Users manage own tabs" ON "public"."user_server_tabs" USING (("user_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id"))) WITH CHECK (("user_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Users manage own voice settings" ON "public"."user_voice_settings" USING (("user_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id"))) WITH CHECK (("user_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Users read own auth data" ON "public"."user_auth" FOR SELECT USING (("user_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Users remove own DM reactions" ON "public"."dm_reactions" FOR DELETE USING (("user_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Users remove own reactions" ON "public"."reactions" FOR DELETE USING (("user_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Users see own friendships" ON "public"."friendships" FOR SELECT USING ((("requester_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")) OR ("addressee_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id"))));



CREATE POLICY "Users send messages as themselves only" ON "public"."messages" FOR INSERT WITH CHECK ((("user_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")) AND (( SELECT "public"."requesting_user_id"() AS "requesting_user_id") IS NOT NULL) AND ("public"."is_maintenance_active"() = false)));



CREATE POLICY "Users send own friend requests" ON "public"."friendships" FOR INSERT WITH CHECK (("requester_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Users update own auth data" ON "public"."user_auth" FOR UPDATE USING (("user_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Users update own non-role data" ON "public"."server_members" FOR UPDATE USING (("user_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



CREATE POLICY "Users update own participant record" ON "public"."dm_participants" FOR UPDATE USING (("user_id" = ( SELECT "public"."requesting_user_id"() AS "requesting_user_id")));



ALTER TABLE "public"."announcement_comment_reactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."announcement_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."app_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."badges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."category_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."channel_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."channel_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."channel_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."channel_reads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."channel_user_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."channels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."declined_friend_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."direct_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dm_attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dm_conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dm_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dm_reactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."friendships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "global_maintenance_policy" ON "public"."servers" AS RESTRICTIVE FOR SELECT USING ((NOT "public"."is_maintenance_active"()));



CREATE POLICY "invite_maintenance_shield" ON "public"."server_invites" AS RESTRICTIVE FOR SELECT TO "authenticated", "anon" USING ((NOT "public"."is_maintenance_active"()));



ALTER TABLE "public"."media_comment_reactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."media_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."media_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mentions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."message_attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."poll_votes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."polls" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."role_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."server_emojis" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."server_invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."server_member_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."server_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."server_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."servers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."thread_attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."thread_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."thread_reactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."threads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_auth" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_badges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_devices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_server_folders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_server_tabs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_voice_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."channel_reads";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."direct_messages" ("id", "conversation_id", "sender_id", "created_at");



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."reactions";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."users";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";


















































































































































































































GRANT ALL ON FUNCTION "public"."accept_friend_request"("_friendship_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_channel_member"("_channel_id" "uuid", "_target_user_id" "uuid", "_added_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_dm_reaction"("_message_id" "uuid", "_user_id" "uuid", "_emoji" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_group_dm_members"("_conversation_id" "uuid", "_user_id" "uuid", "_new_member_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."add_reaction"("_message_id" "uuid", "_user_id" "uuid", "_emoji" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."assert_request_user"("_expected_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_role_to_member"("_user_id" "uuid", "_member_id" "uuid", "_role_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_task_users"("_task_id" "uuid", "_user_id" "uuid", "_assignee_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."ban_member"("_server_id" "uuid", "_user_id" "uuid", "_target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."block_user"("_user_id" "uuid", "_blocked_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access_channel"("_channel_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."change_member_role"("_server_id" "uuid", "_user_id" "uuid", "_target_user_id" "uuid", "_new_role" "public"."server_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_e2e_status"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_server_membership"("_server_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_user_permission"("_user_id" "uuid", "_channel_id" "uuid", "_permission" "public"."permission_type") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_user_server_permission"("_user_id" "uuid", "_server_id" "uuid", "_permission" "public"."permission_type") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_username_available"("_username" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."close_expired_polls"() TO "service_role";



GRANT ALL ON FUNCTION "public"."close_expired_polls"("_channel_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."close_poll"("_poll_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."count_available_prekeys"("_user_id" "uuid", "_device_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_category"("_server_id" "uuid", "_user_id" "uuid", "_name" "text", "_position" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_channel"("_server_id" "uuid", "_name" "text", "_type" "text", "_user_id" "uuid", "_category_id" "uuid", "_position" integer, "_icon" "text", "_is_private" boolean, "_ghost_mode" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_group_dm"("_creator_id" "uuid", "_participant_ids" "uuid"[], "_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_notification"("_user_id" "uuid", "_type" "public"."notification_type", "_title" "text", "_body" "text", "_link" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_server_invite"("_server_id" "uuid", "_user_id" "uuid", "_expires_in_seconds" integer, "_max_uses" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_server_role"("_server_id" "uuid", "_user_id" "uuid", "_name" "text", "_color" "text", "_icon" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_server_with_owner"("_name" "text", "_owner_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_task"("_channel_id" "uuid", "_user_id" "uuid", "_title" "text", "_description" "text", "_priority" "text", "_due_date" timestamp with time zone, "_assignee_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_task_comment"("_task_id" "uuid", "_user_id" "uuid", "_content" "text", "_reply_to_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_thread"("_message_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."debug_channel_permissions"("_channel_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."debug_request_headers"() TO "service_role";



GRANT ALL ON FUNCTION "public"."debug_server_system_messages"("_server_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."debug_user_permission"("_user_id" "uuid", "_channel_id" "uuid", "_permission" "public"."permission_type") TO "service_role";



GRANT ALL ON FUNCTION "public"."decline_friend_request"("_friendship_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_announcement_comment"("_comment_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_category"("_category_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_category_permission"("_permission_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_channel"("_channel_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_channel_permission"("_permission_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_dm"("_message_id" "uuid", "_sender_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_forum_thread"("_thread_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_media_comment"("_comment_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_media_item"("_item_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_message"("_message_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_old_declined_requests"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_role_permission"("_permission_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_server"("_server_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_server_emoji"("_emoji_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_server_role"("_role_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_task"("_task_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_task_comment"("_comment_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_thread_message"("_message_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_user_account"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."edit_announcement_comment"("_comment_id" "uuid", "_user_id" "uuid", "_content" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."edit_dm"("_message_id" "uuid", "_sender_id" "uuid", "_content" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."edit_media_comment"("_comment_id" "uuid", "_user_id" "uuid", "_content" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."edit_message"("_message_id" "uuid", "_user_id" "uuid", "_content" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_server_emoji_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fetch_key_backup"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fetch_prekey_bundle"("_target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_invite_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_all_channel_unread_counts"("_user_id" "uuid", "_channel_ids" "uuid"[], "_blocked_user_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_banned_members"("_server_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_blocked_user_ids_for_visibility"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_blocked_users"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_channel_members"("_channel_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_channel_messages"("_channel_id" "uuid", "_user_id" "uuid", "_limit" integer, "_before_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_channel_permissions"("_channel_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_channel_server_id"("_channel_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_channel_tasks"("_channel_id" "uuid", "_user_id" "uuid", "_status_filter" "text", "_sort_by" "text", "_sort_order" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_deletion_preview"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_dm_conversation_id"("_message_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_dm_messages"("_conversation_id" "uuid", "_user_id" "uuid", "_limit" integer, "_before_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_dm_unread_counts"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_invite_details_by_code"("_invite_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_maintenance_mode"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_outgoing_friend_requests"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pending_friend_requests"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_request_user_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_role_permissions"("_server_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_server_by_invite_code"("_invite_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_server_categories"("_server_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_server_channels"("_server_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_server_members"("_server_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_server_roles"("_server_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_task_comments"("_task_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_thread_by_message_id"("_message_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_thread_info"("_message_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_thread_message_count"("_message_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_thread_messages"("_thread_id" "uuid", "_limit" integer, "_before" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_thread_summaries"("_thread_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_by_id"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_dm_conversations"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_friends"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_poll_votes"("_poll_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_server_folders"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_server_tabs"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_servers"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_voice_settings"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_message_mentions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_mention_ping"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_channel_access"("_channel_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_private_channel_access"("_channel_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_mention_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_announcement_comment"("_message_id" "uuid", "_user_id" "uuid", "_content" "text", "_reply_to_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_media_comment"("_media_id" "uuid", "_user_id" "uuid", "_content" "text", "_reply_to_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_media_item"("_channel_id" "uuid", "_user_id" "uuid", "_title" "text", "_description" "text", "_media_url" "text", "_media_type" "text", "_thumbnail_url" "text", "_youtube_video_id" "text", "_width" integer, "_height" integer, "_file_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_mentions"("_user_id" "uuid", "_mentions" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_category_server_member"("_category_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_channel_server_member"("_channel_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_dm_message_participant"("_message_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_dm_participant"("_conversation_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_friend_with"("_user_id" "uuid", "_other_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_maintenance_active"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_media_channel_member"("_media_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_member_in_same_server"("_member_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_message_channel_member"("_message_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_server_member"("_server_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_thread_channel_member"("_thread_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_username_blocked"("username" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."join_server_by_invite"("_invite_code" "text", "_user_id" "uuid", "_join_source" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."kick_group_dm_member"("_conversation_id" "uuid", "_kicker_id" "uuid", "_target_user_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."kick_group_dm_member"("_conversation_id" "uuid", "_kicker_id" "uuid", "_target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."kick_group_dm_member"("_conversation_id" "uuid", "_kicker_id" "uuid", "_target_user_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."kick_member"("_server_id" "uuid", "_user_id" "uuid", "_target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."leave_group_dm"("_conversation_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."leave_server"("_user_id" "uuid", "_server_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."list_server_invites"("_server_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."login_user"("_key_hash" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."login_user"("_key_hash" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."login_user"("_key_hash" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."mark_channel_read"("_channel_id" "uuid", "_user_id" "uuid", "_last_read_message_id" "uuid", "_last_read_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_channels_read"("_channel_ids" "uuid"[], "_user_id" "uuid", "_last_read_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_dm_read"("_conversation_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."move_channel_to_category"("_channel_id" "uuid", "_server_id" "uuid", "_category_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mute_member"("_server_id" "uuid", "_user_id" "uuid", "_target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."open_dm_conversation"("_user_id" "uuid", "_other_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."pin_message"("_message_id" "uuid", "_user_id" "uuid", "_pinned" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."post_system_message"("_channel_id" "uuid", "_user_id" "uuid", "_content" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."publish_e2e_key_bundle"("_user_id" "uuid", "_public_key" "text", "_key_fingerprint" character varying, "_registration_id" integer, "_encrypted_private_key" "text", "_backup_iv" "text", "_backup_salt" "text", "_device_id" integer, "_device_name" character varying, "_prekeys" "jsonb", "_signed_prekey_id" integer, "_signed_prekey_public" "text", "_signed_prekey_signature" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."recompute_poll_results"("_poll_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."regenerate_invite_code"("_server_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."register_user"("_username" "text", "_key_hash" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."register_user"("_username" "text", "_key_hash" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."register_user"("_username" "text", "_key_hash" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."register_user"("_username" "text", "_key_hash" "text", "_banner_color" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."register_user"("_username" "text", "_key_hash" "text", "_banner_color" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."register_user"("_username" "text", "_key_hash" "text", "_banner_color" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."remove_channel_member"("_channel_id" "uuid", "_target_user_id" "uuid", "_removed_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_dm_reaction"("_message_id" "uuid", "_user_id" "uuid", "_emoji" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_friend"("_friendship_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_reaction"("_message_id" "uuid", "_user_id" "uuid", "_emoji" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_role_from_member"("_user_id" "uuid", "_member_id" "uuid", "_role_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rename_server_emoji"("_emoji_id" "uuid", "_user_id" "uuid", "_new_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."reorder_categories"("_server_id" "uuid", "_user_id" "uuid", "_category_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."reorder_channels"("_server_id" "uuid", "_user_id" "uuid", "_channel_id" "uuid", "_new_category_id" "uuid", "_new_position" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."reorder_server_roles"("_server_id" "uuid", "_user_id" "uuid", "_ordered_role_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."reorder_user_servers"("_user_id" "uuid", "_server_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."replenish_prekeys"("_user_id" "uuid", "_device_id" integer, "_prekeys" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."requesting_user_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_mention_count_on_read"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_user_secret_key"("_user_id" "uuid", "_new_key_hash" character) TO "service_role";



GRANT ALL ON FUNCTION "public"."revoke_server_invite"("_invite_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."save_user_server_folders"("_user_id" "uuid", "_folder_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."save_user_server_tabs"("_user_id" "uuid", "_tab_data" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_messages"("search_query" "text", "server_filter" "uuid", "channel_filter" "uuid", "user_filter" "uuid", "result_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."send_dm"("_conversation_id" "uuid", "_sender_id" "uuid", "_content" "text", "_reply_to_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."send_friend_request"("_requester_id" "uuid", "_addressee_username" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."send_message"("_channel_id" "uuid", "_user_id" "uuid", "_content" "text", "_reply_to_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."send_poll"("_channel_id" "uuid", "_user_id" "uuid", "_question" "text", "_options" "text"[], "_allow_multiple" boolean, "_duration_seconds" integer, "_reply_to_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."send_thread_message"("_thread_id" "uuid", "_user_id" "uuid", "_content" "text", "_reply_to_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_category_permission"("_category_id" "uuid", "_user_id" "uuid", "_permission" "text", "_allowed" boolean, "_role_id" "uuid", "_role_name" "text", "_target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_channel_permission"("_channel_id" "uuid", "_user_id" "uuid", "_permission" "public"."permission_type", "_allowed" boolean, "_role_id" "uuid", "_role_name" "text", "_target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_message_embed_hidden"("_message_id" "uuid", "_user_id" "uuid", "_hidden" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_reaction_channel_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_role_permission"("_server_id" "uuid", "_user_id" "uuid", "_permission" "public"."permission_type", "_role_id" "uuid", "_role_name" "text", "_allowed" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."shares_dm_with"("_user_id" "uuid", "_other_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."shares_server_with"("_user_id" "uuid", "_other_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_category_permissions_to_channels"("_category_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."test_channel_permission"("_channel_id" "uuid", "_user_id" "uuid", "_permission" "public"."permission_type") TO "service_role";



GRANT ALL ON FUNCTION "public"."toggle_announcement_comment_reaction"("_comment_id" "uuid", "_user_id" "uuid", "_emoji" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."toggle_media_comment_reaction"("_comment_id" "uuid", "_user_id" "uuid", "_emoji" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."toggle_mute_member"("_server_id" "uuid", "_user_id" "uuid", "_target_user_id" "uuid", "_muted" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."toggle_pin_message"("_message_id" "uuid", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."transfer_ownership"("_server_id" "uuid", "_current_owner_id" "uuid", "_new_owner_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_dm_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_mention_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_task_assignment_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_task_comment_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_task_status_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."unassign_task_users"("_task_id" "uuid", "_user_id" "uuid", "_assignee_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."unban_member"("_server_id" "uuid", "_user_id" "uuid", "_target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."unblock_user"("_user_id" "uuid", "_blocked_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."unmute_member"("_server_id" "uuid", "_user_id" "uuid", "_target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_category"("_category_id" "uuid", "_user_id" "uuid", "_updates" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_channel"("_channel_id" "uuid", "_user_id" "uuid", "_updates" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_group_dm_name"("_conversation_id" "uuid", "_user_id" "uuid", "_new_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_member_nickname"("_server_id" "uuid", "_user_id" "uuid", "_target_user_id" "uuid", "_nickname" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_own_profile"("_display_name" character varying, "_avatar_url" "text", "_bio" "text", "_status" "public"."user_status", "_custom_status" character varying, "_banner_color" character, "_pronouns" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_server"("_server_id" "uuid", "_user_id" "uuid", "_updates" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_server_role"("_role_id" "uuid", "_user_id" "uuid", "_name" "text", "_color" "text", "_icon" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_task"("_task_id" "uuid", "_user_id" "uuid", "_title" "text", "_description" "text", "_priority" "text", "_status" "text", "_due_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_task_comment"("_comment_id" "uuid", "_user_id" "uuid", "_content" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_task_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_last_seen"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_preferences_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_presence"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_profile"("_user_id" "uuid", "_updates" json) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_status"("_user_id" "uuid", "_status" "public"."user_status") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_voice_settings_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."upload_server_emoji"("_server_id" "uuid", "_user_id" "uuid", "_name" "text", "_file_path" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_channel_read"("_user_id" "uuid", "_channel_id" "uuid", "_last_read_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_user_preferences"("_user_id" "uuid", "_prefs" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_user_voice_settings"("p_user_id" "uuid", "p_settings" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_username_on_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_request_identity"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."vote_poll"("_poll_id" "uuid", "_user_id" "uuid", "_option_indexes" integer[]) TO "service_role";
























GRANT ALL ON TABLE "public"."announcement_comment_reactions" TO "anon";
GRANT ALL ON TABLE "public"."announcement_comment_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."announcement_comment_reactions" TO "service_role";



GRANT ALL ON TABLE "public"."announcement_comments" TO "anon";
GRANT ALL ON TABLE "public"."announcement_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."announcement_comments" TO "service_role";



GRANT ALL ON TABLE "public"."app_config" TO "anon";
GRANT ALL ON TABLE "public"."app_config" TO "authenticated";
GRANT ALL ON TABLE "public"."app_config" TO "service_role";



GRANT ALL ON TABLE "public"."badges" TO "anon";
GRANT ALL ON TABLE "public"."badges" TO "authenticated";
GRANT ALL ON TABLE "public"."badges" TO "service_role";



GRANT ALL ON TABLE "public"."category_permissions" TO "anon";
GRANT ALL ON TABLE "public"."category_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."category_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."channel_categories" TO "anon";
GRANT ALL ON TABLE "public"."channel_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."channel_categories" TO "service_role";



GRANT ALL ON TABLE "public"."channel_members" TO "anon";
GRANT ALL ON TABLE "public"."channel_members" TO "authenticated";
GRANT ALL ON TABLE "public"."channel_members" TO "service_role";



GRANT ALL ON TABLE "public"."channel_permissions" TO "anon";
GRANT ALL ON TABLE "public"."channel_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."channel_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."channel_reads" TO "anon";
GRANT ALL ON TABLE "public"."channel_reads" TO "authenticated";
GRANT ALL ON TABLE "public"."channel_reads" TO "service_role";



GRANT ALL ON TABLE "public"."channel_user_settings" TO "anon";
GRANT ALL ON TABLE "public"."channel_user_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."channel_user_settings" TO "service_role";



GRANT ALL ON TABLE "public"."channels" TO "anon";
GRANT ALL ON TABLE "public"."channels" TO "authenticated";
GRANT ALL ON TABLE "public"."channels" TO "service_role";



GRANT ALL ON TABLE "public"."declined_friend_requests" TO "anon";
GRANT ALL ON TABLE "public"."declined_friend_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."declined_friend_requests" TO "service_role";



GRANT ALL ON TABLE "public"."direct_messages" TO "anon";
GRANT ALL ON TABLE "public"."direct_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."direct_messages" TO "service_role";



GRANT ALL ON TABLE "public"."dm_attachments" TO "anon";
GRANT ALL ON TABLE "public"."dm_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."dm_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."dm_conversations" TO "anon";
GRANT ALL ON TABLE "public"."dm_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."dm_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."dm_participants" TO "anon";
GRANT ALL ON TABLE "public"."dm_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."dm_participants" TO "service_role";



GRANT ALL ON TABLE "public"."dm_reactions" TO "anon";
GRANT ALL ON TABLE "public"."dm_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."dm_reactions" TO "service_role";



GRANT ALL ON TABLE "public"."friendships" TO "anon";
GRANT ALL ON TABLE "public"."friendships" TO "authenticated";
GRANT ALL ON TABLE "public"."friendships" TO "service_role";



GRANT ALL ON TABLE "public"."media_comment_reactions" TO "anon";
GRANT ALL ON TABLE "public"."media_comment_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."media_comment_reactions" TO "service_role";



GRANT ALL ON TABLE "public"."media_comments" TO "anon";
GRANT ALL ON TABLE "public"."media_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."media_comments" TO "service_role";



GRANT ALL ON TABLE "public"."media_items" TO "anon";
GRANT ALL ON TABLE "public"."media_items" TO "authenticated";
GRANT ALL ON TABLE "public"."media_items" TO "service_role";



GRANT ALL ON TABLE "public"."mentions" TO "anon";
GRANT ALL ON TABLE "public"."mentions" TO "authenticated";
GRANT ALL ON TABLE "public"."mentions" TO "service_role";



GRANT ALL ON TABLE "public"."message_attachments" TO "anon";
GRANT ALL ON TABLE "public"."message_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."message_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."poll_votes" TO "anon";
GRANT ALL ON TABLE "public"."poll_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."poll_votes" TO "service_role";



GRANT ALL ON TABLE "public"."polls" TO "anon";
GRANT ALL ON TABLE "public"."polls" TO "authenticated";
GRANT ALL ON TABLE "public"."polls" TO "service_role";



GRANT ALL ON TABLE "public"."reactions" TO "anon";
GRANT ALL ON TABLE "public"."reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."reactions" TO "service_role";



GRANT ALL ON TABLE "public"."role_permissions" TO "anon";
GRANT ALL ON TABLE "public"."role_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."role_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."server_emojis" TO "anon";
GRANT ALL ON TABLE "public"."server_emojis" TO "authenticated";
GRANT ALL ON TABLE "public"."server_emojis" TO "service_role";



GRANT ALL ON TABLE "public"."server_invites" TO "anon";
GRANT ALL ON TABLE "public"."server_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."server_invites" TO "service_role";



GRANT ALL ON TABLE "public"."server_member_roles" TO "anon";
GRANT ALL ON TABLE "public"."server_member_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."server_member_roles" TO "service_role";



GRANT ALL ON TABLE "public"."server_members" TO "anon";
GRANT ALL ON TABLE "public"."server_members" TO "authenticated";
GRANT ALL ON TABLE "public"."server_members" TO "service_role";



GRANT ALL ON TABLE "public"."server_roles" TO "anon";
GRANT ALL ON TABLE "public"."server_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."server_roles" TO "service_role";



GRANT ALL ON TABLE "public"."servers" TO "anon";
GRANT ALL ON TABLE "public"."servers" TO "authenticated";
GRANT ALL ON TABLE "public"."servers" TO "service_role";



GRANT ALL ON TABLE "public"."thread_attachments" TO "anon";
GRANT ALL ON TABLE "public"."thread_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."thread_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."thread_messages" TO "anon";
GRANT ALL ON TABLE "public"."thread_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."thread_messages" TO "service_role";



GRANT ALL ON TABLE "public"."thread_reactions" TO "anon";
GRANT ALL ON TABLE "public"."thread_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."thread_reactions" TO "service_role";



GRANT ALL ON TABLE "public"."threads" TO "anon";
GRANT ALL ON TABLE "public"."threads" TO "authenticated";
GRANT ALL ON TABLE "public"."threads" TO "service_role";



GRANT ALL ON TABLE "public"."user_auth" TO "anon";
GRANT ALL ON TABLE "public"."user_auth" TO "authenticated";
GRANT ALL ON TABLE "public"."user_auth" TO "service_role";



GRANT ALL ON TABLE "public"."user_badges" TO "anon";
GRANT ALL ON TABLE "public"."user_badges" TO "authenticated";
GRANT ALL ON TABLE "public"."user_badges" TO "service_role";



GRANT ALL ON TABLE "public"."user_devices" TO "anon";
GRANT ALL ON TABLE "public"."user_devices" TO "authenticated";
GRANT ALL ON TABLE "public"."user_devices" TO "service_role";



GRANT ALL ON TABLE "public"."user_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."user_server_folders" TO "anon";
GRANT ALL ON TABLE "public"."user_server_folders" TO "authenticated";
GRANT ALL ON TABLE "public"."user_server_folders" TO "service_role";



GRANT ALL ON TABLE "public"."user_server_tabs" TO "anon";
GRANT ALL ON TABLE "public"."user_server_tabs" TO "authenticated";
GRANT ALL ON TABLE "public"."user_server_tabs" TO "service_role";



GRANT ALL ON TABLE "public"."user_voice_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_voice_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_voice_settings" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."users_public" TO "anon";
GRANT ALL ON TABLE "public"."users_public" TO "authenticated";
GRANT ALL ON TABLE "public"."users_public" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

create extension if not exists "pg_net" with schema "public";


  create policy "Attachment Access"
  on "storage"."objects"
  as permissive
  for select
  to public
using (((bucket_id = 'attachments'::text) AND ((EXISTS ( SELECT 1
   FROM public.dm_participants
  WHERE ((dm_participants.user_id = auth.uid()) AND ((dm_participants.conversation_id)::text = (storage.foldername(objects.name))[1])))) OR (EXISTS ( SELECT 1
   FROM public.server_members
  WHERE ((server_members.user_id = auth.uid()) AND ((server_members.server_id)::text = (storage.foldername(objects.name))[1])))))));



  create policy "Attachments are publicly accessible"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using ((bucket_id = 'attachments'::text));



  create policy "Avatar Upload"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "Avatar View"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'avatars'::text));



  create policy "Avatar images are publicly accessible"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using ((bucket_id = 'avatars'::text));



  create policy "Media files follow channel visibility"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'media'::text) AND (EXISTS ( SELECT 1
   FROM (public.media_items m
     JOIN public.channels c ON ((m.channel_id = c.id)))
  WHERE (objects.name ~~ ('%'::text || m.media_url))))));



  create policy "Only DM participants can access files"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'attachments'::text) AND (EXISTS ( SELECT 1
   FROM (public.dm_attachments a
     JOIN public.dm_participants p ON ((a.message_id = p.conversation_id)))
  WHERE ((objects.name ~~ ('%'::text || a.file_name)) AND (p.user_id = auth.uid()))))));



  create policy "Only owners can upload/delete their assets"
  on "storage"."objects"
  as permissive
  for all
  to authenticated
using (((bucket_id = 'profiles'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)))
with check (((bucket_id = 'profiles'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "Public can view profiles"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'profiles'::text));



  create policy "Server Icon Management"
  on "storage"."objects"
  as permissive
  for all
  to public
using (((bucket_id = 'server-icons'::text) AND (EXISTS ( SELECT 1
   FROM public.servers
  WHERE ((servers.owner_id = auth.uid()) AND ((servers.id)::text = (storage.foldername((servers.name)::text))[1]))))));



  create policy "Server emojis are publicly accessible"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using ((bucket_id = 'server-emojis'::text));



  create policy "Server icons are publicly accessible"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using ((bucket_id = 'server-icons'::text));



