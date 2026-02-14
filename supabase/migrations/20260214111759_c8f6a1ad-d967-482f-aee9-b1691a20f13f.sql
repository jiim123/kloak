
-- Phase 2: Fix linter warnings

-- 1. Fix users_public view: set security_invoker = true
ALTER VIEW public.users_public SET (security_invoker = true);

-- 2. Fix SECURITY DEFINER functions missing search_path
ALTER FUNCTION public.close_expired_polls(uuid) SET search_path = public;
ALTER FUNCTION public.close_poll(uuid) SET search_path = public;
ALTER FUNCTION public.get_user_server_folders(uuid) SET search_path = public;
ALTER FUNCTION public.get_user_server_tabs(uuid) SET search_path = public;
ALTER FUNCTION public.increment_mention_count() SET search_path = public;
ALTER FUNCTION public.reorder_user_servers(uuid, uuid[]) SET search_path = public;
ALTER FUNCTION public.save_user_server_folders(uuid, jsonb) SET search_path = public;
ALTER FUNCTION public.save_user_server_tabs(uuid, text[]) SET search_path = public;
ALTER FUNCTION public.update_category(uuid, uuid, text) SET search_path = public;
ALTER FUNCTION public.update_channel(uuid, uuid, text) SET search_path = public;
ALTER FUNCTION public.upsert_user_preferences(uuid, jsonb) SET search_path = public;
