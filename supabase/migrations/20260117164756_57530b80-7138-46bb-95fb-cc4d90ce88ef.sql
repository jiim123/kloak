-- Create a function to delete user account with all related data
CREATE OR REPLACE FUNCTION public.delete_user_account(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owned_server RECORD;
  new_owner_id uuid;
  member_count integer;
BEGIN
  -- Verify the user exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = _user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Handle servers owned by this user
  FOR owned_server IN SELECT id FROM servers WHERE owner_id = _user_id LOOP
    -- Count other members in the server
    SELECT COUNT(*) INTO member_count 
    FROM server_members 
    WHERE server_id = owned_server.id AND user_id != _user_id AND is_banned = false;
    
    IF member_count = 0 THEN
      -- No other members, delete the entire server and related data
      DELETE FROM channel_permissions WHERE channel_id IN (SELECT id FROM channels WHERE server_id = owned_server.id);
      DELETE FROM channel_reads WHERE channel_id IN (SELECT id FROM channels WHERE server_id = owned_server.id);
      DELETE FROM reactions WHERE message_id IN (SELECT id FROM messages WHERE channel_id IN (SELECT id FROM channels WHERE server_id = owned_server.id));
      DELETE FROM mentions WHERE message_id IN (SELECT id FROM messages WHERE channel_id IN (SELECT id FROM channels WHERE server_id = owned_server.id));
      DELETE FROM message_attachments WHERE message_id IN (SELECT id FROM messages WHERE channel_id IN (SELECT id FROM channels WHERE server_id = owned_server.id));
      DELETE FROM messages WHERE channel_id IN (SELECT id FROM channels WHERE server_id = owned_server.id);
      DELETE FROM channels WHERE server_id = owned_server.id;
      DELETE FROM channel_categories WHERE server_id = owned_server.id;
      DELETE FROM role_permissions WHERE server_id = owned_server.id;
      DELETE FROM server_member_roles WHERE member_id IN (SELECT id FROM server_members WHERE server_id = owned_server.id);
      DELETE FROM server_members WHERE server_id = owned_server.id;
      DELETE FROM server_roles WHERE server_id = owned_server.id;
      DELETE FROM servers WHERE id = owned_server.id;
    ELSE
      -- Find a new owner: first try to find someone with transfer_ownership permission
      SELECT sm.user_id INTO new_owner_id
      FROM server_members sm
      WHERE sm.server_id = owned_server.id 
        AND sm.user_id != _user_id 
        AND sm.is_banned = false
        AND sm.role IN ('admin', 'owner')
      ORDER BY sm.joined_at ASC
      LIMIT 1;
      
      -- If no admin found, get the oldest member
      IF new_owner_id IS NULL THEN
        SELECT sm.user_id INTO new_owner_id
        FROM server_members sm
        WHERE sm.server_id = owned_server.id 
          AND sm.user_id != _user_id 
          AND sm.is_banned = false
        ORDER BY sm.joined_at ASC
        LIMIT 1;
      END IF;
      
      -- Transfer ownership
      IF new_owner_id IS NOT NULL THEN
        UPDATE servers SET owner_id = new_owner_id WHERE id = owned_server.id;
        UPDATE server_members SET role = 'owner' WHERE server_id = owned_server.id AND user_id = new_owner_id;
      END IF;
    END IF;
  END LOOP;

  -- Delete user's reactions (on regular messages)
  DELETE FROM reactions WHERE user_id = _user_id;
  
  -- Delete user's DM reactions
  DELETE FROM dm_reactions WHERE user_id = _user_id;
  
  -- Delete mentions of this user
  DELETE FROM mentions WHERE user_id = _user_id;
  
  -- Delete user's notifications
  DELETE FROM notifications WHERE user_id = _user_id;
  
  -- Delete user's channel reads
  DELETE FROM channel_reads WHERE user_id = _user_id;
  
  -- Delete message attachments for user's messages
  DELETE FROM message_attachments WHERE message_id IN (SELECT id FROM messages WHERE user_id = _user_id);
  
  -- Delete user's messages (set to deleted or actually delete)
  DELETE FROM messages WHERE user_id = _user_id;
  
  -- Delete DM attachments for user's DMs
  DELETE FROM dm_attachments WHERE message_id IN (SELECT id FROM direct_messages WHERE sender_id = _user_id);
  
  -- Delete user's direct messages
  DELETE FROM direct_messages WHERE sender_id = _user_id;
  
  -- Delete DM participants entries for this user
  DELETE FROM dm_participants WHERE user_id = _user_id;
  
  -- Clean up empty DM conversations (no participants left)
  DELETE FROM dm_conversations WHERE id NOT IN (SELECT DISTINCT conversation_id FROM dm_participants);
  
  -- Delete friendships involving this user
  DELETE FROM friendships WHERE requester_id = _user_id OR addressee_id = _user_id;
  
  -- Delete user's server member roles
  DELETE FROM server_member_roles WHERE member_id IN (SELECT id FROM server_members WHERE user_id = _user_id);
  
  -- Delete user from all servers (as member)
  DELETE FROM server_members WHERE user_id = _user_id;
  
  -- Delete user preferences
  DELETE FROM user_preferences WHERE user_id = _user_id;
  
  -- Finally delete the user
  DELETE FROM users WHERE id = _user_id;
  
  RETURN true;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.delete_user_account(uuid) TO anon, authenticated;