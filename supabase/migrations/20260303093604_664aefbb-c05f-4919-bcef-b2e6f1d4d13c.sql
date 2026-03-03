
-- Fix infinite recursion in thread_messages UPDATE policy
-- The with_check was querying thread_messages itself, causing recursion

-- Drop the problematic policy
DROP POLICY IF EXISTS "Thread messages can be updated" ON public.thread_messages;

-- Create a security definer function to get the thread_id for a thread message
CREATE OR REPLACE FUNCTION public.get_thread_message_thread_id(_message_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT thread_id FROM thread_messages WHERE id = _message_id;
$$;

-- Recreate the policy using the security definer function
CREATE POLICY "Thread messages can be updated" ON public.thread_messages
FOR UPDATE
USING (user_id = (SELECT requesting_user_id()))
WITH CHECK (
  (user_id = (SELECT requesting_user_id()))
  AND (thread_id = get_thread_message_thread_id(id))
);
