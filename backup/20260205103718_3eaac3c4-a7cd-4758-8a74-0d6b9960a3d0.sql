-- Update the get_user_servers RPC to include is_muted field
CREATE OR REPLACE FUNCTION public.get_user_servers(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
    FROM (
      SELECT 
        s.id,
        s.name,
        s.owner_id,
        s.invite_code,
        s.icon_url,
        s.banner_url,
        s.is_published,
        s.about,
        s.system_channel_join_id,
        s.system_channel_leave_id,
        s.enable_join_messages,
        s.enable_leave_messages,
        s.created_at,
        sm.role,
        sm.nickname,
        sm.joined_at,
        sm.is_muted
      FROM servers s
      INNER JOIN server_members sm ON sm.server_id = s.id
      WHERE sm.user_id = _user_id
        AND (sm.is_banned IS NULL OR sm.is_banned = false)
      ORDER BY s.name ASC
    ) t
  );
END;
$$;