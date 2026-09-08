-- Kloak Prime: Display Name Style
-- Adds users.name_style (jsonb: { font, effect, color }) and exposes it through
-- the profile update path and all user read surfaces so styles render everywhere.

-- 1. Column -----------------------------------------------------------------

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS name_style jsonb DEFAULT NULL;

COMMENT ON COLUMN public.users.name_style IS 'Prime display name style: { font, effect, color } or NULL.';

-- 2. Validation helper -------------------------------------------------------

CREATE OR REPLACE FUNCTION public.name_style_is_valid(_style jsonb)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  _key text;
  _value jsonb;
BEGIN
  IF _style IS NULL THEN
    RETURN true;
  END IF;
  IF jsonb_typeof(_style) <> 'object' THEN
    RETURN false;
  END IF;
  IF _style = '{}'::jsonb THEN
    RETURN true;
  END IF;

  FOR _key, _value IN SELECT * FROM jsonb_each(_style)
  LOOP
    IF _key NOT IN ('font', 'effect', 'color') THEN
      RETURN false;
    END IF;
    IF jsonb_typeof(_value) <> 'string' THEN
      RETURN false;
    END IF;

    IF _key = 'font' AND (_value #>> '{}') NOT IN (
      'default', 'bold', 'italic', 'script', 'boldScript', 'fraktur',
      'doubleStruck', 'sans', 'sansBold', 'mono', 'fullwidth', 'smallCaps'
    ) THEN
      RETURN false;
    END IF;

    IF _key = 'effect' AND (_value #>> '{}') NOT IN (
      'solid', 'gradient', 'neon', 'toon', 'pop', 'gummy', 'prism'
    ) THEN
      RETURN false;
    END IF;

    IF _key = 'color' AND (_value #>> '{}') !~ '^#[0-9A-Fa-f]{6}$' THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$function$;

-- 3. Lightweight write RPC (mirrors update_user_nameplate) --------------------

CREATE OR REPLACE FUNCTION public.update_user_name_style(_user_id uuid, _name_style jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _style jsonb;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.name_style_is_valid(_name_style) THEN
    RAISE EXCEPTION 'Invalid name style payload';
  END IF;

  -- Normalize: empty objects are stored as NULL
  IF _name_style IS NULL OR jsonb_typeof(_name_style) <> 'object' OR _name_style = '{}'::jsonb THEN
    _style := NULL;
  ELSE
    _style := _name_style;
  END IF;

  UPDATE public.users SET name_style = _style WHERE id = _user_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.update_user_name_style(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_name_style(uuid, jsonb) TO service_role;

-- 4. update_user_profile: accept + validate name_style -------------------------

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
  _v_name_style jsonb;
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
      'nameplate', 'name_style'
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
    IF _v_nameplate NOT IN ('plate1', 'plate2', 'plate3', 'plate4', 'plate5') THEN
      RAISE EXCEPTION 'Invalid nameplate: must be plate1, plate2, plate3, plate4, or plate5';
    END IF;
  END IF;

  -- Validate name_style: structural + value validation, empty object -> NULL
  IF (_u ? 'name_style') THEN
    IF NOT public.name_style_is_valid(_u->'name_style') THEN
      RAISE EXCEPTION 'Invalid name style payload';
    END IF;
    IF jsonb_typeof(_u->'name_style') = 'object' AND (_u->'name_style') <> '{}'::jsonb THEN
      _v_name_style := _u->'name_style';
    ELSE
      _v_name_style := NULL;
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
    nameplate = CASE WHEN (_u ? 'nameplate') THEN _v_nameplate ELSE nameplate END,
    name_style = CASE WHEN (_u ? 'name_style') THEN _v_name_style ELSE name_style END
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
    'nameplate', u.nameplate,
    'name_style', u.name_style
  )
  INTO result
  FROM public.users u
  WHERE u.id = _user_id;

  RETURN result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.update_user_profile(uuid, json) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_profile(uuid, json) TO service_role;

-- 5. get_user_by_id: include name_style ---------------------------------------

CREATE OR REPLACE FUNCTION public.get_user_by_id(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _caller uuid;
BEGIN
  _caller := public.requesting_user_id();
  IF _caller IS NULL OR NOT public.verify_request_identity(_caller) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.can_view_user(_user_id, _caller) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN (
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
      'status', u.status,
      'custom_status', u.custom_status,
      'created_at', u.created_at,
      'last_seen', u.last_seen,
      'is_bot', u.is_bot,
      'name_style', u.name_style
    )
    FROM public.users u
    WHERE u.id = _user_id
  );
END;
$function$;

-- 6. users_public view: include name_style ------------------------------------

CREATE OR REPLACE VIEW public.users_public
WITH (security_invoker = 'true') AS
SELECT
  id,
  username,
  display_name,
  avatar_url,
  banner_color,
  bio,
  status,
  custom_status,
  created_at,
  avatar_decoration,
  profile_theme_primary,
  profile_theme_accent,
  banner_url,
  profile_effect,
  pronouns,
  CASE
    WHEN (id = (SELECT public.requesting_user_id() AS requesting_user_id)) THEN last_seen
    ELSE NULL::timestamp with time zone
  END AS last_seen,
  is_bot,
  name_style
FROM public.users;

-- 7. DM conversations: include name_style on participants ---------------------

CREATE OR REPLACE FUNCTION public.get_user_dm_conversations(_user_id uuid)
RETURNS TABLE(conversation json, participants json, last_message json)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN QUERY
  SELECT
    json_build_object(
      'id', c.id,
      'created_at', c.created_at,
      'is_group', c.is_group,
      'name', c.name,
      'created_by', c.created_by
    ) as conversation,
    (
      SELECT json_agg(
        json_build_object(
          'user_id', dp2.user_id,
          'user', json_build_object(
            'id', u.id,
            'username', u.username,
            'display_name', u.display_name,
            'avatar_url', u.avatar_url,
            'avatar_decoration', u.avatar_decoration,
            'status', u.status,
            'custom_status', u.custom_status,
            'banner_color', u.banner_color,
            'nameplate', u.nameplate,
            'name_style', u.name_style,
            'last_seen', CASE WHEN u.id = _user_id THEN u.last_seen ELSE NULL END
          )
        )
      )
      FROM dm_participants dp2
      JOIN users u ON u.id = dp2.user_id
      WHERE dp2.conversation_id = c.id
    ) as participants,
    (
      SELECT json_build_object(
        'id', dm.id,
        'content', dm.content,
        'created_at', dm.created_at,
        'sender_id', dm.sender_id
      )
      FROM direct_messages dm
      WHERE dm.conversation_id = c.id
      ORDER BY dm.created_at DESC
      LIMIT 1
    ) as last_message
  FROM dm_conversations c
  JOIN dm_participants dp ON dp.conversation_id = c.id
  WHERE dp.user_id = _user_id
  ORDER BY (
    SELECT MAX(dm.created_at)
    FROM direct_messages dm
    WHERE dm.conversation_id = c.id
  ) DESC NULLS LAST;
END;
$$;

-- 8. Friend dashboard: include name_style on user objects ----------------------

CREATE OR REPLACE FUNCTION public.get_friend_dashboard(_user_id uuid)
RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  _friends json;
  _pending json;
  _outgoing json;
  _blocked json;
  _visibility_blocked json;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  -- Friends (accepted)
  SELECT json_agg(friend) INTO _friends
  FROM (
    SELECT json_build_object(
      'id', f.id,
      'status', f.status,
      'created_at', f.created_at,
      'user', CASE
        WHEN f.requester_id = _user_id THEN (SELECT json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'banner_color', u.banner_color, 'status', u.status, 'custom_status', u.custom_status, 'nameplate', u.nameplate, 'name_style', u.name_style) FROM users u WHERE u.id = f.addressee_id)
        ELSE (SELECT json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'banner_color', u.banner_color, 'status', u.status, 'custom_status', u.custom_status, 'nameplate', u.nameplate, 'name_style', u.name_style) FROM users u WHERE u.id = f.requester_id)
      END
    ) AS friend
    FROM friendships f
    WHERE (f.requester_id = _user_id OR f.addressee_id = _user_id) AND f.status = 'accepted'
  ) sub;

  -- Pending (incoming)
  SELECT json_agg(request) INTO _pending
  FROM (
    SELECT json_build_object(
      'id', f.id,
      'status', f.status,
      'created_at', f.created_at,
      'user', (SELECT json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'banner_color', u.banner_color, 'status', u.status, 'nameplate', u.nameplate, 'name_style', u.name_style) FROM users u WHERE u.id = f.requester_id)
    ) AS request
    FROM friendships f
    WHERE f.addressee_id = _user_id AND f.status = 'pending'
    ORDER BY f.created_at DESC
  ) sub;

  -- Outgoing
  SELECT json_agg(request) INTO _outgoing
  FROM (
    SELECT json_build_object(
      'id', f.id,
      'status', f.status,
      'created_at', f.created_at,
      'user', (SELECT json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'banner_color', u.banner_color, 'status', u.status, 'nameplate', u.nameplate, 'name_style', u.name_style) FROM users u WHERE u.id = f.addressee_id)
    ) AS request
    FROM friendships f
    WHERE f.requester_id = _user_id AND f.status = 'pending'
    ORDER BY f.created_at DESC
  ) sub;

  -- Blocked
  SELECT json_agg(blocked) INTO _blocked
  FROM (
    SELECT json_build_object(
      'id', f.id,
      'created_at', f.created_at,
      'user', (SELECT json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'banner_color', u.banner_color, 'name_style', u.name_style) FROM users u WHERE u.id = f.addressee_id)
    ) AS blocked
    FROM friendships f
    WHERE f.requester_id = _user_id AND f.status = 'blocked'
  ) sub;

  -- Visibility blocked IDs
  SELECT COALESCE(json_agg(x.other_user_id), '[]'::json) INTO _visibility_blocked
  FROM (
    SELECT DISTINCT CASE WHEN f.requester_id = _user_id THEN f.addressee_id ELSE f.requester_id END AS other_user_id
    FROM friendships f
    WHERE f.status = 'blocked' AND (f.requester_id = _user_id OR f.addressee_id = _user_id)
  ) x;

  RETURN json_build_object(
    'friends', COALESCE(_friends, '[]'::json),
    'pending_requests', COALESCE(_pending, '[]'::json),
    'outgoing_requests', COALESCE(_outgoing, '[]'::json),
    'blocked_users', COALESCE(_blocked, '[]'::json),
    'visibility_blocked_user_ids', COALESCE(_visibility_blocked, '[]'::json)
  );
