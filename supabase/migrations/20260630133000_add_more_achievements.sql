-- Add social, discovery, and customization achievements.
-- Awards stay database-side so clients cannot complete these by calling an
-- achievement RPC directly.

-- Re-assert the base achievement table protections so Supabase's SQL editor
-- advisory checker can see RLS in this standalone migration too.
ALTER TABLE public.achievement_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievement_definitions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements FORCE ROW LEVEL SECURITY;

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

INSERT INTO public.achievement_definitions (slug, category, tier, name, description, hint, trigger_name, sort_order)
VALUES
  ('first_friend', 'social', 'bronze', 'First Friend', 'Become friends with someone', 'Send or accept a friend request', 'on_friend_count', 310),
  ('10_friends', 'social', 'bronze', 'Squad Forming', 'Reach 10 friends', 'Keep connecting with people', 'on_friend_count', 320),
  ('100_friends', 'social', 'gold', 'Certified Socialite', 'Reach 100 friends', NULL, 'on_friend_count', 330),
  ('1000_friends', 'social', 'diamond', 'Everyone Knows You', 'Reach 1,000 friends', NULL, 'on_friend_count', 340),
  ('first_mention', 'social', 'bronze', 'Name Drop', 'Get mentioned for the first time', 'Join conversations people want to pull you into', 'on_mention_created', 350),
  ('first_dm', 'social', 'bronze', 'Side Quest', 'Send your first direct message', 'Start a private conversation', 'on_dm_created', 360),
  ('join_a_server_from_explore_page', 'community', 'bronze', 'Found Something', 'Join a server from Explore', 'Browse Explore and hop into a public server', 'on_explore_server_join', 410),
  ('first_server_join', 'community', 'bronze', 'New Room', 'Join your first server', 'Find a place to hang out', 'on_server_join', 420),
  ('join_10_servers', 'community', 'silver', 'Server Sampler', 'Join 10 servers', 'Explore more communities', 'on_server_join', 430),
  ('join_50_servers', 'community', 'gold', 'Everywhere At Once', 'Join 50 servers', NULL, 'on_server_join', 440),
  ('create_first_server', 'community', 'bronze', 'Founder Arc', 'Create your first server', 'Start a space of your own', 'on_server_created', 450),
  ('change_theme', 'customization', 'bronze', 'Fresh Coat', 'Change your app theme', 'Pick a theme that feels like you', 'on_theme_change', 510),
  ('custom_status_set', 'customization', 'bronze', 'Mood Posted', 'Set a custom status', 'Tell people what kind of day it is', 'on_profile_update', 520),
  ('profile_theme_changed', 'customization', 'bronze', 'Profile Drip', 'Customize your profile colors', 'Give your profile its own look', 'on_profile_update', 530),
  ('tagline_written', 'profile', 'bronze', 'One-Liner', 'Add a profile tagline', 'Write a short line for your profile', 'on_profile_update', 60),
  ('profile_post_created', 'profile', 'bronze', 'Pinned Thought', 'Create your first profile post', 'Share something on your profile', 'on_profile_post_created', 70),
  ('dm_10', 'social', 'bronze', 'Private Lore', 'Send 10 direct messages', 'Keep the side chat going', 'on_dm_created', 370),
  ('dm_100', 'social', 'gold', 'Backchannel Boss', 'Send 100 direct messages', NULL, 'on_dm_created', 380),
  ('mentioned_10_times', 'social', 'silver', 'Rent Free', 'Get mentioned 10 times', 'Be worth pulling into the conversation', 'on_mention_created', 390),
  ('message_edited', 'content', 'bronze', 'Second Draft', 'Edit a message', 'Clean up a message after sending it', 'on_message_edited', 210),
  ('compact_mode_enabled', 'customization', 'bronze', 'Tiny UI Enjoyer', 'Enable compact mode', 'Make the interface a little tighter', 'on_preferences_update', 540),
  ('emoji_uploaded', 'community', 'bronze', 'Expression Pack', 'Upload a server emoji', 'Add a custom emoji to a server', 'on_server_emoji_created', 460),
  ('first_invite_created', 'community', 'bronze', 'Open Door', 'Create your first server invite', 'Invite someone into a server', 'on_server_invite_created', 470)
ON CONFLICT (slug) DO UPDATE
SET category = EXCLUDED.category,
    tier = EXCLUDED.tier,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    hint = EXCLUDED.hint,
    trigger_name = EXCLUDED.trigger_name,
    sort_order = EXCLUDED.sort_order,
    is_active = true;

