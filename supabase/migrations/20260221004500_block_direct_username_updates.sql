-- Block direct username edits via REST/API.
-- Frontend already blocks this; backend must enforce it too.
-- Use column privileges instead of replacing RLS policy to minimize lock scope.

REVOKE UPDATE (username) ON public.users FROM anon, authenticated;
