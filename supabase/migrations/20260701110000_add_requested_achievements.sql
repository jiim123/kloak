-- Add requested achievements using trusted database-side events.
-- New client-callable completion paths are avoided. The only new RPC here is
-- service_role-only and is intended for voice-token edge functions after they
-- have already verified identity, membership, access, and rate limits.

ALTER TABLE public.achievement_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievement_definitions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.achievement_definitions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.user_achievements FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.achievement_definitions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_achievements TO service_role;

INSERT INTO public.achievement_definitions (slug, category, tier, name, description, hint, trigger_name, sort_order)
VALUES
  ('forum_regular', 'content', 'silver', 'Forum Regular', 'Reply in 10 different forum threads', 'Join more conversations in forum channels', 'on_thread_reply_count', 220),
  ('early_reply', 'content', 'bronze', 'First on Scene', 'Reply to a new thread within 5 minutes', 'Catch a thread while it is fresh', 'on_thread_reply_created', 230),
  ('helpful_reply', 'content', 'silver', 'Helpful Reply', 'Have one reply receive 10 of the same reaction', 'Write a reply people agree with', 'on_thread_reaction_count', 240),
  ('poll_participant', 'content', 'bronze', 'Ballot Cast', 'Vote in your first poll', 'Take part in a poll', 'on_poll_vote_created', 250),
  ('pin_worthy', 'content', 'silver', 'Pin Worthy', 'Have one of your messages pinned', 'Post something worth saving', 'on_message_pinned', 260),
  ('group_dm_started', 'social', 'bronze', 'Party Line', 'Create your first group DM', 'Start a conversation with a few people', 'on_group_dm_created', 400),
  ('server_published', 'community', 'silver', 'On The Map', 'Publish a server to Explore', 'Build a server that meets Explore requirements', 'on_server_published', 480),
  ('distinct_days_active_30', 'content', 'gold', 'Month of Motion', 'Be active on 30 different days', NULL, 'on_activity_day', 270),
  ('voice_joined', 'social', 'bronze', 'On Air', 'Join a voice channel for the first time', 'Hop into a voice channel', 'on_voice_join', 405)
ON CONFLICT (slug) DO UPDATE
SET category = EXCLUDED.category,
    tier = EXCLUDED.tier,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    hint = EXCLUDED.hint,
    trigger_name = EXCLUDED.trigger_name,
    sort_order = EXCLUDED.sort_order,
    is_active = true;

