
CREATE OR REPLACE FUNCTION public.search_users_by_username(
  _query text,
  _requesting_user_id uuid,
  _limit integer DEFAULT 10
)
RETURNS TABLE(
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  avatar_decoration text,
  status text,
  last_seen timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _requesting_user_id IS NULL OR NOT public.verify_request_identity(_requesting_user_id) THEN
    RETURN;
  END IF;

  IF length(trim(_query)) < 2 OR length(_query) > 32 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.username::text,
    u.display_name::text,
    u.avatar_url::text,
    u.avatar_decoration::text,
    u.status::text,
    u.last_seen
  FROM public.users u
  WHERE u.username ILIKE (trim(_query) || '%')
    AND u.id != _requesting_user_id
  ORDER BY
    CASE WHEN lower(u.username) = lower(trim(_query)) THEN 0 ELSE 1 END,
    u.username
  LIMIT LEAST(_limit, 20);
END;
$$;
