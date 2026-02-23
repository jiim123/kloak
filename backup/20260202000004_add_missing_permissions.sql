-- Add missing permissions from Discord model
-- This extends the permission system with additional granular controls

-- Add new permissions to the enum
ALTER TYPE public.permission_type ADD VALUE IF NOT EXISTS 'attach_files';
ALTER TYPE public.permission_type ADD VALUE IF NOT EXISTS 'embed_links';
ALTER TYPE public.permission_type ADD VALUE IF NOT EXISTS 'read_message_history';
ALTER TYPE public.permission_type ADD VALUE IF NOT EXISTS 'mention_everyone';
ALTER TYPE public.permission_type ADD VALUE IF NOT EXISTS 'mention_roles';
ALTER TYPE public.permission_type ADD VALUE IF NOT EXISTS 'change_nickname';
ALTER TYPE public.permission_type ADD VALUE IF NOT EXISTS 'use_external_emojis';
ALTER TYPE public.permission_type ADD VALUE IF NOT EXISTS 'manage_webhooks';
ALTER TYPE public.permission_type ADD VALUE IF NOT EXISTS 'manage_threads';
ALTER TYPE public.permission_type ADD VALUE IF NOT EXISTS 'create_instant_invite';

-- Note: Voice channel permissions are added but may not be used until voice channels are implemented
ALTER TYPE public.permission_type ADD VALUE IF NOT EXISTS 'connect';
ALTER TYPE public.permission_type ADD VALUE IF NOT EXISTS 'speak';
ALTER TYPE public.permission_type ADD VALUE IF NOT EXISTS 'use_voice_activation';
ALTER TYPE public.permission_type ADD VALUE IF NOT EXISTS 'deafen_members';
ALTER TYPE public.permission_type ADD VALUE IF NOT EXISTS 'move_members';

-- Note: Application commands permission for future slash commands
ALTER TYPE public.permission_type ADD VALUE IF NOT EXISTS 'use_application_commands';

-- Update check_user_permission to include defaults for new permissions
CREATE OR REPLACE FUNCTION public.check_user_permission(
  _user_id uuid,
  _channel_id uuid,
  _permission permission_type
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  channel_server_id uuid;
  user_base_role server_role;
  user_custom_role_ids uuid[];
  user_override_result boolean;
  channel_result boolean;
  role_result boolean;
BEGIN
  -- 1. Get Context
  SELECT server_id INTO channel_server_id FROM channels WHERE id = _channel_id;
  IF channel_server_id IS NULL THEN RETURN false; END IF;

  SELECT sm.role INTO user_base_role
  FROM server_members sm
  WHERE sm.server_id = channel_server_id AND sm.user_id = _user_id AND sm.is_banned = false;
  
  -- If not a member, no permissions
  IF user_base_role IS NULL THEN RETURN false; END IF;

  -- 2. Owner Override (Step 0)
  IF user_base_role = 'owner' THEN RETURN true; END IF;

  -- 3. Get Custom Roles
  SELECT COALESCE(ARRAY_AGG(DISTINCT smr.role_id) FILTER (WHERE smr.role_id IS NOT NULL), ARRAY[]::uuid[]) 
  INTO user_custom_role_ids
  FROM server_member_roles smr
  JOIN server_members sm ON sm.id = smr.member_id
  WHERE sm.user_id = _user_id AND sm.server_id = channel_server_id;

  -- ========================================================
  -- STEP 0: USER-SPECIFIC OVERRIDES (Highest Priority)
  -- ========================================================
  SELECT cp.allowed INTO user_override_result
  FROM channel_permissions cp
  WHERE cp.channel_id = _channel_id
    AND cp.permission = _permission
    AND cp.user_id = _user_id
    AND cp.role_id IS NULL
    AND cp.role_name IS NULL
  LIMIT 1;

  IF user_override_result IS NOT NULL THEN
    RETURN user_override_result;
  END IF;

  -- ========================================================
  -- STEP 1: CHANNEL ROLE OVERRIDES
  -- ========================================================
  SELECT cp.allowed INTO channel_result
  FROM channel_permissions cp
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

  -- ========================================================
  -- STEP 2: SERVER-WIDE ROLE PERMISSIONS
  -- ========================================================
  SELECT rp.allowed INTO role_result
  FROM role_permissions rp
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

  -- ========================================================
  -- STEP 3: DEFAULT BASE PERMISSIONS (Fallback)
  -- ========================================================
  CASE _permission
    WHEN 'view_channels' THEN RETURN true;
    WHEN 'read_message_history' THEN RETURN true; -- All members can read history if they can view channel
    WHEN 'send_messages' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'attach_files' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'embed_links' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'add_reactions' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'use_external_emojis' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'mention_everyone' THEN RETURN user_base_role IN ('owner', 'admin'); -- Only admins can mention @everyone by default
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
    WHEN 'change_nickname' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member'); -- All members can change own nickname
    WHEN 'manage_roles' THEN RETURN user_base_role IN ('owner', 'admin');
    WHEN 'manage_server' THEN RETURN user_base_role = 'owner';
    WHEN 'manage_invites' THEN RETURN user_base_role IN ('owner', 'admin');
    WHEN 'create_instant_invite' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'manage_webhooks' THEN RETURN user_base_role IN ('owner', 'admin');
    WHEN 'transfer_ownership' THEN RETURN user_base_role = 'owner';
    WHEN 'manage_emojis' THEN RETURN user_base_role IN ('owner', 'admin');
    WHEN 'connect' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member'); -- Voice: all can connect
    WHEN 'speak' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member'); -- Voice: all can speak
    WHEN 'use_voice_activation' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member'); -- Voice: all can use voice activation
    WHEN 'use_application_commands' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member'); -- Future: slash commands
    ELSE RETURN false;
  END CASE;

END;
$$;

-- Update check_user_server_permission with new permissions
CREATE OR REPLACE FUNCTION public.check_user_server_permission(
  _user_id uuid,
  _server_id uuid,
  _permission permission_type
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_base_role server_role;
  user_custom_role_ids uuid[];
  role_result boolean;
BEGIN
  SELECT sm.role INTO user_base_role
  FROM server_members sm
  WHERE sm.server_id = _server_id AND sm.user_id = _user_id AND sm.is_banned = false;
  
  IF user_base_role IS NULL THEN
    RETURN false;
  END IF;
  
  IF user_base_role = 'owner' THEN
    RETURN true;
  END IF;
  
  SELECT COALESCE(ARRAY_AGG(DISTINCT smr.role_id) FILTER (WHERE smr.role_id IS NOT NULL), ARRAY[]::uuid[]) 
  INTO user_custom_role_ids
  FROM server_member_roles smr
  JOIN server_members sm ON sm.id = smr.member_id
  WHERE sm.user_id = _user_id AND sm.server_id = _server_id;

  SELECT rp.allowed INTO role_result
  FROM role_permissions rp
  WHERE rp.server_id = _server_id
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

  -- Default base permissions
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
$$;
