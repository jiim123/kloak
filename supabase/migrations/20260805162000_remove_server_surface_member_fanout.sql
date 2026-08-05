-- Do not build and broadcast a full private server surface for every member
-- inside a row trigger. Large servers made a single membership/role mutation
-- O(member_count) and could exceed statement_timeout.
--
-- Broadcast only a privacy-safe invalidation event. Clients refetch their own
-- authorized surface after the source transaction commits.

CREATE OR REPLACE FUNCTION public.broadcast_server_surface_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _server_id uuid;
  _channel_id uuid;
  _member_id uuid;
  _row_new jsonb;
  _row_old jsonb;
  _payload jsonb;
BEGIN
  _row_new := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  _row_old := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;

  _server_id := COALESCE(
    NULLIF((_row_new ->> 'server_id'), '')::uuid,
    NULLIF((_row_old ->> 'server_id'), '')::uuid
  );

  IF _server_id IS NULL AND TG_TABLE_NAME = 'servers' THEN
    _server_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
  END IF;

  IF _server_id IS NULL AND TG_TABLE_NAME IN ('channel_permissions', 'channel_members') THEN
    _channel_id := COALESCE(
      NULLIF((_row_new ->> 'channel_id'), '')::uuid,
      NULLIF((_row_old ->> 'channel_id'), '')::uuid
    );
    IF _channel_id IS NOT NULL THEN
      SELECT c.server_id INTO _server_id
      FROM public.channels c
      WHERE c.id = _channel_id;
    END IF;
  END IF;

  IF _server_id IS NULL AND TG_TABLE_NAME = 'server_member_roles' THEN
    _member_id := COALESCE(
      NULLIF((_row_new ->> 'member_id'), '')::uuid,
      NULLIF((_row_old ->> 'member_id'), '')::uuid
    );
    IF _member_id IS NOT NULL THEN
      SELECT sm.server_id INTO _server_id
      FROM public.server_members sm
      WHERE sm.id = _member_id;
    END IF;
  END IF;

  IF _server_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Do not include member, role, user, or channel rows in the public topic.
  -- The event only tells authorized clients which server surface to refresh.
  _payload := jsonb_build_object(
    'table', TG_TABLE_NAME,
    'op', TG_OP,
    'server_id', _server_id
  );

  PERFORM realtime.send(
    _payload,
    'server_surface',
    'server:' || _server_id::text,
    false
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.broadcast_server_surface_change() FROM PUBLIC;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
