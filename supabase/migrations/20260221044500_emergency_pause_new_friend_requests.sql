-- Emergency mitigation: pause creation of NEW friend requests from public clients.
-- Existing pending requests can still be accepted/declined using current RPCs.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.send_friend_request(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_friend_request(uuid, text) TO service_role;

COMMIT;

-- Optional rollback:
-- BEGIN;
-- GRANT EXECUTE ON FUNCTION public.send_friend_request(uuid, text) TO anon, authenticated;
-- COMMIT;
