-- Stop direct invite_code leakage through REST and public explore RPC output.

-- 1) Remove broad table SELECT and re-grant only safe columns.
--    Column-level REVOKE alone is ineffective when table-level SELECT is still granted.
REVOKE SELECT ON public.servers FROM anon, authenticated;

GRANT SELECT (
  id,
  name,
  icon_url,
  banner_url,
  owner_id,
  created_at,
  is_published,
  about,
  system_channel_join_id,
  system_channel_leave_id,
  enable_join_messages,
  enable_leave_messages
) ON public.servers TO anon, authenticated;

-- 2) Ensure explore listing never returns invite codes.
CREATE OR REPLACE FUNCTION public.get_explore_servers()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    json_agg(row_to_json(t) ORDER BY t.member_count DESC NULLS LAST, t.created_at DESC NULLS LAST),
    '[]'::json
  )
  FROM (
    SELECT
      s.id,
      s.name,
      s.icon_url,
      s.banner_url,
      s.owner_id,
      s.created_at,
      s.is_published,
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
