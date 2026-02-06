-- Add new notification preference columns to user_preferences table
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS browser_notifications_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_sound_server_mentions BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_sound_user_mentions BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_sound_replies BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_volume INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS show_preview_server_mentions BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_preview_user_mentions BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_preview_replies BOOLEAN DEFAULT true;

-- Add check constraint for volume range
ALTER TABLE public.user_preferences 
ADD CONSTRAINT notification_volume_range CHECK (notification_volume >= 0 AND notification_volume <= 100);