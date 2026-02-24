-- Restore safe friend-request decline/cancel behavior while preserving
-- identity hardening added in phase6e.
--
-- Fixes:
-- 1) Addressee can decline incoming pending requests.
-- 2) Requester can cancel outgoing pending requests.
-- 3) Cooldown audit row is recorded only for true declines (addressee action).

CREATE OR REPLACE FUNCTION public.decline_friend_request(_friendship_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _friendship record;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT id, requester_id, addressee_id, status
    INTO _friendship
  FROM public.friendships
  WHERE id = _friendship_id
    AND status = 'pending'
    AND (_user_id = requester_id OR _user_id = addressee_id)
  FOR UPDATE;

  IF _friendship IS NULL THEN
    RAISE EXCEPTION 'Cannot decline this friend request';
  END IF;

  IF _friendship.addressee_id = _user_id THEN
    INSERT INTO public.declined_friend_requests (requester_id, addressee_id, declined_at)
    VALUES (_friendship.requester_id, _friendship.addressee_id, now())
    ON CONFLICT (requester_id, addressee_id)
    DO UPDATE SET declined_at = EXCLUDED.declined_at;
  END IF;

  DELETE FROM public.friendships
  WHERE id = _friendship.id;

  RETURN true;
END;
$function$;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
