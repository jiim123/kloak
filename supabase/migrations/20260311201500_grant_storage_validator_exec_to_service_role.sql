-- Fix storage uploads failing with RLS-style errors when executed through Edge Function.
-- Root cause: service_role cannot EXECUTE storage validator functions used by
-- policy checks and storage triggers.

GRANT EXECUTE ON FUNCTION public.is_safe_storage_object_key(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_safe_storage_object_keys() TO service_role;