CREATE OR REPLACE FUNCTION public.check_friend_count_achievements(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _friend_count integer;
BEGIN
  IF _user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*)::int INTO _friend_count
  FROM public.friendships f
  WHERE f.status = 'accepted'::public.friendship_status
    AND (f.requester_id = _user_id OR f.addressee_id = _user_id);

  IF _friend_count >= 1 THEN
    PERFORM public.award_achievement(_user_id, 'first_friend', jsonb_build_object('friend_count', _friend_count));
  END IF;
  IF _friend_count >= 10 THEN
    PERFORM public.award_achievement(_user_id, '10_friends', jsonb_build_object('friend_count', _friend_count));
  END IF;
  IF _friend_count >= 100 THEN
    PERFORM public.award_achievement(_user_id, '100_friends', jsonb_build_object('friend_count', _friend_count));
  END IF;
  IF _friend_count >= 1000 THEN
    PERFORM public.award_achievement(_user_id, '1000_friends', jsonb_build_object('friend_count', _friend_count));
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.check_friend_count_achievements(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trigger_check_friend_achievements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  BEGIN
    IF NEW.status = 'accepted'::public.friendship_status THEN
      PERFORM public.check_friend_count_achievements(NEW.requester_id);
      PERFORM public.check_friend_count_achievements(NEW.addressee_id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.trigger_check_friend_achievements() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_check_friend_achievements'
      AND tgrelid = 'public.friendships'::regclass
  ) THEN
    CREATE TRIGGER trg_check_friend_achievements
    AFTER INSERT OR UPDATE OF status ON public.friendships
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_check_friend_achievements();
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.trigger_check_first_mention_achievement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  BEGIN
    IF NEW.user_id IS NOT NULL THEN
      PERFORM public.award_achievement(
        NEW.user_id,
        'first_mention',
        jsonb_build_object('message_id', NEW.message_id, 'mention_type', NEW.mention_type)
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.trigger_check_first_mention_achievement() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_check_first_mention_achievement'
      AND tgrelid = 'public.mentions'::regclass
  ) THEN
    CREATE TRIGGER trg_check_first_mention_achievement
    AFTER INSERT ON public.mentions
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_check_first_mention_achievement();
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.trigger_check_first_dm_achievement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  BEGIN
    PERFORM public.award_achievement(
      NEW.sender_id,
      'first_dm',
      jsonb_build_object('conversation_id', NEW.conversation_id)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.trigger_check_first_dm_achievement() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_check_first_dm_achievement'
      AND tgrelid = 'public.direct_messages'::regclass
  ) THEN
    CREATE TRIGGER trg_check_first_dm_achievement
    AFTER INSERT ON public.direct_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_check_first_dm_achievement();
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.trigger_check_explore_join_achievement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  BEGIN
    IF lower(COALESCE(NEW.join_source, '')) = 'discover'
       AND EXISTS (
         SELECT 1
         FROM public.servers s
         WHERE s.id = NEW.server_id
           AND COALESCE(s.is_published, false) = true
       ) THEN
      PERFORM public.award_achievement(
        NEW.user_id,
        'join_a_server_from_explore_page',
        jsonb_build_object('server_id', NEW.server_id)
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.trigger_check_explore_join_achievement() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_check_explore_join_achievement'
      AND tgrelid = 'public.server_members'::regclass
  ) THEN
    CREATE TRIGGER trg_check_explore_join_achievement
    AFTER INSERT ON public.server_members
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_check_explore_join_achievement();
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.trigger_check_profile_customization_achievements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  BEGIN
    IF NULLIF(btrim(COALESCE(NEW.custom_status, '')), '') IS NOT NULL THEN
      PERFORM public.award_achievement(NEW.id, 'custom_status_set');
    END IF;

    IF NULLIF(btrim(COALESCE(NEW.tagline, '')), '') IS NOT NULL THEN
      PERFORM public.award_achievement(NEW.id, 'tagline_written');
    END IF;

    IF NULLIF(btrim(COALESCE(NEW.profile_theme_primary, '')), '') IS NOT NULL
       OR NULLIF(btrim(COALESCE(NEW.profile_theme_accent, '')), '') IS NOT NULL THEN
      PERFORM public.award_achievement(NEW.id, 'profile_theme_changed');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.trigger_check_profile_customization_achievements() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_check_profile_customization_achievements'
      AND tgrelid = 'public.users'::regclass
  ) THEN
    CREATE TRIGGER trg_check_profile_customization_achievements
    AFTER INSERT OR UPDATE OF custom_status, tagline, profile_theme_primary, profile_theme_accent ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_check_profile_customization_achievements();
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.trigger_check_profile_post_created_achievement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  BEGIN
    PERFORM public.award_achievement(
      NEW.user_id,
      'profile_post_created',
      jsonb_build_object('post_id', NEW.id)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.trigger_check_profile_post_created_achievement() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_check_profile_post_created_achievement'
      AND tgrelid = 'public.user_profile_posts'::regclass
  ) THEN
    CREATE TRIGGER trg_check_profile_post_created_achievement
    AFTER INSERT ON public.user_profile_posts
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_check_profile_post_created_achievement();
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.check_dm_count_achievements(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _dm_count integer;
BEGIN
  IF _user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*)::int INTO _dm_count
  FROM public.direct_messages dm
  WHERE dm.sender_id = _user_id;

  IF _dm_count >= 10 THEN
    PERFORM public.award_achievement(_user_id, 'dm_10', jsonb_build_object('dm_count', _dm_count));
  END IF;
  IF _dm_count >= 100 THEN
    PERFORM public.award_achievement(_user_id, 'dm_100', jsonb_build_object('dm_count', _dm_count));
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.check_dm_count_achievements(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trigger_check_dm_count_achievements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  BEGIN
    PERFORM public.check_dm_count_achievements(NEW.sender_id);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.trigger_check_dm_count_achievements() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_check_dm_count_achievements'
      AND tgrelid = 'public.direct_messages'::regclass
  ) THEN
    CREATE TRIGGER trg_check_dm_count_achievements
    AFTER INSERT ON public.direct_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_check_dm_count_achievements();
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.check_mention_count_achievements(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _mention_count integer;
BEGIN
  IF _user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*)::int INTO _mention_count
  FROM public.mentions m
  WHERE m.user_id = _user_id;

  IF _mention_count >= 10 THEN
    PERFORM public.award_achievement(_user_id, 'mentioned_10_times', jsonb_build_object('mention_count', _mention_count));
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.check_mention_count_achievements(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trigger_check_mention_count_achievements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  BEGIN
    PERFORM public.check_mention_count_achievements(NEW.user_id);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.trigger_check_mention_count_achievements() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_check_mention_count_achievements'
      AND tgrelid = 'public.mentions'::regclass
  ) THEN
    CREATE TRIGGER trg_check_mention_count_achievements
    AFTER INSERT ON public.mentions
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_check_mention_count_achievements();
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.check_server_join_achievements(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _server_count integer;
BEGIN
  IF _user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*)::int INTO _server_count
  FROM public.server_members sm
  WHERE sm.user_id = _user_id
    AND COALESCE(sm.is_banned, false) = false;

  IF _server_count >= 1 THEN
    PERFORM public.award_achievement(_user_id, 'first_server_join', jsonb_build_object('server_count', _server_count));
  END IF;
  IF _server_count >= 10 THEN
    PERFORM public.award_achievement(_user_id, 'join_10_servers', jsonb_build_object('server_count', _server_count));
  END IF;
  IF _server_count >= 50 THEN
    PERFORM public.award_achievement(_user_id, 'join_50_servers', jsonb_build_object('server_count', _server_count));
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.check_server_join_achievements(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trigger_check_server_join_achievements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  BEGIN
    PERFORM public.check_server_join_achievements(NEW.user_id);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.trigger_check_server_join_achievements() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_check_server_join_achievements'
      AND tgrelid = 'public.server_members'::regclass
  ) THEN
    CREATE TRIGGER trg_check_server_join_achievements
    AFTER INSERT OR UPDATE OF is_banned ON public.server_members
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_check_server_join_achievements();
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.trigger_check_server_created_achievement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  BEGIN
    PERFORM public.award_achievement(
      NEW.owner_id,
      'create_first_server',
      jsonb_build_object('server_id', NEW.id)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.trigger_check_server_created_achievement() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_check_server_created_achievement'
      AND tgrelid = 'public.servers'::regclass
  ) THEN
    CREATE TRIGGER trg_check_server_created_achievement
    AFTER INSERT ON public.servers
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_check_server_created_achievement();
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.trigger_check_message_edited_achievement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  BEGIN
    IF NEW.edited_at IS NOT NULL
       AND NEW.edited_at IS DISTINCT FROM OLD.edited_at
       AND COALESCE(NEW.is_system_message, false) = false THEN
      PERFORM public.award_achievement(
        NEW.user_id,
        'message_edited',
        jsonb_build_object('message_id', NEW.id, 'message_type', 'channel')
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.trigger_check_message_edited_achievement() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_check_message_edited_achievement'
      AND tgrelid = 'public.messages'::regclass
  ) THEN
    CREATE TRIGGER trg_check_message_edited_achievement
    AFTER UPDATE OF edited_at ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_check_message_edited_achievement();
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.trigger_check_dm_edited_achievement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  BEGIN
    IF NEW.edited_at IS NOT NULL
       AND NEW.edited_at IS DISTINCT FROM OLD.edited_at THEN
      PERFORM public.award_achievement(
        NEW.sender_id,
        'message_edited',
        jsonb_build_object('message_id', NEW.id, 'message_type', 'dm')
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.trigger_check_dm_edited_achievement() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_check_dm_edited_achievement'
      AND tgrelid = 'public.direct_messages'::regclass
  ) THEN
    CREATE TRIGGER trg_check_dm_edited_achievement
    AFTER UPDATE OF edited_at ON public.direct_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_check_dm_edited_achievement();
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.trigger_check_theme_change_achievement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  BEGIN
    IF TG_OP = 'UPDATE'
       AND NEW.theme IS DISTINCT FROM OLD.theme
       AND NULLIF(btrim(COALESCE(NEW.theme, '')), '') IS NOT NULL THEN
      PERFORM public.award_achievement(
        NEW.user_id,
        'change_theme',
        jsonb_build_object('theme', NEW.theme)
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.trigger_check_theme_change_achievement() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_check_theme_change_achievement'
      AND tgrelid = 'public.user_preferences'::regclass
  ) THEN
    CREATE TRIGGER trg_check_theme_change_achievement
    AFTER UPDATE OF theme ON public.user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_check_theme_change_achievement();
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.trigger_check_compact_mode_achievement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  BEGIN
    IF COALESCE(NEW.compact_mode, false) = true
       AND COALESCE(OLD.compact_mode, false) = false THEN
      PERFORM public.award_achievement(
        NEW.user_id,
        'compact_mode_enabled',
        jsonb_build_object('compact_mode', NEW.compact_mode)
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.trigger_check_compact_mode_achievement() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_check_compact_mode_achievement'
      AND tgrelid = 'public.user_preferences'::regclass
  ) THEN
    CREATE TRIGGER trg_check_compact_mode_achievement
    AFTER UPDATE OF compact_mode ON public.user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_check_compact_mode_achievement();
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.trigger_check_emoji_uploaded_achievement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  BEGIN
    PERFORM public.award_achievement(
      NEW.created_by,
      'emoji_uploaded',
      jsonb_build_object('server_id', NEW.server_id, 'emoji_id', NEW.id)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.trigger_check_emoji_uploaded_achievement() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_check_emoji_uploaded_achievement'
      AND tgrelid = 'public.server_emojis'::regclass
  ) THEN
    CREATE TRIGGER trg_check_emoji_uploaded_achievement
    AFTER INSERT ON public.server_emojis
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_check_emoji_uploaded_achievement();
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.trigger_check_invite_created_achievement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  BEGIN
    PERFORM public.award_achievement(
      NEW.created_by,
      'first_invite_created',
      jsonb_build_object('server_id', NEW.server_id, 'invite_id', NEW.id)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.trigger_check_invite_created_achievement() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_check_invite_created_achievement'
      AND tgrelid = 'public.server_invites'::regclass
  ) THEN
    CREATE TRIGGER trg_check_invite_created_achievement
    AFTER INSERT ON public.server_invites
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_check_invite_created_achievement();
  END IF;
