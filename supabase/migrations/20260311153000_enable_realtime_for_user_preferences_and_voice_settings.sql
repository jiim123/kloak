-- Enable realtime delivery for per-user settings tables so clients can
-- subscribe to preference and voice-setting changes without polling RPCs.

DROP POLICY IF EXISTS "user_preferences_realtime_select_own" ON public.user_preferences;
CREATE POLICY "user_preferences_realtime_select_own"
ON public.user_preferences
FOR SELECT
TO public
USING (
  CASE
    WHEN CURRENT_USER IN ('realtime'::name, 'supabase_realtime_admin'::name)
      THEN (SELECT public.requesting_user_id()) IS NOT NULL
        AND user_id = (SELECT public.requesting_user_id())
    ELSE user_id = (SELECT public.requesting_user_id())
      AND (SELECT public.requesting_user_id()) IS NOT NULL
  END
);

DROP POLICY IF EXISTS "user_voice_settings_realtime_select_own" ON public.user_voice_settings;
CREATE POLICY "user_voice_settings_realtime_select_own"
ON public.user_voice_settings
FOR SELECT
TO public
USING (
  CASE
    WHEN CURRENT_USER IN ('realtime'::name, 'supabase_realtime_admin'::name)
      THEN (SELECT public.requesting_user_id()) IS NOT NULL
        AND user_id = (SELECT public.requesting_user_id())
    ELSE user_id = (SELECT public.requesting_user_id())
      AND (SELECT public.requesting_user_id()) IS NOT NULL
  END
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_realtime_admin') THEN
    EXECUTE 'GRANT SELECT ON TABLE public.user_preferences TO supabase_realtime_admin';
    EXECUTE 'GRANT SELECT ON TABLE public.user_voice_settings TO supabase_realtime_admin';
  ELSIF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'realtime') THEN
    EXECUTE 'GRANT SELECT ON TABLE public.user_preferences TO realtime';
    EXECUTE 'GRANT SELECT ON TABLE public.user_voice_settings TO realtime';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'user_preferences'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.user_preferences';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'user_voice_settings'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.user_voice_settings';
    END IF;
  END IF;
END
$$;
