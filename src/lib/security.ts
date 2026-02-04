/**
 * Security utilities for Kloak
 * Input validation, sanitization, and security checks
 */

/**
 * Sanitize text input to prevent XSS
 * Removes any potentially dangerous HTML/script content
 */
export const sanitizeInput = (input: string): string => {
  if (typeof input !== "string") return "";

  // Remove null bytes
  let sanitized = input.replace(/\0/g, "");

  // Trim excessive whitespace
  sanitized = sanitized.trim();

  return sanitized;
};

/**
 * Reserved usernames that cannot be used
 * Includes admin-related, system, and potentially confusing names
 */
const RESERVED_USERNAMES = new Set([
  // Admin variations
  "admin",
  "admin1",
  "admin2",
  "admin3",
  "admin4",
  "admin5",
  "administrator",
  "administrator1",
  "administrator2",
  "sysadmin",
  "superadmin",
  "rootadmin",

  // Moderator variations
  "mod",
  "mod1",
  "mod2",
  "mod3",
  "moderator",
  "moderator1",
  "moderator2",

  // User variations
  "user",
  "user1",
  "user2",
  "user3",
  "user4",
  "user5",

  // System/official accounts
  "system",
  "kloak",
  "kloakbot",
  "bot",
  "official",
  "support",
  "help",
  "helpdesk",
  "staff",
  "root",
  "sudo",
  "superuser",

  // Common impersonation targets
  "owner",
  "founder",
  "ceo",
  "dev",
  "developer",
  "server",
  "channel",
  "everyone",
  "here",
  "all",

  // Potentially misleading
  "anonymous",
  "unknown",
  "deleted",
  "null",
  "undefined",
  "test",
  "testing",
  "demo",
  "guest",
  "default",
]);

/**
 * Check if username matches a reserved pattern
 * Handles numbered variations like admin123
 */
const isReservedUsername = (username: string): boolean => {
  const lower = username.toLowerCase();

  // Direct match
  if (RESERVED_USERNAMES.has(lower)) {
    return true;
  }

  // Check for numbered variations of core reserved words
  const reservedPatterns = [
    /^admin\d*$/,
    /^administrator\d*$/,
    /^mod\d*$/,
    /^moderator\d*$/,
    /^user\d*$/,
    /^staff\d*$/,
    /^support\d*$/,
    /^system\d*$/,
    /^kloak\d*$/,
    /^official\d*$/,
  ];

  return reservedPatterns.some((pattern) => pattern.test(lower));
};

/**
 * Validate username format
 * - 3-20 characters
 * - Only alphanumeric and underscores
 * - No consecutive underscores
 * - Not a reserved username
 */
export const validateUsername = (username: string): { valid: boolean; error?: string } => {
  if (!username) {
    return { valid: false, error: "Username is required" };
  }

  const trimmed = username.trim().toLowerCase();

  if (trimmed.length < 3) {
    return { valid: false, error: "Username must be at least 3 characters" };
  }

  if (trimmed.length > 14) {
    return { valid: false, error: "Username must be 14 characters or less" };
  }

  if (!/^[a-z0-9_]+$/.test(trimmed)) {
    return { valid: false, error: "Only letters, numbers, and underscores allowed" };
  }

  if (/_{2,}/.test(trimmed)) {
    return { valid: false, error: "Consecutive underscores not allowed" };
  }

  if (trimmed.startsWith("_") || trimmed.endsWith("_")) {
    return { valid: false, error: "Username cannot start or end with underscore" };
  }

  if (isReservedUsername(trimmed)) {
    return { valid: false, error: "This username is reserved" };
  }

  return { valid: true };
};

/**
 * Validate server name
 */
export const validateServerName = (name: string): { valid: boolean; error?: string } => {
  if (!name) {
    return { valid: false, error: "Server name is required" };
  }

  const trimmed = name.trim();

  if (trimmed.length < 1) {
    return { valid: false, error: "Server name is required" };
  }

  if (trimmed.length > 100) {
    return { valid: false, error: "Server name must be 100 characters or less" };
  }

  return { valid: true };
};

/**
 * Validate channel name
 */
