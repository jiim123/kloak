-- Disable the retired proof-of-work registration path and harden its leftover rate-limit state.

REVOKE ALL ON TABLE public.pow_challenges FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pow_challenges TO service_role;

REVOKE ALL ON TABLE public.registration_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.registration_rate_limits TO service_role;

WITH collapsed AS (
  SELECT
    (array_agg(id ORDER BY last_attempt_at DESC NULLS LAST, id::text))[1] AS keep_id,
    ip_hash,
    COALESCE(
      sum(
        CASE
          WHEN window_start > now() - interval '1 hour' THEN attempt_count
          ELSE 0
        END
      )::integer,
      0
    ) AS attempt_count,
    COALESCE(
      min(
        CASE
          WHEN window_start > now() - interval '1 hour' THEN window_start
          ELSE NULL
        END
      ),
      now()
    ) AS window_start,
    COALESCE(
      sum(
        CASE
          WHEN daily_window_start > now() - interval '24 hours' THEN daily_count
          ELSE 0
        END
      )::integer,
      0
    ) AS daily_count,
    COALESCE(
      min(
        CASE
          WHEN daily_window_start > now() - interval '24 hours' THEN daily_window_start
          ELSE NULL
        END
      ),
      now()
    ) AS daily_window_start,
    max(last_attempt_at) AS last_attempt_at
  FROM public.registration_rate_limits
  GROUP BY ip_hash
),
updated AS (
  UPDATE public.registration_rate_limits AS r
  SET
    attempt_count = c.attempt_count,
    window_start = c.window_start,
    daily_count = c.daily_count,
    daily_window_start = c.daily_window_start,
    last_attempt_at = c.last_attempt_at
  FROM collapsed AS c
  WHERE r.id = c.keep_id
)
DELETE FROM public.registration_rate_limits AS r
USING collapsed AS c
WHERE r.ip_hash = c.ip_hash
  AND r.id <> c.keep_id;

CREATE UNIQUE INDEX IF NOT EXISTS registration_rate_limits_ip_hash_key
  ON public.registration_rate_limits (ip_hash);

CREATE OR REPLACE FUNCTION public.consume_registration_rate_limit(
  _ip_hash text,
  _hourly_limit integer DEFAULT 3,
  _daily_limit integer DEFAULT 10,
  _hourly_window_seconds integer DEFAULT 3600,
  _daily_window_seconds integer DEFAULT 86400
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_row public.registration_rate_limits%ROWTYPE;
  next_attempt_count integer;
  next_daily_count integer;
  next_window_start timestamptz;
  next_daily_window_start timestamptz;
BEGIN
  IF _ip_hash IS NULL OR btrim(_ip_hash) = '' THEN
    RAISE EXCEPTION 'Registration limiter requires a non-empty ip_hash';
  END IF;

  INSERT INTO public.registration_rate_limits (
    ip_hash,
    attempt_count,
    window_start,
    daily_count,
    daily_window_start,
    last_attempt_at
  )
  VALUES (_ip_hash, 0, now(), 0, now(), now())
  ON CONFLICT (ip_hash) DO NOTHING;

  SELECT *
  INTO current_row
  FROM public.registration_rate_limits
  WHERE ip_hash = _ip_hash
  FOR UPDATE;

  next_attempt_count := current_row.attempt_count;
  next_window_start := current_row.window_start;
  next_daily_count := current_row.daily_count;
  next_daily_window_start := current_row.daily_window_start;

  IF EXTRACT(EPOCH FROM (now() - current_row.window_start)) > _hourly_window_seconds THEN
    next_attempt_count := 0;
    next_window_start := now();
  END IF;

  IF EXTRACT(EPOCH FROM (now() - current_row.daily_window_start)) > _daily_window_seconds THEN
    next_daily_count := 0;
    next_daily_window_start := now();
  END IF;

  IF next_attempt_count >= _hourly_limit OR next_daily_count >= _daily_limit THEN
    UPDATE public.registration_rate_limits
    SET
      attempt_count = next_attempt_count,
      window_start = next_window_start,
      daily_count = next_daily_count,
      daily_window_start = next_daily_window_start,
      last_attempt_at = now()
    WHERE id = current_row.id;

    RETURN jsonb_build_object(
      'allowed', false,
      'attempt_count', next_attempt_count,
      'daily_count', next_daily_count
    );
  END IF;

  next_attempt_count := next_attempt_count + 1;
  next_daily_count := next_daily_count + 1;

  UPDATE public.registration_rate_limits
  SET
    attempt_count = next_attempt_count,
    window_start = next_window_start,
    daily_count = next_daily_count,
    daily_window_start = next_daily_window_start,
    last_attempt_at = now()
  WHERE id = current_row.id;

  RETURN jsonb_build_object(
    'allowed', true,
    'attempt_count', next_attempt_count,
    'daily_count', next_daily_count
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_registration_rate_limit(text, integer, integer, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_registration_rate_limit(text, integer, integer, integer, integer)
  TO service_role;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