END
$$;

-- Backfill existing completed activity.
WITH friend_counts AS (
  SELECT user_id, count(*)::int AS friend_count
  FROM (
    SELECT f.requester_id AS user_id
    FROM public.friendships f
    WHERE f.status = 'accepted'::public.friendship_status
    UNION ALL
    SELECT f.addressee_id AS user_id
    FROM public.friendships f
    WHERE f.status = 'accepted'::public.friendship_status
  ) accepted_friends
  GROUP BY user_id
)
INSERT INTO public.user_achievements (user_id, achievement_slug, metadata)
SELECT fc.user_id, threshold.slug, jsonb_build_object('friend_count', fc.friend_count)
FROM friend_counts fc
CROSS JOIN (
  VALUES
    ('first_friend'::text, 1),
    ('10_friends'::text, 10),
    ('100_friends'::text, 100),
    ('1000_friends'::text, 1000)
) AS threshold(slug, required_count)
WHERE fc.friend_count >= threshold.required_count
ON CONFLICT DO NOTHING;

INSERT INTO public.user_achievements (user_id, achievement_slug, metadata)
SELECT DISTINCT dm.sender_id, 'first_dm', jsonb_build_object('conversation_id', dm.conversation_id)
FROM public.direct_messages dm
WHERE dm.sender_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.user_achievements (user_id, achievement_slug, metadata)
SELECT DISTINCT sm.user_id, 'join_a_server_from_explore_page', jsonb_build_object('server_id', sm.server_id)
FROM public.server_members sm
JOIN public.servers s ON s.id = sm.server_id
WHERE lower(COALESCE(sm.join_source, '')) = 'discover'
  AND COALESCE(s.is_published, false) = true
