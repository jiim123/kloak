import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';

export type NotificationLevel = 'all' | 'mentions' | 'nothing';

export interface ChannelUserSettings {
  channel_id: string;
  user_id: string;
  is_muted: boolean;
  is_hidden: boolean;
  is_pinned: boolean;
  notification_level: NotificationLevel;
  mute_until: string | null;
}

const CHANNEL_SETTINGS_CACHE_TTL_MS = 5 * 60_000;
const CHANNEL_SETTINGS_STORAGE_PREFIX = 'kloak:channel-settings:';

const getChannelSettingsCacheKey = (userId: string, channelIds: string[]) =>
  `${CHANNEL_SETTINGS_STORAGE_PREFIX}${userId}:${[...channelIds].sort().join(',')}`;

const readCachedChannelSettings = (userId: string, channelIds: string[]): Record<string, ChannelUserSettings> | null => {
  if (typeof window === 'undefined' || channelIds.length === 0) return null;
  try {
    const raw = window.sessionStorage.getItem(getChannelSettingsCacheKey(userId, channelIds));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { settings?: Record<string, ChannelUserSettings>; cachedAt?: number };
    if (!parsed?.settings || typeof parsed.cachedAt !== 'number') return null;
    if (Date.now() - parsed.cachedAt >= CHANNEL_SETTINGS_CACHE_TTL_MS) return null;
    return parsed.settings;
  } catch {
    return null;
  }
};

const persistChannelSettings = (userId: string, channelIds: string[], settings: Record<string, ChannelUserSettings>) => {
  if (typeof window === 'undefined' || channelIds.length === 0) return;
  try {
    window.sessionStorage.setItem(
      getChannelSettingsCacheKey(userId, channelIds),
      JSON.stringify({ settings, cachedAt: Date.now() }),
    );
  } catch {
    // ignore storage failures
  }
};

interface ChannelSettingsState {
  settings: Record<string, ChannelUserSettings>; // keyed by channel_id
  loading: boolean;

  fetchSettings: (serverChannelIds: string[]) => Promise<void>;
  toggleMute: (channelId: string) => Promise<void>;
  muteFor: (channelId: string, durationMinutes: number | null) => Promise<void>;
  toggleHide: (channelId: string) => Promise<void>;
  togglePin: (channelId: string) => Promise<void>;
  setNotificationLevel: (channelId: string, level: NotificationLevel) => Promise<void>;

  isMuted: (channelId: string) => boolean;
  isHidden: (channelId: string) => boolean;
  isPinned: (channelId: string) => boolean;
  getNotificationLevel: (channelId: string) => NotificationLevel;
}

export const useChannelSettingsStore = create<ChannelSettingsState>((set, get) => ({
  settings: {},
  loading: false,

  fetchSettings: async (serverChannelIds: string[]) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId || serverChannelIds.length === 0) return;

    const cached = readCachedChannelSettings(userId, serverChannelIds);
    if (cached) {
      set({ settings: cached, loading: false });
      return;
    }

    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('channel_user_settings')
        .select('*')
        .eq('user_id', userId)
        .in('channel_id', serverChannelIds);

      if (error) throw error;

      const map: Record<string, ChannelUserSettings> = {};
      (data || []).forEach((row: any) => {
        map[row.channel_id] = row;
      });
      persistChannelSettings(userId, serverChannelIds, map);
      set({ settings: map });
    } catch (e) {
      console.error('Failed to fetch channel settings:', e);
    } finally {
      set({ loading: false });
    }
  },

  toggleMute: async (channelId: string) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    const current = get().settings[channelId];
    const newVal = !(current?.is_muted ?? false);

    const { error } = await supabase.from('channel_user_settings').upsert(
      { channel_id: channelId, user_id: userId, is_muted: newVal, mute_until: null },
      { onConflict: 'channel_id,user_id' }
    );
    if (error) { console.error(error); return; }

    set((s) => ({
      settings: {
        ...s.settings,
        [channelId]: { ...defaultSettings(channelId, userId), ...s.settings[channelId], is_muted: newVal, mute_until: null },
      },
    }));
  },

  muteFor: async (channelId: string, durationMinutes: number | null) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;

    const muteUntil = durationMinutes
      ? new Date(Date.now() + durationMinutes * 60_000).toISOString()
      : null;

    const { error } = await supabase.from('channel_user_settings').upsert(
      { channel_id: channelId, user_id: userId, is_muted: true, mute_until: muteUntil },
      { onConflict: 'channel_id,user_id' }
    );
    if (error) { console.error(error); return; }

    set((s) => ({
      settings: {
        ...s.settings,
        [channelId]: { ...defaultSettings(channelId, userId), ...s.settings[channelId], is_muted: true, mute_until: muteUntil },
      },
    }));
  },

  toggleHide: async (channelId: string) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    const current = get().settings[channelId];
    const newVal = !(current?.is_hidden ?? false);

    const { error } = await supabase.from('channel_user_settings').upsert(
      { channel_id: channelId, user_id: userId, is_hidden: newVal },
      { onConflict: 'channel_id,user_id' }
    );
    if (error) { console.error(error); return; }

    set((s) => ({
      settings: {
        ...s.settings,
        [channelId]: { ...defaultSettings(channelId, userId), ...s.settings[channelId], is_hidden: newVal },
      },
    }));
  },

  togglePin: async (channelId: string) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    const current = get().settings[channelId];
    const newVal = !(current?.is_pinned ?? false);

    const { error } = await supabase.from('channel_user_settings').upsert(
      { channel_id: channelId, user_id: userId, is_pinned: newVal },
      { onConflict: 'channel_id,user_id' }
    );
    if (error) { console.error(error); return; }

    set((s) => ({
      settings: {
        ...s.settings,
        [channelId]: { ...defaultSettings(channelId, userId), ...s.settings[channelId], is_pinned: newVal },
      },
    }));
  },

  setNotificationLevel: async (channelId: string, level: NotificationLevel) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;

    const { error } = await supabase.from('channel_user_settings').upsert(
      { channel_id: channelId, user_id: userId, notification_level: level },
      { onConflict: 'channel_id,user_id' }
    );
    if (error) { console.error(error); return; }

    set((s) => ({
      settings: {
        ...s.settings,
        [channelId]: { ...defaultSettings(channelId, userId), ...s.settings[channelId], notification_level: level },
      },
    }));
  },

  isMuted: (channelId: string) => {
    const s = get().settings[channelId];
    if (!s?.is_muted) return false;
    if (s.mute_until && new Date(s.mute_until) < new Date()) return false;
    return true;
  },

  isHidden: (channelId: string) => get().settings[channelId]?.is_hidden ?? false,
  isPinned: (channelId: string) => get().settings[channelId]?.is_pinned ?? false,
  getNotificationLevel: (channelId: string) => get().settings[channelId]?.notification_level ?? 'all',
}));

function defaultSettings(channelId: string, userId: string): ChannelUserSettings {
  return {
    channel_id: channelId,
    user_id: userId,
    is_muted: false,
    is_hidden: false,
    is_pinned: false,
    notification_level: 'all',
    mute_until: null,
  };
}
