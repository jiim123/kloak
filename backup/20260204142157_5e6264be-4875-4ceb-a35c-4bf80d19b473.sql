-- RPC to update group DM name
CREATE OR REPLACE FUNCTION public.update_group_dm_name(
  _conversation_id uuid,
  _user_id uuid,
  _new_name text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_group boolean;
  v_is_participant boolean;
BEGIN
  -- Check if conversation exists and is a group
  SELECT is_group INTO v_is_group
  FROM dm_conversations
  WHERE id = _conversation_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;
  
  IF NOT COALESCE(v_is_group, false) THEN
    RAISE EXCEPTION 'Cannot rename a 1:1 conversation';
  END IF;
  
  -- Check if user is a participant
  SELECT EXISTS (
    SELECT 1 FROM dm_participants
    WHERE conversation_id = _conversation_id AND user_id = _user_id
  ) INTO v_is_participant;
  
  IF NOT v_is_participant THEN
    RAISE EXCEPTION 'User is not a participant';
  END IF;
  
  -- Update the name (NULL or empty string removes the name)
  UPDATE dm_conversations
  SET name = NULLIF(TRIM(_new_name), '')
  WHERE id = _conversation_id;
  
  RETURN json_build_object(
    'success', true,
    'name', NULLIF(TRIM(_new_name), '')
  );
END;
$$;

-- RPC to add members to a group DM
CREATE OR REPLACE FUNCTION public.add_group_dm_members(
  _conversation_id uuid,
  _user_id uuid,
  _new_member_ids uuid[]
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_group boolean;
  v_is_participant boolean;
  v_member_id uuid;
  v_added_count int := 0;
BEGIN
  -- Check if conversation exists and is a group
  SELECT is_group INTO v_is_group
  FROM dm_conversations
  WHERE id = _conversation_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;
  
  IF NOT COALESCE(v_is_group, false) THEN
    RAISE EXCEPTION 'Cannot add members to a 1:1 conversation';
  END IF;
  
  -- Check if user is a participant
  SELECT EXISTS (
    SELECT 1 FROM dm_participants
    WHERE conversation_id = _conversation_id AND user_id = _user_id
  ) INTO v_is_participant;
  
  IF NOT v_is_participant THEN
    RAISE EXCEPTION 'User is not a participant';
  END IF;
  
  -- Add each new member if not already in the group
  FOREACH v_member_id IN ARRAY _new_member_ids
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM dm_participants
      WHERE conversation_id = _conversation_id AND user_id = v_member_id
    ) THEN
      INSERT INTO dm_participants (conversation_id, user_id)
      VALUES (_conversation_id, v_member_id);
      v_added_count := v_added_count + 1;
    END IF;
  END LOOP;
  
  RETURN json_build_object(
    'success', true,
    'added_count', v_added_count
  );
END;
$$;

-- RPC to leave a group DM (with optional system message)
CREATE OR REPLACE FUNCTION public.leave_group_dm(
  _conversation_id uuid,
  _user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_group boolean;
  v_is_participant boolean;
  v_username text;
  v_display_name text;
  v_participant_count int;
BEGIN
  -- Check if conversation exists and is a group
  SELECT is_group INTO v_is_group
  FROM dm_conversations
  WHERE id = _conversation_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;
  
  IF NOT COALESCE(v_is_group, false) THEN
    RAISE EXCEPTION 'Cannot leave a 1:1 conversation';
  END IF;
  
  -- Check if user is a participant
  SELECT EXISTS (
    SELECT 1 FROM dm_participants
    WHERE conversation_id = _conversation_id AND user_id = _user_id
  ) INTO v_is_participant;
  
  IF NOT v_is_participant THEN
    RAISE EXCEPTION 'User is not a participant';
  END IF;
  
  -- Get username for the system message
  SELECT username, display_name INTO v_username, v_display_name
  FROM users
  WHERE id = _user_id;
  
  -- Send system message about leaving
  INSERT INTO direct_messages (conversation_id, sender_id, content)
  VALUES (
    _conversation_id,
    _user_id,
    '📤 ' || COALESCE(v_display_name, v_username) || ' has left the group chat'
  );
  
  -- Remove user from participants
  DELETE FROM dm_participants
  WHERE conversation_id = _conversation_id AND user_id = _user_id;
  
  -- Check remaining participant count
  SELECT COUNT(*) INTO v_participant_count
  FROM dm_participants
  WHERE conversation_id = _conversation_id;
  
  -- If only 1 or 0 participants left, delete the conversation
  IF v_participant_count <= 1 THEN
    DELETE FROM dm_conversations WHERE id = _conversation_id;
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'left_user', COALESCE(v_display_name, v_username)
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.update_group_dm_name(uuid, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_group_dm_members(uuid, uuid, uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.leave_group_dm(uuid, uuid) TO anon, authenticated;