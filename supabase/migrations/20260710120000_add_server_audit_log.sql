CREATE TABLE IF NOT EXISTS public.server_audit_log_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  summary text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_server_audit_log_entries_server_created
  ON public.server_audit_log_entries (server_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_server_audit_log_entries_actor_created
  ON public.server_audit_log_entries (actor_id, created_at DESC)
  WHERE actor_id IS NOT NULL;

ALTER TABLE public.server_audit_log_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_audit_log_entries FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS server_audit_log_entries_no_direct_access ON public.server_audit_log_entries;
CREATE POLICY server_audit_log_entries_no_direct_access
  ON public.server_audit_log_entries
  FOR ALL
  USING (false)
  WITH CHECK (false);

REVOKE ALL ON TABLE public.server_audit_log_entries FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.server_audit_log_entries TO service_role;

CREATE OR REPLACE FUNCTION public.audit_request_actor_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _actor_id uuid;
BEGIN
  BEGIN
    _actor_id := public.requesting_user_id();
  EXCEPTION WHEN OTHERS THEN
    _actor_id := NULL;
  END;

  IF _actor_id IS NOT NULL AND public.verify_request_identity(_actor_id) THEN
    RETURN _actor_id;
  END IF;

  RETURN NULL;
END;
$function$;

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

CREATE OR REPLACE FUNCTION public.audit_servers_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _changed_fields text[] := ARRAY[]::text[];
  _actor_id uuid := public.audit_request_actor_id();
BEGIN
  IF OLD.name IS DISTINCT FROM NEW.name THEN _changed_fields := array_append(_changed_fields, 'name'); END IF;
  IF OLD.about IS DISTINCT FROM NEW.about THEN _changed_fields := array_append(_changed_fields, 'about'); END IF;
  IF OLD.icon_url IS DISTINCT FROM NEW.icon_url THEN _changed_fields := array_append(_changed_fields, 'icon'); END IF;
  IF OLD.banner_url IS DISTINCT FROM NEW.banner_url THEN _changed_fields := array_append(_changed_fields, 'banner'); END IF;
  IF OLD.is_published IS DISTINCT FROM NEW.is_published THEN _changed_fields := array_append(_changed_fields, 'public status'); END IF;
  IF OLD.is_nsfw IS DISTINCT FROM NEW.is_nsfw THEN _changed_fields := array_append(_changed_fields, 'NSFW setting'); END IF;
  IF OLD.timezone IS DISTINCT FROM NEW.timezone THEN _changed_fields := array_append(_changed_fields, 'timezone'); END IF;
  IF OLD.min_account_age_days IS DISTINCT FROM NEW.min_account_age_days THEN _changed_fields := array_append(_changed_fields, 'minimum account age'); END IF;
  IF OLD.system_channel_join_id IS DISTINCT FROM NEW.system_channel_join_id THEN _changed_fields := array_append(_changed_fields, 'join message channel'); END IF;
  IF OLD.system_channel_leave_id IS DISTINCT FROM NEW.system_channel_leave_id THEN _changed_fields := array_append(_changed_fields, 'leave message channel'); END IF;
  IF OLD.enable_join_messages IS DISTINCT FROM NEW.enable_join_messages THEN _changed_fields := array_append(_changed_fields, 'join messages'); END IF;
  IF OLD.enable_leave_messages IS DISTINCT FROM NEW.enable_leave_messages THEN _changed_fields := array_append(_changed_fields, 'leave messages'); END IF;
  IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN _changed_fields := array_append(_changed_fields, 'owner'); END IF;

  IF cardinality(_changed_fields) > 0 THEN
    PERFORM public.insert_server_audit_log_entry(
      NEW.id,
      _actor_id,
      CASE WHEN OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN 'server_ownership_transferred' ELSE 'server_updated' END,
      'server',
      NEW.id,
      CASE
        WHEN OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN 'Transferred server ownership'
        ELSE 'Updated server ' || array_to_string(_changed_fields, ', ')
      END,
      jsonb_build_object(
        'changed_fields', to_jsonb(_changed_fields),
        'before', jsonb_build_object(
          'name', OLD.name,
          'about', OLD.about,
          'icon_url', OLD.icon_url,
          'banner_url', OLD.banner_url,
          'is_published', OLD.is_published,
          'is_nsfw', OLD.is_nsfw,
          'timezone', OLD.timezone,
          'min_account_age_days', OLD.min_account_age_days,
          'system_channel_join_id', OLD.system_channel_join_id,
          'system_channel_leave_id', OLD.system_channel_leave_id,
          'enable_join_messages', OLD.enable_join_messages,
          'enable_leave_messages', OLD.enable_leave_messages,
          'owner_id', OLD.owner_id
        ),
        'after', jsonb_build_object(
          'name', NEW.name,
          'about', NEW.about,
          'icon_url', NEW.icon_url,
          'banner_url', NEW.banner_url,
          'is_published', NEW.is_published,
          'is_nsfw', NEW.is_nsfw,
          'timezone', NEW.timezone,
          'min_account_age_days', NEW.min_account_age_days,
          'system_channel_join_id', NEW.system_channel_join_id,
          'system_channel_leave_id', NEW.system_channel_leave_id,
          'enable_join_messages', NEW.enable_join_messages,
          'enable_leave_messages', NEW.enable_leave_messages,
          'owner_id', NEW.owner_id
        )
      )
    );
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_audit_servers_update ON public.servers;
CREATE TRIGGER trg_audit_servers_update
AFTER UPDATE ON public.servers
FOR EACH ROW
EXECUTE FUNCTION public.audit_servers_update();

CREATE OR REPLACE FUNCTION public.audit_server_members_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _actor_id uuid := public.audit_request_actor_id();
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF COALESCE(OLD.is_banned, false) = false AND COALESCE(NEW.is_banned, false) = true THEN
      PERFORM public.insert_server_audit_log_entry(
        NEW.server_id,
        _actor_id,
        'member_banned',
        'member',
        NEW.user_id,
        'Banned a member',
        jsonb_build_object('target_user_id', NEW.user_id)
      );
    ELSIF COALESCE(OLD.is_banned, false) = true AND COALESCE(NEW.is_banned, false) = false THEN
      PERFORM public.insert_server_audit_log_entry(
        NEW.server_id,
        _actor_id,
        'member_unbanned',
        'member',
        NEW.user_id,
        'Unbanned a member',
        jsonb_build_object('target_user_id', NEW.user_id)
      );
    ELSIF OLD.is_muted IS DISTINCT FROM NEW.is_muted THEN
      PERFORM public.insert_server_audit_log_entry(
        NEW.server_id,
        _actor_id,
        CASE WHEN COALESCE(NEW.is_muted, false) THEN 'member_muted' ELSE 'member_unmuted' END,
        'member',
        NEW.user_id,
        CASE WHEN COALESCE(NEW.is_muted, false) THEN 'Muted a member' ELSE 'Unmuted a member' END,
        jsonb_build_object('target_user_id', NEW.user_id)
      );
    ELSIF OLD.nickname IS DISTINCT FROM NEW.nickname THEN
      PERFORM public.insert_server_audit_log_entry(
        NEW.server_id,
        _actor_id,
        'member_nickname_updated',
        'member',
        NEW.user_id,
        'Updated a member nickname',
        jsonb_build_object('target_user_id', NEW.user_id, 'before', OLD.nickname, 'after', NEW.nickname)
      );
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.insert_server_audit_log_entry(
      OLD.server_id,
      _actor_id,
      CASE WHEN COALESCE(OLD.is_banned, false) THEN 'member_unbanned' ELSE 'member_kicked' END,
      'member',
      OLD.user_id,
      CASE WHEN COALESCE(OLD.is_banned, false) THEN 'Unbanned a member' ELSE 'Kicked a member' END,
      jsonb_build_object('target_user_id', OLD.user_id)
    );

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_audit_server_members_update ON public.server_members;
CREATE TRIGGER trg_audit_server_members_update
AFTER UPDATE ON public.server_members
FOR EACH ROW
EXECUTE FUNCTION public.audit_server_members_change();

DROP TRIGGER IF EXISTS trg_audit_server_members_delete ON public.server_members;
CREATE TRIGGER trg_audit_server_members_delete
AFTER DELETE ON public.server_members
FOR EACH ROW
EXECUTE FUNCTION public.audit_server_members_change();

CREATE OR REPLACE FUNCTION public.audit_server_roles_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _actor_id uuid := public.audit_request_actor_id();
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.insert_server_audit_log_entry(
      NEW.server_id,
      _actor_id,
      'role_created',
      'role',
      NEW.id,
      'Created role ' || NEW.name,
      jsonb_build_object('role_id', NEW.id, 'name', NEW.name)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.name IS DISTINCT FROM NEW.name
       OR OLD.color IS DISTINCT FROM NEW.color
       OR OLD.icon IS DISTINCT FROM NEW.icon
       OR OLD.position IS DISTINCT FROM NEW.position
       OR OLD.is_self_assignable IS DISTINCT FROM NEW.is_self_assignable THEN
      PERFORM public.insert_server_audit_log_entry(
        NEW.server_id,
        _actor_id,
        CASE WHEN OLD.position IS DISTINCT FROM NEW.position THEN 'role_reordered' ELSE 'role_updated' END,
        'role',
        NEW.id,
        CASE WHEN OLD.position IS DISTINCT FROM NEW.position THEN 'Reordered role ' || NEW.name ELSE 'Updated role ' || NEW.name END,
        jsonb_build_object('role_id', NEW.id, 'before', to_jsonb(OLD), 'after', to_jsonb(NEW))
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
      jsonb_build_object('role_id', OLD.id, 'name', OLD.name)
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_audit_server_roles_insert ON public.server_roles;
CREATE TRIGGER trg_audit_server_roles_insert
AFTER INSERT ON public.server_roles
FOR EACH ROW
EXECUTE FUNCTION public.audit_server_roles_change();

DROP TRIGGER IF EXISTS trg_audit_server_roles_update ON public.server_roles;
CREATE TRIGGER trg_audit_server_roles_update
AFTER UPDATE ON public.server_roles
FOR EACH ROW
EXECUTE FUNCTION public.audit_server_roles_change();

DROP TRIGGER IF EXISTS trg_audit_server_roles_delete ON public.server_roles;
CREATE TRIGGER trg_audit_server_roles_delete
AFTER DELETE ON public.server_roles
FOR EACH ROW
EXECUTE FUNCTION public.audit_server_roles_change();

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
      WHEN 'DELETE' THEN 'Removed role permission ' || _permission::text
      ELSE 'Set role permission ' || _permission::text
    END,
    jsonb_build_object(
      'permission', _permission,
      'role_id', _role_id,
      'role_name', _role_name,
      'allowed', _allowed
    )
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_audit_role_permissions_insert ON public.role_permissions;
CREATE TRIGGER trg_audit_role_permissions_insert
AFTER INSERT ON public.role_permissions
FOR EACH ROW
EXECUTE FUNCTION public.audit_role_permissions_change();

DROP TRIGGER IF EXISTS trg_audit_role_permissions_update ON public.role_permissions;
CREATE TRIGGER trg_audit_role_permissions_update
AFTER UPDATE ON public.role_permissions
FOR EACH ROW
EXECUTE FUNCTION public.audit_role_permissions_change();

DROP TRIGGER IF EXISTS trg_audit_role_permissions_delete ON public.role_permissions;
CREATE TRIGGER trg_audit_role_permissions_delete
AFTER DELETE ON public.role_permissions
FOR EACH ROW
EXECUTE FUNCTION public.audit_role_permissions_change();

CREATE OR REPLACE FUNCTION public.audit_server_invites_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _actor_id uuid := public.audit_request_actor_id();
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.insert_server_audit_log_entry(
      NEW.server_id,
      COALESCE(_actor_id, NEW.created_by),
      'invite_created',
      'invite',
      NEW.id,
      'Created invite ' || trim(NEW.code::text),
      jsonb_build_object('invite_id', NEW.id, 'code', trim(NEW.code::text), 'expires_at', NEW.expires_at, 'max_uses', NEW.max_uses)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' AND OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL THEN
    PERFORM public.insert_server_audit_log_entry(
      NEW.server_id,
      COALESCE(_actor_id, NEW.revoked_by),
      'invite_revoked',
      'invite',
      NEW.id,
      'Revoked invite ' || trim(NEW.code::text),
      jsonb_build_object('invite_id', NEW.id, 'code', trim(NEW.code::text))
    );
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_audit_server_invites_insert ON public.server_invites;
CREATE TRIGGER trg_audit_server_invites_insert
AFTER INSERT ON public.server_invites
FOR EACH ROW
EXECUTE FUNCTION public.audit_server_invites_change();

DROP TRIGGER IF EXISTS trg_audit_server_invites_update ON public.server_invites;
CREATE TRIGGER trg_audit_server_invites_update
AFTER UPDATE ON public.server_invites
FOR EACH ROW
EXECUTE FUNCTION public.audit_server_invites_change();

CREATE OR REPLACE FUNCTION public.audit_server_emojis_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _actor_id uuid := public.audit_request_actor_id();
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.insert_server_audit_log_entry(
      NEW.server_id,
      COALESCE(_actor_id, NEW.created_by),
      'emoji_created',
      'emoji',
      NEW.id,
      'Created emoji :' || NEW.name || ':',
      jsonb_build_object('emoji_id', NEW.id, 'name', NEW.name, 'file_path', NEW.file_path)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.insert_server_audit_log_entry(
      NEW.server_id,
      _actor_id,
      'emoji_updated',
      'emoji',
      NEW.id,
      'Updated emoji :' || NEW.name || ':',
      jsonb_build_object('emoji_id', NEW.id, 'before', to_jsonb(OLD), 'after', to_jsonb(NEW))
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.insert_server_audit_log_entry(
      OLD.server_id,
      _actor_id,
      'emoji_deleted',
      'emoji',
      OLD.id,
      'Deleted emoji :' || OLD.name || ':',
      jsonb_build_object('emoji_id', OLD.id, 'name', OLD.name, 'file_path', OLD.file_path)
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_audit_server_emojis_insert ON public.server_emojis;
CREATE TRIGGER trg_audit_server_emojis_insert
AFTER INSERT ON public.server_emojis
FOR EACH ROW
EXECUTE FUNCTION public.audit_server_emojis_change();

DROP TRIGGER IF EXISTS trg_audit_server_emojis_update ON public.server_emojis;
CREATE TRIGGER trg_audit_server_emojis_update
AFTER UPDATE ON public.server_emojis
FOR EACH ROW
EXECUTE FUNCTION public.audit_server_emojis_change();

DROP TRIGGER IF EXISTS trg_audit_server_emojis_delete ON public.server_emojis;
CREATE TRIGGER trg_audit_server_emojis_delete
AFTER DELETE ON public.server_emojis
FOR EACH ROW
EXECUTE FUNCTION public.audit_server_emojis_change();

CREATE OR REPLACE FUNCTION public.audit_server_member_roles_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _actor_id uuid := public.audit_request_actor_id();
  _server_id uuid;
  _target_user_id uuid;
  _role_name text;
  _member_id uuid;
  _role_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _member_id := OLD.member_id;
    _role_id := OLD.role_id;
  ELSE
    _member_id := NEW.member_id;
    _role_id := NEW.role_id;
  END IF;

  SELECT sm.server_id, sm.user_id
    INTO _server_id, _target_user_id
  FROM public.server_members sm
  WHERE sm.id = _member_id;

  SELECT sr.name
    INTO _role_name
  FROM public.server_roles sr
  WHERE sr.id = _role_id;

  PERFORM public.insert_server_audit_log_entry(
    _server_id,
    _actor_id,
    CASE WHEN TG_OP = 'INSERT' THEN 'member_role_added' ELSE 'member_role_removed' END,
    'member',
    _target_user_id,
    CASE WHEN TG_OP = 'INSERT' THEN 'Added role ' || COALESCE(_role_name, 'unknown') || ' to member' ELSE 'Removed role ' || COALESCE(_role_name, 'unknown') || ' from member' END,
    jsonb_build_object('target_user_id', _target_user_id, 'role_id', _role_id, 'role_name', _role_name)
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_audit_server_member_roles_insert ON public.server_member_roles;
CREATE TRIGGER trg_audit_server_member_roles_insert
AFTER INSERT ON public.server_member_roles
FOR EACH ROW
EXECUTE FUNCTION public.audit_server_member_roles_change();

DROP TRIGGER IF EXISTS trg_audit_server_member_roles_delete ON public.server_member_roles;
CREATE TRIGGER trg_audit_server_member_roles_delete
AFTER DELETE ON public.server_member_roles
FOR EACH ROW
EXECUTE FUNCTION public.audit_server_member_roles_change();

CREATE OR REPLACE FUNCTION public.get_server_audit_log(
  _server_id uuid,
  _user_id uuid,
  _limit integer DEFAULT 100,
  _before timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  server_id uuid,
  actor_id uuid,
  action text,
  target_type text,
  target_id uuid,
  summary text,
  metadata jsonb,
  created_at timestamptz,
  actor_username text,
  actor_display_name text,
  actor_avatar_url text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _safe_limit integer := LEAST(GREATEST(COALESCE(_limit, 100), 1), 200);
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.server_members sm
    WHERE sm.server_id = _server_id
      AND sm.user_id = _user_id
      AND COALESCE(sm.is_banned, false) = false
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.servers s
    WHERE s.id = _server_id
      AND s.owner_id = _user_id
  ) THEN
    RAISE EXCEPTION 'Not a member of this server';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'view_audit_log'::public.permission_type)
     AND NOT EXISTS (
       SELECT 1
       FROM public.server_members sm
       WHERE sm.server_id = _server_id
         AND sm.user_id = _user_id
         AND sm.role = 'admin'::public.server_role
         AND COALESCE(sm.is_banned, false) = false
     ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.server_id,
    e.actor_id,
    e.action,
    e.target_type,
    e.target_id,
    e.summary,
    e.metadata,
    e.created_at,
    u.username::text AS actor_username,
    u.display_name::text AS actor_display_name,
    u.avatar_url::text AS actor_avatar_url
  FROM public.server_audit_log_entries e
  LEFT JOIN public.users u ON u.id = e.actor_id
  WHERE e.server_id = _server_id
    AND (_before IS NULL OR e.created_at < _before)
  ORDER BY e.created_at DESC, e.id DESC
  LIMIT _safe_limit;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.audit_request_actor_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.insert_server_audit_log_entry(uuid, uuid, text, text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_servers_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_server_members_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_server_roles_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_role_permissions_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_server_invites_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_server_emojis_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_server_member_roles_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_server_audit_log(uuid, uuid, integer, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_server_audit_log(uuid, uuid, integer, timestamptz) TO anon, authenticated, service_role;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;

