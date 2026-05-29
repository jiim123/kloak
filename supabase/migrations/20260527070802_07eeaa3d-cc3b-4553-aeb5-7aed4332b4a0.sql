
ALTER TABLE public.message_attachments
  ADD COLUMN IF NOT EXISTS placeholder text,
  ADD COLUMN IF NOT EXISTS is_spoiler boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_voice_message boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS waveform jsonb,
  ADD COLUMN IF NOT EXISTS enriched_at timestamptz;

ALTER TABLE public.message_attachments REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'message_attachments'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.message_attachments';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_message_attachments_enriched_at_null
  ON public.message_attachments (id)
  WHERE enriched_at IS NULL;