END;
$$;

-- 9. profile RPC: include name_style on the profile user + post authors --------

CREATE OR REPLACE FUNCTION public.profile(
  _target_user_id uuid,
  _requesting_user_id uuid,
  _server_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _shared_server_ids json := '[]'::json;
BEGIN
  IF NOT public.verify_request_identity(_requesting_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.can_view_user(_target_user_id, _requesting_user_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF COALESCE(array_length(_server_ids, 1), 0) > 0 THEN
    SELECT COALESCE(json_agg(sm.server_id), '[]'::json)
      INTO _shared_server_ids
    FROM public.server_members sm
    WHERE sm.user_id = _target_user_id
      AND sm.server_id = ANY(_server_ids)
      AND COALESCE(sm.is_banned, false) = false;
  END IF;

  RETURN json_build_object(
    'user', (
      SELECT row_to_json(u)
      FROM (
        SELECT id, username, display_name, avatar_url, banner_url, avatar_decoration, profile_effect,
               banner_color, profile_theme_primary, profile_theme_accent, bio, tagline, status,
               custom_status, created_at, last_seen, pronouns, is_bot, name_style
        FROM public.users
        WHERE id = _target_user_id
        LIMIT 1
      ) u
    ),
    'badges', COALESCE(
      (
        SELECT json_agg(
          json_build_object(
            'id', b.id,
            'name', b.name,
            'icon_url', b.icon_url,
            'description', b.description
          )
        )
        FROM public.user_badges ub
        JOIN public.badges b ON b.id = ub.badge_id
        WHERE ub.user_id = _target_user_id
      ),
      '[]'::json
    ),
    'posts', COALESCE(
      (
        SELECT json_agg(
          json_build_object(
            'id', p.id,
            'user_id', p.user_id,
            'title', p.title,
            'content', p.content,
            'created_at', p.created_at,
            'updated_at', p.updated_at,
            'reactions', public.profile_post_reactions_json(p.id, _requesting_user_id),
            'comment_count', (
              SELECT count(*)::int
              FROM public.user_profile_post_comments pc
              WHERE pc.post_id = p.id
            ),
            'comments', COALESCE(
              (
                SELECT json_agg(
                  json_build_object(
                    'id', c.id,
                    'post_id', c.post_id,
                    'user_id', c.user_id,
                    'content', c.content,
                    'created_at', c.created_at,
                    'updated_at', c.updated_at,
                    'user', json_build_object(
                      'id', cu.id,
                      'username', cu.username,
                      'display_name', cu.display_name,
                      'avatar_url', cu.avatar_url,
                      'banner_url', cu.banner_url,
                      'avatar_decoration', cu.avatar_decoration,
                      'profile_effect', cu.profile_effect,
                      'banner_color', cu.banner_color,
                      'profile_theme_primary', cu.profile_theme_primary,
                      'profile_theme_accent', cu.profile_theme_accent,
                      'bio', cu.bio,
                      'tagline', cu.tagline,
                      'status', cu.status,
                      'custom_status', cu.custom_status,
                      'created_at', cu.created_at,
                      'last_seen', cu.last_seen,
                      'pronouns', cu.pronouns,
                      'is_bot', cu.is_bot,
                      'name_style', cu.name_style
                    )
                  )
                  ORDER BY c.created_at ASC
                )
                FROM (
                  SELECT *
                  FROM public.user_profile_post_comments
                  WHERE post_id = p.id
                  ORDER BY created_at DESC
                  LIMIT 5
                ) c
                JOIN public.users cu ON cu.id = c.user_id
              ),
              '[]'::json
            ),
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
              'tagline', u.tagline,
              'status', u.status,
              'custom_status', u.custom_status,
              'created_at', u.created_at,
              'last_seen', u.last_seen,
              'pronouns', u.pronouns,
              'is_bot', u.is_bot,
              'name_style', u.name_style
            )
          )
          ORDER BY p.created_at DESC
        )
        FROM (
          SELECT *
          FROM public.user_profile_posts
          WHERE user_id = _target_user_id
          ORDER BY created_at DESC
          LIMIT 20
        ) p
        JOIN public.users u ON u.id = p.user_id
      ),
      '[]'::json
    ),
    'shared_server_ids', _shared_server_ids,
    'aura_summary', public.achievement_summary_for_user(_target_user_id),
    'declined_at', (
      SELECT dfr.declined_at
      FROM public.declined_friend_requests dfr
      WHERE dfr.requester_id = _requesting_user_id
        AND dfr.addressee_id = _target_user_id
      ORDER BY dfr.declined_at DESC
      LIMIT 1
    )
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.profile(uuid, uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile(uuid, uuid, uuid[]) TO anon, authenticated;
