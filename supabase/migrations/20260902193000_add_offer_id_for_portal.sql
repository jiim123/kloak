-- Add pocketsflow_offer_id to store the subscription offer ID (needed for portal URL)
-- The portal URL format is: https://bugdrop.pocketsflow.com/portal/{subscriptionId}/{subscriptionCustomerId}
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS pocketsflow_offer_id text;
