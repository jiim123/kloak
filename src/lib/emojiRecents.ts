/**
 * Shared utilities for recent / frequently used emoji tracking.
 * Used by EmojiPicker (recent tab) and MessageItem (quick reactions).
 */

const RECENT_EMOJIS_KEY = "kloak-recent-emojis";
const EMOJI_FREQ_KEY = "kloak-emoji-freq";
const MAX_RECENT_EMOJIS = 24;

/** Get the ordered list of recently used emojis. */
export const getRecentEmojis = (): string[] => {
  try {
    const stored = localStorage.getItem(RECENT_EMOJIS_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
};

/** Save an emoji to the recent list and bump its frequency counter. */
export const saveRecentEmoji = (emoji: string) => {
  try {
    const recent = getRecentEmojis();
    const filtered = recent.filter((e) => e !== emoji);
    const updated = [emoji, ...filtered].slice(0, MAX_RECENT_EMOJIS);
    localStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }

  // Bump frequency
  try {
    const freq = getEmojiFrequency();
    freq[emoji] = (freq[emoji] || 0) + 1;
    localStorage.setItem(EMOJI_FREQ_KEY, JSON.stringify(freq));
  } catch {
    // Ignore
  }
};

/** Get a map of emoji → usage count. */
export const getEmojiFrequency = (): Record<string, number> => {
  try {
    const stored = localStorage.getItem(EMOJI_FREQ_KEY);
    if (!stored) return {};
    return JSON.parse(stored);
  } catch {
    return {};
  }
};

/**
 * Return the top N most frequently used **native** emojis (excludes custom :name: emojis).
 * Falls back to common defaults if user has no history.
 */
export const getTopEmojis = (count = 3): string[] => {
  const freq = getEmojiFrequency();
  const entries = Object.entries(freq)
    .filter(([emoji]) => !emoji.startsWith(":")) // skip custom emojis
    .sort((a, b) => b[1] - a[1]);

  const top = entries.slice(0, count).map(([emoji]) => emoji);

  // Pad with defaults if not enough history
  const defaults = ["👍", "❤️", "😂"];
  for (const d of defaults) {
    if (top.length >= count) break;
    if (!top.includes(d)) top.push(d);
  }

  return top.slice(0, count);
};
