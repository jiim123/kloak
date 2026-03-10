/**
 * Comprehensive username validation and blocking utility
 * Protects against impersonation, system account confusion, and offensive usernames
 */

// ============================================
// BLOCKED USERNAME LISTS BY CATEGORY
// ============================================

const KLOAK_BRAND_OFFICIAL = [
  'kloak', 'kloakapp', 'kloak_app', 'kloak-app', 'thekloak', 'the_kloak', 
  'kloakofficial', 'kloak_official', 'kloakhq', 'kloak_hq', 'kloakteam', 
  'kloak_team', 'kloaksupport', 'kloak_support', 'kloakhelp', 'kloak_help', 
  'kloakadmin', 'kloak_admin', 'kloakmod', 'kloak_mod', 'kloakbot', 'kloak_bot',
  'kloakservice', 'kloak_service', 'kloakstaff', 'kloak_staff', 'kloaksecurity', 
  'kloak_security', 'kloakdev', 'kloak_dev', 'kloakapi', 'kloak_api', 
  'aboutkloak', 'kloak_news', 'kloaknews', 'kloakio', 'kloakchat',
];

const ADMINISTRATIVE_AUTHORITY = [
  'admin', 'administrator', 'administration', 'mod', 'moderator', 'moderation', 
  'owner', 'owners', 'staff', 'staffmember', 'team', 'teamlead', 'official', 
  'officials', 'management', 'manager', 'supervisor', 'superuser', 'sysadmin', 
  'systemadmin', 'root', 'sudo', 'operator', 'ops', 'executive', 'director', 
  'founder', 'cofounder', 'ceo', 'cto', 'cfo', 'coo', 'president', 'vicepresident', 
  'chairman', 'board', 'leadership', 'authority', 'authorities',
];

const SUPPORT_SERVICE = [
  'support', 'supports', 'supportteam', 'customersupport', 'customer_support', 
  'customerservice', 'customer_service', 'help', 'helpdesk', 'help_desk', 'helpme', 
  'assistance', 'contact', 'contactus', 'contact_us', 'info', 'information', 
  'billing', 'billings', 'sales', 'salesteam', 'service', 'services', 'feedback', 
  'complaints', 'resolution', 'ticket', 'tickets', 'report', 'reports', 'trust', 
  'safety', 'trustsafety', 'trust_safety', 'community', 'communityteam', 'community_team',
];

const SYSTEM_TECHNICAL = [
  'system', 'systems', 'server', 'servers', 'bot', 'bots', 'robot', 'robots', 
  'automated', 'automation', 'daemon', 'mailer', 'mail', 'email', 'smtp', 'ftp', 
  'http', 'https', 'www', 'api', 'apis', 'webhook', 'webhooks', 'database', 'db', 
  'cache', 'redis', 'postgres', 'supabase', 'config', 'configuration', 'settings', 
  'setup', 'install', 'localhost', 'local', 'dev', 'development', 'developer', 
  'developers', 'test', 'testing', 'tester', 'debug', 'staging', 'production', 
  'prod', 'null', 'undefined', 'void', 'nil', 'none', 'nan', 'infinity', 'true', 
  'false', 'error', 'errors',
];

const SECURITY_ABUSE = [
  'security', 'secure', 'securityteam', 'security_team', 'abuse', 'abuseteam', 
  'abuse_team', 'reportabuse', 'report_abuse', 'spam', 'antispam', 'anti_spam', 
  'phishing', 'malware', 'virus', 'hack', 'hacker', 'hackers', 'hacking', 'exploit', 
  'exploits', 'vulnerability', 'breach', 'databreach', 'data_breach', 'privacy', 
  'privacyteam', 'privacy_team', 'legal', 'legalteam', 'legal_team', 'compliance', 
  'dmca', 'copyright', 'takedown', 'verification', 'verify', 'verified', 
  'authenticate', 'authentication', 'noreply', 'no_reply', 'no-reply', 'donotreply', 
  'do_not_reply', 'postmaster', 'webmaster', 'hostmaster',
];