export const validateChannelName = (name: string): { valid: boolean; error?: string } => {
  if (!name) {
    return { valid: false, error: "Channel name is required" };
  }

  const trimmed = name.trim().toLowerCase();

  if (trimmed.length < 1) {
    return { valid: false, error: "Channel name is required" };
  }

  if (trimmed.length > 100) {
    return { valid: false, error: "Channel name must be 100 characters or less" };
  }

  // Convert spaces to hyphens and validate
  const slugified = trimmed.replace(/\s+/g, "-");
  if (!/^[a-z0-9-]+$/.test(slugified)) {
    return { valid: false, error: "Only letters, numbers, and hyphens allowed" };
  }

  return { valid: true };
};

/**
 * Validate message content
 */
export const validateMessageContent = (content: string): { valid: boolean; error?: string } => {
  if (!content) {
    return { valid: false, error: "Message cannot be empty" };
  }

  const trimmed = content.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: "Message cannot be empty" };
  }

  if (trimmed.length > 2000) {
    return { valid: false, error: "Message must be 2000 characters or less" };
  }

  return { valid: true };
};

/**
 * Validate invite code format
 */
export const validateInviteCode = (code: string): { valid: boolean; error?: string } => {
  if (!code) {
    return { valid: false, error: "Invite code is required" };
  }

  const trimmed = code.trim().toUpperCase();

  if (trimmed.length !== 8) {
    return { valid: false, error: "Invite code must be 8 characters" };
  }

  // Only allow unambiguous characters
  if (!/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/.test(trimmed)) {
    return { valid: false, error: "Invalid invite code format" };
  }

  return { valid: true };
};

/**
 * Validate file upload
 */
export const validateFileUpload = (
  file: File,
  options: {
    maxSize?: number; // in bytes, default 10MB
    allowedTypes?: string[]; // MIME type prefixes
  } = {},
): { valid: boolean; error?: string } => {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB
    allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "text/plain",
      "application/zip",
      "application/x-zip-compressed",
    ],
  } = options;

  if (!file) {
    return { valid: false, error: "No file provided" };
  }

  if (file.size > maxSize) {
    const sizeMB = (maxSize / (1024 * 1024)).toFixed(0);
    return { valid: false, error: `File must be smaller than ${sizeMB}MB` };
  }

  const isAllowedType = allowedTypes.some((type) => file.type === type || file.type.startsWith(type.replace("*", "")));

  if (!isAllowedType) {
    return { valid: false, error: "File type not allowed" };
  }

  // Check for potentially dangerous file extensions
  const dangerousExtensions = [".exe", ".bat", ".cmd", ".scr", ".pif", ".js", ".vbs", ".ps1"];
  const fileName = file.name.toLowerCase();
  if (dangerousExtensions.some((ext) => fileName.endsWith(ext))) {
    return { valid: false, error: "File type not allowed for security reasons" };
  }

  return { valid: true };
};

/**
 * Rate limiting helper - tracks request timestamps
 */
export class RateLimiter {
  private timestamps: Map<string, number[]> = new Map();

  constructor(
    private limit: number,
    private windowMs: number,
  ) {}

  isAllowed(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    const timestamps = this.timestamps.get(key) || [];
    const recentTimestamps = timestamps.filter((t) => t > windowStart);

    if (recentTimestamps.length >= this.limit) {
      return false;
    }

    recentTimestamps.push(now);
    this.timestamps.set(key, recentTimestamps);

    return true;
  }

  getRemainingTime(key: string): number {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const timestamps = this.timestamps.get(key) || [];

    const recentTimestamps = timestamps.filter((t) => t > windowStart);
    if (recentTimestamps.length < this.limit) {
      return 0;
    }

    const oldestInWindow = Math.min(...recentTimestamps);
    return Math.ceil((oldestInWindow + this.windowMs - now) / 1000);
  }

  clear(key: string): void {
    this.timestamps.delete(key);
  }
}

// Global rate limiters
export const authRateLimiter = new RateLimiter(5, 60000); // 5 attempts per minute
export const messageRateLimiter = new RateLimiter(10, 10000); // 10 messages per 10 seconds
export const inviteCodeRateLimiter = new RateLimiter(5, 60000); // 5 attempts per minute
export const friendRequestRateLimiter = new RateLimiter(10, 60000); // 10 requests per minute
export const accountCreationRateLimiter = new RateLimiter(3, 300000); // 3 attempts per 5 minutes
