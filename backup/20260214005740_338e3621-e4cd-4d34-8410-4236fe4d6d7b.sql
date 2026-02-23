CREATE OR REPLACE FUNCTION public.upload_server_emoji(_server_id uuid, _user_id uuid, _name text, _file_path text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_emoji server_emojis%ROWTYPE;
  current_count integer;
BEGIN
  IF NOT check_user_server_permission(_user_id, _server_id, 'manage_emojis') THEN
    RAISE EXCEPTION 'Permission denied: you do not have permission to manage emojis';
  END IF;

  SELECT count(*) INTO current_count FROM server_emojis WHERE server_id = _server_id;
  IF current_count >= 1000 THEN
    RAISE EXCEPTION 'Server emoji limit reached (max 1000)';
  END IF;

  INSERT INTO server_emojis (server_id, name, file_path, created_by)
  VALUES (_server_id, _name, _file_path, _user_id)
  RETURNING * INTO new_emoji;
  RETURN row_to_json(new_emoji);
END;
$function$;