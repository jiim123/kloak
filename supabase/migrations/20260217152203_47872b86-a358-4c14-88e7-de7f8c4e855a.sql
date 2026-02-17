
-- Fix SECURITY DEFINER view warning: make the view use SECURITY INVOKER (default)
-- Drop and recreate without SECURITY DEFINER
DROP VIEW IF EXISTS public.users_public;
CREATE VIEW public.users_public
WITH (security_invoker = true)
AS
SELECT
  id, username, display_name, avatar_url, banner_color, bio,
  status, custom_status, created_at, avatar_decoration,
  profile_theme_primary, profile_theme_accent, banner_url,
  profile_effect, pronouns,
  CASE
    WHEN id = (SELECT requesting_user_id()) THEN last_seen
    ELSE NULL
  END AS last_seen
FROM users;
