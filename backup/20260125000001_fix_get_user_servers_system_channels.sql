-- Fix get_user_servers to include system message channel fields
-- This migration ensures the function returns system_channel_join_id, system_channel_leave_id, enable_join_messages, and enable_leave_messages

CREATE OR REPLACE FUNCTION public.get_user_servers(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT json_agg(
      json_build_object(
        'id', s.id,
        'name', s.name,
        'owner_id', s.owner_id,
        'invite_code', s.invite_code,
        'icon_url', s.icon_url,
        'banner_url', s.banner_url,
        'is_published', s.is_published,
        'about', s.about,
        'system_channel_join_id', s.system_channel_join_id,
        'system_channel_leave_id', s.system_channel_leave_id,
        'enable_join_messages', s.enable_join_messages,
        'enable_leave_messages', s.enable_leave_messages,
        'created_at', s.created_at,
        'role', sm.role,
        'nickname', sm.nickname,
        'joined_at', sm.joined_at
      )
    )
    FROM server_members sm
    JOIN servers s ON s.id = sm.server_id
    WHERE sm.user_id = _user_id AND sm.is_banned = false
  );
END;
$$;
