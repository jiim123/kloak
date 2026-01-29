-- Create function to get user's votes for a poll
CREATE OR REPLACE FUNCTION public.get_user_poll_votes(
  _poll_id uuid,
  _user_id uuid
)
RETURNS integer[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  votes integer[];
BEGIN
  SELECT ARRAY_AGG(option_index ORDER BY option_index)
  INTO votes
  FROM poll_votes
  WHERE poll_id = _poll_id AND user_id = _user_id;
  
  RETURN COALESCE(votes, ARRAY[]::integer[]);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_user_poll_votes(uuid, uuid) TO anon, authenticated;