-- Harden remaining RLS vulnerabilities reachable via direct REST/API calls.
-- Focus: keep normal app behavior, remove privilege-escalation and data-leak paths.

-- -------------------------------------------------------------------
-- server_members: remove unauthenticated read bypass and self-escalation updates.
-- -------------------------------------------------------------------
DROP POLICY IF EXISTS "Members viewable by fellow members only" ON public.server_members;
DROP POLICY IF EXISTS "Users update own non-role data" ON public.server_members;
DROP POLICY IF EXISTS "Users join as member" ON public.server_members;

CREATE POLICY "Members viewable by fellow members only"
  ON public.server_members
  FOR SELECT
  USING (
    CURRENT_USER = 'realtime'
    OR (
      (SELECT public.requesting_user_id()) IS NOT NULL
      AND public.is_server_member(server_id, (SELECT public.requesting_user_id()))
    )
  );

CREATE POLICY "Users update own non-role data"
  ON public.server_members
  FOR UPDATE
  USING (user_id = (SELECT public.requesting_user_id()))
  WITH CHECK (
    user_id = (SELECT public.requesting_user_id())
    -- Keep identity/sensitive moderation fields immutable for self-service updates.
    AND server_id = (
      SELECT sm.server_id
      FROM public.server_members sm
      WHERE sm.id = public.server_members.id
    )
    AND role = (
      SELECT sm.role
      FROM public.server_members sm
      WHERE sm.id = public.server_members.id
    )
    AND COALESCE(is_banned, false) = (
      SELECT COALESCE(sm.is_banned, false)
      FROM public.server_members sm
      WHERE sm.id = public.server_members.id
    )
    AND COALESCE(is_muted, false) = (
      SELECT COALESCE(sm.is_muted, false)
      FROM public.server_members sm
      WHERE sm.id = public.server_members.id
    )
  );

CREATE POLICY "Users join as member"
  ON public.server_members
  FOR INSERT
  WITH CHECK (
    user_id = (SELECT public.requesting_user_id())
    AND role = 'member'
    AND COALESCE(is_banned, false) = false
    AND (
      -- Public server discovery/join flow.
      EXISTS (
        SELECT 1
        FROM public.servers s
        WHERE s.id = public.server_members.server_id
          AND COALESCE(s.is_published, false) = true
      )
      -- Allow owner bootstrap row if client does direct insert during creation.
      OR EXISTS (
        SELECT 1
        FROM public.servers s
        WHERE s.id = public.server_members.server_id
          AND s.owner_id = (SELECT public.requesting_user_id())
      )
    )
  );

-- -------------------------------------------------------------------
-- channel_members: prevent arbitrary private-channel enrollment.
-- -------------------------------------------------------------------
DROP POLICY IF EXISTS "Server members can be added to channels" ON public.channel_members;

CREATE POLICY "Server members can be added to channels"
  ON public.channel_members
  FOR INSERT
  WITH CHECK (
    (SELECT public.requesting_user_id()) IS NOT NULL
    AND public.is_channel_server_member(channel_id, (SELECT public.requesting_user_id()))
    AND EXISTS (
      SELECT 1
      FROM public.channels c
      JOIN public.server_members sm
        ON sm.server_id = c.server_id
       AND sm.user_id = public.channel_members.user_id
      WHERE c.id = public.channel_members.channel_id
        AND COALESCE(sm.is_banned, false) = false
    )
    AND (
      -- Self-add only on non-private channels.
      (
        user_id = (SELECT public.requesting_user_id())
        AND EXISTS (
          SELECT 1
          FROM public.channels c
          WHERE c.id = public.channel_members.channel_id
            AND COALESCE(c.is_private, false) = false
        )
      )
      -- Managers can add/remove channel membership for private channels/users.
      OR public.check_user_server_permission(
        (SELECT public.requesting_user_id()),
        (SELECT c.server_id FROM public.channels c WHERE c.id = public.channel_members.channel_id),
        'manage_channels'
      )
    )
  );

-- -------------------------------------------------------------------
-- reactions: remove unauthenticated read bypass and require message/channel access on insert.
-- -------------------------------------------------------------------
DROP POLICY IF EXISTS "Reactions are viewable" ON public.reactions;
DROP POLICY IF EXISTS "Users add own reactions" ON public.reactions;

CREATE POLICY "Reactions are viewable"
  ON public.reactions
  FOR SELECT
  USING (
    CURRENT_USER = 'realtime'
    OR (
      (SELECT public.requesting_user_id()) IS NOT NULL
      AND public.can_access_channel(channel_id, (SELECT public.requesting_user_id()))
    )
  );

CREATE POLICY "Users add own reactions"
  ON public.reactions
  FOR INSERT
  WITH CHECK (
    user_id = (SELECT public.requesting_user_id())
    AND (SELECT public.requesting_user_id()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.messages m
      WHERE m.id = public.reactions.message_id
        AND m.channel_id = public.reactions.channel_id
        AND public.can_access_channel(m.channel_id, (SELECT public.requesting_user_id()))
    )
    AND public.check_user_permission(
      (SELECT public.requesting_user_id()),
      channel_id,
      'add_reactions'
    )
  );

-- -------------------------------------------------------------------
-- dm_reactions: fix participant check and enforce DM membership on writes.
-- -------------------------------------------------------------------
DROP POLICY IF EXISTS "Participants view DM reactions" ON public.dm_reactions;
DROP POLICY IF EXISTS "Users add own DM reactions" ON public.dm_reactions;

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