ON CONFLICT DO NOTHING;

INSERT INTO public.user_achievements (user_id, achievement_slug, metadata)
SELECT u.id, 'tagline_written', '{}'::jsonb
FROM public.users u
WHERE NULLIF(btrim(COALESCE(u.tagline, '')), '') IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.user_achievements (user_id, achievement_slug, metadata)
SELECT DISTINCT p.user_id, 'profile_post_created', jsonb_build_object('post_id', p.id)
FROM public.user_profile_posts p
ON CONFLICT DO NOTHING;

WITH dm_counts AS (
  SELECT dm.sender_id AS user_id, count(*)::int AS dm_count
  FROM public.direct_messages dm
  GROUP BY dm.sender_id
)
INSERT INTO public.user_achievements (user_id, achievement_slug, metadata)
SELECT dc.user_id, threshold.slug, jsonb_build_object('dm_count', dc.dm_count)
FROM dm_counts dc
CROSS JOIN (
  VALUES
    ('dm_10'::text, 10),
    ('dm_100'::text, 100)
) AS threshold(slug, required_count)
WHERE dc.dm_count >= threshold.required_count
ON CONFLICT DO NOTHING;

WITH mention_counts AS (
  SELECT m.user_id, count(*)::int AS mention_count
  FROM public.mentions m
  WHERE m.user_id IS NOT NULL
  GROUP BY m.user_id
)
INSERT INTO public.user_achievements (user_id, achievement_slug, metadata)
SELECT mc.user_id, 'mentioned_10_times', jsonb_build_object('mention_count', mc.mention_count)
FROM mention_counts mc
WHERE mc.mention_count >= 10
ON CONFLICT DO NOTHING;