const IDENTITY_IMPERSONATION = [
  'everyone', 'everybody', 'anyone', 'anybody', 'someone', 'somebody', 'nobody', 
  'noone', 'no_one', 'all', 'alluser', 'allusers', 'all_users', 'here', 'channel', 
  'channels', 'member', 'members', 'user', 'users', 'person', 'people', 'human', 
  'humans', 'anonymous', 'anon', 'guest', 'guests', 'unknown', 'stranger', 'newuser', 
  'new_user', 'default', 'defaultuser', 'default_user', 'placeholder', 'example', 
  'sample', 'template', 'dummy', 'fake', 'real', 'realuser', 'real_user', 'me', 
  'myself', 'you', 'yourself', 'us', 'we', 'them', 'they', 'it', 'this', 'that',
];

const PLATFORM_FEATURES = [
  'login', 'logout', 'signin', 'signout', 'signup', 'register', 'registration', 
  'account', 'accounts', 'profile', 'profiles', 'preferences', 'dashboard', 'home', 
  'homepage', 'main', 'landing', 'welcome', 'about', 'aboutus', 'about_us', 'terms', 
  'tos', 'privacypolicy', 'privacy_policy', 'cookies', 'cookiepolicy', 'cookie_policy', 
  'faq', 'faqs', 'blog', 'news', 'updates', 'changelog', 'status', 'statuspage', 
  'status_page', 'docs', 'documentation', 'wiki', 'knowledgebase', 'knowledge_base', 
  'kb', 'guidelines', 'rules', 'coc', 'codeofconduct', 'code_of_conduct', 'invite', 
  'invites', 'join', 'create', 'delete', 'remove', 'edit', 'update', 'search', 
  'explore', 'discover', 'trending', 'popular', 'featured', 'premium', 'pro', 'plus', 
  'enterprise', 'business', 'free', 'trial', 'subscription', 'subscribe', 'unsubscribe', 
  'pricing', 'plans', 'upgrade', 'downgrade', 'cancel', 'payment', 'payments', 
  'checkout', 'store', 'shop', 'marketplace', 'app', 'apps', 'download', 'downloads', 
  'mobile', 'desktop', 'web', 'oauth', 'sso', 'auth', 'confirm', 'reset', 'password', 
  'passwords', 'forgot', 'recover', 'recovery', 'backup', 'restore', 'import', 
  'export', 'data', 'archive', 'history',
];

const OFFENSIVE_WORDS = [
  'ass', 'asshole', 'bastard', 'bitch', 'cunt', 'damn', 'dick', 'fuck', 'fucker', 
  'fucking', 'hell', 'piss', 'shit', 'slut', 'whore', 'nigger', 'nigga', 'faggot', 
  'fag', 'retard', 'retarded', 'nazi', 'hitler', 'porn', 'sex', 'xxx', 'penis', 
  'vagina', 'cock', 'pussy', 'anus', 'dildo', 'orgasm', 'nude', 'naked', 'boob',
  'boobs', 'tits', 'titties', 'nipple', 'nipples', 'butthole', 'rape', 'rapist',
  'molest', 'pedo', 'pedophile', 'incest', 'bestiality', 'necro', 'gore', 'suicide',
  'killme', 'kys', 'kms',
];

const NUMERIC_SPECIAL = [
  '123', '1234', '12345', '123456', '1234567', '12345678', '123456789', 
  'password', 'pass', 'letmein', 'qwerty', 'abc123', '111111', '000000', 
  'admin123', 'test123', 'user123', 'guest123', 'root123', 'temp', 'temporary',
  'passw0rd', 'p@ssword', 'p@ssw0rd', 'welcome', 'welcome1', 'master', 'login123',
];

// Combine all blocked usernames into a single set for fast lookup
export const BLOCKED_USERNAMES = new Set([
  ...KLOAK_BRAND_OFFICIAL,
  ...ADMINISTRATIVE_AUTHORITY,
  ...SUPPORT_SERVICE,
  ...SYSTEM_TECHNICAL,
  ...SECURITY_ABUSE,
  ...IDENTITY_IMPERSONATION,
  ...PLATFORM_FEATURES,
  ...OFFENSIVE_WORDS,
  ...NUMERIC_SPECIAL,
].map(name => name.toLowerCase().replace(/[-_]/g, '')));

