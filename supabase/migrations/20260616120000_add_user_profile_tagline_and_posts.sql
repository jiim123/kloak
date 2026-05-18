-- Full profile page: tagline and profile feed.
-- Profile posts are intentionally RPC-only. Direct REST table writes are denied by
-- RLS/no grants; exposed functions validate identity, input size, visibility, and rate.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS tagline character varying(80);

CREATE TABLE IF NOT EXISTS public.user_profile_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title text,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_profile_posts_title_not_blank CHECK (char_length(btrim(title)) > 0),
  CONSTRAINT user_profile_posts_title_length CHECK (char_length(title) <= 120),
  CONSTRAINT user_profile_posts_content_not_blank CHECK (char_length(btrim(content)) > 0),
  CONSTRAINT user_profile_posts_content_length CHECK (char_length(content) <= 1000)
);

ALTER TABLE public.user_profile_posts
  ADD COLUMN IF NOT EXISTS title text;

UPDATE public.user_profile_posts
SET title = 'Untitled'
WHERE title IS NULL OR btrim(title) = '';

ALTER TABLE public.user_profile_posts
  ALTER COLUMN title SET NOT NULL;

ALTER TABLE public.user_profile_posts
  DROP CONSTRAINT IF EXISTS user_profile_posts_title_not_blank;

ALTER TABLE public.user_profile_posts
  ADD CONSTRAINT user_profile_posts_title_not_blank CHECK (char_length(btrim(title)) > 0);

ALTER TABLE public.user_profile_posts
  DROP CONSTRAINT IF EXISTS user_profile_posts_title_length;

ALTER TABLE public.user_profile_posts
  ADD CONSTRAINT user_profile_posts_title_length CHECK (char_length(title) <= 120);

CREATE INDEX IF NOT EXISTS idx_user_profile_posts_user_created
  ON public.user_profile_posts (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.user_profile_post_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.user_profile_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_profile_post_reactions_emoji_not_blank CHECK (char_length(btrim(emoji)) > 0),
  CONSTRAINT user_profile_post_reactions_emoji_length CHECK (char_length(emoji) <= 32),
  CONSTRAINT user_profile_post_reactions_unique UNIQUE (post_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_user_profile_post_reactions_post
  ON public.user_profile_post_reactions (post_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.user_profile_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.user_profile_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_profile_post_comments_content_not_blank CHECK (char_length(btrim(content)) > 0),
  CONSTRAINT user_profile_post_comments_content_length CHECK (char_length(content) <= 500)
);

CREATE INDEX IF NOT EXISTS idx_user_profile_post_comments_post_created
  ON public.user_profile_post_comments (post_id, created_at DESC);

ALTER TABLE public.user_profile_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profile_posts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_profile_post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profile_post_reactions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_profile_post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profile_post_comments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_profile_posts_rpc_only_select" ON public.user_profile_posts;
DROP POLICY IF EXISTS "user_profile_posts_rpc_only_insert" ON public.user_profile_posts;
DROP POLICY IF EXISTS "user_profile_posts_rpc_only_update" ON public.user_profile_posts;
DROP POLICY IF EXISTS "user_profile_posts_rpc_only_delete" ON public.user_profile_posts;

CREATE POLICY "user_profile_posts_rpc_only_select"
  ON public.user_profile_posts FOR SELECT TO public
  USING (false);

CREATE POLICY "user_profile_posts_rpc_only_insert"
  ON public.user_profile_posts FOR INSERT TO public
  WITH CHECK (false);

CREATE POLICY "user_profile_posts_rpc_only_update"
  ON public.user_profile_posts FOR UPDATE TO public
  USING (false)
  WITH CHECK (false);

CREATE POLICY "user_profile_posts_rpc_only_delete"
  ON public.user_profile_posts FOR DELETE TO public
  USING (false);

DROP POLICY IF EXISTS "user_profile_post_reactions_rpc_only_select" ON public.user_profile_post_reactions;
DROP POLICY IF EXISTS "user_profile_post_reactions_rpc_only_insert" ON public.user_profile_post_reactions;
DROP POLICY IF EXISTS "user_profile_post_reactions_rpc_only_update" ON public.user_profile_post_reactions;
DROP POLICY IF EXISTS "user_profile_post_reactions_rpc_only_delete" ON public.user_profile_post_reactions;

CREATE POLICY "user_profile_post_reactions_rpc_only_select"
  ON public.user_profile_post_reactions FOR SELECT TO public
  USING (false);

CREATE POLICY "user_profile_post_reactions_rpc_only_insert"
  ON public.user_profile_post_reactions FOR INSERT TO public
  WITH CHECK (false);

CREATE POLICY "user_profile_post_reactions_rpc_only_update"
  ON public.user_profile_post_reactions FOR UPDATE TO public
  USING (false)
  WITH CHECK (false);

CREATE POLICY "user_profile_post_reactions_rpc_only_delete"
  ON public.user_profile_post_reactions FOR DELETE TO public
  USING (false);

DROP POLICY IF EXISTS "user_profile_post_comments_rpc_only_select" ON public.user_profile_post_comments;
DROP POLICY IF EXISTS "user_profile_post_comments_rpc_only_insert" ON public.user_profile_post_comments;
DROP POLICY IF EXISTS "user_profile_post_comments_rpc_only_update" ON public.user_profile_post_comments;
DROP POLICY IF EXISTS "user_profile_post_comments_rpc_only_delete" ON public.user_profile_post_comments;

CREATE POLICY "user_profile_post_comments_rpc_only_select"
  ON public.user_profile_post_comments FOR SELECT TO public
  USING (false);

CREATE POLICY "user_profile_post_comments_rpc_only_insert"
  ON public.user_profile_post_comments FOR INSERT TO public
  WITH CHECK (false);

CREATE POLICY "user_profile_post_comments_rpc_only_update"
  ON public.user_profile_post_comments FOR UPDATE TO public
  USING (false)
  WITH CHECK (false);

CREATE POLICY "user_profile_post_comments_rpc_only_delete"
  ON public.user_profile_post_comments FOR DELETE TO public
  USING (false);

REVOKE ALL ON TABLE public.user_profile_posts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_profile_posts TO service_role;
REVOKE ALL ON TABLE public.user_profile_post_reactions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_profile_post_reactions TO service_role;
REVOKE ALL ON TABLE public.user_profile_post_comments FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_profile_post_comments TO service_role;

CREATE OR REPLACE FUNCTION public.profile_post_reactions_json(_post_id uuid, _requesting_user_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'emoji', grouped.emoji,
        'count', grouped.count,
        'users', grouped.users,
        'has_reacted', grouped.has_reacted
      )
      ORDER BY grouped.count DESC, grouped.emoji
    ),
    '[]'::json
  )
  FROM (
    SELECT
      r.emoji,
      count(*)::int AS count,
      json_agg(r.user_id) AS users,
      bool_or(r.user_id = _requesting_user_id) AS has_reacted,
      min(r.created_at) AS first_reacted_at
    FROM public.user_profile_post_reactions r
    WHERE r.post_id = _post_id
    GROUP BY r.emoji
  ) grouped;
