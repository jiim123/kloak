-- Add avatar_decoration field to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS avatar_decoration TEXT;