WITH server_counts AS (
  SELECT sm.user_id, count(*)::int AS server_count
  FROM public.server_members sm
  WHERE COALESCE(sm.is_banned, false) = false
  GROUP BY sm.user_id
)
INSERT INTO public.user_achievements (user_id, achievement_slug, metadata)
SELECT sc.user_id, threshold.slug, jsonb_build_object('server_count', sc.server_count)
FROM server_counts sc
CROSS JOIN (
  VALUES
    ('first_server_join'::text, 1),
    ('join_10_servers'::text, 10),
    ('join_50_servers'::text, 50)
) AS threshold(slug, required_count)
WHERE sc.server_count >= threshold.required_count
ON CONFLICT DO NOTHING;

INSERT INTO public.user_achievements (user_id, achievement_slug, metadata)
SELECT DISTINCT s.owner_id, 'create_first_server', jsonb_build_object('server_id', s.id)
FROM public.servers s
WHERE s.owner_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.user_achievements (user_id, achievement_slug, metadata)
SELECT DISTINCT edited.user_id, 'message_edited', edited.metadata
FROM (
  SELECT m.user_id, jsonb_build_object('message_id', m.id, 'message_type', 'channel') AS metadata
  FROM public.messages m
  WHERE m.edited_at IS NOT NULL
    AND COALESCE(m.is_system_message, false) = false
  UNION ALL
  SELECT dm.sender_id AS user_id, jsonb_build_object('message_id', dm.id, 'message_type', 'dm') AS metadata
  FROM public.direct_messages dm
  WHERE dm.edited_at IS NOT NULL
) edited
WHERE edited.user_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.user_achievements (user_id, achievement_slug, metadata)
SELECT DISTINCT up.user_id, 'compact_mode_enabled', jsonb_build_object('compact_mode', up.compact_mode)
FROM public.user_preferences up
WHERE COALESCE(up.compact_mode, false) = true
ON CONFLICT DO NOTHING;

INSERT INTO public.user_achievements (user_id, achievement_slug, metadata)
SELECT DISTINCT se.created_by, 'emoji_uploaded', jsonb_build_object('server_id', se.server_id, 'emoji_id', se.id)
FROM public.server_emojis se
WHERE se.created_by IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.user_achievements (user_id, achievement_slug, metadata)
SELECT DISTINCT si.created_by, 'first_invite_created', jsonb_build_object('server_id', si.server_id, 'invite_id', si.id)
FROM public.server_invites si
WHERE si.created_by IS NOT NULL
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END
$$;
