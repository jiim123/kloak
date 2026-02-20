-- Close remaining Discord-like security gaps:
-- 1) tighten direct REST writes for messages/thread reactions
-- 2) fix DM participant policy argument-order bugs
-- 3) prevent identity-swapping updates on key membership tables
-- 4) revoke client execute on debug/internal/trigger helper functions

-- -------------------------------------------------------------------
-- messages: require real channel access + permission on direct INSERT/UPDATE.
-- -------------------------------------------------------------------
DROP POLICY IF EXISTS "Users send messages as themselves only" ON public.messages;
DROP POLICY IF EXISTS "Users edit their own messages" ON public.messages;

CREATE POLICY "Users send messages as themselves only"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    user_id = (SELECT public.requesting_user_id())
    AND (SELECT public.requesting_user_id()) IS NOT NULL
    AND public.is_maintenance_active() = false
    AND public.can_access_channel(channel_id, (SELECT public.requesting_user_id()))
    AND public.check_user_permission(
      (SELECT public.requesting_user_id()),
      channel_id,
      'send_messages'
    )
  );

CREATE POLICY "Users edit their own messages"
  ON public.messages
  FOR UPDATE
  USING (
    user_id = (SELECT public.requesting_user_id())
    AND (SELECT public.requesting_user_id()) IS NOT NULL
    AND public.is_maintenance_active() = false
    AND public.can_access_channel(channel_id, (SELECT public.requesting_user_id()))
  )
  WITH CHECK (
    user_id = (SELECT public.requesting_user_id())
    AND (SELECT public.requesting_user_id()) IS NOT NULL
    AND public.is_maintenance_active() = false
    AND public.can_access_channel(channel_id, (SELECT public.requesting_user_id()))
  );

-- Prevent message identity reassignment through UPDATE.
CREATE OR REPLACE FUNCTION public.prevent_message_identity_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Message user_id cannot be changed';
  END IF;
  IF NEW.channel_id IS DISTINCT FROM OLD.channel_id THEN
    RAISE EXCEPTION 'Message channel_id cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_message_identity_change ON public.messages;
CREATE TRIGGER trg_prevent_message_identity_change
BEFORE UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.prevent_message_identity_change();

-- -------------------------------------------------------------------
-- dm_participants / dm_attachments: fix reversed is_dm_participant args.
-- -------------------------------------------------------------------
DROP POLICY IF EXISTS "Participants view conversation members" ON public.dm_participants;
CREATE POLICY "Participants view conversation members"
  ON public.dm_participants
  FOR SELECT
  USING (
    (SELECT public.requesting_user_id()) IS NOT NULL
    AND public.is_dm_participant(
      conversation_id,
      (SELECT public.requesting_user_id())
    )
  );

DROP POLICY IF EXISTS "Participants view DM attachments" ON public.dm_attachments;
CREATE POLICY "Participants view DM attachments"
  ON public.dm_attachments
  FOR SELECT
  USING (
    (SELECT public.requesting_user_id()) IS NOT NULL
    AND public.is_dm_participant(
      public.get_dm_conversation_id(message_id),
      (SELECT public.requesting_user_id())
    )
  );

-- Keep direct UPDATE limited and block conversation/user identity rewrites.
DROP POLICY IF EXISTS "Users update own participant record" ON public.dm_participants;
CREATE POLICY "Users update own participant record"
  ON public.dm_participants
  FOR UPDATE
  USING (user_id = (SELECT public.requesting_user_id()))
  WITH CHECK (user_id = (SELECT public.requesting_user_id()));

CREATE OR REPLACE FUNCTION public.prevent_dm_participant_identity_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'DM participant user_id cannot be changed';
  END IF;
  IF NEW.conversation_id IS DISTINCT FROM OLD.conversation_id THEN
    RAISE EXCEPTION 'DM participant conversation_id cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_dm_participant_identity_change ON public.dm_participants;
CREATE TRIGGER trg_prevent_dm_participant_identity_change
BEFORE UPDATE ON public.dm_participants
FOR EACH ROW
EXECUTE FUNCTION public.prevent_dm_participant_identity_change();

-- -------------------------------------------------------------------
-- thread_reactions: require thread/message integrity + channel access.
-- -------------------------------------------------------------------
DROP POLICY IF EXISTS "Thread reactions can be inserted" ON public.thread_reactions;
CREATE POLICY "Thread reactions can be inserted"
  ON public.thread_reactions
  FOR INSERT
  WITH CHECK (
    user_id = (SELECT public.requesting_user_id())
    AND (SELECT public.requesting_user_id()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.thread_messages tm
      JOIN public.threads t ON t.id = tm.thread_id
      WHERE tm.id = public.thread_reactions.message_id
        AND public.can_access_channel(t.channel_id, (SELECT public.requesting_user_id()))
        AND public.check_user_permission(
          (SELECT public.requesting_user_id()),
          t.channel_id,
          'add_reactions'
        )
    )
  );

-- -------------------------------------------------------------------
-- Revoke public execute from debug/internal trigger-style functions.
-- -------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS identity_args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (
        p.prorettype = 'pg_catalog.trigger'::regtype
        OR p.proname LIKE 'debug\_%' ESCAPE '\'
        OR p.proname IN (
          'handle_message_mentions',
          'handle_new_mention_ping',
          'increment_mention_count',
          'set_reaction_channel_id',
          'trigger_dm_notification',
          'trigger_mention_notification',
          'trigger_task_assignment_notification',
          'trigger_task_comment_notification',
          'trigger_task_status_notification'
        )
      )
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon, authenticated;',
      r.schema_name,
      r.function_name,
      r.identity_args
    );
  END LOOP;
END;
$$;
