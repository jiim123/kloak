
-- Make is_banned NOT NULL with default false to prevent NULL edge cases
ALTER TABLE server_members ALTER COLUMN is_banned SET DEFAULT false;
UPDATE server_members SET is_banned = false WHERE is_banned IS NULL;
ALTER TABLE server_members ALTER COLUMN is_banned SET NOT NULL;

-- Replace join_server_by_invite with a more defensive version
CREATE OR REPLACE FUNCTION public.join_server_by_invite(
  _invite_code text,
  _user_id uuid,
  _join_source text DEFAULT 'invite_link'
)
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
BEGIN
  clean_code := upper(trim(_invite_code));
  
  -- Find server by main invite code
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
      IF invite_expires_at IS NOT NULL AND invite_expires_at <= now() THEN
        RAISE EXCEPTION 'Invalid invite code';
      END IF;
      IF invite_max_uses IS NOT NULL AND invite_uses_count >= invite_max_uses THEN
        RAISE EXCEPTION 'Invalid invite code';
      END IF;
      SELECT system_channel_join_id, enable_join_messages INTO system_channel_id, enable_join
      FROM servers WHERE id = target_server_id;
    END IF;
  END IF;
  
  IF target_server_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;
  
  -- Single lookup for existing membership
  SELECT * INTO existing_member
  FROM server_members
  WHERE server_id = target_server_id AND user_id = _user_id;
  
  IF existing_member IS NOT NULL THEN
    -- BANNED CHECK FIRST - always block banned users, no exceptions
    IF existing_member.is_banned = true THEN
      RAISE EXCEPTION 'You are banned from this server';
    END IF;
    
    -- Already a non-banned member - return server without modification
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
  
  -- New member - insert
  INSERT INTO server_members (server_id, user_id, role, is_banned)
  VALUES (target_server_id, _user_id, 'member', false);
  
  -- Increment uses count for custom invite
  IF invite_row_id IS NOT NULL THEN
    UPDATE public.server_invites SET uses_count = uses_count + 1 WHERE id = invite_row_id;
  END IF;
  
  -- Post join message if system channel is set
  IF system_channel_id IS NOT NULL AND enable_join THEN
    BEGIN
      join_message_content := format('<@%s> joined', _user_id);
      INSERT INTO messages (channel_id, user_id, content, is_system_message)
      VALUES (system_channel_id, _user_id, join_message_content, TRUE)
      RETURNING id INTO message_id;
      message_inserted := true;
    EXCEPTION WHEN OTHERS THEN
      insert_error := SQLERRM;
      message_inserted := false;
      RAISE WARNING 'Failed to insert join message: %', SQLERRM;
    END;
  END IF;
  
  -- Return server data
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
$$;
