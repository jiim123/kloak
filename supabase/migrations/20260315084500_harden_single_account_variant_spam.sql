-- Catch single-account spam where the sender varies a suffix/token to dodge
-- the exact-content trigger. Also purge the spam burst immediately.

CREATE OR REPLACE FUNCTION public.auto_ban_spammer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  channel_server_id uuid;
  target_owner_id uuid;
  sender_role public.server_role;
  similar_spam_count integer := 0;
  recent_burst_ids uuid[] := ARRAY[]::uuid[];
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

  SELECT sm.role
  INTO sender_role
  FROM public.server_members sm
  WHERE sm.server_id = channel_server_id
    AND sm.user_id = NEW.user_id
    AND COALESCE(sm.is_banned, false) = false;

  -- Never auto-ban privileged accounts via spam heuristics.
  IF sender_role IS NULL OR sender_role <> 'member' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)::integer
  INTO similar_spam_count
  FROM public.messages m
  JOIN public.channels c ON c.id = m.channel_id
  WHERE m.user_id = NEW.user_id
    AND c.server_id = channel_server_id
    AND COALESCE(m.is_system_message, false) = false
    AND m.created_at >= now() - interval '12 seconds'
    AND public.are_messages_similar_for_raid(m.content, NEW.content);

  -- Three near-duplicate messages inside a short burst is enough to treat as spam.
  IF similar_spam_count >= 3 THEN
    SELECT COALESCE(array_agg(m.id), ARRAY[]::uuid[])
    INTO recent_burst_ids
    FROM public.messages m
    JOIN public.channels c ON c.id = m.channel_id
    WHERE m.user_id = NEW.user_id
      AND c.server_id = channel_server_id
      AND COALESCE(m.is_system_message, false) = false
      AND m.created_at >= now() - interval '2 minutes'
      AND public.are_messages_similar_for_raid(m.content, NEW.content);

    UPDATE public.server_members
    SET is_banned = true
    WHERE server_id = channel_server_id
      AND user_id = NEW.user_id
      AND role = 'member'
      AND COALESCE(is_banned, false) = false;

    IF array_length(recent_burst_ids, 1) IS NOT NULL THEN
      DELETE FROM public.messages
      WHERE id = ANY(recent_burst_ids);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_ban_spammer ON public.messages;
CREATE TRIGGER trg_auto_ban_spammer
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_ban_spammer();
