-- Restore Explore-page join behavior while limiting invite-code exposure.
-- Show invite_code only when request identity is present and verified.

CREATE OR REPLACE FUNCTION public.get_explore_servers()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH caller AS (
    SELECT public.requesting_user_id() AS uid
  )
  SELECT COALESCE(
    json_agg(row_to_json(t) ORDER BY t.is_verified DESC, t.member_count DESC NULLS LAST, t.created_at DESC NULLS LAST),
    '[]'::json
  )
  FROM (
    SELECT
      s.id,
      s.name,
      s.icon_url,
      s.banner_url,
      CASE
        WHEN c.uid IS NOT NULL AND public.verify_request_identity(c.uid)
          THEN trim(s.invite_code::text)
        ELSE NULL
      END AS invite_code,
      s.owner_id,
      s.created_at,
      s.is_published,
      s.is_verified,
      s.about,
      (cnt.c::bigint) AS member_count
    FROM public.servers s
    CROSS JOIN caller c
    LEFT JOIN (
      SELECT server_id, count(*) AS c
      FROM public.server_members
      WHERE is_banned IS NOT TRUE
      GROUP BY server_id
    ) cnt ON cnt.server_id = s.id
    WHERE s.is_published = true
  ) t;
$$;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
