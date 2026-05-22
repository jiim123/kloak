CREATE OR REPLACE FUNCTION public.update_server(_server_id uuid, _user_id uuid, _updates jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _is_owner boolean := false;
  _current_is_published boolean := false;
  _updated_server public.servers%ROWTYPE;
  _headers json;
  _request_host text;
  _legacy_server_media_prefix text;
  _bunny_server_media_prefix text := 'https://kloakcdn.b-cdn.net/server-icons/';
  _allowed_fields text[] := ARRAY[
    'name','icon_url','banner_url','is_published','is_nsfw','about','timezone',
    'min_account_age_days','system_channel_join_id','system_channel_leave_id',
    'enable_join_messages','enable_leave_messages'
  ];
  _field text;
  _v_name text;
  _v_about text;
  _v_icon_url text;
  _v_banner_url text;
  _v_timezone text;
  _v_system_channel_join_id uuid;
  _v_system_channel_leave_id uuid;
  _v_enable_join_messages boolean;
  _v_enable_leave_messages boolean;
  _v_min_account_age_days integer;
  _publication_eligibility json;
  _can_publish boolean := false;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  IF _updates IS NULL OR jsonb_typeof(_updates) <> 'object' THEN
    RETURN json_build_object('success', false, 'error', 'Invalid updates payload');
  END IF;

  FOR _field IN SELECT jsonb_object_keys(_updates)
  LOOP
    IF NOT (_field = ANY (_allowed_fields)) THEN
      RETURN json_build_object('success', false, 'error', format('Unsupported server field: %s', _field));
    END IF;
  END LOOP;

  SELECT (s.owner_id = _user_id), s.is_published
    INTO _is_owner, _current_is_published
  FROM public.servers s
  WHERE s.id = _server_id;

  IF _is_owner IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Server not found');
  END IF;

  -- Permission gate: owner OR any member with manage_server (via full hierarchy)
  IF NOT _is_owner THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.server_members sm
      WHERE sm.server_id = _server_id AND sm.user_id = _user_id AND sm.is_banned = false
    ) THEN
      RETURN json_build_object('success', false, 'error', 'Not a member of this server');
    END IF;

    IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_server') THEN
      RETURN json_build_object('success', false, 'error', 'Insufficient permissions');
    END IF;
  END IF;

  -- Only enforce publication eligibility when transitioning unpublished -> published
  IF (_updates ? 'is_published')
     AND ((_updates->>'is_published')::boolean = true)
     AND COALESCE(_current_is_published, false) = false THEN
    SELECT public.get_server_publication_eligibility(_server_id, _user_id)
      INTO _publication_eligibility;
    _can_publish := COALESCE((_publication_eligibility->>'eligible')::boolean, false);
    IF NOT _can_publish THEN
      RETURN json_build_object('success', false, 'error', 'Server does not meet public server requirements', 'publication_eligibility', _publication_eligibility);
    END IF;
  END IF;

  _v_name := NULLIF(trim(_updates->>'name'), '');
  _v_about := NULLIF(trim(_updates->>'about'), '');
  _v_icon_url := NULLIF(trim(_updates->>'icon_url'), '');
  _v_banner_url := NULLIF(trim(_updates->>'banner_url'), '');
  _v_timezone := COALESCE(NULLIF(trim(_updates->>'timezone'), ''), 'UTC');

  IF (_updates ? 'name') THEN
    IF _v_name IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Server name cannot be empty');
    END IF;
    IF char_length(_v_name) > 50 THEN
      RETURN json_build_object('success', false, 'error', 'Server name must be 50 characters or fewer');
    END IF;
  END IF;

  IF (_updates ? 'about') AND _v_about IS NOT NULL AND char_length(_v_about) > 500 THEN
    RETURN json_build_object('success', false, 'error', 'About server must be 500 characters or fewer');
  END IF;

  IF (_updates ? 'timezone') AND NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = _v_timezone) THEN
    RETURN json_build_object('success', false, 'error', 'Invalid timezone');
  END IF;

  BEGIN
    _headers := current_setting('request.headers', true)::json;
  EXCEPTION WHEN OTHERS THEN
    _headers := '{}'::json;
  END;

  _request_host := lower(split_part(COALESCE(NULLIF(trim(_headers->>'x-forwarded-host'), ''), NULLIF(trim(_headers->>'host'), '')), ':', 1));

  IF _request_host IS NULL OR _request_host = '' THEN
    _legacy_server_media_prefix := NULL;
  ELSE
    _legacy_server_media_prefix := 'https://' || _request_host || '/storage/v1/object/public/server-media/';
  END IF;

  IF (_updates ? 'icon_url') AND _v_icon_url IS NOT NULL THEN
    IF NOT (
      _v_icon_url LIKE _bunny_server_media_prefix || '%'
      OR (_legacy_server_media_prefix IS NOT NULL AND _v_icon_url LIKE _legacy_server_media_prefix || '%')
    ) THEN
      RETURN json_build_object('success', false, 'error', 'Invalid icon URL');
    END IF;
  END IF;

  IF (_updates ? 'banner_url') AND _v_banner_url IS NOT NULL THEN
    IF NOT (
      _v_banner_url LIKE _bunny_server_media_prefix || '%'
      OR (_legacy_server_media_prefix IS NOT NULL AND _v_banner_url LIKE _legacy_server_media_prefix || '%')
    ) THEN
      RETURN json_build_object('success', false, 'error', 'Invalid banner URL');
    END IF;
  END IF;

  IF (_updates ? 'system_channel_join_id') THEN
    IF _updates->>'system_channel_join_id' IS NULL OR trim(_updates->>'system_channel_join_id') = '' THEN
      _v_system_channel_join_id := NULL;
    ELSE
      _v_system_channel_join_id := (_updates->>'system_channel_join_id')::uuid;
      IF NOT EXISTS (
        SELECT 1 FROM public.channels c
        WHERE c.id = _v_system_channel_join_id AND c.server_id = _server_id AND c.type = 'text'
      ) THEN
        RETURN json_build_object('success', false, 'error', 'Invalid system join channel');
      END IF;
    END IF;
  END IF;

  IF (_updates ? 'system_channel_leave_id') THEN
    IF _updates->>'system_channel_leave_id' IS NULL OR trim(_updates->>'system_channel_leave_id') = '' THEN
      _v_system_channel_leave_id := NULL;
    ELSE
      _v_system_channel_leave_id := (_updates->>'system_channel_leave_id')::uuid;
      IF NOT EXISTS (
        SELECT 1 FROM public.channels c
        WHERE c.id = _v_system_channel_leave_id AND c.server_id = _server_id AND c.type = 'text'
      ) THEN
        RETURN json_build_object('success', false, 'error', 'Invalid system leave channel');
      END IF;
    END IF;
  END IF;

  IF (_updates ? 'enable_join_messages') THEN
    _v_enable_join_messages := COALESCE((_updates->>'enable_join_messages')::boolean, true);
  END IF;
  IF (_updates ? 'enable_leave_messages') THEN
    _v_enable_leave_messages := COALESCE((_updates->>'enable_leave_messages')::boolean, true);
  END IF;
  IF (_updates ? 'min_account_age_days') THEN
    _v_min_account_age_days := GREATEST(0, LEAST(365, COALESCE((_updates->>'min_account_age_days')::integer, 0)));
  END IF;

  UPDATE public.servers s
  SET
    name = CASE WHEN _updates ? 'name' THEN _v_name ELSE s.name END,
    about = CASE WHEN _updates ? 'about' THEN _v_about ELSE s.about END,
    icon_url = CASE WHEN _updates ? 'icon_url' THEN _v_icon_url ELSE s.icon_url END,
    banner_url = CASE WHEN _updates ? 'banner_url' THEN _v_banner_url ELSE s.banner_url END,
    is_published = CASE WHEN _updates ? 'is_published' THEN COALESCE((_updates->>'is_published')::boolean, s.is_published) ELSE s.is_published END,
    is_nsfw = CASE WHEN _updates ? 'is_nsfw' THEN COALESCE((_updates->>'is_nsfw')::boolean, s.is_nsfw) ELSE s.is_nsfw END,
    timezone = CASE WHEN _updates ? 'timezone' THEN _v_timezone ELSE s.timezone END,
    min_account_age_days = CASE WHEN _updates ? 'min_account_age_days' THEN _v_min_account_age_days ELSE s.min_account_age_days END,
    system_channel_join_id = CASE WHEN _updates ? 'system_channel_join_id' THEN _v_system_channel_join_id ELSE s.system_channel_join_id END,
    system_channel_leave_id = CASE WHEN _updates ? 'system_channel_leave_id' THEN _v_system_channel_leave_id ELSE s.system_channel_leave_id END,
    enable_join_messages = CASE WHEN _updates ? 'enable_join_messages' THEN _v_enable_join_messages ELSE s.enable_join_messages END,
    enable_leave_messages = CASE WHEN _updates ? 'enable_leave_messages' THEN _v_enable_leave_messages ELSE s.enable_leave_messages END,
    updated_at = now()
  WHERE s.id = _server_id
  RETURNING * INTO _updated_server;

  RETURN json_build_object(
    'success', true,
    'server', json_build_object(
      'id', _updated_server.id,
      'name', _updated_server.name,
      'about', _updated_server.about,
      'icon_url', _updated_server.icon_url,
      'banner_url', _updated_server.banner_url,
      'is_published', _updated_server.is_published,
      'is_nsfw', _updated_server.is_nsfw,
      'timezone', _updated_server.timezone,
      'min_account_age_days', _updated_server.min_account_age_days,
      'system_channel_join_id', _updated_server.system_channel_join_id,
      'system_channel_leave_id', _updated_server.system_channel_leave_id,
      'enable_join_messages', _updated_server.enable_join_messages,
      'enable_leave_messages', _updated_server.enable_leave_messages,
      'owner_id', _updated_server.owner_id,
      'invite_code', _updated_server.invite_code,
      'created_at', _updated_server.created_at
    )
  );
END;
$function$;