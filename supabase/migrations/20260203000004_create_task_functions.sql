-- Function to create a task
CREATE OR REPLACE FUNCTION public.create_task(
  _channel_id uuid,
  _user_id uuid,
  _title text,
  _description text DEFAULT NULL,
  _priority text DEFAULT NULL,
  _due_date timestamptz DEFAULT NULL,
  _assignee_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  channel_server_id uuid;
  new_task_id uuid;
  assignee_id uuid;
  result json;
BEGIN
  -- Get channel's server_id
  SELECT server_id INTO channel_server_id
  FROM channels
  WHERE id = _channel_id;
  
  IF channel_server_id IS NULL THEN
    RETURN json_build_object('error', 'Channel not found');
  END IF;
  
  -- Check permission: create_tasks
  IF NOT check_user_permission(_user_id, _channel_id, 'create_tasks'::permission_type) THEN
    RETURN json_build_object('error', 'Permission denied: create_tasks');
  END IF;
  
  -- Insert task
  INSERT INTO tasks (channel_id, server_id, created_by, title, description, priority, due_date)
  VALUES (_channel_id, channel_server_id, _user_id, _title, _description, _priority::task_priority, _due_date)
  RETURNING id INTO new_task_id;
  
  -- Add assignees if provided
  IF _assignee_ids IS NOT NULL AND array_length(_assignee_ids, 1) > 0 THEN
    -- Check permission: assign_tasks
    IF NOT check_user_permission(_user_id, _channel_id, 'assign_tasks'::permission_type) THEN
      RETURN json_build_object('error', 'Permission denied: assign_tasks');
    END IF;
    
    FOREACH assignee_id IN ARRAY _assignee_ids
    LOOP
      INSERT INTO task_assignees (task_id, user_id, assigned_by)
      VALUES (new_task_id, assignee_id, _user_id)
      ON CONFLICT (task_id, user_id) DO NOTHING;
    END LOOP;
  END IF;
  
  -- Return the created task with assignees
  SELECT json_build_object(
    'id', t.id,
    'channel_id', t.channel_id,
    'server_id', t.server_id,
    'created_by', t.created_by,
    'title', t.title,
    'description', t.description,
    'status', t.status,
    'priority', t.priority,
    'due_date', t.due_date,
    'created_at', t.created_at,
    'updated_at', t.updated_at,
    'assignees', COALESCE(
      (SELECT json_agg(json_build_object('user_id', ta.user_id))
       FROM task_assignees ta
       WHERE ta.task_id = t.id),
      '[]'::json
    )
  ) INTO result
  FROM tasks t
  WHERE t.id = new_task_id;
  
  RETURN result;
END;
$$;

-- Function to update a task
CREATE OR REPLACE FUNCTION public.update_task(
  _task_id uuid,
  _user_id uuid,
  _title text DEFAULT NULL,
  _description text DEFAULT NULL,
  _status text DEFAULT NULL,
  _priority text DEFAULT NULL,
  _due_date timestamptz DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  task_channel_id uuid;
  task_created_by uuid;
  task_status task_status;
  can_edit boolean := false;
  can_change_status boolean := false;
  result json;
BEGIN
  -- Get task info
  SELECT channel_id, created_by, status
  INTO task_channel_id, task_created_by, task_status
  FROM tasks
  WHERE id = _task_id;
  
  IF task_channel_id IS NULL THEN
    RETURN json_build_object('error', 'Task not found');
  END IF;
  
  -- Check edit permission
  IF task_created_by = _user_id THEN
    -- Can edit own tasks if has edit_own_tasks permission
    can_edit := check_user_permission(_user_id, task_channel_id, 'edit_own_tasks'::permission_type);
  END IF;
  
  -- Can edit all tasks if has edit_all_tasks permission
  IF NOT can_edit THEN
    can_edit := check_user_permission(_user_id, task_channel_id, 'edit_all_tasks'::permission_type);
  END IF;
  
  IF NOT can_edit THEN
    RETURN json_build_object('error', 'Permission denied: edit tasks');
  END IF;
  
  -- Check status change permission if status is being changed
  IF _status IS NOT NULL AND _status::task_status != task_status THEN
    can_change_status := check_user_permission(_user_id, task_channel_id, 'change_task_status'::permission_type);
    IF NOT can_change_status THEN
      RETURN json_build_object('error', 'Permission denied: change_task_status');
    END IF;
  END IF;
  
  -- Update task
  UPDATE tasks
  SET
    title = COALESCE(_title, title),
    description = COALESCE(_description, description),
    status = COALESCE(_status::task_status, status),
    priority = COALESCE(_priority::task_priority, priority),
    due_date = COALESCE(_due_date, due_date),
    updated_at = now()
  WHERE id = _task_id;
  
  -- Return updated task
  SELECT json_build_object(
    'id', t.id,
    'channel_id', t.channel_id,
    'server_id', t.server_id,
    'created_by', t.created_by,
    'title', t.title,
    'description', t.description,
    'status', t.status,
    'priority', t.priority,
    'due_date', t.due_date,
    'created_at', t.created_at,
    'updated_at', t.updated_at
  ) INTO result
  FROM tasks t
  WHERE t.id = _task_id;
  
  RETURN result;
END;
$$;

-- Function to delete a task
CREATE OR REPLACE FUNCTION public.delete_task(
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
  task_created_by uuid;
  can_delete boolean := false;
BEGIN
  -- Get task info
  SELECT channel_id, created_by
  INTO task_channel_id, task_created_by
  FROM tasks
  WHERE id = _task_id;
  
  IF task_channel_id IS NULL THEN
    RETURN json_build_object('error', 'Task not found');
  END IF;
  
  -- Check delete permission
  IF task_created_by = _user_id THEN
    -- Can delete own tasks if has delete_tasks permission
    can_delete := check_user_permission(_user_id, task_channel_id, 'delete_tasks'::permission_type);
  END IF;
  
  -- Can delete all tasks if has delete_tasks permission (admin/owner typically)
  IF NOT can_delete THEN
    can_delete := check_user_permission(_user_id, task_channel_id, 'delete_tasks'::permission_type);
    -- Also check if user has manage_messages (admins can delete)
    IF NOT can_delete THEN
      can_delete := check_user_permission(_user_id, task_channel_id, 'manage_messages'::permission_type);
    END IF;
  END IF;
  
  IF NOT can_delete THEN
    RETURN json_build_object('error', 'Permission denied: delete tasks');
  END IF;
  
  -- Delete task (cascade will handle assignees and comments)
  DELETE FROM tasks WHERE id = _task_id;
  
  RETURN json_build_object('success', true);
END;
$$;

-- Function to assign users to a task
CREATE OR REPLACE FUNCTION public.assign_task_users(
  _task_id uuid,
  _user_id uuid,
  _assignee_ids uuid[]
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  task_channel_id uuid;
  assignee_id uuid;
BEGIN
  -- Get task channel
  SELECT channel_id INTO task_channel_id
  FROM tasks
  WHERE id = _task_id;
  
  IF task_channel_id IS NULL THEN
    RETURN json_build_object('error', 'Task not found');
  END IF;
  
  -- Check permission: assign_tasks
  IF NOT check_user_permission(_user_id, task_channel_id, 'assign_tasks'::permission_type) THEN
    RETURN json_build_object('error', 'Permission denied: assign_tasks');
  END IF;
  
  -- Add assignees
  FOREACH assignee_id IN ARRAY _assignee_ids
  LOOP
    INSERT INTO task_assignees (task_id, user_id, assigned_by)
    VALUES (_task_id, assignee_id, _user_id)
    ON CONFLICT (task_id, user_id) DO NOTHING;
  END LOOP;
  
  RETURN json_build_object('success', true);
END;
$$;

-- Function to unassign users from a task
CREATE OR REPLACE FUNCTION public.unassign_task_users(
  _task_id uuid,
  _user_id uuid,
  _assignee_ids uuid[]
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  task_channel_id uuid;
  assignee_id uuid;
BEGIN
  -- Get task channel
  SELECT channel_id INTO task_channel_id
  FROM tasks
  WHERE id = _task_id;
  
  IF task_channel_id IS NULL THEN
    RETURN json_build_object('error', 'Task not found');
  END IF;
  
  -- Check permission: assign_tasks (same permission for unassign)
  IF NOT check_user_permission(_user_id, task_channel_id, 'assign_tasks'::permission_type) THEN
    RETURN json_build_object('error', 'Permission denied: assign_tasks');
  END IF;
  
  -- Remove assignees
  DELETE FROM task_assignees
  WHERE task_id = _task_id
    AND user_id = ANY(_assignee_ids);
  
  RETURN json_build_object('success', true);
END;
$$;

-- Function to get tasks for a channel
CREATE OR REPLACE FUNCTION public.get_channel_tasks(
  _channel_id uuid,
  _user_id uuid,
  _status_filter text DEFAULT NULL,
  _assignee_filter uuid DEFAULT NULL,
  _sort_by text DEFAULT 'updated_at',
  _sort_order text DEFAULT 'desc'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  -- Check permission: view_tasks
  IF NOT check_user_permission(_user_id, _channel_id, 'view_tasks'::permission_type) THEN
    RETURN json_build_object('error', 'Permission denied: view_tasks');
  END IF;
  
  -- Build query
  SELECT json_agg(
    json_build_object(
      'id', t.id,
      'channel_id', t.channel_id,
      'server_id', t.server_id,
      'created_by', t.created_by,
      'title', t.title,
      'description', t.description,
      'status', t.status,
      'priority', t.priority,
      'due_date', t.due_date,
      'created_at', t.created_at,
      'updated_at', t.updated_at,
      'assignees', COALESCE(
        (SELECT json_agg(json_build_object('user_id', ta.user_id))
         FROM task_assignees ta
         WHERE ta.task_id = t.id),
        '[]'::json
      )
    )
    ORDER BY
      CASE WHEN _sort_by = 'title' AND _sort_order = 'asc' THEN t.title END ASC,
      CASE WHEN _sort_by = 'title' AND _sort_order = 'desc' THEN t.title END DESC,
      CASE WHEN _sort_by = 'due_date' AND _sort_order = 'asc' THEN t.due_date END ASC NULLS LAST,
      CASE WHEN _sort_by = 'due_date' AND _sort_order = 'desc' THEN t.due_date END DESC NULLS LAST,
      CASE WHEN _sort_by = 'priority' AND _sort_order = 'asc' THEN 
        CASE t.priority
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
          ELSE 4
        END
      END ASC,
      CASE WHEN _sort_by = 'priority' AND _sort_order = 'desc' THEN 
        CASE t.priority
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
          ELSE 4
        END
      END DESC,
      CASE WHEN _sort_by = 'updated_at' AND _sort_order = 'asc' THEN t.updated_at END ASC,
      CASE WHEN _sort_by = 'updated_at' AND _sort_order = 'desc' THEN t.updated_at END DESC,
      t.updated_at DESC
  ) INTO result
  FROM tasks t
  WHERE t.channel_id = _channel_id
    AND (_status_filter IS NULL OR t.status = _status_filter::task_status)
    AND (_assignee_filter IS NULL OR EXISTS (
      SELECT 1 FROM task_assignees ta
      WHERE ta.task_id = t.id AND ta.user_id = _assignee_filter
    ));
  
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_task(uuid, uuid, text, text, text, timestamptz, uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_task(uuid, uuid, text, text, text, text, timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_task(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_task_users(uuid, uuid, uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unassign_task_users(uuid, uuid, uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_channel_tasks(uuid, uuid, text, uuid, text, text) TO anon, authenticated;
