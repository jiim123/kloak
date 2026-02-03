-- Create a function to increment mention_count when a mention is created
CREATE OR REPLACE FUNCTION public.increment_mention_count()
RETURNS TRIGGER AS $$
DECLARE
  _channel_id UUID;
BEGIN
  -- Get the channel_id from the message
  SELECT channel_id INTO _channel_id
  FROM public.messages
  WHERE id = NEW.message_id;

  IF _channel_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Upsert channel_reads record and increment mention_count
  INSERT INTO public.channel_reads (user_id, channel_id, mention_count)
  VALUES (NEW.user_id, _channel_id, 1)
  ON CONFLICT (user_id, channel_id)
  DO UPDATE SET mention_count = COALESCE(channel_reads.mention_count, 0) + 1;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on mentions table
DROP TRIGGER IF EXISTS trigger_increment_mention_count ON public.mentions;
CREATE TRIGGER trigger_increment_mention_count
  AFTER INSERT ON public.mentions
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_mention_count();

-- Also create a unique constraint on channel_reads if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'channel_reads_user_channel_unique'
  ) THEN
    ALTER TABLE public.channel_reads 
    ADD CONSTRAINT channel_reads_user_channel_unique 
    UNIQUE (user_id, channel_id);
  END IF;
END $$;