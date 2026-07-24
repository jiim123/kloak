-- Include safe server row payloads in server-surface broadcasts.
-- Channel and permission payloads remain thin on the server-wide topic to avoid leaking private metadata.

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
    IF TG_OP = 'DELETE' THEN
      _server_id := OLD.id;
    ELSE
      _server_id := NEW.id;
    END IF;
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

  _payload := jsonb_build_object(
    'table', TG_TABLE_NAME,
    'op', TG_OP,
    'new', CASE WHEN TG_TABLE_NAME = 'servers' THEN _row_new ELSE NULL END,
    'old', CASE WHEN TG_TABLE_NAME = 'servers' THEN _row_old ELSE NULL END
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
