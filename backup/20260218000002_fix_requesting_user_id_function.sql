-- FIX: Make requesting_user_id() call get_request_user_id() with exception handling
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
