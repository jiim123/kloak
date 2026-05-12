CREATE OR REPLACE FUNCTION public.get_task_secure(
  _task_id uuid,
  _user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  task_record record;
  result jsonb;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT
    t.id,
    t.channel_id
  INTO task_record
  FROM public.tasks t
  WHERE t.id = _task_id;

  IF task_record IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.channels c
    WHERE c.id = task_record.channel_id
      AND c.type = 'tasks'::public.channel_type
  ) THEN
    RAISE EXCEPTION 'Tasks can only be queried for task channels';
  END IF;

  IF NOT public.check_user_permission(_user_id, task_record.channel_id, 'view_tasks'::public.permission_type) THEN
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
    WHERE t.id = _task_id
  )
  SELECT jsonb_build_object(
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
  INTO result
  FROM task_data td;

  RETURN result;
END;
$$;
