-- Fix runtime error 42702 in request_client_identifier():
-- "column reference key_hash is ambiguous"
-- Root cause: local PL/pgSQL variable name collides with user_auth.key_hash.

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
  request_key_hash text;
  resolved_user_id uuid;
  forwarded_for text;
  forwarded_parts text[];
BEGIN
  BEGIN
    headers := current_setting('request.headers', true)::json;
  EXCEPTION WHEN OTHERS THEN
    RETURN 'unknown';
  END;

  request_key_hash := NULLIF(trim(headers->>'x-key-hash'), '');
  IF request_key_hash IS NOT NULL
     AND length(request_key_hash) = 64
     AND request_key_hash ~ '^[a-fA-F0-9]{64}$' THEN
    SELECT ua.user_id
      INTO resolved_user_id
    FROM public.user_auth ua
    WHERE ua.key_hash = request_key_hash
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

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
