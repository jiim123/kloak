CREATE OR REPLACE FUNCTION public.join_server_by_invite(_invite_code text, _user_id uuid, _join_source text DEFAULT 'invite_link')
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
  join_message_content text;
  invite_row_id uuid;
  invite_max_uses integer;
  invite_uses_count integer;
  invite_expires_at timestamptz;
  message_id uuid;
  message_inserted boolean := false;
  insert_error text;
  was_inserted boolean := false;
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
  
  -- Check if user has ANY existing membership record (active or banned)
  SELECT * INTO existing_member
  FROM server_members
  WHERE server_id = target_server_id AND user_id = _user_id
  FOR UPDATE;
  
  IF existing_member IS NOT NULL THEN
    -- User already has a membership record
    IF existing_member.is_banned = true THEN
      RAISE EXCEPTION 'You are banned from this server';
    END IF;
    
    -- User is already an active member - return server without modifying their role
    SELECT json_build_object(
      'id', s.id,
      'name', s.name,
      'owner_id', s.owner_id,
      'invite_code', trim(s.invite_code::text),
      'icon_url', s.icon_url,
      'banner_url', s.banner_url,
      'is_published', s.is_published,
      'about', s.about,
      'created_at', s.created_at,
      'already_member', true
    ) INTO result
    FROM servers s WHERE s.id = target_server_id;
    
    RETURN result;
  END IF;
  
  -- Join server - insert new member with ON CONFLICT to handle any race conditions
  INSERT INTO server_members (server_id, user_id, role, is_banned, join_source, join_invite_code)
  VALUES (target_server_id, _user_id, 'member', false, _join_source, clean_code)
  ON CONFLICT (server_id, user_id) DO NOTHING
  RETURNING true INTO was_inserted;
  
  -- If insert didn't happen due to conflict, user is already a member
  IF was_inserted IS NULL THEN
    SELECT json_build_object(
      'id', s.id,
      'name', s.name,
      'owner_id', s.owner_id,
      'invite_code', trim(s.invite_code::text),
      'icon_url', s.icon_url,
      'banner_url', s.banner_url,
      'is_published', s.is_published,
      'about', s.about,
      'created_at', s.created_at,
      'already_member', true
    ) INTO result
    FROM servers s WHERE s.id = target_server_id;
    
    RETURN result;
  END IF;
  
  -- Increment uses count for custom invite if used
  IF invite_row_id IS NOT NULL THEN
    UPDATE public.server_invites
    SET uses_count = uses_count + 1
    WHERE id = invite_row_id;
  END IF;
  
  -- Post join message if system channel is set and enabled
  IF system_channel_id IS NOT NULL AND enable_join = true THEN
    BEGIN
      join_message_content := format('<@%s> joined', _user_id);
      
      INSERT INTO messages (channel_id, user_id, content, is_system_message)
      VALUES (system_channel_id, _user_id, join_message_content, TRUE)
      RETURNING id INTO message_id;
      
      message_inserted := true;
      insert_error := NULL;
    EXCEPTION WHEN OTHERS THEN
      insert_error := SQLERRM;
      message_inserted := false;
      RAISE WARNING 'Failed to insert join message: %', SQLERRM;
    END;
  END IF;
  
  -- Return the server data
  SELECT json_build_object(
    'id', s.id,
    'name', s.name,
    'owner_id', s.owner_id,
    'invite_code', trim(s.invite_code::text),
    'icon_url', s.icon_url,
    'banner_url', s.banner_url,
    'is_published', s.is_published,
    'about', s.about,
    'created_at', s.created_at,
    'already_member', false,
    'debug', json_build_object(
      'system_channel_join_id', system_channel_id,
      'enable_join_messages', enable_join,
      'user_id', _user_id,
      'message_inserted', message_inserted,
      'message_id', message_id,
      'insert_error', insert_error
    )
  ) INTO result
  FROM servers s WHERE s.id = target_server_id;
  
  RETURN result;
END;
$$;