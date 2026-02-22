-- Improve hot-path chat queries:
-- 1) channel timeline fetches ordered by created_at
-- 2) pinned message lookups per channel

CREATE INDEX IF NOT EXISTS idx_messages_channel_created_at_desc
  ON public.messages (channel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_channel_pinned_created_at_desc
  ON public.messages (channel_id, created_at DESC)
  WHERE is_pinned = true;
