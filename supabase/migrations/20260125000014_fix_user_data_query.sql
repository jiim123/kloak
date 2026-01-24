-- Fix user data query in join_server_by_invite
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
  invite_row_id uuid;
  invite_max_uses integer;
  invite_uses_count integer;
  invite_expires_at timestamptz;
  message_inserted boolean := false;
  user_exists boolean := false;
BEGIN
  -- Clean and normalize the invite code (trim whitespace, uppercase)
  clean_code := upper(trim(_invite_code));
  
  -- First, try to find server by main invite code
  SELECT id, system_channel_join_id, enable_join_messages INTO target_server_id, system_channel_id, enable_join
  FROM servers
  WHERE trim(invite_code::text) = clean_code;
  
  -- If not found, check custom server invites
  IF target_server_id IS NULL THEN
    SELECT si.id, si.server_id, si.max_uses, si.uses_count, si.expires_at
      INTO invite_row_id, target_server_id, invite_max_uses, invite_uses_count, invite_expires_at
    FROM public.server_invites si
    WHERE si.revoked_at IS NULL
      AND trim(si.code::text) = clean_code
    FOR UPDATE
    LIMIT 1;

    IF invite_row_id IS NOT NULL THEN
      -- Validate custom invite expiration and max uses
      IF invite_expires_at IS NOT NULL AND invite_expires_at <= now() THEN
        RAISE EXCEPTION 'Invalid invite code';
      END IF;

      IF invite_max_uses IS NOT NULL AND invite_uses_count >= invite_max_uses THEN
        RAISE EXCEPTION 'Invalid invite code';
      END IF;
      
      -- Get system channel settings for custom invite
      SELECT system_channel_join_id, enable_join_messages INTO system_channel_id, enable_join
      FROM servers
      WHERE id = target_server_id;
    END IF;
  END IF;
  
  IF target_server_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;
  
  -- Check if already a member (only check for non-banned members)
  SELECT * INTO existing_member
  FROM server_members
  WHERE server_id = target_server_id AND user_id = _user_id AND is_banned = false;
  
  IF existing_member IS NOT NULL THEN
    RAISE EXCEPTION 'You are already a member of this server';
  END IF;
  
  -- Check if banned (separate check for banned users)
  SELECT * INTO existing_member
  FROM server_members
  WHERE server_id = target_server_id AND user_id = _user_id AND is_banned = true;
  
  IF existing_member IS NOT NULL THEN
    RAISE EXCEPTION 'You are banned from this server';
  END IF;
  
  -- Check if user exists first
  SELECT EXISTS(SELECT 1 FROM users WHERE id = _user_id) INTO user_exists;
  
  -- Get user data for system message (only if user exists)
  IF user_exists THEN
    SELECT username, display_name, avatar_url INTO user_data
    FROM users
    WHERE id = _user_id;
  END IF;
  
  -- Join server (use ON CONFLICT to handle any edge cases)
  INSERT INTO server_members (server_id, user_id, role, is_banned)
  VALUES (target_server_id, _user_id, 'member', false)
  ON CONFLICT (server_id, user_id) DO UPDATE
  SET role = 'member', is_banned = false, joined_at = NOW();
  
  -- Increment uses count for custom invite if used
  IF invite_row_id IS NOT NULL THEN
    UPDATE public.server_invites
    SET uses_count = uses_count + 1
    WHERE id = invite_row_id;
  END IF;
  
  -- Post join message if system channel is set and user data is available
  -- Changed condition: check if user_data record exists AND has username
  IF system_channel_id IS NOT NULL 
     AND user_data IS NOT NULL 
     AND user_data.username IS NOT NULL THEN
    BEGIN
      join_message_content := format('<@%s> joined', _user_id);
      PERFORM public.post_system_message(system_channel_id, _user_id, join_message_content);
      message_inserted := true;
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the join
      RAISE WARNING 'Failed to post join message: %', SQLERRM;
      message_inserted := false;
    END;
  END IF;
  
  -- Return the server data with debug info
  SELECT json_build_object(
    'id', s.id,
    'name', s.name,
    'owner_id', s.owner_id,
    'invite_code', trim(s.invite_code::text),
    'icon_url', s.icon_url,
    'banner_url', s.banner_url,
    'created_at', s.created_at,
    'debug', json_build_object(
      'system_channel_join_id', system_channel_id,
      'enable_join_messages', enable_join,
      'user_exists', user_exists,
      'user_data_exists', (user_data IS NOT NULL),
      'user_username', CASE WHEN user_data IS NOT NULL THEN user_data.username ELSE NULL END,
      'message_inserted', message_inserted
    )
  ) INTO result
  FROM servers s WHERE s.id = target_server_id;
  
  RETURN result;
END;
$$;
