-- Phase 6M:
-- 1) Fix remaining DM policy helper argument order mismatches.
-- 2) Lock app_config access to service_role only.

-- -------------------------------------------------------------------
-- DM policies: ensure is_dm_participant(conversation_id, user_id) order.
-- -------------------------------------------------------------------
DROP POLICY IF EXISTS "Participants can view conversations" ON public.dm_conversations;
CREATE POLICY "Participants can view conversations"
  ON public.dm_conversations
  FOR SELECT
  USING (
    (SELECT public.requesting_user_id()) IS NOT NULL
    AND public.is_dm_participant(
      id,
      (SELECT public.requesting_user_id())
    )
  );

DROP POLICY IF EXISTS "Participants view DM reactions" ON public.dm_reactions;
CREATE POLICY "Participants view DM reactions"
  ON public.dm_reactions
  FOR SELECT
  USING (
    (SELECT public.requesting_user_id()) IS NOT NULL
    AND public.is_dm_participant(
      public.get_dm_conversation_id(message_id),
      (SELECT public.requesting_user_id())
    )
  );

-- -------------------------------------------------------------------
-- app_config: service_role only.
-- -------------------------------------------------------------------
REVOKE ALL PRIVILEGES ON TABLE public.app_config FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.app_config TO service_role;

DROP POLICY IF EXISTS "App config read only" ON public.app_config;
DROP POLICY IF EXISTS "No public read" ON public.app_config;
DROP POLICY IF EXISTS "No public write" ON public.app_config;
DROP POLICY IF EXISTS "app_config_service_role_only" ON public.app_config;

CREATE POLICY "app_config_service_role_only"
  ON public.app_config
  AS PERMISSIVE
  FOR ALL
  TO PUBLIC
  USING (current_user = 'service_role')
  WITH CHECK (current_user = 'service_role');

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
