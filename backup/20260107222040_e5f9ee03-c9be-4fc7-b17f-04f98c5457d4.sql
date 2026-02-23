-- Channel Operations RPC Functions

-- Create channel
CREATE OR REPLACE FUNCTION public.create_channel(
  _server_id uuid,
  _user_id uuid,
  _name text,
  _type text DEFAULT 'text',
  _category_id uuid DEFAULT NULL,
  _position int DEFAULT 0,
  _icon text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_channel_id uuid;
  result json;
BEGIN
  -- Verify user is a member with appropriate role
  IF NOT EXISTS (
    SELECT 1 FROM server_members 
    WHERE server_id = _server_id AND user_id = _user_id AND is_banned = false
    AND role IN ('owner', 'admin', 'moderator')
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  INSERT INTO channels (server_id, name, type, category_id, position, icon)
  VALUES (_server_id, lower(regexp_replace(_name, '\s+', '-', 'g')), _type::channel_type, _category_id, _position, _icon)
  RETURNING id INTO new_channel_id;
  
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
    'created_at', c.created_at
  ) INTO result FROM channels c WHERE c.id = new_channel_id;
  
  RETURN result;
END;
$$;

-- Update channel
CREATE OR REPLACE FUNCTION public.update_channel(
  _channel_id uuid,
  _user_id uuid,
  _updates json
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  channel_server_id uuid;
  result json;
BEGIN
  SELECT server_id INTO channel_server_id FROM channels WHERE id = _channel_id;
  
  IF NOT EXISTS (
    SELECT 1 FROM server_members 
    WHERE server_id = channel_server_id AND user_id = _user_id AND is_banned = false
    AND role IN ('owner', 'admin', 'moderator')
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  UPDATE channels SET
    name = COALESCE(_updates->>'name', name),
    topic = COALESCE(_updates->>'topic', topic),
    position = COALESCE((_updates->>'position')::int, position),
    category_id = CASE WHEN _updates ? 'category_id' THEN (_updates->>'category_id')::uuid ELSE category_id END,
    is_nsfw = COALESCE((_updates->>'is_nsfw')::boolean, is_nsfw),
    slowmode_seconds = COALESCE((_updates->>'slowmode_seconds')::int, slowmode_seconds)
  WHERE id = _channel_id;
  
  SELECT json_build_object(
    'id', c.id, 'server_id', c.server_id, 'category_id', c.category_id,
    'name', c.name, 'topic', c.topic, 'type', c.type, 'position', c.position,
    'is_nsfw', c.is_nsfw, 'slowmode_seconds', c.slowmode_seconds, 'icon', c.icon, 'created_at', c.created_at
  ) INTO result FROM channels c WHERE c.id = _channel_id;
  
  RETURN result;
END;
$$;

-- Delete channel
CREATE OR REPLACE FUNCTION public.delete_channel(_channel_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  channel_server_id uuid;
BEGIN
  SELECT server_id INTO channel_server_id FROM channels WHERE id = _channel_id;
  
  IF NOT EXISTS (
    SELECT 1 FROM server_members 
    WHERE server_id = channel_server_id AND user_id = _user_id AND is_banned = false
    AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  DELETE FROM channels WHERE id = _channel_id;
  RETURN true;
END;
$$;

-- Category Operations

-- Create category
CREATE OR REPLACE FUNCTION public.create_category(
  _server_id uuid,
  _user_id uuid,
  _name text,
  _position int DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_category_id uuid;
  result json;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM server_members 
    WHERE server_id = _server_id AND user_id = _user_id AND is_banned = false
    AND role IN ('owner', 'admin', 'moderator')
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  INSERT INTO channel_categories (server_id, name, position)
  VALUES (_server_id, _name, _position)
  RETURNING id INTO new_category_id;
  
  SELECT json_build_object(
    'id', cc.id, 'server_id', cc.server_id, 'name', cc.name,
    'position', cc.position, 'is_collapsed', cc.is_collapsed, 'created_at', cc.created_at
  ) INTO result FROM channel_categories cc WHERE cc.id = new_category_id;
  
  RETURN result;
END;
$$;

-- Update category
CREATE OR REPLACE FUNCTION public.update_category(
  _category_id uuid,
  _user_id uuid,
  _updates json
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  category_server_id uuid;
  result json;
BEGIN
  SELECT server_id INTO category_server_id FROM channel_categories WHERE id = _category_id;
  
  IF NOT EXISTS (
    SELECT 1 FROM server_members 
    WHERE server_id = category_server_id AND user_id = _user_id AND is_banned = false
    AND role IN ('owner', 'admin', 'moderator')
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  UPDATE channel_categories SET
    name = COALESCE(_updates->>'name', name),
    position = COALESCE((_updates->>'position')::int, position),
    is_collapsed = COALESCE((_updates->>'is_collapsed')::boolean, is_collapsed)
  WHERE id = _category_id;
  
  SELECT json_build_object(
    'id', cc.id, 'server_id', cc.server_id, 'name', cc.name,
    'position', cc.position, 'is_collapsed', cc.is_collapsed, 'created_at', cc.created_at
  ) INTO result FROM channel_categories cc WHERE cc.id = _category_id;
  
  RETURN result;
END;
$$;

-- Delete category
CREATE OR REPLACE FUNCTION public.delete_category(_category_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  category_server_id uuid;
BEGIN
  SELECT server_id INTO category_server_id FROM channel_categories WHERE id = _category_id;
  
  IF NOT EXISTS (
    SELECT 1 FROM server_members 
    WHERE server_id = category_server_id AND user_id = _user_id AND is_banned = false
    AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  -- Move channels to uncategorized
  UPDATE channels SET category_id = NULL WHERE category_id = _category_id;
  
  DELETE FROM channel_categories WHERE id = _category_id;
  RETURN true;
END;
$$;