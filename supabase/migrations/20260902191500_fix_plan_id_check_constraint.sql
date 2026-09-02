-- Drop the old CHECK constraint that only allows kloak_plus/kloak_pro
ALTER TABLE public.user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_plan_id_check;

-- Add new constraint that only allows kloak_prime
ALTER TABLE public.user_subscriptions ADD CONSTRAINT user_subscriptions_plan_id_check CHECK (plan_id = 'kloak_prime');
