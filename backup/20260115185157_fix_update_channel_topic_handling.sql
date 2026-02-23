-- Fix update_channel function to properly handle null values for topic and other fields
CREATE OR REPLACE FUNCTION public.update_channel(_channel_id uuid, _user_id uuid, _updates text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  channel_server_id uuid;
  result json;
  updates_json jsonb;
BEGIN
  -- Parse the updates text as JSONB (supports ? operator for key existence checks)
  updates_json := _updates::jsonb;
  
  SELECT server_id INTO channel_server_id FROM channels WHERE id = _channel_id;
  
  IF channel_server_id IS NULL THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM server_members 
    WHERE server_id = channel_server_id AND user_id = _user_id AND is_banned = false
    AND role IN ('owner', 'admin', 'moderator')
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  UPDATE channels SET
    name = CASE 
      WHEN updates_json ? 'name' AND updates_json->>'name' IS NOT NULL AND updates_json->>'name' != '' 
      THEN updates_json->>'name'
      ELSE name
    END,
    topic = CASE 
      WHEN updates_json ? 'topic' THEN 
        CASE 
          WHEN updates_json->>'topic' IS NULL OR updates_json->>'topic' = '' THEN NULL
          ELSE updates_json->>'topic'
        END
      ELSE topic
    END,
    position = CASE 
      WHEN updates_json ? 'position' AND updates_json->>'position' IS NOT NULL 
      THEN (updates_json->>'position')::int
      ELSE position
    END,
    category_id = CASE 
      WHEN updates_json ? 'category_id' THEN 
        CASE 
          WHEN updates_json->>'category_id' IS NULL OR updates_json->>'category_id' = '' THEN NULL
          ELSE (updates_json->>'category_id')::uuid
        END
      ELSE category_id
    END,
    is_nsfw = CASE 
      WHEN updates_json ? 'is_nsfw' THEN 
        CASE 
          WHEN updates_json->>'is_nsfw' IS NULL THEN is_nsfw
          ELSE (updates_json->>'is_nsfw')::boolean
        END
      ELSE is_nsfw
    END,
    slowmode_seconds = CASE 
      WHEN updates_json ? 'slowmode_seconds' AND updates_json->>'slowmode_seconds' IS NOT NULL 
      THEN (updates_json->>'slowmode_seconds')::int
      ELSE slowmode_seconds
    END,
    is_read_only = CASE 
      WHEN updates_json ? 'is_read_only' THEN 
        CASE 
          WHEN updates_json->>'is_read_only' IS NULL THEN is_read_only
          ELSE (updates_json->>'is_read_only')::boolean
        END
      ELSE is_read_only
    END
  WHERE id = _channel_id;
  
  SELECT json_build_object(
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
  ) INTO result 
  FROM channels c 
  WHERE c.id = _channel_id;
  
  IF result IS NULL THEN
    RAISE EXCEPTION 'Failed to retrieve updated channel';
  END IF;
  
  RETURN result;
END;
$$;
