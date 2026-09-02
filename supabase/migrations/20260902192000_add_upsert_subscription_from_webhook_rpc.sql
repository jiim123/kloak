-- Raw SQL upsert function for webhook handler (bypasses PostgREST)
CREATE OR REPLACE FUNCTION public.upsert_subscription_from_webhook(
  _user_id uuid,
  _plan_id text,
  _status text DEFAULT 'active',
  _customer_email text DEFAULT NULL,
  _subscription_id text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.user_subscriptions (
    user_id, plan_id, status, pocketsflow_customer_id,
    pocketsflow_subscription_id, cancel_at_period_end
  ) VALUES (
    _user_id, _plan_id, _status, _customer_email,
    _subscription_id, false
  )
  ON CONFLICT (user_id, plan_id) DO UPDATE SET
    status = EXCLUDED.status,
    pocketsflow_customer_id = EXCLUDED.pocketsflow_customer_id,
    pocketsflow_subscription_id = EXCLUDED.pocketsflow_subscription_id,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
