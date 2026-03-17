CREATE TABLE IF NOT EXISTS public.task_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) > 0 AND length(name) <= 100),
  position integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_categories_channel_position
  ON public.task_categories(channel_id, position);

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.task_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_channel_category_position
  ON public.tasks(channel_id, category_id, task_position);

DROP POLICY IF EXISTS "Task comments viewable by task members" ON public.task_comments;
DROP FUNCTION IF EXISTS public.create_task_comment(uuid, uuid, text, uuid);
DROP FUNCTION IF EXISTS public.get_task_comments(uuid, uuid);
DROP FUNCTION IF EXISTS public.update_task_comment(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.delete_task_comment(uuid, uuid);
DROP TABLE IF EXISTS public.task_comments CASCADE;

ALTER TABLE IF EXISTS public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.task_categories ENABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.tasks FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.task_assignees FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.task_categories FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tasks viewable by task members" ON public.tasks;
CREATE POLICY "Tasks viewable by task members"
  ON public.tasks
  FOR SELECT
  USING (
    public.can_access_channel(channel_id, public.requesting_user_id())
    AND public.check_user_permission(public.requesting_user_id(), channel_id, 'view_tasks'::public.permission_type)
  );

DROP POLICY IF EXISTS "Task assignees viewable by task members" ON public.task_assignees;
CREATE POLICY "Task assignees viewable by task members"
  ON public.task_assignees
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.tasks t
      WHERE t.id = task_assignees.task_id
        AND public.can_access_channel(t.channel_id, public.requesting_user_id())
        AND public.check_user_permission(public.requesting_user_id(), t.channel_id, 'view_tasks'::public.permission_type)
    )
  );


DROP POLICY IF EXISTS "Task categories viewable by task members" ON public.task_categories;
CREATE POLICY "Task categories viewable by task members"
  ON public.task_categories
  FOR SELECT
  USING (
    public.can_access_channel(channel_id, public.requesting_user_id())
    AND public.check_user_permission(public.requesting_user_id(), channel_id, 'view_tasks'::public.permission_type)
  );

