-- Attach a dedicated text chat channel to each voice channel.
-- Requirements:
-- 1) New voice channels automatically create an attached text channel.
-- 2) Deleting a voice channel deletes its attached text channel (and cascaded messages/attachments).
-- 3) Existing voice channels are backfilled with an attached text channel.

ALTER TABLE public.channels
  ADD COLUMN IF NOT EXISTS linked_voice_channel_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'channels_linked_voice_channel_id_fkey'
      AND conrelid = 'public.channels'::regclass
  ) THEN
    ALTER TABLE public.channels
      ADD CONSTRAINT channels_linked_voice_channel_id_fkey
      FOREIGN KEY (linked_voice_channel_id)
      REFERENCES public.channels(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_channels_linked_voice_channel_unique
  ON public.channels(linked_voice_channel_id)
  WHERE linked_voice_channel_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'channels_linked_voice_channel_text_only_chk'
      AND conrelid = 'public.channels'::regclass
  ) THEN
    ALTER TABLE public.channels
      ADD CONSTRAINT channels_linked_voice_channel_text_only_chk
      CHECK (
        linked_voice_channel_id IS NULL
        OR (type = 'text'::public.channel_type AND linked_voice_channel_id <> id)
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.create_channel(
  _server_id uuid,
  _name text,
  _type text DEFAULT 'text',
  _user_id uuid DEFAULT NULL,
  _category_id uuid DEFAULT NULL,
  _position integer DEFAULT NULL,
  _icon text DEFAULT NULL,
  _is_private boolean DEFAULT false,
  _ghost_mode boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  new_channel public.channels%ROWTYPE;
  linked_text_channel public.channels%ROWTYPE;
  final_position integer;
  linked_position integer;
  linked_text_name text;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: user_id required';
  END IF;

  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_channels') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF _position IS NULL THEN
    SELECT COALESCE(MAX(position), -1) + 1
      INTO final_position
    FROM public.channels
    WHERE server_id = _server_id
      AND ((_category_id IS NULL AND category_id IS NULL) OR category_id = _category_id);
  ELSE
    final_position := _position;
  END IF;

  INSERT INTO public.channels (
    server_id,
    name,
    type,
    category_id,
    position,
    icon,
    is_private,
    ghost_mode,
    is_read_only
  )
  VALUES (
    _server_id,
    _name,
    _type::public.channel_type,
    _category_id,
    final_position,
    _icon,
    _is_private,
    _ghost_mode,
    false
  )
  RETURNING * INTO new_channel;

  IF _is_private THEN
    INSERT INTO public.channel_members (channel_id, user_id, added_by)
    VALUES (new_channel.id, _user_id, _user_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Voice channels get an attached text chat by default.
  IF _type::public.channel_type = 'voice'::public.channel_type THEN
    linked_text_name := CONCAT(_name, '-chat');

    SELECT COALESCE(MAX(position), -1) + 1
      INTO linked_position
    FROM public.channels
    WHERE server_id = _server_id
      AND ((_category_id IS NULL AND category_id IS NULL) OR category_id = _category_id);

    INSERT INTO public.channels (
      server_id,
      name,
      type,
      category_id,
      position,
      is_private,
      ghost_mode,
      is_read_only,
      linked_voice_channel_id
    )
    VALUES (
      _server_id,
      linked_text_name,
      'text'::public.channel_type,
      _category_id,
      linked_position,
      _is_private,
      _ghost_mode,
      false,
      new_channel.id
    )
    RETURNING * INTO linked_text_channel;

    IF _is_private THEN
      INSERT INTO public.channel_members (channel_id, user_id, added_by)
      VALUES (linked_text_channel.id, _user_id, _user_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN row_to_json(new_channel);
END;
$function$;

-- Include linkage in channel payloads consumed by the client.
CREATE OR REPLACE FUNCTION public.get_server_channels(_server_id uuid, _user_id uuid DEFAULT NULL::uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _is_admin boolean := false;
  _is_member boolean := false;
  _caller uuid;
BEGIN
  _caller := public.requesting_user_id();

  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF _user_id IS NOT NULL AND _user_id <> _caller THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.server_members sm
    WHERE sm.server_id = _server_id
      AND sm.user_id = _caller
      AND COALESCE(sm.is_banned, false) = false
  )
  INTO _is_member;

  IF NOT _is_member THEN
    RETURN '[]'::json;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.server_members sm
    WHERE sm.server_id = _server_id
      AND sm.user_id = _caller
      AND sm.role IN ('owner', 'admin')
      AND COALESCE(sm.is_banned, false) = false
  )
  INTO _is_admin;

  RETURN (
    SELECT COALESCE(
      json_agg(
        json_build_object(
          'id', c.id,
          'server_id', c.server_id,
          'category_id', c.category_id,
          'linked_voice_channel_id', c.linked_voice_channel_id,
          'name', c.name,
          'topic', c.topic,
          'type', c.type,
          'position', c.position,
          'is_nsfw', c.is_nsfw,
          'slowmode_seconds', c.slowmode_seconds,
          'is_read_only', c.is_read_only,
          'icon', c.icon,
          'is_private', c.is_private,
          'block_links', c.block_links,
          'allowed_link_domains', c.allowed_link_domains,
          'ghost_mode', c.ghost_mode,
          'created_at', c.created_at
        )
        ORDER BY c.position
      ),
      '[]'::json
    )
    FROM public.channels c
    WHERE c.server_id = _server_id
      AND (
        NOT c.is_private
        OR _is_admin
        OR EXISTS (
          SELECT 1
          FROM public.channel_members cm
          WHERE cm.channel_id = c.id
            AND cm.user_id = _caller
        )
      )
  );
END;
$function$;

-- Backfill existing voice channels that do not have attached text channels yet.
WITH inserted AS (
  INSERT INTO public.channels (
    server_id,
    category_id,
    name,
    type,
    position,
    is_private,
    ghost_mode,
    is_read_only,
    linked_voice_channel_id
  )
  SELECT
    v.server_id,
    v.category_id,
    CONCAT(v.name, '-chat'),
    'text'::public.channel_type,
    COALESCE((
      SELECT MAX(c2.position) + 1
      FROM public.channels c2
      WHERE c2.server_id = v.server_id
        AND c2.category_id IS NOT DISTINCT FROM v.category_id
    ), 0),
    v.is_private,
    v.ghost_mode,
    false,
    v.id
  FROM public.channels v
  WHERE v.type = 'voice'::public.channel_type
    AND NOT EXISTS (
      SELECT 1
      FROM public.channels t
      WHERE t.linked_voice_channel_id = v.id
    )
  RETURNING id, linked_voice_channel_id
)
INSERT INTO public.channel_members (channel_id, user_id, added_by)
SELECT
  inserted.id,
  cm.user_id,
  COALESCE(cm.added_by, cm.user_id)
FROM inserted
JOIN public.channel_members cm
  ON cm.channel_id = inserted.linked_voice_channel_id
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
