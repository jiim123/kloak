// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
type AnySupabaseClient = ReturnType<typeof createClient>;

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
  supabase: AnySupabaseClient,
  ipHash: string,
): Promise<RateLimitResult> {
  const now = new Date();

  const { data: row } = await supabase
    .from("registration_rate_limits")
    .select("*")
    .eq("ip_hash", ipHash)
    .maybeSingle();

  if (!row) {
    // First attempt — insert
    await supabase.from("registration_rate_limits").insert({
      ip_hash: ipHash,
      attempt_count: 1,
      window_start: now.toISOString(),
      daily_count: 1,
      daily_window_start: now.toISOString(),
      last_attempt_at: now.toISOString(),
    });
    return { allowed: true, attemptCount: 1 };
  }

  let attemptCount = row.attempt_count as number;
  let windowStart = new Date(row.window_start);
  let dailyCount = row.daily_count as number;
  let dailyWindowStart = new Date(row.daily_window_start);

  // Reset hourly window if expired
  if (now.getTime() - windowStart.getTime() > HOURLY_WINDOW_MS) {
    attemptCount = 0;
    windowStart = now;
  }

  // Reset daily window if expired
  if (now.getTime() - dailyWindowStart.getTime() > DAILY_WINDOW_MS) {
    dailyCount = 0;
    dailyWindowStart = now;
  }

  // Check limits BEFORE incrementing
  if (attemptCount >= HOURLY_LIMIT) {
    return { allowed: false, attemptCount };
  }
  if (dailyCount >= DAILY_LIMIT) {
    return { allowed: false, attemptCount };
  }

  // Increment
  attemptCount += 1;
  dailyCount += 1;

  await supabase
    .from("registration_rate_limits")
    .update({
      attempt_count: attemptCount,
      window_start: windowStart.toISOString(),
      daily_count: dailyCount,
      daily_window_start: dailyWindowStart.toISOString(),
      last_attempt_at: now.toISOString(),
    })
    .eq("id", row.id);

  return { allowed: true, attemptCount };
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
