-- Remove DM SELECT policy bypasses that allow access when requesting_user_id() IS NULL
-- and/or current_user = 'realtime'. Keep strict participant-only access.

-- -------------------------------------------------------------------
-- dm_conversations
-- -------------------------------------------------------------------
DROP POLICY IF EXISTS "Participants view own conversations" ON public.dm_conversations;
DROP POLICY IF EXISTS "Participants can view conversations" ON public.dm_conversations;
DROP POLICY IF EXISTS "DM conversations are viewable" ON public.dm_conversations;

CREATE POLICY "Participants can view conversations"
  ON public.dm_conversations
  FOR SELECT
  USING (
    (SELECT public.requesting_user_id()) IS NOT NULL
    AND public.is_dm_participant((SELECT public.requesting_user_id()), dm_conversations.id)
  );

-- -------------------------------------------------------------------
-- dm_participants
-- -------------------------------------------------------------------
DROP POLICY IF EXISTS "Participants view conversation members" ON public.dm_participants;
DROP POLICY IF EXISTS "DM participants are viewable" ON public.dm_participants;

CREATE POLICY "Participants view conversation members"
  ON public.dm_participants
  FOR SELECT
  USING (
    (SELECT public.requesting_user_id()) IS NOT NULL
    AND public.is_dm_participant((SELECT public.requesting_user_id()), dm_participants.conversation_id)
  );

-- -------------------------------------------------------------------
-- dm_reactions
-- -------------------------------------------------------------------
DROP POLICY IF EXISTS "Participants view DM reactions" ON public.dm_reactions;
DROP POLICY IF EXISTS "DM reactions are viewable" ON public.dm_reactions;

CREATE POLICY "Participants view DM reactions"
  ON public.dm_reactions
  FOR SELECT
  USING (
    (SELECT public.requesting_user_id()) IS NOT NULL
    AND public.is_dm_participant(
      (SELECT public.requesting_user_id()),
      public.get_dm_conversation_id(dm_reactions.message_id)
    )
  );

-- -------------------------------------------------------------------
-- dm_attachments (remove duplicate SELECT policies; keep strict one)
-- -------------------------------------------------------------------
DROP POLICY IF EXISTS "Participants can view dm attachments" ON public.dm_attachments;
DROP POLICY IF EXISTS "Participants view DM attachments" ON public.dm_attachments;
DROP POLICY IF EXISTS "DM attachments are viewable" ON public.dm_attachments;

CREATE POLICY "Participants view DM attachments"
  ON public.dm_attachments
  FOR SELECT
  USING (
    (SELECT public.requesting_user_id()) IS NOT NULL
    AND public.is_dm_participant(
      (SELECT public.requesting_user_id()),
      public.get_dm_conversation_id(dm_attachments.message_id)
    )
  );