// Words that should block a username if they appear anywhere in it
export const BLOCKED_SUBSTRINGS = new Set([
  'admin', 'moderator', 'support', 'official', 'staff', 'kloak', 'system',
  'security', 'hack', 'phish', 'spam', 'abuse', 'root', 'sudo', 'owner',
  'fuck', 'shit', 'bitch', 'nigger', 'nigga', 'faggot', 'retard', 'nazi',
  'hitler', 'porn', 'xxx', 'rape', 'pedo', 'incest', 'suicide', 'kys',
].map(s => s.toLowerCase()));

// ============================================
// LEET SPEAK SUBSTITUTION MAP
// ============================================

const LEET_MAP: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '!': 'i',
  '|': 'i',
  '3': 'e',
  '4': 'a',
  '@': 'a',
  '5': 's',
  '$': 's',
  '7': 't',
  '+': 't',
  '8': 'b',
  '9': 'g',
  '6': 'g',
};

/**
 * Convert leet speak to regular text for comparison
 */
function decodeLeetSpeak(input: string): string {
  let result = '';
  for (const char of input.toLowerCase()) {
    result += LEET_MAP[char] || char;
  }
  return result;
}

/**
 * Normalize username for comparison (removes special chars, decodes leet)
 */
function normalizeUsername(username: string): string {
  // First decode leet speak
  const decoded = decodeLeetSpeak(username);
  // Then remove underscores and hyphens for comparison
  return decoded.replace(/[-_]/g, '');
}

// ============================================
// VALIDATION RESULT INTERFACE
// ============================================

export interface UsernameValidationResult {
  isValid: boolean;
  error?: string;
  errorType?: 'reserved' | 'contains_restricted' | 'length' | 'characters' | 'format' | 'numeric';
}

// ============================================
// MAIN VALIDATION FUNCTION
// ============================================

export function validateUsernameComprehensive(username: string): UsernameValidationResult {
  // Empty check
  if (!username || username.trim().length === 0) {
    return { isValid: false, error: 'Username is required', errorType: 'format' };
  }

  const trimmed = username.trim();

  // Length validation
  if (trimmed.length < 4) {
    return { 
      isValid: false, 
      error: 'Username must be between 4 and 16 characters', 
      errorType: 'length' 
    };
  }
  if (trimmed.length > 16) {
    return { 
      isValid: false, 
      error: 'Username must be between 3 and 16 characters', 
      errorType: 'length' 
    };
  }

  // Character validation - only alphanumeric, underscores, and hyphens
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return { 
      isValid: false, 
      error: 'Username can only contain letters, numbers, underscores, and hyphens', 
      errorType: 'characters' 
    };
  }

  // Cannot start or end with underscore or hyphen
  if (/^[-_]|[-_]$/.test(trimmed)) {
    return { 
      isValid: false, 
      error: 'Username cannot start or end with an underscore or hyphen', 
      errorType: 'format' 
    };
  }

  // No consecutive special characters
  if (/[-_]{2,}/.test(trimmed)) {
    return { 
      isValid: false, 
      error: 'Username cannot contain consecutive special characters', 
      errorType: 'format' 
    };
  }

  // Cannot be only numbers
  if (/^\d+$/.test(trimmed)) {
    return { 
      isValid: false, 
      error: 'Username cannot be only numbers', 
      errorType: 'numeric' 
    };
  }

  // Normalize for blocked checks
  const normalized = normalizeUsername(trimmed);

  // Check exact match against blocked list
  if (BLOCKED_USERNAMES.has(normalized)) {
    return { 
      isValid: false, 
      error: 'This username is reserved', 
      errorType: 'reserved' 
    };
  }

  // Check if contains blocked substrings
  for (const blocked of BLOCKED_SUBSTRINGS) {
    if (normalized.includes(blocked)) {
      return { 
        isValid: false, 
        error: 'Username contains restricted words', 
        errorType: 'contains_restricted' 
      };
    }
  }

  // All checks passed
  return { isValid: true };
}

// ============================================
// USERNAME SUGGESTION GENERATOR
// ============================================

const SUGGESTION_PREFIXES = ['the', 'real', 'its', 'im', 'iam', 'just', 'only', 'hey'];
const SUGGESTION_SUFFIXES = ['_x', '_v2', '_og', '_here', '_now', '123', '99', '_xo', '_yo'];
const RANDOM_ADJECTIVES = ['cool', 'swift', 'bold', 'epic', 'chill', 'zen', 'rad', 'ace'];