CREATE POLICY "Users add own DM reactions"
  ON public.dm_reactions
  FOR INSERT
  WITH CHECK (
    user_id = (SELECT public.requesting_user_id())
    AND (SELECT public.requesting_user_id()) IS NOT NULL
    AND public.is_dm_participant(
      public.get_dm_conversation_id(message_id),
      (SELECT public.requesting_user_id())
    )
  );

-- -------------------------------------------------------------------
-- threads / thread_messages: require access to target thread/channel on write.
-- -------------------------------------------------------------------
DROP POLICY IF EXISTS "Threads can be inserted" ON public.threads;
DROP POLICY IF EXISTS "Threads can be updated" ON public.threads;
DROP POLICY IF EXISTS "Thread messages can be inserted" ON public.thread_messages;
DROP POLICY IF EXISTS "Thread messages can be updated" ON public.thread_messages;

CREATE POLICY "Threads can be inserted"
  ON public.threads
  FOR INSERT
  WITH CHECK (
    created_by = (SELECT public.requesting_user_id())
    AND (SELECT public.requesting_user_id()) IS NOT NULL
    AND public.can_access_channel(channel_id, (SELECT public.requesting_user_id()))
    AND EXISTS (
      SELECT 1
      FROM public.messages m
      WHERE m.id = public.threads.message_id
        AND m.channel_id = public.threads.channel_id
        AND public.can_access_channel(m.channel_id, (SELECT public.requesting_user_id()))
    )
  );

CREATE POLICY "Threads can be updated"
  ON public.threads
  FOR UPDATE
  USING (created_by = (SELECT public.requesting_user_id()))
  WITH CHECK (
    created_by = (SELECT public.requesting_user_id())
    AND channel_id = (
      SELECT t.channel_id
      FROM public.threads t
      WHERE t.id = public.threads.id
    )
    AND message_id = (
      SELECT t.message_id
      FROM public.threads t
      WHERE t.id = public.threads.id
    )
  );

CREATE POLICY "Thread messages can be inserted"
  ON public.thread_messages
  FOR INSERT
  WITH CHECK (
    user_id = (SELECT public.requesting_user_id())
    AND (SELECT public.requesting_user_id()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.threads t
      WHERE t.id = public.thread_messages.thread_id
        AND public.can_access_channel(t.channel_id, (SELECT public.requesting_user_id()))
    )
  );

CREATE POLICY "Thread messages can be updated"
  ON public.thread_messages
  FOR UPDATE
  USING (user_id = (SELECT public.requesting_user_id()))
  WITH CHECK (
    user_id = (SELECT public.requesting_user_id())
    AND thread_id = (
      SELECT tm.thread_id
      FROM public.thread_messages tm
      WHERE tm.id = public.thread_messages.id
    )
  );

-- -------------------------------------------------------------------
-- message_attachments: only message owner may insert attachment rows.
-- -------------------------------------------------------------------
DROP POLICY IF EXISTS "Attachments insert by message sender" ON public.message_attachments;

CREATE POLICY "Attachments insert by message sender"
  ON public.message_attachments
  FOR INSERT
  WITH CHECK (
    (SELECT public.requesting_user_id()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.messages m
      WHERE m.id = public.message_attachments.message_id
        AND m.user_id = (SELECT public.requesting_user_id())
    )
  );

-- -------------------------------------------------------------------
-- friendships: remove broad update path and keep explicit state transitions.
-- -------------------------------------------------------------------
DROP POLICY IF EXISTS "Involved users can update" ON public.friendships;

CREATE POLICY "Involved users can update"
  ON public.friendships
  FOR UPDATE
  USING (
    requester_id = (SELECT public.requesting_user_id())
    OR addressee_id = (SELECT public.requesting_user_id())
  )
  WITH CHECK (
    requester_id = (
      SELECT f.requester_id
      FROM public.friendships f
      WHERE f.id = public.friendships.id
    )
    AND addressee_id = (
      SELECT f.addressee_id
      FROM public.friendships f
      WHERE f.id = public.friendships.id
    )
    AND (
      -- Requester can only keep pending or block.
      (
        requester_id = (SELECT public.requesting_user_id())
        AND status = ANY (ARRAY['pending'::public.friendship_status, 'blocked'::public.friendship_status])
      )
      OR
      -- Addressee can accept/decline/block.
      (
        addressee_id = (SELECT public.requesting_user_id())
        AND status = ANY (ARRAY['accepted'::public.friendship_status, 'declined'::public.friendship_status, 'blocked'::public.friendship_status])
      )
    )
  );

-- -------------------------------------------------------------------
-- storage.objects media policy: require channel access for matched media objects.
-- -------------------------------------------------------------------
DROP POLICY IF EXISTS "Media files follow channel visibility" ON storage.objects;

CREATE POLICY "Media files follow channel visibility"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'media'
    AND (SELECT public.requesting_user_id()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.media_items m
      JOIN public.channels c ON c.id = m.channel_id
      WHERE (
        storage.objects.name LIKE ('%' || m.media_url)
        OR m.media_url LIKE ('%' || storage.objects.name)
      )
        AND public.can_access_channel(c.id, (SELECT public.requesting_user_id()))
    )
  );
