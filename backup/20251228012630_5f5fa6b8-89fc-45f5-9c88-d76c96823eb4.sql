-- Add icon column to channels table for Noto Emoji icons
ALTER TABLE public.channels 
ADD COLUMN icon TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.channels.icon IS 'Noto Emoji character used as channel icon';