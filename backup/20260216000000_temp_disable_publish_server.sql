-- Temporarily disable publishing servers while rebuilding the Explore page
-- Blocks is_published = true (new publishing) server-side; allows unpublishing (false)
DROP FUNCTION IF EXISTS public.update_server(uuid, uuid, jsonb);
CREATE OR REPLACE FUNCTION public.update_server(
  _server_id UUID,
  _user_id UUID,
  _updates JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_role server_role;
  _updated_server servers%ROWTYPE;
BEGIN
  -- Check user's role in server
  SELECT role INTO _user_role
  FROM server_members
  WHERE server_id = _server_id AND user_id = _user_id AND is_banned = false;

  IF _user_role IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not a member of this server');
  END IF;

  -- Only owner and admin can update server settings
  IF _user_role NOT IN ('owner', 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;

  -- TEMPORARY: Reject attempts to publish (set is_published to true) while rebuilding Explore page
  IF (_updates ? 'is_published') AND ((_updates->>'is_published')::boolean = true) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'We''re rebuilding the Explore page. Publishing will be available soon.'
    );
  END IF;

  -- Update server with provided fields
  UPDATE servers
  SET
    name = COALESCE(_updates->>'name', name),
    icon_url = CASE 
      WHEN _updates ? 'icon_url' THEN _updates->>'icon_url'
      ELSE icon_url
    END,
    banner_url = CASE 
      WHEN _updates ? 'banner_url' THEN _updates->>'banner_url'
      ELSE banner_url
    END,
    about = CASE
      WHEN _updates ? 'about' THEN NULLIF(_updates->>'about', '')
      WHEN _updates ? 'about' THEN about
      ELSE about
    END,
    is_published = CASE
      WHEN _updates ? 'is_published' THEN (_updates->>'is_published')::boolean
      ELSE is_published
    END,
    system_channel_join_id = CASE
      WHEN _updates ? 'system_channel_join_id' THEN 
        CASE 
          WHEN _updates->'system_channel_join_id' IS NULL 
            OR _updates->>'system_channel_join_id' = 'null' 
            OR _updates->>'system_channel_join_id' = '' 
            OR _updates->>'system_channel_join_id' = 'none' THEN NULL
          ELSE (_updates->>'system_channel_join_id')::uuid
        END
      ELSE system_channel_join_id
    END,
    system_channel_leave_id = CASE
      WHEN _updates ? 'system_channel_leave_id' THEN 
        CASE 
          WHEN _updates->'system_channel_leave_id' IS NULL 
            OR _updates->>'system_channel_leave_id' = 'null' 
            OR _updates->>'system_channel_leave_id' = '' 
            OR _updates->>'system_channel_leave_id' = 'none' THEN NULL
          ELSE (_updates->>'system_channel_leave_id')::uuid
        END
      ELSE system_channel_leave_id
    END,
    enable_join_messages = CASE
      WHEN _updates ? 'enable_join_messages' THEN (_updates->>'enable_join_messages')::boolean
      ELSE enable_join_messages
    END,
    enable_leave_messages = CASE
      WHEN _updates ? 'enable_leave_messages' THEN (_updates->>'enable_leave_messages')::boolean
      ELSE enable_leave_messages
    END
  WHERE id = _server_id
  RETURNING * INTO _updated_server;

  IF _updated_server.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Server not found');
  END IF;

  RETURN json_build_object(
    'success', true,
    'server', json_build_object(
      'id', _updated_server.id,
      'name', _updated_server.name,
      'icon_url', _updated_server.icon_url,
      'banner_url', _updated_server.banner_url,
      'about', _updated_server.about,
      'is_published', _updated_server.is_published,
      'owner_id', _updated_server.owner_id,
      'invite_code', _updated_server.invite_code,
      'created_at', _updated_server.created_at,
      'system_channel_join_id', _updated_server.system_channel_join_id,
      'system_channel_leave_id', _updated_server.system_channel_leave_id,
      'enable_join_messages', _updated_server.enable_join_messages,
      'enable_leave_messages', _updated_server.enable_leave_messages
    )
  );
END;
$$;
