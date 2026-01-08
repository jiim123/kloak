-- Fix join_server_by_invite to handle char(8) vs text comparison properly
-- The invite_code column is char(8) which may cause comparison issues with text input

DROP FUNCTION IF EXISTS public.join_server_by_invite(text, uuid);

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
BEGIN
  -- Clean and normalize the invite code (trim whitespace, uppercase)
  clean_code := upper(trim(_invite_code));
  
  -- Find server by invite code (cast to text for proper comparison)
  SELECT id INTO target_server_id
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
  
  -- Join server
  INSERT INTO server_members (server_id, user_id, role)
  VALUES (target_server_id, _user_id, 'member');
  
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.join_server_by_invite(text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.join_server_by_invite(text, uuid) TO authenticated;