/**
 * LocalStorage utilities for Kloak
 * Handles persistent storage of user preferences and drafts
 */

const STORAGE_KEYS = {
  SECRET_KEY: 'kloak-secret-key',
  THEME: 'kloak-theme',
  DRAFTS: 'kloak-drafts',
  WELCOME_SHOWN: 'kloak-welcome-shown',
  LAST_CHANNELS: 'kloak-last-channels',
} as const;

// Secret Key Storage
export const saveSecretKey = (key: string): void => {
  localStorage.setItem(STORAGE_KEYS.SECRET_KEY, key);
};

export const getSecretKey = (): string | null => {
  return localStorage.getItem(STORAGE_KEYS.SECRET_KEY);
};

export const clearSecretKey = (): void => {
  localStorage.removeItem(STORAGE_KEYS.SECRET_KEY);
};

// Theme Storage
export type Theme = 'dark' | 'light' | 'system';

export const saveTheme = (theme: Theme): void => {
  localStorage.setItem(STORAGE_KEYS.THEME, theme);
};

export const getTheme = (): Theme => {
  const stored = localStorage.getItem(STORAGE_KEYS.THEME);
  if (stored === 'dark' || stored === 'light' || stored === 'system') {
    return stored;
  }
  return 'dark'; // Default theme
};

// Message Drafts Storage
interface Drafts {
  [channelId: string]: string;
}

export const saveDraft = (channelId: string, content: string): void => {
  const drafts = getDrafts();
  if (content.trim()) {
    drafts[channelId] = content;
  } else {
    delete drafts[channelId];
  }
  localStorage.setItem(STORAGE_KEYS.DRAFTS, JSON.stringify(drafts));
};

export const getDraft = (channelId: string): string => {
  const drafts = getDrafts();
  return drafts[channelId] || '';
};

export const getDrafts = (): Drafts => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.DRAFTS);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

export const clearDraft = (channelId: string): void => {
  const drafts = getDrafts();
  delete drafts[channelId];
  localStorage.setItem(STORAGE_KEYS.DRAFTS, JSON.stringify(drafts));
};

export const clearAllDrafts = (): void => {
  localStorage.removeItem(STORAGE_KEYS.DRAFTS);
};

// Welcome Modal Storage (per-user)
export const hasSeenWelcome = (userId: string): boolean => {
  return localStorage.getItem(`${STORAGE_KEYS.WELCOME_SHOWN}-${userId}`) === 'true';
};

export const markWelcomeSeen = (userId: string): void => {
  localStorage.setItem(`${STORAGE_KEYS.WELCOME_SHOWN}-${userId}`, 'true');
};

// Last Visited Channel per Server
interface LastChannels {
  [serverId: string]: string; // serverId -> channelId
}

export const saveLastChannel = (serverId: string, channelId: string): void => {
  const lastChannels = getLastChannels();
  lastChannels[serverId] = channelId;
  localStorage.setItem(STORAGE_KEYS.LAST_CHANNELS, JSON.stringify(lastChannels));
};

export const getLastChannel = (serverId: string): string | null => {
  const lastChannels = getLastChannels();
  return lastChannels[serverId] || null;
};

export const getLastChannels = (): LastChannels => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.LAST_CHANNELS);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

export const clearLastChannel = (serverId: string): void => {
  const lastChannels = getLastChannels();
  delete lastChannels[serverId];
  localStorage.setItem(STORAGE_KEYS.LAST_CHANNELS, JSON.stringify(lastChannels));
};
