-- Phase 6E:
-- Harden legacy friend/profile RPCs that accept _user_id from clients.
-- These endpoints are still used by the app, so we enforce identity in-place.

-- -------------------------------------------------------------------
-- Friend mutation RPCs
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_friend_request(_friendship_id uuid, _user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  result json;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.friendships
    WHERE id = _friendship_id
      AND addressee_id = _user_id
      AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Cannot accept this friend request';
  END IF;

  UPDATE public.friendships
  SET status = 'accepted'
  WHERE id = _friendship_id;

  SELECT json_build_object(
    'id', f.id,
    'requester_id', f.requester_id,
    'addressee_id', f.addressee_id,
    'status', f.status,
    'created_at', f.created_at
  )
  INTO result
  FROM public.friendships f
  WHERE f.id = _friendship_id;

  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.decline_friend_request(_friendship_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.friendships
    WHERE id = _friendship_id
      AND addressee_id = _user_id
      AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Cannot decline this friend request';
  END IF;

  DELETE FROM public.friendships
  WHERE id = _friendship_id;

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.remove_friend(_friendship_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.friendships
    WHERE id = _friendship_id
      AND (requester_id = _user_id OR addressee_id = _user_id)
      AND status = 'accepted'
  ) THEN
    RAISE EXCEPTION 'Friendship not found';
  END IF;

  DELETE FROM public.friendships
  WHERE id = _friendship_id;

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.block_user(_user_id uuid, _blocked_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  existing_friendship record;
  result json;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF _user_id = _blocked_user_id THEN
    RAISE EXCEPTION 'Cannot block yourself';
  END IF;

  SELECT *
  INTO existing_friendship
  FROM public.friendships
  WHERE (requester_id = _user_id AND addressee_id = _blocked_user_id)
     OR (requester_id = _blocked_user_id AND addressee_id = _user_id);

  IF existing_friendship IS NOT NULL THEN
    UPDATE public.friendships
    SET status = 'blocked',
        requester_id = _user_id,
        addressee_id = _blocked_user_id
    WHERE id = existing_friendship.id;

    SELECT json_build_object(
      'id', f.id,
      'requester_id', f.requester_id,
      'addressee_id', f.addressee_id,
      'status', f.status,
      'created_at', f.created_at
    )
    INTO result
    FROM public.friendships f
    WHERE f.id = existing_friendship.id;
  ELSE
    INSERT INTO public.friendships (requester_id, addressee_id, status)
    VALUES (_user_id, _blocked_user_id, 'blocked')
    RETURNING json_build_object(
      'id', id,
      'requester_id', requester_id,
      'addressee_id', addressee_id,
      'status', status,
      'created_at', created_at
    )
    INTO result;
  END IF;

  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.unblock_user(_user_id uuid, _blocked_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  DELETE FROM public.friendships
  WHERE requester_id = _user_id
    AND addressee_id = _blocked_user_id
    AND status = 'blocked';

  RETURN true;
END;
$function$;

-- -------------------------------------------------------------------
-- Friend read RPCs
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_friends(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN (
    SELECT json_agg(friend)
    FROM (
      SELECT json_build_object(
        'id', f.id,
        'status', f.status,
        'created_at', f.created_at,
        'user',
          CASE
            WHEN f.requester_id = _user_id THEN (
              SELECT json_build_object(
                'id', u.id,
                'username', u.username,
                'display_name', u.display_name,
                'avatar_url', u.avatar_url,
                'banner_color', u.banner_color,
                'status', u.status,
                'custom_status', u.custom_status
              )
              FROM public.users u
              WHERE u.id = f.addressee_id
            )
            ELSE (
              SELECT json_build_object(
                'id', u.id,
                'username', u.username,
                'display_name', u.display_name,
                'avatar_url', u.avatar_url,
                'banner_color', u.banner_color,
                'status', u.status,
                'custom_status', u.custom_status
              )
              FROM public.users u
              WHERE u.id = f.requester_id
            )
          END
      ) AS friend
      FROM public.friendships f
      WHERE (f.requester_id = _user_id OR f.addressee_id = _user_id)
        AND f.status = 'accepted'
    ) sub
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_pending_friend_requests(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN (
    SELECT json_agg(request)
    FROM (
      SELECT json_build_object(
        'id', f.id,
        'status', f.status,
        'created_at', f.created_at,
        'user', (
          SELECT json_build_object(
            'id', u.id,
            'username', u.username,
            'display_name', u.display_name,
            'avatar_url', u.avatar_url,
            'banner_color', u.banner_color,
            'status', u.status
          )
          FROM public.users u
          WHERE u.id = f.requester_id
        )
      ) AS request
      FROM public.friendships f
      WHERE f.addressee_id = _user_id
        AND f.status = 'pending'
      ORDER BY f.created_at DESC
    ) sub
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_outgoing_friend_requests(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN (
    SELECT json_agg(request)
    FROM (
      SELECT json_build_object(
        'id', f.id,
        'status', f.status,
        'created_at', f.created_at,
        'user', (
          SELECT json_build_object(
            'id', u.id,
            'username', u.username,
            'display_name', u.display_name,
            'avatar_url', u.avatar_url,
            'banner_color', u.banner_color,
            'status', u.status
          )
          FROM public.users u
          WHERE u.id = f.addressee_id
        )
      ) AS request
      FROM public.friendships f
      WHERE f.requester_id = _user_id
        AND f.status = 'pending'
      ORDER BY f.created_at DESC
    ) sub
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_blocked_users(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN (
    SELECT json_agg(blocked)
    FROM (
      SELECT json_build_object(
        'id', f.id,
        'created_at', f.created_at,
        'user', (
          SELECT json_build_object(
            'id', u.id,
            'username', u.username,
            'display_name', u.display_name,
            'avatar_url', u.avatar_url,
            'banner_color', u.banner_color
          )
          FROM public.users u
          WHERE u.id = f.addressee_id
        )
      ) AS blocked
      FROM public.friendships f
      WHERE f.requester_id = _user_id
        AND f.status = 'blocked'
    ) sub
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_blocked_user_ids_for_visibility(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(x.other_user_id)
      FROM (
        SELECT DISTINCT
          CASE
            WHEN f.requester_id = _user_id THEN f.addressee_id
            ELSE f.requester_id
          END AS other_user_id
        FROM public.friendships f
        WHERE f.status = 'blocked'
          AND (f.requester_id = _user_id OR f.addressee_id = _user_id)
      ) x
    ),
    '[]'::json
  );
END;
$function$;

-- -------------------------------------------------------------------
-- Profile mutation RPC
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_user_profile(_user_id uuid, _updates json)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  result json;
  _u jsonb := _updates::jsonb;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  UPDATE public.users
  SET
    display_name = COALESCE(_updates->>'display_name', display_name),
    bio = COALESCE(_updates->>'bio', bio),
    avatar_url = COALESCE(_updates->>'avatar_url', avatar_url),
    banner_url = CASE WHEN (_u ? 'banner_url') THEN (_updates->>'banner_url') ELSE banner_url END,
    avatar_decoration = CASE WHEN (_u ? 'avatar_decoration') THEN (_updates->>'avatar_decoration') ELSE avatar_decoration END,
    profile_effect = CASE WHEN (_u ? 'profile_effect') THEN (_updates->>'profile_effect') ELSE profile_effect END,
    banner_color = COALESCE(_updates->>'banner_color', banner_color),
    profile_theme_primary = CASE WHEN (_u ? 'profile_theme_primary') THEN (_updates->>'profile_theme_primary') ELSE profile_theme_primary END,
    profile_theme_accent = CASE WHEN (_u ? 'profile_theme_accent') THEN (_updates->>'profile_theme_accent') ELSE profile_theme_accent END,
    custom_status = COALESCE(_updates->>'custom_status', custom_status)
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
    'status', u.status,
    'custom_status', u.custom_status,
    'created_at', u.created_at,
    'last_seen', u.last_seen
  )
  INTO result
  FROM public.users u
  WHERE u.id = _user_id;

  RETURN result;
END;
$function$;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
