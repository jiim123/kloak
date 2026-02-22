-- Phase 6 backstop: enforce secure end-state after any legacy migration replay.
-- Purpose:
-- 1) Keep post_system_message non-callable by client roles.
-- 2) Require identity checks for user_server_folders RPCs.
-- 3) Re-apply explicit execute grants for these RPCs.

-- -------------------------------------------------------------------
-- 1) post_system_message: internal-only (no anon/authenticated/public execute)
-- -------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.post_system_message(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.post_system_message(uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.post_system_message(uuid, uuid, text) FROM authenticated;

-- -------------------------------------------------------------------
-- 2) get_user_server_folders: enforce caller identity
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_server_folders(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT folder_data
    INTO result
  FROM public.user_server_folders
  WHERE user_id = _user_id;

  IF result IS NULL THEN
    RETURN '{"folders":[],"serverToFolder":{}}'::jsonb;
  END IF;

  RETURN result;
END;
$function$;

-- -------------------------------------------------------------------
-- 3) save_user_server_folders: enforce caller identity
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_user_server_folders(_user_id uuid, _folder_data jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  INSERT INTO public.user_server_folders (user_id, folder_data, updated_at)
  VALUES (_user_id, _folder_data, now())
  ON CONFLICT (user_id)
  DO UPDATE SET
    folder_data = EXCLUDED.folder_data,
    updated_at = now();

  RETURN true;
END;
$function$;

-- -------------------------------------------------------------------
-- 4) Execute grants for user_server_folders RPCs
-- -------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.get_user_server_folders(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_server_folders(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_server_folders(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.save_user_server_folders(uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.save_user_server_folders(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_user_server_folders(uuid, jsonb) TO authenticated;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
