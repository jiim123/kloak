-- Add is_read_only column to channels table
ALTER TABLE public.channels ADD COLUMN is_read_only boolean DEFAULT false;

-- Update the update_channel RPC function to include is_read_only
CREATE OR REPLACE FUNCTION public.update_channel(_channel_id uuid, _user_id uuid, _updates text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  channel_server_id uuid;
  result json;
  updates_json json;
BEGIN
  -- Parse the updates text as JSON
  updates_json := _updates::json;
  
  SELECT server_id INTO channel_server_id FROM channels WHERE id = _channel_id;
  
  IF NOT EXISTS (
    SELECT 1 FROM server_members 
    WHERE server_id = channel_server_id AND user_id = _user_id AND is_banned = false
    AND role IN ('owner', 'admin', 'moderator')
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  UPDATE channels SET
    name = COALESCE(updates_json->>'name', name),
    topic = CASE 
      WHEN updates_json ? 'topic' THEN updates_json->>'topic'
      ELSE topic 
    END,
    position = COALESCE((updates_json->>'position')::int, position),
    category_id = CASE WHEN updates_json ? 'category_id' THEN (updates_json->>'category_id')::uuid ELSE category_id END,
    is_nsfw = COALESCE((updates_json->>'is_nsfw')::boolean, is_nsfw),
    slowmode_seconds = COALESCE((updates_json->>'slowmode_seconds')::int, slowmode_seconds),
    is_read_only = COALESCE((updates_json->>'is_read_only')::boolean, is_read_only)
  WHERE id = _channel_id;
  
  SELECT json_build_object(
    'id', c.id, 'server_id', c.server_id, 'category_id', c.category_id,
    'name', c.name, 'topic', c.topic, 'type', c.type, 'position', c.position,
    'is_nsfw', c.is_nsfw, 'slowmode_seconds', c.slowmode_seconds, 'icon', c.icon, 
    'is_read_only', c.is_read_only, 'created_at', c.created_at
  ) INTO result FROM channels c WHERE c.id = _channel_id;
  
  RETURN result;
END;
$$;

-- Update the get_server_channels function to include is_read_only
CREATE OR REPLACE FUNCTION public.get_server_channels(_server_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'id', c.id,
        'server_id', c.server_id,
        'category_id', c.category_id,
        'name', c.name,
        'topic', c.topic,
        'type', c.type,
        'position', c.position,
        'is_nsfw', c.is_nsfw,
        'slowmode_seconds', c.slowmode_seconds,
        'icon', c.icon,
        'is_read_only', c.is_read_only,
        'created_at', c.created_at
      ) ORDER BY c.position
    ),
    '[]'::json
  )
  FROM channels c
  WHERE c.server_id = _server_id;
$$;