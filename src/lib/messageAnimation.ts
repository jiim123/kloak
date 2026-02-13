/**
 * Shared utilities for message animation tracking
 * Prevents messages from animating multiple times when switching channels or re-rendering
 */

import type { Message } from "@/types";
import type { DirectMessage } from "@/types";

// Track animations by a STABLE key that survives optimistic→real message replacement
const animatedMessages = new Set<string>();
const animatedDMMessages = new Set<string>();

// Cleanup threshold - prevent memory growth
const MAX_TRACKED_ANIMATIONS = 500;
const CLEANUP_COUNT = 250;

/**
 * Generate a stable animation key for a message
 * Uses timestamp + user_id + content prefix to survive temp-xxx → real UUID changes
 */
export const getStableAnimationKey = (
  message: Message | DirectMessage
): string => {
  const timestamp = Math.floor(
    new Date(message.created_at).getTime() / 1000
  );
  const contentPrefix = message.content.substring(0, 50);
  const userId = "user_id" in message ? message.user_id : message.sender_id;
  return `${timestamp}-${userId}-${contentPrefix}`;
};

/**
 * Check if a message should animate and mark it as animated
 * Returns false if already animated, true if this is the first time
 * Automatically cleans up old entries when threshold is reached
 */
export const shouldAnimateMessage = (
  message: Message | DirectMessage,
  isDM: boolean = false
): boolean => {
  const animationKey = getStableAnimationKey(message);
  const trackingSet = isDM ? animatedDMMessages : animatedMessages;

  // Already animated
  if (trackingSet.has(animationKey)) {
    return false;
  }

  // Mark as animated
  trackingSet.add(animationKey);

  // Cleanup old entries if needed
  if (trackingSet.size > MAX_TRACKED_ANIMATIONS) {
    const entries = Array.from(trackingSet);
    entries
      .slice(0, CLEANUP_COUNT)
      .forEach((key) => trackingSet.delete(key));
  }

  return true;
};

/**
 * Reset animation tracking (useful for testing or manual cleanup)
 */
export const resetAnimationTracking = (isDM: boolean = false): void => {
  if (isDM) {
    animatedDMMessages.clear();
  } else {
    animatedMessages.clear();
  }
};

/**
 * Get current tracking size (useful for debugging)
 */
export const getTrackingSize = (isDM: boolean = false): number => {
  return isDM ? animatedDMMessages.size : animatedMessages.size;
};
