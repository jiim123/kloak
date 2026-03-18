CREATE OR REPLACE FUNCTION public.create_task(
  _channel_id uuid,
  _user_id uuid,
  _title text,
  _description text DEFAULT NULL::text,
  _priority text DEFAULT 'medium'::text,
  _due_date timestamp with time zone DEFAULT NULL::timestamp with time zone,
  _assignee_ids uuid[] DEFAULT ARRAY[]::uuid[],
  _category_id uuid DEFAULT NULL::uuid,
  _parent_task_id uuid DEFAULT NULL::uuid
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
  parent_record record;
  effective_category_id uuid;
  _title_trimmed text;
  assignee_has_access boolean;
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

  SELECT c.id, c.server_id, c.type, c.is_private
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

  IF _parent_task_id IS NOT NULL THEN
    SELECT t.id, t.channel_id, t.category_id
    INTO parent_record
    FROM public.tasks t
    WHERE t.id = _parent_task_id;

    IF parent_record IS NULL OR parent_record.channel_id != _channel_id THEN
      RAISE EXCEPTION 'Parent task does not belong to this channel';
    END IF;

    IF _category_id IS NOT NULL AND _category_id IS DISTINCT FROM parent_record.category_id THEN
      RAISE EXCEPTION 'Sub-task category must match parent task category';
    END IF;

    effective_category_id := parent_record.category_id;
  ELSE
    effective_category_id := _category_id;
  END IF;

  IF effective_category_id IS NOT NULL THEN
    SELECT tc.channel_id
    INTO category_channel_id
    FROM public.task_categories tc
    WHERE tc.id = effective_category_id;

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
    AND category_id IS NOT DISTINCT FROM effective_category_id
    AND parent_task_id IS NOT DISTINCT FROM _parent_task_id;

  INSERT INTO public.tasks (
    channel_id,
    server_id,
    category_id,
    parent_task_id,
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
    effective_category_id,
    _parent_task_id,
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
      IF channel_record.is_private THEN
        SELECT EXISTS (
          SELECT 1
          FROM public.channel_members cm
          WHERE cm.channel_id = _channel_id
            AND cm.user_id = assignee_id
        ) INTO assignee_has_access;
      ELSE
        SELECT EXISTS (
          SELECT 1
          FROM public.server_members sm
          WHERE sm.server_id = channel_record.server_id
            AND sm.user_id = assignee_id
            AND COALESCE(sm.is_banned, false) = false
        ) INTO assignee_has_access;
      END IF;

      IF NOT assignee_has_access THEN
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
    'parent_task_id', new_task.parent_task_id,
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

CREATE OR REPLACE FUNCTION public.assign_task_users(_task_id uuid, _user_id uuid, _assignee_ids uuid[])
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  task_channel_id uuid;
  task_server_id uuid;
  task_is_private boolean;
  assignee_id uuid;
  assignee_has_access boolean;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT t.channel_id, c.server_id, c.is_private
  INTO task_channel_id, task_server_id, task_is_private
  FROM public.tasks t
  JOIN public.channels c ON c.id = t.channel_id
  WHERE t.id = _task_id;

  IF task_channel_id IS NULL THEN
    RETURN json_build_object('error', 'Task not found');
  END IF;

  IF NOT public.check_user_permission(_user_id, task_channel_id, 'assign_tasks'::public.permission_type) THEN
    RETURN json_build_object('error', 'Permission denied: assign_tasks');
  END IF;

  FOREACH assignee_id IN ARRAY _assignee_ids LOOP
    IF task_is_private THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.channel_members cm
        WHERE cm.channel_id = task_channel_id
          AND cm.user_id = assignee_id
      ) INTO assignee_has_access;
    ELSE
      SELECT EXISTS (
        SELECT 1
        FROM public.server_members sm
        WHERE sm.server_id = task_server_id
          AND sm.user_id = assignee_id
          AND COALESCE(sm.is_banned, false) = false
      ) INTO assignee_has_access;
    END IF;

    IF NOT assignee_has_access THEN
      RAISE EXCEPTION 'Cannot assign tasks to users without channel access';
    END IF;

    INSERT INTO public.task_assignees (task_id, user_id, assigned_by)
    VALUES (_task_id, assignee_id, _user_id)
    ON CONFLICT (task_id, user_id) DO NOTHING;
  END LOOP;

  RETURN json_build_object('success', true);
END;
$$;
