-- Drop existing pin_message function first due to parameter name conflict
DROP FUNCTION IF EXISTS public.pin_message(uuid, uuid, boolean);

-- Recreate pin_message to use check_user_permission
CREATE OR REPLACE FUNCTION public.pin_message(
  _message_id uuid,
  _user_id uuid,
  _pinned boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_channel_id uuid;
  v_has_permission boolean;
BEGIN
  -- Get channel from message
  SELECT channel_id INTO v_channel_id
  FROM messages
  WHERE id = _message_id;
  
  IF v_channel_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;
  
  -- Check if user has pin_messages permission for this channel
  v_has_permission := check_user_permission(_user_id, v_channel_id, 'pin_messages');
  
  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'Permission denied: You do not have permission to pin messages';
  END IF;
  
  UPDATE messages SET is_pinned = _pinned WHERE id = _message_id;
  RETURN true;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.pin_message(uuid, uuid, boolean) TO anon, authenticated;