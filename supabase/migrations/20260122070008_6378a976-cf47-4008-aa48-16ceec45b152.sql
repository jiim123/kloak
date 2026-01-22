-- Remove duplicate friend request notification trigger
-- The send_friend_request RPC function already creates a notification,
-- so this trigger causes duplicate notifications

DROP TRIGGER IF EXISTS friendship_notification_trigger ON friendships;
DROP FUNCTION IF EXISTS public.trigger_friendship_notification();

-- Update remove_friend function to properly delete the friendship for both users
-- (the existing function already deletes the row, which removes it for both users,
-- but let's ensure it works correctly by checking both directions)
CREATE OR REPLACE FUNCTION public.remove_friend(_friendship_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete the friendship if the user is either the requester or addressee
  DELETE FROM friendships
  WHERE id = _friendship_id
    AND (requester_id = _user_id OR addressee_id = _user_id)
    AND status = 'accepted';
  
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_friend(uuid, uuid) TO anon, authenticated;