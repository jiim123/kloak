-- Harden remaining permissive SELECT policies that can leak private data.

-- -------------------------------------------------------------------
-- user_devices: must never be globally readable.
-- -------------------------------------------------------------------
DROP POLICY IF EXISTS "Devices are readable" ON public.user_devices;
DROP POLICY IF EXISTS "Devices readable" ON public.user_devices;
DROP POLICY IF EXISTS "User devices are readable" ON public.user_devices;

CREATE POLICY "Users can view own devices"
  ON public.user_devices
  FOR SELECT
  USING (user_id = (SELECT public.requesting_user_id()));

CREATE POLICY "Users can insert own devices"
  ON public.user_devices
  FOR INSERT
  WITH CHECK (user_id = (SELECT public.requesting_user_id()));

CREATE POLICY "Users can update own devices"
  ON public.user_devices
  FOR UPDATE
  USING (user_id = (SELECT public.requesting_user_id()))
  WITH CHECK (user_id = (SELECT public.requesting_user_id()));

CREATE POLICY "Users can delete own devices"
  ON public.user_devices
  FOR DELETE
  USING (user_id = (SELECT public.requesting_user_id()));

-- -------------------------------------------------------------------
-- messages: enforce channel access through centralized checker.
-- This closes edge cases where role/override joins can bypass ban checks.
-- -------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read messages with permission" ON public.messages;
DROP POLICY IF EXISTS "Server members view channel messages" ON public.messages;
DROP POLICY IF EXISTS "Messages are viewable" ON public.messages;
DROP POLICY IF EXISTS "Messages viewable by channel members" ON public.messages;

CREATE POLICY "Messages readable by channel access"
  ON public.messages
  FOR SELECT
  USING (
    (SELECT public.requesting_user_id()) IS NOT NULL
    AND public.can_access_channel(channel_id, (SELECT public.requesting_user_id()))
  );
