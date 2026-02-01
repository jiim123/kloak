-- Add reply_to_id column to task_comments table
ALTER TABLE public.task_comments
ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.task_comments(id) ON DELETE CASCADE;

-- Create index for reply_to_id
CREATE INDEX IF NOT EXISTS idx_task_comments_reply_to_id ON public.task_comments(reply_to_id);

-- Update create_task_comment function to support replies
CREATE OR REPLACE FUNCTION public.create_task_comment(
  _task_id uuid,
  _user_id uuid,
  _content text,
  _reply_to_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  task_channel_id uuid;
  new_comment_id uuid;
  reply_to_task_id uuid;
  result json;
BEGIN
  -- Get task channel
  SELECT channel_id INTO task_channel_id
  FROM tasks
  WHERE id = _task_id;
  
  IF task_channel_id IS NULL THEN
    RETURN json_build_object('error', 'Task not found');
  END IF;
  
  -- If replying, verify the reply_to comment belongs to the same task
  IF _reply_to_id IS NOT NULL THEN
    SELECT task_id INTO reply_to_task_id
    FROM task_comments
    WHERE id = _reply_to_id;
    
    IF reply_to_task_id IS NULL THEN
      RETURN json_build_object('error', 'Reply target comment not found');
    END IF;
    
    IF reply_to_task_id != _task_id THEN
      RETURN json_build_object('error', 'Reply target must be in the same task');
    END IF;
  END IF;
  
  -- Check permission: view_tasks (need to view to comment)
  IF NOT check_user_permission(_user_id, task_channel_id, 'view_tasks'::permission_type) THEN
    RETURN json_build_object('error', 'Permission denied: view_tasks');
  END IF;
  
  -- Insert comment
  INSERT INTO task_comments (task_id, user_id, content, reply_to_id)
  VALUES (_task_id, _user_id, _content, _reply_to_id)
  RETURNING id INTO new_comment_id;
  
  -- Return the created comment
  SELECT json_build_object(
    'id', tc.id,
    'task_id', tc.task_id,
    'user_id', tc.user_id,
    'content', tc.content,
    'created_at', tc.created_at,
    'edited_at', tc.edited_at,
    'reply_to_id', tc.reply_to_id
  ) INTO result
  FROM task_comments tc
  WHERE tc.id = new_comment_id;
  
  RETURN result;
END;
$$;

-- Update get_task_comments function to return nested replies
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
  
  -- Get all comments (including replies) with reply_to data
  -- Note: User data is fetched separately in the frontend for better performance
  SELECT json_agg(
    json_build_object(
      'id', tc.id,
      'task_id', tc.task_id,
      'user_id', tc.user_id,
      'content', tc.content,
      'created_at', tc.created_at,
      'edited_at', tc.edited_at,
      'reply_to_id', tc.reply_to_id,
      'reply_to', CASE 
        WHEN tc.reply_to_id IS NOT NULL THEN (
          SELECT json_build_object(
            'id', rt.id,
            'task_id', rt.task_id,
            'user_id', rt.user_id,
            'content', rt.content,
            'created_at', rt.created_at,
            'edited_at', rt.edited_at
          )
          FROM task_comments rt
          WHERE rt.id = tc.reply_to_id
        )
        ELSE NULL
      END
    )
    ORDER BY tc.created_at ASC
  ) INTO result
  FROM task_comments tc
  WHERE tc.task_id = _task_id;
  
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_task_comment(uuid, uuid, text, uuid) TO anon, authenticated;
