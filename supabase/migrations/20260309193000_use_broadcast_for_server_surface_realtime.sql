-- Fallback realtime path for server surface updates.
-- Emits broadcast events on topic server:<server_id> for channel/category/role/member
-- mutations so clients can refresh even when postgres_changes delivery is inconsistent.

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
    'op', TG_OP
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

DROP TRIGGER IF EXISTS trg_broadcast_server_surface_channels ON public.channels;
CREATE TRIGGER trg_broadcast_server_surface_channels
AFTER INSERT OR UPDATE OR DELETE ON public.channels
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_server_surface_change();

DROP TRIGGER IF EXISTS trg_broadcast_server_surface_channel_categories ON public.channel_categories;
CREATE TRIGGER trg_broadcast_server_surface_channel_categories
AFTER INSERT OR UPDATE OR DELETE ON public.channel_categories
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_server_surface_change();

DROP TRIGGER IF EXISTS trg_broadcast_server_surface_channel_permissions ON public.channel_permissions;
CREATE TRIGGER trg_broadcast_server_surface_channel_permissions
AFTER INSERT OR UPDATE OR DELETE ON public.channel_permissions
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_server_surface_change();

DROP TRIGGER IF EXISTS trg_broadcast_server_surface_role_permissions ON public.role_permissions;
CREATE TRIGGER trg_broadcast_server_surface_role_permissions
AFTER INSERT OR UPDATE OR DELETE ON public.role_permissions
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_server_surface_change();

DROP TRIGGER IF EXISTS trg_broadcast_server_surface_server_roles ON public.server_roles;
CREATE TRIGGER trg_broadcast_server_surface_server_roles
AFTER INSERT OR UPDATE OR DELETE ON public.server_roles
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_server_surface_change();

DROP TRIGGER IF EXISTS trg_broadcast_server_surface_server_member_roles ON public.server_member_roles;
CREATE TRIGGER trg_broadcast_server_surface_server_member_roles
AFTER INSERT OR UPDATE OR DELETE ON public.server_member_roles
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_server_surface_change();

DROP TRIGGER IF EXISTS trg_broadcast_server_surface_server_members ON public.server_members;
CREATE TRIGGER trg_broadcast_server_surface_server_members
AFTER INSERT OR UPDATE OR DELETE ON public.server_members
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_server_surface_change();

DROP TRIGGER IF EXISTS trg_broadcast_server_surface_channel_members ON public.channel_members;
CREATE TRIGGER trg_broadcast_server_surface_channel_members
AFTER INSERT OR UPDATE OR DELETE ON public.channel_members
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_server_surface_change();

DROP TRIGGER IF EXISTS trg_broadcast_server_surface_servers ON public.servers;
CREATE TRIGGER trg_broadcast_server_surface_servers
AFTER UPDATE OR DELETE ON public.servers
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_server_surface_change();

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END
$$;
