-- Add the missing trigger that parses mentions from message content
-- and inserts them into the mentions table (which then fires mention_notification_trigger)
CREATE TRIGGER trg_handle_message_mentions
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_message_mentions();