-- Update update_channel function to support ghost_mode, block_links, and allowed_link_domains
CREATE OR REPLACE FUNCTION public.update_channel(
  _channel_id uuid,
  _user_id uuid,
  _updates text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  channel_server_id uuid;
  updates_json jsonb;
  result json;
BEGIN
  -- Get channel's server_id
  SELECT server_id INTO channel_server_id FROM channels WHERE id = _channel_id;
  
  IF channel_server_id IS NULL THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;
  
  -- Check permission using database-backed permission system
  IF NOT public.check_user_server_permission(_user_id, channel_server_id, 'manage_channels') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  -- Parse updates JSON
  updates_json := _updates::jsonb;
  
  UPDATE channels SET
    name = COALESCE(updates_json->>'name', name),
    topic = CASE WHEN updates_json ? 'topic' THEN updates_json->>'topic' ELSE topic END,
    position = COALESCE((updates_json->>'position')::int, position),
    category_id = CASE WHEN updates_json ? 'category_id' THEN (updates_json->>'category_id')::uuid ELSE category_id END,
    is_nsfw = COALESCE((updates_json->>'is_nsfw')::boolean, is_nsfw),
    slowmode_seconds = COALESCE((updates_json->>'slowmode_seconds')::int, slowmode_seconds),
    is_read_only = COALESCE((updates_json->>'is_read_only')::boolean, is_read_only),
    is_private = COALESCE((updates_json->>'is_private')::boolean, is_private),
    block_links = COALESCE((updates_json->>'block_links')::boolean, block_links),
    allowed_link_domains = CASE 
      WHEN updates_json ? 'allowed_link_domains' THEN 
        CASE 
          WHEN updates_json->'allowed_link_domains' IS NULL THEN NULL
          WHEN jsonb_typeof(updates_json->'allowed_link_domains') = 'array' THEN
            ARRAY(SELECT jsonb_array_elements_text(updates_json->'allowed_link_domains'))
          ELSE allowed_link_domains
        END
      ELSE allowed_link_domains 
    END,
    ghost_mode = COALESCE((updates_json->>'ghost_mode')::boolean, ghost_mode)
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
    'is_read_only', c.is_read_only,
    'is_private', c.is_private,
    'block_links', c.block_links,
    'allowed_link_domains', c.allowed_link_domains,
    'ghost_mode', c.ghost_mode,
    'icon', c.icon, 
    'created_at', c.created_at
  ) INTO result FROM channels c WHERE c.id = _channel_id;
  
  RETURN result;
END;
$$;
