-- Add server verification flag and expose it to explore listings.

ALTER TABLE public.servers
ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;

-- Keep direct REST column grants aligned with least-privilege column allow-list.
GRANT SELECT (is_verified) ON public.servers TO anon, authenticated;

-- Helpful for explore queries that separate verified and non-verified listings.
CREATE INDEX IF NOT EXISTS idx_servers_verified_published_created
  ON public.servers (is_verified, created_at DESC)
  WHERE is_published = true;

CREATE OR REPLACE FUNCTION public.get_explore_servers()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
      trim(s.invite_code::text) AS invite_code,
      s.owner_id,
      s.created_at,
      s.is_published,
      s.is_verified,
      s.about,
      (cnt.c::bigint) AS member_count
    FROM public.servers s
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
