/**
 * Voice Settings Store
 * Manages user voice preferences with Supabase persistence
 */

import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { VoiceSettings, DEFAULT_VOICE_SETTINGS } from '@/types/voiceSettings';
import { validateVoiceSettings } from '@/utils/voiceSettingsValidation';

type UserVoiceSettingsRow = Database["public"]["Tables"]["user_voice_settings"]["Row"];
type BroadcastMutationPayload<T> = {
  op?: 'INSERT' | 'UPDATE' | 'DELETE';
  new?: T | null;
  old?: T | null;
};

interface VoiceSettingsStore {
  settings: VoiceSettings;
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadSettings: (userId: string) => Promise<void>;
  updateSetting: <K extends keyof VoiceSettings>(key: K, value: VoiceSettings[K]) => void;
  updateSettings: (partial: Partial<VoiceSettings>) => void;
  setUserVolume: (userId: string, volume: number) => void;
  getUserVolume: (userId: string) => number;
  resetToDefaults: () => Promise<void>;
  clearSettings: () => void;
}

// Debounce timer for saving
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let currentUserId: string | null = null;
let settingsChannel: RealtimeChannel | null = null;

// Debounced save function
async function debouncedSave(userId: string, settings: VoiceSettings) {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  
  saveTimeout = setTimeout(async () => {
    try {
      await supabase.from('user_voice_settings').upsert({
        user_id: userId,
        settings: settings as unknown as Database["public"]["Tables"]["user_voice_settings"]["Insert"]["settings"],
      });
    } catch (error) {
      console.error('Failed to save voice settings:', error);
    }
  }, 500);
}

export const useVoiceSettingsStore = create<VoiceSettingsStore>((set, get) => ({
  settings: { ...DEFAULT_VOICE_SETTINGS },
  isLoaded: false,
  isLoading: false,
  error: null,

  loadSettings: async (userId: string) => {
    currentUserId = userId;
    set({ isLoading: true, error: null });

    if (settingsChannel) {
      supabase.removeChannel(settingsChannel);
      settingsChannel = null;
    }

    try {
      const { data, error } = await supabase
        .from('user_voice_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      const validatedSettings = validateVoiceSettings(data?.settings ?? DEFAULT_VOICE_SETTINGS);
      set({ settings: validatedSettings, isLoaded: true, isLoading: false });

      settingsChannel = supabase
        .channel(`user:${userId}`)
        .on(
          'broadcast',
          {
            event: 'voice_settings',
          },
          (payload) => {
            const eventPayload = payload as BroadcastMutationPayload<UserVoiceSettingsRow>;
            if (eventPayload.op === 'DELETE') {
              set({ settings: { ...DEFAULT_VOICE_SETTINGS }, isLoaded: true, isLoading: false });
              return;
            }

            const row = eventPayload.new as UserVoiceSettingsRow | null;
            set({
              settings: validateVoiceSettings(row?.settings ?? DEFAULT_VOICE_SETTINGS),
              isLoaded: true,
              isLoading: false,
            });
          },
        )
        .subscribe();
    } catch (error) {
      console.error('Failed to load voice settings:', error);
      // Use defaults on error
      set({ 
        settings: { ...DEFAULT_VOICE_SETTINGS }, 
        isLoaded: true, 
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load settings',
      });
    }
  },

  updateSetting: (key, value) => {
    const newSettings = { ...get().settings, [key]: value };
    set({ settings: newSettings });
    
    if (currentUserId) {
      debouncedSave(currentUserId, newSettings);
    }
  },

  updateSettings: (partial) => {
    const newSettings = { ...get().settings, ...partial };
    set({ settings: newSettings });
    
    if (currentUserId) {
      debouncedSave(currentUserId, newSettings);
    }
  },

  setUserVolume: (userId: string, volume: number) => {
    const { settings } = get();
    const clampedVolume = Math.max(0, Math.min(100, Math.round(volume)));
    
    const newOverrides = { ...settings.userVolumeOverrides };
    
    if (clampedVolume === 100) {
      // Remove override if set to default
      delete newOverrides[userId];
    } else {
      newOverrides[userId] = clampedVolume;
    }

    const newSettings = { ...settings, userVolumeOverrides: newOverrides };
    set({ settings: newSettings });
    
    if (currentUserId) {
      debouncedSave(currentUserId, newSettings);
    }
  },

  getUserVolume: (userId: string) => {
    const { settings } = get();
    return settings.userVolumeOverrides[userId] ?? 100;
  },

  resetToDefaults: async () => {
    set({ settings: { ...DEFAULT_VOICE_SETTINGS } });
    
    if (currentUserId) {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      
      try {
        await supabase.from('user_voice_settings').upsert({
          user_id: currentUserId,
          settings: DEFAULT_VOICE_SETTINGS,
        });
      } catch (error) {
        console.error('Failed to reset voice settings:', error);
      }
    }
  },

  clearSettings: () => {
    currentUserId = null;
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
    if (settingsChannel) {
      supabase.removeChannel(settingsChannel);
      settingsChannel = null;
    }
    set({ 
      settings: { ...DEFAULT_VOICE_SETTINGS }, 
      isLoaded: false, 
      isLoading: false,
      error: null,
    });
  },
}));
