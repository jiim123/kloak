-- Add embed_hidden column to messages table
ALTER TABLE public.messages 
ADD COLUMN embed_hidden boolean NOT NULL DEFAULT false;

-- Create an RPC function to toggle embed visibility
CREATE OR REPLACE FUNCTION public.set_message_embed_hidden(
  _message_id UUID,
  _user_id UUID,
  _hidden boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_message_user_id UUID;
BEGIN
  -- Get the message owner
  SELECT user_id INTO v_message_user_id
  FROM messages
  WHERE id = _message_id;
  
  -- Only allow the message author to change embed visibility
  IF v_message_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  IF v_message_user_id != _user_id THEN
    RETURN false;
  END IF;
  
  -- Update the embed_hidden flag
  UPDATE messages
  SET embed_hidden = _hidden
  WHERE id = _message_id;
  
  RETURN true;
END;
$$;