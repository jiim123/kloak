-- Force-lock sensitive tables by dropping ALL existing policies first.
-- This fixes cases where unknown legacy policies still allow public reads.

-- -------------------------------------------------------------------
-- Helper used by users SELECT policy
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_view_user(_target_user_id uuid, _requesting_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _requesting_user_id IS NOT NULL
    AND (
      _target_user_id = _requesting_user_id
      OR EXISTS (
        SELECT 1
        FROM server_members sm_target
        JOIN server_members sm_requester
          ON sm_requester.server_id = sm_target.server_id
        WHERE sm_target.user_id = _target_user_id
          AND sm_requester.user_id = _requesting_user_id
          AND COALESCE(sm_target.is_banned, false) = false
          AND COALESCE(sm_requester.is_banned, false) = false
      )
      OR EXISTS (
        SELECT 1
        FROM friendships f
        WHERE (
          (f.requester_id = _requesting_user_id AND f.addressee_id = _target_user_id)
          OR (f.requester_id = _target_user_id AND f.addressee_id = _requesting_user_id)
        )
          AND f.status = 'accepted'
      )
      OR EXISTS (
        SELECT 1
        FROM dm_participants dp_target
        JOIN dm_participants dp_requester
          ON dp_requester.conversation_id = dp_target.conversation_id
        WHERE dp_target.user_id = _target_user_id
          AND dp_requester.user_id = _requesting_user_id
      )
    );
$$;

-- -------------------------------------------------------------------
-- Drop all existing policies for target tables (unknown names included)
-- -------------------------------------------------------------------
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('users', 'direct_messages', 'user_auth')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- -------------------------------------------------------------------
-- Ensure RLS is active and enforced
-- -------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF to_regclass('public.user_auth') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.user_auth ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE public.user_auth FORCE ROW LEVEL SECURITY';
  END IF;
END $$;

-- -------------------------------------------------------------------
-- users policies
-- -------------------------------------------------------------------
CREATE POLICY "Users can view related users"
  ON public.users
  FOR SELECT
  USING (public.can_view_user(id, (SELECT public.requesting_user_id())));

CREATE POLICY "Users can update own record"
  ON public.users
  FOR UPDATE
  USING (id = (SELECT public.requesting_user_id()))
  WITH CHECK (id = (SELECT public.requesting_user_id()));

CREATE POLICY "Users can delete own record"
  ON public.users
  FOR DELETE
  USING (id = (SELECT public.requesting_user_id()));

-- -------------------------------------------------------------------
-- direct_messages policies
-- -------------------------------------------------------------------
CREATE POLICY "DM participants can read messages"
  ON public.direct_messages
  FOR SELECT
  USING (
    (SELECT public.requesting_user_id()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.dm_participants dp
      WHERE dp.conversation_id = direct_messages.conversation_id
        AND dp.user_id = (SELECT public.requesting_user_id())
    )
  );

CREATE POLICY "DM participants can send as self"
  ON public.direct_messages
  FOR INSERT
  WITH CHECK (
    sender_id = (SELECT public.requesting_user_id())
    AND EXISTS (
      SELECT 1
      FROM public.dm_participants dp
      WHERE dp.conversation_id = direct_messages.conversation_id
        AND dp.user_id = (SELECT public.requesting_user_id())
    )
  );

CREATE POLICY "DM senders can edit own messages"
  ON public.direct_messages
  FOR UPDATE
  USING (
    sender_id = (SELECT public.requesting_user_id())
    AND EXISTS (
      SELECT 1
      FROM public.dm_participants dp
      WHERE dp.conversation_id = direct_messages.conversation_id
        AND dp.user_id = (SELECT public.requesting_user_id())
    )
  )
  WITH CHECK (
    sender_id = (SELECT public.requesting_user_id())
    AND EXISTS (
      SELECT 1
      FROM public.dm_participants dp
      WHERE dp.conversation_id = direct_messages.conversation_id
        AND dp.user_id = (SELECT public.requesting_user_id())
    )
  );

CREATE POLICY "DM senders can delete own messages"
  ON public.direct_messages
  FOR DELETE
  USING (
    sender_id = (SELECT public.requesting_user_id())
    AND EXISTS (
      SELECT 1
      FROM public.dm_participants dp
      WHERE dp.conversation_id = direct_messages.conversation_id
        AND dp.user_id = (SELECT public.requesting_user_id())
    )
  );

-- -------------------------------------------------------------------
-- user_auth policies
-- -------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.user_auth') IS NOT NULL THEN
    EXECUTE '
      CREATE POLICY "Users can view own auth row"
      ON public.user_auth
      FOR SELECT
      USING (user_id = (SELECT public.requesting_user_id()))
    ';

    EXECUTE '
      CREATE POLICY "Users can insert own auth row"
      ON public.user_auth
      FOR INSERT
      WITH CHECK (
        user_id = (SELECT public.requesting_user_id())
        AND key_hash IS NOT NULL
      )
    ';

    EXECUTE '
      CREATE POLICY "Users can update own auth row"
      ON public.user_auth
      FOR UPDATE
      USING (user_id = (SELECT public.requesting_user_id()))
      WITH CHECK (user_id = (SELECT public.requesting_user_id()))
    ';

    EXECUTE '
      CREATE POLICY "Users can delete own auth row"
      ON public.user_auth
      FOR DELETE
      USING (user_id = (SELECT public.requesting_user_id()))
    ';
  END IF;
END $$;
