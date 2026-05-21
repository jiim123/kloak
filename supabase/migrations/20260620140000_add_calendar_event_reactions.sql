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

ALTER TABLE public.calendar_event_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.calendar_event_reactions ENABLE ROW LEVEL SECURITY;

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

REVOKE EXECUTE ON FUNCTION public.toggle_calendar_event_reaction(uuid, uuid, text) FROM PUBLIC;
GRANT SELECT ON TABLE public.calendar_event_reactions TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_calendar_event_reaction(uuid, uuid, text) TO anon, authenticated, service_role;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_event_reactions;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;

  PERFORM pg_notify('pgrst', 'reload schema');
END
$$;
