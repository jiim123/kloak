-- Achievement system and Aura profile level.
-- Achievements are awarded from trusted database-side events. Client-callable
-- functions either read progress or record a deduped/rate-limited profile view.

CREATE TABLE IF NOT EXISTS public.achievement_definitions (
  slug text PRIMARY KEY,
  category text NOT NULL,
  tier text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  hint text,
  trigger_name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT achievement_definitions_tier_check CHECK (tier IN ('bronze', 'silver', 'gold', 'diamond'))
);

CREATE TABLE IF NOT EXISTS public.user_achievements (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  achievement_slug text NOT NULL REFERENCES public.achievement_definitions(slug) ON DELETE CASCADE,
  completed_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (user_id, achievement_slug)
);

CREATE TABLE IF NOT EXISTS public.user_profile_view_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  viewer_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  viewed_on date NOT NULL DEFAULT current_date,
  viewed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_profile_view_events_not_self CHECK (target_user_id <> viewer_user_id),
  CONSTRAINT user_profile_view_events_unique_daily UNIQUE (target_user_id, viewer_user_id, viewed_on)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user_completed
  ON public.user_achievements (user_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_profile_view_events_target
  ON public.user_profile_view_events (target_user_id, viewed_at DESC);

ALTER TABLE public.achievement_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievement_definitions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_profile_view_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profile_view_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "achievement_definitions_rpc_only_select" ON public.achievement_definitions;
CREATE POLICY "achievement_definitions_rpc_only_select"
  ON public.achievement_definitions FOR SELECT TO public
  USING (false);

DROP POLICY IF EXISTS "user_achievements_rpc_only_select" ON public.user_achievements;
CREATE POLICY "user_achievements_rpc_only_select"
  ON public.user_achievements FOR SELECT TO public
  USING (false);

DROP POLICY IF EXISTS "user_profile_view_events_rpc_only_select" ON public.user_profile_view_events;
CREATE POLICY "user_profile_view_events_rpc_only_select"
  ON public.user_profile_view_events FOR SELECT TO public
  USING (false);

REVOKE ALL ON TABLE public.achievement_definitions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.user_achievements FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.user_profile_view_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.achievement_definitions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_achievements TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_profile_view_events TO service_role;

INSERT INTO public.achievement_definitions (slug, category, tier, name, description, hint, trigger_name, sort_order)
VALUES
  ('profile_complete', 'profile', 'bronze', 'First impression', 'Complete all fields in your profile', 'Fill out all fields in your profile', 'on_profile_update', 10),
  ('avatar_set', 'profile', 'bronze', 'Face Revealed', 'Add a profile photo', 'Customize your avatar', 'on_avatar_upload', 20),
  ('bio_written', 'profile', 'bronze', 'Who are you?', 'Write your bio', 'Tell us about yourself in your bio', 'on_bio_update', 30),
  ('profile_visited_50', 'profile', 'silver', 'Rising Influencer', 'Your profile has been viewed 50 times', 'Stay active to attract visitors', 'on_profile_view_count', 40),
  ('profile_visited_500', 'profile', 'gold', 'Public figure', 'Your profile has been viewed 500 times', NULL, 'on_profile_view_count', 50),
  ('first_msg', 'content', 'bronze', 'First Message', 'Send your first message', 'Go ahead and share something', 'on_post_created', 110),
  ('msg_10', 'content', 'bronze', 'On Your Way', 'Send 10 messages', 'Keep sharing', 'on_post_created', 120),
  ('msg_50', 'content', 'silver', 'Active Creator', 'Send 50 messages', 'Consistency pays off', 'on_post_created', 130),
  ('msg_100', 'content', 'gold', 'Centennial', 'Send 100 messages', NULL, 'on_post_created', 140),
  ('msg_500', 'content', 'diamond', 'Content Legend', 'Send 500 messages', NULL, 'on_post_created', 150),
  ('viral_msg', 'content', 'gold', 'Blockbuster', 'One of your messages gets over 100 reactions', NULL, 'on_reaction_count', 160),
  ('first_profile_comment', 'content', 'bronze', 'First Profile Comment', 'Leave your first comment on a profile post', 'Start a conversation', 'on_comment_created', 170),
  ('comments_50', 'content', 'silver', 'Engager', 'Post 50 comments', NULL, 'on_comment_created', 180),
  ('media_post', 'content', 'bronze', 'Showstopper', 'Post content with an image or video in a Media channel', 'Enrich your posts with media', 'on_post_created', 190),
  ('thread_starter', 'content', 'silver', 'Thread Starter', 'Start a forum thread that generates 10+ replies', NULL, 'on_thread_reply_count', 200)
ON CONFLICT (slug) DO UPDATE
SET category = EXCLUDED.category,
    tier = EXCLUDED.tier,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    hint = EXCLUDED.hint,
    trigger_name = EXCLUDED.trigger_name,
    sort_order = EXCLUDED.sort_order,
    is_active = true;

CREATE OR REPLACE FUNCTION public.award_achievement(
  _user_id uuid,
  _slug text,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _row_count integer := 0;
BEGIN
  IF _user_id IS NULL OR _slug IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_achievements (user_id, achievement_slug, metadata)
  SELECT _user_id, _slug, COALESCE(_metadata, '{}'::jsonb)
  WHERE EXISTS (
    SELECT 1
    FROM public.achievement_definitions ad
    WHERE ad.slug = _slug
      AND ad.is_active = true
  )
  ON CONFLICT (user_id, achievement_slug) DO NOTHING;

  GET DIAGNOSTICS _row_count = ROW_COUNT;
  RETURN _row_count > 0;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.award_achievement(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_aura_level(_completed_count integer, _total_count integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH stats AS (
    SELECT
      GREATEST(COALESCE(_completed_count, 0), 0) AS completed_count,
      GREATEST(COALESCE(_total_count, 0), 0) AS total_count
  ),
  scored AS (
    SELECT
      completed_count,
      total_count,
      CASE
        WHEN total_count <= 0 THEN 0
        ELSE LEAST(100, FLOOR((completed_count::numeric / total_count::numeric) * 100))::int
      END AS completion_percent
    FROM stats
  )
  SELECT jsonb_build_object(
    'label',
      CASE
        WHEN total_count <= 0 OR completed_count <= 0 THEN 'No Aura'
        WHEN completion_percent >= 100 THEN 'Complete Aura'
        WHEN completion_percent >= 91 THEN 'Legend Aura'
        WHEN completion_percent >= 76 THEN 'Elite Aura'
        WHEN completion_percent >= 61 THEN 'Peak Aura'
        WHEN completion_percent >= 46 THEN 'High Aura'
        WHEN completion_percent >= 31 THEN 'Strong Aura'
        WHEN completion_percent >= 16 THEN 'Steady Aura'
        WHEN completion_percent >= 6 THEN 'Rising Aura'
        ELSE 'New Aura'
      END,
    'rank',
      CASE
        WHEN total_count <= 0 OR completed_count <= 0 THEN 0
        WHEN completion_percent >= 100 THEN 9
        WHEN completion_percent >= 91 THEN 8
        WHEN completion_percent >= 76 THEN 7
        WHEN completion_percent >= 61 THEN 6
        WHEN completion_percent >= 46 THEN 5
        WHEN completion_percent >= 31 THEN 4
        WHEN completion_percent >= 16 THEN 3
        WHEN completion_percent >= 6 THEN 2
        ELSE 1
      END,
    'completed_count', completed_count,
    'total_count', total_count,
    'completion_percent', completion_percent
  )
  FROM scored;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_aura_level(integer, integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.achievement_summary_for_user(_target_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH counts AS (
    SELECT
      (SELECT count(*)::int FROM public.achievement_definitions WHERE is_active = true) AS total_count,
      (
        SELECT count(*)::int
        FROM public.user_achievements ua
        JOIN public.achievement_definitions ad ON ad.slug = ua.achievement_slug
        WHERE ua.user_id = _target_user_id
          AND ad.is_active = true
      ) AS completed_count
  )
  SELECT public.get_aura_level(completed_count, total_count)
  FROM counts;
$function$;

REVOKE EXECUTE ON FUNCTION public.achievement_summary_for_user(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_user_achievement_summary(
  _target_user_id uuid,
  _requesting_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT public.verify_request_identity(_requesting_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.can_view_user(_target_user_id, _requesting_user_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF NOT public.check_rate_limit(_requesting_user_id::text, 'achievement_summary_read_burst', 120, 60) THEN
    RAISE EXCEPTION 'Rate limited: achievement summaries are being read too quickly';
  END IF;

  RETURN public.achievement_summary_for_user(_target_user_id);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_user_achievement_summary(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_achievement_summary(uuid, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_achievements(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _completed_count integer;
  _total_count integer;
  _items jsonb;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.check_rate_limit(_user_id::text, 'my_achievements_read_burst', 60, 60) THEN
    RAISE EXCEPTION 'Rate limited: achievements are being read too quickly';
  END IF;

  SELECT count(*)::int INTO _total_count
  FROM public.achievement_definitions
  WHERE is_active = true;

  SELECT count(*)::int INTO _completed_count
  FROM public.user_achievements ua
  JOIN public.achievement_definitions ad ON ad.slug = ua.achievement_slug
  WHERE ua.user_id = _user_id
    AND ad.is_active = true;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'slug', ad.slug,
        'category', ad.category,
        'tier', ad.tier,
        'name', ad.name,
        'description', ad.description,
        'hint', ad.hint,
        'trigger_name', ad.trigger_name,
        'sort_order', ad.sort_order,
        'completed_at', ua.completed_at,
        'metadata', COALESCE(ua.metadata, '{}'::jsonb),
        'is_completed', ua.completed_at IS NOT NULL
      )
      ORDER BY ad.category, ad.sort_order
    ),
    '[]'::jsonb
  )
  INTO _items
  FROM public.achievement_definitions ad
  LEFT JOIN public.user_achievements ua
    ON ua.achievement_slug = ad.slug
   AND ua.user_id = _user_id
  WHERE ad.is_active = true;

  RETURN jsonb_build_object(
    'summary', public.get_aura_level(_completed_count, _total_count),
    'achievements', _items
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_my_achievements(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_achievements(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_profile_view(
  _target_user_id uuid,
  _viewer_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _row_count integer := 0;
  _view_count integer := 0;
BEGIN
  IF NOT public.verify_request_identity(_viewer_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF _target_user_id = _viewer_user_id THEN
    RETURN jsonb_build_object('recorded', false, 'view_count', 0);
  END IF;

  IF NOT public.can_view_user(_target_user_id, _viewer_user_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF NOT public.check_rate_limit(_viewer_user_id::text, 'profile_view_record_burst', 20, 60) THEN
    RAISE EXCEPTION 'Rate limited: profile views are being recorded too quickly';
  END IF;

  IF NOT public.check_rate_limit(_viewer_user_id::text, 'profile_view_record_hourly', 200, 3600) THEN
    RAISE EXCEPTION 'Rate limited: too many profile views';
  END IF;

  INSERT INTO public.user_profile_view_events (target_user_id, viewer_user_id)
  VALUES (_target_user_id, _viewer_user_id)
  ON CONFLICT (target_user_id, viewer_user_id, viewed_on) DO NOTHING;

  GET DIAGNOSTICS _row_count = ROW_COUNT;

  SELECT count(*)::int INTO _view_count
  FROM public.user_profile_view_events
  WHERE target_user_id = _target_user_id;

  IF _view_count >= 50 THEN
    PERFORM public.award_achievement(_target_user_id, 'profile_visited_50', jsonb_build_object('view_count', _view_count));
  END IF;

  IF _view_count >= 500 THEN
    PERFORM public.award_achievement(_target_user_id, 'profile_visited_500', jsonb_build_object('view_count', _view_count));
  END IF;

  RETURN jsonb_build_object('recorded', _row_count > 0, 'view_count', _view_count);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.record_profile_view(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_profile_view(uuid, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_profile_achievements(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _u record;
BEGIN
  SELECT display_name, bio, avatar_url, banner_url
    INTO _u
  FROM public.users
  WHERE id = _user_id;

  IF _u IS NULL THEN
    RETURN;
  END IF;

  IF NULLIF(btrim(COALESCE(_u.avatar_url, '')), '') IS NOT NULL THEN
    PERFORM public.award_achievement(_user_id, 'avatar_set');
  END IF;

  IF NULLIF(btrim(COALESCE(_u.bio, '')), '') IS NOT NULL THEN
    PERFORM public.award_achievement(_user_id, 'bio_written');
  END IF;

  IF NULLIF(btrim(COALESCE(_u.display_name, '')), '') IS NOT NULL
     AND NULLIF(btrim(COALESCE(_u.bio, '')), '') IS NOT NULL
     AND NULLIF(btrim(COALESCE(_u.avatar_url, '')), '') IS NOT NULL
     AND NULLIF(btrim(COALESCE(_u.banner_url, '')), '') IS NOT NULL THEN
    PERFORM public.award_achievement(_user_id, 'profile_complete');
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.check_profile_achievements(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trigger_check_profile_achievements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  BEGIN
    PERFORM public.check_profile_achievements(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.trigger_check_profile_achievements() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_check_profile_achievements ON public.users;
CREATE TRIGGER trg_check_profile_achievements
AFTER INSERT OR UPDATE OF display_name, bio, avatar_url, banner_url ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.trigger_check_profile_achievements();

CREATE OR REPLACE FUNCTION public.check_message_count_achievements(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _message_count integer;
BEGIN
  SELECT
    (
      SELECT count(*)::int
      FROM public.messages m
      WHERE m.user_id = _user_id
        AND COALESCE(m.is_system_message, false) = false
    ) + (
      SELECT count(*)::int
      FROM public.direct_messages dm
      WHERE dm.sender_id = _user_id
    )
  INTO _message_count;

  IF _message_count >= 1 THEN
    PERFORM public.award_achievement(_user_id, 'first_msg', jsonb_build_object('message_count', _message_count));
  END IF;
  IF _message_count >= 10 THEN
    PERFORM public.award_achievement(_user_id, 'msg_10', jsonb_build_object('message_count', _message_count));
  END IF;
  IF _message_count >= 50 THEN
    PERFORM public.award_achievement(_user_id, 'msg_50', jsonb_build_object('message_count', _message_count));
  END IF;
  IF _message_count >= 100 THEN
    PERFORM public.award_achievement(_user_id, 'msg_100', jsonb_build_object('message_count', _message_count));
  END IF;
  IF _message_count >= 500 THEN
    PERFORM public.award_achievement(_user_id, 'msg_500', jsonb_build_object('message_count', _message_count));
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.check_message_count_achievements(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trigger_check_channel_message_achievements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF COALESCE(NEW.is_system_message, false) = false THEN
    BEGIN
      PERFORM public.check_message_count_achievements(NEW.user_id);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.trigger_check_channel_message_achievements() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_check_channel_message_achievements ON public.messages;
CREATE TRIGGER trg_check_channel_message_achievements
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.trigger_check_channel_message_achievements();

CREATE OR REPLACE FUNCTION public.trigger_check_dm_message_achievements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  BEGIN
    PERFORM public.check_message_count_achievements(NEW.sender_id);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.trigger_check_dm_message_achievements() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_check_dm_message_achievements ON public.direct_messages;
CREATE TRIGGER trg_check_dm_message_achievements
AFTER INSERT ON public.direct_messages
FOR EACH ROW
EXECUTE FUNCTION public.trigger_check_dm_message_achievements();

CREATE OR REPLACE FUNCTION public.trigger_check_viral_message_achievement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _owner_id uuid;
  _reaction_count integer;
BEGIN
  BEGIN
    SELECT m.user_id INTO _owner_id
    FROM public.messages m
    WHERE m.id = NEW.message_id
      AND COALESCE(m.is_system_message, false) = false;

    IF _owner_id IS NOT NULL THEN
      SELECT count(*)::int INTO _reaction_count
      FROM public.reactions r
      WHERE r.message_id = NEW.message_id;

      IF _reaction_count >= 100 THEN
        PERFORM public.award_achievement(
          _owner_id,
          'viral_msg',
          jsonb_build_object('message_id', NEW.message_id, 'reaction_count', _reaction_count)
        );
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.trigger_check_viral_message_achievement() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_check_viral_message_achievement ON public.reactions;
CREATE TRIGGER trg_check_viral_message_achievement
AFTER INSERT ON public.reactions
FOR EACH ROW
EXECUTE FUNCTION public.trigger_check_viral_message_achievement();

CREATE OR REPLACE FUNCTION public.trigger_check_profile_comment_achievements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _comment_count integer;
BEGIN
  BEGIN
    SELECT count(*)::int INTO _comment_count
    FROM public.user_profile_post_comments c
    WHERE c.user_id = NEW.user_id;

    IF _comment_count >= 1 THEN
      PERFORM public.award_achievement(NEW.user_id, 'first_profile_comment', jsonb_build_object('comment_count', _comment_count));
    END IF;
    IF _comment_count >= 50 THEN
      PERFORM public.award_achievement(NEW.user_id, 'comments_50', jsonb_build_object('comment_count', _comment_count));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.trigger_check_profile_comment_achievements() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_check_profile_comment_achievements ON public.user_profile_post_comments;
CREATE TRIGGER trg_check_profile_comment_achievements
AFTER INSERT ON public.user_profile_post_comments
FOR EACH ROW
EXECUTE FUNCTION public.trigger_check_profile_comment_achievements();

CREATE OR REPLACE FUNCTION public.trigger_check_media_post_achievement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _channel_type public.channel_type;
BEGIN
  BEGIN
    SELECT c.type INTO _channel_type
    FROM public.channels c
    WHERE c.id = NEW.channel_id;

    IF _channel_type = 'media'::public.channel_type
       AND NEW.media_type IN ('image', 'video', 'gif', 'youtube') THEN
      PERFORM public.award_achievement(
        NEW.user_id,
        'media_post',
        jsonb_build_object('media_id', NEW.id, 'media_type', NEW.media_type)
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.trigger_check_media_post_achievement() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_check_media_post_achievement ON public.media_items;
CREATE TRIGGER trg_check_media_post_achievement
AFTER INSERT ON public.media_items
FOR EACH ROW
EXECUTE FUNCTION public.trigger_check_media_post_achievement();

CREATE OR REPLACE FUNCTION public.trigger_check_thread_starter_achievement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _thread_owner_id uuid;
  _reply_count integer;
BEGIN
  BEGIN
    SELECT t.created_by INTO _thread_owner_id
    FROM public.threads t
    WHERE t.id = NEW.thread_id;

    IF _thread_owner_id IS NOT NULL THEN
      SELECT count(*)::int INTO _reply_count
      FROM public.thread_messages tm
      WHERE tm.thread_id = NEW.thread_id
        AND tm.user_id <> _thread_owner_id;

      IF _reply_count >= 10 THEN
        PERFORM public.award_achievement(
          _thread_owner_id,
          'thread_starter',
          jsonb_build_object('thread_id', NEW.thread_id, 'reply_count', _reply_count)
        );
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.trigger_check_thread_starter_achievement() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_check_thread_starter_achievement ON public.thread_messages;
CREATE TRIGGER trg_check_thread_starter_achievement
AFTER INSERT ON public.thread_messages
FOR EACH ROW
EXECUTE FUNCTION public.trigger_check_thread_starter_achievement();

INSERT INTO public.user_achievements (user_id, achievement_slug, metadata)
SELECT u.id, 'profile_complete', '{}'::jsonb
FROM public.users u
WHERE NULLIF(btrim(COALESCE(u.display_name, '')), '') IS NOT NULL
  AND NULLIF(btrim(COALESCE(u.bio, '')), '') IS NOT NULL
  AND NULLIF(btrim(COALESCE(u.avatar_url, '')), '') IS NOT NULL
  AND NULLIF(btrim(COALESCE(u.banner_url, '')), '') IS NOT NULL
ON CONFLICT DO NOTHING;

WITH message_counts AS (
  SELECT user_id, sum(message_count)::int AS message_count
  FROM (
    SELECT m.user_id, count(*)::int AS message_count
    FROM public.messages m
    WHERE COALESCE(m.is_system_message, false) = false
    GROUP BY m.user_id
    UNION ALL
    SELECT dm.sender_id AS user_id, count(*)::int AS message_count
    FROM public.direct_messages dm
    GROUP BY dm.sender_id
  ) counts
  GROUP BY user_id
)
INSERT INTO public.user_achievements (user_id, achievement_slug, metadata)
SELECT mc.user_id, threshold.slug, jsonb_build_object('message_count', mc.message_count)
FROM message_counts mc
CROSS JOIN (
  VALUES
    ('first_msg'::text, 1)
) AS threshold(slug, required_count)
WHERE mc.message_count >= threshold.required_count
ON CONFLICT DO NOTHING;

WITH comment_counts AS (
  SELECT c.user_id, count(*)::int AS comment_count
  FROM public.user_profile_post_comments c
  GROUP BY c.user_id
)
INSERT INTO public.user_achievements (user_id, achievement_slug, metadata)
SELECT cc.user_id, threshold.slug, jsonb_build_object('comment_count', cc.comment_count)
FROM comment_counts cc
CROSS JOIN (
  VALUES
    ('first_profile_comment'::text, 1),
    ('comments_50'::text, 50)
) AS threshold(slug, required_count)
WHERE cc.comment_count >= threshold.required_count
ON CONFLICT DO NOTHING;

INSERT INTO public.user_achievements (user_id, achievement_slug, metadata)
SELECT DISTINCT mi.user_id, 'media_post', '{}'::jsonb
FROM public.media_items mi
JOIN public.channels c ON c.id = mi.channel_id
WHERE c.type = 'media'::public.channel_type
  AND mi.media_type IN ('image', 'video', 'gif', 'youtube')
ON CONFLICT DO NOTHING;

WITH reaction_counts AS (
  SELECT m.user_id, m.id AS message_id, count(r.id)::int AS reaction_count
  FROM public.messages m
  JOIN public.reactions r ON r.message_id = m.id
  WHERE COALESCE(m.is_system_message, false) = false
  GROUP BY m.user_id, m.id
  HAVING count(r.id) >= 100
)
INSERT INTO public.user_achievements (user_id, achievement_slug, metadata)
SELECT rc.user_id, 'viral_msg', jsonb_build_object('message_id', rc.message_id, 'reaction_count', rc.reaction_count)
FROM reaction_counts rc
ON CONFLICT DO NOTHING;

WITH thread_reply_counts AS (
  SELECT t.created_by, t.id AS thread_id, count(tm.id)::int AS reply_count
  FROM public.threads t
  JOIN public.thread_messages tm ON tm.thread_id = t.id
  WHERE tm.user_id <> t.created_by
  GROUP BY t.created_by, t.id
  HAVING count(tm.id) >= 10
)
INSERT INTO public.user_achievements (user_id, achievement_slug, metadata)
SELECT trc.created_by, 'thread_starter', jsonb_build_object('thread_id', trc.thread_id, 'reply_count', trc.reply_count)
FROM thread_reply_counts trc
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END
$$;
