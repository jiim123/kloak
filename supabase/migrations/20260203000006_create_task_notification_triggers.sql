-- Create notification trigger function for task assignments
CREATE OR REPLACE FUNCTION public.trigger_task_assignment_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  task_title text;
  task_channel_id uuid;
  assigner_username text;
BEGIN
  -- Get task info
  SELECT t.title, t.channel_id, u.username
  INTO task_title, task_channel_id, assigner_username
  FROM tasks t
  JOIN users u ON u.id = NEW.assigned_by
  WHERE t.id = NEW.task_id;
  
  -- Create notification for assigned user
  IF task_title IS NOT NULL AND assigner_username IS NOT NULL THEN
    PERFORM public.create_notification(
      NEW.user_id,
      'mention'::notification_type, -- Reuse mention type for task notifications
      'Task Assigned',
      assigner_username || ' assigned you to task: ' || task_title,
      '/app' -- Link will be updated by frontend to include channel/task
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for task assignments
DROP TRIGGER IF EXISTS task_assignment_notification_trigger ON public.task_assignees;
CREATE TRIGGER task_assignment_notification_trigger
AFTER INSERT ON public.task_assignees
FOR EACH ROW
EXECUTE FUNCTION public.trigger_task_assignment_notification();

-- Create notification trigger function for task status changes
CREATE OR REPLACE FUNCTION public.trigger_task_status_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assignee_id uuid;
  updater_username text;
BEGIN
  -- Only notify if status actually changed
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Get updater username (we'll need to pass user_id somehow, for now use system)
  SELECT username INTO updater_username
  FROM users
  WHERE id = NEW.created_by; -- Fallback to creator, ideally should be passed
  
  -- Notify all assignees
  FOR assignee_id IN
    SELECT user_id FROM task_assignees WHERE task_id = NEW.id
  LOOP
    PERFORM public.create_notification(
      assignee_id,
      'mention'::notification_type,
      'Task Status Changed',
      'Task "' || NEW.title || '" status changed to ' || NEW.status,
      '/app'
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create trigger for task status changes
DROP TRIGGER IF EXISTS task_status_notification_trigger ON public.tasks;
CREATE TRIGGER task_status_notification_trigger
AFTER UPDATE OF status ON public.tasks
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.trigger_task_status_notification();

-- Create notification trigger function for task comments
CREATE OR REPLACE FUNCTION public.trigger_task_comment_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  task_title text;
  task_created_by uuid;
  commenter_username text;
  assignee_id uuid;
  commenter_id uuid;
BEGIN
  -- Get task info
  SELECT t.title, t.created_by INTO task_title, task_created_by
  FROM tasks t
  WHERE t.id = NEW.task_id;
  
  -- Get commenter username
  SELECT username INTO commenter_username
  FROM users
  WHERE id = NEW.user_id;
  
  commenter_id := NEW.user_id;
  
  -- Notify task creator (if not the commenter)
  IF task_created_by IS NOT NULL AND task_created_by != commenter_id THEN
    PERFORM public.create_notification(
      task_created_by,
      'mention'::notification_type,
      'New Task Comment',
      commenter_username || ' commented on task: ' || task_title,
      '/app'
    );
  END IF;
  
  -- Notify all assignees (except commenter)
  FOR assignee_id IN
    SELECT user_id FROM task_assignees
    WHERE task_id = NEW.task_id AND user_id != commenter_id
  LOOP
    PERFORM public.create_notification(
      assignee_id,
      'mention'::notification_type,
      'New Task Comment',
      commenter_username || ' commented on task: ' || task_title,
      '/app'
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create trigger for task comments
DROP TRIGGER IF EXISTS task_comment_notification_trigger ON public.task_comments;
CREATE TRIGGER task_comment_notification_trigger
AFTER INSERT ON public.task_comments
FOR EACH ROW
EXECUTE FUNCTION public.trigger_task_comment_notification();
