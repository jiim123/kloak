-- Let server action bots create list items in task/list channels and prevent
-- bot-authored item changes from feeding back into item triggers.

CREATE OR REPLACE FUNCTION public.check_server_bot_channel_permission(
  _bot_user_id uuid,
  _channel_id uuid,
  _permission public.permission_type
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  channel_server_id uuid;
  user_base_role public.server_role;
  user_custom_role_ids uuid[];
  everyone_role_id uuid;
  user_override_result boolean;
  channel_result boolean;
  role_result boolean;
BEGIN
  IF _bot_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = _bot_user_id AND u.is_bot = true
  ) THEN
    RETURN false;
  END IF;

  SELECT server_id INTO channel_server_id
  FROM public.channels
  WHERE id = _channel_id;

  IF channel_server_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT sm.role INTO user_base_role
  FROM public.server_members sm
  WHERE sm.server_id = channel_server_id
    AND sm.user_id = _bot_user_id
    AND COALESCE(sm.is_banned, false) = false
    AND COALESCE(sm.is_muted, false) = false;

  IF user_base_role IS NULL THEN
    RETURN false;
  END IF;

  IF user_base_role = 'owner' THEN
    RETURN true;
  END IF;

  SELECT COALESCE(ARRAY_AGG(DISTINCT smr.role_id) FILTER (WHERE smr.role_id IS NOT NULL), ARRAY[]::uuid[])
  INTO user_custom_role_ids
  FROM public.server_member_roles smr
  JOIN public.server_members sm ON sm.id = smr.member_id
  WHERE sm.user_id = _bot_user_id
    AND sm.server_id = channel_server_id;

  SELECT id INTO everyone_role_id
  FROM public.server_roles
  WHERE server_id = channel_server_id
    AND name = '@everyone';

  SELECT cp.allowed INTO user_override_result
  FROM public.channel_permissions cp
  WHERE cp.channel_id = _channel_id
    AND cp.permission = _permission
    AND cp.user_id = _bot_user_id
    AND cp.role_id IS NULL
    AND cp.role_name IS NULL
  LIMIT 1;

  IF user_override_result IS NOT NULL THEN
    RETURN user_override_result;
  END IF;

  IF array_length(user_custom_role_ids, 1) > 0 THEN
    SELECT CASE
      WHEN bool_or(cp.allowed = false) THEN false
      WHEN bool_or(cp.allowed = true) THEN true
      ELSE NULL
    END INTO channel_result
    FROM public.channel_permissions cp
    WHERE cp.channel_id = _channel_id
      AND cp.permission = _permission
      AND cp.user_id IS NULL
      AND cp.role_id = ANY(user_custom_role_ids);

    IF channel_result IS NOT NULL THEN
      RETURN channel_result;
    END IF;
  END IF;

  IF everyone_role_id IS NOT NULL THEN
    SELECT cp.allowed INTO channel_result
    FROM public.channel_permissions cp
    WHERE cp.channel_id = _channel_id
      AND cp.permission = _permission
      AND cp.user_id IS NULL
      AND cp.role_id = everyone_role_id
    LIMIT 1;

    IF channel_result IS NOT NULL THEN
      RETURN channel_result;
    END IF;
  END IF;

  SELECT cp.allowed INTO channel_result
  FROM public.channel_permissions cp
  WHERE cp.channel_id = _channel_id
    AND cp.permission = _permission
    AND cp.user_id IS NULL
    AND cp.role_name = user_base_role
    AND cp.role_id IS NULL
  LIMIT 1;

  IF channel_result IS NOT NULL THEN
    RETURN channel_result;
  END IF;

  IF array_length(user_custom_role_ids, 1) > 0 THEN
    SELECT CASE
      WHEN bool_or(rp.allowed = false) THEN false
      WHEN bool_or(rp.allowed = true) THEN true
      ELSE NULL
    END INTO role_result
    FROM public.role_permissions rp
    WHERE rp.server_id = channel_server_id
      AND rp.permission = _permission
      AND rp.role_id = ANY(user_custom_role_ids);

    IF role_result IS NOT NULL THEN
      RETURN role_result;
    END IF;
  END IF;

  IF everyone_role_id IS NOT NULL THEN
    SELECT rp.allowed INTO role_result
    FROM public.role_permissions rp
    WHERE rp.server_id = channel_server_id
      AND rp.permission = _permission
      AND rp.role_id = everyone_role_id
    LIMIT 1;

    IF role_result IS NOT NULL THEN
      RETURN role_result;
    END IF;
  END IF;

  SELECT rp.allowed INTO role_result
  FROM public.role_permissions rp
  WHERE rp.server_id = channel_server_id
    AND rp.permission = _permission
    AND rp.role_name = user_base_role
    AND rp.role_id IS NULL
  LIMIT 1;

  IF role_result IS NOT NULL THEN
    RETURN role_result;
  END IF;

  CASE _permission
    WHEN 'view_channels' THEN RETURN true;
    WHEN 'read_message_history' THEN RETURN true;
    WHEN 'send_messages' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'attach_files' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'embed_links' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'add_reactions' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'use_external_emojis' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'mention_everyone' THEN RETURN user_base_role IN ('owner', 'admin');
    WHEN 'mention_roles' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'manage_messages' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'pin_messages' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'manage_channels' THEN RETURN user_base_role IN ('owner', 'admin');
    WHEN 'manage_threads' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'kick_members' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'ban_members' THEN RETURN user_base_role IN ('owner', 'admin');
    WHEN 'mute_members' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'deafen_members' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'move_members' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'manage_nicknames' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'change_nickname' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'manage_roles' THEN RETURN user_base_role IN ('owner', 'admin');
    WHEN 'manage_server' THEN RETURN user_base_role = 'owner';
    WHEN 'manage_invites' THEN RETURN user_base_role IN ('owner', 'admin');
    WHEN 'create_instant_invite' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'manage_webhooks' THEN RETURN user_base_role IN ('owner', 'admin');
    WHEN 'transfer_ownership' THEN RETURN user_base_role = 'owner';
    WHEN 'manage_emojis' THEN RETURN user_base_role IN ('owner', 'admin');
    WHEN 'connect' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'speak' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'use_voice_activation' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'use_application_commands' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'view_tasks' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'create_tasks' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'edit_own_tasks' THEN RETURN false;
    WHEN 'edit_all_tasks' THEN RETURN false;
    WHEN 'assign_tasks' THEN RETURN false;
    WHEN 'change_task_status' THEN RETURN false;
    WHEN 'delete_tasks' THEN RETURN false;
    ELSE RETURN false;
  END CASE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_server_bot_message_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  row_record record;
  event_type text;
  source_message public.messages%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    source_message := OLD;
  ELSE
    source_message := NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.users u WHERE u.id = source_message.user_id AND u.is_bot = true) THEN
    RETURN source_message;
  END IF;

  SELECT c.server_id, c.type
  INTO row_record
  FROM public.channels c
  WHERE c.id = source_message.channel_id;

  IF row_record.type = 'announcement'::public.channel_type THEN
    event_type := CASE WHEN TG_OP = 'UPDATE' THEN 'announcement_updated' ELSE 'announcement_deleted' END;
  ELSIF EXISTS (SELECT 1 FROM public.threads t WHERE t.message_id = source_message.id) THEN
    event_type := CASE WHEN TG_OP = 'UPDATE' THEN 'forum_topic_updated' ELSE 'forum_topic_deleted' END;
  ELSE
    RETURN source_message;
  END IF;

  PERFORM public.enqueue_server_bot_event(
    row_record.server_id,
    event_type,
    event_type || ':' || source_message.id::text || ':' || txid_current()::text,
    public.server_bot_event_channel_payload(source_message.channel_id)
      || public.server_bot_event_user_payload(source_message.user_id)
      || jsonb_build_object('message_id', source_message.id, 'item_id', source_message.id, 'item_title', left(source_message.content, 120), 'content', source_message.content)
  );

  RETURN source_message;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_server_bot_calendar_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  item public.calendar_events%ROWTYPE;
  event_type text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    item := OLD;
  ELSE
    item := NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.users u WHERE u.id = item.created_by AND u.is_bot = true) THEN
    RETURN item;
  END IF;

  event_type := CASE TG_OP
    WHEN 'INSERT' THEN 'calendar_event_created'
    WHEN 'UPDATE' THEN 'calendar_event_updated'
    ELSE 'calendar_event_deleted'
  END;

  PERFORM public.enqueue_server_bot_event(
    item.server_id,
    event_type,
    event_type || ':' || item.id::text || ':' || txid_current()::text,
    public.server_bot_event_channel_payload(item.channel_id)
      || public.server_bot_event_user_payload(item.created_by)
      || jsonb_build_object('item_id', item.id, 'item_title', item.title)
  );

  RETURN item;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_server_bot_forum_topic_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  item public.threads%ROWTYPE;
  message_record public.messages%ROWTYPE;
  channel_record record;
  event_type text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    item := OLD;
    event_type := 'forum_topic_deleted';
  ELSE
    item := NEW;
    event_type := 'forum_topic_created';
  END IF;

  IF EXISTS (SELECT 1 FROM public.users u WHERE u.id = item.created_by AND u.is_bot = true) THEN
    RETURN item;
  END IF;

  SELECT * INTO message_record
  FROM public.messages
  WHERE id = item.message_id;

  SELECT c.server_id, c.type
  INTO channel_record
  FROM public.channels c
  WHERE c.id = item.channel_id;

  IF channel_record.type != 'forum'::public.channel_type THEN
    RETURN item;
  END IF;

  PERFORM public.enqueue_server_bot_event(
    channel_record.server_id,
    event_type,
    event_type || ':' || item.id::text || ':' || txid_current()::text,
    public.server_bot_event_channel_payload(item.channel_id)
      || public.server_bot_event_user_payload(item.created_by)
      || jsonb_build_object('thread_id', item.id, 'message_id', item.message_id, 'item_id', item.id, 'item_title', left(COALESCE(message_record.content, 'Forum topic'), 120), 'content', message_record.content)
  );

  RETURN item;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_server_bot_task_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  item public.tasks%ROWTYPE;
  event_type text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    item := OLD;
  ELSE
    item := NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.users u WHERE u.id = item.created_by AND u.is_bot = true) THEN
    RETURN item;
  END IF;

  event_type := CASE TG_OP
    WHEN 'INSERT' THEN 'list_item_created'
    WHEN 'UPDATE' THEN 'list_item_updated'
    ELSE 'list_item_deleted'
  END;

  PERFORM public.enqueue_server_bot_event(
    item.server_id,
    event_type,
    event_type || ':' || item.id::text || ':' || txid_current()::text,
    public.server_bot_event_channel_payload(item.channel_id)
      || public.server_bot_event_user_payload(item.created_by)
      || jsonb_build_object('item_id', item.id, 'item_title', item.title, 'content', item.description)
  );

  RETURN item;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_server_bot_media_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  item public.media_items%ROWTYPE;
  event_type text;
  channel_record record;
