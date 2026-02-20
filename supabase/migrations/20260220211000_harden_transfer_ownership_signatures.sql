-- Harden transfer_ownership RPC signatures and avoid caller-id spoofing.
-- Also adds compatibility for callers using p_server_id/p_new_owner_id arg names.

DROP FUNCTION IF EXISTS public.transfer_ownership(uuid, uuid);

-- Canonical function: caller identity is derived from requesting_user_id().
CREATE OR REPLACE FUNCTION public.transfer_ownership(
  _server_id uuid,
  _new_owner_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_owner_id uuid;
  current_owner_member_id uuid;
  new_owner_member_id uuid;
  caller_user_id uuid;
BEGIN
  caller_user_id := public.requesting_user_id();
  IF caller_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Forbidden';
  END IF;

  SELECT owner_id INTO current_owner_id
  FROM public.servers
  WHERE id = _server_id;

  IF current_owner_id IS NULL OR current_owner_id <> caller_user_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Forbidden';
  END IF;

  SELECT id INTO current_owner_member_id
  FROM public.server_members
  WHERE server_id = _server_id
    AND user_id = caller_user_id
    AND COALESCE(is_banned, false) = false;

  SELECT id INTO new_owner_member_id
  FROM public.server_members
  WHERE server_id = _server_id
    AND user_id = _new_owner_id
    AND COALESCE(is_banned, false) = false;

  IF current_owner_member_id IS NULL OR new_owner_member_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Forbidden';
  END IF;

  UPDATE public.server_members SET role = 'owner' WHERE id = new_owner_member_id;
  UPDATE public.server_members SET role = 'admin' WHERE id = current_owner_member_id;
  UPDATE public.servers SET owner_id = _new_owner_id WHERE id = _server_id;

  RETURN true;
END;
$$;

-- Backward-compatible wrapper for existing client payload.
CREATE OR REPLACE FUNCTION public.transfer_ownership(
  _server_id uuid,
  _current_owner_id uuid,
  _new_owner_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.requesting_user_id() IS DISTINCT FROM _current_owner_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Forbidden';
  END IF;

  RETURN public.transfer_ownership(_server_id, _new_owner_id);
END;
$$;
