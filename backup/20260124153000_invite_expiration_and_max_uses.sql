ALTER TABLE public.server_invites
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS max_uses integer,
  ADD COLUMN IF NOT EXISTS uses_count integer NOT NULL DEFAULT 0;

DROP FUNCTION IF EXISTS public.create_server_invite(uuid, uuid);
DROP FUNCTION IF EXISTS public.create_server_invite(uuid, uuid, integer, integer);

DROP FUNCTION IF EXISTS public.list_server_invites(uuid, uuid);

CREATE OR REPLACE FUNCTION public.create_server_invite(
  _server_id uuid,
  _user_id uuid,
  _expires_in_seconds integer DEFAULT NULL,
  _max_uses integer DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code char(8);
  try_count int := 0;
  expires_at_value timestamptz;
BEGIN
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_invites') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF _max_uses IS NOT NULL AND _max_uses < 1 THEN
    RAISE EXCEPTION 'max_uses must be at least 1';
  END IF;

  expires_at_value := CASE
    WHEN _expires_in_seconds IS NULL THEN NULL
    ELSE now() + make_interval(secs => _expires_in_seconds)
  END;

  LOOP
    try_count := try_count + 1;
    IF try_count > 25 THEN
      RAISE EXCEPTION 'Failed to generate a unique invite code';
    END IF;

    new_code := public.generate_invite_code();

    BEGIN
      INSERT INTO public.server_invites (server_id, code, created_by, expires_at, max_uses, uses_count)
      VALUES (_server_id, new_code, _user_id, expires_at_value, _max_uses, 0);
      EXIT;
    EXCEPTION WHEN unique_violation THEN
    END;
  END LOOP;

  RETURN trim(new_code::text);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_server_invites(
  _server_id uuid,
  _user_id uuid
)
RETURNS TABLE(
  id uuid,
  code text,
  created_at timestamptz,
  created_by uuid,
  created_by_username text,
  expires_at timestamptz,
  max_uses integer,
  uses_count integer,
  revoked_at timestamptz,
  revoked_by uuid,
  revoked_by_username text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    si.id,
    trim(si.code::text) as code,
    si.created_at,
    si.created_by,
    u.username as created_by_username,
    si.expires_at,
    si.max_uses,
    si.uses_count,
    si.revoked_at,
    si.revoked_by,
    ru.username as revoked_by_username
  FROM public.server_invites si
  JOIN public.users u ON u.id = si.created_by
  LEFT JOIN public.users ru ON ru.id = si.revoked_by
  WHERE si.server_id = _server_id
    AND public.check_user_server_permission(_user_id, _server_id, 'manage_invites')
  ORDER BY si.created_at DESC;
$$;

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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH clean AS (
    SELECT upper(trim(_invite_code)) as code
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
$$;

CREATE OR REPLACE FUNCTION public.get_server_by_invite_code(_invite_code text)
RETURNS TABLE(id uuid, name varchar, icon_url text, invite_code char(8))
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH clean AS (
    SELECT upper(trim(_invite_code)) as code
  )
  SELECT s.id, s.name, s.icon_url, s.invite_code
  FROM public.servers s
  JOIN clean ON true
  WHERE trim(s.invite_code::text) = clean.code

  UNION ALL

  SELECT s.id, s.name, s.icon_url, (clean.code)::char(8)
  FROM public.server_invites si
  JOIN clean ON true
  JOIN public.servers s ON s.id = si.server_id
  WHERE si.revoked_at IS NULL
    AND (si.expires_at IS NULL OR si.expires_at > now())
    AND (si.max_uses IS NULL OR si.uses_count < si.max_uses)
    AND trim(si.code::text) = clean.code
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.join_server_by_invite(_invite_code text, _user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_server_id uuid;
  existing_member record;
  result json;
  clean_code text;
  invite_row_id uuid;
  invite_max_uses integer;
  invite_uses_count integer;
  invite_expires_at timestamptz;
BEGIN
  clean_code := upper(trim(_invite_code));

  SELECT s.id INTO target_server_id
  FROM public.servers s
  WHERE trim(s.invite_code::text) = clean_code;

  IF target_server_id IS NULL THEN
    SELECT si.id, si.server_id, si.max_uses, si.uses_count, si.expires_at
      INTO invite_row_id, target_server_id, invite_max_uses, invite_uses_count, invite_expires_at
    FROM public.server_invites si
    WHERE si.revoked_at IS NULL
      AND trim(si.code::text) = clean_code
    FOR UPDATE
    LIMIT 1;

    IF invite_row_id IS NOT NULL THEN
      IF invite_expires_at IS NOT NULL AND invite_expires_at <= now() THEN
        RAISE EXCEPTION 'Invalid invite code';
      END IF;

      IF invite_max_uses IS NOT NULL AND invite_uses_count >= invite_max_uses THEN
        RAISE EXCEPTION 'Invalid invite code';
      END IF;
    END IF;
  END IF;

  IF target_server_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  SELECT * INTO existing_member
  FROM public.server_members
  WHERE server_id = target_server_id AND user_id = _user_id;

  IF existing_member IS NOT NULL THEN
    IF existing_member.is_banned THEN
      RAISE EXCEPTION 'You are banned from this server';
    END IF;
    RAISE EXCEPTION 'You are already a member of this server';
  END IF;

  INSERT INTO public.server_members (server_id, user_id, role)
  VALUES (target_server_id, _user_id, 'member');

  IF invite_row_id IS NOT NULL THEN
    UPDATE public.server_invites
    SET uses_count = uses_count + 1
    WHERE id = invite_row_id;
  END IF;

  SELECT json_build_object(
    'id', s.id,
    'name', s.name,
    'owner_id', s.owner_id,
    'invite_code', trim(s.invite_code::text),
    'icon_url', s.icon_url,
    'banner_url', s.banner_url,
    'about', s.about,
    'created_at', s.created_at
  ) INTO result
  FROM public.servers s WHERE s.id = target_server_id;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_server_invite(uuid, uuid, integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.create_server_invite(uuid, uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_server_invites(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.list_server_invites(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invite_details_by_code(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_invite_details_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_server_by_invite_code(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_server_by_invite_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_server_by_invite(text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.join_server_by_invite(text, uuid) TO authenticated;
