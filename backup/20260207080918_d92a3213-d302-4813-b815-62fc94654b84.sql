
CREATE OR REPLACE FUNCTION public.update_user_status(
  _user_id uuid, _status user_status
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _status = 'offline' THEN
    -- Set last_seen to 10 minutes ago so getEffectivePresence treats user as offline immediately
    UPDATE users SET status = _status, last_seen = now() - interval '10 minutes' WHERE id = _user_id;
  ELSE
    UPDATE users SET status = _status, last_seen = now() WHERE id = _user_id;
  END IF;
  RETURN true;
END;
$$;
