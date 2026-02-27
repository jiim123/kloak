-- Enforce max emoji name length (2-12) in RPCs to prevent direct bypass.

CREATE OR REPLACE FUNCTION public.upload_server_emoji(
  _server_id uuid,
  _user_id uuid,
  _name text,
  _file_path text
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_emoji server_emojis%ROWTYPE;
  emoji_count integer;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  IF NOT check_user_server_permission(_user_id, _server_id, 'manage_emojis') THEN
    RAISE EXCEPTION 'Permission denied: you do not have permission to manage emojis';
  END IF;

  -- Validate name format (2-12 chars: a-z, 0-9, underscore)
  IF _name !~ '^[a-z0-9_]{2,12}$' THEN
    RAISE EXCEPTION 'Invalid emoji name format';
  END IF;

  -- Enforce 1000 emoji slot limit per server
  SELECT count(*) INTO emoji_count FROM server_emojis WHERE server_id = _server_id;
  IF emoji_count >= 1000 THEN
    RAISE EXCEPTION 'Server emoji limit reached (1000)';
  END IF;

  INSERT INTO server_emojis (server_id, name, file_path, created_by)
  VALUES (_server_id, _name, _file_path, _user_id)
  RETURNING * INTO new_emoji;
  RETURN row_to_json(new_emoji);
END;
$$;

CREATE OR REPLACE FUNCTION public.rename_server_emoji(
  _emoji_id uuid,
  _user_id uuid,
  _new_name text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _server_id UUID;
  _role TEXT;
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get the server this emoji belongs to
  SELECT server_id INTO _server_id
  FROM server_emojis
  WHERE id = _emoji_id;

  IF _server_id IS NULL THEN
    RAISE EXCEPTION 'Emoji not found';
  END IF;

  -- Check user's role in the server
  SELECT role INTO _role
  FROM server_members
  WHERE server_id = _server_id AND user_id = _user_id;

  IF _role IS NULL THEN
    RAISE EXCEPTION 'Not a member of this server';
  END IF;

  IF _role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- Validate name format
  IF _new_name !~ '^[a-z0-9_]{2,12}$' THEN
    RAISE EXCEPTION 'Invalid emoji name format';
  END IF;

  -- Update the emoji name
  UPDATE server_emojis
  SET name = _new_name
  WHERE id = _emoji_id AND server_id = _server_id;
END;
$$;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
