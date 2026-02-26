CREATE OR REPLACE FUNCTION public.create_server_with_owner(_name text, _owner_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  new_server_id uuid;
  new_invite_code text;
  new_category_id uuid;
  new_channel_id uuid;
  everyone_role_id uuid;
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
  VALUES (new_server_id, _owner_id, 'owner');

  INSERT INTO public.channel_categories (id, server_id, name, position)
  VALUES (new_category_id, new_server_id, 'Text Channels', 0);

  INSERT INTO public.channels (id, server_id, category_id, name, type, position)
  VALUES (new_channel_id, new_server_id, new_category_id, 'general', 'text', 0);

  INSERT INTO public.server_roles (id, server_id, name, color, position, created_at)
  VALUES (everyone_role_id, new_server_id, '@everyone', '#99AAB5', 999, now());

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
$function$;
