-- Server bot flows are configured by members with manage_webhooks. Once a flow
-- is saved, the bot should be able to perform the supported configured channel
-- actions even when its normal member role has default-deny task/moderation
-- permissions. Keep direct per-bot channel denies effective.

CREATE OR REPLACE FUNCTION public.check_server_bot_channel_permission(
  _bot_user_id uuid,
  _channel_id uuid,
  _permission public.permission_type
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  channel_server_id uuid;
  user_base_role public.server_role;
  user_custom_role_ids uuid[];
  everyone_role_id uuid;
  user_override_result boolean;
  channel_result boolean;
  role_result boolean;
BEGIN
  IF _bot_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = _bot_user_id AND u.is_bot = true
  ) THEN
    RETURN false;
  END IF;

  SELECT server_id INTO channel_server_id
  FROM public.channels
  WHERE id = _channel_id;

  IF channel_server_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT sm.role INTO user_base_role
  FROM public.server_members sm
  WHERE sm.server_id = channel_server_id
    AND sm.user_id = _bot_user_id
    AND COALESCE(sm.is_banned, false) = false
    AND COALESCE(sm.is_muted, false) = false;

  IF user_base_role IS NULL THEN
    RETURN false;
  END IF;

  IF user_base_role = 'owner' THEN
    RETURN true;
  END IF;

  SELECT cp.allowed INTO user_override_result
  FROM public.channel_permissions cp
  WHERE cp.channel_id = _channel_id
    AND cp.permission = _permission
    AND cp.user_id = _bot_user_id
    AND cp.role_id IS NULL
    AND cp.role_name IS NULL
  LIMIT 1;

  IF user_override_result IS NOT NULL THEN
    RETURN user_override_result;
  END IF;

  IF _permission IN (
    'send_messages'::public.permission_type,
    'add_reactions'::public.permission_type,
    'manage_messages'::public.permission_type,
    'view_tasks'::public.permission_type,
    'create_tasks'::public.permission_type
  ) THEN
    RETURN true;
  END IF;

  SELECT COALESCE(ARRAY_AGG(DISTINCT smr.role_id) FILTER (WHERE smr.role_id IS NOT NULL), ARRAY[]::uuid[])
  INTO user_custom_role_ids
  FROM public.server_member_roles smr
  JOIN public.server_members sm ON sm.id = smr.member_id
  WHERE sm.user_id = _bot_user_id
    AND sm.server_id = channel_server_id;

  SELECT id INTO everyone_role_id
  FROM public.server_roles
  WHERE server_id = channel_server_id
    AND name = '@everyone';

  IF array_length(user_custom_role_ids, 1) > 0 THEN
    SELECT CASE
      WHEN bool_or(cp.allowed = false) THEN false
      WHEN bool_or(cp.allowed = true) THEN true
      ELSE NULL
    END INTO channel_result
    FROM public.channel_permissions cp
    WHERE cp.channel_id = _channel_id
      AND cp.permission = _permission
      AND cp.user_id IS NULL
      AND cp.role_id = ANY(user_custom_role_ids);

    IF channel_result IS NOT NULL THEN
      RETURN channel_result;
    END IF;
  END IF;

  IF everyone_role_id IS NOT NULL THEN
    SELECT cp.allowed INTO channel_result
    FROM public.channel_permissions cp
    WHERE cp.channel_id = _channel_id
      AND cp.permission = _permission
      AND cp.user_id IS NULL
      AND cp.role_id = everyone_role_id
    LIMIT 1;

    IF channel_result IS NOT NULL THEN
      RETURN channel_result;
    END IF;
  END IF;

  SELECT cp.allowed INTO channel_result
  FROM public.channel_permissions cp
  WHERE cp.channel_id = _channel_id
    AND cp.permission = _permission
    AND cp.user_id IS NULL
    AND cp.role_name = user_base_role
    AND cp.role_id IS NULL
  LIMIT 1;

  IF channel_result IS NOT NULL THEN
    RETURN channel_result;
  END IF;

  IF array_length(user_custom_role_ids, 1) > 0 THEN
    SELECT CASE
      WHEN bool_or(rp.allowed = false) THEN false
      WHEN bool_or(rp.allowed = true) THEN true
      ELSE NULL
    END INTO role_result
    FROM public.role_permissions rp
    WHERE rp.server_id = channel_server_id
      AND rp.permission = _permission
      AND rp.role_id = ANY(user_custom_role_ids);

    IF role_result IS NOT NULL THEN
      RETURN role_result;
    END IF;
  END IF;

  IF everyone_role_id IS NOT NULL THEN
    SELECT rp.allowed INTO role_result
    FROM public.role_permissions rp
    WHERE rp.server_id = channel_server_id
      AND rp.permission = _permission
      AND rp.role_id = everyone_role_id
    LIMIT 1;

    IF role_result IS NOT NULL THEN
      RETURN role_result;
    END IF;
  END IF;

  SELECT rp.allowed INTO role_result
  FROM public.role_permissions rp
  WHERE rp.server_id = channel_server_id
    AND rp.permission = _permission
    AND rp.role_name = user_base_role
    AND rp.role_id IS NULL
  LIMIT 1;

  IF role_result IS NOT NULL THEN
    RETURN role_result;
  END IF;

  CASE _permission
    WHEN 'view_channels' THEN RETURN true;
    WHEN 'read_message_history' THEN RETURN true;
    WHEN 'attach_files' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'embed_links' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'use_external_emojis' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'mention_everyone' THEN RETURN user_base_role IN ('owner', 'admin');
    WHEN 'mention_roles' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
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

REVOKE EXECUTE ON FUNCTION public.check_server_bot_channel_permission(uuid, uuid, public.permission_type) FROM PUBLIC;
