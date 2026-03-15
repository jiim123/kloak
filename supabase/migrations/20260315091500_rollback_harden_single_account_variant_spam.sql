-- Roll back 20260315084500_harden_single_account_variant_spam.sql
-- Restore the previous exact-content auto-ban trigger behavior.

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
  SELECT c.server_id, s.owner_id
  INTO channel_server_id, target_owner_id
  FROM public.channels c
  JOIN public.servers s ON s.id = c.server_id
  WHERE c.id = NEW.channel_id;

  IF channel_server_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id = target_owner_id THEN
    RETURN NEW;
  END IF;

  SELECT count(*)
  INTO spam_count
  FROM public.messages m
  JOIN public.channels c ON c.id = m.channel_id
  WHERE m.user_id = NEW.user_id
    AND c.server_id = channel_server_id
    AND m.content = NEW.content
    AND m.created_at >= (now() - interval '5 seconds');

  IF spam_count >= 3 THEN
    UPDATE public.server_members
    SET is_banned = true
    WHERE server_id = channel_server_id
      AND user_id = NEW.user_id
      AND is_banned = false;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_ban_spammer ON public.messages;
CREATE TRIGGER trg_auto_ban_spammer
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_ban_spammer();
