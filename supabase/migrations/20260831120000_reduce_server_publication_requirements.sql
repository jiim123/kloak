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

  _meets_server_age := _server.created_at <= (now() - interval '2 days');
  _meets_member_count := _member_count >= 0;
  _meets_message_count := _message_count_7d >= 0;
  _meets_about_length := _about_length >= 100;

  IF NOT _is_publishable THEN
    _unmet_requirements := array_append(_unmet_requirements, 'Publishing is disabled for this server');
  END IF;
  IF NOT _meets_server_age THEN
    _unmet_requirements := array_append(_unmet_requirements, 'Server must be at least 2 days old');
  END IF;
  IF NOT _meets_member_count THEN
    _unmet_requirements := array_append(_unmet_requirements, 'Server must have at least 0 members');
  END IF;
  IF NOT _meets_message_count THEN
    _unmet_requirements := array_append(_unmet_requirements, 'Server must have at least 0 messages in the last 7 days');
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
      json_build_object('key', 'server_age_days', 'label', 'Server age', 'met', _meets_server_age, 'current', _server_age_days, 'required', 2, 'unit', 'days'),
      json_build_object('key', 'member_count', 'label', 'Member count', 'met', _meets_member_count, 'current', _member_count, 'required', 0, 'unit', 'members'),
      json_build_object('key', 'messages_7d', 'label', 'Messages in last 7 days', 'met', _meets_message_count, 'current', _message_count_7d, 'required', 0, 'unit', 'messages'),
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
