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
  "image/avif",
  "image/svg+xml",
] as const;

export const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

export const ALLOWED_AUDIO_TYPES = [
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/mp4",
  "audio/flac",
] as const;

export const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "text/plain",
  "application/zip",
  "application/x-rar-compressed",
  "application/gzip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/json",
] as const;

export const ALLOWED_ATTACHMENT_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_VIDEO_TYPES,
  ...ALLOWED_AUDIO_TYPES,
  ...ALLOWED_DOCUMENT_TYPES,
] as const;

export const ALLOWED_FILE_EXTENSIONS =
  ".jpg,.jpeg,.png,.gif,.webp,.avif,.svg,.mp4,.webm,.mov,.mp3,.ogg,.wav,.flac,.m4a,.pdf,.txt,.zip,.rar,.gz,.doc,.docx,.xls,.xlsx,.json";

export const MAX_IMAGE_FILE_SIZE = 1 * 1024 * 1024; // 1MB
export const MAX_VIDEO_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25MB
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
