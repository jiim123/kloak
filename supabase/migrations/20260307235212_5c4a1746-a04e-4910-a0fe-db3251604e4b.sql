-- =====================================================
-- Security Fix 1: server_members UPDATE policy self-referential bug
-- The WITH CHECK clause compares server_members_1.server_id to itself (always true)
-- Fix: reference the outer table's server_id instead
-- =====================================================

DROP POLICY IF EXISTS "Users update own non-role data" ON public.server_members;

CREATE POLICY "Users update own non-role data" ON public.server_members
FOR UPDATE
USING (
  user_id = requesting_user_id()
  AND requesting_user_id() IS NOT NULL
)
WITH CHECK (
  user_id = requesting_user_id()
  AND role = (
    SELECT server_members_1.role
    FROM server_members server_members_1
    WHERE server_members_1.server_id = server_members.server_id
      AND server_members_1.user_id = requesting_user_id()
  )
  AND is_banned = (
    SELECT server_members_1.is_banned
    FROM server_members server_members_1
    WHERE server_members_1.server_id = server_members.server_id
      AND server_members_1.user_id = requesting_user_id()
  )
  AND is_muted = (
    SELECT server_members_1.is_muted
    FROM server_members server_members_1
    WHERE server_members_1.server_id = server_members.server_id
      AND server_members_1.user_id = requesting_user_id()
  )
);

-- =====================================================
-- Security Fix 2: Add identity guards to 4 SECURITY DEFINER helpers
-- Prevents probing membership via direct PostgREST RPC calls
-- Uses requesting_user_id() match (not verify_request_identity)
-- to avoid breaking RLS evaluation in nested/Realtime contexts
-- =====================================================

-- 2a: is_member_in_same_server
CREATE OR REPLACE FUNCTION public.is_member_in_same_server(_member_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _caller uuid;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;

  BEGIN
    _caller := public.requesting_user_id();
  EXCEPTION WHEN OTHERS THEN
    _caller := NULL;
  END;

  IF _caller IS NOT NULL AND _caller <> _user_id THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM server_members sm1
    JOIN server_members sm2 ON sm1.server_id = sm2.server_id
    WHERE sm1.id = _member_id AND sm2.user_id = _user_id
  );
END;
$$;

-- 2b: is_message_channel_member
CREATE OR REPLACE FUNCTION public.is_message_channel_member(_message_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _caller uuid;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;

  BEGIN
    _caller := public.requesting_user_id();
  EXCEPTION WHEN OTHERS THEN
    _caller := NULL;
  END;

  IF _caller IS NOT NULL AND _caller <> _user_id THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM messages m
    JOIN server_members sm ON sm.server_id = (
      SELECT c.server_id FROM channels c WHERE c.id = m.channel_id
    ) AND sm.user_id = _user_id AND sm.is_banned = false
    WHERE m.id = _message_id
  );
END;
$$;

-- 2c: is_media_channel_member
CREATE OR REPLACE FUNCTION public.is_media_channel_member(_media_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _caller uuid;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;

  BEGIN
    _caller := public.requesting_user_id();
  EXCEPTION WHEN OTHERS THEN
    _caller := NULL;
  END;

  IF _caller IS NOT NULL AND _caller <> _user_id THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM media_items mi
    JOIN server_members sm ON sm.server_id = (
      SELECT c.server_id FROM channels c WHERE c.id = mi.channel_id
    ) AND sm.user_id = _user_id AND sm.is_banned = false
    WHERE mi.id = _media_id
  );
END;
$$;

-- 2d: is_category_server_member
CREATE OR REPLACE FUNCTION public.is_category_server_member(_category_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _caller uuid;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;

  BEGIN
    _caller := public.requesting_user_id();
  EXCEPTION WHEN OTHERS THEN
    _caller := NULL;
  END;

  IF _caller IS NOT NULL AND _caller <> _user_id THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM channel_categories cc
    JOIN server_members sm ON sm.server_id = cc.server_id
    WHERE cc.id = _category_id AND sm.user_id = _user_id
  );
END;
$$;

-- =====================================================
-- Security Fix 3: Add permissive SELECT policy on users for public role
-- The existing policy gates on CURRENT_USER = 'realtime', blocking
-- security_invoker view queries from anon/authenticated roles.
-- This new policy allows visibility-checked access for PostgREST queries.
-- =====================================================

CREATE POLICY "users_select_with_visibility"
ON public.users
FOR SELECT
TO public
USING (
  (SELECT requesting_user_id()) IS NOT NULL
  AND can_view_user(id, (SELECT requesting_user_id()))
);