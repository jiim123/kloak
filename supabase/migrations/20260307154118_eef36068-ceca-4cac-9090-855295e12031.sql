-- Auto-assign @everyone role to new members on server join
-- and to the owner on server creation.

-- 1. Update join_server_by_invite to assign @everyone role
CREATE OR REPLACE FUNCTION public.join_server_by_invite(
  _invite_code text,
  _user_id uuid,
  _join_source text DEFAULT 'invite_link'::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_server_id uuid;
  existing_member record;
  result json;
  clean_code text;
  system_channel_id uuid;
  enable_join boolean;
  join_message_content text;
  invite_row_id uuid;
  invite_max_uses integer;
  invite_uses_count integer;
  invite_expires_at timestamptz;
  message_id uuid;
  message_inserted boolean := false;
  insert_error text;
  inserted_member_count integer := 0;
  new_member_id uuid;
  everyone_role_id uuid;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.check_rate_limit(_user_id::text, 'join_server_by_invite_burst', 20, 60) THEN
    RAISE EXCEPTION 'Rate limited: too many join attempts';
  END IF;

  IF NOT public.check_rate_limit(_user_id::text, 'join_server_by_invite_hourly', 200, 3600) THEN
    RAISE EXCEPTION 'Rate limited: join quota reached';
  END IF;

  clean_code := upper(trim(_invite_code));

  SELECT id, system_channel_join_id, enable_join_messages
    INTO target_server_id, system_channel_id, enable_join
  FROM public.servers
  WHERE trim(invite_code::text) = clean_code;

  IF target_server_id IS NULL THEN
    SELECT si.id, si.server_id, si.max_uses, si.uses_count, si.expires_at
      INTO invite_row_id, target_server_id, invite_max_uses, invite_uses_count, invite_expires_at
    FROM public.server_invites si
    WHERE si.revoked_at IS NULL
      AND trim(si.code::text) = clean_code
    FOR UPDATE
    LIMIT 1;

    IF invite_row_id IS NOT NULL THEN
      IF invite_expires_at IS NOT NULL AND invite_expires_at <= now() THEN
        RAISE EXCEPTION 'Invalid invite code';
      END IF;
      IF invite_max_uses IS NOT NULL AND invite_uses_count >= invite_max_uses THEN
        RAISE EXCEPTION 'Invalid invite code';
      END IF;

      SELECT system_channel_join_id, enable_join_messages
        INTO system_channel_id, enable_join
      FROM public.servers
      WHERE id = target_server_id;
    END IF;
  END IF;

  IF target_server_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  SELECT * INTO existing_member
  FROM public.server_members
  WHERE server_id = target_server_id
    AND user_id = _user_id;

  IF existing_member IS NOT NULL THEN
    IF COALESCE(existing_member.is_banned, false) = true THEN
      RAISE EXCEPTION 'You are banned from this server';
    END IF;

    SELECT json_build_object(
      'id', s.id,
      'name', s.name,
      'owner_id', s.owner_id,
      'invite_code', trim(s.invite_code::text),
      'icon_url', s.icon_url,
      'banner_url', s.banner_url,
      'created_at', s.created_at,
      'already_member', true,
      'is_banned', COALESCE(existing_member.is_banned, false)
    ) INTO result
    FROM public.servers s
    WHERE s.id = target_server_id;

    RETURN result;
  END IF;

  INSERT INTO public.server_members (server_id, user_id, role, is_banned)
  VALUES (target_server_id, _user_id, 'member', false)
  ON CONFLICT (server_id, user_id) DO NOTHING
  RETURNING id INTO new_member_id;

  GET DIAGNOSTICS inserted_member_count = ROW_COUNT;

  IF inserted_member_count = 0 THEN
    SELECT * INTO existing_member
    FROM public.server_members
    WHERE server_id = target_server_id
      AND user_id = _user_id;

    IF existing_member IS NOT NULL AND COALESCE(existing_member.is_banned, false) = true THEN
      RAISE EXCEPTION 'You are banned from this server';
    END IF;

    SELECT json_build_object(
      'id', s.id,
      'name', s.name,
      'owner_id', s.owner_id,
      'invite_code', trim(s.invite_code::text),
      'icon_url', s.icon_url,
      'banner_url', s.banner_url,
      'created_at', s.created_at,
      'already_member', true,
      'is_banned', COALESCE(existing_member.is_banned, false)
    ) INTO result
    FROM public.servers s
    WHERE s.id = target_server_id;

    RETURN result;
  END IF;

  -- Auto-assign @everyone role to new member
  SELECT sr.id INTO everyone_role_id
  FROM public.server_roles sr
  WHERE sr.server_id = target_server_id AND sr.name = '@everyone';

  IF everyone_role_id IS NOT NULL AND new_member_id IS NOT NULL THEN
    INSERT INTO public.server_member_roles (member_id, role_id)
    VALUES (new_member_id, everyone_role_id)
    ON CONFLICT DO NOTHING;
  END IF;

  IF invite_row_id IS NOT NULL THEN
    UPDATE public.server_invites
    SET uses_count = uses_count + 1
    WHERE id = invite_row_id;
  END IF;

  IF system_channel_id IS NOT NULL AND enable_join THEN
    BEGIN
      join_message_content := format('<@%s> joined', _user_id);
      INSERT INTO public.messages (channel_id, user_id, content, is_system_message)
      VALUES (system_channel_id, _user_id, join_message_content, true)
      RETURNING id INTO message_id;
      message_inserted := true;
    EXCEPTION WHEN OTHERS THEN
      insert_error := SQLERRM;
      message_inserted := false;
      RAISE WARNING 'Failed to insert join message: %', SQLERRM;
    END;
  END IF;

  SELECT json_build_object(
    'id', s.id,
    'name', s.name,
    'owner_id', s.owner_id,
    'invite_code', trim(s.invite_code::text),
    'icon_url', s.icon_url,
    'banner_url', s.banner_url,
    'created_at', s.created_at,
    'already_member', false,
    'is_banned', false
  ) INTO result
  FROM public.servers s
  WHERE s.id = target_server_id;

  RETURN result;
END;
$$;

-- 2. Update create_server_with_owner to assign @everyone role to owner
CREATE OR REPLACE FUNCTION public.create_server_with_owner(_name text, _owner_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_server_id uuid;
  new_invite_code text;
  new_category_id uuid;
  new_channel_id uuid;
  everyone_role_id uuid;
  owner_member_id uuid;
  result jsonb;
  owner_created_at timestamptz;
  recent_servers_10m integer;
  recent_servers_1d integer;
  safe_name text;
BEGIN
  IF NOT public.verify_request_identity(_owner_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  safe_name := btrim(COALESCE(_name, ''));
  IF safe_name = '' THEN
    RAISE EXCEPTION 'Server name cannot be empty';
  END IF;
  IF char_length(safe_name) > 100 THEN
    RAISE EXCEPTION 'Server name is too long';
  END IF;

  SELECT u.created_at INTO owner_created_at
  FROM public.users u
  WHERE u.id = _owner_id;

  IF owner_created_at IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  SELECT count(*) INTO recent_servers_10m
  FROM public.servers s
  WHERE s.owner_id = _owner_id
    AND s.created_at > now() - interval '10 minutes';

  IF recent_servers_10m >= 3 THEN
    RAISE EXCEPTION 'Rate limited: too many servers created recently';
  END IF;

  SELECT count(*) INTO recent_servers_1d
  FROM public.servers s
  WHERE s.owner_id = _owner_id
    AND s.created_at > now() - interval '1 day';

  IF recent_servers_1d >= 10 THEN
    RAISE EXCEPTION 'Rate limited: daily server creation limit reached';
  END IF;

  new_server_id := gen_random_uuid();
  new_category_id := gen_random_uuid();
  new_channel_id := gen_random_uuid();
  everyone_role_id := gen_random_uuid();

  SELECT public.generate_invite_code() INTO new_invite_code;

  INSERT INTO public.servers (id, name, owner_id, invite_code)
  VALUES (new_server_id, safe_name, _owner_id, new_invite_code);

  INSERT INTO public.server_members (server_id, user_id, role)
  VALUES (new_server_id, _owner_id, 'owner')
  RETURNING id INTO owner_member_id;

  INSERT INTO public.channel_categories (id, server_id, name, position)
  VALUES (new_category_id, new_server_id, 'Text Channels', 0);

  INSERT INTO public.channels (id, server_id, category_id, name, type, position)
  VALUES (new_channel_id, new_server_id, new_category_id, 'general', 'text', 0);

  INSERT INTO public.server_roles (id, server_id, name, color, position, created_at)
  VALUES (everyone_role_id, new_server_id, '@everyone', '#99AAB5', 999, now());

  -- Assign @everyone role to the owner
  INSERT INTO public.server_member_roles (member_id, role_id)
  VALUES (owner_member_id, everyone_role_id);

  INSERT INTO public.role_permissions (id, server_id, role_id, permission, allowed, created_at)
  SELECT gen_random_uuid(), new_server_id, everyone_role_id, p.perm::permission_type, true, now()
  FROM (
    VALUES
      ('send_messages'), ('add_reactions'), ('view_channels'), ('read_message_history'),
      ('attach_files'), ('embed_links'), ('use_external_emojis'), ('change_nickname'),
      ('create_instant_invite'), ('connect'), ('speak'), ('use_voice_activation'),
      ('use_application_commands'), ('mention_roles')
  ) AS p(perm);

  SELECT jsonb_build_object(
    'id', s.id,
    'name', s.name,
    'owner_id', s.owner_id,
    'invite_code', s.invite_code,
    'icon_url', s.icon_url,
    'banner_url', s.banner_url,
    'is_published', s.is_published,
    'about', s.about,
    'created_at', s.created_at
  ) INTO result
  FROM public.servers s
  WHERE s.id = new_server_id;

  RETURN result;
END;
$$;

-- 3. Backfill: assign @everyone role to all existing members who don't have it
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT sm.id AS member_id, sr.id AS role_id
    FROM server_members sm
    JOIN server_roles sr ON sr.server_id = sm.server_id AND sr.name = '@everyone'
    WHERE NOT EXISTS (
      SELECT 1 FROM server_member_roles smr
      WHERE smr.member_id = sm.id AND smr.role_id = sr.id
    )
    AND COALESCE(sm.is_banned, false) = false
  LOOP
    INSERT INTO server_member_roles (member_id, role_id)
    VALUES (r.member_id, r.role_id)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;