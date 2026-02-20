-- Eliminate OR-bypass risk by ensuring a single strict SELECT policy
-- on server_invites and message_attachments.

-- -------------------------------------------------------------------
-- server_invites: only users with manage_invites permission can read rows.
-- Public invite lookup should go through SECURITY DEFINER RPCs instead.
-- -------------------------------------------------------------------
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'server_invites'
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

CREATE POLICY "Server invites readable by managers"
  ON public.server_invites
  FOR SELECT
  USING (
    (SELECT public.requesting_user_id()) IS NOT NULL
    AND public.check_user_server_permission(
      (SELECT public.requesting_user_id()),
      server_id,
      'manage_invites'
    )
  );

-- -------------------------------------------------------------------
-- message_attachments: readable only if requester can access the parent channel.
-- -------------------------------------------------------------------
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'message_attachments'
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

CREATE POLICY "Message attachments readable by channel access"
  ON public.message_attachments
  FOR SELECT
  USING (
    (SELECT public.requesting_user_id()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.messages m
      WHERE m.id = message_attachments.message_id
        AND public.can_access_channel(m.channel_id, (SELECT public.requesting_user_id()))
    )
  );
