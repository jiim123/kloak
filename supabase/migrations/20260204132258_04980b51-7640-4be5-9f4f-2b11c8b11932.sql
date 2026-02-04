-- Add group support columns to dm_conversations
ALTER TABLE dm_conversations
ADD COLUMN is_group boolean DEFAULT false,
ADD COLUMN name text;

-- Create group DM function
CREATE OR REPLACE FUNCTION create_group_dm(
  _creator_id uuid,
  _participant_ids uuid[],
  _name text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_conv_id uuid;
  result json;
BEGIN
  -- Validate at least 2 other participants
  IF array_length(_participant_ids, 1) < 2 THEN
    RAISE EXCEPTION 'Groups require at least 2 other participants';
  END IF;

  -- Create group conversation
  INSERT INTO dm_conversations (is_group, name)
  VALUES (true, _name)
  RETURNING id INTO new_conv_id;

  -- Add creator as participant
  INSERT INTO dm_participants (conversation_id, user_id)
  VALUES (new_conv_id, _creator_id);

  -- Add all other participants
  INSERT INTO dm_participants (conversation_id, user_id)
  SELECT new_conv_id, unnest(_participant_ids);

  -- Return conversation with participants
  SELECT json_build_object(
    'id', dc.id,
    'created_at', dc.created_at,
    'is_group', dc.is_group,
    'name', dc.name,
    'participants', (
      SELECT json_agg(json_build_object(
        'user_id', dp.user_id,
        'user', json_build_object(
          'id', u.id,
          'username', u.username,
          'display_name', u.display_name,
          'avatar_url', u.avatar_url,
          'status', u.status,
          'last_seen', u.last_seen
        )
      ))
      FROM dm_participants dp
      JOIN users u ON u.id = dp.user_id
      WHERE dp.conversation_id = dc.id
    )
  ) INTO result
  FROM dm_conversations dc
  WHERE dc.id = new_conv_id;

  RETURN result;
END;
$$;