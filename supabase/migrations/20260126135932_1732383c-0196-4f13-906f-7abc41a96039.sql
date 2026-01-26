-- Drop all create_channel function overloads first
DROP FUNCTION IF EXISTS public.create_channel(uuid, uuid, text, text, uuid, integer, text);
DROP FUNCTION IF EXISTS public.create_channel(uuid, uuid, varchar, varchar, uuid, integer, text, boolean);
DROP FUNCTION IF EXISTS public.create_channel(uuid, text, text, uuid, uuid, integer, text, boolean);