/**
 * Voice Settings Store
 * Manages user voice preferences with Supabase persistence
 */

import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { VoiceSettings, DEFAULT_VOICE_SETTINGS } from '@/types/voiceSettings';
import { validateVoiceSettings } from '@/utils/voiceSettingsValidation';

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

// Debounced save function
async function debouncedSave(userId: string, settings: VoiceSettings) {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  
  saveTimeout = setTimeout(async () => {
    try {
      // Cast to any since RPC may not be in generated types yet
      await (supabase.rpc as Function)('upsert_user_voice_settings', {
        p_user_id: userId,
        p_settings: settings,
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

    try {
      // Cast to any since RPC may not be in generated types yet
      const { data, error } = await (supabase.rpc as Function)('get_user_voice_settings', {
        p_user_id: userId,
      });

      if (error) {
        // If function doesn't exist yet, use defaults
        if (error.message.includes('function') || error.code === '42883') {
          set({ 
            settings: { ...DEFAULT_VOICE_SETTINGS }, 
            isLoaded: true, 
            isLoading: false 
          });
          return;
        }
        throw error;
      }

      const validatedSettings = validateVoiceSettings(data);
      set({ settings: validatedSettings, isLoaded: true, isLoading: false });
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
    const clampedVolume = Math.max(0, Math.min(200, Math.round(volume)));
    
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
        // Cast to any since RPC may not be in generated types yet
        await (supabase.rpc as Function)('upsert_user_voice_settings', {
          p_user_id: currentUserId,
          p_settings: DEFAULT_VOICE_SETTINGS,
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
    set({ 
      settings: { ...DEFAULT_VOICE_SETTINGS }, 
      isLoaded: false, 
      isLoading: false,
      error: null,
    });
  },
}));