CREATE OR REPLACE FUNCTION public.check_forum_regular_achievement(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _thread_count integer;
BEGIN
  IF _user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT count(DISTINCT tm.thread_id)::int
    INTO _thread_count
  FROM public.thread_messages tm
  JOIN public.threads t ON t.id = tm.thread_id
  JOIN public.channels c ON c.id = t.channel_id
  WHERE tm.user_id = _user_id
    AND t.created_by <> _user_id
    AND c.type = 'forum'::public.channel_type;

  IF _thread_count >= 10 THEN
    PERFORM public.award_achievement(_user_id, 'forum_regular', jsonb_build_object('thread_count', _thread_count));
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.check_forum_regular_achievement(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_distinct_active_days_achievement(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _active_days integer;
BEGIN
  IF _user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*)::int
    INTO _active_days
  FROM (
    SELECT m.created_at::date AS active_day
    FROM public.messages m
    WHERE m.user_id = _user_id
      AND COALESCE(m.is_system_message, false) = false
    UNION
    SELECT dm.created_at::date AS active_day
    FROM public.direct_messages dm
    WHERE dm.sender_id = _user_id
    UNION
    SELECT tm.created_at::date AS active_day
    FROM public.thread_messages tm
    WHERE tm.user_id = _user_id
  ) days;

  IF _active_days >= 30 THEN
    PERFORM public.award_achievement(_user_id, 'distinct_days_active_30', jsonb_build_object('active_days', _active_days));
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.check_distinct_active_days_achievement(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trigger_check_thread_reply_requested_achievements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _thread record;
BEGIN
  BEGIN
    SELECT t.id, t.created_by, t.created_at, c.type AS channel_type
      INTO _thread
    FROM public.threads t
    JOIN public.channels c ON c.id = t.channel_id
    WHERE t.id = NEW.thread_id;

    IF _thread.id IS NOT NULL
       AND _thread.channel_type = 'forum'::public.channel_type
       AND _thread.created_by <> NEW.user_id THEN
      IF NEW.created_at <= _thread.created_at + interval '5 minutes' THEN
        PERFORM public.award_achievement(
          NEW.user_id,
          'early_reply',
          jsonb_build_object('thread_id', NEW.thread_id, 'reply_id', NEW.id)
        );
      END IF;

      PERFORM public.check_forum_regular_achievement(NEW.user_id);
    END IF;

    PERFORM public.check_distinct_active_days_achievement(NEW.user_id);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.trigger_check_thread_reply_requested_achievements() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_check_thread_reply_requested_achievements ON public.thread_messages;
CREATE TRIGGER trg_check_thread_reply_requested_achievements
AFTER INSERT ON public.thread_messages
FOR EACH ROW
EXECUTE FUNCTION public.trigger_check_thread_reply_requested_achievements();

CREATE OR REPLACE FUNCTION public.trigger_check_helpful_reply_achievement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _reply_owner_id uuid;
  _reaction_count integer;
BEGIN
  BEGIN
    SELECT tm.user_id
      INTO _reply_owner_id
    FROM public.thread_messages tm
    WHERE tm.id = NEW.message_id;

    IF _reply_owner_id IS NOT NULL THEN
      SELECT count(*)::int
        INTO _reaction_count
      FROM public.thread_reactions tr
      WHERE tr.message_id = NEW.message_id
        AND tr.emoji = NEW.emoji
        AND tr.user_id <> _reply_owner_id;

      IF _reaction_count >= 10 THEN
        PERFORM public.award_achievement(
          _reply_owner_id,
          'helpful_reply',
          jsonb_build_object('thread_message_id', NEW.message_id, 'emoji', NEW.emoji, 'reaction_count', _reaction_count)
        );
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.trigger_check_helpful_reply_achievement() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_check_helpful_reply_achievement ON public.thread_reactions;
CREATE TRIGGER trg_check_helpful_reply_achievement
AFTER INSERT ON public.thread_reactions
FOR EACH ROW
EXECUTE FUNCTION public.trigger_check_helpful_reply_achievement();

CREATE OR REPLACE FUNCTION public.trigger_check_poll_participant_achievement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  BEGIN
    PERFORM public.award_achievement(
      NEW.user_id,
      'poll_participant',
      jsonb_build_object('poll_id', NEW.poll_id)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.trigger_check_poll_participant_achievement() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_check_poll_participant_achievement ON public.poll_votes;
CREATE TRIGGER trg_check_poll_participant_achievement
AFTER INSERT ON public.poll_votes
FOR EACH ROW
EXECUTE FUNCTION public.trigger_check_poll_participant_achievement();

CREATE OR REPLACE FUNCTION public.trigger_check_pin_worthy_achievement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  BEGIN
    IF COALESCE(NEW.is_pinned, false) = true
       AND COALESCE(OLD.is_pinned, false) = false
       AND COALESCE(NEW.is_system_message, false) = false
       AND (NEW.pinned_by IS NULL OR NEW.pinned_by <> NEW.user_id) THEN
      PERFORM public.award_achievement(
        NEW.user_id,
        'pin_worthy',
        jsonb_build_object('message_id', NEW.id, 'channel_id', NEW.channel_id, 'pinned_by', NEW.pinned_by)
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.trigger_check_pin_worthy_achievement() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_check_pin_worthy_achievement ON public.messages;
CREATE TRIGGER trg_check_pin_worthy_achievement
AFTER UPDATE OF is_pinned ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.trigger_check_pin_worthy_achievement();

CREATE OR REPLACE FUNCTION public.trigger_check_group_dm_started_achievement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  BEGIN
    IF COALESCE(NEW.is_group, false) = true AND NEW.created_by IS NOT NULL THEN
      PERFORM public.award_achievement(
        NEW.created_by,
        'group_dm_started',
        jsonb_build_object('conversation_id', NEW.id)
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.trigger_check_group_dm_started_achievement() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_check_group_dm_started_achievement ON public.dm_conversations;
CREATE TRIGGER trg_check_group_dm_started_achievement
AFTER INSERT ON public.dm_conversations
FOR EACH ROW
EXECUTE FUNCTION public.trigger_check_group_dm_started_achievement();

CREATE OR REPLACE FUNCTION public.trigger_check_server_published_achievement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  BEGIN
    IF COALESCE(NEW.is_published, false) = true
       AND COALESCE(OLD.is_published, false) = false
       AND NEW.owner_id IS NOT NULL THEN
      PERFORM public.award_achievement(
        NEW.owner_id,
        'server_published',
        jsonb_build_object('server_id', NEW.id)
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.trigger_check_server_published_achievement() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_check_server_published_achievement ON public.servers;
CREATE TRIGGER trg_check_server_published_achievement
AFTER UPDATE OF is_published ON public.servers
FOR EACH ROW
EXECUTE FUNCTION public.trigger_check_server_published_achievement();

CREATE OR REPLACE FUNCTION public.trigger_check_message_active_day_achievement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF COALESCE(NEW.is_system_message, false) = false THEN
    BEGIN
      PERFORM public.check_distinct_active_days_achievement(NEW.user_id);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.trigger_check_message_active_day_achievement() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_check_message_active_day_achievement ON public.messages;
CREATE TRIGGER trg_check_message_active_day_achievement
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.trigger_check_message_active_day_achievement();

CREATE OR REPLACE FUNCTION public.trigger_check_dm_active_day_achievement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  BEGIN
    PERFORM public.check_distinct_active_days_achievement(NEW.sender_id);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.trigger_check_dm_active_day_achievement() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_check_dm_active_day_achievement ON public.direct_messages;
CREATE TRIGGER trg_check_dm_active_day_achievement
AFTER INSERT ON public.direct_messages
FOR EACH ROW
EXECUTE FUNCTION public.trigger_check_dm_active_day_achievement();

CREATE OR REPLACE FUNCTION public.record_voice_joined_from_token(_user_id uuid, _channel_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _is_voice_channel boolean := false;
BEGIN
  IF _user_id IS NULL OR _channel_id IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.channels c
    WHERE c.id = _channel_id
      AND c.type = 'voice'::public.channel_type
      AND public.has_channel_access(_channel_id, _user_id)
  ) INTO _is_voice_channel;

  IF NOT _is_voice_channel THEN
    RETURN;
  END IF;

  PERFORM public.award_achievement(
    _user_id,
    'voice_joined',
    jsonb_build_object('channel_id', _channel_id)
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.record_voice_joined_from_token(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_voice_joined_from_token(uuid, uuid) TO service_role;

-- Backfill safe achievements from durable existing state.
WITH forum_reply_counts AS (
  SELECT tm.user_id, count(DISTINCT tm.thread_id)::int AS thread_count
  FROM public.thread_messages tm
  JOIN public.threads t ON t.id = tm.thread_id
  JOIN public.channels c ON c.id = t.channel_id
  WHERE t.created_by <> tm.user_id
    AND c.type = 'forum'::public.channel_type
  GROUP BY tm.user_id
)
INSERT INTO public.user_achievements (user_id, achievement_slug, metadata)
SELECT user_id, 'forum_regular', jsonb_build_object('thread_count', thread_count)
FROM forum_reply_counts
WHERE thread_count >= 10
ON CONFLICT DO NOTHING;

INSERT INTO public.user_achievements (user_id, achievement_slug, metadata)
SELECT DISTINCT tm.user_id, 'early_reply', jsonb_build_object('thread_id', tm.thread_id, 'reply_id', tm.id)
FROM public.thread_messages tm
JOIN public.threads t ON t.id = tm.thread_id
JOIN public.channels c ON c.id = t.channel_id
WHERE t.created_by <> tm.user_id
  AND c.type = 'forum'::public.channel_type
  AND tm.created_at <= t.created_at + interval '5 minutes'
ON CONFLICT DO NOTHING;

WITH helpful_replies AS (
  SELECT tm.user_id, tr.message_id, tr.emoji, count(*)::int AS reaction_count
  FROM public.thread_reactions tr
  JOIN public.thread_messages tm ON tm.id = tr.message_id
  WHERE tr.user_id <> tm.user_id
  GROUP BY tm.user_id, tr.message_id, tr.emoji
  HAVING count(*) >= 10
)
INSERT INTO public.user_achievements (user_id, achievement_slug, metadata)
SELECT user_id, 'helpful_reply', jsonb_build_object('thread_message_id', message_id, 'emoji', emoji, 'reaction_count', reaction_count)
FROM helpful_replies
ON CONFLICT DO NOTHING;

INSERT INTO public.user_achievements (user_id, achievement_slug, metadata)
SELECT DISTINCT pv.user_id, 'poll_participant', jsonb_build_object('poll_id', pv.poll_id)
FROM public.poll_votes pv
ON CONFLICT DO NOTHING;

INSERT INTO public.user_achievements (user_id, achievement_slug, metadata)
SELECT DISTINCT m.user_id, 'pin_worthy', jsonb_build_object('message_id', m.id, 'channel_id', m.channel_id, 'pinned_by', m.pinned_by)
FROM public.messages m
WHERE COALESCE(m.is_pinned, false) = true
  AND COALESCE(m.is_system_message, false) = false
  AND (m.pinned_by IS NULL OR m.pinned_by <> m.user_id)
ON CONFLICT DO NOTHING;

INSERT INTO public.user_achievements (user_id, achievement_slug, metadata)
SELECT DISTINCT dc.created_by, 'group_dm_started', jsonb_build_object('conversation_id', dc.id)
FROM public.dm_conversations dc
WHERE COALESCE(dc.is_group, false) = true
  AND dc.created_by IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.user_achievements (user_id, achievement_slug, metadata)
SELECT DISTINCT s.owner_id, 'server_published', jsonb_build_object('server_id', s.id)
FROM public.servers s
WHERE COALESCE(s.is_published, false) = true
  AND s.owner_id IS NOT NULL
ON CONFLICT DO NOTHING;

WITH active_day_counts AS (
  SELECT user_id, count(*)::int AS active_days
  FROM (
    SELECT m.user_id, m.created_at::date AS active_day
    FROM public.messages m
    WHERE COALESCE(m.is_system_message, false) = false
    UNION
    SELECT dm.sender_id AS user_id, dm.created_at::date AS active_day
    FROM public.direct_messages dm
    WHERE dm.sender_id IS NOT NULL
    UNION
    SELECT tm.user_id, tm.created_at::date AS active_day
    FROM public.thread_messages tm
  ) activity_days
  WHERE user_id IS NOT NULL
  GROUP BY user_id
)
INSERT INTO public.user_achievements (user_id, achievement_slug, metadata)
SELECT user_id, 'distinct_days_active_30', jsonb_build_object('active_days', active_days)
FROM active_day_counts
WHERE active_days >= 30
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END
$$;
