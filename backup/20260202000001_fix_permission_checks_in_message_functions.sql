-- Fix permission checks in message-related functions
-- This ensures all message operations use the centralized permission system

-- Update delete_message to use permission check function
CREATE OR REPLACE FUNCTION public.delete_message(_message_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  msg_user_id uuid;
  channel_id uuid;
BEGIN
  -- Get message author and channel
  SELECT m.user_id, m.channel_id INTO msg_user_id, channel_id
  FROM messages m
  WHERE m.id = _message_id;
  
  IF channel_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;
  
  -- Author can always delete their own messages
  IF msg_user_id = _user_id THEN
    DELETE FROM messages WHERE id = _message_id;
    RETURN true;
  END IF;
  
  -- For deleting others' messages, check manage_messages permission
  IF NOT public.check_user_permission(_user_id, channel_id, 'manage_messages') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  DELETE FROM messages WHERE id = _message_id;
  RETURN true;
END;
$$;

-- Update edit_message to check send_messages permission
CREATE OR REPLACE FUNCTION public.edit_message(
  _message_id uuid,
  _user_id uuid,
  _content text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  channel_id uuid;
  msg_user_id uuid;
  result json;
BEGIN
  -- Get message channel and author
  SELECT m.channel_id, m.user_id INTO channel_id, msg_user_id
  FROM messages m
  WHERE m.id = _message_id;
  
  IF channel_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;
  
  -- Only author can edit their message
  IF msg_user_id != _user_id THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  -- Check that user has send_messages permission (required to edit)
  IF NOT public.check_user_permission(_user_id, channel_id, 'send_messages') THEN
    RAISE EXCEPTION 'You do not have permission to send messages in this channel';
  END IF;
  
  UPDATE messages SET content = _content, edited_at = now() WHERE id = _message_id;
  
  SELECT json_build_object(
    'id', m.id, 'channel_id', m.channel_id, 'user_id', m.user_id,
    'content', m.content, 'reply_to_id', m.reply_to_id, 'is_pinned', m.is_pinned,
    'edited_at', m.edited_at, 'created_at', m.created_at
  ) INTO result FROM messages m WHERE m.id = _message_id;
  
  RETURN result;
END;
$$;
