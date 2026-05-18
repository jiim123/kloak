-- Reduce profile feed limits to match the current product requirements.

ALTER TABLE public.user_profile_posts
  DROP CONSTRAINT IF EXISTS user_profile_posts_title_length;

ALTER TABLE public.user_profile_posts
  ADD CONSTRAINT user_profile_posts_title_length CHECK (char_length(title) <= 100) NOT VALID;

ALTER TABLE public.user_profile_post_comments
  DROP CONSTRAINT IF EXISTS user_profile_post_comments_content_length;

ALTER TABLE public.user_profile_post_comments
  ADD CONSTRAINT user_profile_post_comments_content_length CHECK (char_length(content) <= 300) NOT VALID;

CREATE OR REPLACE FUNCTION public.create_profile_post(_user_id uuid, _title text, _content text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _clean_title text;
  _clean_content text;
  _post_id uuid;
  _result json;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.check_rate_limit(_user_id::text, 'profile_post_create_burst', 5, 60) THEN
    RAISE EXCEPTION 'Rate limited: profile posts are being created too quickly';
  END IF;

  IF NOT public.check_rate_limit(_user_id::text, 'profile_post_create_hourly', 30, 3600) THEN
    RAISE EXCEPTION 'Rate limited: too many profile posts';
  END IF;

  _clean_title := btrim(COALESCE(_title, ''));
  _clean_content := btrim(COALESCE(_content, ''));

  IF _clean_title = '' THEN
    RAISE EXCEPTION 'Post title cannot be empty';
  END IF;

  IF _clean_content = '' THEN
    RAISE EXCEPTION 'Post cannot be empty';
  END IF;

  IF char_length(_clean_title) > 100 THEN
    RAISE EXCEPTION 'Post title must be 100 characters or fewer';
  END IF;

  IF char_length(_clean_content) > 1000 THEN
    RAISE EXCEPTION 'Post must be 1000 characters or fewer';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_profile_posts p
    WHERE p.user_id = _user_id
      AND p.title = _clean_title
      AND p.content = _clean_content
      AND p.created_at > now() - interval '5 minutes'
  ) THEN
    RAISE EXCEPTION 'Duplicate profile post';
  END IF;

  INSERT INTO public.user_profile_posts (user_id, title, content)
  VALUES (_user_id, _clean_title, _clean_content)
  RETURNING id INTO _post_id;

  SELECT json_build_object(
    'id', p.id,
    'user_id', p.user_id,
    'title', p.title,
    'content', p.content,
    'created_at', p.created_at,
    'updated_at', p.updated_at,
    'reactions', '[]'::json,
    'comment_count', 0,
    'comments', '[]'::json,
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
      'is_bot', u.is_bot
    )
  )
  INTO _result
  FROM public.user_profile_posts p
  JOIN public.users u ON u.id = p.user_id
  WHERE p.id = _post_id;

  RETURN _result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.create_profile_post(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_profile_post(uuid, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_profile_post_comment(_post_id uuid, _user_id uuid, _content text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _post_owner_id uuid;
  _clean_content text;
  _comment_id uuid;
  _result json;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT p.user_id INTO _post_owner_id
  FROM public.user_profile_posts p
  WHERE p.id = _post_id;

  IF _post_owner_id IS NULL THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  IF NOT public.can_view_user(_post_owner_id, _user_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF NOT public.check_rate_limit(_user_id::text, 'profile_post_comment_create_burst', 8, 60) THEN
    RAISE EXCEPTION 'Rate limited: comments are being created too quickly';
  END IF;

  IF NOT public.check_rate_limit(_user_id::text, 'profile_post_comment_create_hourly', 60, 3600) THEN
    RAISE EXCEPTION 'Rate limited: too many profile comments';
  END IF;

  _clean_content := btrim(COALESCE(_content, ''));

  IF _clean_content = '' THEN
    RAISE EXCEPTION 'Comment cannot be empty';
  END IF;

  IF char_length(_clean_content) > 300 THEN
    RAISE EXCEPTION 'Comment must be 300 characters or fewer';
  END IF;

  INSERT INTO public.user_profile_post_comments (post_id, user_id, content)
  VALUES (_post_id, _user_id, _clean_content)
  RETURNING id INTO _comment_id;

  SELECT json_build_object(
    'id', c.id,
    'post_id', c.post_id,
    'user_id', c.user_id,
    'content', c.content,
    'created_at', c.created_at,
    'updated_at', c.updated_at,
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
      'is_bot', u.is_bot
    )
  )
  INTO _result
  FROM public.user_profile_post_comments c
  JOIN public.users u ON u.id = c.user_id
  WHERE c.id = _comment_id;

  RETURN _result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.create_profile_post_comment(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_profile_post_comment(uuid, uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.edit_profile_post_comment(_comment_id uuid, _user_id uuid, _content text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _comment_owner_id uuid;
  _post_owner_id uuid;
  _clean_content text;
  _result json;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT c.user_id, p.user_id
    INTO _comment_owner_id, _post_owner_id
  FROM public.user_profile_post_comments c
  JOIN public.user_profile_posts p ON p.id = c.post_id
  WHERE c.id = _comment_id;

  IF _comment_owner_id IS NULL THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;

  IF _comment_owner_id <> _user_id THEN
    RAISE EXCEPTION 'Forbidden: you can only edit your own comments';
  END IF;

  IF NOT public.can_view_user(_post_owner_id, _user_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  _clean_content := btrim(COALESCE(_content, ''));

  IF _clean_content = '' THEN
    RAISE EXCEPTION 'Comment cannot be empty';
  END IF;

  IF char_length(_clean_content) > 300 THEN
    RAISE EXCEPTION 'Comment must be 300 characters or fewer';
  END IF;

  UPDATE public.user_profile_post_comments
  SET content = _clean_content,
      updated_at = now()
  WHERE id = _comment_id;

  SELECT json_build_object(
    'id', c.id,
    'post_id', c.post_id,
    'user_id', c.user_id,
    'content', c.content,
    'created_at', c.created_at,
    'updated_at', c.updated_at
  )
  INTO _result
  FROM public.user_profile_post_comments c
  WHERE c.id = _comment_id;

  RETURN _result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.edit_profile_post_comment(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.edit_profile_post_comment(uuid, uuid, text) TO anon, authenticated;
