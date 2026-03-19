-- Resolve only the specific custom emojis referenced in message text, without
-- exposing full server_emojis table visibility.
-- This keeps server_emojis RLS member-scoped while allowing cross-server render.

CREATE INDEX IF NOT EXISTS idx_server_emojis_name_created
  ON public.server_emojis (name, created_at, id);

CREATE INDEX IF NOT EXISTS idx_servers_name
  ON public.servers (name);

CREATE OR REPLACE FUNCTION public.resolve_custom_emojis_for_render(
  _names text[] DEFAULT '{}'::text[],
  _qualified text[] DEFAULT '{}'::text[]
)
RETURNS TABLE (
  lookup_key text,
  emoji_name text,
  server_name text,
  file_path text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _caller uuid;
  _safe_names text[];
  _safe_qualified text[];
BEGIN
  _caller := public.requesting_user_id();
  IF _caller IS NULL THEN
    RETURN;
  END IF;

  -- Hard caps to avoid abuse and expensive scans.
  _safe_names := (
    SELECT coalesce(array_agg(name), '{}'::text[])
    FROM (
      SELECT DISTINCT lower(trim(v)) AS name
      FROM unnest(coalesce(_names, '{}'::text[])) AS t(v)
      WHERE trim(v) ~ '^[a-z0-9_]{2,12}$'
      ORDER BY lower(trim(v))
      LIMIT 150
    ) s
  );

  _safe_qualified := (
    SELECT coalesce(array_agg(key), '{}'::text[])
    FROM (
      SELECT DISTINCT trim(v) AS key
      FROM unnest(coalesce(_qualified, '{}'::text[])) AS t(v)
      WHERE trim(v) ~ '^[a-z0-9_]{2,12}~[^:]{1,64}$'
      ORDER BY trim(v)
      LIMIT 150
    ) s
  );

  -- Unqualified keys: `name`
  RETURN QUERY
  WITH input_names AS (
    SELECT unnest(_safe_names) AS name
  )
  SELECT DISTINCT ON (se.name)
    se.name AS lookup_key,
    se.name AS emoji_name,
    s.name AS server_name,
    se.file_path
  FROM public.server_emojis se
  JOIN input_names i ON i.name = se.name
  JOIN public.servers s ON s.id = se.server_id
  ORDER BY se.name, se.created_at, se.id;

  -- Qualified keys: `name~Server Name`
  RETURN QUERY
  WITH raw_keys AS (
    SELECT unnest(_safe_qualified) AS key
  ),
  parsed AS (
    SELECT
      key,
      split_part(key, '~', 1) AS emoji_name,
      substring(key from position('~' in key) + 1) AS q_server_name
    FROM raw_keys
  )
  SELECT DISTINCT ON (p.key)
    p.key AS lookup_key,
    se.name AS emoji_name,
    s.name AS server_name,
    se.file_path
  FROM parsed p
  JOIN public.server_emojis se ON se.name = p.emoji_name
  JOIN public.servers s ON s.id = se.server_id AND s.name = p.q_server_name
  ORDER BY p.key, se.created_at, se.id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.resolve_custom_emojis_for_render(text[], text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_custom_emojis_for_render(text[], text[]) TO anon, authenticated;
