
-- Fix: Remove verify_request_identity from helper functions.
-- Identity is already verified by the calling RPC (send_friend_request).
-- The nested SECURITY DEFINER context can lose request.headers GUC,
-- causing false negatives and "Cannot send friend request" errors.

CREATE OR REPLACE FUNCTION public.shares_server_with(_user_id uuid, _other_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    _user_id IS NOT NULL
    AND _other_user_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.server_members sm1
      JOIN public.server_members sm2
        ON sm1.server_id = sm2.server_id
      WHERE sm1.user_id = _user_id
        AND sm2.user_id = _other_user_id
        AND sm1.is_banned = false
        AND sm2.is_banned = false
    )
$$;

CREATE OR REPLACE FUNCTION public.shares_dm_with(_user_id uuid, _other_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    _user_id IS NOT NULL
    AND _other_user_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.dm_participants dp1
      JOIN public.dm_participants dp2
        ON dp1.conversation_id = dp2.conversation_id
      WHERE dp1.user_id = _user_id
        AND dp2.user_id = _other_user_id
    )
$$;
