-- Drop the old update_channel function with json parameter type
-- This resolves the function overloading conflict
DROP FUNCTION IF EXISTS public.update_channel(uuid, uuid, json);
