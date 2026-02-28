-- Hotfix regex escaping in storage key validators (Postgres regex expects single backslash).

CREATE OR REPLACE FUNCTION public.is_safe_storage_object_key(_bucket_id text, _name text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v text := btrim(_name);
  segs text[];
  seg_count integer;
BEGIN
  IF _bucket_id IS NULL OR v IS NULL OR v = '' THEN
    RETURN false;
  END IF;

  IF char_length(v) > 255 THEN
    RETURN false;
  END IF;

  IF v ~ '[[:cntrl:]]' OR strpos(v, '\\') > 0 THEN
    RETURN false;
  END IF;

  IF left(v, 1) = '/' OR right(v, 1) = '/' OR strpos(v, '//') > 0 THEN
    RETURN false;
  END IF;

  IF v ~ '(^|/)\.\.?(/|$)' THEN
    RETURN false;
  END IF;

  segs := string_to_array(v, '/');
  seg_count := COALESCE(array_length(segs, 1), 0);

  IF seg_count < 2 THEN
    RETURN false;
  END IF;

  IF segs[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;

  CASE _bucket_id
    WHEN 'avatars' THEN
      RETURN seg_count = 2
        AND segs[2] ~* '^(avatar|banner)-[0-9]{10,20}\.(png|jpe?g|gif|webp|avif)$';

    WHEN 'server-icons' THEN
      RETURN seg_count = 2
        AND segs[2] ~* '^(icon|banner)(-[0-9]{10,20})?\.(png|jpe?g|gif|webp|avif)$';

    WHEN 'server-emojis' THEN
      RETURN seg_count = 2
        AND segs[2] ~ '^[a-z0-9_]{2,12}-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpe?g|gif|webp|avif)$';

    WHEN 'attachments' THEN
      RETURN seg_count >= 2 AND seg_count <= 6;

    ELSE
      RETURN true;
  END CASE;
END;
$$;

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
  _normalized_file_path text;
  _file_path_pattern text;
BEGIN
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT check_user_server_permission(_user_id, _server_id, 'manage_emojis') THEN
    RAISE EXCEPTION 'Permission denied: you do not have permission to manage emojis';
  END IF;

  IF _name !~ '^[a-z0-9_]{2,12}$' THEN
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

  PERFORM 1
  FROM storage.objects o
  WHERE o.bucket_id = 'server-emojis'
    AND o.name = _normalized_file_path;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Emoji file not found in storage';
  END IF;

  SELECT count(*) INTO emoji_count
  FROM server_emojis
  WHERE server_id = _server_id;

  IF emoji_count >= 1000 THEN
    RAISE EXCEPTION 'Server emoji limit reached (1000)';
  END IF;

  INSERT INTO server_emojis (server_id, name, file_path, created_by)
  VALUES (_server_id, _name, _normalized_file_path, _user_id)
  RETURNING * INTO new_emoji;

  RETURN row_to_json(new_emoji);
END;
$$;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;