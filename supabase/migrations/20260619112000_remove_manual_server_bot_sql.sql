-- Remove manually-applied server bot database objects.
-- This intentionally leaves the older users.is_bot display field in place because
-- existing chat/profile/member read surfaces still expose it for labeling.

DROP TRIGGER IF EXISTS trg_server_bot_member_joined ON public.server_members;
DROP TRIGGER IF EXISTS trg_server_bot_message_created ON public.messages;

DO $$
BEGIN
  IF to_regclass('public.server_bots') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_touch_server_bots_updated_at ON public.server_bots';
  END IF;

  IF to_regclass('public.server_bot_flows') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_touch_server_bot_flows_updated_at ON public.server_bot_flows';
  END IF;
END
$$;

DROP FUNCTION IF EXISTS public.get_server_bots(uuid, uuid);
DROP FUNCTION IF EXISTS public.create_server_bot(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.update_server_bot(uuid, uuid, text, boolean);
DROP FUNCTION IF EXISTS public.delete_server_bot(uuid, uuid);
DROP FUNCTION IF EXISTS public.upsert_server_bot_flow(uuid, uuid, uuid, text, jsonb, text, jsonb, boolean, integer);
DROP FUNCTION IF EXISTS public.delete_server_bot_flow(uuid, uuid);
DROP FUNCTION IF EXISTS public.run_server_bot_flows(uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.touch_server_bot_updated_at();
DROP FUNCTION IF EXISTS public.ensure_server_bot_membership(uuid);
DROP FUNCTION IF EXISTS public.render_bot_template(text, jsonb);
DROP FUNCTION IF EXISTS public.handle_server_bot_member_joined();
DROP FUNCTION IF EXISTS public.handle_server_bot_message_created();
DROP FUNCTION IF EXISTS public.is_bot_user(uuid);

DROP TABLE IF EXISTS public.server_bot_flows;
DROP TABLE IF EXISTS public.server_bots;

-- Restore shared anti-spam helpers to the non-bot behavior.
CREATE OR REPLACE FUNCTION public.check_message_rate_limit(_user_id uuid, _channel_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c1 int;
  c2 int;
BEGIN
  SELECT count(*) INTO c1
  FROM public.messages
  WHERE user_id = _user_id
    AND channel_id = _channel_id
    AND created_at > now() - interval '1 minute';

  IF c1 >= 15 THEN
    RETURN false;
  END IF;

  SELECT count(*) INTO c2
  FROM public.messages
  WHERE user_id = _user_id
    AND channel_id = _channel_id
    AND created_at > now() - interval '5 seconds';

  RETURN c2 < 5;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_no_duplicate_message(_user_id uuid, _channel_id uuid, _content text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.messages
    WHERE user_id = _user_id
      AND channel_id = _channel_id
      AND content = _content
      AND created_at > now() - interval '5 minutes'
  );
$$;

CREATE OR REPLACE FUNCTION public.check_new_account_no_links(_user_id uuid, _content text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  age interval;
BEGIN
  IF NOT (_content ~* '(https?://|www\.)') THEN
    RETURN true;
  END IF;

  SELECT now() - created_at INTO age
  FROM public.users
  WHERE id = _user_id;

  RETURN age IS NOT NULL AND age >= interval '30 minutes';
END;
$$;

-- Restore ban/kick cleanup so member removal purges messages normally.
CREATE OR REPLACE FUNCTION public.purge_banned_user_messages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _server_id uuid;
  _user_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.is_banned = true AND OLD.is_banned = false THEN
      _server_id := NEW.server_id;
      _user_id := NEW.user_id;
    ELSE
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    _server_id := OLD.server_id;
    _user_id := OLD.user_id;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  DELETE FROM public.messages
  WHERE user_id = _user_id
    AND channel_id IN (
      SELECT id FROM public.channels WHERE server_id = _server_id
    );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Restore online-only member fetch without hard-wiring bot users online.
CREATE OR REPLACE FUNCTION public.get_server_members(_server_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _caller uuid;
  _online_cutoff timestamptz;
  _can_manage_invites boolean := false;
BEGIN
  _caller := public.requesting_user_id();
  _online_cutoff := now() - interval '5 minutes';

  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT public.is_server_member(_server_id, _caller) THEN
    RETURN '[]'::json;
  END IF;

  _can_manage_invites := public.check_user_server_permission(_caller, _server_id, 'manage_invites');

  RETURN COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', sm.id,
          'server_id', sm.server_id,
          'user_id', sm.user_id,
          'role', sm.role,
          'nickname', sm.nickname,
          'is_banned', sm.is_banned,
          'is_muted', sm.is_muted,
          'joined_at', sm.joined_at,
          'join_source', sm.join_source,
          'join_invite_code', CASE WHEN _can_manage_invites THEN sm.join_invite_code ELSE NULL END,
          'user', json_build_object(
            'id', u.id,
            'username', u.username,
            'display_name', u.display_name,
            'avatar_url', u.avatar_url,
            'banner_url', u.banner_url,
            'avatar_decoration', u.avatar_decoration,
            'profile_effect', u.profile_effect,
            'banner_color', u.banner_color,
            'profile_theme_primary', u.profile_theme_primary,
            'profile_theme_accent', u.profile_theme_accent,
            'bio', u.bio,
            'status', u.status,
            'custom_status', u.custom_status,
            'created_at', u.created_at,
            'last_seen', u.last_seen,
            'is_bot', u.is_bot
          ),
          'roles', COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', sr.id,
                  'name', sr.name,
                  'color', sr.color,
                  'icon', sr.icon,
                  'position', sr.position
                )
                ORDER BY sr.position ASC
              )
              FROM public.server_member_roles smr
              JOIN public.server_roles sr ON sr.id = smr.role_id
              WHERE smr.member_id = sm.id
            ),
            '[]'::json
          )
        )
      )
      FROM public.server_members sm
      JOIN public.users u ON u.id = sm.user_id
      WHERE sm.server_id = _server_id
        AND COALESCE(sm.is_banned, false) = false
        AND (
          sm.user_id = _caller
          OR (
            (u.last_seen IS NOT NULL AND u.last_seen >= _online_cutoff)
            OR (u.last_seen IS NULL AND COALESCE(u.status::text, 'offline') <> 'offline')
          )
        )
    ),
    '[]'::json
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_server_members_full_secure(
  _server_id uuid,
  _user_id uuid
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _can_manage_invites boolean := false;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.is_server_member(_server_id, _user_id) THEN
    RETURN '[]'::json;
  END IF;

  _can_manage_invites := public.check_user_server_permission(_user_id, _server_id, 'manage_invites');

  RETURN COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', sm.id,
          'server_id', sm.server_id,
          'user_id', sm.user_id,
          'role', sm.role,
          'nickname', sm.nickname,
          'is_banned', sm.is_banned,
          'is_muted', sm.is_muted,
          'joined_at', sm.joined_at,
          'join_source', sm.join_source,
          'join_invite_code', CASE WHEN _can_manage_invites THEN sm.join_invite_code ELSE NULL END,
          'user', json_build_object(
            'id', u.id,
            'username', u.username,
            'display_name', u.display_name,
            'avatar_url', u.avatar_url,
            'banner_url', u.banner_url,
            'avatar_decoration', u.avatar_decoration,
            'profile_effect', u.profile_effect,
            'banner_color', u.banner_color,
            'profile_theme_primary', u.profile_theme_primary,
            'profile_theme_accent', u.profile_theme_accent,
            'bio', u.bio,
            'status', u.status,
            'custom_status', u.custom_status,
            'created_at', u.created_at,
            'last_seen', u.last_seen,
            'is_bot', u.is_bot
          ),
          'roles', COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', sr.id,
                  'name', sr.name,
                  'color', sr.color,
                  'position', sr.position
                )
                ORDER BY sr.position ASC
              )
              FROM public.server_member_roles smr
              JOIN public.server_roles sr ON sr.id = smr.role_id
              WHERE smr.member_id = sm.id
            ),
            '[]'::json
          )
        )
      )
      FROM public.server_members sm
      JOIN public.users u ON u.id = sm.user_id
      WHERE sm.server_id = _server_id
    ),
    '[]'::json
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_message_rate_limit(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_no_duplicate_message(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_new_account_no_links(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purge_banned_user_messages() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_server_members(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_server_members_full_secure(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_server_members(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_server_members_full_secure(uuid, uuid) TO anon, authenticated;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
