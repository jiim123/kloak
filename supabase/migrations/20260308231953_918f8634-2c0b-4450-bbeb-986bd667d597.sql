
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _ip_hash text,
  _action text,
  _max_attempts int,
  _window_seconds int
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _record RECORD;
BEGIN
  -- Upsert to avoid unique_violation on concurrent calls
  INSERT INTO auth_rate_limits (ip_hash, action, attempts, window_start)
  VALUES (_ip_hash, _action, 1, now())
  ON CONFLICT (ip_hash, action) DO NOTHING;

  SELECT * INTO _record
  FROM auth_rate_limits
  WHERE ip_hash = _ip_hash AND action = _action;

  -- Reset window if expired
  IF EXTRACT(EPOCH FROM (now() - _record.window_start)) > _window_seconds THEN
    UPDATE auth_rate_limits
    SET attempts = 1, window_start = now()
    WHERE ip_hash = _ip_hash AND action = _action;
    RETURN true;
  END IF;

  -- Block if over limit
  IF _record.attempts >= _max_attempts THEN
    RETURN false;
  END IF;

  UPDATE auth_rate_limits
  SET attempts = attempts + 1
  WHERE ip_hash = _ip_hash AND action = _action;

  RETURN true;
END;
$$;
