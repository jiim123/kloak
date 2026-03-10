
-- =====================================================================
-- Rate-limit functions for reactions, friendships, server joins, etc.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.check_reaction_rate_limit(_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN check_rate_limit(_user_id::text, 'reaction_insert', 20, 60); END; $$;

CREATE OR REPLACE FUNCTION public.check_dm_reaction_rate_limit(_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN check_rate_limit(_user_id::text, 'dm_reaction_insert', 20, 60); END; $$;

CREATE OR REPLACE FUNCTION public.check_thread_reaction_rate_limit(_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN check_rate_limit(_user_id::text, 'thread_reaction_insert', 20, 60); END; $$;

CREATE OR REPLACE FUNCTION public.check_friendship_rate_limit(_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN check_rate_limit(_user_id::text, 'friendship_insert', 10, 3600); END; $$;

CREATE OR REPLACE FUNCTION public.check_server_join_rate_limit(_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN check_rate_limit(_user_id::text, 'server_join', 5, 600); END; $$;

CREATE OR REPLACE FUNCTION public.check_thread_rate_limit(_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN check_rate_limit(_user_id::text, 'thread_create', 5, 60); END; $$;

CREATE OR REPLACE FUNCTION public.check_attachment_rate_limit(_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN check_rate_limit(_user_id::text, 'attachment_insert', 10, 60); END; $$;

CREATE OR REPLACE FUNCTION public.check_channel_member_rate_limit(_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN check_rate_limit(_user_id::text, 'channel_member_add', 10, 60); END; $$;

CREATE OR REPLACE FUNCTION public.check_thread_message_rate_limit(_user_id uuid, _thread_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ DECLARE c1 int; c2 int; BEGIN
  SELECT count(*) INTO c1 FROM public.thread_messages
    WHERE user_id=_user_id AND thread_id=_thread_id AND created_at > now()-interval '1 minute';
  IF c1 >= 15 THEN RETURN false; END IF;
  SELECT count(*) INTO c2 FROM public.thread_messages
    WHERE user_id=_user_id AND thread_id=_thread_id AND created_at > now()-interval '5 seconds';
  RETURN c2 < 5;
END; $$;

-- =====================================================================
-- RESTRICTIVE rate-limit policies
-- =====================================================================

-- reactions
CREATE POLICY "reaction_rate_limit" ON public.reactions
  AS RESTRICTIVE FOR INSERT TO public WITH CHECK (check_reaction_rate_limit(user_id));

-- dm_reactions
CREATE POLICY "dm_reaction_rate_limit" ON public.dm_reactions
  AS RESTRICTIVE FOR INSERT TO public WITH CHECK (check_dm_reaction_rate_limit(user_id));

-- thread_reactions: rate limit + age check
CREATE POLICY "thread_reaction_rate_limit" ON public.thread_reactions
  AS RESTRICTIVE FOR INSERT TO public WITH CHECK (check_thread_reaction_rate_limit(user_id));

CREATE POLICY "thread_reactions_account_age_min_2m" ON public.thread_reactions
  AS RESTRICTIVE FOR INSERT TO public
  WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = requesting_user_id() AND u.created_at <= now() - interval '2 minutes'));

-- friendships: rate limit
CREATE POLICY "friendship_rate_limit" ON public.friendships
  AS RESTRICTIVE FOR INSERT TO public WITH CHECK (check_friendship_rate_limit(requester_id));

-- server_members: rate limit + mute + age check
CREATE POLICY "server_join_rate_limit" ON public.server_members
  AS RESTRICTIVE FOR INSERT TO public WITH CHECK (check_server_join_rate_limit(user_id));

CREATE POLICY "muted_users_cannot_join_servers" ON public.server_members
  AS RESTRICTIVE FOR INSERT TO public WITH CHECK (NOT is_user_muted(user_id));

CREATE POLICY "server_join_account_age_min_2m" ON public.server_members
  AS RESTRICTIVE FOR INSERT TO public
  WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = user_id AND u.created_at <= now() - interval '2 minutes'));

-- threads: rate limit
CREATE POLICY "thread_create_rate_limit" ON public.threads
  AS RESTRICTIVE FOR INSERT TO public WITH CHECK (check_thread_rate_limit(created_by));

-- thread_messages: rate limit + duplicate check
CREATE POLICY "thread_message_rate_limit" ON public.thread_messages
  AS RESTRICTIVE FOR INSERT TO public WITH CHECK (check_thread_message_rate_limit(user_id, thread_id));

CREATE POLICY "no_duplicate_thread_messages" ON public.thread_messages
  AS RESTRICTIVE FOR INSERT TO public
  WITH CHECK (NOT EXISTS (
    SELECT 1 FROM public.thread_messages tm
    WHERE tm.user_id = thread_messages.user_id
      AND tm.thread_id = thread_messages.thread_id
      AND tm.content = thread_messages.content
      AND tm.created_at > now() - interval '5 minutes'
  ));

-- dm_attachments: rate limit
CREATE POLICY "dm_attachment_rate_limit" ON public.dm_attachments
  AS RESTRICTIVE FOR INSERT TO public WITH CHECK (check_attachment_rate_limit((SELECT requesting_user_id())));

-- message_attachments: rate limit
CREATE POLICY "message_attachment_rate_limit" ON public.message_attachments
  AS RESTRICTIVE FOR INSERT TO public WITH CHECK (check_attachment_rate_limit((SELECT requesting_user_id())));

-- thread_attachments: rate limit
CREATE POLICY "thread_attachment_rate_limit" ON public.thread_attachments
  AS RESTRICTIVE FOR INSERT TO public WITH CHECK (check_attachment_rate_limit((SELECT requesting_user_id())));

-- channel_members: rate limit
CREATE POLICY "channel_member_rate_limit" ON public.channel_members
  AS RESTRICTIVE FOR INSERT TO public WITH CHECK (check_channel_member_rate_limit((SELECT requesting_user_id())));

-- =====================================================================
-- Updated content blocklist
-- =====================================================================

CREATE OR REPLACE FUNCTION public.message_content_allowed(content text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN NOT (
    content ILIKE '%asteroide%'
    OR content ILIKE '%niggersarebad%'
    OR content ILIKE '%niggers%'
    OR content ILIKE '%discord.com/invite%'
    OR content ILIKE '%discord.gg%'
    OR content ILIKE '%cant ban me%'
    OR content ILIKE '%can''t ban me%'
    OR content ILIKE '%platform sucks%'
    OR content ILIKE '%captcha solver%'
    OR content ILIKE '%rtc.asteroide%'
    OR content ILIKE '%0day%'
    OR content ILIKE '%dickride%'
    OR content ILIKE '%brainless skid%'
    OR content ILIKE '%free nitro%'
    OR content ILIKE '%telegram.me%'
    OR content ILIKE '%t.me/%'
    OR content ILIKE '%bit.ly%'
    OR content ILIKE '%tinyurl%'
    OR content ILIKE '%claim your%'
    OR content ILIKE '%click here%'
    OR content ILIKE '%join now free%'
  );
END;
$$;
