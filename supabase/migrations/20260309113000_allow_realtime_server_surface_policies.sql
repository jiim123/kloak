-- Allow Supabase Realtime to observe server-surface tables used by active clients.
-- Without these SELECT policy exceptions, postgres_changes subscriptions can connect
-- successfully while silently missing INSERT/UPDATE/DELETE events for other users.
-- The relevant tables must also be present in the supabase_realtime publication.

DROP POLICY IF EXISTS "Channels viewable by server members" ON public.channels;
CREATE POLICY "Channels viewable by server members"
ON public.channels
FOR SELECT
USING (
  CASE
    WHEN CURRENT_USER IN ('realtime'::name, 'supabase_realtime_admin'::name) THEN true
    ELSE (
      public.is_server_member(server_id, (SELECT public.requesting_user_id()))
      AND (
        is_private = false
        OR public.has_private_channel_access(id, (SELECT public.requesting_user_id()))
      )
    )
  END
);

DROP POLICY IF EXISTS "Members view categories" ON public.channel_categories;
CREATE POLICY "Members view categories"
ON public.channel_categories
FOR SELECT
USING (
  CASE
    WHEN CURRENT_USER IN ('realtime'::name, 'supabase_realtime_admin'::name) THEN true
    ELSE public.is_server_member(server_id, (SELECT public.requesting_user_id()))
  END
);

DROP POLICY IF EXISTS "Channel permissions viewable by members" ON public.channel_permissions;
CREATE POLICY "Channel permissions viewable by members"
ON public.channel_permissions
FOR SELECT
USING (
  CASE
    WHEN CURRENT_USER IN ('realtime'::name, 'supabase_realtime_admin'::name) THEN true
    ELSE public.is_channel_server_member(channel_id, (SELECT public.requesting_user_id()))
  END
);

DROP POLICY IF EXISTS "Role permissions viewable by members" ON public.role_permissions;
CREATE POLICY "Role permissions viewable by members"
ON public.role_permissions
FOR SELECT
USING (
  CASE
    WHEN CURRENT_USER IN ('realtime'::name, 'supabase_realtime_admin'::name) THEN true
    ELSE public.is_server_member(server_id, (SELECT public.requesting_user_id()))
  END
);

DROP POLICY IF EXISTS "Server roles viewable by members" ON public.server_roles;
CREATE POLICY "Server roles viewable by members"
ON public.server_roles
FOR SELECT
USING (
  CASE
    WHEN CURRENT_USER IN ('realtime'::name, 'supabase_realtime_admin'::name) THEN true
    ELSE public.is_server_member(server_id, (SELECT public.requesting_user_id()))
  END
);

DROP POLICY IF EXISTS "Member roles viewable by server members" ON public.server_member_roles;
CREATE POLICY "Member roles viewable by server members"
ON public.server_member_roles
FOR SELECT
USING (
  CASE
    WHEN CURRENT_USER IN ('realtime'::name, 'supabase_realtime_admin'::name) THEN true
    ELSE public.is_member_in_same_server(member_id, (SELECT public.requesting_user_id()))
  END
);

DROP POLICY IF EXISTS "Server members view channel members" ON public.channel_members;
CREATE POLICY "Server members view channel members"
ON public.channel_members
FOR SELECT
USING (
  CASE
    WHEN CURRENT_USER IN ('realtime'::name, 'supabase_realtime_admin'::name) THEN true
    ELSE public.is_channel_server_member(channel_id, (SELECT public.requesting_user_id()))
  END
);

DO $$
BEGIN
  -- Grant read access only to Supabase's internal replication role so
  -- postgres_changes can evaluate RLS without widening app-user access.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_realtime_admin') THEN
    EXECUTE 'GRANT SELECT ON TABLE public.servers TO supabase_realtime_admin';
    EXECUTE 'GRANT SELECT ON TABLE public.channels TO supabase_realtime_admin';
    EXECUTE 'GRANT SELECT ON TABLE public.channel_categories TO supabase_realtime_admin';
    EXECUTE 'GRANT SELECT ON TABLE public.server_members TO supabase_realtime_admin';
    EXECUTE 'GRANT SELECT ON TABLE public.server_roles TO supabase_realtime_admin';
    EXECUTE 'GRANT SELECT ON TABLE public.server_member_roles TO supabase_realtime_admin';
    EXECUTE 'GRANT SELECT ON TABLE public.channel_members TO supabase_realtime_admin';
    EXECUTE 'GRANT SELECT ON TABLE public.role_permissions TO supabase_realtime_admin';
    EXECUTE 'GRANT SELECT ON TABLE public.channel_permissions TO supabase_realtime_admin';
  ELSIF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'realtime') THEN
    EXECUTE 'GRANT SELECT ON TABLE public.servers TO realtime';
    EXECUTE 'GRANT SELECT ON TABLE public.channels TO realtime';
    EXECUTE 'GRANT SELECT ON TABLE public.channel_categories TO realtime';
    EXECUTE 'GRANT SELECT ON TABLE public.server_members TO realtime';
    EXECUTE 'GRANT SELECT ON TABLE public.server_roles TO realtime';
    EXECUTE 'GRANT SELECT ON TABLE public.server_member_roles TO realtime';
    EXECUTE 'GRANT SELECT ON TABLE public.channel_members TO realtime';
    EXECUTE 'GRANT SELECT ON TABLE public.role_permissions TO realtime';
    EXECUTE 'GRANT SELECT ON TABLE public.channel_permissions TO realtime';
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
        AND tablename = 'servers'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.servers';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'channels'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.channels';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'channel_categories'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_categories';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'server_roles'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.server_roles';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'server_member_roles'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.server_member_roles';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'channel_members'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_members';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'role_permissions'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.role_permissions';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'channel_permissions'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_permissions';
    END IF;
  END IF;
END
$$;
