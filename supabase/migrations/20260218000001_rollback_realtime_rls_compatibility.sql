-- ROLLBACK: Restore original RLS policies (remove Realtime compatibility)
-- Run this if the Realtime RLS fix causes issues

-- Restore original messages RLS policy (without Realtime role check)
DROP POLICY IF EXISTS "Server members view channel messages" ON public.messages;
CREATE POLICY "Server members view channel messages"
  ON public.messages FOR SELECT
  USING (
    is_channel_server_member(channel_id, (SELECT requesting_user_id()))
  );

-- Restore original reactions RLS policy (without Realtime role check)
DROP POLICY IF EXISTS "Reactions are viewable" ON public.reactions;
CREATE POLICY "Reactions are viewable"
  ON public.reactions FOR SELECT
  USING (
    is_channel_server_member(channel_id, (SELECT requesting_user_id()))
  );

-- Note: requesting_user_id() function is kept as-is since it handles both
-- REST API and Realtime contexts gracefully. If you need to fully rollback
-- the function as well, you may need to restore it from a previous migration
-- or recreate it based on your original implementation.
