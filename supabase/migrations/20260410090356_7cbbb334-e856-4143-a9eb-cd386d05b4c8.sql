CREATE OR REPLACE FUNCTION public.upload_server_emoji(
  _server_id uuid,
  _user_id uuid,
  _name text,
  _file_path text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_emoji server_emojis%ROWTYPE;
  emoji_count integer;
  _normalized_file_path text;
  _file_path_pattern text;
BEGIN
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT check_user_server_permission(_user_id, _server_id, 'manage_emojis') THEN
    RAISE EXCEPTION 'Permission denied: you do not have permission to manage emojis';
  END IF;

  IF _name !~ '^[a-z0-9_]{2,32}$' THEN
    RAISE EXCEPTION 'Invalid emoji name format';
  END IF;

  _normalized_file_path := NULLIF(trim(_file_path), '');
  IF _normalized_file_path IS NULL THEN
    RAISE EXCEPTION 'Invalid emoji file path';
  END IF;

  IF char_length(_normalized_file_path) > 255 THEN
    RAISE EXCEPTION 'Invalid emoji file path';
  END IF;

  IF NOT public.is_safe_storage_object_key('server-emojis', _normalized_file_path) THEN
    RAISE EXCEPTION 'Invalid emoji file path';
  END IF;

  _file_path_pattern :=
    '^' || _server_id::text || '/' || _name ||
    '-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpg|jpeg|gif|webp|avif)$';

  IF _normalized_file_path !~ _file_path_pattern THEN
    RAISE EXCEPTION 'Invalid emoji file path';
  END IF;

  SELECT count(*) INTO emoji_count
  FROM server_emojis
  WHERE server_id = _server_id;

  IF emoji_count >= 50 THEN
    RAISE EXCEPTION 'server emoji limit reached';
  END IF;

  INSERT INTO server_emojis (server_id, name, file_path, created_by)
  VALUES (_server_id, _name, _normalized_file_path, _user_id)
  RETURNING * INTO new_emoji;

  RETURN row_to_json(new_emoji);
END;
$$;