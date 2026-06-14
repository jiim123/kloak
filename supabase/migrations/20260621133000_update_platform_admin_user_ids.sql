-- Update platform admin allowlist.
-- Keep this in sync with src/lib/adminAccess.ts until admin roles move into the database.

CREATE OR REPLACE FUNCTION public.platform_admin_user_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT ARRAY[
    'd9ff3045-de3a-4878-9e4e-a015d43b00ab'::uuid,
    '925aea05-b0b7-4171-a925-e7dc8560014e'::uuid,
    'ce6e5466-80a5-42e0-835f-086e2347ea82'::uuid,
    'c3108f3f-d4ca-49c5-9dbf-bd83f9316db6'::uuid
  ]::uuid[];
$$;
