
-- ============================================================
-- 1) Update is_username_blocked() with the FULL blocklist
--    matching the client-side blockedUsernames.ts
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_username_blocked(username text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_username TEXT;
  blocked_words TEXT[] := ARRAY[
    'kloak', 'kloakapp', 'kloakofficial', 'kloakhq', 'kloakteam', 'kloaksupport',
    'kloakhelp', 'kloakadmin', 'kloakmod', 'kloakbot', 'kloakstaff', 'kloaksecurity',
    'kloakdev', 'kloakapi', 'kloakservice', 'thekloak', 'aboutkloak', 'kloaknews',
    'kloakio', 'kloakchat',
    'admin', 'administrator', 'administration', 'mod', 'moderator', 'moderation',
    'owner', 'owners', 'staff', 'staffmember', 'team', 'teamlead', 'official',
    'officials', 'management', 'manager', 'supervisor', 'superuser', 'sysadmin',
    'systemadmin', 'root', 'sudo', 'operator', 'ops', 'executive', 'director',
    'founder', 'cofounder', 'ceo', 'cto', 'cfo', 'coo', 'president', 'vicepresident',
    'chairman', 'board', 'leadership', 'authority', 'authorities',
    'support', 'supports', 'supportteam', 'customersupport', 'customerservice',
    'help', 'helpdesk', 'helpme', 'assistance', 'contact', 'contactus', 'info',
    'information', 'billing', 'billings', 'sales', 'salesteam', 'service', 'services',
    'feedback', 'complaints', 'resolution', 'ticket', 'tickets', 'report', 'reports',
    'trust', 'safety', 'trustsafety', 'community', 'communityteam',
    'system', 'systems', 'server', 'servers', 'bot', 'bots', 'robot', 'robots',
    'automated', 'automation', 'daemon', 'mailer', 'mail', 'email', 'smtp', 'ftp',
    'http', 'https', 'www', 'api', 'apis', 'webhook', 'webhooks', 'database', 'db',
    'cache', 'redis', 'postgres', 'supabase', 'config', 'configuration', 'settings',
    'setup', 'install', 'localhost', 'local', 'dev', 'development', 'developer',
    'developers', 'test', 'testing', 'tester', 'debug', 'staging', 'production',
    'prod', 'null', 'undefined', 'void', 'nil', 'none', 'nan', 'infinity', 'true',
    'false', 'error', 'errors',
    'security', 'secure', 'securityteam', 'abuse', 'abuseteam', 'reportabuse',
    'spam', 'antispam', 'phishing', 'malware', 'virus', 'hack', 'hacker', 'hackers',
    'hacking', 'exploit', 'exploits', 'vulnerability', 'breach', 'databreach',
    'privacy', 'privacyteam', 'legal', 'legalteam', 'compliance', 'dmca', 'copyright',
    'takedown', 'verification', 'verify', 'verified', 'authenticate', 'authentication',
    'noreply', 'donotreply', 'postmaster', 'webmaster', 'hostmaster',
    'everyone', 'everybody', 'anyone', 'anybody', 'someone', 'somebody', 'nobody',
    'noone', 'all', 'alluser', 'allusers', 'here', 'channel', 'channels', 'member',
    'members', 'user', 'users', 'person', 'people', 'human', 'humans', 'anonymous',
    'anon', 'guest', 'guests', 'unknown', 'stranger', 'newuser', 'default',
    'defaultuser', 'placeholder', 'example', 'sample', 'template', 'dummy', 'fake',
    'real', 'realuser', 'me', 'myself', 'you', 'yourself', 'us', 'we', 'them',
    'they', 'it', 'this', 'that',
    'login', 'logout', 'signin', 'signout', 'signup', 'register', 'registration',
    'account', 'accounts', 'profile', 'profiles', 'preferences', 'dashboard', 'home',
    'homepage', 'main', 'landing', 'welcome', 'about', 'aboutus', 'terms', 'tos',
    'privacypolicy', 'cookies', 'cookiepolicy', 'faq', 'faqs', 'blog', 'news',
    'updates', 'changelog', 'status', 'statuspage', 'docs', 'documentation', 'wiki',
    'knowledgebase', 'kb', 'guidelines', 'rules', 'coc', 'codeofconduct', 'invite',
    'invites', 'join', 'create', 'delete', 'remove', 'edit', 'update', 'search',
    'explore', 'discover', 'trending', 'popular', 'featured', 'premium', 'pro', 'plus',
    'enterprise', 'business', 'free', 'trial', 'subscription', 'subscribe',
    'unsubscribe', 'pricing', 'plans', 'upgrade', 'downgrade', 'cancel', 'payment',
    'payments', 'checkout', 'store', 'shop', 'marketplace', 'app', 'apps', 'download',
    'downloads', 'mobile', 'desktop', 'web', 'oauth', 'sso', 'auth', 'confirm',
    'reset', 'password', 'passwords', 'forgot', 'recover', 'recovery', 'backup',
    'restore', 'import', 'export', 'data', 'archive', 'history',
    'ass', 'asshole', 'bastard', 'bitch', 'cunt', 'damn', 'dick', 'fuck', 'fucker',
    'fucking', 'hell', 'piss', 'shit', 'slut', 'whore', 'nigger', 'nigga', 'faggot',
    'fag', 'retard', 'retarded', 'nazi', 'hitler', 'porn', 'sex', 'xxx', 'penis',
    'vagina', 'cock', 'pussy', 'anus', 'dildo', 'orgasm', 'nude', 'naked', 'boob',
    'boobs', 'tits', 'titties', 'nipple', 'nipples', 'butthole', 'rape', 'rapist',
    'molest', 'pedo', 'pedophile', 'incest', 'bestiality', 'necro', 'gore', 'suicide',
    'killme', 'kys', 'kms',
    '123', '1234', '12345', '123456', '1234567', '12345678', '123456789',
    'password', 'pass', 'letmein', 'qwerty', 'abc123', '111111', '000000',
    'admin123', 'test123', 'user123', 'guest123', 'root123', 'temp', 'temporary',
    'passw0rd', 'welcome', 'welcome1', 'master', 'login123'
  ];
  blocked_substrings TEXT[] := ARRAY[
    'admin', 'moderator', 'support', 'official', 'staff', 'kloak', 'system',
    'security', 'hack', 'phish', 'spam', 'abuse', 'root', 'sudo', 'owner',
    'fuck', 'shit', 'bitch', 'nigger', 'nigga', 'faggot', 'retard', 'nazi',
    'hitler', 'porn', 'xxx', 'rape', 'pedo', 'incest', 'suicide', 'kys'
  ];
  word TEXT;
BEGIN
  normalized_username := lower(username);
  normalized_username := regexp_replace(normalized_username, '[-_]', '', 'g');
  normalized_username := replace(normalized_username, '0', 'o');
  normalized_username := replace(normalized_username, '1', 'i');
  normalized_username := replace(normalized_username, '!', 'i');
  normalized_username := replace(normalized_username, '|', 'i');
  normalized_username := replace(normalized_username, '3', 'e');
  normalized_username := replace(normalized_username, '4', 'a');
  normalized_username := replace(normalized_username, '@', 'a');
  normalized_username := replace(normalized_username, '5', 's');
  normalized_username := replace(normalized_username, '$', 's');
  normalized_username := replace(normalized_username, '7', 't');
  normalized_username := replace(normalized_username, '+', 't');
  normalized_username := replace(normalized_username, '8', 'b');
  normalized_username := replace(normalized_username, '9', 'g');
  normalized_username := replace(normalized_username, '6', 'g');

  FOREACH word IN ARRAY blocked_words LOOP
    IF normalized_username = word THEN
      RETURN TRUE;
    END IF;
  END LOOP;

  FOREACH word IN ARRAY blocked_substrings LOOP
    IF position(word IN normalized_username) > 0 THEN
      RETURN TRUE;
    END IF;
  END LOOP;

  IF normalized_username ~ '^\d+$' THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- ============================================================
-- 2) Update register_user() to call is_username_blocked()
-- ============================================================

