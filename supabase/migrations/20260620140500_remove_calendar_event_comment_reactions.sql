DROP FUNCTION IF EXISTS public.toggle_calendar_event_comment_reaction(uuid, uuid, text);

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.calendar_event_comment_reactions;
  EXCEPTION
    WHEN undefined_object THEN NULL;
    WHEN undefined_table THEN NULL;
  END;
END
$$;

DROP TABLE IF EXISTS public.calendar_event_comment_reactions;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END
$$;
