
-- Drop the overly restrictive channel creation rate limit trigger
-- 10 channels per hour per server is too low - template imports can create 10+ channels at once
DROP TRIGGER IF EXISTS enforce_channel_creation_rate_limit ON public.channels;

-- Recreate with a more reasonable limit: 30 channels per hour per server
CREATE OR REPLACE FUNCTION public.rate_limit_channel_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  recent_count integer;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM channels
  WHERE created_at > NOW() - INTERVAL '1 hour'
  AND server_id = NEW.server_id;

  IF recent_count >= 30 THEN
    RAISE EXCEPTION 'Rate limit exceeded: too many channels created recently';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_channel_creation_rate_limit
  BEFORE INSERT ON public.channels
  FOR EACH ROW
  EXECUTE FUNCTION public.rate_limit_channel_creation();
