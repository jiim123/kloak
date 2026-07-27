-- Recipient lookup for websocket presence fanout.
-- The socket user may only request recipients for their own presence update.

CREATE OR REPLACE FUNCTION public.get_socket_presence_recipients(
  _user_id uuid
)
RETURNS TABLE(user_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Not authorized to resolve presence recipients for this user';
  END IF;

  RETURN QUERY
  SELECT DISTINCT recipient_id AS user_id
  FROM (
    SELECT sm_other.user_id AS recipient_id
    FROM public.server_members sm_self
    JOIN public.server_members sm_other
      ON sm_other.server_id = sm_self.server_id
    WHERE sm_self.user_id = _user_id
      AND sm_other.user_id <> _user_id
      AND COALESCE(sm_self.is_banned, false) = false
      AND COALESCE(sm_other.is_banned, false) = false

    UNION

    SELECT CASE
      WHEN f.requester_id = _user_id THEN f.addressee_id
      ELSE f.requester_id
    END AS recipient_id
    FROM public.friendships f
    WHERE f.status = 'accepted'::public.friendship_status
      AND (f.requester_id = _user_id OR f.addressee_id = _user_id)

    UNION

    SELECT dp_other.user_id AS recipient_id
    FROM public.dm_participants dp_self
    JOIN public.dm_participants dp_other
      ON dp_other.conversation_id = dp_self.conversation_id
    WHERE dp_self.user_id = _user_id
      AND dp_other.user_id <> _user_id
  ) recipients
  WHERE recipient_id IS NOT NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_socket_presence_recipients(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_socket_presence_recipients(uuid) TO anon, authenticated;
