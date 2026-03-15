
-- Create a trigger that fires when a user is banned (is_banned flips to true)
-- and deletes all their messages from that server's channels.
-- Also handles kicked users (DELETE from server_members) by deleting their messages.

CREATE OR REPLACE FUNCTION public.purge_banned_user_messages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _server_id uuid;
  _user_id uuid;
BEGIN
  -- Handle UPDATE (ban) - is_banned flipped to true
  IF TG_OP = 'UPDATE' THEN
    IF NEW.is_banned = true AND OLD.is_banned = false THEN
      _server_id := NEW.server_id;
      _user_id := NEW.user_id;
    ELSE
      RETURN NEW;
    END IF;
  -- Handle DELETE (kick) - member removed entirely
  ELSIF TG_OP = 'DELETE' THEN
    _server_id := OLD.server_id;
    _user_id := OLD.user_id;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Delete all messages by this user in this server's channels
  DELETE FROM messages
  WHERE user_id = _user_id
    AND channel_id IN (
      SELECT id FROM channels WHERE server_id = _server_id
    );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Fire after ban or kick so the membership change is already committed
DROP TRIGGER IF EXISTS trg_purge_banned_user_messages ON public.server_members;
CREATE TRIGGER trg_purge_banned_user_messages
  AFTER UPDATE OR DELETE ON public.server_members
  FOR EACH ROW
  EXECUTE FUNCTION public.purge_banned_user_messages();
