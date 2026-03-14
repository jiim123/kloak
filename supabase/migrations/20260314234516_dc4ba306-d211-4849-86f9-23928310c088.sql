
-- Auto-ban spam trigger: bans user if they send the same message content 5+ times in 10 seconds
CREATE OR REPLACE FUNCTION public.auto_ban_spammer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  spam_count int;
  channel_server_id uuid;
BEGIN
  -- Get the server for this channel
  SELECT server_id INTO channel_server_id
  FROM channels WHERE id = NEW.channel_id;

  IF channel_server_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count how many times this user sent this exact content in the last 10 seconds (across all channels in this server)
  SELECT count(*) INTO spam_count
  FROM messages m
  JOIN channels c ON c.id = m.channel_id
  WHERE m.user_id = NEW.user_id
    AND c.server_id = channel_server_id
    AND m.content = NEW.content
    AND m.created_at >= (now() - interval '10 seconds');

  -- If 5 or more (including the just-inserted one), ban the user
  IF spam_count >= 5 THEN
    UPDATE server_members
    SET is_banned = true
    WHERE server_id = channel_server_id
      AND user_id = NEW.user_id
      AND is_banned = false;
  END IF;

  RETURN NEW;
END;
$$;

-- Fire AFTER insert so the new row is already counted
CREATE TRIGGER trg_auto_ban_spammer
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_ban_spammer();
