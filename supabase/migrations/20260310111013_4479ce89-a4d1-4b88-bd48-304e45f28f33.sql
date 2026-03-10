
-- Fix the mention limit function
CREATE OR REPLACE FUNCTION public.check_mention_limit(_content text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mention_count int;
BEGIN
  SELECT count(*) INTO mention_count
  FROM regexp_matches(_content, '<@[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>', 'g');
  RETURN mention_count <= 5;
END;
$$;
