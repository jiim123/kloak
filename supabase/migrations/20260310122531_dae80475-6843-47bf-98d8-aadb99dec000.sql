
-- ============================================================
-- 1. Rate-limit functions for servers and declined_friend_requests
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_server_create_rate_limit(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    SELECT count(*) FROM public.servers
    WHERE owner_id = _user_id
      AND created_at > now() - interval '1 hour'
  ) < 3;
$$;

CREATE OR REPLACE FUNCTION public.check_decline_rate_limit(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    SELECT count(*) FROM public.declined_friend_requests
    WHERE addressee_id = _user_id
      AND declined_at > now() - interval '1 hour'
  ) < 20;
$$;

-- ============================================================
-- 2. Mute checks — 7 tables
-- ============================================================

CREATE POLICY "muted_users_no_channel_members"
  ON public.channel_members AS RESTRICTIVE
  FOR INSERT TO public
  WITH CHECK (NOT is_user_muted(user_id));

CREATE POLICY "muted_users_no_dm_attachments"
  ON public.dm_attachments AS RESTRICTIVE
  FOR INSERT TO public
  WITH CHECK (NOT is_user_muted(( SELECT requesting_user_id() )));

CREATE POLICY "muted_users_no_msg_attachments"
  ON public.message_attachments AS RESTRICTIVE
  FOR INSERT TO public
  WITH CHECK (NOT is_user_muted(( SELECT requesting_user_id() )));

CREATE POLICY "muted_users_no_thread_attachments"
  ON public.thread_attachments AS RESTRICTIVE
  FOR INSERT TO public
  WITH CHECK (NOT is_user_muted(( SELECT requesting_user_id() )));

CREATE POLICY "muted_users_no_threads"
  ON public.threads AS RESTRICTIVE
  FOR INSERT TO public
  WITH CHECK (NOT is_user_muted(( SELECT requesting_user_id() )));

CREATE POLICY "muted_users_no_servers"
  ON public.servers AS RESTRICTIVE
  FOR INSERT TO public
  WITH CHECK (NOT is_user_muted(owner_id));

CREATE POLICY "muted_users_no_decline"
  ON public.declined_friend_requests AS RESTRICTIVE
  FOR INSERT TO public
  WITH CHECK (NOT is_user_muted(addressee_id));

-- ============================================================
-- 3. Account age gates (2 min) — 7 tables
-- ============================================================

CREATE POLICY "age_gate_channel_members"
  ON public.channel_members AS RESTRICTIVE
  FOR INSERT TO public
  WITH CHECK (EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = requesting_user_id()
      AND u.created_at <= (now() - interval '2 minutes')
  ));

CREATE POLICY "age_gate_dm_attachments"
  ON public.dm_attachments AS RESTRICTIVE
  FOR INSERT TO public
  WITH CHECK (EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = requesting_user_id()
      AND u.created_at <= (now() - interval '2 minutes')
  ));

CREATE POLICY "age_gate_msg_attachments"
  ON public.message_attachments AS RESTRICTIVE
  FOR INSERT TO public
  WITH CHECK (EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = requesting_user_id()
      AND u.created_at <= (now() - interval '2 minutes')
  ));

CREATE POLICY "age_gate_thread_attachments"
  ON public.thread_attachments AS RESTRICTIVE
  FOR INSERT TO public
  WITH CHECK (EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = requesting_user_id()
      AND u.created_at <= (now() - interval '2 minutes')
  ));

CREATE POLICY "age_gate_threads"
  ON public.threads AS RESTRICTIVE
  FOR INSERT TO public
  WITH CHECK (EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = requesting_user_id()
      AND u.created_at <= (now() - interval '2 minutes')
  ));

CREATE POLICY "age_gate_servers"
  ON public.servers AS RESTRICTIVE
  FOR INSERT TO public
  WITH CHECK (EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = requesting_user_id()
      AND u.created_at <= (now() - interval '2 minutes')
  ));

CREATE POLICY "age_gate_declined_requests"
  ON public.declined_friend_requests AS RESTRICTIVE
  FOR INSERT TO public
  WITH CHECK (EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = requesting_user_id()
      AND u.created_at <= (now() - interval '2 minutes')
  ));

-- ============================================================
-- 4. Rate limits for servers and declined_friend_requests
-- ============================================================

CREATE POLICY "server_create_rate_limit"
  ON public.servers AS RESTRICTIVE
  FOR INSERT TO public
  WITH CHECK (check_server_create_rate_limit(owner_id));

CREATE POLICY "decline_rate_limit"
  ON public.declined_friend_requests AS RESTRICTIVE
  FOR INSERT TO public
  WITH CHECK (check_decline_rate_limit(addressee_id));
