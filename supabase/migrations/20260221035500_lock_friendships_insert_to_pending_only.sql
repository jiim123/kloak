-- Prevent friendship auto-accept abuse through direct table inserts.
-- Goal: any new friendship row created by clients must start as 'pending'.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- Create helper function first (avoids lock-order inversion while table lock is held).
CREATE OR REPLACE FUNCTION public.enforce_friendship_pending_on_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.status := 'pending'::friendship_status;
  RETURN NEW;
END;
$$;

-- Take one explicit lock to serialize policy/trigger DDL on this hot table.
LOCK TABLE public.friendships IN ACCESS EXCLUSIVE MODE;

-- Tighten INSERT RLS to pending-only.
DROP POLICY IF EXISTS "Users send own friend requests" ON public.friendships;
CREATE POLICY "Users send own friend requests"
ON public.friendships
FOR INSERT
TO public
WITH CHECK (
  requester_id = requesting_user_id()
  AND requesting_user_id() IS NOT NULL
  AND requester_id <> addressee_id
  AND status = 'pending'::friendship_status
);

-- Defense in depth: force pending status on all direct inserts.

DROP TRIGGER IF EXISTS enforce_friendship_pending_insert ON public.friendships;
CREATE TRIGGER enforce_friendship_pending_insert
BEFORE INSERT ON public.friendships
FOR EACH ROW
EXECUTE FUNCTION public.enforce_friendship_pending_on_insert();

COMMIT;

-- Optional rollback:
-- BEGIN;
-- DROP TRIGGER IF EXISTS enforce_friendship_pending_insert ON public.friendships;
-- DROP FUNCTION IF EXISTS public.enforce_friendship_pending_on_insert();
-- DROP POLICY IF EXISTS "Users send own friend requests" ON public.friendships;
-- CREATE POLICY "Users send own friend requests"
-- ON public.friendships
-- FOR INSERT
-- TO public
-- WITH CHECK (
--   requester_id = requesting_user_id()
--   AND requesting_user_id() IS NOT NULL
--   AND requester_id <> addressee_id
-- );
-- COMMIT;
