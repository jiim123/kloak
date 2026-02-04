-- Fix get_user_dm_conversations to include is_group and name columns
-- This fixes the bug where group chats revert to 1:1 DM appearance

CREATE OR REPLACE FUNCTION public.get_user_dm_conversations(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT json_agg(conv)
    FROM (
      SELECT json_build_object(
        'id', dc.id,
        'created_at', dc.created_at,
        'is_group', COALESCE(dc.is_group, false),
        'name', dc.name,
        'participants', (
          SELECT json_agg(json_build_object(
            'user_id', dp.user_id,
            'last_read_at', dp.last_read_at,
            'user', json_build_object(
              'id', u.id, 'username', u.username, 'display_name', u.display_name,
              'avatar_url', u.avatar_url, 'status', u.status
            )
          ))
          FROM dm_participants dp
          JOIN users u ON u.id = dp.user_id
          WHERE dp.conversation_id = dc.id
        ),
        'last_message', (
          SELECT json_build_object(
            'id', dm.id, 'content', dm.content, 'sender_id', dm.sender_id, 'created_at', dm.created_at
          )
          FROM direct_messages dm
          WHERE dm.conversation_id = dc.id
            AND NOT EXISTS (
              SELECT 1
              FROM friendships f
              WHERE f.status = 'blocked'
                AND ((f.requester_id = _user_id AND f.addressee_id = dm.sender_id)
                  OR (f.requester_id = dm.sender_id AND f.addressee_id = _user_id))
            )
          ORDER BY dm.created_at DESC
          LIMIT 1
        )
      ) as conv
      FROM dm_conversations dc
      WHERE EXISTS (
        SELECT 1 FROM dm_participants dp
        WHERE dp.conversation_id = dc.id AND dp.user_id = _user_id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM dm_participants dp_other
        WHERE dp_other.conversation_id = dc.id
          AND dp_other.user_id <> _user_id
          AND EXISTS (
            SELECT 1
            FROM friendships f
            WHERE f.status = 'blocked'
              AND ((f.requester_id = _user_id AND f.addressee_id = dp_other.user_id)
                OR (f.requester_id = dp_other.user_id AND f.addressee_id = _user_id))
          )
      )
      ORDER BY (
        SELECT MAX(dm.created_at)
        FROM direct_messages dm
        WHERE dm.conversation_id = dc.id
          AND NOT EXISTS (
            SELECT 1
            FROM friendships f
            WHERE f.status = 'blocked'
              AND ((f.requester_id = _user_id AND f.addressee_id = dm.sender_id)
                OR (f.requester_id = dm.sender_id AND f.addressee_id = _user_id))
          )
      ) DESC NULLS LAST, dc.created_at DESC
    ) sub
  );
END;
$$;