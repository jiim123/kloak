-- Drop both existing create_channel functions to resolve overloading conflict
DROP FUNCTION IF EXISTS public.create_channel(uuid, text, text, uuid, uuid, integer, text, boolean);
DROP FUNCTION IF EXISTS public.create_channel(uuid, uuid, character varying, character varying, uuid, integer, text, boolean);

-- Recreate a single clean version of create_channel
CREATE OR REPLACE FUNCTION public.create_channel(
  _server_id uuid,
  _name text,
  _type text DEFAULT 'text',
  _user_id uuid DEFAULT NULL,
  _category_id uuid DEFAULT NULL,
  _position integer DEFAULT NULL,
  _icon text DEFAULT NULL,
  _is_private boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_channel channels%ROWTYPE;
  final_position integer;
BEGIN
  -- Check permission if user_id provided
  IF _user_id IS NOT NULL THEN
    IF NOT check_user_server_permission(_user_id, _server_id, 'manage_channels'::permission_type) THEN
      RETURN json_build_object('error', 'Permission denied');
    END IF;
  END IF;

  -- Calculate position if not provided
  IF _position IS NULL THEN
    SELECT COALESCE(MAX(position), -1) + 1 INTO final_position
    FROM channels
    WHERE server_id = _server_id
      AND ((_category_id IS NULL AND category_id IS NULL) OR category_id = _category_id);
  ELSE
    final_position := _position;
  END IF;

  -- Insert the channel
  INSERT INTO channels (server_id, name, type, category_id, position, icon, is_private)
  VALUES (_server_id, _name, _type::channel_type, _category_id, final_position, _icon, _is_private)
  RETURNING * INTO new_channel;

  -- If private channel and user_id provided, add creator as first member
  IF _is_private AND _user_id IS NOT NULL THEN
    INSERT INTO channel_members (channel_id, user_id, added_by)
    VALUES (new_channel.id, _user_id, _user_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN row_to_json(new_channel);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.create_channel(uuid, text, text, uuid, uuid, integer, text, boolean) TO anon, authenticated;