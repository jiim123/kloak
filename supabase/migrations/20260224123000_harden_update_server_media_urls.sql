-- Harden update_server media URLs:
-- Allow only this project's Storage public server-icons bucket URLs
-- (and legacy local default banner path) for icon_url/banner_url.

CREATE OR REPLACE FUNCTION public.update_server(_server_id uuid, _user_id uuid, _updates jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _user_role public.server_role;
  _updated_server public.servers%ROWTYPE;
  _headers json;
  _request_host text;
  _allowed_server_media_prefix text;
  _v_icon_url text;
  _v_banner_url text;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  IF _updates IS NULL OR jsonb_typeof(_updates) <> 'object' THEN
    RETURN json_build_object('success', false, 'error', 'Invalid updates payload');
  END IF;

  SELECT role INTO _user_role
  FROM public.server_members
  WHERE server_id = _server_id AND user_id = _user_id AND is_banned = false;

  IF _user_role IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not a member of this server');
  END IF;

  IF _user_role NOT IN ('owner', 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;

  IF (_updates ? 'is_published') AND ((_updates->>'is_published')::boolean = true) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'We''re rebuilding the Explore page. Publishing will be available soon.'
    );
  END IF;

  _v_icon_url := NULLIF(trim(_updates->>'icon_url'), '');
  _v_banner_url := NULLIF(trim(_updates->>'banner_url'), '');

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

  _allowed_server_media_prefix := 'https://' || _request_host || '/storage/v1/object/public/server-icons/';

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
    IF strpos(lower(_v_icon_url), _allowed_server_media_prefix) <> 1 THEN
      RETURN json_build_object('success', false, 'error', 'Server icon URL must be from this project''s server-icons bucket');
    END IF;
  END IF;

  IF (_updates ? 'banner_url') AND _v_banner_url IS NOT NULL THEN
    -- Keep compatibility with current create-server default banner path.
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
      IF strpos(lower(_v_banner_url), _allowed_server_media_prefix) <> 1 THEN
        RETURN json_build_object('success', false, 'error', 'Server banner URL must be from this project''s server-icons bucket');
      END IF;
    END IF;
  END IF;

  UPDATE public.servers
  SET
    name = COALESCE(_updates->>'name', name),
    icon_url = CASE WHEN _updates ? 'icon_url' THEN _v_icon_url ELSE icon_url END,
    banner_url = CASE WHEN _updates ? 'banner_url' THEN _v_banner_url ELSE banner_url END,
    about = CASE WHEN _updates ? 'about' THEN NULLIF(_updates->>'about', '') ELSE about END,
    is_published = CASE WHEN _updates ? 'is_published' THEN (_updates->>'is_published')::boolean ELSE is_published END,
    system_channel_join_id = CASE
      WHEN _updates ? 'system_channel_join_id' THEN
        CASE
          WHEN _updates->'system_channel_join_id' IS NULL
            OR _updates->>'system_channel_join_id' IN ('null', '', 'none') THEN NULL
          ELSE (_updates->>'system_channel_join_id')::uuid
        END
      ELSE system_channel_join_id
    END,
    system_channel_leave_id = CASE
      WHEN _updates ? 'system_channel_leave_id' THEN
        CASE
          WHEN _updates->'system_channel_leave_id' IS NULL
            OR _updates->>'system_channel_leave_id' IN ('null', '', 'none') THEN NULL
          ELSE (_updates->>'system_channel_leave_id')::uuid
        END
      ELSE system_channel_leave_id
    END,
    enable_join_messages = CASE WHEN _updates ? 'enable_join_messages' THEN (_updates->>'enable_join_messages')::boolean ELSE enable_join_messages END,
    enable_leave_messages = CASE WHEN _updates ? 'enable_leave_messages' THEN (_updates->>'enable_leave_messages')::boolean ELSE enable_leave_messages END
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

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
