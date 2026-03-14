
-- Drop and recreate with stricter threshold: 3 same messages in 5 seconds = auto-ban
CREATE OR REPLACE FUNCTION public.auto_ban_spammer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  spam_count int;
  channel_server_id uuid;
  target_owner_id uuid;
BEGIN
  -- Get the server for this channel
  SELECT c.server_id, s.owner_id INTO channel_server_id, target_owner_id
  FROM channels c
  JOIN servers s ON s.id = c.server_id
  WHERE c.id = NEW.channel_id;

  IF channel_server_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Never auto-ban the server owner
  IF NEW.user_id = target_owner_id THEN
    RETURN NEW;
  END IF;

  -- Count how many times this user sent this exact content in the last 5 seconds (across all server channels)
  SELECT count(*) INTO spam_count
  FROM messages m
  JOIN channels c ON c.id = m.channel_id
  WHERE m.user_id = NEW.user_id
    AND c.server_id = channel_server_id
    AND m.content = NEW.content
    AND m.created_at >= (now() - interval '5 seconds');

  -- If 3 or more (including the just-inserted one), ban the user
  IF spam_count >= 3 THEN
    UPDATE server_members
    SET is_banned = true
    WHERE server_id = channel_server_id
      AND user_id = NEW.user_id
      AND is_banned = false;
  END IF;

  RETURN NEW;
END;
$$;
