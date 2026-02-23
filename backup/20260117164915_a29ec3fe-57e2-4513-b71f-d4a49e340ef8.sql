-- Create a function to preview what will be deleted when a user account is deleted
CREATE OR REPLACE FUNCTION public.get_deletion_preview(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  owned_servers_count integer;
  servers_to_transfer json;
  servers_to_delete json;
  message_count integer;
  dm_count integer;
  reaction_count integer;
  friendship_count integer;
BEGIN
  -- Verify the user exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = _user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Count messages in server channels
  SELECT COUNT(*) INTO message_count FROM messages WHERE user_id = _user_id;
  
  -- Count direct messages
  SELECT COUNT(*) INTO dm_count FROM direct_messages WHERE sender_id = _user_id;
  
  -- Count reactions
  SELECT COUNT(*) INTO reaction_count FROM reactions WHERE user_id = _user_id;
  SELECT reaction_count + COUNT(*) INTO reaction_count FROM dm_reactions WHERE user_id = _user_id;
  
  -- Count friendships
  SELECT COUNT(*) INTO friendship_count FROM friendships 
  WHERE (requester_id = _user_id OR addressee_id = _user_id) AND status = 'accepted';

  -- Get servers to transfer (owned servers with other members)
  SELECT json_agg(json_build_object(
    'id', s.id,
    'name', s.name,
    'member_count', (SELECT COUNT(*) FROM server_members sm WHERE sm.server_id = s.id AND sm.user_id != _user_id AND sm.is_banned = false),
    'new_owner', (
      SELECT json_build_object('id', u.id, 'username', u.username)
      FROM server_members sm
      JOIN users u ON u.id = sm.user_id
      WHERE sm.server_id = s.id 
        AND sm.user_id != _user_id 
        AND sm.is_banned = false
        AND sm.role IN ('admin', 'owner')
      ORDER BY sm.joined_at ASC
      LIMIT 1
    )
  ))
  INTO servers_to_transfer
  FROM servers s
  WHERE s.owner_id = _user_id
    AND EXISTS (
      SELECT 1 FROM server_members sm 
      WHERE sm.server_id = s.id AND sm.user_id != _user_id AND sm.is_banned = false
    );

  -- Get servers to delete (owned servers with no other members)
  SELECT json_agg(json_build_object(
    'id', s.id,
    'name', s.name
  ))
  INTO servers_to_delete
  FROM servers s
  WHERE s.owner_id = _user_id
    AND NOT EXISTS (
      SELECT 1 FROM server_members sm 
      WHERE sm.server_id = s.id AND sm.user_id != _user_id AND sm.is_banned = false
    );

  -- Build the result
  SELECT json_build_object(
    'message_count', message_count,
    'dm_count', dm_count,
    'reaction_count', reaction_count,
    'friendship_count', friendship_count,
    'servers_to_transfer', COALESCE(servers_to_transfer, '[]'::json),
    'servers_to_delete', COALESCE(servers_to_delete, '[]'::json)
  ) INTO result;

  RETURN result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_deletion_preview(uuid) TO anon, authenticated;