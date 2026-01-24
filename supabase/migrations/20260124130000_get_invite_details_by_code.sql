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
    AND trim(si.code::text) = clean.code
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_invite_details_by_code(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_invite_details_by_code(text) TO authenticated;
