/**
 * Shared constants for message-related components
 * Used across MessageInput, DMMessageInput, MessageItem, and other message components
 */

// Message content limits
export const MAX_MESSAGE_LENGTH = 2000;

// Textarea dimensions
export const MIN_TEXTAREA_HEIGHT = 40;
export const MAX_TEXTAREA_HEIGHT = 160;
export const MIN_EDIT_TEXTAREA_HEIGHT = 60;

// Timing delays
export const DRAFT_SAVE_DELAY = 500; // ms - debounce delay for saving drafts
export const TYPING_STOP_DELAY = 2000; // ms - delay before stopping typing indicator

// File upload constraints
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

export const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
] as const;

export const MAX_IMAGE_FILE_SIZE = 1 * 1024 * 1024; // 1MB
export const MAX_VIDEO_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_ATTACHMENTS = 10;

// Quick reactions for mobile/desktop emoji picker
export const QUICK_REACTIONS = [
  "👍",
  "❤️",
  "😂",
  "😮",
  "😢",
  "👋",
  "🔥",
  "👀",
  "💯",
  "🙌",
  "😍",
  "🤔",
] as const;

// Quick reactions for DM (subset)
export const DM_QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🎉"] as const;
