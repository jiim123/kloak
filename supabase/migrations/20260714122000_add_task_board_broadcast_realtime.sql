-- Add a broadcast lane for task boards. Postgres changes can be brittle under
-- RLS/publication differences, while this mirrors the app's forum realtime path.

CREATE OR REPLACE FUNCTION public.broadcast_task_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _channel_id uuid;
  _task_id uuid;
BEGIN
  _channel_id := COALESCE(NEW.channel_id, OLD.channel_id);
  _task_id := COALESCE(NEW.id, OLD.id);

  IF _channel_id IS NULL OR _task_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  PERFORM realtime.send(
    jsonb_build_object(
      'op', TG_OP,
      'task_id', _task_id,
      'channel_id', _channel_id
    ),
    'tasks',
    'tasks-realtime:' || _channel_id::text,
    false
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.broadcast_task_assignee_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _task_id uuid;
  _channel_id uuid;
BEGIN
  _task_id := COALESCE(NEW.task_id, OLD.task_id);

  IF _task_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT t.channel_id
  INTO _channel_id
  FROM public.tasks t
  WHERE t.id = _task_id;

  IF _channel_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  PERFORM realtime.send(
    jsonb_build_object(
      'op', TG_OP,
      'task_id', _task_id,
      'channel_id', _channel_id
    ),
    'task_assignees',
    'tasks-realtime:' || _channel_id::text,
    false
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_broadcast_task_change ON public.tasks;
CREATE TRIGGER trg_broadcast_task_change
AFTER INSERT OR UPDATE OR DELETE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_task_change();

DROP TRIGGER IF EXISTS trg_broadcast_task_assignee_change ON public.task_assignees;
CREATE TRIGGER trg_broadcast_task_assignee_change
AFTER INSERT OR UPDATE OR DELETE ON public.task_assignees
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_task_assignee_change();

REVOKE EXECUTE ON FUNCTION public.broadcast_task_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.broadcast_task_assignee_change() FROM PUBLIC;
