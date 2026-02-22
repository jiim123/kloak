-- Block direct REST/table writes for friendship flows.
-- UI should use RPC paths (e.g., send_friend_request / accept_friend_request).

BEGIN;

-- Prevent direct writes to core friendship table from public client roles.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.friendships FROM anon, authenticated;

-- Prevent direct writes to declined-request cooldown table from public client roles.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.declined_friend_requests FROM anon, authenticated;

COMMIT;

-- Optional rollback:
-- BEGIN;
-- GRANT INSERT, UPDATE, DELETE ON TABLE public.friendships TO anon, authenticated;
-- GRANT INSERT, UPDATE, DELETE ON TABLE public.declined_friend_requests TO anon, authenticated;
-- COMMIT;
