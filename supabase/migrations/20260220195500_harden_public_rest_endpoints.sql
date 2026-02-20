-- Harden public REST surface against unauthenticated PostgREST access.
-- Fixes:
-- 1) users table enumeration/update abuse
-- 2) direct_messages table read/write abuse
-- 3) user_auth table exposure
-- 4) attachments public-bucket scraping

-- -------------------------------------------------------------------
-- Helpers
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
-- users: remove open policies and require relationship-based visibility.
-- -------------------------------------------------------------------
DROP POLICY IF EXISTS "Users are viewable by everyone" ON public.users;
DROP POLICY IF EXISTS "Users are viewable by related users" ON public.users;
DROP POLICY IF EXISTS "Users are viewable" ON public.users;
DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own data" ON public.users;
DROP POLICY IF EXISTS "Anyone can register new account" ON public.users;

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
-- direct_messages: remove insecure realtime fallback and lock to participants.
-- -------------------------------------------------------------------
DROP POLICY IF EXISTS "DMs viewable by participants" ON public.direct_messages;
DROP POLICY IF EXISTS "DMs are viewable" ON public.direct_messages;
DROP POLICY IF EXISTS "Participants view messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Users can send DMs" ON public.direct_messages;
DROP POLICY IF EXISTS "DMs can be inserted" ON public.direct_messages;
DROP POLICY IF EXISTS "Users can edit DMs" ON public.direct_messages;
DROP POLICY IF EXISTS "DMs can be updated" ON public.direct_messages;
DROP POLICY IF EXISTS "Users can delete DMs" ON public.direct_messages;
DROP POLICY IF EXISTS "DMs can be deleted" ON public.direct_messages;

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
-- user_auth: ensure RLS is enabled and only self-row is accessible.
-- -------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.user_auth') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.user_auth ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "User auth is viewable" ON public.user_auth';
    EXECUTE 'DROP POLICY IF EXISTS "User auth can be inserted" ON public.user_auth';
    EXECUTE 'DROP POLICY IF EXISTS "User auth can be updated" ON public.user_auth';
    EXECUTE 'DROP POLICY IF EXISTS "User auth can be deleted" ON public.user_auth';
    EXECUTE 'DROP POLICY IF EXISTS "Users can view own auth row" ON public.user_auth';
    EXECUTE 'DROP POLICY IF EXISTS "Users can insert own auth row" ON public.user_auth';
    EXECUTE 'DROP POLICY IF EXISTS "Users can update own auth row" ON public.user_auth';
    EXECUTE 'DROP POLICY IF EXISTS "Users can delete own auth row" ON public.user_auth';

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

-- -------------------------------------------------------------------
-- storage.attachments: disable public bucket exposure + gate object reads.
-- -------------------------------------------------------------------
UPDATE storage.buckets
SET public = false
WHERE id = 'attachments';

DROP POLICY IF EXISTS "Attachments are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Attachments are publicly viewable" ON storage.objects;

CREATE POLICY "Attachments are readable by authorized users"
  ON storage.objects
  FOR SELECT
  TO public
  USING (
    bucket_id = 'attachments'
    AND (SELECT public.requesting_user_id()) IS NOT NULL
    AND (
      (storage.foldername(name))[1] = (SELECT public.requesting_user_id())::text
      OR EXISTS (
        SELECT 1
        FROM public.message_attachments ma
        JOIN public.messages m ON m.id = ma.message_id
        JOIN public.channels c ON c.id = m.channel_id
        JOIN public.server_members sm ON sm.server_id = c.server_id
        WHERE split_part(ma.file_url, '/attachments/', 2) = storage.objects.name
          AND sm.user_id = (SELECT public.requesting_user_id())
          AND COALESCE(sm.is_banned, false) = false
      )
      OR EXISTS (
        SELECT 1
        FROM public.dm_attachments da
        JOIN public.direct_messages dm ON dm.id = da.message_id
        JOIN public.dm_participants dp ON dp.conversation_id = dm.conversation_id
        WHERE split_part(da.file_url, '/attachments/', 2) = storage.objects.name
          AND dp.user_id = (SELECT public.requesting_user_id())
      )
    )
  );
