-- Add notification and message display preferences to user_preferences table
ALTER TABLE public.user_preferences
ADD COLUMN IF NOT EXISTS desktop_notifications_enabled BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_sound_enabled BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS show_message_preview BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS compact_mode BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS show_timestamps BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS animate_emojis BOOLEAN NOT NULL DEFAULT true;