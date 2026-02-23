-- Phase 6S:
-- 1) Bind relationship helper RPCs directly to verified caller identity.
-- 2) Harden request_client_identifier() to avoid spoofable limiter keys.

CREATE OR REPLACE FUNCTION public.request_client_identifier()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  headers json;
  id_text text;
  key_hash text;
  resolved_user_id uuid;
  forwarded_for text;
  forwarded_parts text[];
BEGIN
  BEGIN
    headers := current_setting('request.headers', true)::json;
  EXCEPTION WHEN OTHERS THEN
    RETURN 'unknown';
  END;

  key_hash := NULLIF(trim(headers->>'x-key-hash'), '');
  IF key_hash IS NOT NULL
     AND length(key_hash) = 64
     AND key_hash ~ '^[a-fA-F0-9]{64}$' THEN
    SELECT ua.user_id
      INTO resolved_user_id
    FROM public.user_auth ua
    WHERE ua.key_hash = key_hash
    LIMIT 1;

    IF resolved_user_id IS NOT NULL THEN
      RETURN left('user:' || resolved_user_id::text, 128);
    END IF;
  END IF;

  id_text := NULLIF(trim(headers->>'x-forwarded-for'), '');
  IF id_text IS NOT NULL THEN
    forwarded_for := id_text;
    forwarded_parts := regexp_split_to_array(forwarded_for, '\s*,\s*');
    IF array_length(forwarded_parts, 1) IS NOT NULL THEN
      id_text := NULLIF(trim(forwarded_parts[array_length(forwarded_parts, 1)]), '');
    END IF;
  END IF;

  IF id_text IS NULL THEN
    id_text := NULLIF(trim(headers->>'x-real-ip'), '');
  END IF;

  IF id_text IS NULL THEN
    id_text := NULLIF(trim(headers->>'cf-connecting-ip'), '');
  END IF;

  IF id_text IS NULL THEN
    RETURN 'unknown';
  END IF;

  RETURN left('ip:' || id_text, 128);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.request_client_identifier() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_client_identifier() TO service_role;

CREATE OR REPLACE FUNCTION public.is_friend_with(_user_id uuid, _other_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    _user_id IS NOT NULL
    AND _other_user_id IS NOT NULL
    AND public.verify_request_identity(_user_id)
    AND EXISTS (
      SELECT 1
      FROM public.friendships f
      WHERE f.status = 'accepted'
        AND (
          (f.requester_id = _user_id AND f.addressee_id = _other_user_id)
          OR (f.requester_id = _other_user_id AND f.addressee_id = _user_id)
        )
    )
$function$;

CREATE OR REPLACE FUNCTION public.shares_server_with(_user_id uuid, _other_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    _user_id IS NOT NULL
    AND _other_user_id IS NOT NULL
    AND public.verify_request_identity(_user_id)
    AND EXISTS (
      SELECT 1
      FROM public.server_members sm1
      JOIN public.server_members sm2
        ON sm1.server_id = sm2.server_id
      WHERE sm1.user_id = _user_id
        AND sm2.user_id = _other_user_id
        AND sm1.is_banned = false
        AND sm2.is_banned = false
    )
$function$;

CREATE OR REPLACE FUNCTION public.shares_dm_with(_user_id uuid, _other_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    _user_id IS NOT NULL
    AND _other_user_id IS NOT NULL
    AND public.verify_request_identity(_user_id)
    AND EXISTS (
      SELECT 1
      FROM public.dm_participants dp1
      JOIN public.dm_participants dp2
        ON dp1.conversation_id = dp2.conversation_id
      WHERE dp1.user_id = _user_id
        AND dp2.user_id = _other_user_id
    )
$function$;

REVOKE EXECUTE ON FUNCTION public.is_friend_with(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.shares_server_with(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.shares_dm_with(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_friend_with(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.shares_server_with(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.shares_dm_with(uuid, uuid) TO anon, authenticated, service_role;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
