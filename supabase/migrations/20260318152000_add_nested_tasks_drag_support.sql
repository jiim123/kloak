ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS parent_task_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tasks_parent_task_id_fkey'
      AND conrelid = 'public.tasks'::regclass
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_parent_task_id_fkey
      FOREIGN KEY (parent_task_id)
      REFERENCES public.tasks(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_tasks_channel_category_parent_position
  ON public.tasks(channel_id, category_id, parent_task_id, task_position);

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

CREATE OR REPLACE FUNCTION public.get_channel_tasks(
  _channel_id uuid,
  _user_id uuid,
  _status_filter text DEFAULT NULL::text,
  _sort_by text DEFAULT 'position'::text,
  _sort_order text DEFAULT 'asc'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  channel_type_value public.channel_type;
  result jsonb;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT c.type
  INTO channel_type_value
  FROM public.channels c
  WHERE c.id = _channel_id;

  IF channel_type_value IS NULL THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;

  IF channel_type_value != 'tasks'::public.channel_type THEN
    RAISE EXCEPTION 'Tasks can only be queried for task channels';
  END IF;

  IF NOT public.check_user_permission(_user_id, _channel_id, 'view_tasks'::public.permission_type) THEN
    RAISE EXCEPTION 'Permission denied: view_tasks';
  END IF;

  WITH task_data AS (
    SELECT
      t.id,
      t.channel_id,
      t.server_id,
      t.category_id,
      t.parent_task_id,
      t.created_by,
      t.title,
      t.description,
      t.priority::text AS priority,
      t.status::text AS status,
      t.due_date,
      t.task_position AS position,
      t.completed_by,
      t.completed_at,
      t.created_at,
      t.updated_at,
      jsonb_build_object(
        'id', creator.id,
        'username', creator.username,
        'display_name', creator.display_name,
        'avatar_url', creator.avatar_url,
        'banner_color', creator.banner_color
      ) AS creator,
      CASE
        WHEN t.completed_by IS NOT NULL THEN
          jsonb_build_object(
            'id', completer.id,
            'username', completer.username,
            'display_name', completer.display_name,
            'avatar_url', completer.avatar_url,
            'banner_color', completer.banner_color
          )
        ELSE NULL
      END AS completer,
      COALESCE(
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
      ) AS assignees
    FROM public.tasks t
    JOIN public.users creator ON creator.id = t.created_by
    LEFT JOIN public.users completer ON completer.id = t.completed_by
    WHERE t.channel_id = _channel_id
      AND (_status_filter IS NULL OR t.status::text = _status_filter)
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', td.id,
        'channel_id', td.channel_id,
        'server_id', td.server_id,
        'category_id', td.category_id,
        'parent_task_id', td.parent_task_id,
        'created_by', td.created_by,
        'title', td.title,
        'description', td.description,
        'priority', td.priority,
        'status', td.status,
        'due_date', td.due_date,
        'position', td.position,
        'completed_by', td.completed_by,
        'completed_at', td.completed_at,
        'created_at', td.created_at,
        'updated_at', td.updated_at,
        'creator', td.creator,
        'completer', td.completer,
        'assignees', td.assignees
      )
      ORDER BY
        CASE WHEN _sort_by = 'position' AND _sort_order = 'asc' THEN td.position END ASC,
        CASE WHEN _sort_by = 'position' AND _sort_order = 'desc' THEN td.position END DESC,
        CASE WHEN _sort_by = 'created_at' AND _sort_order = 'asc' THEN td.created_at END ASC,
        CASE WHEN _sort_by = 'created_at' AND _sort_order = 'desc' THEN td.created_at END DESC,
        CASE WHEN _sort_by = 'due_date' AND _sort_order = 'asc' THEN td.due_date END ASC NULLS LAST,
        CASE WHEN _sort_by = 'due_date' AND _sort_order = 'desc' THEN td.due_date END DESC NULLS LAST,
        td.position ASC,
        td.created_at ASC
    ),
    '[]'::jsonb
  )
  INTO result
  FROM task_data td;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.move_task(
  _task_id uuid,
  _user_id uuid,
  _new_parent_task_id uuid DEFAULT NULL::uuid,
  _clear_parent boolean DEFAULT false,
  _new_position integer DEFAULT NULL::integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  task_record record;
  parent_record record;
  can_edit_content boolean := false;
  old_parent_id uuid;
  old_category_id uuid;
  old_position integer;
  target_parent_id uuid;
  target_category_id uuid;
  target_position integer;
  sibling_count integer;
  same_group boolean;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT
    t.id,
    t.channel_id,
    t.category_id,
    t.parent_task_id,
    t.task_position,
    t.created_by
  INTO task_record
  FROM public.tasks t
  WHERE t.id = _task_id;

  IF task_record IS NULL THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  can_edit_content :=
    public.check_user_permission(_user_id, task_record.channel_id, 'edit_all_tasks'::public.permission_type)
    OR (
      task_record.created_by = _user_id
      AND public.check_user_permission(_user_id, task_record.channel_id, 'edit_own_tasks'::public.permission_type)
    );

  IF NOT can_edit_content THEN
    RAISE EXCEPTION 'Permission denied: edit task';
  END IF;

  target_parent_id := CASE
    WHEN _clear_parent THEN NULL
    WHEN _new_parent_task_id IS NOT NULL THEN _new_parent_task_id
    ELSE task_record.parent_task_id
  END;

  IF target_parent_id IS NOT NULL THEN
    SELECT t.id, t.channel_id, t.category_id
    INTO parent_record
    FROM public.tasks t
    WHERE t.id = target_parent_id;

    IF parent_record IS NULL OR parent_record.channel_id != task_record.channel_id THEN
      RAISE EXCEPTION 'Parent task does not belong to this channel';
    END IF;

    IF parent_record.id = _task_id THEN
      RAISE EXCEPTION 'A task cannot be its own parent';
    END IF;

    IF EXISTS (
      WITH RECURSIVE descendants AS (
        SELECT id
        FROM public.tasks
        WHERE parent_task_id = _task_id
        UNION ALL
        SELECT t.id
        FROM public.tasks t
        JOIN descendants d ON t.parent_task_id = d.id
      )
      SELECT 1 FROM descendants WHERE id = target_parent_id
    ) THEN
      RAISE EXCEPTION 'A task cannot be moved inside one of its subtasks';
    END IF;

    target_category_id := parent_record.category_id;
  ELSE
    target_category_id := task_record.category_id;
  END IF;

  old_parent_id := task_record.parent_task_id;
  old_category_id := task_record.category_id;
  old_position := task_record.task_position;

  same_group :=
    old_parent_id IS NOT DISTINCT FROM target_parent_id
    AND old_category_id IS NOT DISTINCT FROM target_category_id;

  SELECT COUNT(*)
  INTO sibling_count
  FROM public.tasks t
  WHERE t.channel_id = task_record.channel_id
    AND t.category_id IS NOT DISTINCT FROM target_category_id
    AND t.parent_task_id IS NOT DISTINCT FROM target_parent_id
    AND t.id <> _task_id;

  IF _new_position IS NULL THEN
    target_position := sibling_count;
  ELSE
    target_position := GREATEST(0, LEAST(_new_position, sibling_count));
  END IF;

  IF same_group AND target_position = old_position THEN
    RETURN;
  END IF;

  IF same_group THEN
    IF target_position > old_position THEN
      UPDATE public.tasks t
      SET task_position = t.task_position - 1
      WHERE t.channel_id = task_record.channel_id
        AND t.category_id IS NOT DISTINCT FROM old_category_id
        AND t.parent_task_id IS NOT DISTINCT FROM old_parent_id
        AND t.id <> _task_id
        AND t.task_position > old_position
        AND t.task_position <= target_position;
    ELSE
      UPDATE public.tasks t
      SET task_position = t.task_position + 1
      WHERE t.channel_id = task_record.channel_id
        AND t.category_id IS NOT DISTINCT FROM old_category_id
        AND t.parent_task_id IS NOT DISTINCT FROM old_parent_id
        AND t.id <> _task_id
        AND t.task_position >= target_position
        AND t.task_position < old_position;
    END IF;
  ELSE
    UPDATE public.tasks t
    SET task_position = t.task_position - 1
    WHERE t.channel_id = task_record.channel_id
      AND t.category_id IS NOT DISTINCT FROM old_category_id
      AND t.parent_task_id IS NOT DISTINCT FROM old_parent_id
      AND t.id <> _task_id
      AND t.task_position > old_position;

    UPDATE public.tasks t
    SET task_position = t.task_position + 1
    WHERE t.channel_id = task_record.channel_id
      AND t.category_id IS NOT DISTINCT FROM target_category_id
      AND t.parent_task_id IS NOT DISTINCT FROM target_parent_id
      AND t.id <> _task_id
      AND t.task_position >= target_position;
  END IF;

  UPDATE public.tasks t
  SET
    parent_task_id = target_parent_id,
    category_id = target_category_id,
    task_position = target_position,
    updated_at = now()
  WHERE t.id = _task_id;
END;
$$;
