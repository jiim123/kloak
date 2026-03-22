-- Token-issuance metadata lookup for voice channels.
-- This avoids direct table reads from Edge Functions and does not depend on
-- verify_request_identity() (the Edge function already authenticates user identity).

CREATE OR REPLACE FUNCTION public.get_voice_channel_meta_for_token(
  _channel_id uuid,
  _user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _channel_type public.channel_type;
  _voice_user_limit integer;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT public.has_channel_access(_channel_id, _user_id) THEN
    RAISE EXCEPTION 'Not allowed to join this voice channel';
  END IF;

  SELECT c.type, c.voice_user_limit
  INTO _channel_type, _voice_user_limit
  FROM public.channels c
  WHERE c.id = _channel_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', _channel_id,
    'type', _channel_type,
    'voice_user_limit', COALESCE(_voice_user_limit, 0)
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_voice_channel_meta_for_token(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_voice_channel_meta_for_token(uuid, uuid) TO anon, authenticated;
