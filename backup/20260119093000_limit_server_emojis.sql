-- Enforce max 30 custom emojis per server at the DB level

CREATE OR REPLACE FUNCTION public.enforce_server_emoji_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  emoji_count integer;
BEGIN
  SELECT COUNT(*) INTO emoji_count
  FROM public.server_emojis
  WHERE server_id = NEW.server_id;

  IF emoji_count >= 30 THEN
    RAISE EXCEPTION 'server emoji limit reached';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_server_emoji_limit ON public.server_emojis;
CREATE TRIGGER trg_enforce_server_emoji_limit
BEFORE INSERT ON public.server_emojis
FOR EACH ROW
EXECUTE FUNCTION public.enforce_server_emoji_limit();

