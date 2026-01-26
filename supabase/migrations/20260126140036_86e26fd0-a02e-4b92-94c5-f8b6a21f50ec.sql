-- Create the fixed create_channel function with correct parameter order for permission check
CREATE OR REPLACE FUNCTION public.create_channel(
  _server_id uuid,
  _name text,
  _type text DEFAULT 'text',
  _user_id uuid DEFAULT NULL,
  _category_id uuid DEFAULT NULL,
  _position integer DEFAULT 0,
  _icon text DEFAULT NULL,
  _is_private boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _channel_id uuid;
  _channel RECORD;
BEGIN
  -- Check if user has permission to create channels (correct parameter order: user_id, server_id, permission)
  IF NOT check_user_server_permission(_user_id, _server_id, 'manage_channels'::permission_type) THEN
    RETURN json_build_object('error', 'Permission denied');
  END IF;
  
  -- Insert the channel
  INSERT INTO channels (server_id, name, type, category_id, position, icon, is_private)
  VALUES (_server_id, _name, _type::channel_type, _category_id, _position, _icon, _is_private)
  RETURNING id INTO _channel_id;
  
  -- If private, add creator as first member
  IF _is_private THEN
    INSERT INTO channel_members (channel_id, user_id, added_by)
    VALUES (_channel_id, _user_id, _user_id);
  END IF;
  
  -- Return the created channel
  SELECT * INTO _channel FROM channels WHERE id = _channel_id;
  
  RETURN row_to_json(_channel);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_channel TO anon, authenticated;