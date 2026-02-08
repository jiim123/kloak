/**
 * Voice Settings Validation Utilities
 * Ensures settings conform to expected shapes and ranges
 */

import { VoiceSettings, DEFAULT_VOICE_SETTINGS } from '@/types/voiceSettings';

/**
 * Clamp a number to a range
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Validate and sanitize voice settings from database
 * Returns a valid VoiceSettings object, filling in defaults for missing/invalid values
 */
export function validateVoiceSettings(settings: unknown): VoiceSettings {
  if (!settings || typeof settings !== 'object') {
    return { ...DEFAULT_VOICE_SETTINGS };
  }

  const raw = settings as Record<string, unknown>;

  return {
    // Audio Devices
    inputDeviceId: typeof raw.inputDeviceId === 'string' ? raw.inputDeviceId : null,
    outputDeviceId: typeof raw.outputDeviceId === 'string' ? raw.outputDeviceId : null,

    // Volume & Gain
    inputGain: typeof raw.inputGain === 'number' 
      ? clamp(Math.round(raw.inputGain), 0, 200) 
      : DEFAULT_VOICE_SETTINGS.inputGain,
    outputVolume: typeof raw.outputVolume === 'number' 
      ? clamp(Math.round(raw.outputVolume), 0, 200) 
      : DEFAULT_VOICE_SETTINGS.outputVolume,

    // Voice Mode
    voiceMode: raw.voiceMode === 'voice_activity' || raw.voiceMode === 'push_to_talk' 
      ? raw.voiceMode 
      : DEFAULT_VOICE_SETTINGS.voiceMode,
    voiceActivityThreshold: typeof raw.voiceActivityThreshold === 'number' 
      ? clamp(Math.round(raw.voiceActivityThreshold), 0, 100) 
      : DEFAULT_VOICE_SETTINGS.voiceActivityThreshold,
    pttKeybind: typeof raw.pttKeybind === 'string' && raw.pttKeybind.length > 0 
      ? raw.pttKeybind 
      : DEFAULT_VOICE_SETTINGS.pttKeybind,
    pttMode: raw.pttMode === 'hold' || raw.pttMode === 'toggle' 
      ? raw.pttMode 
      : DEFAULT_VOICE_SETTINGS.pttMode,

    // Audio Processing
    noiseSuppression: typeof raw.noiseSuppression === 'boolean' 
      ? raw.noiseSuppression 
      : DEFAULT_VOICE_SETTINGS.noiseSuppression,
    echoCancellation: typeof raw.echoCancellation === 'boolean' 
      ? raw.echoCancellation 
      : DEFAULT_VOICE_SETTINGS.echoCancellation,
    autoGainControl: typeof raw.autoGainControl === 'boolean' 
      ? raw.autoGainControl 
      : DEFAULT_VOICE_SETTINGS.autoGainControl,

    // Notifications & Feedback
    joinLeaveSound: typeof raw.joinLeaveSound === 'boolean' 
      ? raw.joinLeaveSound 
      : DEFAULT_VOICE_SETTINGS.joinLeaveSound,
    pttActivationSound: typeof raw.pttActivationSound === 'boolean' 
      ? raw.pttActivationSound 
      : DEFAULT_VOICE_SETTINGS.pttActivationSound,
    visualOnlyMode: typeof raw.visualOnlyMode === 'boolean' 
      ? raw.visualOnlyMode 
      : DEFAULT_VOICE_SETTINGS.visualOnlyMode,

    // Privacy
    muteOnJoin: typeof raw.muteOnJoin === 'boolean' 
      ? raw.muteOnJoin 
      : DEFAULT_VOICE_SETTINGS.muteOnJoin,
    autoDisconnectMinutes: typeof raw.autoDisconnectMinutes === 'number' 
      ? clamp(Math.round(raw.autoDisconnectMinutes), 0, 60) 
      : DEFAULT_VOICE_SETTINGS.autoDisconnectMinutes,
    hideVoiceActivity: typeof raw.hideVoiceActivity === 'boolean' 
      ? raw.hideVoiceActivity 
      : DEFAULT_VOICE_SETTINGS.hideVoiceActivity,

    // Accessibility
    visualVoiceIndicators: typeof raw.visualVoiceIndicators === 'boolean' 
      ? raw.visualVoiceIndicators 
      : DEFAULT_VOICE_SETTINGS.visualVoiceIndicators,
    monoAudio: typeof raw.monoAudio === 'boolean' 
      ? raw.monoAudio 
      : DEFAULT_VOICE_SETTINGS.monoAudio,

    // Per-user volume overrides
    userVolumeOverrides: validateUserVolumeOverrides(raw.userVolumeOverrides),
  };
}

/**
 * Validate user volume overrides map
 */
function validateUserVolumeOverrides(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const result: Record<string, number> = {};
  const raw = value as Record<string, unknown>;

  for (const [userId, volume] of Object.entries(raw)) {
    if (typeof volume === 'number' && volume >= 0 && volume <= 200) {
      result[userId] = Math.round(volume);
    }
  }

  return result;
}

/**
 * Check if settings have changed from defaults
 */
export function hasSettingsChanged(settings: VoiceSettings): boolean {
  return JSON.stringify(settings) !== JSON.stringify(DEFAULT_VOICE_SETTINGS);
}

/**
 * Format keybind for display
 */
export function formatKeybind(keybind: string): string {
  const parts = keybind.split('+');
  return parts.map(part => {
    switch (part.toLowerCase()) {
      case 'control':
      case 'ctrl':
        return 'Ctrl';
      case 'alt':
        return 'Alt';
      case 'shift':
        return 'Shift';
      case 'meta':
        return navigator.platform.includes('Mac') ? '⌘' : 'Win';
      case 'space':
        return 'Space';
      case ' ':
        return 'Space';
      default:
        return part.length === 1 ? part.toUpperCase() : part;
    }
  }).join(' + ');
}

/**
 * Parse a keyboard event into a keybind string
 */
export function keyboardEventToKeybind(e: KeyboardEvent): string | null {
  // Ignore modifier-only keys
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
    return null;
  }

  const parts: string[] = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey) parts.push('Meta');

  // Handle special keys
  let key = e.key;
  if (key === ' ') key = 'Space';
  else if (key.length === 1) key = key.toUpperCase();

  parts.push(key);
  return parts.join('+');
}
