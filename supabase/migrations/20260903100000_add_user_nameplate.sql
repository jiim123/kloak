-- Add nameplate column to users for Prime-exclusive animated nametag backgrounds.
-- nameplate stores a plate key like 'plate1', 'plate2', etc.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS nameplate text DEFAULT NULL;

-- Lightweight RPC for updating only the nameplate field (bypasses PostgREST schema cache issues).
CREATE OR REPLACE FUNCTION public.update_user_nameplate(_user_id uuid, _nameplate text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF _nameplate IS NOT NULL AND _nameplate NOT IN ('plate1', 'plate2', 'plate3', 'plate4') THEN
    RAISE EXCEPTION 'Invalid nameplate: must be plate1, plate2, plate3, or plate4';
  END IF;

  UPDATE public.users SET nameplate = _nameplate WHERE id = _user_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.update_user_nameplate(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_nameplate(uuid, text) TO service_role;

-- Ensure verify_request_identity exists (required by update_user_profile and member RPCs).
-- This function is safe to CREATE OR REPLACE — idempotent.
CREATE OR REPLACE FUNCTION public.verify_request_identity(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  header_hash text;
  stored_hash text;
BEGIN
  BEGIN
    header_hash := current_setting('request.headers', true)::json->>'x-key-hash';
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;

  IF header_hash IS NULL OR header_hash = '' THEN
    RETURN false;
  END IF;

  SELECT ua.key_hash INTO stored_hash
  FROM public.user_auth ua
  WHERE ua.user_id = _user_id;

  IF stored_hash IS NULL THEN
    RETURN false;
  END IF;

  RETURN lower(header_hash) = lower(stored_hash);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.verify_request_identity(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_request_identity(uuid) TO service_role;

-- Update update_user_profile function to support the nameplate field.
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
  _v_nameplate text;
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
      'display_name', 'bio', 'tagline', 'avatar_url', 'banner_url',
      'avatar_decoration', 'profile_effect', 'banner_color',
      'profile_theme_primary', 'profile_theme_accent', 'custom_status',
      'nameplate'
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
  _v_nameplate := NULLIF(trim(_updates->>'nameplate'), '');

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

  -- Validate nameplate: must be one of the allowed keys or null
  IF (_u ? 'nameplate') AND _v_nameplate IS NOT NULL THEN
    IF _v_nameplate NOT IN ('plate1', 'plate2', 'plate3', 'plate4') THEN
      RAISE EXCEPTION 'Invalid nameplate: must be plate1, plate2, plate3, or plate4';
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
    custom_status = CASE WHEN (_u ? 'custom_status') THEN _v_custom_status ELSE custom_status END,
    nameplate = CASE WHEN (_u ? 'nameplate') THEN _v_nameplate ELSE nameplate END
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
    'is_bot', u.is_bot,
    'nameplate', u.nameplate
  )
  INTO result
  FROM public.users u
  WHERE u.id = _user_id;

  RETURN result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.update_user_profile(uuid, json) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_profile(uuid, json) TO service_role;

-- Update get_server_members (lite) to include nameplate in user object
CREATE OR REPLACE FUNCTION public.get_server_members(_server_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _caller uuid;
  _owner_id uuid;
  _online_cutoff timestamptz;
  _can_manage_invites boolean := false;
BEGIN
  _caller := public.requesting_user_id();
  _online_cutoff := now() - interval '5 minutes';

  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT public.is_server_member(_server_id, _caller) THEN
    RETURN '[]'::json;
  END IF;

  SELECT s.owner_id
  INTO _owner_id
  FROM public.servers s
  WHERE s.id = _server_id;

  _can_manage_invites := public.check_user_server_permission(
    _caller,
    _server_id,
    'manage_invites'
  );

  RETURN COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', sm.id,
          'server_id', sm.server_id,
          'user_id', sm.user_id,
          'role', sm.role,
          'nickname', sm.nickname,
          'is_banned', sm.is_banned,
          'is_muted', sm.is_muted,
          'joined_at', sm.joined_at,
          'join_source', sm.join_source,
          'join_invite_code',
            CASE
              WHEN _can_manage_invites THEN sm.join_invite_code
              ELSE NULL
            END,
          'user', json_build_object(
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
            'status', u.status,
            'custom_status', u.custom_status,
            'created_at', u.created_at,
            'last_seen', u.last_seen,
            'is_bot', u.is_bot,
            'nameplate', u.nameplate
          ),
          'roles', COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', sr.id,
                  'name', sr.name,
                  'color', sr.color,
                  'icon', sr.icon,
                  'position', sr.position
                )
                ORDER BY sr.position ASC
              )
              FROM public.server_member_roles smr
              JOIN public.server_roles sr
                ON sr.id = smr.role_id
              WHERE smr.member_id = sm.id
            ),
            '[]'::json
          )
        )
      )
      FROM public.server_members sm
      JOIN public.users u
        ON u.id = sm.user_id
      WHERE sm.server_id = _server_id
        AND COALESCE(sm.is_banned, false) = false
        AND (
          u.is_bot IS NOT TRUE
          OR NOT EXISTS (
            SELECT 1
            FROM public.server_bots b
            WHERE b.server_id = sm.server_id
              AND b.bot_user_id = sm.user_id
              AND b.is_enabled IS NOT TRUE
          )
        )
        AND (
          sm.user_id = _caller
          OR sm.user_id = _owner_id
          OR u.is_bot = true
          OR (
            (
              u.last_seen IS NOT NULL
              AND u.last_seen >= _online_cutoff
            )
            OR (
              u.last_seen IS NULL
              AND COALESCE(u.status::text, 'offline') <> 'offline'
            )
          )
        )
    ),
    '[]'::json
  );
