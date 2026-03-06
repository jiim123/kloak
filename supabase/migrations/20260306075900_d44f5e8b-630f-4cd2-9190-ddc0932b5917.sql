-- Add task permission defaults to check_user_permission
CREATE OR REPLACE FUNCTION public.check_user_permission(_user_id uuid, _channel_id uuid, _permission permission_type)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  channel_server_id uuid;
  user_base_role public.server_role;
  user_custom_role_ids uuid[];
  _everyone_role_id uuid;
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

  SELECT id INTO _everyone_role_id
  FROM public.server_roles
  WHERE server_id = channel_server_id AND name = '@everyone';

  -- Step 1: User-specific channel override
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

  -- Step 2: Custom role channel overrides (DENY wins)
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

  -- Step 3: @everyone role channel overrides
  IF _everyone_role_id IS NOT NULL THEN
    SELECT cp.allowed INTO channel_result
    FROM public.channel_permissions cp
    WHERE cp.channel_id = _channel_id
      AND cp.permission = _permission
      AND cp.user_id IS NULL
      AND cp.role_id = _everyone_role_id
    LIMIT 1;

    IF channel_result IS NOT NULL THEN
      RETURN channel_result;
    END IF;
  END IF;

  -- Step 3b: Legacy base role channel overrides
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

  -- Step 4: Custom role server-wide permissions (DENY wins)
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

  -- Step 5: @everyone server-wide role permission
  IF _everyone_role_id IS NOT NULL THEN
    SELECT rp.allowed INTO role_result
    FROM public.role_permissions rp
    WHERE rp.server_id = channel_server_id
      AND rp.permission = _permission
      AND rp.role_id = _everyone_role_id
    LIMIT 1;

    IF role_result IS NOT NULL THEN
      RETURN role_result;
    END IF;
  END IF;

  -- Step 5b: Legacy base role server-wide permissions
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

  -- Step 6: Base role defaults
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
    -- Task permissions
    WHEN 'view_tasks' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'create_tasks' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'edit_own_tasks' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'edit_all_tasks' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'assign_tasks' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'change_task_status' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'delete_tasks' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator');
    ELSE RETURN false;
  END CASE;
END;
$function$;

-- Add task permission defaults to check_user_server_permission
CREATE OR REPLACE FUNCTION public.check_user_server_permission(_user_id uuid, _server_id uuid, _permission permission_type)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _is_owner boolean;
  _everyone_role_id uuid;
  _member_id uuid;
  _user_base_role public.server_role;
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

  SELECT id, role INTO _member_id, _user_base_role
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

  -- 1. Custom role permissions (DENY wins)
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

  -- 2. @everyone role permission
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

  -- 3. Base role defaults
  CASE _permission
    WHEN 'view_channels' THEN RETURN true;
    WHEN 'read_message_history' THEN RETURN true;
    WHEN 'send_messages' THEN RETURN _user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'attach_files' THEN RETURN _user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'embed_links' THEN RETURN _user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'add_reactions' THEN RETURN _user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'use_external_emojis' THEN RETURN _user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'mention_everyone' THEN RETURN _user_base_role IN ('owner', 'admin');
    WHEN 'mention_roles' THEN RETURN _user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'manage_messages' THEN RETURN _user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'pin_messages' THEN RETURN _user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'manage_channels' THEN RETURN _user_base_role IN ('owner', 'admin');
    WHEN 'manage_threads' THEN RETURN _user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'kick_members' THEN RETURN _user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'ban_members' THEN RETURN _user_base_role IN ('owner', 'admin');
    WHEN 'mute_members' THEN RETURN _user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'deafen_members' THEN RETURN _user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'move_members' THEN RETURN _user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'manage_nicknames' THEN RETURN _user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'change_nickname' THEN RETURN _user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'manage_roles' THEN RETURN _user_base_role IN ('owner', 'admin');
    WHEN 'manage_server' THEN RETURN _user_base_role = 'owner';
    WHEN 'manage_invites' THEN RETURN _user_base_role IN ('owner', 'admin');
    WHEN 'create_instant_invite' THEN RETURN _user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'manage_webhooks' THEN RETURN _user_base_role IN ('owner', 'admin');
    WHEN 'transfer_ownership' THEN RETURN _user_base_role = 'owner';
    WHEN 'manage_emojis' THEN RETURN _user_base_role IN ('owner', 'admin');
    WHEN 'connect' THEN RETURN _user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'speak' THEN RETURN _user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'use_voice_activation' THEN RETURN _user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'use_application_commands' THEN RETURN _user_base_role IN ('owner', 'admin', 'moderator', 'member');
    -- Task permissions
    WHEN 'view_tasks' THEN RETURN _user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'create_tasks' THEN RETURN _user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'edit_own_tasks' THEN RETURN _user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'edit_all_tasks' THEN RETURN _user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'assign_tasks' THEN RETURN _user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'change_task_status' THEN RETURN _user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'delete_tasks' THEN RETURN _user_base_role IN ('owner', 'admin', 'moderator');
    ELSE RETURN false;
  END CASE;
END;
$function$;