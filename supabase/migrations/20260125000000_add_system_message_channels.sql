-- Add system message channel columns to servers table
ALTER TABLE public.servers
ADD COLUMN IF NOT EXISTS system_channel_join_id UUID REFERENCES public.channels(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS system_channel_leave_id UUID REFERENCES public.channels(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS enable_join_messages BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS enable_leave_messages BOOLEAN DEFAULT true;

-- Function to post a system message
CREATE OR REPLACE FUNCTION public.post_system_message(
  _channel_id UUID,
  _user_id UUID,
  _content TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _message_id UUID;
BEGIN
  -- Insert system message as if from the user (so it shows their profile picture and username)
  INSERT INTO messages (channel_id, user_id, content)
  VALUES (_channel_id, _user_id, _content)
  RETURNING id INTO _message_id;
  
  RETURN _message_id;
END;
$$;

-- Update join_server_by_invite to post join message if enabled
CREATE OR REPLACE FUNCTION public.join_server_by_invite(_invite_code text, _user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_server_id uuid;
  existing_member record;
  result json;
  clean_code text;
  system_channel_id uuid;
  enable_join boolean;
  user_data record;
  join_message_content text;
BEGIN
  -- Clean and normalize the invite code (trim whitespace, uppercase)
  clean_code := upper(trim(_invite_code));
  
  -- Find server by invite code (cast to text for proper comparison)
  SELECT id, system_channel_join_id, enable_join_messages INTO target_server_id, system_channel_id, enable_join
  FROM servers
  WHERE trim(invite_code::text) = clean_code;
  
  IF target_server_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;
  
  -- Check if already a member
  SELECT * INTO existing_member
  FROM server_members
  WHERE server_id = target_server_id AND user_id = _user_id;
  
  IF existing_member IS NOT NULL THEN
    IF existing_member.is_banned THEN
      RAISE EXCEPTION 'You are banned from this server';
    END IF;
    RAISE EXCEPTION 'You are already a member of this server';
  END IF;
  
  -- Get user data for system message
  SELECT username, display_name, avatar_url INTO user_data
  FROM users
  WHERE id = _user_id;
  
  -- Join server
  INSERT INTO server_members (server_id, user_id, role)
  VALUES (target_server_id, _user_id, 'member');
  
  -- Post join message if enabled and channel is set
  IF enable_join AND system_channel_id IS NOT NULL AND user_data IS NOT NULL THEN
    join_message_content := format('<@%s> joined', _user_id);
    PERFORM public.post_system_message(system_channel_id, _user_id, join_message_content);
  END IF;
  
  -- Return the server data
  SELECT json_build_object(
    'id', s.id,
    'name', s.name,
    'owner_id', s.owner_id,
    'invite_code', trim(s.invite_code::text),
    'icon_url', s.icon_url,
    'banner_url', s.banner_url,
    'created_at', s.created_at
  ) INTO result
  FROM servers s WHERE s.id = target_server_id;
  
  RETURN result;
END;
$$;

-- Update leave_server to post leave message if enabled
CREATE OR REPLACE FUNCTION public.leave_server(
  _server_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
  system_channel_id uuid;
  enable_leave boolean;
  user_data record;
  leave_message_content text;
BEGIN
  SELECT role INTO user_role FROM server_members 
  WHERE server_id = _server_id AND user_id = _user_id AND is_banned = false;
  
  IF user_role IS NULL THEN
    RAISE EXCEPTION 'Not a member of this server';
  END IF;
  
  IF user_role = 'owner' THEN
    RAISE EXCEPTION 'Server owner cannot leave. Transfer ownership first or delete the server.';
  END IF;
  
  -- Get system channel and enable status before deleting member
  SELECT system_channel_leave_id, enable_leave_messages INTO system_channel_id, enable_leave
  FROM servers
  WHERE id = _server_id;
  
  -- Get user data for system message
  SELECT username, display_name, avatar_url INTO user_data
  FROM users
  WHERE id = _user_id;
  
  -- Delete member
  DELETE FROM server_members WHERE server_id = _server_id AND user_id = _user_id;
  
  -- Post leave message if enabled and channel is set
  IF enable_leave AND system_channel_id IS NOT NULL AND user_data IS NOT NULL THEN
    leave_message_content := format('<@%s> left', _user_id);
    PERFORM public.post_system_message(system_channel_id, _user_id, leave_message_content);
  END IF;
  
  RETURN true;
END;
$$;

-- Update update_server to handle system message channel settings
CREATE OR REPLACE FUNCTION public.update_server(
  _server_id UUID,
  _user_id UUID,
  _updates JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_role server_role;
  _updated_server servers%ROWTYPE;
BEGIN
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

-- Update get_user_servers to include system message channel fields
CREATE OR REPLACE FUNCTION public.get_user_servers(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT json_agg(
      json_build_object(
        'id', s.id,
        'name', s.name,
        'owner_id', s.owner_id,
        'invite_code', s.invite_code,
        'icon_url', s.icon_url,
        'banner_url', s.banner_url,
        'is_published', s.is_published,
        'about', s.about,
        'system_channel_join_id', s.system_channel_join_id,
        'system_channel_leave_id', s.system_channel_leave_id,
        'enable_join_messages', s.enable_join_messages,
        'enable_leave_messages', s.enable_leave_messages,
        'created_at', s.created_at,
        'role', sm.role,
        'nickname', sm.nickname,
        'joined_at', sm.joined_at
      )
    )
    FROM server_members sm
    JOIN servers s ON s.id = sm.server_id
    WHERE sm.user_id = _user_id AND sm.is_banned = false
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.post_system_message(UUID, UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.post_system_message(UUID, UUID, TEXT) TO authenticated;
