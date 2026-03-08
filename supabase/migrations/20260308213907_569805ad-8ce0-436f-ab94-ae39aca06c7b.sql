-- Fix trigger that forces all new friendships to 'pending', breaking block_user RPC
-- Allow 'blocked' status on insert (only possible via SECURITY DEFINER RPCs due to RLS)
CREATE OR REPLACE FUNCTION public.enforce_friendship_pending_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Allow 'blocked' status (set by block_user SECURITY DEFINER RPC)
  IF NEW.status = 'blocked' THEN
    RETURN NEW;
  END IF;
  -- All other inserts must start as pending
  NEW.status := 'pending'::friendship_status;
  RETURN NEW;
END;
$$;

-- Fix trigger that prevents requester/addressee changes, breaking block_user RPC
-- Allow identity swap when transitioning to 'blocked' status (block_user needs this)
CREATE OR REPLACE FUNCTION public.prevent_friendship_identity_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Allow identity changes when blocking (block_user RPC swaps requester to blocker)
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