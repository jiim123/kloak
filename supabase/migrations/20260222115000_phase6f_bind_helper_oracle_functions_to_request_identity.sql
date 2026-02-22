-- Phase 6F:
-- Reduce helper-RPC oracle probing by binding identity-bearing helper inputs
-- to the current request identity. On mismatch we return false (not exception)
-- to preserve policy evaluation behavior.

CREATE OR REPLACE FUNCTION public.is_server_member(_server_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    _user_id IS NOT NULL
    AND public.verify_request_identity(_user_id)
    AND EXISTS (
      SELECT 1
      FROM public.server_members sm
      WHERE sm.server_id = _server_id
        AND sm.user_id = _user_id
        AND COALESCE(sm.is_banned, false) = false
    )
$function$;

CREATE OR REPLACE FUNCTION public.is_dm_participant(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    _user_id IS NOT NULL
    AND public.verify_request_identity(_user_id)
    AND EXISTS (
      SELECT 1
      FROM public.dm_participants dp
      WHERE dp.conversation_id = _conversation_id
        AND dp.user_id = _user_id
    )
$function$;

CREATE OR REPLACE FUNCTION public.is_channel_server_member(_channel_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    _user_id IS NOT NULL
    AND public.verify_request_identity(_user_id)
    AND EXISTS (
      SELECT 1
      FROM public.channels c
      JOIN public.server_members sm ON sm.server_id = c.server_id
      WHERE c.id = _channel_id
        AND sm.user_id = _user_id
        AND COALESCE(sm.is_banned, false) = false
    )
$function$;

CREATE OR REPLACE FUNCTION public.has_private_channel_access(_channel_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT public.can_access_channel(_channel_id, _user_id)
$function$;

CREATE OR REPLACE FUNCTION public.can_access_channel(_channel_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _channel RECORD;
BEGIN
  IF _user_id IS NULL OR NOT public.verify_request_identity(_user_id) THEN
    RETURN false;
  END IF;

  SELECT id, server_id, is_private
  INTO _channel
  FROM public.channels
  WHERE id = _channel_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF NOT _channel.is_private THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.server_members sm
      WHERE sm.server_id = _channel.server_id
        AND sm.user_id = _user_id
        AND COALESCE(sm.is_banned, false) = false
    );
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.channel_members cm
    WHERE cm.channel_id = _channel_id
      AND cm.user_id = _user_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_view_user(_target_user_id uuid, _requesting_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    _requesting_user_id IS NOT NULL
    AND public.verify_request_identity(_requesting_user_id)
    AND (
      _target_user_id = _requesting_user_id
      OR EXISTS (
        SELECT 1
        FROM public.server_members sm_target
        JOIN public.server_members sm_requester
          ON sm_requester.server_id = sm_target.server_id
        WHERE sm_target.user_id = _target_user_id
          AND sm_requester.user_id = _requesting_user_id
          AND COALESCE(sm_target.is_banned, false) = false
          AND COALESCE(sm_requester.is_banned, false) = false
      )
      OR EXISTS (
        SELECT 1
        FROM public.friendships f
        WHERE (
          (f.requester_id = _requesting_user_id AND f.addressee_id = _target_user_id)
          OR (f.requester_id = _target_user_id AND f.addressee_id = _requesting_user_id)
        )
          AND f.status = 'accepted'
      )
      OR EXISTS (
        SELECT 1
        FROM public.dm_participants dp_target
        JOIN public.dm_participants dp_requester
          ON dp_requester.conversation_id = dp_target.conversation_id
        WHERE dp_target.user_id = _target_user_id
          AND dp_requester.user_id = _requesting_user_id
      )
    )
$function$;

CREATE OR REPLACE FUNCTION public.check_user_server_permission(
  _user_id uuid,
  _server_id uuid,
  _permission public.permission_type
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _is_owner boolean;
  _everyone_role_id uuid;
  _member_id uuid;
  _result boolean;
BEGIN
  IF _user_id IS NULL OR NOT public.verify_request_identity(_user_id) THEN
    RETURN false;
  END IF;

  SELECT (owner_id = _user_id) INTO _is_owner
  FROM public.servers
  WHERE id = _server_id;

  IF _is_owner THEN
    RETURN true;
  END IF;

  SELECT id INTO _member_id
  FROM public.server_members
  WHERE server_id = _server_id
    AND user_id = _user_id
    AND COALESCE(is_banned, false) = false;

  IF _member_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT id INTO _everyone_role_id
  FROM public.server_roles
  WHERE server_id = _server_id
    AND name = '@everyone';

  SELECT CASE
    WHEN bool_or(allowed = false) THEN false
    WHEN bool_or(allowed = true) THEN true
    ELSE NULL
  END INTO _result
  FROM public.role_permissions rp
  JOIN public.server_member_roles smr
    ON smr.role_id = rp.role_id
   AND smr.member_id = _member_id
  WHERE rp.permission = _permission;

  IF _result IS NOT NULL THEN
    RETURN _result;
  END IF;

  IF _everyone_role_id IS NOT NULL THEN
    SELECT allowed INTO _result
    FROM public.role_permissions
    WHERE role_id = _everyone_role_id
      AND permission = _permission
    LIMIT 1;

    IF _result IS NOT NULL THEN
      RETURN _result;
    END IF;
  END IF;

  RETURN false;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_user_permission(
  _user_id uuid,
  _channel_id uuid,
  _permission public.permission_type
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  channel_server_id uuid;
  user_base_role public.server_role;
  user_custom_role_ids uuid[];
  user_override_result boolean;
  channel_result boolean;
  role_result boolean;
BEGIN
  IF _user_id IS NULL OR NOT public.verify_request_identity(_user_id) THEN
    RETURN false;
  END IF;

  SELECT server_id INTO channel_server_id FROM public.channels WHERE id = _channel_id;
  IF channel_server_id IS NULL THEN RETURN false; END IF;

  SELECT sm.role INTO user_base_role
  FROM public.server_members sm
  WHERE sm.server_id = channel_server_id
    AND sm.user_id = _user_id
    AND sm.is_banned = false;

  IF user_base_role IS NULL THEN RETURN false; END IF;
  IF user_base_role = 'owner' THEN RETURN true; END IF;

  SELECT COALESCE(ARRAY_AGG(DISTINCT smr.role_id) FILTER (WHERE smr.role_id IS NOT NULL), ARRAY[]::uuid[])
  INTO user_custom_role_ids
  FROM public.server_member_roles smr
  JOIN public.server_members sm ON sm.id = smr.member_id
  WHERE sm.user_id = _user_id
    AND sm.server_id = channel_server_id;

  SELECT cp.allowed INTO user_override_result
  FROM public.channel_permissions cp
  WHERE cp.channel_id = _channel_id
    AND cp.permission = _permission
    AND cp.user_id = _user_id
    AND cp.role_id IS NULL
    AND cp.role_name IS NULL
  LIMIT 1;

  IF user_override_result IS NOT NULL THEN
    RETURN user_override_result;
  END IF;

  SELECT cp.allowed INTO channel_result
  FROM public.channel_permissions cp
  WHERE cp.channel_id = _channel_id
    AND cp.permission = _permission
    AND cp.user_id IS NULL
    AND (
      (cp.role_id = ANY(user_custom_role_ids)) OR
      (cp.role_name = user_base_role AND cp.role_id IS NULL)
    )
  ORDER BY
    CASE WHEN cp.role_id IS NOT NULL THEN 1 ELSE 2 END,
    CASE WHEN cp.allowed = false THEN 1 ELSE 2 END,
    cp.created_at DESC
  LIMIT 1;

  IF channel_result IS NOT NULL THEN
    RETURN channel_result;
  END IF;

  SELECT rp.allowed INTO role_result
  FROM public.role_permissions rp
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

  IF role_result IS NOT NULL THEN
    RETURN role_result;
  END IF;

  CASE _permission
    WHEN 'view_channels' THEN RETURN true;
    WHEN 'read_message_history' THEN RETURN true;
    WHEN 'send_messages' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'attach_files' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'embed_links' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'add_reactions' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'use_external_emojis' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'mention_everyone' THEN RETURN user_base_role IN ('owner', 'admin');
    WHEN 'mention_roles' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'manage_messages' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'pin_messages' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'manage_channels' THEN RETURN user_base_role IN ('owner', 'admin');
    WHEN 'manage_threads' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'kick_members' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'ban_members' THEN RETURN user_base_role IN ('owner', 'admin');
    WHEN 'mute_members' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'deafen_members' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'move_members' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'manage_nicknames' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'change_nickname' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'manage_roles' THEN RETURN user_base_role IN ('owner', 'admin');
    WHEN 'manage_server' THEN RETURN user_base_role = 'owner';
    WHEN 'manage_invites' THEN RETURN user_base_role IN ('owner', 'admin');
    WHEN 'create_instant_invite' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'manage_webhooks' THEN RETURN user_base_role IN ('owner', 'admin');
    WHEN 'transfer_ownership' THEN RETURN user_base_role = 'owner';
    WHEN 'manage_emojis' THEN RETURN user_base_role IN ('owner', 'admin');
    WHEN 'connect' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'speak' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'use_voice_activation' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'use_application_commands' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    ELSE RETURN false;
  END CASE;
END;
$function$;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
