CREATE OR REPLACE FUNCTION public.trigger_task_assignment_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  task_title text;
  task_channel_id uuid;
  task_server_id uuid;
  assigner_username text;
BEGIN
  SELECT t.title, t.channel_id, t.server_id, COALESCE(u.display_name, u.username)
  INTO task_title, task_channel_id, task_server_id, assigner_username
  FROM public.tasks t
  LEFT JOIN public.users u ON u.id = NEW.assigned_by
  WHERE t.id = NEW.task_id;

  IF task_title IS NULL OR task_channel_id IS NULL OR task_server_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id = NEW.assigned_by THEN
    RETURN NEW;
  END IF;

  PERFORM public.create_notification(
    NEW.user_id,
    'task_assignment'::public.notification_type,
    'Task assigned',
    COALESCE(assigner_username, 'Someone') || ' assigned you to "' || task_title || '"',
    '/app/servers/' || task_server_id::text || '/channels/' || task_channel_id::text
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_task_assignee_created ON public.task_assignees;

CREATE TRIGGER on_task_assignee_created
  AFTER INSERT ON public.task_assignees
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_task_assignment_notification();
