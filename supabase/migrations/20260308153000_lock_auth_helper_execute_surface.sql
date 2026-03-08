-- Tighten execute privileges for auth/account RPCs and internal helpers.
-- Goal:
-- - internal helpers are service-role only
-- - public login remains callable by anon/authenticated
-- - direct account actions remain callable by anon/authenticated but not PUBLIC
-- - profile updates stay edge-function-only via service_role

REVOKE EXECUTE ON FUNCTION public.get_request_user_id() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_request_user_id() TO service_role;

REVOKE EXECUTE ON FUNCTION public.verify_request_identity(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_request_identity(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.update_user_profile(uuid, json) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_profile(uuid, json) TO service_role;

REVOKE EXECUTE ON FUNCTION public.register_user(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_user(text, text, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.login_user(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.login_user(text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.reset_user_secret_key(uuid, character) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_user_secret_key(uuid, character) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.delete_user_account(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_account(uuid) TO anon, authenticated;