BEGIN
  IF TG_OP = 'DELETE' THEN
    item := OLD;
  ELSE
    item := NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.users u WHERE u.id = item.user_id AND u.is_bot = true) THEN
    RETURN item;
  END IF;

  event_type := CASE TG_OP
    WHEN 'INSERT' THEN 'media_created'
    WHEN 'UPDATE' THEN 'media_updated'
    ELSE 'media_deleted'
  END;

  SELECT c.server_id
  INTO channel_record
  FROM public.channels c
  WHERE c.id = item.channel_id;

  PERFORM public.enqueue_server_bot_event(
    channel_record.server_id,
    event_type,
    event_type || ':' || item.id::text || ':' || txid_current()::text,
    public.server_bot_event_channel_payload(item.channel_id)
      || public.server_bot_event_user_payload(item.user_id)
      || jsonb_build_object('item_id', item.id, 'item_title', COALESCE(item.title, item.media_type, 'Media'), 'content', item.description, 'media_type', item.media_type)
  );

  RETURN item;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.check_server_bot_channel_permission(uuid, uuid, public.permission_type) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_server_bot_message_changed() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_server_bot_calendar_event() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_server_bot_forum_topic_changed() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_server_bot_task_item() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_server_bot_media_item() FROM PUBLIC;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END
$$;
