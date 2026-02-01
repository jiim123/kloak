-- Fix delete_task function to only check delete_tasks permission
-- Remove the manage_messages fallback to ensure explicit permission control
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
  
  -- Check delete permission - only check delete_tasks, no fallbacks
  IF task_created_by = _user_id THEN
    -- Can delete own tasks if has delete_tasks permission
    can_delete := check_user_permission(_user_id, task_channel_id, 'delete_tasks'::permission_type);
  END IF;
  
  -- Can delete all tasks if has delete_tasks permission
  IF NOT can_delete THEN
    can_delete := check_user_permission(_user_id, task_channel_id, 'delete_tasks'::permission_type);
  END IF;
  
  IF NOT can_delete THEN
    RETURN json_build_object('error', 'Permission denied: delete tasks');
  END IF;
  
  -- Delete task (cascade will handle assignees and comments)
  DELETE FROM tasks WHERE id = _task_id;
  
  RETURN json_build_object('success', true);
END;
$$;
