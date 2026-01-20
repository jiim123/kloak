-- Add manage_emojis to permission_type enum
-- Required so role/channel permission writes for this permission don't fail.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = 'public.permission_type'::regtype
      AND enumlabel = 'manage_emojis'
  ) THEN
    ALTER TYPE public.permission_type ADD VALUE 'manage_emojis';
  END IF;
END $$;

