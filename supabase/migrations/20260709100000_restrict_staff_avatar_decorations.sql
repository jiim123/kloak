-- Restrict staff-only avatar decorations at the database layer.
-- The client hides these from non-staff users, but this check prevents manual profile updates.

UPDATE public.users
SET avatar_decoration = NULL
WHERE avatar_decoration = 'kloak-team'
  AND COALESCE(is_staff, false) = false;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_avatar_decoration_staff_only;

ALTER TABLE public.users
  ADD CONSTRAINT users_avatar_decoration_staff_only
  CHECK (
    avatar_decoration IS NULL
    OR avatar_decoration <> 'kloak-team'
    OR is_staff = true
  );

COMMENT ON CONSTRAINT users_avatar_decoration_staff_only ON public.users
  IS 'Only staff users may apply staff-only avatar decorations such as kloak-team.';