/**
 * Generate username suggestions when the user's chosen name is blocked
 */
export function generateUsernameSuggestions(originalUsername: string, count: number = 4): string[] {
  const suggestions: string[] = [];
  const base = originalUsername.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
  
  if (!base || base.length < 2) {
    // If no valid base, generate random suggestions
    const randomSuggestions = RANDOM_ADJECTIVES.map((adj, i) => 
      `${adj}_${Math.floor(Math.random() * 900) + 100}`
    );
    return randomSuggestions.slice(0, count);
  }

  // Try with prefixes
  for (const prefix of SUGGESTION_PREFIXES) {
    const suggestion = `${prefix}${base}`;
    if (validateUsernameComprehensive(suggestion).isValid && !suggestions.includes(suggestion)) {
      suggestions.push(suggestion);
      if (suggestions.length >= count) break;
    }
  }

  // Try with suffixes
  if (suggestions.length < count) {
    for (const suffix of SUGGESTION_SUFFIXES) {
      const suggestion = `${base}${suffix}`;
      if (validateUsernameComprehensive(suggestion).isValid && !suggestions.includes(suggestion)) {
        suggestions.push(suggestion);
        if (suggestions.length >= count) break;
      }
    }
  }

  // Try with random numbers
  if (suggestions.length < count) {
    for (let i = 0; i < 10 && suggestions.length < count; i++) {
      const num = Math.floor(Math.random() * 900) + 100;
      const suggestion = `${base}${num}`;
      if (validateUsernameComprehensive(suggestion).isValid && !suggestions.includes(suggestion)) {
        suggestions.push(suggestion);
      }
    }
  }

  // Fill remaining with adjective combinations
  if (suggestions.length < count) {
    for (const adj of RANDOM_ADJECTIVES) {
      const suggestion = `${adj}_${base}`;
      if (validateUsernameComprehensive(suggestion).isValid && !suggestions.includes(suggestion)) {
        suggestions.push(suggestion);
        if (suggestions.length >= count) break;
      }
    }
  }

  return suggestions.slice(0, count);
}

// ============================================
// REGISTRATION RATE LIMITER
// ============================================

interface RateLimitState {
  attempts: number[];
  cooldownUntil: number | null;
}

const RATE_LIMIT_WINDOW_MS = 30000; // 30 seconds
const MAX_ATTEMPTS_BEFORE_COOLDOWN = 10;
const COOLDOWN_DURATION_MS = 30000; // 30 seconds cooldown

let rateLimitState: RateLimitState = {
  attempts: [],
  cooldownUntil: null,
};

/**
 * Check if registration is rate limited
 */
export function checkRegistrationRateLimit(): { allowed: boolean; remainingSeconds?: number } {
  const now = Date.now();

  // Check if in cooldown
  if (rateLimitState.cooldownUntil && now < rateLimitState.cooldownUntil) {
    return { 
      allowed: false, 
      remainingSeconds: Math.ceil((rateLimitState.cooldownUntil - now) / 1000) 
    };
  }

  // Clear cooldown if expired
  if (rateLimitState.cooldownUntil && now >= rateLimitState.cooldownUntil) {
    rateLimitState.cooldownUntil = null;
    rateLimitState.attempts = [];
  }

  // Filter attempts within the window
  rateLimitState.attempts = rateLimitState.attempts.filter(
    time => now - time < RATE_LIMIT_WINDOW_MS
  );

  return { allowed: rateLimitState.attempts.length < MAX_ATTEMPTS_BEFORE_COOLDOWN };
}

/**
 * Record a registration attempt
 */
export function recordRegistrationAttempt(): void {
  const now = Date.now();
  rateLimitState.attempts.push(now);

  // Check if cooldown should be triggered
  if (rateLimitState.attempts.length >= MAX_ATTEMPTS_BEFORE_COOLDOWN) {
    rateLimitState.cooldownUntil = now + COOLDOWN_DURATION_MS;
  }
}

/**
 * Log blocked username attempt (for security monitoring)
 */
export function logBlockedUsernameAttempt(username: string, errorType: string): void {
  // In production, this could send to a logging service
  console.warn(`[Security] Blocked username attempt: "${username}" - Reason: ${errorType}`);
}
