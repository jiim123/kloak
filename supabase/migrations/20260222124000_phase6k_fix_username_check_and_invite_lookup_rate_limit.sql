-- Phase 6K:
-- 1) Fix check_username_available read-only transaction error by making it VOLATILE.
-- 2) Add rate limiting to public invite lookup endpoint.

CREATE OR REPLACE FUNCTION public.check_username_available(_username text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _client_id text;
BEGIN
  _client_id := public.request_client_identifier();

  IF _client_id <> 'unknown'
     AND NOT public.check_rate_limit(_client_id, 'check_username_available', 90, 60) THEN
    RAISE EXCEPTION 'Rate limited: too many username checks';
  END IF;

  IF _username IS NULL THEN
    RETURN false;
  END IF;

  IF length(_username) < 3 OR length(_username) > 20 THEN
    RETURN false;
  END IF;

  IF _username !~ '^[a-z0-9_]+$' THEN
    RETURN false;
  END IF;

  RETURN NOT EXISTS (
    SELECT 1
    FROM public.users
    WHERE username = lower(_username)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_invite_details_by_code(_invite_code text)
RETURNS TABLE(
  id uuid,
  name varchar,
  icon_url text,
  banner_url text,
  about text,
  invite_code char(8),
  inviter_username text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _client_id text;
  _clean_code text;
BEGIN
  _clean_code := upper(trim(_invite_code));
  IF _clean_code IS NULL OR _clean_code = '' THEN
    RETURN;
  END IF;

  _client_id := public.request_client_identifier();
  IF _client_id <> 'unknown'
     AND NOT public.check_rate_limit(_client_id, 'invite_lookup', 60, 60) THEN
    RAISE EXCEPTION 'Rate limited: too many invite lookups';
  END IF;

  RETURN QUERY
  WITH clean AS (
    SELECT _clean_code as code
  )
  SELECT
    s.id,
    s.name,
    s.icon_url,
    s.banner_url,
    s.about,
    s.invite_code,
    ou.username as inviter_username
  FROM public.servers s
  JOIN clean ON true
  JOIN public.users ou ON ou.id = s.owner_id
  WHERE trim(s.invite_code::text) = clean.code

  UNION ALL

  SELECT
    s.id,
    s.name,
    s.icon_url,
    s.banner_url,
    s.about,
    (clean.code)::char(8) as invite_code,
    cu.username as inviter_username
  FROM public.server_invites si
  JOIN clean ON true
  JOIN public.servers s ON s.id = si.server_id
  JOIN public.users cu ON cu.id = si.created_by
  WHERE si.revoked_at IS NULL
    AND (si.expires_at IS NULL OR si.expires_at > now())
    AND (si.max_uses IS NULL OR si.uses_count < si.max_uses)
    AND trim(si.code::text) = clean.code
  LIMIT 1;
END;
$function$;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
