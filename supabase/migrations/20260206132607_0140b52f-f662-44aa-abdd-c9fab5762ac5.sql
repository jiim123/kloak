-- Drop the old 1-parameter get_server_categories that has no membership check
DROP FUNCTION IF EXISTS public.get_server_categories(uuid);