END;
$function$;

-- Update get_server_members_full_secure to include nameplate in user object
CREATE OR REPLACE FUNCTION public.get_server_members_full_secure(
  _server_id uuid,
  _user_id uuid
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _can_manage_invites boolean := false;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.is_server_member(_server_id, _user_id) THEN
    RETURN '[]'::json;
  END IF;

  _can_manage_invites := public.check_user_server_permission(_user_id, _server_id, 'manage_invites');

  RETURN COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', sm.id,
          'server_id', sm.server_id,
          'user_id', sm.user_id,
          'role', sm.role,
          'nickname', sm.nickname,
          'is_banned', sm.is_banned,
          'is_muted', sm.is_muted,
          'joined_at', sm.joined_at,
          'join_source', sm.join_source,
          'join_invite_code', CASE WHEN _can_manage_invites THEN sm.join_invite_code ELSE NULL END,
          'user', json_build_object(
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
            'status', u.status,
            'custom_status', u.custom_status,
            'created_at', u.created_at,
            'last_seen', u.last_seen,
            'is_bot', u.is_bot,
            'nameplate', u.nameplate
          ),
          'roles', COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', sr.id,
                  'name', sr.name,
                  'color', sr.color,
                  'position', sr.position
                )
                ORDER BY sr.position ASC
              )
              FROM public.server_member_roles smr
              JOIN public.server_roles sr ON sr.id = smr.role_id
              WHERE smr.member_id = sm.id
            ),
            '[]'::json
          )
        )
      )
      FROM public.server_members sm
      JOIN public.users u ON u.id = sm.user_id
      WHERE sm.server_id = _server_id
        AND (
          u.is_bot IS NOT TRUE
          OR NOT EXISTS (
            SELECT 1
            FROM public.server_bots b
            WHERE b.server_id = sm.server_id
              AND b.bot_user_id = sm.user_id
              AND b.is_enabled IS NOT TRUE
          )
        )
    ),
    '[]'::json
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_server_members_full_secure(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_server_members_full_secure(uuid, uuid) TO anon, authenticated;

-- Update get_server_members_offline_page_secure to include nameplate in user object
CREATE OR REPLACE FUNCTION public.get_server_members_offline_page_secure(
  _server_id uuid,
  _user_id uuid,
  _limit integer DEFAULT 100,
  _cursor_joined_at timestamptz DEFAULT NULL,
  _cursor_member_id uuid DEFAULT NULL,
  _include_count boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _safe_limit integer;
  _online_cutoff timestamptz;
  _offline_count integer := NULL;
  _members json := '[]'::json;
  _has_more boolean := false;
  _next_cursor_joined_at timestamptz := NULL;
  _next_cursor_member_id uuid := NULL;
  _can_manage_invites boolean := false;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.is_server_member(_server_id, _user_id) THEN
    RETURN json_build_object(
      'members', '[]'::json,
      'has_more', false,
      'next_cursor_joined_at', NULL,
      'next_cursor_member_id', NULL,
      'offline_count', 0
    );
  END IF;

  _can_manage_invites := public.check_user_server_permission(_user_id, _server_id, 'manage_invites');
  _safe_limit := LEAST(GREATEST(COALESCE(_limit, 100), 1), 200);
  _online_cutoff := now() - interval '5 minutes';

  WITH offline_base AS (
    SELECT
      sm.id,
      sm.server_id,
      sm.user_id,
      sm.role,
      sm.nickname,
      sm.is_banned,
      sm.is_muted,
      sm.joined_at,
      sm.join_source,
      sm.join_invite_code,
      u.id AS user_public_id,
      u.username,
      u.display_name,
      u.avatar_url,
      u.banner_url,
      u.avatar_decoration,
      u.profile_effect,
      u.banner_color,
      u.profile_theme_primary,
      u.profile_theme_accent,
      u.bio,
      u.status,
      u.custom_status,
      u.created_at AS user_created_at,
      u.last_seen,
      u.is_bot,
      u.nameplate
    FROM public.server_members sm
    JOIN public.users u ON u.id = sm.user_id
    WHERE sm.server_id = _server_id
      AND COALESCE(sm.is_banned, false) = false
      AND (
        u.is_bot IS NOT TRUE
        OR NOT EXISTS (
          SELECT 1
          FROM public.server_bots b
          WHERE b.server_id = sm.server_id
            AND b.bot_user_id = sm.user_id
            AND b.is_enabled IS NOT TRUE
        )
      )
      AND (
        (u.last_seen IS NOT NULL AND u.last_seen < _online_cutoff)
        OR (u.last_seen IS NULL AND COALESCE(u.status::text, 'offline') = 'offline')
      )
  ),
  offline_total AS (
    SELECT CASE WHEN _include_count THEN count(*)::integer ELSE NULL::integer END AS offline_count
    FROM offline_base
  ),
  page_source AS (
    SELECT *
    FROM offline_base b
    WHERE (
      _cursor_joined_at IS NULL
      OR (b.joined_at, b.id) < (
        _cursor_joined_at,
        COALESCE(_cursor_member_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)
      )
    )
    ORDER BY b.joined_at DESC, b.id DESC
    LIMIT (_safe_limit + 1)
  ),
  page_rows AS (
    SELECT *
    FROM page_source
    ORDER BY joined_at DESC, id DESC
    LIMIT _safe_limit
  ),
  page_json AS (
    SELECT COALESCE(
      json_agg(
        json_build_object(
          'id', pr.id,
          'server_id', pr.server_id,
          'user_id', pr.user_id,
          'role', pr.role,
          'nickname', pr.nickname,
          'is_banned', pr.is_banned,
          'is_muted', pr.is_muted,
          'joined_at', pr.joined_at,
          'join_source', pr.join_source,
          'join_invite_code', CASE WHEN _can_manage_invites THEN pr.join_invite_code ELSE NULL END,
          'user', json_build_object(
            'id', pr.user_public_id,
            'username', pr.username,
            'display_name', pr.display_name,
            'avatar_url', pr.avatar_url,
            'banner_url', pr.banner_url,
            'avatar_decoration', pr.avatar_decoration,
            'profile_effect', pr.profile_effect,
            'banner_color', pr.banner_color,
            'profile_theme_primary', pr.profile_theme_primary,
            'profile_theme_accent', pr.profile_theme_accent,
            'bio', pr.bio,
            'status', pr.status,
            'custom_status', pr.custom_status,
            'created_at', pr.user_created_at,
            'last_seen', pr.last_seen,
            'is_bot', pr.is_bot,
            'nameplate', pr.nameplate
          ),
          'roles', COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', sr.id,
                  'name', sr.name,
                  'color', sr.color,
                  'icon', sr.icon,
                  'position', sr.position
                )
                ORDER BY sr.position ASC
              )
              FROM public.server_member_roles smr
              JOIN public.server_roles sr ON sr.id = smr.role_id
              WHERE smr.member_id = pr.id
            ),
            '[]'::json
          )
        )
      ),
      '[]'::json
    ) AS members
    FROM page_rows pr
  ),
  cursor_row AS (
    SELECT joined_at, id
    FROM page_rows
    ORDER BY joined_at ASC, id ASC
    LIMIT 1
  )
  SELECT
    pj.members,
    EXISTS(SELECT 1 FROM page_source OFFSET _safe_limit),
    cr.joined_at,
    cr.id,
    ot.offline_count
  INTO _members, _has_more, _next_cursor_joined_at, _next_cursor_member_id, _offline_count
  FROM page_json pj
  CROSS JOIN offline_total ot
  LEFT JOIN cursor_row cr ON true;

  RETURN json_build_object(
    'members', COALESCE(_members, '[]'::json),
    'has_more', COALESCE(_has_more, false),
    'next_cursor_joined_at', _next_cursor_joined_at,
    'next_cursor_member_id', _next_cursor_member_id,
    'offline_count', _offline_count
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_server_members_offline_page_secure(uuid, uuid, integer, timestamptz, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_server_members_offline_page_secure(uuid, uuid, integer, timestamptz, uuid, boolean) TO anon, authenticated;
