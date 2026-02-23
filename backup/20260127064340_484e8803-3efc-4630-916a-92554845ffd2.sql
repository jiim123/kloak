
-- Fix join_server_by_invite to NOT overwrite existing member's role
-- The bug: ON CONFLICT clause was resetting role to 'member' for all existing members

CREATE OR REPLACE FUNCTION public.join_server_by_invite(_invite_code text, _user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  
  -- Check if already a member (non-banned)
  SELECT * INTO existing_member
  FROM server_members
  WHERE server_id = target_server_id AND user_id = _user_id AND is_banned = false;
  
  IF existing_member IS NOT NULL THEN
    -- User is already a member - just return the server without modifying their role
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
  
  -- Check if banned
  SELECT * INTO existing_member
  FROM server_members
  WHERE server_id = target_server_id AND user_id = _user_id AND is_banned = true;
  
  IF existing_member IS NOT NULL THEN
    RAISE EXCEPTION 'You are banned from this server';
  END IF;
  
  -- Join server - only INSERT new members, no ON CONFLICT that could overwrite roles
  INSERT INTO server_members (server_id, user_id, role, is_banned)
  VALUES (target_server_id, _user_id, 'member', false);
  
  -- Increment uses count for custom invite if used
  IF invite_row_id IS NOT NULL THEN
    UPDATE public.server_invites
    SET uses_count = uses_count + 1
    WHERE id = invite_row_id;
  END IF;
  
  -- Post join message if system channel is set
  IF system_channel_id IS NOT NULL THEN
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
    'created_at', s.created_at,
    'already_member', false
  ) INTO result
  FROM servers s WHERE s.id = target_server_id;
  
  RETURN result;
END;
$function$;
