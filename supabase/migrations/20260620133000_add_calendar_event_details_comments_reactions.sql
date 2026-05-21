CREATE TABLE IF NOT EXISTS public.calendar_event_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  edited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calendar_event_comments_content_length CHECK (char_length(trim(content)) BETWEEN 1 AND 2000)
);

CREATE INDEX IF NOT EXISTS idx_calendar_event_comments_event_created_at
  ON public.calendar_event_comments(event_id, created_at);

CREATE TABLE IF NOT EXISTS public.calendar_event_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_calendar_event_reactions_event_id
  ON public.calendar_event_reactions(event_id);

ALTER TABLE public.calendar_event_comments REPLICA IDENTITY FULL;
ALTER TABLE public.calendar_event_reactions REPLICA IDENTITY FULL;

ALTER TABLE public.calendar_event_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_event_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Calendar event comments viewable by channel members" ON public.calendar_event_comments;
CREATE POLICY "Calendar event comments viewable by channel members"
  ON public.calendar_event_comments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.calendar_events ce
      WHERE ce.id = calendar_event_comments.event_id
        AND public.can_access_channel(ce.channel_id, (SELECT public.requesting_user_id()))
    )
  );

DROP POLICY IF EXISTS "Calendar event reactions viewable by channel members" ON public.calendar_event_reactions;
CREATE POLICY "Calendar event reactions viewable by channel members"
  ON public.calendar_event_reactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.calendar_events ce
      WHERE ce.id = calendar_event_reactions.event_id
        AND public.can_access_channel(ce.channel_id, (SELECT public.requesting_user_id()))
    )
  );

DROP POLICY IF EXISTS "Users manage own calendar event reactions" ON public.calendar_event_reactions;
CREATE POLICY "Users manage own calendar event reactions"
  ON public.calendar_event_reactions
  USING ((SELECT public.requesting_user_id()) = user_id)
  WITH CHECK ((SELECT public.requesting_user_id()) = user_id);

CREATE OR REPLACE FUNCTION public.get_calendar_event_details(_event_id uuid, _user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN (
    SELECT row_to_json(t)
    FROM (
      SELECT
        ce.*,
        COALESCE(rsvp_counts.going_count, 0) AS going_count,
        viewer.status AS viewer_rsvp_status,
        json_build_object(
          'id', creator.id,
          'username', creator.username,
          'display_name', creator.display_name,
          'avatar_url', creator.avatar_url,
          'banner_color', creator.banner_color
        ) AS creator,
        COALESCE(attendees.users, '[]'::json) AS attendees,
        COALESCE(comment_counts.comment_count, 0) AS comment_count
      FROM public.calendar_events ce
      JOIN public.users creator ON creator.id = ce.created_by
      LEFT JOIN LATERAL (
        SELECT count(*)::integer AS going_count
        FROM public.calendar_event_rsvps cer
        WHERE cer.event_id = ce.id
      ) rsvp_counts ON true
      LEFT JOIN public.calendar_event_rsvps viewer
        ON viewer.event_id = ce.id
       AND viewer.user_id = _user_id
      LEFT JOIN LATERAL (
        SELECT json_agg(
          json_build_object(
            'id', u.id,
            'username', u.username,
            'display_name', u.display_name,
            'avatar_url', u.avatar_url,
            'banner_color', u.banner_color
          )
          ORDER BY cer.created_at ASC
        ) AS users
        FROM public.calendar_event_rsvps cer
        JOIN public.users u ON u.id = cer.user_id
        WHERE cer.event_id = ce.id
      ) attendees ON true
      LEFT JOIN LATERAL (
        SELECT count(*)::integer AS comment_count
        FROM public.calendar_event_comments cec
        WHERE cec.event_id = ce.id
      ) comment_counts ON true
      WHERE ce.id = _event_id
        AND public.can_access_channel(ce.channel_id, _user_id)
    ) t
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.insert_calendar_event_comment(_event_id uuid, _user_id uuid, _content text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _event public.calendar_events%ROWTYPE;
  _comment public.calendar_event_comments%ROWTYPE;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT * INTO _event
  FROM public.calendar_events
  WHERE id = _event_id;

  IF _event.id IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF NOT public.check_user_permission(_user_id, _event.channel_id, 'send_messages'::public.permission_type) THEN
    RAISE EXCEPTION 'Permission denied: you do not have permission to comment';
  END IF;

  INSERT INTO public.calendar_event_comments (event_id, user_id, content)
  VALUES (_event_id, _user_id, trim(_content))
  RETURNING * INTO _comment;

  RETURN row_to_json(_comment);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_calendar_event_comment(_comment_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _owner_id uuid;
  _channel_id uuid;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT cec.user_id, ce.channel_id INTO _owner_id, _channel_id
  FROM public.calendar_event_comments cec
  JOIN public.calendar_events ce ON ce.id = cec.event_id
  WHERE cec.id = _comment_id;

  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;

  IF _owner_id <> _user_id AND NOT public.check_user_permission(_user_id, _channel_id, 'manage_messages'::public.permission_type) THEN
    RAISE EXCEPTION 'Permission denied: you can only delete your own comments';
  END IF;

  DELETE FROM public.calendar_event_comments WHERE id = _comment_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_calendar_event_reaction(_event_id uuid, _user_id uuid, _emoji text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _event public.calendar_events%ROWTYPE;
  _existing_id uuid;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT * INTO _event
  FROM public.calendar_events
  WHERE id = _event_id;

  IF _event.id IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF NOT public.check_user_permission(_user_id, _event.channel_id, 'add_reactions'::public.permission_type) THEN
    RAISE EXCEPTION 'Permission denied: you do not have permission to add reactions';
  END IF;

  SELECT id INTO _existing_id
  FROM public.calendar_event_reactions
  WHERE event_id = _event_id
    AND user_id = _user_id
    AND emoji = _emoji;

  IF _existing_id IS NOT NULL THEN
    DELETE FROM public.calendar_event_reactions WHERE id = _existing_id;
  ELSE
    INSERT INTO public.calendar_event_reactions (event_id, user_id, emoji)
    VALUES (_event_id, _user_id, _emoji);
  END IF;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_calendar_event_details(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.insert_calendar_event_comment(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_calendar_event_comment(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.toggle_calendar_event_reaction(uuid, uuid, text) FROM PUBLIC;

GRANT SELECT ON TABLE public.calendar_event_comments TO anon, authenticated;
GRANT SELECT ON TABLE public.calendar_event_reactions TO anon, authenticated;
GRANT SELECT ON TABLE public.calendar_events TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_calendar_event_details(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.insert_calendar_event_comment(uuid, uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_calendar_event_comment(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.toggle_calendar_event_reaction(uuid, uuid, text) TO anon, authenticated, service_role;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_event_comments;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_event_reactions;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;

END
$$;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END
$$;
