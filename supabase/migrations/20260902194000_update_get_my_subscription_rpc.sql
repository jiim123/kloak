-- Update get_my_subscription to return pocketsflow_offer_id for portal URL
CREATE OR REPLACE FUNCTION public.get_my_subscription(_user_id uuid)
RETURNS jsonb AS $$
  SELECT to_jsonb(row)
  FROM (
    SELECT id, user_id, plan_id, status, current_period_start, current_period_end,
           cancel_at_period_end, pocketsflow_subscription_id, pocketsflow_offer_id,
           created_at, updated_at
    FROM public.user_subscriptions
    WHERE user_id = _user_id
      AND status IN ('active', 'trialing', 'past_due')
    ORDER BY created_at DESC
    LIMIT 1
  ) row;
$$ LANGUAGE sql SECURITY DEFINER STABLE;
