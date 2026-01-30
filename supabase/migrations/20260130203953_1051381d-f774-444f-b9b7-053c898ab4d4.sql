-- Add link restriction and ghost mode columns to channels
ALTER TABLE public.channels
ADD COLUMN IF NOT EXISTS block_links boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS allowed_link_domains text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS ghost_mode boolean NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.channels.block_links IS 'When true, only admins/owners can post links';
COMMENT ON COLUMN public.channels.allowed_link_domains IS 'Whitelisted domains when block_links is true (e.g. github.com)';
COMMENT ON COLUMN public.channels.ghost_mode IS 'When true, hides user avatars and usernames (except for admins/owners)';