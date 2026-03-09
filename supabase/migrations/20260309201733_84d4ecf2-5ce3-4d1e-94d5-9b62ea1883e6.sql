
-- Phase 1: Registration rate limits table
CREATE TABLE public.registration_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash text NOT NULL,
  attempt_count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  daily_count integer NOT NULL DEFAULT 1,
  daily_window_start timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rate_limits_ip_hash ON public.registration_rate_limits (ip_hash);
CREATE INDEX idx_rate_limits_window ON public.registration_rate_limits (window_start);

ALTER TABLE public.registration_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies = no client access. Edge Functions use service role key which bypasses RLS.

-- Grant service_role access
GRANT ALL ON public.registration_rate_limits TO service_role;
