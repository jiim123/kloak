-- Fix reset_user_secret_key() to update the canonical auth table.
-- The project now stores key hashes in public.user_auth, not public.users.key_hash.

CREATE OR REPLACE FUNCTION public.reset_user_secret_key(_user_id uuid, _new_key_hash character)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_last_reset timestamptz;
  v_cooldown_hours int := 24;
  v_time_remaining interval;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF _new_key_hash IS NULL OR _new_key_hash !~ '^[a-fA-F0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid key hash format';
  END IF;

  SELECT last_key_reset_at INTO v_last_reset
  FROM public.users
  WHERE id = _user_id;

  IF v_last_reset IS NOT NULL
     AND v_last_reset > (now() - (v_cooldown_hours || ' hours')::interval) THEN
    v_time_remaining := v_last_reset + (v_cooldown_hours || ' hours')::interval - now();
    RETURN json_build_object(
      'success', false,
      'error', 'cooldown',
      'cooldown_ends_at', v_last_reset + (v_cooldown_hours || ' hours')::interval,
      'hours_remaining', extract(epoch from v_time_remaining) / 3600
    );
  END IF;

  INSERT INTO public.user_auth (user_id, key_hash)
  VALUES (_user_id, _new_key_hash::text)
  ON CONFLICT (user_id)
  DO UPDATE SET key_hash = EXCLUDED.key_hash;

  UPDATE public.users
  SET last_key_reset_at = now()
  WHERE id = _user_id;

  RETURN json_build_object('success', true, 'last_key_reset_at', now());
END;
$function$;
