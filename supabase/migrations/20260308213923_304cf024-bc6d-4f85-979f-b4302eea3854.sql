-- Set search_path on both trigger functions to fix security linter warnings
CREATE OR REPLACE FUNCTION public.enforce_friendship_pending_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'blocked' THEN
    RETURN NEW;
  END IF;
  NEW.status := 'pending'::friendship_status;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_friendship_identity_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'blocked' THEN
    RETURN NEW;
  END IF;
  IF NEW.requester_id != OLD.requester_id THEN
    RAISE EXCEPTION 'Friendship requester_id cannot be changed';
  END IF;
  IF NEW.addressee_id != OLD.addressee_id THEN
    RAISE EXCEPTION 'Friendship addressee_id cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;