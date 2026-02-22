-- Force DM privacy to friends for every existing user account.
-- This intentionally overrides any current user preference.

BEGIN;

-- Ensure every user has a preference row.
INSERT INTO public.user_preferences (user_id, dm_privacy)
SELECT u.id, 'friends'
FROM public.users u
LEFT JOIN public.user_preferences up ON up.user_id = u.id
WHERE up.user_id IS NULL;

-- Force all existing preference rows to friends.
UPDATE public.user_preferences
SET dm_privacy = 'friends',
    updated_at = now()
WHERE dm_privacy IS DISTINCT FROM 'friends';

COMMIT;

-- Optional rollback (if needed):
-- There is no exact rollback for per-user previous values unless you snapshot first.
