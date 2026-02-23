-- Add optional role icon (unicode emoji or :custom_emoji:)
ALTER TABLE public.server_roles
ADD COLUMN IF NOT EXISTS icon text;

