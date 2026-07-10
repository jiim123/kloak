CREATE OR REPLACE FUNCTION public.audit_server_roles_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _actor_id uuid := public.audit_request_actor_id();
  _changed_fields text[] := ARRAY[]::text[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.insert_server_audit_log_entry(
      NEW.server_id,
      _actor_id,
      'role_created',
      'role',
      NEW.id,
      'Created role ' || NEW.name,
      jsonb_build_object('role_id', NEW.id, 'name', NEW.name, 'role_display_name', NEW.name)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.name IS DISTINCT FROM NEW.name THEN _changed_fields := array_append(_changed_fields, 'name'); END IF;
    IF OLD.color IS DISTINCT FROM NEW.color THEN _changed_fields := array_append(_changed_fields, 'color'); END IF;
    IF OLD.icon IS DISTINCT FROM NEW.icon THEN _changed_fields := array_append(_changed_fields, 'icon'); END IF;
    IF OLD.position IS DISTINCT FROM NEW.position THEN _changed_fields := array_append(_changed_fields, 'position'); END IF;
    IF OLD.is_self_assignable IS DISTINCT FROM NEW.is_self_assignable THEN _changed_fields := array_append(_changed_fields, 'is_self_assignable'); END IF;

    IF cardinality(_changed_fields) > 0 THEN
      PERFORM public.insert_server_audit_log_entry(
        NEW.server_id,
        _actor_id,
        CASE WHEN _changed_fields = ARRAY['position']::text[] THEN 'role_reordered' ELSE 'role_updated' END,
        'role',
        NEW.id,
        'Updated role ' || NEW.name || ' (' || array_to_string(_changed_fields, ', ') || ')',
        jsonb_build_object(
          'role_id', NEW.id,
          'role_display_name', NEW.name,
          'changed_fields', to_jsonb(_changed_fields),
          'before', to_jsonb(OLD),
          'after', to_jsonb(NEW)
        )
      );
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.insert_server_audit_log_entry(
      OLD.server_id,
      _actor_id,
      'role_deleted',
      'role',
      OLD.id,
      'Deleted role ' || OLD.name,
      jsonb_build_object('role_id', OLD.id, 'name', OLD.name, 'role_display_name', OLD.name)
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.audit_role_permissions_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _actor_id uuid := public.audit_request_actor_id();
  _server_id uuid;
  _permission public.permission_type;
  _role_id uuid;
  _role_name public.server_role;
  _entry_id uuid;
  _allowed boolean;
  _role_display_name text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _server_id := OLD.server_id;
    _permission := OLD.permission;
    _role_id := OLD.role_id;
    _role_name := OLD.role_name;
    _entry_id := OLD.id;
    _allowed := NULL;
  ELSE
    _server_id := NEW.server_id;
    _permission := NEW.permission;
    _role_id := NEW.role_id;
    _role_name := NEW.role_name;
    _entry_id := NEW.id;
    _allowed := NEW.allowed;
  END IF;

  IF _role_id IS NOT NULL THEN
    SELECT sr.name INTO _role_display_name
    FROM public.server_roles sr
    WHERE sr.id = _role_id;
  ELSE
    _role_display_name := _role_name::text;
  END IF;

  PERFORM public.insert_server_audit_log_entry(
    _server_id,
    _actor_id,
    CASE TG_OP
      WHEN 'INSERT' THEN 'role_permission_set'
      WHEN 'UPDATE' THEN 'role_permission_updated'
      ELSE 'role_permission_removed'
    END,
    'role_permission',
    _entry_id,
    CASE TG_OP
      WHEN 'DELETE' THEN 'Removed ' || _permission::text || ' from ' || COALESCE(_role_display_name, 'unknown role')
      ELSE 'Set ' || _permission::text || ' for ' || COALESCE(_role_display_name, 'unknown role') || ' to ' || CASE WHEN _allowed THEN 'allow' ELSE 'deny' END
    END,
    jsonb_build_object(
      'permission', _permission,
      'role_id', _role_id,
      'role_name', _role_name,
      'role_display_name', _role_display_name,
      'allowed', _allowed
    )
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.audit_server_roles_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_role_permissions_change() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END
$$;
