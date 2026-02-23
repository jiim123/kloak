-- Delete thread message with permission checks
CREATE OR REPLACE FUNCTION public.delete_thread_message(
  _message_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  msg_user_id uuid;
  thread_channel_id uuid;
  channel_server_id uuid;
  user_role text;
BEGIN
  -- Get message details
  SELECT tm.user_id, t.channel_id INTO msg_user_id, thread_channel_id
  FROM thread_messages tm
  JOIN threads t ON t.id = tm.thread_id
  WHERE tm.id = _message_id;
  
  IF msg_user_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;
  
  -- Author can always delete their own messages
  IF msg_user_id = _user_id THEN
    DELETE FROM thread_messages WHERE id = _message_id;
    RETURN true;
  END IF;
  
  -- Get channel's server
  SELECT server_id INTO channel_server_id
  FROM channels
  WHERE id = thread_channel_id;
  
  -- Admins/mods can delete any message
  SELECT role INTO user_role FROM server_members 
  WHERE server_id = channel_server_id AND user_id = _user_id AND is_banned = false;
  
  IF user_role IN ('owner', 'admin', 'moderator') THEN
    DELETE FROM thread_messages WHERE id = _message_id;
    RETURN true;
  END IF;
  
  RAISE EXCEPTION 'Permission denied';
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_thread_message(uuid, uuid) TO anon, authenticated;
