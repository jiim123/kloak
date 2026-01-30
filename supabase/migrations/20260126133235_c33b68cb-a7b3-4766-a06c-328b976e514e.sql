-- Add is_private column to channels table (IF NOT EXISTS so migration is safe if column already exists)
ALTER TABLE public.channels 
ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

-- Create channel_members table for private channel access (IF NOT EXISTS so migration is safe if table already exists)
CREATE TABLE IF NOT EXISTS public.channel_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  added_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

-- Enable RLS on channel_members (only if not already enabled, so migration is safe if already applied)
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.channel_members'::regclass) THEN
    ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- RLS policies for channel_members (permissive for custom auth system). Drop first so migration is safe if already applied.
DROP POLICY IF EXISTS "Channel members are viewable" ON public.channel_members;
CREATE POLICY "Channel members are viewable" ON public.channel_members
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Channel members can be inserted" ON public.channel_members;
CREATE POLICY "Channel members can be inserted" ON public.channel_members
FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Channel members can be deleted" ON public.channel_members;
CREATE POLICY "Channel members can be deleted" ON public.channel_members
FOR DELETE USING (true);

-- Enable realtime for channel_members
ALTER TABLE public.channel_members REPLICA IDENTITY FULL;

-- Create index for performance (IF NOT EXISTS so migration is safe if already applied)
CREATE INDEX IF NOT EXISTS idx_channel_members_channel_id ON public.channel_members(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_user_id ON public.channel_members(user_id);

-- Function to check if user can access a channel
CREATE OR REPLACE FUNCTION public.can_access_channel(_channel_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _channel RECORD;
  _server_id uuid;
BEGIN
  -- Get channel info
  SELECT id, server_id, is_private INTO _channel
  FROM channels WHERE id = _channel_id;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- If channel is not private, check if user is server member
  IF NOT _channel.is_private THEN
    RETURN EXISTS (
      SELECT 1 FROM server_members 
      WHERE server_id = _channel.server_id 
      AND user_id = _user_id 
      AND is_banned = false
    );
  END IF;
  
  -- If channel is private, check if user is in channel_members
  RETURN EXISTS (
    SELECT 1 FROM channel_members 
    WHERE channel_id = _channel_id 
    AND user_id = _user_id
  );
END;
$$;

-- Function to add member to private channel
CREATE OR REPLACE FUNCTION public.add_channel_member(
  _channel_id uuid,
  _target_user_id uuid,
  _added_by uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _channel RECORD;
BEGIN
  -- Get channel info
  SELECT id, server_id, is_private INTO _channel
  FROM channels WHERE id = _channel_id;
  
  IF NOT FOUND OR NOT _channel.is_private THEN
    RETURN false;
  END IF;
  
  -- Check if adder has access to the channel (must be existing member or admin)
  IF NOT EXISTS (
    SELECT 1 FROM channel_members WHERE channel_id = _channel_id AND user_id = _added_by
  ) AND NOT EXISTS (
    SELECT 1 FROM server_members 
    WHERE server_id = _channel.server_id 
    AND user_id = _added_by 
    AND role IN ('owner', 'admin')
  ) THEN
    RETURN false;
  END IF;
  
  -- Check if target is a server member
  IF NOT EXISTS (
    SELECT 1 FROM server_members 
    WHERE server_id = _channel.server_id 
    AND user_id = _target_user_id 
    AND is_banned = false
  ) THEN
    RETURN false;
  END IF;
  
  -- Insert member
  INSERT INTO channel_members (channel_id, user_id, added_by)
  VALUES (_channel_id, _target_user_id, _added_by)
  ON CONFLICT (channel_id, user_id) DO NOTHING;
  
  RETURN true;
END;
$$;

-- Function to remove member from private channel
CREATE OR REPLACE FUNCTION public.remove_channel_member(
  _channel_id uuid,
  _target_user_id uuid,
  _removed_by uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _channel RECORD;
BEGIN
  -- Get channel info
  SELECT id, server_id, is_private INTO _channel
  FROM channels WHERE id = _channel_id;
  
  IF NOT FOUND OR NOT _channel.is_private THEN
    RETURN false;
  END IF;
  
  -- Check if remover has permission (admin/owner or removing self)
  IF _removed_by != _target_user_id AND NOT EXISTS (
    SELECT 1 FROM server_members 
    WHERE server_id = _channel.server_id 
    AND user_id = _removed_by 
    AND role IN ('owner', 'admin')
  ) THEN
    RETURN false;
  END IF;
  
  -- Delete member
  DELETE FROM channel_members 
  WHERE channel_id = _channel_id AND user_id = _target_user_id;
  
  RETURN true;
END;
$$;

-- Update create_channel function to support private channels and add creator as member
CREATE OR REPLACE FUNCTION public.create_channel(
  _server_id uuid,
  _user_id uuid,
  _name varchar,
  _type varchar DEFAULT 'text',
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
  -- Check if user has permission to create channels
  IF NOT check_user_server_permission('manage_channels', _server_id, _user_id) THEN
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

-- Update get_server_channels to filter private channels based on access
CREATE OR REPLACE FUNCTION public.get_server_channels(_server_id uuid, _user_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_admin boolean := false;
BEGIN
  -- Check if user is admin/owner (they can see all channels)
  IF _user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM server_members 
      WHERE server_id = _server_id 
      AND user_id = _user_id 
      AND role IN ('owner', 'admin')
    ) INTO _is_admin;
  END IF;

  RETURN (
    SELECT COALESCE(json_agg(
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
        'is_read_only', c.is_read_only,
        'icon', c.icon,
        'is_private', c.is_private,
        'created_at', c.created_at
      ) ORDER BY c.position
    ), '[]'::json)
    FROM channels c
    WHERE c.server_id = _server_id
    AND (
      -- Not private, visible to all
      NOT c.is_private
      -- Or user is admin/owner
      OR _is_admin
      -- Or user is a channel member
      OR (_user_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM channel_members cm 
        WHERE cm.channel_id = c.id AND cm.user_id = _user_id
      ))
    )
  );
END;
$$;

-- Function to get channel members
CREATE OR REPLACE FUNCTION public.get_channel_members(_channel_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(
      json_build_object(
        'id', cm.id,
        'channel_id', cm.channel_id,
        'user_id', cm.user_id,
        'added_by', cm.added_by,
        'created_at', cm.created_at,
        'user', json_build_object(
          'id', u.id,
          'username', u.username,
          'display_name', u.display_name,
          'avatar_url', u.avatar_url,
          'status', u.status
        )
      )
    ), '[]'::json)
    FROM channel_members cm
    JOIN users u ON u.id = cm.user_id
    WHERE cm.channel_id = _channel_id
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.can_access_channel TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_channel_member TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_channel_member TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_channel_members TO anon, authenticated;