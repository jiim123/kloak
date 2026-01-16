-- Function to check if a user has a permission in a channel
-- This considers base role, custom roles, and channel overrides
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
  has_base_permission boolean := false;
  has_custom_permission boolean := NULL; -- NULL means no custom role permission set
  channel_override boolean := NULL;
BEGIN
  -- Get channel's server
  SELECT server_id INTO channel_server_id
  FROM channels
  WHERE id = _channel_id;
  
  IF channel_server_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Get user's base role and custom roles
  SELECT sm.role INTO user_base_role
  FROM server_members sm
  WHERE sm.server_id = channel_server_id AND sm.user_id = _user_id AND sm.is_banned = false;
  
  IF user_base_role IS NULL THEN
    RETURN false;
  END IF;
  
  -- Owner always has all permissions
  IF user_base_role = 'owner' THEN
    RETURN true;
  END IF;
  
  -- Get user's custom role IDs
  SELECT ARRAY_AGG(smr.role_id) INTO user_custom_role_ids
  FROM server_member_roles smr
  JOIN server_members sm ON sm.id = smr.member_id
  WHERE sm.user_id = _user_id AND sm.server_id = channel_server_id;
  
  -- Check base role permissions (from enum defaults)
  -- Owner, admin, moderator, member have default permissions
  IF _permission = 'view_channels' THEN
    has_base_permission := true; -- All roles can view
  ELSIF _permission = 'send_messages' THEN
    has_base_permission := user_base_role IN ('owner', 'admin', 'moderator', 'member');
  ELSIF _permission = 'add_reactions' THEN
    has_base_permission := user_base_role IN ('owner', 'admin', 'moderator', 'member');
  ELSIF _permission = 'manage_messages' THEN
    has_base_permission := user_base_role IN ('owner', 'admin', 'moderator');
  ELSIF _permission = 'pin_messages' THEN
    has_base_permission := user_base_role IN ('owner', 'admin', 'moderator');
  ELSIF _permission = 'manage_channels' THEN
    has_base_permission := user_base_role IN ('owner', 'admin');
  ELSIF _permission = 'kick_members' THEN
    has_base_permission := user_base_role IN ('owner', 'admin', 'moderator');
  ELSIF _permission = 'ban_members' THEN
    has_base_permission := user_base_role IN ('owner', 'admin');
  ELSIF _permission = 'mute_members' THEN
    has_base_permission := user_base_role IN ('owner', 'admin', 'moderator');
  ELSIF _permission = 'manage_nicknames' THEN
    has_base_permission := user_base_role IN ('owner', 'admin', 'moderator');
  ELSIF _permission = 'manage_roles' THEN
    has_base_permission := user_base_role IN ('owner', 'admin');
  ELSIF _permission = 'manage_server' THEN
    has_base_permission := user_base_role = 'owner';
  ELSIF _permission = 'manage_invites' THEN
    has_base_permission := user_base_role IN ('owner', 'admin');
  ELSIF _permission = 'transfer_ownership' THEN
    has_base_permission := user_base_role = 'owner';
  END IF;
  
  -- Check custom role permissions from database
  -- First check if any custom role explicitly denies this permission
  IF user_custom_role_ids IS NOT NULL AND array_length(user_custom_role_ids, 1) > 0 THEN
    -- Check for explicit deny
    IF EXISTS (
      SELECT 1 FROM role_permissions rp
      WHERE rp.role_id = ANY(user_custom_role_ids)
        AND rp.permission = _permission
        AND rp.allowed = false
    ) THEN
      has_custom_permission := false;
    -- Check for explicit allow
    ELSIF EXISTS (
      SELECT 1 FROM role_permissions rp
      WHERE rp.role_id = ANY(user_custom_role_ids)
        AND rp.permission = _permission
        AND rp.allowed = true
    ) THEN
      has_custom_permission := true;
    END IF;
  END IF;
  
  -- Check channel-specific overrides (these take precedence over everything)
  SELECT cp.allowed INTO channel_override
  FROM channel_permissions cp
  WHERE cp.channel_id = _channel_id
    AND cp.permission = _permission
    AND (
      (cp.role_name = user_base_role) OR
      (cp.role_id = ANY(user_custom_role_ids))
    )
  ORDER BY 
    CASE WHEN cp.role_id IS NOT NULL THEN 1 ELSE 2 END -- Custom roles first
  LIMIT 1;
  
  -- Channel override takes precedence over everything
  IF channel_override IS NOT NULL THEN
    RETURN channel_override;
  END IF;
  
  -- If custom role has explicit permission setting, use it
  IF has_custom_permission IS NOT NULL THEN
    RETURN has_custom_permission;
  END IF;
  
  -- Fall back to base role permission
  RETURN has_base_permission;
END;
$$;

-- Update send_message to check send_messages permission
CREATE OR REPLACE FUNCTION public.send_message(
  _channel_id uuid,
  _user_id uuid,
  _content text,
  _reply_to_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  channel_server_id uuid;
  channel_is_read_only boolean;
  is_muted boolean;
  user_role server_role;
  new_message_id uuid;
  result json;
BEGIN
  -- Get channel info including read-only status
  SELECT server_id, is_read_only INTO channel_server_id, channel_is_read_only 
  FROM channels WHERE id = _channel_id;
  
  IF channel_server_id IS NULL THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;
  
  -- Check membership and get role
  SELECT sm.is_muted, sm.role INTO is_muted, user_role 
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
  
  -- Check send_messages permission
  IF NOT public.check_user_permission(_user_id, _channel_id, 'send_messages') THEN
    RAISE EXCEPTION 'You do not have permission to send messages in this channel';
  END IF;
  
  -- Check read-only channel permission - need manage_messages to post in read-only
  IF channel_is_read_only = true THEN
    IF NOT public.check_user_permission(_user_id, _channel_id, 'manage_messages') THEN
      RAISE EXCEPTION 'This channel is read-only';
    END IF;
  END IF;
  
  -- Insert the message
  INSERT INTO messages (channel_id, user_id, content, reply_to_id)
  VALUES (_channel_id, _user_id, _content, _reply_to_id)
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
  FROM messages m WHERE m.id = new_message_id;
  
  RETURN result;
END;
$$;
