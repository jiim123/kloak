-- Recipient lookup helpers for the dedicated Kloak websocket service.
-- These functions authenticate as the socket user and only expose the user IDs
-- that should receive realtime fanout for a message the caller just sent.

CREATE OR REPLACE FUNCTION public.get_socket_channel_recipients(
  _channel_id uuid,
  _sender_id uuid
)
RETURNS TABLE(user_id uuid, server_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  channel_record record;
BEGIN
  IF NOT public.verify_request_identity(_sender_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT c.id, c.server_id, c.is_private
  INTO channel_record
  FROM public.channels c
  WHERE c.id = _channel_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.server_members sm
    WHERE sm.server_id = channel_record.server_id
      AND sm.user_id = _sender_id
      AND COALESCE(sm.is_banned, false) = false
  ) THEN
    RAISE EXCEPTION 'Not authorized for this channel';
  END IF;

  IF COALESCE(channel_record.is_private, false) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.channel_members cm
      WHERE cm.channel_id = _channel_id
        AND cm.user_id = _sender_id
    ) THEN
      RAISE EXCEPTION 'Not authorized for this private channel';
    END IF;

    RETURN QUERY
    SELECT cm.user_id, channel_record.server_id
    FROM public.channel_members cm
    JOIN public.server_members sm
      ON sm.server_id = channel_record.server_id
     AND sm.user_id = cm.user_id
    WHERE cm.channel_id = _channel_id
      AND cm.user_id <> _sender_id
      AND COALESCE(sm.is_banned, false) = false;

    RETURN;
  END IF;

  RETURN QUERY
  SELECT sm.user_id, channel_record.server_id
  FROM public.server_members sm
  WHERE sm.server_id = channel_record.server_id
    AND sm.user_id <> _sender_id
    AND COALESCE(sm.is_banned, false) = false;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_socket_dm_recipients(
  _conversation_id uuid,
  _sender_id uuid
)
RETURNS TABLE(user_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.verify_request_identity(_sender_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.dm_participants dp
    WHERE dp.conversation_id = _conversation_id
      AND dp.user_id = _sender_id
  ) THEN
    RAISE EXCEPTION 'Not a participant in this conversation';
  END IF;

  RETURN QUERY
  SELECT dp.user_id
  FROM public.dm_participants dp
  WHERE dp.conversation_id = _conversation_id
    AND dp.user_id <> _sender_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_socket_channel_recipients(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_socket_dm_recipients(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_socket_channel_recipients(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_socket_dm_recipients(uuid, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.can_subscribe_socket_channel(
  _channel_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT public.can_access_channel(_channel_id, _user_id)
$$;

CREATE OR REPLACE FUNCTION public.can_subscribe_socket_dm(
  _conversation_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT
    _user_id IS NOT NULL
    AND public.verify_request_identity(_user_id)
    AND EXISTS (
      SELECT 1
      FROM public.dm_participants dp
      WHERE dp.conversation_id = _conversation_id
        AND dp.user_id = _user_id
    )
$$;

REVOKE EXECUTE ON FUNCTION public.can_subscribe_socket_channel(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_subscribe_socket_dm(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_subscribe_socket_channel(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_subscribe_socket_dm(uuid, uuid) TO anon, authenticated;
