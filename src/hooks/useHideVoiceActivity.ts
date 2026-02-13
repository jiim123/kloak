/**
 * Hide Voice Activity Hook
 * Now a no-op shell — hideVoiceActivity is managed directly by useAgoraRoom
 * via Supabase Broadcast. This hook is kept for backward compatibility.
 */

import { useVoiceSettingsStore } from '@/stores/voiceSettingsStore';

interface UseHideVoiceActivityOptions {
  room: unknown;
  isConnected: boolean;
}

export function useHideVoiceActivity(_opts: UseHideVoiceActivityOptions) {
  // hideVoiceActivity sync is handled in useAgoraRoom via broadcast channel
  return { updateMetadata: () => {} };
}

/**
 * Check if a participant has hidden their voice activity
 * Now reads from the participant object's hideVoiceActivity field directly
 */
export function shouldShowSpeakingIndicator(
  participant: { identity?: string; isSpeaking?: boolean; hideVoiceActivity?: boolean } | null,
  isSpeaking: boolean,
  localUserId?: string
): boolean {
  if (!participant) return false;
  if (participant.identity === localUserId) return isSpeaking;
  if (participant.hideVoiceActivity) return false;
  return isSpeaking;
}

/**
 * Hook to get whether voice activity should be shown for a participant
 */
export function useParticipantSpeaking(
  participant: { identity?: string; isSpeaking?: boolean; hideVoiceActivity?: boolean; metadata?: string } | null,
  localUserId?: string
): boolean {
  if (!participant) return false;
  return shouldShowSpeakingIndicator(participant, participant.isSpeaking ?? false, localUserId);
}
