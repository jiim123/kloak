-- Drop existing restrictive select policy and recreate with realtime exception
DROP POLICY IF EXISTS "Notifications are private and permission-based" ON public.notifications;

CREATE POLICY "Notifications are private and permission-based"
ON public.notifications
FOR SELECT
USING (
  -- Allow realtime role to read for live push delivery
  CURRENT_USER = 'realtime'
  OR (
    user_id = requesting_user_id()
    AND (
      (link !~~ '/channels/%')
      OR EXISTS (
        SELECT 1
        FROM channels c
        WHERE (
          notifications.link ~~ (('/channels/' || c.id) || '%')
          AND (
            c.is_private = false
            OR EXISTS (
              SELECT 1
              FROM channel_members cm
              WHERE cm.channel_id = c.id
              AND cm.user_id = requesting_user_id()
            )
          )
        )
      )
    )
  )
);