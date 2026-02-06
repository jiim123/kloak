
-- =============================================================
-- FIX: Banned users can rejoin servers & view channels
-- =============================================================

-- STEP 1: Drop the OLD 2-parameter join_server_by_invite (no ban check, causes PostgREST ambiguity)
DROP FUNCTION IF EXISTS public.join_server_by_invite(text, uuid);

-- STEP 2: Drop the OLD 1-parameter get_server_channels (returns all channels without membership check)
DROP FUNCTION IF EXISTS public.get_server_channels(uuid);

-- STEP 3: Replace get_server_channels (2-param) to enforce membership + ban check
CREATE OR REPLACE FUNCTION public.get_server_channels(_server_id uuid, _user_id uuid DEFAULT NULL::uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _is_admin boolean := false;
  _is_member boolean := false;
BEGIN
  -- If user_id provided, verify they are a non-banned member
  IF _user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM server_members 
      WHERE server_id = _server_id 
      AND user_id = _user_id 
      AND is_banned = false
    ) INTO _is_member;

    -- If not a non-banned member, return empty array
    IF NOT _is_member THEN
      RETURN '[]'::json;
    END IF;

    -- Check if admin/owner
    SELECT EXISTS (
      SELECT 1 FROM server_members 
      WHERE server_id = _server_id 
      AND user_id = _user_id 
      AND role IN ('owner', 'admin')
    ) INTO _is_admin;
  END IF;

  RETURN (
    SELECT COALESCE(json_agg(
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
      ) ORDER BY c.position
    ), '[]'::json)
    FROM channels c
    WHERE c.server_id = _server_id
    AND (
      NOT c.is_private
      OR _is_admin
      OR (_user_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM channel_members cm 
        WHERE cm.channel_id = c.id AND cm.user_id = _user_id
      ))
    )
  );
END;
$function$;

-- STEP 4: Replace get_server_categories to enforce membership + ban check
CREATE OR REPLACE FUNCTION public.get_server_categories(_server_id uuid, _user_id uuid DEFAULT NULL::uuid)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _is_member boolean := false;
BEGIN
  -- If user_id provided, verify they are a non-banned member
  IF _user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM server_members 
      WHERE server_id = _server_id 
      AND user_id = _user_id 
      AND is_banned = false
    ) INTO _is_member;

    IF NOT _is_member THEN
      RETURN '[]'::json;
    END IF;
  END IF;

  RETURN (
    SELECT COALESCE(json_agg(
      json_build_object(
        'id', cc.id,
        'server_id', cc.server_id,
        'name', cc.name,
        'position', cc.position,
        'is_collapsed', cc.is_collapsed,
        'created_at', cc.created_at
      ) ORDER BY cc.position
    ), '[]'::json)
    FROM channel_categories cc
    WHERE cc.server_id = _server_id
  );
END;
$function$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_server_channels(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_server_categories(uuid, uuid) TO anon, authenticated;
