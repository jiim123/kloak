-- The event comment/reaction RLS policies inspect calendar_events to verify
-- channel access. REST roles need table-level SELECT on calendar_events before
-- those policy subqueries can run.
GRANT SELECT ON TABLE public.calendar_events TO anon, authenticated;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END
$$;
