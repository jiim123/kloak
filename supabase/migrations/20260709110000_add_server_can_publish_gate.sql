ALTER TABLE public.servers
  ADD COLUMN IF NOT EXISTS can_publish boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.servers.can_publish IS
  'Admin-controlled gate for whether a server owner can publish the server to Explore.';

-- Direct table updates should not let owners undo an admin publication block.
REVOKE UPDATE (can_publish) ON public.servers FROM anon, authenticated;
GRANT SELECT (can_publish) ON public.servers TO anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_servers_publishable_published_created
  ON public.servers (created_at DESC)
  WHERE is_published = true AND can_publish = true;

CREATE OR REPLACE FUNCTION public.get_explore_servers()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH caller AS (
    SELECT public.requesting_user_id() AS uid
  )
  SELECT COALESCE(
    json_agg(row_to_json(t) ORDER BY t.is_verified DESC, t.member_count DESC NULLS LAST, t.created_at DESC NULLS LAST),
    '[]'::json
  )
  FROM (
    SELECT
      s.id,
      s.name,
      s.icon_url,
      s.banner_url,
      CASE
        WHEN c.uid IS NOT NULL AND public.verify_request_identity(c.uid)
          THEN trim(s.invite_code::text)
        ELSE NULL
      END AS invite_code,
      s.owner_id,
      s.created_at,
      s.is_published,
      s.is_verified,
      s.about,
      (cnt.c::bigint) AS member_count
    FROM public.servers s
    CROSS JOIN caller c
    LEFT JOIN (
      SELECT server_id, count(*) AS c
      FROM public.server_members
      WHERE is_banned IS NOT TRUE
      GROUP BY server_id
    ) cnt ON cnt.server_id = s.id
    WHERE s.is_published = true
      AND s.can_publish = true
  ) t;
$$;

