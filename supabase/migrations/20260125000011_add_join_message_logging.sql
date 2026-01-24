-- Add comprehensive logging to diagnose join message issues
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
BEGIN
  -- Clean and normalize the invite code (trim whitespace, uppercase)
  clean_code := upper(trim(_invite_code));
  
  RAISE NOTICE '=== JOIN SERVER BY INVITE START ===';
  RAISE NOTICE 'Invite code: %, User ID: %', clean_code, _user_id;
  
  -- First, try to find server by main invite code
  SELECT id, system_channel_join_id, enable_join_messages INTO target_server_id, system_channel_id, enable_join
  FROM servers
  WHERE trim(invite_code::text) = clean_code;
  
  RAISE NOTICE 'After main invite check - Server ID: %, System Channel ID: %, Enable Join: %', 
    target_server_id, system_channel_id, enable_join;
  
  -- If not found, check custom server invites
  IF target_server_id IS NULL THEN
    RAISE NOTICE 'Server not found by main invite, checking custom invites...';
    SELECT si.id, si.server_id, si.max_uses, si.uses_count, si.expires_at
      INTO invite_row_id, target_server_id, invite_max_uses, invite_uses_count, invite_expires_at
    FROM public.server_invites si
    WHERE si.revoked_at IS NULL
      AND trim(si.code::text) = clean_code
    FOR UPDATE
    LIMIT 1;

    IF invite_row_id IS NOT NULL THEN
      RAISE NOTICE 'Found custom invite: %, Server ID: %', invite_row_id, target_server_id;
      -- Validate custom invite expiration and max uses
      IF invite_expires_at IS NOT NULL AND invite_expires_at <= now() THEN
        RAISE NOTICE 'Custom invite expired';
        RAISE EXCEPTION 'Invalid invite code';
      END IF;

      IF invite_max_uses IS NOT NULL AND invite_uses_count >= invite_max_uses THEN
        RAISE NOTICE 'Custom invite max uses reached';
        RAISE EXCEPTION 'Invalid invite code';
      END IF;
      
      -- Get system channel settings for custom invite
      SELECT system_channel_join_id, enable_join_messages INTO system_channel_id, enable_join
      FROM servers
      WHERE id = target_server_id;
      
      RAISE NOTICE 'After custom invite - System Channel ID: %, Enable Join: %', 
        system_channel_id, enable_join;
    END IF;
  END IF;
  
  IF target_server_id IS NULL THEN
    RAISE NOTICE 'No server found for invite code';
    RAISE EXCEPTION 'Invalid invite code';
  END IF;
  
  -- Check if already a member (only check for non-banned members)
  SELECT * INTO existing_member
  FROM server_members
  WHERE server_id = target_server_id AND user_id = _user_id AND is_banned = false;
  
  IF existing_member IS NOT NULL THEN
    RAISE NOTICE 'User is already a member';
    RAISE EXCEPTION 'You are already a member of this server';
  END IF;
  
  -- Check if banned (separate check for banned users)
  SELECT * INTO existing_member
  FROM server_members
  WHERE server_id = target_server_id AND user_id = _user_id AND is_banned = true;
  
  IF existing_member IS NOT NULL THEN
    RAISE NOTICE 'User is banned';
    RAISE EXCEPTION 'You are banned from this server';
  END IF;
  
  -- Get user data for system message
  SELECT username, display_name, avatar_url INTO user_data
  FROM users
  WHERE id = _user_id;
  
  RAISE NOTICE 'User data - Username: %, Display Name: %, Avatar: %', 
    user_data.username, user_data.display_name, user_data.avatar_url;
  
  -- Join server (use ON CONFLICT to handle any edge cases)
  INSERT INTO server_members (server_id, user_id, role, is_banned)
  VALUES (target_server_id, _user_id, 'member', false)
  ON CONFLICT (server_id, user_id) DO UPDATE
  SET role = 'member', is_banned = false, joined_at = NOW();
  
  RAISE NOTICE 'User successfully joined server';
  
  -- Increment uses count for custom invite if used
  IF invite_row_id IS NOT NULL THEN
    UPDATE public.server_invites
    SET uses_count = uses_count + 1
    WHERE id = invite_row_id;
    RAISE NOTICE 'Incremented custom invite uses count';
  END IF;
  
  -- Post join message if system channel is configured
  RAISE NOTICE 'Checking join message conditions...';
  RAISE NOTICE 'System Channel ID: %, Enable Join: %, User Data: %', 
    system_channel_id, enable_join, (user_data IS NOT NULL);
  
  IF system_channel_id IS NOT NULL THEN
    RAISE NOTICE 'System channel is set, checking enable flag...';
    -- Only skip if explicitly disabled
    IF enable_join IS NOT NULL AND enable_join = false THEN
      RAISE NOTICE 'Join messages are explicitly disabled, skipping...';
      -- Skip posting message
      NULL;
    ELSE
      RAISE NOTICE 'Join messages are enabled, attempting to post...';
      -- Post the message
      IF user_data IS NOT NULL THEN
        BEGIN
          join_message_content := format('<@%s> joined', _user_id);
          RAISE NOTICE 'Calling post_system_message with Channel: %, User: %, Content: %', 
            system_channel_id, _user_id, join_message_content;
          PERFORM public.post_system_message(system_channel_id, _user_id, join_message_content);
          RAISE NOTICE 'post_system_message completed successfully';
        EXCEPTION WHEN OTHERS THEN
          -- Don't fail the join if message posting fails
          RAISE WARNING 'Failed to post join message: %', SQLERRM;
          RAISE NOTICE 'Exception details - SQLSTATE: %, SQLERRM: %', SQLSTATE, SQLERRM;
        END;
      ELSE
        RAISE NOTICE 'User data is NULL, cannot post message';
      END IF;
    END IF;
  ELSE
    RAISE NOTICE 'No system channel configured, skipping join message';
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
  
  RAISE NOTICE '=== JOIN SERVER BY INVITE END ===';
  RETURN result;
END;
$$;

-- Add logging to post_system_message
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
  channel_exists boolean;
  user_exists boolean;
BEGIN
  RAISE NOTICE '=== POST SYSTEM MESSAGE START ===';
  RAISE NOTICE 'Channel ID: %, User ID: %, Content: %', _channel_id, _user_id, _content;
  
  -- Check if channel exists
  SELECT EXISTS(SELECT 1 FROM channels WHERE id = _channel_id) INTO channel_exists;
  RAISE NOTICE 'Channel exists: %', channel_exists;
  
  -- Check if user exists
  SELECT EXISTS(SELECT 1 FROM users WHERE id = _user_id) INTO user_exists;
  RAISE NOTICE 'User exists: %', user_exists;
  
  IF NOT channel_exists THEN
    RAISE EXCEPTION 'Channel not found: %', _channel_id;
  END IF;
  
  IF NOT user_exists THEN
    RAISE EXCEPTION 'User not found: %', _user_id;
  END IF;
  
  -- Insert system message as if from the user (so it shows their profile picture and username)
  -- Set is_system_message = TRUE to mark it as a system message
  BEGIN
    INSERT INTO messages (channel_id, user_id, content, is_system_message)
    VALUES (_channel_id, _user_id, _content, TRUE)
    RETURNING id INTO _message_id;
    
    RAISE NOTICE 'Message inserted successfully with ID: %', _message_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Exception during message insert - SQLSTATE: %, SQLERRM: %', SQLSTATE, SQLERRM;
    RAISE;
  END;
  
  RAISE NOTICE '=== POST SYSTEM MESSAGE END ===';
  RETURN _message_id;
END;
$$;
