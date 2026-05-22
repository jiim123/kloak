ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS pinned_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz;

CREATE OR REPLACE FUNCTION public.pin_message(_message_id uuid, _user_id uuid, _pinned boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _channel_id uuid;
  _server_id uuid;
BEGIN
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT check_rate_limit(_user_id::text, 'pin_message', 5, 30) THEN
    RAISE EXCEPTION 'Rate limited: pinning/unpinning too fast';
  END IF;

  SELECT channel_id INTO _channel_id FROM messages WHERE id = _message_id;
  IF _channel_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;
  SELECT server_id INTO _server_id FROM channels WHERE id = _channel_id;
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT public.check_user_permission(_user_id, _channel_id, 'pin_messages'::permission_type) THEN
      RAISE EXCEPTION 'You do not have permission to pin messages';
    END IF;
  END IF;

  IF _pinned THEN
    UPDATE messages
      SET is_pinned = true,
          pinned_by = _user_id,
          pinned_at = now()
    WHERE id = _message_id;
  ELSE
    UPDATE messages
      SET is_pinned = false,
          pinned_by = NULL,
          pinned_at = NULL
    WHERE id = _message_id;
  END IF;
END;
$function$;