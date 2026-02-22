-- Phase 4 (custom key-hash auth secure compatibility):
-- Keep app behavior working under anon runtime role, but move sensitive direct
-- table reads/writes behind identity-checked RPCs where practical.

-- Lightweight health check used by client connectivity probes.
CREATE OR REPLACE FUNCTION public.ping_health()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT true
$function$;

-- Safe preferences read for current user (replaces direct table selects).
CREATE OR REPLACE FUNCTION public.get_user_preferences(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT to_jsonb(up)
    INTO result
  FROM public.user_preferences up
  WHERE up.user_id = _user_id
  LIMIT 1;

  RETURN result;
END;
$function$;

-- Safe helper to resolve the other participant in a DM conversation for current user.
CREATE OR REPLACE FUNCTION public.get_dm_other_participant(_conversation_id uuid, _user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT dp.user_id
  FROM public.dm_participants dp
  WHERE dp.conversation_id = _conversation_id
    AND dp.user_id <> _user_id
    AND EXISTS (
      SELECT 1
      FROM public.dm_participants self_dp
      WHERE self_dp.conversation_id = _conversation_id
        AND self_dp.user_id = _user_id
    )
    AND (
      public.requesting_user_id() IS NULL
      OR _user_id = public.requesting_user_id()
    )
  LIMIT 1
$function$;

REVOKE EXECUTE ON FUNCTION public.ping_health() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_preferences(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_dm_other_participant(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ping_health() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_preferences(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_dm_other_participant(uuid, uuid) TO anon, authenticated;
