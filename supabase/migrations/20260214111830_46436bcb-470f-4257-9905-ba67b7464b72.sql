
-- Fix remaining 3 functions missing search_path
ALTER FUNCTION public.enforce_server_emoji_limit() SET search_path = public;
ALTER FUNCTION public.update_task_updated_at() SET search_path = public;
ALTER FUNCTION public.update_voice_settings_timestamp() SET search_path = public;
