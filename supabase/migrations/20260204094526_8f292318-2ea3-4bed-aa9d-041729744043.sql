-- Add column to track secret key reset timestamps
ALTER TABLE public.users 
ADD COLUMN last_key_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create RPC function to reset secret key with 24-hour cooldown
CREATE OR REPLACE FUNCTION public.reset_user_secret_key(
  _user_id UUID,
  _new_key_hash CHAR(64)
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_reset TIMESTAMP WITH TIME ZONE;
  v_cooldown_hours INT := 24;
  v_time_remaining INTERVAL;
BEGIN
  -- Get the last reset timestamp
  SELECT last_key_reset_at INTO v_last_reset
  FROM users
  WHERE id = _user_id;
  
  -- Check if user is within cooldown period
  IF v_last_reset IS NOT NULL AND 
     v_last_reset > (NOW() - (v_cooldown_hours || ' hours')::INTERVAL) THEN
    v_time_remaining := v_last_reset + (v_cooldown_hours || ' hours')::INTERVAL - NOW();
    RETURN json_build_object(
      'success', false,
      'error', 'cooldown',
      'cooldown_ends_at', v_last_reset + (v_cooldown_hours || ' hours')::INTERVAL,
      'hours_remaining', EXTRACT(EPOCH FROM v_time_remaining) / 3600
    );
  END IF;
  
  -- Update the key hash and reset timestamp
  UPDATE users
  SET 
    key_hash = _new_key_hash,
    last_key_reset_at = NOW()
  WHERE id = _user_id;
  
  RETURN json_build_object(
    'success', true,
    'last_key_reset_at', NOW()
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.reset_user_secret_key(UUID, CHAR(64)) TO anon, authenticated;