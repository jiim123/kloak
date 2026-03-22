-- Add per-voice-channel user limit (0 = unlimited).
-- Enforced at token issuance time in the get-livekit-token Edge Function.

ALTER TABLE public.channels
  ADD COLUMN IF NOT EXISTS voice_user_limit integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.channels.voice_user_limit IS 'Maximum concurrent users allowed in a voice channel (0 = unlimited)';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'channels_voice_user_limit_nonnegative_chk'
      AND conrelid = 'public.channels'::regclass
  ) THEN
    ALTER TABLE public.channels
      ADD CONSTRAINT channels_voice_user_limit_nonnegative_chk
      CHECK (voice_user_limit >= 0);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_server_channels(_server_id uuid, _user_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _is_admin boolean := false;
  _is_member boolean := false;
  _caller uuid;
BEGIN
  _caller := public.requesting_user_id();

  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF _user_id IS NOT NULL AND _user_id <> _caller THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.server_members sm
    WHERE sm.server_id = _server_id
      AND sm.user_id = _caller
      AND COALESCE(sm.is_banned, false) = false
  )
  INTO _is_member;

  IF NOT _is_member THEN
    RETURN '[]'::json;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.server_members sm
    WHERE sm.server_id = _server_id
      AND sm.user_id = _caller
      AND sm.role IN ('owner', 'admin')
      AND COALESCE(sm.is_banned, false) = false
  )
  INTO _is_admin;

  RETURN (
    SELECT COALESCE(
      json_agg(
        json_build_object(
          'id', c.id,
          'server_id', c.server_id,
          'category_id', c.category_id,
          'linked_voice_channel_id', c.linked_voice_channel_id,
          'name', c.name,
          'topic', c.topic,
          'chat_notice', c.chat_notice,
          'type', c.type,
          'position', c.position,
          'is_nsfw', c.is_nsfw,
          'slowmode_seconds', c.slowmode_seconds,
          'is_read_only', c.is_read_only,
          'icon', c.icon,
          'is_private', c.is_private,
          'block_links', c.block_links,
          'allowed_link_domains', c.allowed_link_domains,
          'ghost_mode', c.ghost_mode,
          'voice_user_limit', c.voice_user_limit,
          'created_at', c.created_at
        )
        ORDER BY c.position
      ),
      '[]'::json
    )
    FROM public.channels c
    WHERE c.server_id = _server_id
      AND (
        NOT c.is_private
        OR _is_admin
        OR EXISTS (
          SELECT 1
          FROM public.channel_members cm
          WHERE cm.channel_id = c.id
            AND cm.user_id = _caller
        )
      )
      AND (
        _is_admin
        OR public.check_user_permission(_caller, c.id, 'view_channels'::permission_type)
      )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_channel(_channel_id uuid, _user_id uuid, _updates text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _server_id uuid;
  _parsed jsonb;
  _result jsonb;
  _chat_notice text;
  _voice_user_limit integer;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT server_id INTO _server_id
  FROM public.channels
  WHERE id = _channel_id;

  IF _server_id IS NULL THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_channels') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  _parsed := _updates::jsonb;
  _chat_notice := CASE
    WHEN _parsed ? 'chat_notice' THEN NULLIF(btrim(_parsed->>'chat_notice'), '')
    ELSE NULL
  END;

  IF _parsed ? 'chat_notice' AND _chat_notice IS NOT NULL AND char_length(_chat_notice) > 300 THEN
    RAISE EXCEPTION 'Chat notice must be 300 characters or fewer';
  END IF;

  IF _parsed ? 'voice_user_limit' THEN
    _voice_user_limit := COALESCE((_parsed->>'voice_user_limit')::int, 0);
    IF _voice_user_limit < 0 THEN
      RAISE EXCEPTION 'Voice user limit must be 0 or greater';
    END IF;
  ELSE
    _voice_user_limit := NULL;
  END IF;

  UPDATE public.channels
  SET
    name = COALESCE(_parsed->>'name', name),
    topic = CASE WHEN _parsed ? 'topic' THEN (_parsed->>'topic') ELSE topic END,
    chat_notice = CASE WHEN _parsed ? 'chat_notice' THEN _chat_notice ELSE chat_notice END,
    is_nsfw = COALESCE((_parsed->>'is_nsfw')::boolean, is_nsfw),
    slowmode_seconds = COALESCE((_parsed->>'slowmode_seconds')::int, slowmode_seconds),
    is_read_only = COALESCE((_parsed->>'is_read_only')::boolean, is_read_only),
    is_private = COALESCE((_parsed->>'is_private')::boolean, is_private),
    block_links = COALESCE((_parsed->>'block_links')::boolean, block_links),
    allowed_link_domains = CASE
      WHEN _parsed ? 'allowed_link_domains' THEN ARRAY(SELECT jsonb_array_elements_text(_parsed->'allowed_link_domains'))
      ELSE allowed_link_domains
    END,
    ghost_mode = CASE
      WHEN (_parsed->>'ghost_mode')::boolean = true THEN true
      ELSE ghost_mode
    END,
    voice_user_limit = CASE
      WHEN _parsed ? 'voice_user_limit' THEN _voice_user_limit
      ELSE voice_user_limit
    END,
    icon = CASE WHEN _parsed ? 'icon' THEN (_parsed->>'icon') ELSE icon END
  WHERE id = _channel_id;

  SELECT jsonb_build_object(
    'id', c.id, 'server_id', c.server_id, 'category_id', c.category_id,
    'linked_voice_channel_id', c.linked_voice_channel_id,
    'name', c.name, 'topic', c.topic, 'chat_notice', c.chat_notice, 'type', c.type, 'position', c.position,
    'is_nsfw', c.is_nsfw, 'slowmode_seconds', c.slowmode_seconds,
    'is_read_only', c.is_read_only, 'is_private', c.is_private,
    'block_links', c.block_links, 'allowed_link_domains', c.allowed_link_domains,
    'ghost_mode', c.ghost_mode, 'voice_user_limit', c.voice_user_limit, 'icon', c.icon, 'created_at', c.created_at
  ) INTO _result
  FROM public.channels c
  WHERE c.id = _channel_id;

  RETURN _result;
END;
$function$;
