-- Fix update_task function to allow status changes independently of edit permissions
-- Also allow assigned users to change status of tasks they're assigned to
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
  current_title text;
  current_description text;
  current_priority task_priority;
  current_due_date timestamptz;
  is_assigned boolean := false;
  is_only_status_change boolean := false;
  can_edit boolean := false;
  can_change_status boolean := false;
  result json;
BEGIN
  -- Get task info (all current values)
  SELECT channel_id, created_by, status, title, description, priority, due_date
  INTO task_channel_id, task_created_by, task_status, current_title, current_description, current_priority, current_due_date
  FROM tasks
  WHERE id = _task_id;
  
  IF task_channel_id IS NULL THEN
    RETURN json_build_object('error', 'Task not found');
  END IF;
  
  -- Check if user is assigned to this task
  SELECT EXISTS(
    SELECT 1 FROM task_assignees
    WHERE task_id = _task_id AND user_id = _user_id
  ) INTO is_assigned;
  
  -- Determine if this is only a status change
  -- Check if status is being changed AND all other fields are either NULL or unchanged
  is_only_status_change := (
    _status IS NOT NULL AND _status::task_status != task_status AND
    (
      (_title IS NULL OR _title = current_title) AND
      (_description IS NULL OR COALESCE(_description, '') = COALESCE(current_description, '')) AND
      (_priority IS NULL OR _priority::task_priority = current_priority) AND
      (_due_date IS NULL OR _due_date = current_due_date)
    )
  );
  
  -- If only changing status, check status change permission independently
  IF is_only_status_change THEN
    -- Check if user has change_task_status permission
    can_change_status := check_user_permission(_user_id, task_channel_id, 'change_task_status'::permission_type);
    
    -- If not, but user is assigned, allow status change (assigned users can update their tasks' status)
    IF NOT can_change_status AND is_assigned THEN
      can_change_status := true;
    END IF;
    
    IF NOT can_change_status THEN
      RETURN json_build_object('error', 'Permission denied: change_task_status');
    END IF;
  ELSE
    -- For other field changes, check edit permissions
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
    
    -- If status is also being changed, check status change permission
    IF _status IS NOT NULL AND _status::task_status != task_status THEN
      can_change_status := check_user_permission(_user_id, task_channel_id, 'change_task_status'::permission_type);
      
      -- If not, but user is assigned, allow status change
      IF NOT can_change_status AND is_assigned THEN
        can_change_status := true;
      END IF;
      
      IF NOT can_change_status THEN
        RETURN json_build_object('error', 'Permission denied: change_task_status');
      END IF;
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
