-- Ensure requesting_user_id() exists (may not be available locally)
CREATE OR REPLACE FUNCTION public.requesting_user_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  BEGIN
    RETURN public.get_request_user_id();
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      RETURN auth.uid();
    EXCEPTION WHEN OTHERS THEN
      RETURN NULL;
    END;
  END;
END;
$function$;

-- user_subscriptions: tracks Kloak Prime plan via Pocketsflow
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_id text NOT NULL DEFAULT 'kloak_prime' CHECK (plan_id = 'kloak_prime'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'unpaid', 'paused')),
  pocketsflow_customer_id text,
  pocketsflow_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, plan_id)
);

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions FORCE ROW LEVEL SECURITY;

-- Only service_role can write (via edge functions); anon/authenticated get read via RPC
REVOKE ALL ON public.user_subscriptions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.user_subscriptions TO service_role;
GRANT SELECT ON public.user_subscriptions TO anon, authenticated;

-- Users can read their own subscription
DROP POLICY IF EXISTS "Users read own subscription" ON public.user_subscriptions;
CREATE POLICY "Users read own subscription"
  ON public.user_subscriptions
  FOR SELECT
  USING (user_id = public.requesting_user_id()::text);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_user_subscriptions_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_user_subscriptions_updated_at ON public.user_subscriptions;
CREATE TRIGGER trg_touch_user_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_user_subscriptions_updated_at();

-- RPC: get the current user's active subscription (safe for anon/authenticated)
CREATE OR REPLACE FUNCTION public.get_my_subscription(_user_id text)
RETURNS jsonb AS $$
  SELECT to_jsonb(row)
  FROM (
    SELECT id, user_id, plan_id, status, current_period_start, current_period_end,
           cancel_at_period_end, created_at, updated_at
    FROM public.user_subscriptions
    WHERE user_id = _user_id
      AND status IN ('active', 'trialing', 'past_due')
    ORDER BY created_at DESC
    LIMIT 1
  ) row;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- RPC: check if a user has an active subscription (used for badge/feature gating)
CREATE OR REPLACE FUNCTION public.has_active_subscription(_user_id text)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_subscriptions
    WHERE user_id = _user_id
      AND status IN ('active', 'trialing')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- RPC: get subscription for a list of users (for badge display)
CREATE OR REPLACE FUNCTION public.get_user_subscription_badges(_user_ids text[])
RETURNS jsonb AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'user_id', s.user_id,
        'plan_id', s.plan_id,
        'status', s.status,
        'created_at', s.created_at
      )
    ),
    '[]'::jsonb
  )
  FROM (
    SELECT DISTINCT ON (user_id)
      user_id, plan_id, status, created_at
    FROM public.user_subscriptions
    WHERE user_id = ANY(_user_ids)
      AND status IN ('active', 'trialing')
    ORDER BY user_id, created_at DESC
  ) s;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON public.user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_pocketsflow_sub ON public.user_subscriptions(pocketsflow_subscription_id);
