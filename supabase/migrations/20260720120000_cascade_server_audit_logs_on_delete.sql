CREATE OR REPLACE FUNCTION public.insert_server_audit_log_entry(
  _server_id uuid,
  _actor_id uuid,
  _action text,
  _target_type text DEFAULT NULL,
  _target_id uuid DEFAULT NULL,
  _summary text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF _server_id IS NULL OR _action IS NULL THEN
    RETURN;
  END IF;

  IF current_setting('app.suppress_server_audit_log', true) = 'on' THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.servers WHERE id = _server_id) THEN
    RETURN;
  END IF;

  INSERT INTO public.server_audit_log_entries (
    server_id,
    actor_id,
    action,
    target_type,
    target_id,
    summary,
    metadata
  )
  VALUES (
    _server_id,
    _actor_id,
    _action,
    _target_type,
    _target_id,
    COALESCE(NULLIF(_summary, ''), _action),
    COALESCE(_metadata, '{}'::jsonb)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.suppress_server_audit_log_for_server_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM set_config('app.suppress_server_audit_log', 'on', true);

  DELETE FROM public.server_audit_log_entries
  WHERE server_id = OLD.id;

  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS trg_suppress_server_audit_log_for_server_delete ON public.servers;
CREATE TRIGGER trg_suppress_server_audit_log_for_server_delete
BEFORE DELETE ON public.servers
FOR EACH ROW
EXECUTE FUNCTION public.suppress_server_audit_log_for_server_delete();

CREATE OR REPLACE FUNCTION public.delete_server(_server_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_server') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  PERFORM set_config('app.suppress_server_audit_log', 'on', true);

  DELETE FROM public.server_audit_log_entries
  WHERE server_id = _server_id;

  DELETE FROM public.messages
  WHERE channel_id IN (
    SELECT id FROM public.channels WHERE server_id = _server_id
  );

  DELETE FROM public.channels WHERE server_id = _server_id;
  DELETE FROM public.channel_categories WHERE server_id = _server_id;
  DELETE FROM public.server_members WHERE server_id = _server_id;
  DELETE FROM public.servers WHERE id = _server_id;

  RETURN true;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.insert_server_audit_log_entry(uuid, uuid, text, text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.suppress_server_audit_log_for_server_delete() FROM PUBLIC, anon, authenticated;
