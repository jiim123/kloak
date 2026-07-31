export const MAX_CHANNEL_NAME_LENGTH = 50;

const DANGEROUS_FORMAT_CHARS = /[\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff\uffa0]/g;
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g;
const SPACE_SEPARATORS = /\p{Zs}+/gu;
const EDGE_SEPARATORS = /^-+|-+$/g;
const REPEATED_SEPARATORS = /-{2,}/g;

const truncateCodePoints = (value: string, maxLength: number): string => Array.from(value).slice(0, maxLength).join("");

const cleanChannelNameBase = (value: string): string =>
  value
    .normalize("NFC")
    .toLowerCase()
    .replace(CONTROL_CHARS, "")
    .replace(DANGEROUS_FORMAT_CHARS, "")
    .replace(SPACE_SEPARATORS, "-")
    .replace(REPEATED_SEPARATORS, "-");

const cleanChannelNameInput = (value: string): string => cleanChannelNameBase(value);

const cleanChannelName = (value: string): string => cleanChannelNameBase(value).replace(EDGE_SEPARATORS, "");

export const normalizeChannelNameInput = (value: string): string =>
  truncateCodePoints(cleanChannelNameInput(value), MAX_CHANNEL_NAME_LENGTH);

export const normalizeChannelName = (value: string): string =>
  truncateCodePoints(cleanChannelName(value), MAX_CHANNEL_NAME_LENGTH);

export const validateChannelDisplayName = (name: string): { valid: boolean; error?: string } => {
  const normalized = cleanChannelName(name);

  if (!normalized) {
    return { valid: false, error: "Channel name is required" };
  }

  if (normalized.length > MAX_CHANNEL_NAME_LENGTH) {
    return { valid: false, error: `Channel name must be ${MAX_CHANNEL_NAME_LENGTH} characters or less` };
  }

  return { valid: true };
};
