
-- All helper functions and RLS policies
CREATE OR REPLACE FUNCTION public.is_user_muted(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.muted_users WHERE user_id = _user_id AND (muted_until IS NULL OR muted_until > now())); $$;

CREATE OR REPLACE FUNCTION public.check_message_rate_limit(_user_id uuid, _channel_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ DECLARE c1 int; c2 int; BEGIN
  SELECT count(*) INTO c1 FROM public.messages WHERE user_id=_user_id AND channel_id=_channel_id AND created_at > now()-interval '1 minute';
  IF c1>=15 THEN RETURN false; END IF;
  SELECT count(*) INTO c2 FROM public.messages WHERE user_id=_user_id AND channel_id=_channel_id AND created_at > now()-interval '5 seconds';
  RETURN c2<5; END; $$;

CREATE OR REPLACE FUNCTION public.check_dm_rate_limit(_user_id uuid, _conv_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ DECLARE c1 int; c2 int; BEGIN
  SELECT count(*) INTO c1 FROM public.direct_messages WHERE sender_id=_user_id AND conversation_id=_conv_id AND created_at > now()-interval '1 minute';
  IF c1>=15 THEN RETURN false; END IF;
  SELECT count(*) INTO c2 FROM public.direct_messages WHERE sender_id=_user_id AND conversation_id=_conv_id AND created_at > now()-interval '5 seconds';
  RETURN c2<5; END; $$;

CREATE OR REPLACE FUNCTION public.check_no_duplicate_message(_user_id uuid, _channel_id uuid, _content text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT NOT EXISTS (SELECT 1 FROM public.messages WHERE user_id=_user_id AND channel_id=_channel_id AND content=_content AND created_at > now()-interval '5 minutes'); $$;

CREATE OR REPLACE FUNCTION public.check_no_duplicate_dm(_user_id uuid, _conv_id uuid, _content text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT NOT EXISTS (SELECT 1 FROM public.direct_messages WHERE sender_id=_user_id AND conversation_id=_conv_id AND content=_content AND created_at > now()-interval '5 minutes'); $$;

CREATE OR REPLACE FUNCTION public.check_new_account_no_links(_user_id uuid, _content text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$ DECLARE age interval; BEGIN
  IF NOT (_content ~* '(https?://|www\.)') THEN RETURN true; END IF;
  SELECT (now()-created_at) INTO age FROM public.users WHERE id=_user_id;
  RETURN age IS NOT NULL AND age >= interval '30 minutes'; END; $$;

-- RLS policies
CREATE POLICY "muted_users_cannot_send_messages" ON public.messages AS RESTRICTIVE FOR INSERT TO public WITH CHECK (NOT is_user_muted(user_id));
CREATE POLICY "muted_users_cannot_send_dms" ON public.direct_messages AS RESTRICTIVE FOR INSERT TO public WITH CHECK (NOT is_user_muted(sender_id));
CREATE POLICY "muted_users_cannot_add_reactions" ON public.reactions AS RESTRICTIVE FOR INSERT TO public WITH CHECK (NOT is_user_muted(user_id));
CREATE POLICY "muted_users_cannot_add_dm_reactions" ON public.dm_reactions AS RESTRICTIVE FOR INSERT TO public WITH CHECK (NOT is_user_muted(user_id));
CREATE POLICY "muted_users_cannot_send_friend_requests" ON public.friendships AS RESTRICTIVE FOR INSERT TO public WITH CHECK (NOT is_user_muted(requester_id));
CREATE POLICY "message_rate_limit" ON public.messages AS RESTRICTIVE FOR INSERT TO public WITH CHECK (check_message_rate_limit(user_id, channel_id));
CREATE POLICY "dm_rate_limit" ON public.direct_messages AS RESTRICTIVE FOR INSERT TO public WITH CHECK (check_dm_rate_limit(sender_id, conversation_id));
CREATE POLICY "no_duplicate_messages" ON public.messages AS RESTRICTIVE FOR INSERT TO public WITH CHECK (check_no_duplicate_message(user_id, channel_id, content));
CREATE POLICY "no_duplicate_dms" ON public.direct_messages AS RESTRICTIVE FOR INSERT TO public WITH CHECK (check_no_duplicate_dm(sender_id, conversation_id, content));
CREATE POLICY "mention_limit_messages" ON public.messages AS RESTRICTIVE FOR INSERT TO public WITH CHECK (check_mention_limit(content));
CREATE POLICY "mention_limit_dms" ON public.direct_messages AS RESTRICTIVE FOR INSERT TO public WITH CHECK (check_mention_limit(content));
CREATE POLICY "message_length_limit" ON public.messages AS RESTRICTIVE FOR INSERT TO public WITH CHECK (length(content) <= 4000);
CREATE POLICY "new_account_no_links_messages" ON public.messages AS RESTRICTIVE FOR INSERT TO public WITH CHECK (check_new_account_no_links(user_id, content));
CREATE POLICY "new_account_no_links_dms" ON public.direct_messages AS RESTRICTIVE FOR INSERT TO public WITH CHECK (check_new_account_no_links(sender_id, content));

-- Thread policies
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='thread_messages') THEN
    EXECUTE 'CREATE POLICY "muted_users_no_threads" ON public.thread_messages AS RESTRICTIVE FOR INSERT TO public WITH CHECK (NOT is_user_muted(user_id))';
    EXECUTE 'CREATE POLICY "mention_limit_threads" ON public.thread_messages AS RESTRICTIVE FOR INSERT TO public WITH CHECK (check_mention_limit(content))';
    EXECUTE 'CREATE POLICY "thread_length_limit" ON public.thread_messages AS RESTRICTIVE FOR INSERT TO public WITH CHECK (length(content) <= 4000)';
    EXECUTE 'CREATE POLICY "new_account_no_links_threads" ON public.thread_messages AS RESTRICTIVE FOR INSERT TO public WITH CHECK (check_new_account_no_links(user_id, content))';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='thread_reactions') THEN
    EXECUTE 'CREATE POLICY "muted_users_no_thread_reactions" ON public.thread_reactions AS RESTRICTIVE FOR INSERT TO public WITH CHECK (NOT is_user_muted(user_id))';
  END IF;
END; $$;

-- Registration spike detection
CREATE OR REPLACE FUNCTION public.check_registration_spike()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ DECLARE recent_count int; admin_id uuid; BEGIN
  SELECT count(*) INTO recent_count FROM public.users WHERE created_at > now() - interval '10 minutes';
  IF recent_count > 10 THEN
    SELECT u.id INTO admin_id FROM public.users u JOIN public.server_members sm ON sm.user_id=u.id AND sm.role='owner' ORDER BY u.created_at ASC LIMIT 1;
    IF admin_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body) VALUES (admin_id, 'mention', 'Registration Spike Alert', recent_count || ' accounts created in the last 10 minutes. Possible bot attack.') ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS registration_spike_check ON public.users;
CREATE TRIGGER registration_spike_check AFTER INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION check_registration_spike();
