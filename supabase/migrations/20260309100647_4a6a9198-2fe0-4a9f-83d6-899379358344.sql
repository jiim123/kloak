-- Fix: direct_messages SELECT policy needs realtime role bypass
-- Without this, Supabase Realtime cannot deliver DM events
DROP POLICY IF EXISTS "DM participants can read messages" ON public.direct_messages;
CREATE POLICY "DM participants can read messages"
  ON public.direct_messages FOR SELECT
  USING (
    CASE
      WHEN CURRENT_USER IN ('realtime', 'supabase_realtime_admin') THEN true
      ELSE (
        (requesting_user_id() IS NOT NULL)
        AND EXISTS (
          SELECT 1 FROM dm_participants dp
          WHERE dp.conversation_id = direct_messages.conversation_id
            AND dp.user_id = requesting_user_id()
        )
      )
    END
  );

-- Fix: friendships SELECT policy needs realtime role bypass
DROP POLICY IF EXISTS "Users see own friendships" ON public.friendships;
CREATE POLICY "Users see own friendships"
  ON public.friendships FOR SELECT
  USING (
    CASE
      WHEN CURRENT_USER IN ('realtime', 'supabase_realtime_admin') THEN true
      ELSE (
        (requesting_user_id() IS NOT NULL)
        AND (
          requester_id = requesting_user_id()
          OR addressee_id = requesting_user_id()
        )
      )
    END
  );

-- Fix: dm_reactions SELECT policy needs realtime role bypass
DROP POLICY IF EXISTS "Participants view DM reactions" ON public.dm_reactions;
CREATE POLICY "Participants view DM reactions"
  ON public.dm_reactions FOR SELECT
  USING (
    CASE
      WHEN CURRENT_USER IN ('realtime', 'supabase_realtime_admin') THEN true
      ELSE (
        (requesting_user_id() IS NOT NULL)
        AND is_dm_participant(
          get_dm_conversation_id(message_id),
          requesting_user_id()
        )
      )
    END
  );

-- Fix: direct_messages needs REPLICA IDENTITY FULL for DELETE payloads
ALTER TABLE public.direct_messages REPLICA IDENTITY FULL;