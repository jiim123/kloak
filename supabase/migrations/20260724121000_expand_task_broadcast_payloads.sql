-- Send complete task snapshots over Realtime Broadcast so task boards can
-- update from socket payloads instead of refetching individual tasks.

CREATE OR REPLACE FUNCTION public.task_broadcast_row(_task_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', t.id,
    'channel_id', t.channel_id,
    'server_id', t.server_id,
    'category_id', t.category_id,
    'parent_task_id', t.parent_task_id,
    'created_by', t.created_by,
    'title', t.title,
    'description', t.description,
    'priority', t.priority::text,
    'status', t.status::text,
    'due_date', t.due_date,
    'position', t.task_position,
    'completed_by', t.completed_by,
    'completed_at', t.completed_at,
    'created_at', t.created_at,
    'updated_at', t.updated_at,
    'creator', jsonb_build_object(
      'id', creator.id,
      'username', creator.username,
      'display_name', creator.display_name,
      'avatar_url', creator.avatar_url,
      'banner_color', creator.banner_color
    ),
    'completer', CASE
      WHEN completer.id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'id', completer.id,
        'username', completer.username,
        'display_name', completer.display_name,
        'avatar_url', completer.avatar_url,
        'banner_color', completer.banner_color
      )
    END,
    'assignees', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', ta.id,
            'task_id', ta.task_id,
            'user_id', ta.user_id,
            'assigned_by', ta.assigned_by,
            'assigned_at', ta.assigned_at,
            'user', jsonb_build_object(
              'id', au.id,
              'username', au.username,
              'display_name', au.display_name,
              'avatar_url', au.avatar_url,
              'banner_color', au.banner_color
            )
          )
          ORDER BY ta.assigned_at ASC
        )
        FROM public.task_assignees ta
        JOIN public.users au ON au.id = ta.user_id
        WHERE ta.task_id = t.id
      ),
      '[]'::jsonb
    )
  )
  FROM public.tasks t
  JOIN public.users creator ON creator.id = t.created_by
  LEFT JOIN public.users completer ON completer.id = t.completed_by
  WHERE t.id = _task_id;
$$;

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
      'channel_id', _channel_id,
      'task', CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE public.task_broadcast_row(_task_id) END
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
      'channel_id', _channel_id,
      'task', public.task_broadcast_row(_task_id)
    ),
    'task_assignees',
    'tasks-realtime:' || _channel_id::text,
    false
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.task_broadcast_row(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.broadcast_task_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.broadcast_task_assignee_change() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END
$$;
