CREATE OR REPLACE FUNCTION public.handle_message_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.mentions (message_id, user_id, mention_type)
  SELECT DISTINCT NEW.id, (m[1])::uuid, 'user'::mention_type
  FROM regexp_matches(NEW.content, '<@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})>', 'g') AS m
  ON CONFLICT DO NOTHING;

  UPDATE public.channel_reads
  SET mention_count = mention_count + 1
  WHERE channel_id = NEW.channel_id
    AND user_id IN (
      SELECT user_id FROM public.mentions WHERE message_id = NEW.id
    )
    AND user_id != NEW.user_id;

  RETURN NEW;
END;
$$;