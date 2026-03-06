-- Add view_channels permission enforcement to get_server_channels
-- Currently only checks is_private + channel_members, ignoring role-based view_channels overrides
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
          'linked_voice_channel_id', c.linked_voice_channel_id,
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
      -- Private channel gate (existing)
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
      -- view_channels permission gate (NEW)
      -- Admins bypass; for others, check_user_permission evaluates
      -- channel overrides → role overrides → @everyone → base defaults
      AND (
        _is_admin
        OR public.check_user_permission(_caller, c.id, 'view_channels'::permission_type)
      )
  );
END;
$function$;