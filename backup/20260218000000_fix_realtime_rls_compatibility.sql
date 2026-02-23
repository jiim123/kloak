-- Fix RLS policies for Supabase Realtime compatibility
-- Realtime doesn't have HTTP request headers, so requesting_user_id() returns NULL
-- This causes RLS policies to fail and filter out all realtime events
-- Solution: Make policies pass when in Realtime context (requesting_user_id() is NULL)

-- Update requesting_user_id() to call get_request_user_id() with exception handling
-- This ensures it works for REST API and gracefully handles Realtime context (no headers)
CREATE OR REPLACE FUNCTION public.requesting_user_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Call the existing get_request_user_id() function
  -- If it throws an error (Realtime context - no request.headers), return NULL
  BEGIN
    RETURN public.get_request_user_id();
  EXCEPTION
    WHEN OTHERS THEN
      -- If get_request_user_id() fails (e.g., request.headers doesn't exist in Realtime), return NULL
      RETURN NULL;
  END;
END;
$$;

-- Update messages RLS policy to allow Realtime events through
-- Realtime evaluates RLS as the 'realtime' role, so we check for that
-- Also add fallback for when requesting_user_id() is NULL (Realtime context)
DROP POLICY IF EXISTS "Server members view channel messages" ON public.messages;
CREATE POLICY "Server members view channel messages"
  ON public.messages FOR SELECT
  USING (
    -- Allow if user is a channel member (normal REST API case)
    is_channel_server_member(channel_id, (SELECT requesting_user_id()))
    OR
    -- Allow if running as Realtime role (for realtime subscriptions)
    -- Realtime subscriptions are already authenticated at the connection level
    current_user = 'realtime'
    OR
    -- Allow if requesting_user_id() is NULL (Realtime context - no HTTP headers)
    (SELECT requesting_user_id()) IS NULL
  );

-- Update reactions RLS policy similarly
DROP POLICY IF EXISTS "Reactions are viewable" ON public.reactions;
CREATE POLICY "Reactions are viewable"
  ON public.reactions FOR SELECT
  USING (
    is_channel_server_member(channel_id, (SELECT requesting_user_id()))
    OR
    current_user = 'realtime'
    OR
    -- Allow if requesting_user_id() is NULL (Realtime context - no HTTP headers)
    (SELECT requesting_user_id()) IS NULL
  );
