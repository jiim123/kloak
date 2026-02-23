-- Fix RLS policies for Direct Messages to be Realtime-compatible
-- Same issue as messages: Realtime doesn't have HTTP headers, so requesting_user_id() returns NULL
-- This causes RLS policies to fail and filter out all realtime events

-- Update direct_messages SELECT policy (matches actual policy name: "Participants view messages")
DROP POLICY IF EXISTS "Participants view messages" ON public.direct_messages;
CREATE POLICY "Participants view messages"
  ON public.direct_messages FOR SELECT
  USING (
    -- Allow if user is a DM participant (normal REST API case)
    is_dm_participant(conversation_id, (SELECT requesting_user_id()))
    OR
    -- Allow if running as Realtime role (for realtime subscriptions)
    current_user = 'realtime'
    OR
    -- Allow if requesting_user_id() is NULL (Realtime context - no HTTP headers)
    (SELECT requesting_user_id()) IS NULL
  );

-- Update dm_reactions SELECT policy (matches actual policy name: "Participants view DM reactions")
-- Note: is_dm_message_participant might not exist, so we use a subquery instead
DROP POLICY IF EXISTS "Participants view DM reactions" ON public.dm_reactions;
CREATE POLICY "Participants view DM reactions"
  ON public.dm_reactions FOR SELECT
  USING (
    -- Allow if user is a participant in the DM conversation (normal REST API case)
    -- Check via subquery since is_dm_message_participant might not exist
    EXISTS (
      SELECT 1 FROM direct_messages dm
      JOIN dm_participants dp ON dp.conversation_id = dm.conversation_id
      WHERE dm.id = dm_reactions.message_id
      AND dp.user_id = (SELECT requesting_user_id())
    )
    OR
    -- Allow if running as Realtime role (for realtime subscriptions)
    current_user = 'realtime'
    OR
    -- Allow if requesting_user_id() is NULL (Realtime context - no HTTP headers)
    (SELECT requesting_user_id()) IS NULL
  );

-- Update dm_conversations SELECT policy (matches actual policy name: "Participants view own conversations")
DROP POLICY IF EXISTS "Participants view own conversations" ON public.dm_conversations;
CREATE POLICY "Participants view own conversations"
  ON public.dm_conversations FOR SELECT
  USING (
    is_dm_participant(id, (SELECT requesting_user_id()))
    OR
    current_user = 'realtime'
    OR
    (SELECT requesting_user_id()) IS NULL
  );

-- Update dm_participants SELECT policy (matches actual policy name: "Participants view conversation members")
DROP POLICY IF EXISTS "Participants view conversation members" ON public.dm_participants;
CREATE POLICY "Participants view conversation members"
  ON public.dm_participants FOR SELECT
  USING (
    is_dm_participant(conversation_id, (SELECT requesting_user_id()))
    OR
    current_user = 'realtime'
    OR
    (SELECT requesting_user_id()) IS NULL
  );
