-- Broadcast full calendar rows so live calendar changes can be applied without refetching.

CREATE OR REPLACE FUNCTION public.calendar_event_broadcast_row(_event_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT to_jsonb(t)
  FROM (
    SELECT
      ce.*,
      COALESCE(rsvp_counts.going_count, 0) AS rsvp_count,
      NULL::text AS viewer_rsvp_status
    FROM public.calendar_events ce
    LEFT JOIN LATERAL (
      SELECT count(*)::integer AS going_count
      FROM public.calendar_event_rsvps cer
      WHERE cer.event_id = ce.id
        AND cer.status = 'going'
    ) rsvp_counts ON true
    WHERE ce.id = _event_id
  ) t;
$$;

CREATE OR REPLACE FUNCTION public.calendar_event_rsvp_counts(_event_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'going_count', count(*) FILTER (WHERE status = 'going'),
    'maybe_count', count(*) FILTER (WHERE status = 'maybe'),
    'declined_count', count(*) FILTER (WHERE status = 'declined'),
    'rsvp_count', count(*) FILTER (WHERE status = 'going')
  )
  FROM public.calendar_event_rsvps
  WHERE event_id = _event_id;
$$;

CREATE OR REPLACE FUNCTION public.calendar_event_comment_broadcast_row(_comment public.calendar_event_comments)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', _comment.id,
    'event_id', _comment.event_id,
    'user_id', _comment.user_id,
    'content', _comment.content,
    'edited_at', _comment.edited_at,
    'created_at', _comment.created_at,
    'user', to_jsonb(u)
  )
  FROM public.users u
  WHERE u.id = _comment.user_id;
$$;

CREATE OR REPLACE FUNCTION public.broadcast_calendar_event_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _event_id uuid;
  _channel_id uuid;
BEGIN
  _event_id := COALESCE(NEW.id, OLD.id);
  _channel_id := COALESCE(NEW.channel_id, OLD.channel_id);

  IF _event_id IS NULL OR _channel_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  PERFORM realtime.send(
    jsonb_build_object(
      'op', TG_OP,
      'event_id', _event_id,
      'event', CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE public.calendar_event_broadcast_row(_event_id) END,
      CASE WHEN TG_OP = 'DELETE' THEN 'old' ELSE 'new' END,
      CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE public.calendar_event_broadcast_row(_event_id) END
    ),
    'calendar_events',
    'calendar-events:' || _channel_id::text,
    false
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.broadcast_calendar_event_detail_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _event_id uuid;
  _channel_id uuid;
  _new jsonb;
  _old jsonb;
  _payload jsonb;
BEGIN
  _event_id := COALESCE(NEW.event_id, OLD.event_id);

  IF _event_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT ce.channel_id INTO _channel_id
  FROM public.calendar_events ce
  WHERE ce.id = _event_id;

  IF TG_TABLE_NAME = 'calendar_event_comments' THEN
    _new := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE public.calendar_event_comment_broadcast_row(NEW) END;
    _old := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE public.calendar_event_comment_broadcast_row(OLD) END;
  ELSE
    _new := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
    _old := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  END IF;

  _payload := jsonb_build_object(
    'op', TG_OP,
    'event_id', _event_id,
    'new', _new,
    'old', _old,
    'counts', CASE WHEN TG_TABLE_NAME = 'calendar_event_rsvps' THEN public.calendar_event_rsvp_counts(_event_id) ELSE NULL END,
    'event', CASE WHEN TG_TABLE_NAME = 'calendar_event_rsvps' THEN public.calendar_event_broadcast_row(_event_id) ELSE NULL END
  );

  PERFORM realtime.send(
    _payload,
    TG_TABLE_NAME,
    'calendar-event:' || _event_id::text,
    false
  );

  IF TG_TABLE_NAME = 'calendar_event_rsvps' AND _channel_id IS NOT NULL THEN
    PERFORM realtime.send(
      _payload,
      TG_TABLE_NAME,
      'calendar-events:' || _channel_id::text,
      false
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_broadcast_calendar_event_change ON public.calendar_events;
CREATE TRIGGER trg_broadcast_calendar_event_change
AFTER INSERT OR UPDATE OR DELETE ON public.calendar_events
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_calendar_event_change();

DROP TRIGGER IF EXISTS trg_broadcast_calendar_event_rsvp_change ON public.calendar_event_rsvps;
CREATE TRIGGER trg_broadcast_calendar_event_rsvp_change
AFTER INSERT OR UPDATE OR DELETE ON public.calendar_event_rsvps
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_calendar_event_detail_change();

DROP TRIGGER IF EXISTS trg_broadcast_calendar_event_comment_change ON public.calendar_event_comments;
CREATE TRIGGER trg_broadcast_calendar_event_comment_change
AFTER INSERT OR UPDATE OR DELETE ON public.calendar_event_comments
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_calendar_event_detail_change();

DROP TRIGGER IF EXISTS trg_broadcast_calendar_event_reaction_change ON public.calendar_event_reactions;
CREATE TRIGGER trg_broadcast_calendar_event_reaction_change
AFTER INSERT OR UPDATE OR DELETE ON public.calendar_event_reactions
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_calendar_event_detail_change();

REVOKE EXECUTE ON FUNCTION public.calendar_event_broadcast_row(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.calendar_event_rsvp_counts(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.calendar_event_comment_broadcast_row(public.calendar_event_comments) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.broadcast_calendar_event_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.broadcast_calendar_event_detail_change() FROM PUBLIC;
