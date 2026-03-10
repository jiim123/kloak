
-- Create muted_users table
CREATE TABLE IF NOT EXISTS public.muted_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason text,
  muted_at timestamptz NOT NULL DEFAULT now(),
  muted_until timestamptz,
  UNIQUE(user_id)
);
ALTER TABLE public.muted_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "muted_users_service_only" ON public.muted_users AS RESTRICTIVE FOR ALL TO public USING (CURRENT_USER = 'service_role'::name) WITH CHECK (CURRENT_USER = 'service_role'::name);
GRANT SELECT ON public.muted_users TO anon, authenticated;
