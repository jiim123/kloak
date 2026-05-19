-- Bot flow messages are deterministic by design, so a 10-second flow cooldown can
-- legitimately produce the same rendered content more than once. Human anti-spam
-- checks still apply to normal users.

CREATE OR REPLACE FUNCTION public.is_bot_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT u.is_bot FROM public.users u WHERE u.id = _user_id), false);
$$;

CREATE OR REPLACE FUNCTION public.check_message_rate_limit(_user_id uuid, _channel_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c1 int;
  c2 int;
BEGIN
  IF public.is_bot_user(_user_id) THEN
    RETURN true;
  END IF;

  SELECT count(*) INTO c1
  FROM public.messages
  WHERE user_id = _user_id
    AND channel_id = _channel_id
    AND created_at > now() - interval '1 minute';

  IF c1 >= 15 THEN
    RETURN false;
  END IF;

  SELECT count(*) INTO c2
  FROM public.messages
  WHERE user_id = _user_id
    AND channel_id = _channel_id
    AND created_at > now() - interval '5 seconds';

  RETURN c2 < 5;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_no_duplicate_message(_user_id uuid, _channel_id uuid, _content text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_bot_user(_user_id)
    OR NOT EXISTS (
      SELECT 1
      FROM public.messages
      WHERE user_id = _user_id
        AND channel_id = _channel_id
        AND content = _content
        AND created_at > now() - interval '5 minutes'
    );
$$;

CREATE OR REPLACE FUNCTION public.check_new_account_no_links(_user_id uuid, _content text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  age interval;
BEGIN
  IF public.is_bot_user(_user_id) THEN
    RETURN true;
  END IF;

  IF NOT (_content ~* '(https?://|www\.)') THEN
    RETURN true;
  END IF;

  SELECT now() - created_at INTO age
  FROM public.users
  WHERE id = _user_id;

  RETURN age IS NOT NULL AND age >= interval '30 minutes';
END;
$$;