CREATE OR REPLACE FUNCTION public.get_user_servers(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN (
    SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
    FROM (
      SELECT
        s.id,
        s.name,
        s.owner_id,
        s.invite_code,
        s.icon_url,
        s.banner_url,
        s.is_published,
        s.is_verified,
        s.can_publish,
        s.is_nsfw,
        s.about,
        s.timezone,
        s.system_channel_join_id,
        s.system_channel_leave_id,
        s.enable_join_messages,
        s.enable_leave_messages,
        s.min_account_age_days,
        s.created_at,
        sm.role,
        sm.nickname,
        sm.joined_at,
        sm.is_muted,
        sm.position
      FROM public.servers s
      INNER JOIN public.server_members sm ON sm.server_id = s.id
      WHERE sm.user_id = _user_id
        AND (sm.is_banned IS NULL OR sm.is_banned = false)
      ORDER BY sm.position ASC NULLS LAST, s.name ASC
    ) t
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_server_publication_eligibility(_server_id uuid, _user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _server public.servers%ROWTYPE;
  _user_role public.server_role;
  _member_count bigint := 0;
  _message_count_7d bigint := 0;
  _about_length integer := 0;
  _server_age_days integer := 0;
  _has_icon boolean := false;
  _has_banner boolean := false;
  _meets_server_age boolean := false;
  _meets_member_count boolean := false;
  _meets_message_count boolean := false;
  _meets_about_length boolean := false;
  _is_publishable boolean := true;
  _eligible boolean := false;
  _unmet_requirements text[] := ARRAY[]::text[];
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT s.*
    INTO _server
  FROM public.servers s
  WHERE s.id = _server_id;

  IF _server.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Server not found');
  END IF;

  SELECT sm.role
    INTO _user_role
  FROM public.server_members sm
  WHERE sm.server_id = _server_id
    AND sm.user_id = _user_id
    AND sm.is_banned = false;

  IF _server.owner_id <> _user_id AND _user_role <> 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;

  SELECT count(*)
    INTO _member_count
  FROM public.server_members sm
  WHERE sm.server_id = _server_id
    AND sm.is_banned IS NOT TRUE;

  SELECT count(*)
    INTO _message_count_7d
  FROM public.messages m
  JOIN public.channels c ON c.id = m.channel_id
  WHERE c.server_id = _server_id
    AND m.created_at >= (now() - interval '7 days');

  _about_length := char_length(COALESCE(trim(_server.about), ''));
  _server_age_days := GREATEST(floor(EXTRACT(epoch FROM (now() - _server.created_at)) / 86400)::integer, 0);
  _has_icon := NULLIF(trim(COALESCE(_server.icon_url, '')), '') IS NOT NULL;
  _has_banner := NULLIF(trim(COALESCE(_server.banner_url, '')), '') IS NOT NULL;
  _is_publishable := COALESCE(_server.can_publish, true);

  _meets_server_age := _server.created_at <= (now() - interval '7 days');
  _meets_member_count := _member_count >= 5;
  _meets_message_count := _message_count_7d >= 20;
  _meets_about_length := _about_length >= 100;

  IF NOT _is_publishable THEN
    _unmet_requirements := array_append(_unmet_requirements, 'Publishing is disabled for this server');
  END IF;
  IF NOT _meets_server_age THEN
    _unmet_requirements := array_append(_unmet_requirements, 'Server must be at least 7 days old');
  END IF;
  IF NOT _meets_member_count THEN
    _unmet_requirements := array_append(_unmet_requirements, 'Server must have at least 5 members');
  END IF;
  IF NOT _meets_message_count THEN
    _unmet_requirements := array_append(_unmet_requirements, 'Server must have at least 20 messages in the last 7 days');
  END IF;
  IF NOT _meets_about_length THEN
    _unmet_requirements := array_append(_unmet_requirements, 'Server description must be at least 100 characters');
  END IF;
  IF NOT _has_icon THEN
    _unmet_requirements := array_append(_unmet_requirements, 'Server icon is required');
  END IF;
  IF NOT _has_banner THEN
    _unmet_requirements := array_append(_unmet_requirements, 'Server banner is required');
  END IF;

  _eligible := cardinality(_unmet_requirements) = 0;

  RETURN json_build_object(
    'success', true,
    'eligible', _eligible,
    'can_publish', _is_publishable,
    'is_published', _server.is_published,
    'requirements', json_build_array(
      json_build_object('key', 'can_publish', 'label', 'Publishing allowed', 'met', _is_publishable, 'current', _is_publishable, 'required', true, 'unit', 'boolean'),
      json_build_object('key', 'server_age_days', 'label', 'Server age', 'met', _meets_server_age, 'current', _server_age_days, 'required', 7, 'unit', 'days'),
      json_build_object('key', 'member_count', 'label', 'Member count', 'met', _meets_member_count, 'current', _member_count, 'required', 5, 'unit', 'members'),
      json_build_object('key', 'messages_7d', 'label', 'Messages in last 7 days', 'met', _meets_message_count, 'current', _message_count_7d, 'required', 20, 'unit', 'messages'),
      json_build_object('key', 'about_length', 'label', 'About length', 'met', _meets_about_length, 'current', _about_length, 'required', 100, 'unit', 'characters'),
      json_build_object('key', 'has_icon', 'label', 'Server icon', 'met', _has_icon, 'current', _has_icon, 'required', true, 'unit', 'boolean'),
      json_build_object('key', 'has_banner', 'label', 'Server banner', 'met', _has_banner, 'current', _has_banner, 'required', true, 'unit', 'boolean')
    ),
    'counts', json_build_object(
      'server_age_days', _server_age_days,
      'member_count', _member_count,
      'messages_7d', _message_count_7d,
      'about_length', _about_length
    ),
    'unmet_requirements', to_json(_unmet_requirements)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_server(_server_id uuid, _user_id uuid, _updates jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _is_owner boolean := false;
  _current_is_published boolean := false;
  _current_can_publish boolean := true;
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

  SELECT (s.owner_id = _user_id), s.is_published, s.can_publish
    INTO _is_owner, _current_is_published, _current_can_publish
  FROM public.servers s
  WHERE s.id = _server_id;

  IF _is_owner IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Server not found');
  END IF;

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

  IF (_updates ? 'is_published')
     AND ((_updates->>'is_published')::boolean = true)
     AND COALESCE(_current_is_published, false) = false THEN
    IF NOT COALESCE(_current_can_publish, true) THEN
      RETURN json_build_object('success', false, 'error', 'Publishing is disabled for this server');
    END IF;

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
      'can_publish', _updated_server.can_publish,
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

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
