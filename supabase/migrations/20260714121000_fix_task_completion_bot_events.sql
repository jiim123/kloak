-- Task updates should fire for human completions even when the task was
-- originally created by an action bot. The previous task-event helper skipped
-- every event for bot-created tasks, which hid completion updates.

CREATE OR REPLACE FUNCTION public.enqueue_server_bot_task_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  item public.tasks%ROWTYPE;
  event_type text;
  actor_user_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    item := OLD;
  ELSE
    item := NEW;
  END IF;

  event_type := CASE TG_OP
    WHEN 'INSERT' THEN 'list_item_created'
    WHEN 'UPDATE' THEN 'list_item_updated'
    ELSE 'list_item_deleted'
  END;

  -- Suppress only bot-created task creation loops. Human updates/completions
  -- on bot-created tasks should still be visible to list_item_updated flows.
  IF TG_OP = 'INSERT' AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = item.created_by AND u.is_bot = true) THEN
    RETURN item;
  END IF;

  actor_user_id := CASE
    WHEN TG_OP = 'UPDATE'
      AND OLD.status IS DISTINCT FROM NEW.status
      AND NEW.status = 'completed'::public.task_status
      AND NEW.completed_by IS NOT NULL
      THEN NEW.completed_by
    ELSE item.created_by
  END;

  PERFORM public.enqueue_server_bot_event(
    item.server_id,
    event_type,
    event_type || ':' || item.id::text || ':' || txid_current()::text,
    public.server_bot_event_channel_payload(item.channel_id)
      || public.server_bot_event_user_payload(actor_user_id)
      || jsonb_build_object(
        'item_id', item.id,
        'item_title', item.title,
        'content', item.description,
        'status', item.status::text,
        'old_status', CASE WHEN TG_OP = 'UPDATE' THEN OLD.status::text ELSE NULL END,
        'completed_by', item.completed_by,
        'completed_at', item.completed_at
      )
  );

  RETURN item;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.enqueue_server_bot_task_item() FROM PUBLIC;
