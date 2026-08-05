-- Keep server joins independent from bot-worker/network availability.
--
-- The server-bot queue trigger used net.http_post() from inside the source
-- row transaction. A slow/unavailable worker could therefore hold a join
-- until statement_timeout. The cron worker already processes the same queue,
-- so the HTTP kick is not required for correctness.

DROP TRIGGER IF EXISTS trg_server_bot_event_queue_kick_worker
  ON public.server_bot_event_queue;

-- A server join message is trusted system output, not a user-created message.
-- Do not enqueue it into message-created bot flows. Member-joined flows still
-- use trg_server_bot_member_joined and remain available through the queue.
DROP TRIGGER IF EXISTS trg_server_bot_message_created ON public.messages;
CREATE TRIGGER trg_server_bot_message_created
AFTER INSERT ON public.messages
FOR EACH ROW
WHEN (COALESCE(NEW.is_system_message, false) = false)
EXECUTE FUNCTION public.enqueue_server_bot_message_created();

-- User moderation/content checks should not run against trusted system output.
DROP TRIGGER IF EXISTS trg_enforce_user_message_punishment ON public.messages;
CREATE TRIGGER trg_enforce_user_message_punishment
BEFORE INSERT ON public.messages
FOR EACH ROW
WHEN (COALESCE(NEW.is_system_message, false) = false)
EXECUTE FUNCTION public.enforce_channel_message_punishment();

DROP TRIGGER IF EXISTS trg_enforce_announcement_message_creation ON public.messages;
CREATE TRIGGER trg_enforce_announcement_message_creation
BEFORE INSERT ON public.messages
FOR EACH ROW
WHEN (COALESCE(NEW.is_system_message, false) = false)
EXECUTE FUNCTION public.enforce_announcement_message_creation();

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
