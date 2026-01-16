/**
 * Formatting utilities for Nomo
 * Handles timestamps, slugs, and text processing
 */

import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';

/**
 * Format a message timestamp for display
 * - Today at 3:45 PM
 * - Yesterday at 3:45 PM
 * - 12/25/2024 3:45 PM
 */
export const formatMessageTimestamp = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const timeString = format(d, 'h:mm a');

  if (isToday(d)) {
    return `Today at ${timeString}`;
  }
  if (isYesterday(d)) {
    return `Yesterday at ${timeString}`;
  }
  return format(d, 'MM/dd/yyyy') + ' ' + timeString;
};

/**
 * Format relative time (e.g., "5 minutes ago", "2 hours ago")
 */
export const formatRelativeTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
};

/**
 * Format compact time (e.g., "5m", "2h", "1d") for sidebar displays
 */
export const formatCompactTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}d`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks}w`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths}mo`;
  }

  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears}y`;
};

/**
 * Format a short timestamp for message grouping (just time)
 */
export const formatShortTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'h:mm a');
};

/**
 * Generate a random 8-character invite code
 * Uses uppercase letters and numbers, excluding ambiguous characters (0, O, 1, I, L)
 */
export const generateInviteCode = (): string => {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  for (let i = 0; i < 8; i++) {
    code += chars[array[i] % chars.length];
  }
  return code;
};

/**
 * Slugify a channel name (lowercase, hyphens, alphanumeric only)
 */
export const slugifyChannelName = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

/**
 * Check if a message contains only emoji characters
 * Used for displaying emoji-only messages at larger size
 */
export const isEmojiOnly = (text: string): boolean => {
  // Remove whitespace
  const trimmed = text.trim();
  if (!trimmed) return false;

  // Emoji regex pattern - matches most emoji including compound emoji
  const emojiRegex = /^(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Component})+$/u;

  // Also check for common emoji patterns
  const emojiOnlyPattern = /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{FE0F}\s]*$/u;

  // Count actual characters vs emoji
  const withoutEmoji = trimmed.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{FE0F}]/gu, '').trim();

  return withoutEmoji.length === 0 && trimmed.length > 0;
};

/**
 * Truncate text with ellipsis
 */
export const truncate = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
};
