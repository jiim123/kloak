-- Harden legacy server governance read RPCs against direct enumeration abuse.
-- - get_server_channels: forbid NULL/forged caller identity bypass.
-- - get_server_roles: require authenticated caller membership.

CREATE OR REPLACE FUNCTION public.get_server_channels(_server_id uuid, _user_id uuid DEFAULT NULL::uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _is_admin boolean := false;
  _is_member boolean := false;
  _caller uuid;
BEGIN
  _caller := public.requesting_user_id();

  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Prevent probing other users via forged _user_id values.
  IF _user_id IS NOT NULL AND _user_id <> _caller THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.server_members sm
    WHERE sm.server_id = _server_id
      AND sm.user_id = _caller
      AND COALESCE(sm.is_banned, false) = false
  )
  INTO _is_member;

  IF NOT _is_member THEN
    RETURN '[]'::json;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.server_members sm
    WHERE sm.server_id = _server_id
      AND sm.user_id = _caller
      AND sm.role IN ('owner', 'admin')
      AND COALESCE(sm.is_banned, false) = false
  )
  INTO _is_admin;

  RETURN (
    SELECT COALESCE(
      json_agg(
        json_build_object(
          'id', c.id,
          'server_id', c.server_id,
          'category_id', c.category_id,
          'name', c.name,
          'topic', c.topic,
          'type', c.type,
          'position', c.position,
          'is_nsfw', c.is_nsfw,
          'slowmode_seconds', c.slowmode_seconds,
          'is_read_only', c.is_read_only,
          'icon', c.icon,
          'is_private', c.is_private,
          'block_links', c.block_links,
          'allowed_link_domains', c.allowed_link_domains,
          'ghost_mode', c.ghost_mode,
          'created_at', c.created_at
        )
        ORDER BY c.position
      ),
      '[]'::json
    )
    FROM public.channels c
    WHERE c.server_id = _server_id
      AND (
        NOT c.is_private
        OR _is_admin
        OR EXISTS (
          SELECT 1
          FROM public.channel_members cm
          WHERE cm.channel_id = c.id
            AND cm.user_id = _caller
        )
      )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_server_roles(_server_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _caller uuid;
BEGIN
  _caller := public.requesting_user_id();

  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT public.is_server_member(_server_id, _caller) THEN
    RETURN '[]'::json;
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', sr.id,
          'server_id', sr.server_id,
          'name', sr.name,
          'color', sr.color,
          'position', sr.position,
          'created_at', sr.created_at
        )
        ORDER BY sr.position ASC, sr.created_at ASC
      )
      FROM public.server_roles sr
      WHERE sr.server_id = _server_id
    ),
    '[]'::json
  );
END;
$function$;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
