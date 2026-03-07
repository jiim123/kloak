
CREATE OR REPLACE FUNCTION public.close_poll(_poll_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _caller uuid;
  _poll record;
BEGIN
  _caller := public.requesting_user_id();
  IF _caller IS NULL OR NOT public.verify_request_identity(_caller) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT id, channel_id, is_closed INTO _poll
  FROM public.polls
  WHERE id = _poll_id;

  IF _poll.id IS NULL THEN
    RETURN false;
  END IF;

  IF _poll.is_closed THEN
    RETURN true;
  END IF;

  IF NOT public.can_access_channel(_poll.channel_id, _caller) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.polls
  SET is_closed = true
  WHERE id = _poll_id;

  PERFORM public.recompute_poll_results(_poll_id);

  RETURN true;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.close_poll(uuid) TO anon, authenticated;
