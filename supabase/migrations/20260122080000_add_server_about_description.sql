-- Add about/description field to servers table
ALTER TABLE public.servers
ADD COLUMN IF NOT EXISTS about TEXT;

-- Update update_server RPC to support about field
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
  _updated_server servers%ROWTYPE;
  _owner_id uuid;
BEGIN
  -- Check permission using database-backed permission system
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_server') THEN
    RETURN json_build_object('success', false, 'error', 'Permission denied');
  END IF;

  -- Owner-only guard for publishing
  IF (_updates ? 'is_published') THEN
    SELECT owner_id INTO _owner_id FROM servers WHERE id = _server_id;
    IF _owner_id IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Server not found');
    END IF;
    IF _owner_id <> _user_id THEN
      RETURN json_build_object('success', false, 'error', 'Only the server owner can publish the server');
    END IF;
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
    is_published = CASE
      WHEN _updates ? 'is_published' THEN COALESCE((_updates->>'is_published')::boolean, false)
      ELSE is_published
    END,
    about = CASE
      WHEN _updates ? 'about' THEN _updates->>'about'
      ELSE about
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
      'is_published', _updated_server.is_published,
      'about', _updated_server.about,
      'owner_id', _updated_server.owner_id,
      'invite_code', _updated_server.invite_code,
      'created_at', _updated_server.created_at
    )
  );
END;
$$;

-- Update get_user_servers RPC to include about
CREATE OR REPLACE FUNCTION public.get_user_servers(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT json_agg(
      json_build_object(
        'id', s.id,
        'name', s.name,
        'owner_id', s.owner_id,
        'invite_code', s.invite_code,
        'icon_url', s.icon_url,
        'banner_url', s.banner_url,
        'is_published', s.is_published,
        'about', s.about,
        'created_at', s.created_at,
        'role', sm.role,
        'nickname', sm.nickname,
        'joined_at', sm.joined_at
      )
    )
    FROM server_members sm
    JOIN servers s ON s.id = sm.server_id
    WHERE sm.user_id = _user_id AND sm.is_banned = false
  );
END;
$$;

-- Update create_server_with_owner to include about in return
CREATE OR REPLACE FUNCTION public.create_server_with_owner(
  _name text,
  _owner_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_server_id uuid;
  new_invite_code char(8);
  result json;
BEGIN
  -- Generate invite code
  new_invite_code := generate_invite_code();

  -- Create the server
  INSERT INTO servers (name, owner_id, invite_code)
  VALUES (_name, _owner_id, new_invite_code)
  RETURNING id INTO new_server_id;

  -- Add owner as member with owner role
  INSERT INTO server_members (server_id, user_id, role)
  VALUES (new_server_id, _owner_id, 'owner');

  -- Create default #general channel
  INSERT INTO channels (server_id, name, type, position)
  VALUES (new_server_id, 'general', 'text', 0);

  -- Return the created server data
  SELECT json_build_object(
    'id', s.id,
    'name', s.name,
    'owner_id', s.owner_id,
    'invite_code', s.invite_code,
    'icon_url', s.icon_url,
    'banner_url', s.banner_url,
    'is_published', s.is_published,
    'about', s.about,
    'created_at', s.created_at
  ) INTO result
  FROM servers s WHERE s.id = new_server_id;

  RETURN result;
END;
$$;

-- Update join_server_by_invite to include about in return
CREATE OR REPLACE FUNCTION public.join_server_by_invite(
  _invite_code text,
  _user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_server_id uuid;
  existing_member record;
  result json;
BEGIN
  -- Find server by invite code
  SELECT id INTO target_server_id
  FROM servers
  WHERE invite_code = upper(_invite_code);

  IF target_server_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  -- Check if already a member
  SELECT * INTO existing_member
  FROM server_members
  WHERE server_id = target_server_id AND user_id = _user_id;

  IF existing_member IS NOT NULL THEN
    IF existing_member.is_banned THEN
      RAISE EXCEPTION 'You are banned from this server';
    END IF;
    RAISE EXCEPTION 'You are already a member of this server';
  END IF;

  -- Join server
  INSERT INTO server_members (server_id, user_id, role)
  VALUES (target_server_id, _user_id, 'member');

  -- Return the server data
  SELECT json_build_object(
    'id', s.id,
    'name', s.name,
    'owner_id', s.owner_id,
    'invite_code', s.invite_code,
    'icon_url', s.icon_url,
    'banner_url', s.banner_url,
    'is_published', s.is_published,
    'about', s.about,
    'created_at', s.created_at
  ) INTO result
  FROM servers s WHERE s.id = target_server_id;

  RETURN result;
END;
$$;