CREATE OR REPLACE FUNCTION public.create_task_category(_channel_id uuid, _user_id uuid, _name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  channel_record record;
  next_position integer;
  new_category public.task_categories%ROWTYPE;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT c.id, c.server_id, c.type
  INTO channel_record
  FROM public.channels c
  WHERE c.id = _channel_id;

  IF channel_record IS NULL THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;

  IF channel_record.type != 'tasks'::public.channel_type THEN
    RAISE EXCEPTION 'Task categories can only be created in task channels';
  END IF;

  IF NOT public.check_user_permission(_user_id, _channel_id, 'create_tasks'::public.permission_type) THEN
    RAISE EXCEPTION 'Permission denied: create_tasks';
  END IF;

  SELECT COALESCE(MAX(position), -1) + 1
  INTO next_position
  FROM public.task_categories
  WHERE channel_id = _channel_id;

  INSERT INTO public.task_categories (channel_id, server_id, name, position, created_by)
  VALUES (_channel_id, channel_record.server_id, trim(_name), next_position, _user_id)
  RETURNING * INTO new_category;

  RETURN jsonb_build_object(
    'id', new_category.id,
    'channel_id', new_category.channel_id,
    'server_id', new_category.server_id,
    'name', new_category.name,
    'position', new_category.position,
    'created_by', new_category.created_by,
    'created_at', new_category.created_at,
    'updated_at', new_category.updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_task_categories(_channel_id uuid, _user_id uuid)
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
    RAISE EXCEPTION 'Task categories can only be queried for task channels';
  END IF;

  IF NOT public.check_user_permission(_user_id, _channel_id, 'view_tasks'::public.permission_type) THEN
    RAISE EXCEPTION 'Permission denied: view_tasks';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', tc.id,
        'channel_id', tc.channel_id,
        'server_id', tc.server_id,
        'name', tc.name,
        'position', tc.position,
        'created_by', tc.created_by,
        'created_at', tc.created_at,
        'updated_at', tc.updated_at
      )
      ORDER BY tc.position ASC, tc.created_at ASC
    ),
    '[]'::jsonb
  )
  INTO result
  FROM public.task_categories tc
  WHERE tc.channel_id = _channel_id;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_task_category(_category_id uuid, _user_id uuid, _name text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  category_record record;
  updated_category public.task_categories%ROWTYPE;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT tc.id, tc.channel_id
  INTO category_record
  FROM public.task_categories tc
  WHERE tc.id = _category_id;

  IF category_record IS NULL THEN
    RAISE EXCEPTION 'Task category not found';
  END IF;

  IF NOT public.check_user_permission(_user_id, category_record.channel_id, 'edit_all_tasks'::public.permission_type) THEN
    RAISE EXCEPTION 'Permission denied: edit_all_tasks';
  END IF;

  UPDATE public.task_categories
  SET
    name = COALESCE(NULLIF(trim(_name), ''), name),
    updated_at = now()
  WHERE id = _category_id
  RETURNING * INTO updated_category;

  RETURN jsonb_build_object(
    'id', updated_category.id,
    'channel_id', updated_category.channel_id,
    'server_id', updated_category.server_id,
    'name', updated_category.name,
    'position', updated_category.position,
    'created_by', updated_category.created_by,
    'created_at', updated_category.created_at,
    'updated_at', updated_category.updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_task_category(_category_id uuid, _user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  category_channel_id uuid;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT tc.channel_id
  INTO category_channel_id
  FROM public.task_categories tc
  WHERE tc.id = _category_id;

  IF category_channel_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Task category not found');
  END IF;

  IF NOT public.check_user_permission(_user_id, category_channel_id, 'edit_all_tasks'::public.permission_type) THEN
    RETURN jsonb_build_object('error', 'Permission denied: edit_all_tasks');
  END IF;

  UPDATE public.tasks
  SET category_id = NULL
  WHERE category_id = _category_id;

  DELETE FROM public.task_categories
  WHERE id = _category_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

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
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
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
    trim(_title),
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

CREATE OR REPLACE FUNCTION public.assign_task_users(_task_id uuid, _user_id uuid, _assignee_ids uuid[])
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  task_channel_id uuid;
  assignee_id uuid;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT t.channel_id
  INTO task_channel_id
  FROM public.tasks t
  WHERE t.id = _task_id;

  IF task_channel_id IS NULL THEN
    RETURN json_build_object('error', 'Task not found');
  END IF;

  IF NOT public.check_user_permission(_user_id, task_channel_id, 'assign_tasks'::public.permission_type) THEN
    RETURN json_build_object('error', 'Permission denied: assign_tasks');
  END IF;

  FOREACH assignee_id IN ARRAY _assignee_ids LOOP
    IF NOT public.can_access_channel(task_channel_id, assignee_id) THEN
      RAISE EXCEPTION 'Cannot assign tasks to users without channel access';
    END IF;

    INSERT INTO public.task_assignees (task_id, user_id, assigned_by)
    VALUES (_task_id, assignee_id, _user_id)
    ON CONFLICT (task_id, user_id) DO NOTHING;
  END LOOP;

  RETURN json_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.unassign_task_users(_task_id uuid, _user_id uuid, _assignee_ids uuid[])
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  task_channel_id uuid;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT t.channel_id
  INTO task_channel_id
  FROM public.tasks t
  WHERE t.id = _task_id;

  IF task_channel_id IS NULL THEN
    RETURN json_build_object('error', 'Task not found');
  END IF;

  IF NOT public.check_user_permission(_user_id, task_channel_id, 'assign_tasks'::public.permission_type) THEN
    RETURN json_build_object('error', 'Permission denied: assign_tasks');
  END IF;

  DELETE FROM public.task_assignees
  WHERE task_id = _task_id
    AND user_id = ANY(COALESCE(_assignee_ids, ARRAY[]::uuid[]));

  RETURN json_build_object('success', true);
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

DROP FUNCTION IF EXISTS public.update_task(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  timestamp with time zone
);

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

