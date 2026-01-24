-- Fix leave_server to post leave messages correctly
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
  leave_message_content text;
  message_id uuid;
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
  
  -- Delete member
  DELETE FROM server_members WHERE server_id = _server_id AND user_id = _user_id;
  
  -- Post leave message if system channel is set
  IF system_channel_id IS NOT NULL THEN
    BEGIN
      leave_message_content := format('<@%s> left', _user_id);
      
      -- Insert message directly
      INSERT INTO messages (channel_id, user_id, content, is_system_message)
      VALUES (system_channel_id, _user_id, leave_message_content, TRUE)
      RETURNING id INTO message_id;
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the leave operation
      RAISE WARNING 'Failed to post leave message: %', SQLERRM;
    END;
  END IF;
  
  RETURN true;
END;
$$;
