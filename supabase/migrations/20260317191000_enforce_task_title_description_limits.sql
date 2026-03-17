CREATE OR REPLACE FUNCTION public.create_task(
  _channel_id uuid,
  _user_id uuid,
  _title text,
  _description text DEFAULT NULL::text,
  _priority text DEFAULT 'medium'::text,
  _due_date timestamp with time zone DEFAULT NULL::timestamp with time zone,
  _assignee_ids uuid[] DEFAULT ARRAY[]::uuid[],
  _category_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  new_task record;
  channel_record record;
  max_position integer;
  assignee_id uuid;
  category_channel_id uuid;
  _title_trimmed text;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  _title_trimmed := trim(COALESCE(_title, ''));

  IF _title_trimmed = '' THEN
    RAISE EXCEPTION 'Task title is required';
  END IF;

  IF length(_title_trimmed) > 200 THEN
    RAISE EXCEPTION 'Task title must be 200 characters or fewer';
  END IF;

  IF _description IS NOT NULL AND length(_description) > 4000 THEN
    RAISE EXCEPTION 'Task description must be 4000 characters or fewer';
  END IF;

  SELECT c.id, c.server_id, c.type
  INTO channel_record
  FROM public.channels c
  WHERE c.id = _channel_id;

  IF channel_record IS NULL THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;

  IF channel_record.type != 'tasks'::public.channel_type THEN
    RAISE EXCEPTION 'Tasks can only be created in task channels';
  END IF;

  IF NOT public.check_user_permission(_user_id, _channel_id, 'create_tasks'::public.permission_type) THEN
    RAISE EXCEPTION 'Permission denied: create_tasks';
  END IF;

  IF _category_id IS NOT NULL THEN
    SELECT tc.channel_id
    INTO category_channel_id
    FROM public.task_categories tc
    WHERE tc.id = _category_id;

    IF category_channel_id IS NULL OR category_channel_id != _channel_id THEN
      RAISE EXCEPTION 'Task category does not belong to this channel';
    END IF;
  END IF;

  IF array_length(_assignee_ids, 1) > 0
     AND NOT public.check_user_permission(_user_id, _channel_id, 'assign_tasks'::public.permission_type) THEN
    RAISE EXCEPTION 'Permission denied: assign_tasks';
  END IF;

  SELECT COALESCE(MAX(task_position), -1) + 1
  INTO max_position
  FROM public.tasks
  WHERE channel_id = _channel_id
    AND (
      (_category_id IS NULL AND category_id IS NULL)
      OR category_id = _category_id
    );

  INSERT INTO public.tasks (
    channel_id,
    server_id,
    category_id,
    created_by,
    title,
    description,
    priority,
    due_date,
    task_position
  )
  VALUES (
    _channel_id,
    channel_record.server_id,
    _category_id,
    _user_id,
    _title_trimmed,
    _description,
    _priority::public.task_priority,
    _due_date,
    max_position
  )
  RETURNING * INTO new_task;

  IF array_length(_assignee_ids, 1) > 0 THEN
    FOREACH assignee_id IN ARRAY _assignee_ids LOOP
      IF NOT public.can_access_channel(_channel_id, assignee_id) THEN
        RAISE EXCEPTION 'Cannot assign tasks to users without channel access';
      END IF;

      INSERT INTO public.task_assignees (task_id, user_id, assigned_by)
      VALUES (new_task.id, assignee_id, _user_id)
      ON CONFLICT (task_id, user_id) DO NOTHING;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'id', new_task.id,
    'channel_id', new_task.channel_id,
    'server_id', new_task.server_id,
    'category_id', new_task.category_id,
    'created_by', new_task.created_by,
    'title', new_task.title,
    'description', new_task.description,
    'priority', new_task.priority::text,
    'status', new_task.status::text,
    'due_date', new_task.due_date,
    'position', new_task.task_position,
    'completed_by', new_task.completed_by,
    'completed_at', new_task.completed_at,
    'created_at', new_task.created_at,
    'updated_at', new_task.updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_task(
  _task_id uuid,
  _user_id uuid,
  _title text DEFAULT NULL::text,
  _description text DEFAULT NULL::text,
  _priority text DEFAULT NULL::text,
  _status text DEFAULT NULL::text,
  _due_date timestamp with time zone DEFAULT NULL::timestamp with time zone,
  _category_id uuid DEFAULT NULL::uuid,
  _clear_category boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  task_record record;
  category_channel_id uuid;
  requires_content_edit boolean;
  requires_status_change boolean;
  can_edit_content boolean := false;
  can_change_status boolean := false;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF _title IS NOT NULL AND trim(_title) <> '' AND length(trim(_title)) > 200 THEN
    RAISE EXCEPTION 'Task title must be 200 characters or fewer';
  END IF;

  IF _description IS NOT NULL AND length(_description) > 4000 THEN
    RAISE EXCEPTION 'Task description must be 4000 characters or fewer';
  END IF;

  SELECT
    t.channel_id,
    t.created_by,
    t.status,
    c.type AS channel_type,
    EXISTS (
      SELECT 1
      FROM public.task_assignees ta
      WHERE ta.task_id = t.id
        AND ta.user_id = _user_id
    ) AS is_assignee
  INTO task_record
  FROM public.tasks t
  JOIN public.channels c ON c.id = t.channel_id
  WHERE t.id = _task_id;

  IF task_record IS NULL THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  IF task_record.channel_type != 'tasks'::public.channel_type THEN
    RAISE EXCEPTION 'Task updates are only supported in task channels';
  END IF;

  IF _category_id IS NOT NULL THEN
    SELECT tc.channel_id
    INTO category_channel_id
    FROM public.task_categories tc
    WHERE tc.id = _category_id;

    IF category_channel_id IS NULL OR category_channel_id != task_record.channel_id THEN
      RAISE EXCEPTION 'Task category does not belong to this channel';
    END IF;
  END IF;

  requires_content_edit :=
    _title IS NOT NULL
    OR _description IS NOT NULL
    OR _priority IS NOT NULL
    OR _due_date IS NOT NULL
    OR _category_id IS NOT NULL
    OR _clear_category;

  requires_status_change :=
    _status IS NOT NULL
    AND _status::public.task_status <> task_record.status;

  IF requires_content_edit THEN
    can_edit_content :=
      public.check_user_permission(_user_id, task_record.channel_id, 'edit_all_tasks'::public.permission_type)
      OR (
        task_record.created_by = _user_id
        AND public.check_user_permission(_user_id, task_record.channel_id, 'edit_own_tasks'::public.permission_type)
      );

    IF NOT can_edit_content THEN
      RAISE EXCEPTION 'Permission denied: edit task';
    END IF;
  END IF;

  IF requires_status_change THEN
    can_change_status :=
      public.check_user_permission(_user_id, task_record.channel_id, 'change_task_status'::public.permission_type)
      AND (
        task_record.created_by = _user_id
        OR task_record.is_assignee
        OR public.check_user_permission(_user_id, task_record.channel_id, 'edit_all_tasks'::public.permission_type)
      );

    IF NOT can_change_status THEN
      RAISE EXCEPTION 'Permission denied: change_task_status';
    END IF;
  END IF;

  UPDATE public.tasks
  SET
    title = COALESCE(NULLIF(trim(_title), ''), title),
    description = COALESCE(_description, description),
    priority = COALESCE(_priority::public.task_priority, priority),
    status = COALESCE(_status::public.task_status, status),
    due_date = COALESCE(_due_date, due_date),
    category_id = CASE
      WHEN _clear_category THEN NULL
      WHEN _category_id IS NOT NULL THEN _category_id
      ELSE category_id
    END,
    completed_by = CASE
      WHEN _status = 'completed' AND status != 'completed'::public.task_status THEN _user_id
      WHEN _status IN ('open', 'in_progress') THEN NULL
      ELSE completed_by
    END,
    completed_at = CASE
      WHEN _status = 'completed' AND status != 'completed'::public.task_status THEN now()
      WHEN _status IN ('open', 'in_progress') THEN NULL
      ELSE completed_at
    END,
    updated_at = now()
  WHERE id = _task_id;
END;
$$;