$function$;

REVOKE EXECUTE ON FUNCTION public.profile_post_reactions_json(uuid, uuid) FROM PUBLIC, anon, authenticated;

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
               custom_status, created_at, last_seen, pronouns, is_bot
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
                      'is_bot', cu.is_bot
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
              'is_bot', u.is_bot
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

DROP FUNCTION IF EXISTS public.create_profile_post(uuid, text);

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

  IF char_length(_clean_title) > 120 THEN
    RAISE EXCEPTION 'Post title must be 120 characters or fewer';
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

CREATE OR REPLACE FUNCTION public.delete_profile_post(_user_id uuid, _post_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  DELETE FROM public.user_profile_posts
  WHERE id = _post_id
    AND user_id = _user_id;

  RETURN FOUND;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.delete_profile_post(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_profile_post(uuid, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.toggle_profile_post_reaction(_post_id uuid, _user_id uuid, _emoji text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _post_owner_id uuid;
  _clean_emoji text;
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

  IF NOT public.check_rate_limit(_user_id::text, 'profile_post_reaction_toggle_burst', 30, 60) THEN
    RAISE EXCEPTION 'Rate limited: reactions are being updated too quickly';
  END IF;

  _clean_emoji := btrim(COALESCE(_emoji, ''));

  IF _clean_emoji = '' OR char_length(_clean_emoji) > 32 THEN
    RAISE EXCEPTION 'Invalid reaction';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_profile_post_reactions r
    WHERE r.post_id = _post_id
      AND r.user_id = _user_id
      AND r.emoji = _clean_emoji
  ) THEN
    DELETE FROM public.user_profile_post_reactions
    WHERE post_id = _post_id
      AND user_id = _user_id
      AND emoji = _clean_emoji;
  ELSE
    INSERT INTO public.user_profile_post_reactions (post_id, user_id, emoji)
    VALUES (_post_id, _user_id, _clean_emoji)
    ON CONFLICT (post_id, user_id, emoji) DO NOTHING;
  END IF;

  RETURN public.profile_post_reactions_json(_post_id, _user_id);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.toggle_profile_post_reaction(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_profile_post_reaction(uuid, uuid, text) TO anon, authenticated;

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

  IF char_length(_clean_content) > 500 THEN
    RAISE EXCEPTION 'Comment must be 500 characters or fewer';
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

  IF char_length(_clean_content) > 500 THEN
    RAISE EXCEPTION 'Comment must be 500 characters or fewer';
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

CREATE OR REPLACE FUNCTION public.delete_profile_post_comment(_comment_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _comment_owner_id uuid;
  _post_owner_id uuid;
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

  IF _comment_owner_id <> _user_id AND _post_owner_id <> _user_id THEN
    RAISE EXCEPTION 'Forbidden: you can only delete your own comments or comments on your posts';
  END IF;

  IF NOT public.can_view_user(_post_owner_id, _user_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  DELETE FROM public.user_profile_post_comments
  WHERE id = _comment_id;

  RETURN FOUND;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.delete_profile_post_comment(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_profile_post_comment(uuid, uuid) TO anon, authenticated;

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
