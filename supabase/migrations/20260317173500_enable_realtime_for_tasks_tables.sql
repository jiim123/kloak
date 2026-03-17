-- Enable postgres_changes realtime delivery for task board tables.
-- Keeps app-user access unchanged; grants are only for internal realtime roles.

DROP POLICY IF EXISTS "Tasks viewable by task members" ON public.tasks;
CREATE POLICY "Tasks viewable by task members"
ON public.tasks
FOR SELECT
USING (
  CASE
    WHEN CURRENT_USER IN ('realtime'::name, 'supabase_realtime_admin'::name) THEN true
    ELSE (
      public.can_access_channel(channel_id, (SELECT public.requesting_user_id()))
      AND public.check_user_permission((SELECT public.requesting_user_id()), channel_id, 'view_tasks'::public.permission_type)
    )
  END
);

DROP POLICY IF EXISTS "Task assignees viewable by task members" ON public.task_assignees;
CREATE POLICY "Task assignees viewable by task members"
ON public.task_assignees
FOR SELECT
USING (
  CASE
    WHEN CURRENT_USER IN ('realtime'::name, 'supabase_realtime_admin'::name) THEN true
    ELSE EXISTS (
      SELECT 1
      FROM public.tasks t
      WHERE t.id = task_assignees.task_id
        AND public.can_access_channel(t.channel_id, (SELECT public.requesting_user_id()))
        AND public.check_user_permission((SELECT public.requesting_user_id()), t.channel_id, 'view_tasks'::public.permission_type)
    )
  END
);

DROP POLICY IF EXISTS "Task categories viewable by task members" ON public.task_categories;
CREATE POLICY "Task categories viewable by task members"
ON public.task_categories
FOR SELECT
USING (
  CASE
    WHEN CURRENT_USER IN ('realtime'::name, 'supabase_realtime_admin'::name) THEN true
    ELSE (
      public.can_access_channel(channel_id, (SELECT public.requesting_user_id()))
      AND public.check_user_permission((SELECT public.requesting_user_id()), channel_id, 'view_tasks'::public.permission_type)
    )
  END
);

DO $$
BEGIN
  -- Grant read access only to Supabase's internal realtime replication roles.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_realtime_admin') THEN
    EXECUTE 'GRANT SELECT ON TABLE public.tasks TO supabase_realtime_admin';
    EXECUTE 'GRANT SELECT ON TABLE public.task_assignees TO supabase_realtime_admin';
    EXECUTE 'GRANT SELECT ON TABLE public.task_categories TO supabase_realtime_admin';
  ELSIF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'realtime') THEN
    EXECUTE 'GRANT SELECT ON TABLE public.tasks TO realtime';
    EXECUTE 'GRANT SELECT ON TABLE public.task_assignees TO realtime';
    EXECUTE 'GRANT SELECT ON TABLE public.task_categories TO realtime';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'tasks'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'task_assignees'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.task_assignees';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'task_categories'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.task_categories';
    END IF;
  END IF;
END $$;
