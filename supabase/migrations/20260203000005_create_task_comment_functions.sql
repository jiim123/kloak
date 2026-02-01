-- Function to create a task comment
CREATE OR REPLACE FUNCTION public.create_task_comment(
  _task_id uuid,
  _user_id uuid,
  _content text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  task_channel_id uuid;
  new_comment_id uuid;
  result json;
BEGIN
  -- Get task channel
  SELECT channel_id INTO task_channel_id
  FROM tasks
  WHERE id = _task_id;
  
  IF task_channel_id IS NULL THEN
    RETURN json_build_object('error', 'Task not found');
  END IF;
  
  -- Check permission: view_tasks (need to view to comment)
  IF NOT check_user_permission(_user_id, task_channel_id, 'view_tasks'::permission_type) THEN
    RETURN json_build_object('error', 'Permission denied: view_tasks');
  END IF;
  
  -- Insert comment
  INSERT INTO task_comments (task_id, user_id, content)
  VALUES (_task_id, _user_id, _content)
  RETURNING id INTO new_comment_id;
  
  -- Return the created comment
  SELECT json_build_object(
    'id', tc.id,
    'task_id', tc.task_id,
    'user_id', tc.user_id,
    'content', tc.content,
    'created_at', tc.created_at,
    'edited_at', tc.edited_at
  ) INTO result
  FROM task_comments tc
  WHERE tc.id = new_comment_id;
  
  RETURN result;
END;
$$;

-- Function to update a task comment
CREATE OR REPLACE FUNCTION public.update_task_comment(
  _comment_id uuid,
  _user_id uuid,
  _content text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comment_user_id uuid;
  result json;
BEGIN
  -- Get comment owner
  SELECT user_id INTO comment_user_id
  FROM task_comments
  WHERE id = _comment_id;
  
  IF comment_user_id IS NULL THEN
    RETURN json_build_object('error', 'Comment not found');
  END IF;
  
  -- Only the comment owner can edit
  IF comment_user_id != _user_id THEN
    RETURN json_build_object('error', 'Permission denied: can only edit own comments');
  END IF;
  
  -- Update comment
  UPDATE task_comments
  SET content = _content, edited_at = now()
  WHERE id = _comment_id;
  
  -- Return updated comment
  SELECT json_build_object(
    'id', tc.id,
    'task_id', tc.task_id,
    'user_id', tc.user_id,
    'content', tc.content,
    'created_at', tc.created_at,
    'edited_at', tc.edited_at
  ) INTO result
  FROM task_comments tc
  WHERE tc.id = _comment_id;
  
  RETURN result;
END;
$$;

-- Function to delete a task comment
CREATE OR REPLACE FUNCTION public.delete_task_comment(
  _comment_id uuid,
  _user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comment_user_id uuid;
  task_channel_id uuid;
  can_delete boolean := false;
BEGIN
  -- Get comment info
  SELECT tc.user_id, t.channel_id
  INTO comment_user_id, task_channel_id
  FROM task_comments tc
  JOIN tasks t ON t.id = tc.task_id
  WHERE tc.id = _comment_id;
  
  IF comment_user_id IS NULL THEN
    RETURN json_build_object('error', 'Comment not found');
  END IF;
  
  -- Comment owner can delete
  IF comment_user_id = _user_id THEN
    can_delete := true;
  END IF;
  
  -- Users with manage_messages can delete any comment
  IF NOT can_delete AND task_channel_id IS NOT NULL THEN
    can_delete := check_user_permission(_user_id, task_channel_id, 'manage_messages'::permission_type);
  END IF;
  
  IF NOT can_delete THEN
    RETURN json_build_object('error', 'Permission denied: delete comment');
  END IF;
  
  -- Delete comment
  DELETE FROM task_comments WHERE id = _comment_id;
  
  RETURN json_build_object('success', true);
END;
$$;

-- Function to get task comments
CREATE OR REPLACE FUNCTION public.get_task_comments(
  _task_id uuid,
  _user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  task_channel_id uuid;
  result json;
BEGIN
  -- Get task channel
  SELECT channel_id INTO task_channel_id
  FROM tasks
  WHERE id = _task_id;
  
  IF task_channel_id IS NULL THEN
    RETURN json_build_object('error', 'Task not found');
  END IF;
  
  -- Check permission: view_tasks
  IF NOT check_user_permission(_user_id, task_channel_id, 'view_tasks'::permission_type) THEN
    RETURN json_build_object('error', 'Permission denied: view_tasks');
  END IF;
  
  -- Get comments
  SELECT json_agg(
    json_build_object(
      'id', tc.id,
      'task_id', tc.task_id,
      'user_id', tc.user_id,
      'content', tc.content,
      'created_at', tc.created_at,
      'edited_at', tc.edited_at
    )
    ORDER BY tc.created_at ASC
  ) INTO result
  FROM task_comments tc
  WHERE tc.task_id = _task_id;
  
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_task_comment(uuid, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_task_comment(uuid, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_task_comment(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_task_comments(uuid, uuid) TO anon, authenticated;
