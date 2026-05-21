CREATE OR REPLACE FUNCTION public.update_server(_server_id uuid, _user_id uuid, _updates jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _is_owner boolean := false;
  _user_role public.server_role;
  _updated_server public.servers%ROWTYPE;
  _headers json;
  _request_host text;
  _legacy_server_media_prefix text;
  _bunny_server_media_prefix text := 'https://kloakcdn.b-cdn.net/server-icons/';
  _allowed_fields text[] := ARRAY[
    'name',
    'icon_url',
    'banner_url',
    'is_published',
    'is_nsfw',
    'about',
    'min_account_age_days',
    'system_channel_join_id',
    'system_channel_leave_id',
    'enable_join_messages',
    'enable_leave_messages'
  ];
  _field text;
  _v_name text;
  _v_about text;
  _v_icon_url text;
  _v_banner_url text;
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

  SELECT (s.owner_id = _user_id)
    INTO _is_owner
  FROM public.servers s
  WHERE s.id = _server_id;

  IF _is_owner IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Server not found');
  END IF;

  SELECT sm.role INTO _user_role
  FROM public.server_members sm
  WHERE sm.server_id = _server_id
    AND sm.user_id = _user_id
    AND sm.is_banned = false;

  IF NOT _is_owner THEN
    IF _user_role IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Not a member of this server');
    END IF;

    IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_server'::permission_type) THEN
      RETURN json_build_object('success', false, 'error', 'Insufficient permissions');
    END IF;
  END IF;

  IF (_updates ? 'is_published') AND ((_updates->>'is_published')::boolean = true) THEN
    SELECT public.get_server_publication_eligibility(_server_id, _user_id)
      INTO _publication_eligibility;

    _can_publish := COALESCE((_publication_eligibility->>'eligible')::boolean, false);

    IF NOT _can_publish THEN
      RETURN json_build_object(
        'success', false,
        'error', CASE
          WHEN json_array_length(COALESCE(_publication_eligibility->'unmet_requirements', '[]'::json)) > 0
            THEN 'Server does not meet public server requirements: ' ||
                 array_to_string(ARRAY(SELECT json_array_elements_text(_publication_eligibility->'unmet_requirements')), '; ')
          ELSE 'Server does not meet public server requirements'
        END,
        'publication_eligibility', _publication_eligibility
      );
    END IF;
  END IF;

  _v_name := NULLIF(trim(_updates->>'name'), '');
  _v_about := NULLIF(trim(_updates->>'about'), '');
  _v_icon_url := NULLIF(trim(_updates->>'icon_url'), '');
  _v_banner_url := NULLIF(trim(_updates->>'banner_url'), '');

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

  BEGIN
    _headers := current_setting('request.headers', true)::json;
  EXCEPTION WHEN OTHERS THEN
    _headers := '{}'::json;
  END;

  _request_host := lower(
    split_part(
      COALESCE(NULLIF(trim(_headers->>'x-forwarded-host'), ''), NULLIF(trim(_headers->>'host'), '')),
      ':',
      1
    )
  );

  IF _request_host IS NULL OR _request_host = '' THEN
    RETURN json_build_object('success', false, 'error', 'Unable to validate media URL host');
  END IF;

  _legacy_server_media_prefix := 'https://' || _request_host || '/storage/v1/object/public/server-icons/';

  IF (_updates ? 'icon_url') AND _v_icon_url IS NOT NULL THEN
    IF char_length(_v_icon_url) > 2048 THEN
      RETURN json_build_object('success', false, 'error', 'Server icon URL must be 2048 characters or fewer');
    END IF;
    IF _v_icon_url !~* '^https?://[^[:space:]]+$' THEN
      RETURN json_build_object('success', false, 'error', 'Server icon URL must be a valid http(s) URL');
    END IF;
    IF _v_icon_url !~ '^[ -~]+$' THEN
      RETURN json_build_object('success', false, 'error', 'Server icon URL must use ASCII characters only');
    END IF;
    IF strpos(lower(_v_icon_url), _legacy_server_media_prefix) <> 1
       AND strpos(lower(_v_icon_url), _bunny_server_media_prefix) <> 1 THEN
      RETURN json_build_object('success', false, 'error', 'Server icon URL must be from this project''s server-icons bucket');
    END IF;
  END IF;

  IF (_updates ? 'banner_url') AND _v_banner_url IS NOT NULL THEN
    IF _v_banner_url <> '/default_server_banner.png' THEN
      IF char_length(_v_banner_url) > 2048 THEN
        RETURN json_build_object('success', false, 'error', 'Server banner URL must be 2048 characters or fewer');
      END IF;
      IF _v_banner_url !~* '^https?://[^[:space:]]+$' THEN
        RETURN json_build_object('success', false, 'error', 'Server banner URL must be a valid http(s) URL');
      END IF;
      IF _v_banner_url !~ '^[ -~]+$' THEN
        RETURN json_build_object('success', false, 'error', 'Server banner URL must use ASCII characters only');
      END IF;
      IF strpos(lower(_v_banner_url), _legacy_server_media_prefix) <> 1
         AND strpos(lower(_v_banner_url), _bunny_server_media_prefix) <> 1 THEN
        RETURN json_build_object('success', false, 'error', 'Server banner URL must be from this project''s server-icons bucket');
      END IF;
    END IF;
  END IF;

  IF (_updates ? 'system_channel_join_id') THEN
    IF _updates->'system_channel_join_id' IS NULL OR _updates->>'system_channel_join_id' IN ('', 'null', 'none') THEN
      _v_system_channel_join_id := NULL;
    ELSIF (_updates->>'system_channel_join_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      RETURN json_build_object('success', false, 'error', 'Join message channel ID is invalid');
    ELSE
      _v_system_channel_join_id := (_updates->>'system_channel_join_id')::uuid;
    END IF;
  END IF;

  IF (_updates ? 'system_channel_leave_id') THEN
    IF _updates->'system_channel_leave_id' IS NULL OR _updates->>'system_channel_leave_id' IN ('', 'null', 'none') THEN
      _v_system_channel_leave_id := NULL;
    ELSIF (_updates->>'system_channel_leave_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      RETURN json_build_object('success', false, 'error', 'Leave message channel ID is invalid');
    ELSE
      _v_system_channel_leave_id := (_updates->>'system_channel_leave_id')::uuid;
    END IF;
  END IF;

  IF (_updates ? 'system_channel_join_id') AND _v_system_channel_join_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.channels c
    WHERE c.id = _v_system_channel_join_id
      AND c.server_id = _server_id
      AND c.type IN ('text', 'announcement', 'forum', 'media')
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Join message channel must belong to this server');
  END IF;

  IF (_updates ? 'system_channel_leave_id') AND _v_system_channel_leave_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.channels c
    WHERE c.id = _v_system_channel_leave_id
      AND c.server_id = _server_id
      AND c.type IN ('text', 'announcement', 'forum', 'media')
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Leave message channel must belong to this server');
  END IF;

  _v_enable_join_messages := CASE
    WHEN _updates ? 'enable_join_messages' THEN (_updates->>'enable_join_messages')::boolean
    ELSE NULL
  END;
  _v_enable_leave_messages := CASE
    WHEN _updates ? 'enable_leave_messages' THEN (_updates->>'enable_leave_messages')::boolean
    ELSE NULL
  END;
  _v_min_account_age_days := NULL;
  IF (_updates ? 'min_account_age_days') THEN
    IF _updates->'min_account_age_days' IS NULL OR _updates->>'min_account_age_days' IN ('', 'null', 'none') THEN
      _v_min_account_age_days := 0;
    ELSIF (_updates->>'min_account_age_days') !~ '^[0-9]+$' THEN
      RETURN json_build_object('success', false, 'error', 'Minimum account age must be a non-negative integer');
    ELSE
      _v_min_account_age_days := (_updates->>'min_account_age_days')::integer;
    END IF;

    IF _v_min_account_age_days < 0 OR _v_min_account_age_days > 36500 THEN
      RETURN json_build_object('success', false, 'error', 'Minimum account age must be between 0 and 36500 days');
    END IF;
  END IF;

  IF COALESCE(_v_enable_join_messages, false)
     AND COALESCE(_v_system_channel_join_id, (
       SELECT s.system_channel_join_id
       FROM public.servers s
       WHERE s.id = _server_id
     )) IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Join messages require a system channel');
  END IF;

  IF COALESCE(_v_enable_leave_messages, false)
     AND COALESCE(_v_system_channel_leave_id, (
       SELECT s.system_channel_leave_id
       FROM public.servers s
       WHERE s.id = _server_id
     )) IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Leave messages require a system channel');
  END IF;

  UPDATE public.servers
  SET
    name = CASE WHEN _updates ? 'name' THEN _v_name ELSE name END,
    icon_url = CASE WHEN _updates ? 'icon_url' THEN _v_icon_url ELSE icon_url END,
    banner_url = CASE WHEN _updates ? 'banner_url' THEN _v_banner_url ELSE banner_url END,
    about = CASE WHEN _updates ? 'about' THEN _v_about ELSE about END,
    is_published = CASE WHEN _updates ? 'is_published' THEN (_updates->>'is_published')::boolean ELSE is_published END,
    is_nsfw = CASE WHEN _updates ? 'is_nsfw' THEN (_updates->>'is_nsfw')::boolean ELSE is_nsfw END,
    min_account_age_days = CASE WHEN _updates ? 'min_account_age_days' THEN _v_min_account_age_days ELSE min_account_age_days END,
    system_channel_join_id = CASE
      WHEN _updates ? 'system_channel_join_id' THEN _v_system_channel_join_id
      ELSE system_channel_join_id
    END,
    system_channel_leave_id = CASE
      WHEN _updates ? 'system_channel_leave_id' THEN _v_system_channel_leave_id
      ELSE system_channel_leave_id
    END,
    enable_join_messages = CASE
      WHEN _updates ? 'enable_join_messages' THEN (_updates->>'enable_join_messages')::boolean
      ELSE enable_join_messages
    END,
    enable_leave_messages = CASE
      WHEN _updates ? 'enable_leave_messages' THEN (_updates->>'enable_leave_messages')::boolean
      ELSE enable_leave_messages
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
      'about', _updated_server.about,
      'is_published', _updated_server.is_published,
      'is_nsfw', _updated_server.is_nsfw,
      'min_account_age_days', _updated_server.min_account_age_days,
      'owner_id', _updated_server.owner_id,
      'created_at', _updated_server.created_at,
      'system_channel_join_id', _updated_server.system_channel_join_id,
      'system_channel_leave_id', _updated_server.system_channel_leave_id,
      'enable_join_messages', _updated_server.enable_join_messages,
      'enable_leave_messages', _updated_server.enable_leave_messages
    )
  );
END;
$function$;