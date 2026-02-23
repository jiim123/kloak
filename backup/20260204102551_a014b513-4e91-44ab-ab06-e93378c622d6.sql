-- Server-side username validation function
-- This provides defense-in-depth by validating usernames at the database level

-- Create array of blocked username patterns (exact matches, normalized)
CREATE OR REPLACE FUNCTION public.is_username_blocked(username TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_username TEXT;
  blocked_words TEXT[] := ARRAY[
    -- Kloak brand
    'kloak', 'kloakapp', 'kloakofficial', 'kloakhq', 'kloakteam', 'kloaksupport',
    'kloakhelp', 'kloakadmin', 'kloakmod', 'kloakbot', 'kloakstaff', 'kloaksecurity',
    -- Administrative
    'admin', 'administrator', 'moderator', 'owner', 'staff', 'official', 'manager',
    'supervisor', 'superuser', 'sysadmin', 'systemadmin', 'root', 'sudo', 'operator',
    -- Support
    'support', 'helpdesk', 'customerservice', 'customersupport', 'contact', 'billing',
    -- System
    'system', 'server', 'bot', 'robot', 'automated', 'api', 'webhook', 'database',
    'localhost', 'null', 'undefined', 'void', 'none', 'test', 'testing',
    -- Security
    'security', 'abuse', 'spam', 'phishing', 'hack', 'hacker', 'exploit',
    'noreply', 'donotreply', 'postmaster', 'webmaster',
    -- Identity
    'everyone', 'anybody', 'someone', 'nobody', 'anonymous', 'anon', 'guest',
    'unknown', 'default', 'user', 'member', 'all',
    -- Platform
    'login', 'logout', 'signup', 'register', 'account', 'profile', 'settings',
    'dashboard', 'home', 'password', 'auth'
  ];
  blocked_substrings TEXT[] := ARRAY[
    'admin', 'moderator', 'support', 'official', 'staff', 'kloak', 'system',
    'security', 'hack', 'phish', 'spam', 'abuse', 'root', 'sudo', 'owner'
  ];
  word TEXT;
BEGIN
  -- Normalize: lowercase, remove underscores/hyphens, decode basic leet speak
  normalized_username := lower(username);
  normalized_username := regexp_replace(normalized_username, '[-_]', '', 'g');
  -- Basic leet speak decoding
  normalized_username := replace(normalized_username, '0', 'o');
  normalized_username := replace(normalized_username, '1', 'i');
  normalized_username := replace(normalized_username, '3', 'e');
  normalized_username := replace(normalized_username, '4', 'a');
  normalized_username := replace(normalized_username, '5', 's');
  normalized_username := replace(normalized_username, '7', 't');
  normalized_username := replace(normalized_username, '@', 'a');
  normalized_username := replace(normalized_username, '$', 's');

  -- Check exact match against blocked list
  FOREACH word IN ARRAY blocked_words LOOP
    IF normalized_username = word THEN
      RETURN TRUE;
    END IF;
  END LOOP;

  -- Check if contains blocked substrings
  FOREACH word IN ARRAY blocked_substrings LOOP
    IF position(word IN normalized_username) > 0 THEN
      RETURN TRUE;
    END IF;
  END LOOP;

  RETURN FALSE;
END;
$$;

-- Create validation trigger function
CREATE OR REPLACE FUNCTION public.validate_username_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if username is blocked
  IF public.is_username_blocked(NEW.username) THEN
    RAISE EXCEPTION 'Username is reserved or contains restricted words';
  END IF;

  -- Check length (3-32 characters)
  IF length(NEW.username) < 3 OR length(NEW.username) > 32 THEN
    RAISE EXCEPTION 'Username must be between 3 and 32 characters';
  END IF;

  -- Check allowed characters (alphanumeric, underscores, hyphens)
  IF NEW.username !~ '^[a-zA-Z0-9_-]+$' THEN
    RAISE EXCEPTION 'Username can only contain letters, numbers, underscores, and hyphens';
  END IF;

  -- Cannot start or end with underscore or hyphen
  IF NEW.username ~ '^[-_]' OR NEW.username ~ '[-_]$' THEN
    RAISE EXCEPTION 'Username cannot start or end with an underscore or hyphen';
  END IF;

  -- No consecutive special characters
  IF NEW.username ~ '[-_]{2,}' THEN
    RAISE EXCEPTION 'Username cannot contain consecutive special characters';
  END IF;

  -- Cannot be only numbers
  IF NEW.username ~ '^\d+$' THEN
    RAISE EXCEPTION 'Username cannot be only numbers';
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on users table
DROP TRIGGER IF EXISTS validate_username_trigger ON public.users;
CREATE TRIGGER validate_username_trigger
  BEFORE INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_username_on_insert();

-- Update the register_user RPC to include validation (it should pass through the trigger)
-- The trigger will automatically validate, but we can add explicit check for better error messages
CREATE OR REPLACE FUNCTION public.register_user(_username TEXT, _key_hash TEXT)
RETURNS TABLE(
  id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  banner_color TEXT,
  avatar_decoration TEXT,
  profile_effect TEXT,
  bio TEXT,
  custom_status TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  last_seen TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_user public.users%ROWTYPE;
BEGIN
  -- Pre-check blocked username for better error message
  IF public.is_username_blocked(_username) THEN
    RAISE EXCEPTION 'This username is reserved';
  END IF;

  INSERT INTO public.users (username, key_hash)
  VALUES (lower(_username), _key_hash)
  RETURNING * INTO new_user;

  RETURN QUERY SELECT 
    new_user.id,
    new_user.username,
    new_user.display_name,
    new_user.avatar_url,
    new_user.banner_url,
    new_user.banner_color,
    new_user.avatar_decoration,
    new_user.profile_effect,
    new_user.bio,
    new_user.custom_status,
    new_user.status::TEXT,
    new_user.created_at,
    new_user.last_seen;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_username_blocked(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_user(TEXT, TEXT) TO anon, authenticated;