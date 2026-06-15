-- Allow profile avatars and banners served from the Bunny CDN avatars bucket.
-- Keep this function aligned with 20260616120000_add_user_profile_tagline_and_posts.sql.

CREATE OR REPLACE FUNCTION public.update_user_profile(_user_id uuid, _updates json)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  result json;
  _u jsonb;
  _field text;
  _headers json;

  _v_display_name text;
  _v_bio text;
  _v_tagline text;
  _v_avatar_url text;
  _v_banner_url text;
  _v_avatar_decoration text;
  _v_profile_effect text;
  _v_banner_color text;
  _v_profile_theme_primary text;
  _v_profile_theme_accent text;
  _v_custom_status text;
  _v_request_host text;
  _v_legacy_profile_media_prefix text;
  _v_bunny_profile_media_prefix text := 'https://kloakcdn.b-cdn.net/avatars/';
BEGIN
  IF _updates IS NULL OR json_typeof(_updates) <> 'object' THEN
    RAISE EXCEPTION 'Invalid profile updates payload';
  END IF;

  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  _u := _updates::jsonb;

  FOR _field IN SELECT jsonb_object_keys(_u)
  LOOP
    IF _field NOT IN (
      'display_name',
      'bio',
      'tagline',
      'avatar_url',
      'banner_url',
      'avatar_decoration',
      'profile_effect',
      'banner_color',
      'profile_theme_primary',
      'profile_theme_accent',
      'custom_status'
    ) THEN
      RAISE EXCEPTION 'Unsupported profile field: %', _field;
    END IF;
  END LOOP;

  _v_display_name := NULLIF(trim(_updates->>'display_name'), '');
  _v_bio := NULLIF(trim(_updates->>'bio'), '');
  _v_tagline := NULLIF(trim(_updates->>'tagline'), '');
  _v_avatar_url := NULLIF(trim(_updates->>'avatar_url'), '');
  _v_banner_url := NULLIF(trim(_updates->>'banner_url'), '');
  _v_avatar_decoration := NULLIF(trim(_updates->>'avatar_decoration'), '');
  _v_profile_effect := NULLIF(trim(_updates->>'profile_effect'), '');
  _v_banner_color := NULLIF(trim(_updates->>'banner_color'), '');
  _v_profile_theme_primary := NULLIF(trim(_updates->>'profile_theme_primary'), '');
  _v_profile_theme_accent := NULLIF(trim(_updates->>'profile_theme_accent'), '');
  _v_custom_status := NULLIF(trim(_updates->>'custom_status'), '');

  BEGIN
    _headers := current_setting('request.headers', true)::json;
  EXCEPTION WHEN OTHERS THEN
    _headers := '{}'::json;
  END;

  _v_request_host := lower(
    NULLIF(
      trim(
        COALESCE(_headers->>'x-forwarded-host', _headers->>'host')
      ),
      ''
    )
  );

  IF _v_request_host IS NULL THEN
    RAISE EXCEPTION 'Unable to validate profile media URL host';
  END IF;

  _v_legacy_profile_media_prefix := 'https://' || _v_request_host || '/storage/v1/object/public/avatars/';

  IF (_u ? 'display_name') AND _v_display_name IS NOT NULL AND char_length(_v_display_name) > 32 THEN
    RAISE EXCEPTION 'Display name must be 32 characters or fewer';
  END IF;

  IF (_u ? 'bio') AND _v_bio IS NOT NULL AND char_length(_v_bio) > 400 THEN
    RAISE EXCEPTION 'Bio must be 400 characters or fewer';
  END IF;

  IF (_u ? 'tagline') AND _v_tagline IS NOT NULL AND char_length(_v_tagline) > 80 THEN
    RAISE EXCEPTION 'Tagline must be 80 characters or fewer';
  END IF;

  IF (_u ? 'custom_status') AND _v_custom_status IS NOT NULL AND char_length(_v_custom_status) > 20 THEN
    RAISE EXCEPTION 'Custom status must be 20 characters or fewer';
  END IF;

  IF (_u ? 'avatar_url') AND _v_avatar_url IS NOT NULL THEN
    IF char_length(_v_avatar_url) > 2048 THEN
      RAISE EXCEPTION 'Avatar URL must be 2048 characters or fewer';
    END IF;
    IF _v_avatar_url !~* '^https?://[^[:space:]]+$' THEN
      RAISE EXCEPTION 'Avatar URL must be a valid http(s) URL';
    END IF;
    IF _v_avatar_url !~ '^[ -~]+$' THEN
      RAISE EXCEPTION 'Avatar URL must use ASCII characters only';
    END IF;
    IF strpos(lower(_v_avatar_url), _v_legacy_profile_media_prefix) <> 1
       AND strpos(lower(_v_avatar_url), _v_bunny_profile_media_prefix) <> 1 THEN
      RAISE EXCEPTION 'Invalid profile media URL';
    END IF;
  END IF;

  IF (_u ? 'banner_url') AND _v_banner_url IS NOT NULL THEN
    IF char_length(_v_banner_url) > 2048 THEN
      RAISE EXCEPTION 'Banner URL must be 2048 characters or fewer';
    END IF;
    IF _v_banner_url !~* '^https?://[^[:space:]]+$' THEN
      RAISE EXCEPTION 'Banner URL must be a valid http(s) URL';
    END IF;
    IF _v_banner_url !~ '^[ -~]+$' THEN
      RAISE EXCEPTION 'Banner URL must use ASCII characters only';
    END IF;
    IF strpos(lower(_v_banner_url), _v_legacy_profile_media_prefix) <> 1
       AND strpos(lower(_v_banner_url), _v_bunny_profile_media_prefix) <> 1 THEN
      RAISE EXCEPTION 'Invalid profile media URL';
    END IF;
  END IF;

  IF (_u ? 'banner_color') AND _v_banner_color IS NOT NULL AND _v_banner_color !~ '^#[0-9A-Fa-f]{6}$' THEN
    RAISE EXCEPTION 'Banner color must be a hex color like #RRGGBB';
  END IF;

  IF (_u ? 'profile_theme_primary') AND _v_profile_theme_primary IS NOT NULL
     AND _v_profile_theme_primary !~ '^#[0-9A-Fa-f]{6}$' THEN
    RAISE EXCEPTION 'Profile theme primary must be a hex color like #RRGGBB';
  END IF;

  IF (_u ? 'profile_theme_accent') AND _v_profile_theme_accent IS NOT NULL
     AND _v_profile_theme_accent !~ '^#[0-9A-Fa-f]{6}$' THEN
    RAISE EXCEPTION 'Profile theme accent must be a hex color like #RRGGBB';
  END IF;

  IF (_u ? 'avatar_decoration') AND _v_avatar_decoration IS NOT NULL THEN
    IF char_length(_v_avatar_decoration) > 128 THEN
      RAISE EXCEPTION 'Avatar decoration key is too long';
    END IF;
    IF _v_avatar_decoration ~* '^https?://' OR _v_avatar_decoration !~ '^[A-Za-z0-9._-]+$' THEN
      RAISE EXCEPTION 'Avatar decoration must be a valid decoration key';
    END IF;
  END IF;

  IF (_u ? 'profile_effect') AND _v_profile_effect IS NOT NULL THEN
    IF char_length(_v_profile_effect) > 128 THEN
      RAISE EXCEPTION 'Profile effect key is too long';
    END IF;
    IF _v_profile_effect ~* '^https?://' OR _v_profile_effect !~ '^[A-Za-z0-9._-]+$' THEN
      RAISE EXCEPTION 'Profile effect must be a valid effect key';
    END IF;
  END IF;

  UPDATE public.users
  SET
    display_name = CASE WHEN (_u ? 'display_name') THEN _v_display_name ELSE display_name END,
    bio = CASE WHEN (_u ? 'bio') THEN _v_bio ELSE bio END,
    tagline = CASE WHEN (_u ? 'tagline') THEN _v_tagline ELSE tagline END,
    avatar_url = CASE WHEN (_u ? 'avatar_url') THEN _v_avatar_url ELSE avatar_url END,
    banner_url = CASE WHEN (_u ? 'banner_url') THEN _v_banner_url ELSE banner_url END,
    avatar_decoration = CASE WHEN (_u ? 'avatar_decoration') THEN _v_avatar_decoration ELSE avatar_decoration END,
    profile_effect = CASE WHEN (_u ? 'profile_effect') THEN _v_profile_effect ELSE profile_effect END,
    banner_color = CASE WHEN (_u ? 'banner_color') THEN COALESCE(_v_banner_color, banner_color) ELSE banner_color END,
    profile_theme_primary = CASE WHEN (_u ? 'profile_theme_primary') THEN _v_profile_theme_primary ELSE profile_theme_primary END,
    profile_theme_accent = CASE WHEN (_u ? 'profile_theme_accent') THEN _v_profile_theme_accent ELSE profile_theme_accent END,
    custom_status = CASE WHEN (_u ? 'custom_status') THEN _v_custom_status ELSE custom_status END
  WHERE id = _user_id;

  SELECT json_build_object(
    'id', u.id,
    'username', u.username,
    'display_name', u.display_name,
    'avatar_url', u.avatar_url,
    'banner_url', u.banner_url,
    'avatar_decoration', u.avatar_decoration,
    'profile_effect', u.profile_effect,
    'banner_color', u.banner_color,
    'profile_theme_primary', u.profile_theme_primary,
    'profile_theme_accent', u.profile_theme_accent,
    'bio', u.bio,
    'tagline', u.tagline,
    'status', u.status,
    'custom_status', u.custom_status,
    'created_at', u.created_at,
    'last_seen', u.last_seen,
    'pronouns', u.pronouns,
    'is_bot', u.is_bot
  )
  INTO result
  FROM public.users u
  WHERE u.id = _user_id;

  RETURN result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.update_user_profile(uuid, json) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_profile(uuid, json) TO service_role;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
