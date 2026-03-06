-- Harden account deletion RPC against caller-supplied user_id spoofing.
CREATE OR REPLACE FUNCTION public.delete_user_account(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _caller uuid;
  owned_server RECORD;
  new_owner_id uuid;
  member_count integer;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: user_id required';
  END IF;

  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  _caller := public.requesting_user_id();
  IF _caller IS NOT NULL AND _caller <> _user_id THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM users WHERE id = _user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  FOR owned_server IN SELECT id FROM servers WHERE owner_id = _user_id LOOP
    SELECT COUNT(*) INTO member_count
    FROM server_members
    WHERE server_id = owned_server.id AND user_id != _user_id AND is_banned = false;

    IF member_count = 0 THEN
      DELETE FROM channel_permissions WHERE channel_id IN (SELECT id FROM channels WHERE server_id = owned_server.id);
      DELETE FROM channel_reads WHERE channel_id IN (SELECT id FROM channels WHERE server_id = owned_server.id);
      DELETE FROM reactions WHERE message_id IN (SELECT id FROM messages WHERE channel_id IN (SELECT id FROM channels WHERE server_id = owned_server.id));
      DELETE FROM mentions WHERE message_id IN (SELECT id FROM messages WHERE channel_id IN (SELECT id FROM channels WHERE server_id = owned_server.id));
      DELETE FROM message_attachments WHERE message_id IN (SELECT id FROM messages WHERE channel_id IN (SELECT id FROM channels WHERE server_id = owned_server.id));
      DELETE FROM messages WHERE channel_id IN (SELECT id FROM channels WHERE server_id = owned_server.id);
      DELETE FROM channels WHERE server_id = owned_server.id;
      DELETE FROM channel_categories WHERE server_id = owned_server.id;
      DELETE FROM role_permissions WHERE server_id = owned_server.id;
      DELETE FROM server_member_roles WHERE member_id IN (SELECT id FROM server_members WHERE server_id = owned_server.id);
      DELETE FROM server_members WHERE server_id = owned_server.id;
      DELETE FROM server_roles WHERE server_id = owned_server.id;
      DELETE FROM servers WHERE id = owned_server.id;
    ELSE
      SELECT sm.user_id INTO new_owner_id
      FROM server_members sm
      WHERE sm.server_id = owned_server.id
        AND sm.user_id != _user_id
        AND sm.is_banned = false
        AND sm.role IN ('admin', 'owner')
      ORDER BY sm.joined_at ASC
      LIMIT 1;

      IF new_owner_id IS NULL THEN
        SELECT sm.user_id INTO new_owner_id
        FROM server_members sm
        WHERE sm.server_id = owned_server.id
          AND sm.user_id != _user_id
          AND sm.is_banned = false
        ORDER BY sm.joined_at ASC
        LIMIT 1;
      END IF;

      IF new_owner_id IS NOT NULL THEN
        UPDATE servers SET owner_id = new_owner_id WHERE id = owned_server.id;
        UPDATE server_members SET role = 'owner' WHERE server_id = owned_server.id AND user_id = new_owner_id;
      END IF;
    END IF;
  END LOOP;

  DELETE FROM reactions WHERE user_id = _user_id;
  DELETE FROM dm_reactions WHERE user_id = _user_id;
  DELETE FROM mentions WHERE user_id = _user_id;
  DELETE FROM notifications WHERE user_id = _user_id;
  DELETE FROM channel_reads WHERE user_id = _user_id;
  DELETE FROM message_attachments WHERE message_id IN (SELECT id FROM messages WHERE user_id = _user_id);
  DELETE FROM messages WHERE user_id = _user_id;
  DELETE FROM dm_attachments WHERE message_id IN (SELECT id FROM direct_messages WHERE sender_id = _user_id);
  DELETE FROM direct_messages WHERE sender_id = _user_id;
  DELETE FROM dm_participants WHERE user_id = _user_id;

  -- Nullify created_by on DM conversations this user created (so FK doesn't block deletion)
  UPDATE dm_conversations SET created_by = NULL WHERE created_by = _user_id;

  -- Clean up empty DM conversations (no participants left)
  DELETE FROM dm_conversations WHERE id NOT IN (SELECT DISTINCT conversation_id FROM dm_participants);

  DELETE FROM friendships WHERE requester_id = _user_id OR addressee_id = _user_id;
  DELETE FROM server_member_roles WHERE member_id IN (SELECT id FROM server_members WHERE user_id = _user_id);
  DELETE FROM server_members WHERE user_id = _user_id;
  DELETE FROM user_preferences WHERE user_id = _user_id;
  DELETE FROM users WHERE id = _user_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_user_account(uuid) TO anon, authenticated;
