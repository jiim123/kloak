/**
 * Voice Settings Type Definitions
 * All types related to voice chat settings and preferences
 */

export type VoiceMode = 'voice_activity' | 'push_to_talk';
export type PTTMode = 'hold' | 'toggle';

export interface VoiceSettings {
  // Audio Devices
  inputDeviceId: string | null;
  outputDeviceId: string | null;

  // Volume & Gain
  inputGain: number; // 0-200 (percentage), default 100
  outputVolume: number; // 0-100 (percentage), default 100

  // Voice Mode
  voiceMode: VoiceMode;
  voiceActivityThreshold: number; // 0-100 (sensitivity), default 50
  pttKeybind: string; // default 'Space'
  pttMode: PTTMode;

  // Audio Processing
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;

  // Notifications & Feedback
  joinLeaveSound: boolean;
  pttActivationSound: boolean;
  visualOnlyMode: boolean;

  // Privacy
  muteOnJoin: boolean;
  autoDisconnectMinutes: number; // 0 = disabled
  hideVoiceActivity: boolean;

  // Accessibility
  visualVoiceIndicators: boolean;
  monoAudio: boolean;

  // Per-user volume overrides
  userVolumeOverrides: Record<string, number>; // userId -> volume 0-100
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  inputDeviceId: null,
  outputDeviceId: null,
  inputGain: 100,
  outputVolume: 100,
  voiceMode: 'voice_activity',
  voiceActivityThreshold: 50,
  pttKeybind: 'Space',
  pttMode: 'hold',
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl: true,
  joinLeaveSound: true,
  pttActivationSound: true,
  visualOnlyMode: false,
  muteOnJoin: true, // Kloak privacy-first default
  autoDisconnectMinutes: 0,
  hideVoiceActivity: false,
  visualVoiceIndicators: true,
  monoAudio: false,
  userVolumeOverrides: {},
};

export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
  isDefault: boolean;
}
