import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Registration anti-spam utilities.
 * Handles IP hashing, rate limiting, username validation, and dynamic PoW difficulty.
 * NEVER stores or logs raw IP addresses.
 */

// ─── IP Hashing ───────────────────────────────────────────────────────────────

export async function hashIp(rawIp: string): Promise<string> {
  const salt = Deno.env.get("RATE_LIMIT_SALT") || "kloak-rate-limit-default-salt";
  const data = new TextEncoder().encode(salt + rawIp);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function getClientIpRaw(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("cf-connecting-ip") || "unknown";
}

// ─── Rate Limiting ────────────────────────────────────────────────────────────

const HOURLY_LIMIT = 3;
const HOURLY_WINDOW_MS = 60 * 60 * 1000;
const DAILY_LIMIT = 10;
const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface RateLimitResult {
  allowed: boolean;
  attemptCount: number; // hourly attempts (used for PoW difficulty)
}

export async function checkRegistrationRateLimit(
  supabase: ReturnType<typeof createClient>,
  ipHash: string,
): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc("consume_registration_rate_limit", {
    _ip_hash: ipHash,
    _hourly_limit: HOURLY_LIMIT,
    _daily_limit: DAILY_LIMIT,
    _hourly_window_seconds: Math.floor(HOURLY_WINDOW_MS / 1000),
    _daily_window_seconds: Math.floor(DAILY_WINDOW_MS / 1000),
  });

  if (error) {
    console.error("[registrationSecurity] consume_registration_rate_limit failed:", error.message);
    return { allowed: false, attemptCount: HOURLY_LIMIT };
  }

  const payload = (data ?? {}) as { allowed?: boolean; attempt_count?: number };
  return {
    allowed: payload.allowed === true,
    attemptCount: typeof payload.attempt_count === "number" ? payload.attempt_count : 0,
  };
}

// ─── Dynamic PoW Difficulty ───────────────────────────────────────────────────

const BASE_DIFFICULTY = 4;

/**
 * Returns the PoW difficulty based on hourly attempt count.
 * 1st attempt: base (4), 2nd: 3x base (12), 3rd+: blocked by rate limiter.
 */
export function getDynamicDifficulty(attemptCount: number): number {
  if (attemptCount <= 1) return BASE_DIFFICULTY;
  return BASE_DIFFICULTY * 3; // 3x for 2nd attempt
}

/**
 * Peek at the current attempt count WITHOUT incrementing.
 * Used by generate-challenge to set difficulty before registration.
 */
export async function peekAttemptCount(
  supabase: ReturnType<typeof createClient>,
  ipHash: string,
): Promise<number> {
  const now = new Date();

  const { data: row } = await supabase
    .from("registration_rate_limits")
    .select("attempt_count, window_start")
    .eq("ip_hash", ipHash)
    .maybeSingle();

  if (!row) return 0;

  const windowStart = new Date(row.window_start);
  if (now.getTime() - windowStart.getTime() > HOURLY_WINDOW_MS) {
    return 0; // window expired
  }

  return row.attempt_count as number;
}

// ─── Username Validation ──────────────────────────────────────────────────────

const BLOCKED_PATTERNS = [
  "asteroide",
  "free nitro",
  "discord.gg",
  "telegram.me",
  "t.me/",
  "bit.ly",
  "tinyurl",
  "claim your",
  "click here",
  "join now free",
];

const URL_REGEX = /(?:https?:\/\/|www\.|\w+\.\w{2,})/i;
const REPEATED_CHARS_REGEX = /(.)\1{3,}/;
const HAS_ALPHANUMERIC = /[a-zA-Z0-9]/;
const TLD_PATTERNS = /\.(com|net|org|cc|io|gg|xyz|ru|cn|co|me|tv|info|biz|dev|app)\b/i;

export interface UsernameValidationResult {
  valid: boolean;
  error?: string;
}

export function validateUsernameServerSide(username: string): UsernameValidationResult {
  // Trim
  const trimmed = username.trim();

  // Empty after trim
  if (!trimmed || trimmed.length === 0) {
    return { valid: false, error: "Username is not allowed" };
  }

  // Length
  if (trimmed.length < 3) {
    return { valid: false, error: "Username is not allowed" };
  }
  if (trimmed.length > 32) {
    return { valid: false, error: "Username is not allowed" };
  }

  // Must contain at least one alphanumeric character
  if (!HAS_ALPHANUMERIC.test(trimmed)) {
    return { valid: false, error: "Username is not allowed" };
  }

  // URL detection
  if (URL_REGEX.test(trimmed)) {
    return { valid: false, error: "Username contains blocked patterns" };
  }

  // TLD patterns
  if (TLD_PATTERNS.test(trimmed)) {
    return { valid: false, error: "Username contains blocked patterns" };
  }

  // Excessive repeated characters
  if (REPEATED_CHARS_REGEX.test(trimmed)) {
    return { valid: false, error: "Username is not allowed" };
  }

  // Blocked patterns (case-insensitive)
  const lower = trimmed.toLowerCase();
  for (const pattern of BLOCKED_PATTERNS) {
    if (lower.includes(pattern)) {
      return { valid: false, error: "Username contains blocked patterns" };
    }
  }

  return { valid: true };
}