CREATE OR REPLACE FUNCTION public.register_user(
  _username text,
  _key_hash text,
  _banner_color text DEFAULT '#5865F2'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_user_id uuid;
  result json;
  _client_id text;
  _key_bucket text;
BEGIN
  _client_id := public.request_client_identifier();
  _key_bucket := left(lower(COALESCE(_key_hash, '')), 16);

  IF _client_id <> 'unknown'
     AND NOT public.check_rate_limit(_client_id, 'register_user_client', 8, 60) THEN
    RAISE EXCEPTION 'Rate limited: too many registration attempts';
  END IF;

  IF _client_id <> 'unknown'
     AND NOT public.check_rate_limit(_client_id, 'register_user_hourly', 25, 3600) THEN
    RAISE EXCEPTION 'Rate limited: registration quota reached';
  END IF;

  IF _key_bucket <> ''
     AND NOT public.check_rate_limit(_key_bucket, 'register_user_keyhash', 3, 3600) THEN
    RAISE EXCEPTION 'Rate limited: key hash attempt quota reached';
  END IF;

  IF _key_hash IS NULL OR length(_key_hash) != 64 OR _key_hash !~ '^[a-fA-F0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid key hash format';
  END IF;

  IF _username IS NULL THEN
    RAISE EXCEPTION 'Username is required';
  END IF;

  _username := lower(trim(_username));

  IF length(_username) < 3 OR length(_username) > 20 THEN
    RAISE EXCEPTION 'Username must be between 3 and 20 characters';
  END IF;

  IF _username !~ '^[a-z0-9_]+$' THEN
    RAISE EXCEPTION 'Username can only contain lowercase letters, numbers, and underscores';
  END IF;

  IF _username ~ '^_' OR _username ~ '_$' THEN
    RAISE EXCEPTION 'Username cannot start or end with an underscore';
  END IF;

  IF _username ~ '_{2,}' THEN
    RAISE EXCEPTION 'Username cannot contain consecutive underscores';
  END IF;

  IF _username ~ '^\d+$' THEN
    RAISE EXCEPTION 'Username cannot be only numbers';
  END IF;

  -- SERVER-SIDE BLOCKLIST CHECK (prevents client-side bypass)
  IF public.is_username_blocked(_username) THEN
    RAISE EXCEPTION 'This username is not allowed';
  END IF;

  IF EXISTS (SELECT 1 FROM public.users WHERE username = _username) THEN
    RAISE EXCEPTION 'Username already taken';
  END IF;

  INSERT INTO public.users (username, status, banner_color)
  VALUES (_username, 'online', COALESCE(_banner_color, '#5865F2'))
  RETURNING id INTO new_user_id;

  INSERT INTO public.user_auth (user_id, key_hash)
  VALUES (new_user_id, _key_hash);

  SELECT json_build_object(
    'id', u.id,
    'username', u.username,
    'display_name', u.display_name,
    'avatar_url', u.avatar_url,
    'banner_url', u.banner_url,
    'avatar_decoration', u.avatar_decoration,
    'profile_effect', u.profile_effect,
    'banner_color', u.banner_color,
    'profile_theme_primary', u.profile_theme_primary,
    'profile_theme_accent', u.profile_theme_accent,
    'bio', u.bio,
    'status', u.status,
    'custom_status', u.custom_status,
    'created_at', u.created_at,
    'last_seen', u.last_seen
  ) INTO result
  FROM public.users u
  WHERE u.id = new_user_id;

  RETURN result;
END;
$$;
