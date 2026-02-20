-- Fix recursive users UPDATE policy and enforce immutable usernames safely.

-- 1) Restore non-recursive UPDATE policy shape.
ALTER POLICY "Users can update own record"
ON public.users
WITH CHECK (id = (SELECT public.requesting_user_id()));

-- 2) Enforce username immutability via trigger (uses OLD/NEW, no RLS recursion).
CREATE OR REPLACE FUNCTION public.prevent_username_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.username IS DISTINCT FROM OLD.username THEN
    RAISE EXCEPTION 'Username cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_username_change ON public.users;

CREATE TRIGGER trg_prevent_username_change
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.prevent_username_change();
