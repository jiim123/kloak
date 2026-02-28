-- Fix ban_member role hierarchy to honor custom role positions (match client logic).
DROP FUNCTION IF EXISTS public.ban_member(uuid, uuid, uuid);
CREATE OR REPLACE FUNCTION public.ban_member(_server_id uuid, _user_id uuid, _target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_base_role public.server_role;
  target_base_role public.server_role;
  actor_pos integer;
  target_pos integer;
  actor_rank integer;
  target_rank integer;
BEGIN
  PERFORM set_config('app.moderation_bypass', 'ban', true);

  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'ban_members') THEN
    RAISE EXCEPTION 'You do not have permission to ban members';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.servers
    WHERE id = _server_id AND owner_id = _target_user_id
  ) THEN
    RAISE EXCEPTION 'Cannot ban the server owner';
  END IF;

  SELECT role INTO actor_base_role
  FROM public.server_members
  WHERE server_id = _server_id AND user_id = _user_id AND COALESCE(is_banned, false) = false;

  SELECT role INTO target_base_role
  FROM public.server_members
  WHERE server_id = _server_id AND user_id = _target_user_id AND COALESCE(is_banned, false) = false;

  IF actor_base_role IS NULL THEN
    RAISE EXCEPTION 'Not a member of this server';
  END IF;

  IF target_base_role IS NULL THEN
    RAISE EXCEPTION 'Target user is not a member of this server';
  END IF;

  -- Owner can ban anyone except the owner (handled above).
  IF actor_base_role = 'owner' THEN
    UPDATE public.server_members
    SET is_banned = true
    WHERE server_id = _server_id
      AND user_id = _target_user_id;
    RETURN;
  END IF;

  -- Compare custom role positions if any exist (lower position = higher priority).
  SELECT MIN(sr.position) INTO actor_pos
  FROM public.server_member_roles smr
  JOIN public.server_roles sr ON sr.id = smr.role_id
  WHERE smr.member_id = (
    SELECT id FROM public.server_members
    WHERE server_id = _server_id AND user_id = _user_id
  );

  SELECT MIN(sr.position) INTO target_pos
  FROM public.server_member_roles smr
  JOIN public.server_roles sr ON sr.id = smr.role_id
  WHERE smr.member_id = (
    SELECT id FROM public.server_members
    WHERE server_id = _server_id AND user_id = _target_user_id
  );

  IF actor_pos IS NOT NULL OR target_pos IS NOT NULL THEN
    IF actor_pos IS NULL THEN
      actor_pos := 2147483647;
    END IF;
    IF target_pos IS NULL THEN
      target_pos := 2147483647;
    END IF;
    IF actor_pos >= target_pos THEN
      RAISE EXCEPTION 'You cannot ban a member with an equal or higher role';
    END IF;
  ELSE
    -- Fall back to base role ranks if no custom roles exist.
    actor_rank := CASE actor_base_role
      WHEN 'owner' THEN 0
      WHEN 'admin' THEN 1
      WHEN 'moderator' THEN 2
      ELSE 3
    END;
    target_rank := CASE target_base_role
      WHEN 'owner' THEN 0
      WHEN 'admin' THEN 1
      WHEN 'moderator' THEN 2
      ELSE 3
    END;
    IF actor_rank >= target_rank THEN
      RAISE EXCEPTION 'You cannot ban a member with an equal or higher role';
    END IF;
  END IF;

  UPDATE public.server_members
  SET is_banned = true
  WHERE server_id = _server_id
    AND user_id = _target_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_server_member_privilege_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _bypass text;
BEGIN
  _bypass := current_setting('app.moderation_bypass', true);

  IF NEW.role != OLD.role THEN
    RAISE EXCEPTION 'Role changes must go through assigned role functions';
  END IF;

  IF NEW.is_banned != OLD.is_banned AND _bypass IS DISTINCT FROM 'ban' THEN
    RAISE EXCEPTION 'Ban status must be changed through moderation functions';
  END IF;

  IF NEW.is_muted != OLD.is_muted AND _bypass IS DISTINCT FROM 'mute' THEN
    RAISE EXCEPTION 'Mute status must be changed through moderation functions';
  END IF;

  IF NEW.server_id != OLD.server_id THEN
    RAISE EXCEPTION 'Server ID cannot be changed';
  END IF;
  IF NEW.user_id != OLD.user_id THEN
    RAISE EXCEPTION 'User ID cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;
