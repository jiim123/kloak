CREATE TABLE IF NOT EXISTS public.server_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  code char(8) NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_server_invites_server_id ON public.server_invites(server_id);
CREATE INDEX IF NOT EXISTS idx_server_invites_code ON public.server_invites(code);

ALTER TABLE public.server_invites ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.create_server_invite(
  _server_id uuid,
  _user_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code char(8);
  try_count int := 0;
BEGIN
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_invites') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  LOOP
    try_count := try_count + 1;
    IF try_count > 25 THEN
      RAISE EXCEPTION 'Failed to generate a unique invite code';
    END IF;

    new_code := public.generate_invite_code();

    BEGIN
      INSERT INTO public.server_invites (server_id, code, created_by)
      VALUES (_server_id, new_code, _user_id);
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

CREATE OR REPLACE FUNCTION public.revoke_server_invite(
  _invite_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_server_id uuid;
BEGIN
  SELECT si.server_id INTO target_server_id
  FROM public.server_invites si
  WHERE si.id = _invite_id;

  IF target_server_id IS NULL THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, target_server_id, 'manage_invites') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.server_invites
  SET revoked_at = now(),
      revoked_by = _user_id
  WHERE id = _invite_id
    AND revoked_at IS NULL;

  RETURN true;
END;
$$;

DROP FUNCTION IF EXISTS public.get_server_by_invite_code(text);

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
    AND trim(si.code::text) = clean.code
  LIMIT 1;
$$;

DROP FUNCTION IF EXISTS public.join_server_by_invite(text, uuid);

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
BEGIN
  clean_code := upper(trim(_invite_code));

  SELECT s.id INTO target_server_id
  FROM public.servers s
  WHERE trim(s.invite_code::text) = clean_code;

  IF target_server_id IS NULL THEN
    SELECT si.server_id INTO target_server_id
    FROM public.server_invites si
    WHERE si.revoked_at IS NULL
      AND trim(si.code::text) = clean_code
    LIMIT 1;
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

GRANT EXECUTE ON FUNCTION public.create_server_invite(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.create_server_invite(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_server_invites(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.list_server_invites(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_server_invite(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.revoke_server_invite(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_server_by_invite_code(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_server_by_invite_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_server_by_invite(text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.join_server_by_invite(text, uuid) TO authenticated;
